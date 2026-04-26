# Wysa Conversation Flow Service

A backend service that powers question-based conversation flows for a mental health app. Users move through modules of questions; each option determines what comes next. Some questions act as checkpoints, some options switch the user to a different module, and the system can resume from where someone left off.

This was built as a take-home assignment.

## Tech stack & data

- Express + TypeScript backend
- MongoDB (Atlas) for storage
- Modules are seeded from JSON files in `data/modules/`
- Three main collections: `modules`, `user_module_states`, `conversation_history`

## Principles used

- Strategy + Registry design pattern for type of resolvers (decides what comes next when a user selects an answer for a question)
- Dependency Inversion principle (Conversation service depending on repository interfaces rather than on mongodb implementations)
- MVC pattern for seperation of concerns (Routes -> Controller -> Service -> Repository)
- Scalable design (API versioning)

## Setup

You need:
- Node 20 or higher
- A MongoDB Atlas cluster (free tier works) or any MongoDB you can connect to

Steps:

1. Clone and install:
```bash
   git clone 
   cd wysa-conversation-flow
   npm install
```

2. Copy the env template and fill in your values:
```bash
   cp .env.example .env
```

   Edit `.env`:
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/?retryWrites=true&w=majority
MONGODB_DB_NAME=wysa_conversation_flow
CORS_ORIGIN=*

3. Make sure your IP is allowed in Atlas (Network Access → Add IP).

4. Run in dev mode:
```bash
   npm run dev
```

   Or build and run:
```bash
   npm run build
   npm start
```

On boot, the service connects to Mongo, ensures indexes, seeds the JSON modules, and starts listening.

## Quick test

```bash
# Health check
curl http://localhost:3000/healthz

# Start a module (note the X-User-Id header — it's required on every /v1 route)
curl -X POST http://localhost:3000/v1/modules/managing_anxiety/start \
  -H 'X-User-Id: u1'

# Answer a question
curl -X POST http://localhost:3000/v1/modules/managing_anxiety/answer \
  -H 'X-User-Id: u1' \
  -H 'Content-Type: application/json' \
  -d '{"questionId":"q1","optionId":"o1"}'
```

## API summary

All routes below are under `/v1` and require the `X-User-Id` header.

| Method | Path | What it does |
|---|---|---|
| POST | `/modules/:moduleId/start` | Begin or resume a module |
| GET | `/modules/:moduleId/current` | Get the current question (no mutation) |
| POST | `/modules/:moduleId/answer` | Submit `{questionId, optionId}` |
| POST | `/modules/:moduleId/back` | Go back one question (bonus) |
| GET | `/deeplink?moduleId=X&questionId=Y` | Resolve a deep link to the right question |
| GET | `/history?moduleId=X&limit=N&before=T` | Paginated conversation history |
| GET | `/state` | All active states for the user |
| GET | `/healthz` | Health check (no header needed) |

For more detail on what the system does on each call and why it's designed this way, see [`WALKTHROUGH.md`](./WALKTHROUGH.md). For how I used AI tools while building this, see [`AI_USAGE.md`](./AI_USAGE.md).

## Folder layout
src/

app.ts                    # Express app setup

index.ts                  # Boot: connect, seed, start server

config/                   # env and logger

domain/                   # entity types, errors, constants

application/              # services, resolver strategy, repository interfaces

infrastructure/           # MongoDB repositories, seeder, DB connection

controllers/              # HTTP request handlers

routes/v1/                # versioned route definitions

middleware/               # error handling, async wrapper, user-context

validators/               # Zod schemas for request validation

data/

modules/                  # JSON files seeded into Mongo at boot

WALKTHROUGH.md                    # How the code actually works

AI_USAGE.md                 # How AI was used while building this

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run in watch mode with tsx |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled JS |
| `npm run typecheck` | Type-check without emitting files |

## Sample modules

`data/modules/managing_anxiety.json` is the main demo module. It has 6 questions, one checkpoint (q4), and one switch option (q4 → `crisis_support`).

`data/modules/crisis_support.json` is the small target module the switch points to.

To add your own module, drop a new JSON file into `data/modules/`. The seeder validates it on next boot and upserts it into Mongo.