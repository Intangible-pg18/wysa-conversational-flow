# Walkthrough: How this works

This is a more detailed walkthrough than the README.

# Index
#### Important functionalities implemented
#### The big idea: state and history are separate
#### DB design thought process
#### API Design & a typical request: "answer a question"
#### The resolver strategy
#### Checkpoints
#### Module switching closes the source module
#### Back navigation and supersession

## Important functionalities implemented

A user of a mental health app moves through questions. Each question has options; the option they pick decides what they see next. The brief had four hard parts:

1. Some questions are "checkpoints", after answering one, the questions before it shouldn't affect the flow anymore.
2. Some options send the user to a *different* module entirely.
3. Old links and notifications might point to a question the user has already passed (or one that doesn't exist anymore).
4. We need to keep the user's full history forever, even if their "current state" moves on.

## The big idea: state and history are separate

This is the most important thing in the codebase. I'll explain why.

If you put everything in one giant document : "user X has answered these questions and is currently at question Y", the checkpoint feature gets really painful to implement. After a checkpoint, you want previous answers to *stop influencing routing* but still be visible in history. If state and history are the same blob, you have to either delete past answers (loses data) or scan past a marker every time you compute the next question (fragile).

So I made them separate:

- **State** is "where the user is right now in this module." Small. One record per (user, module). Mutates when they answer.
- **History** is "everything the user has ever answered." Append-only. Grows forever. Read for clinical review, analytics, etc.

After a checkpoint, the state's `path` array gets reset to start from the checkpoint. History is left alone.

## DB design thought process

I went back and forth on a few things. Writing out the actual reasoning:

**Mongo or Postgres?** I picked Mongo. The data is naturally shaped like documents, a module has questions, questions have options, options have a target. In Postgres I'd either have three joined tables or a JSONB column (which is just Mongo with extra steps). State and history are also document-shaped. No join-heavy queries. Mongo fit.

**One big collection or several?** Three collections:
- `modules`: the flow definition. Static-ish, content authors edit modules occasionally. At boot, the JSON files in `data/modules/` are upserted into this collection. The JSON is the source of truth in the repo; Mongo is the runtime store.
- `user_module_states`: one record per (userId, moduleId). The user's current position.
- `conversation_history`: one record per answer. Append-only. The audit log.

**Embedded or separate questions?** Questions are embedded inside the module document (a `Record<questionId, question>`). I considered making questions a separate collection, but they're never queried independently, you always load them as part of a module. Embedding is right.

**What's the primary key for state?** Composite: `_id: { userId, moduleId }`. This makes the (user, module) uniqueness structural, you literally can't have two states for the same pair. No separate unique index needed.

**Indexes I added:**
- `(_id.userId, status)` on states, for "give me all active states for this user"
- `(userId, moduleId, timestamp desc)` on history, for "show this user their history in this module"
- `(userId, timestamp desc)` on history, for "show this user all their history"

**One thing I deliberately denormalized:** every history entry stores `questionText` and `optionLabel` at write time. If a content author edits the module later, old history still shows what the user actually saw and chose. History should be a frozen snapshot of what happened.

### API Design & a typical request: "answer a question"

Let's trace `POST /v1/modules/managing_anxiety/answer` with body `{questionId: "q1", optionId: "o3"}` and header `X-User-Id: u1`.

1. **Express receives it.** Helmet, CORS, JSON parsing all run first (in `src/app.ts`).
2. **Request logging middleware** assigns it a UUID, logs it, hooks `res.on("finish")` to log the result with duration.
3. **Route matches** `/v1/...` → mounted in `src/app.ts` as `app.use("/v1", v1Routes(repos))`.
4. **userContext middleware** (`src/middleware/user-context.ts`) reads `X-User-Id`, attaches it to `req.userId`. If missing → throws ValidationError → 400.
5. **Controller method runs:** `ConversationController.answer` in `src/controllers/conversation.controller.ts`.
   - Validates path params with Zod (`moduleParamsSchema`)
   - Validates body with Zod (`answerBodySchema`)
   - Calls `service.answer(userId, moduleId, questionId, optionId)`
6. **Service does the actual work** in `src/application/services/conversation-service.ts`:
   - Loads the module from Mongo
   - Loads the user's state for this module
   - Confirms state is active and not expired
   - Confirms `state.currentQuestionId === questionId` (rejects stale requests with 409)
   - Looks up the option on the question, throws if invalid (400)
   - Runs the resolver to figure out the next step (next question, switch module, or end)
   - If the next step is a module switch, verifies the target module exists (throws if not, before any writes)
   - Checks if there's already an active history entry for this question. If yes, the user has rewound and is re-answering, supersede that entry and any later non-superseded entries.
   - Appends the new history entry
   - Updates state (path, currentQuestionId, lastActivityAt; if checkpoint, resets path; if end/switch, marks completed)
   - Saves state
   - Returns a `ConversationOutcome` (`{kind: "question", ...}` or `{kind: "completed", ...}`)
7. **Controller formats the response** via `toResponseBody`. If question, includes the question and state. If completed, computes whether it was completed recently and labels accordingly.
8. **Express sends the JSON.** The request-logging middleware fires `res.on("finish")` with status and duration.

### Error scenarios for this endpoint

- **Missing X-User-Id header** → 400 `VALIDATION_ERROR`. Caught at the userContext middleware before reaching the controller.
- **Malformed JSON body** → 400 `VALIDATION_ERROR`. Caught in the error middleware (it sniffs `SyntaxError` with a `body` property, that's how Express's body-parser signals it).
- **Body missing `questionId` or `optionId`** → 400 `VALIDATION_ERROR`. Zod schema rejects in the controller.
- **Module doesn't exist** → 404 `NOT_FOUND`. Service's `requireModule` throws.
- **No state for this user-module** → 404 `NOT_FOUND`. State load returns null.
- **Session is expired or completed** → 409 `STATE_CONFLICT` ("session is not active").
- **`questionId` doesn't match `currentQuestionId`** → 409 `STATE_CONFLICT`. The user's client is stale or this is a duplicate retry. Client should refetch via `/current`.
- **`optionId` not in this question's options** → 400 `INVALID_OPTION`.
- **Switch target module doesn't exist** → 404 `NOT_FOUND`. Caught before any writes.
- **DB connection issue** → 500 `INTERNAL_ERROR`. Logged in full server-side; client gets a request ID.

### Other endpoints, briefly

**`POST /v1/modules/:moduleId/start`**
- Flow: userContext → controller.start → `ConversationService.start`
- Service: loads state. If none → fresh start. If active → resume. If completed → return completed outcome (controller decides "completed" vs "completed_recently" based on age). If expired (active but past 30 days inactive) → mark expired, then fresh start.
- Errors: missing header (400), unknown module (404).

**`GET /v1/modules/:moduleId/current`**
- Flow: userContext → controller.current → `ConversationService.getCurrent`
- Service: like `start` but read-only. If no state exists → 404 (the user hasn't started).
- Errors: missing header (400), unknown module (404), no state (404), DB error (500).

**`POST /v1/modules/:moduleId/back`**
- Flow: userContext → controller.back → `ConversationService.back`
- Service: pops the last entry off `state.path`, sets `currentQuestionId` to that popped question. Refuses if path is empty (already at entry) or if the last entry is the checkpoint (would un-anchor the checkpoint).
- Doesn't touch history. The supersession only happens on the next `answer`.
- Errors: missing header (400), unknown module (404), no state (404), at start of module (409), can't cross checkpoint (409).

**`GET /v1/deeplink?moduleId=X&questionId=Y`**
- Flow: userContext → controller.deepLink → `ConversationService.resolveDeepLink`
- Service: the trickiest one. The link's questionId is treated as a *hint*, never a command.
  - No state for this user-module → start fresh, return entry question.
  - State expired → mark expired, start fresh.
  - State completed → return completed outcome.
  - State active → return the *current* question, regardless of what the link said. Logs (debug) when the link is overridden.
  - If the linked questionId doesn't exist in the module at all (e.g., link from before a content update) → same fallback logic; the link is just ignored.
- Errors: missing header (400), unknown module (404).

**`GET /v1/history`**
- Flow: userContext → controller.history → repository directly (no service; it's a pure read).
- Returns up to 200 entries, newest first. Supports `?moduleId=X` to filter, `?limit=N` and `?before=ISODate` for pagination.
- Errors: missing header (400), bad query params (400).

**`GET /v1/state`**
- Flow: userContext → controller.state → repository directly.
- Returns all states for this user (active, completed, expired) across all modules.
- Errors: missing header (400).

**`GET /healthz`**
- No userContext. Pings Mongo, returns 200 if ok or 503 if degraded.

## Specific things worth understanding

### The resolver strategy

When the service needs to know "what comes next?" it asks a resolver. The interface (`NextQuestionResolver`) (using the Strategy design pattern) takes the current question, the option chosen, and the path so far, and returns one of three outcomes: another question, switch module, or end.

The only resolver implemented is `SimpleOptionResolver`, which just reads `option.target` and dispatches. But the registry design pattern (`getResolver(question.resolverType)`) is set up so a future `ScoreBasedResolver` or `MultiAnswerResolver` could be added without changing service code. Each question in the JSON declares its `resolverType` (always `"simple"` today).

### Checkpoints

When a question with `isCheckpoint: true` is answered, in addition to the normal flow:
- `state.path` is reset to contain only this checkpoint's answer (not appended to)
- `state.lastCheckpointId` is updated

The resolver doesn't know about checkpoints. It just reads `state.path`. The checkpoint logic is entirely in the service, where it belongs.

This is the cleanest part of the design. It made the brief's "previous context shouldn't affect future flow" requirement basically free.

### Module switching closes the source module

When an option's target is a switch:
- The source module's state goes to `status: completed`, `currentQuestionId: null`
- A new state for the target module is created (or resumed if it existed)

I considered leaving the source module "active" and trying to track that they switched out, but that creates weird half-states. Marking it completed and using the standard "you completed this, want a summary or redo?" flow when they come back is cleaner.

### Back navigation and supersession

This is the most subtle part of the codebase.

`back()` pops the last entry off `state.path` and sets `currentQuestionId` back to that entry's question. It doesn't touch history.

But what if the user goes back and then answers the same question with a *different* option? The history now has an old answer at this question (which is now stale) and might have answers at later questions (also stale because they were consequences of the old answer).

When `answer()` runs, it checks: "is there already an active history entry for this question?" If yes, it marks that entry, and every later non-superseded entry for this user-module, as `supersededBy: <new entry's id>`. Then it appends the new entry.

Reads of "all history" return everything, including superseded entries. If you wanted "active path history," you'd filter by `supersededBy: null`. The audit trail is preserved; the routing path is clean.

I struggled with whether to supersede when the option is the same (a re-confirm). I decided to always supersede, it makes the rule uniform and easy to reason about. The cost is a slightly larger history with same-option re-confirms.