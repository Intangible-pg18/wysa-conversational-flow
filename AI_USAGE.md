# AI Usage

Honestly, this assignment was a treat to work on, the kind of problem where every requirement (checkpoints, deep links, history vs state, module switches) actually makes you think about the data model rather than just writing CRUD. I enjoyed it.

A note on how I work with AI before getting into specifics. I try to lean on it only where it actually helps. There's an MIT study from last year showing reduced neural engagement when people over-rely on LLMs while writing, the "your brain on ChatGPT" one, and it stuck with me. The point isn't to avoid AI; it's to stay the one doing the thinking. Pair-programming with an AI is mostly about feeding it the right context and writing prompts that don't bias it toward what *I* already think. LLMs lean toward agreeing with the direction you're pushing, so a lot of my prompts are deliberately worded to ask for pushback or to make it commit to a position rather than echo mine.

That said, here's exactly where AI helped me on this assignment.

## 0. This doc, along with WALKTHROUGH.md was "written" (content was provided by me) by AI

## 1. Domain questions about the brief

Before writing any code, I read the brief and wrote out every part I wasn't sure about. I asked an LLM (Claude) for clarifications, framed not as "tell me the answer" but "give me real-world mental-health-app examples for each of these." The questions I asked, in the order I asked them:

- "Move within the same module", does that just mean going backward, since forward is via answering?
- The line "switch to a different module", does that imply the user is being asked some assessment, where the count of questions varies per user?
- "Re-enter the flow from an old link or notification", why would this happen, what's a real example?
- Checkpoint questions that reset previous context, I genuinely couldn't picture this; I wanted concrete examples.
- "If a question is no longer valid, return the latest valid question based on the user's current state", I wanted to break this into all the sub-cases.
- Multi-question dependencies, can a future question depend on multiple earlier answers, not just the most recent one? Is that a real thing in screeners?

These weren't "give me the design," they were "help me build a clearer picture of the problem space." Once I had that, the architecture decisions were mine.

## 2. TypeScript errors

A few times during setup, the type system threw errors I didn't immediately know how to fix, for example, needing `"types": ["node"]` in `tsconfig.json` when `@types/node` wasn't auto-discovered, and a couple of edge cases with the discriminated union types. I checked these against AI for quick diagnosis, then verified the fix worked. Faster than digging through Stack Overflow for setup-flavor questions.

## 3. HTTP status codes

I'm reasonably confident on the common ones (200, 400, 404, 500), but I checked AI for the right code on a couple of less-frequent cases, specifically `409 Conflict` for state mismatches and `410 Gone` for expired sessions. I wanted the conventionally correct status, not just "something in the 4xx range." I verified against MDN after.

## 4. Sample module data generation

The two sample modules in `data/modules/` (`managing_anxiety.json` and `crisis_support.json`), I drafted the structure myself (which questions, where the checkpoint goes, where the switch happens) but used AI to help with the natural-sounding question text and option labels. I didn't want it to read like "q1: How are you? a) Good b) Bad." Mental-health flows have a particular tone, and AI was useful for getting the wording closer to that without me overthinking each line. I edited the output to remove anything that felt off.

## 5. MongoDB docs (not AI)

Worth mentioning the inverse: for the actual MongoDB driver code, connection options, collection methods, index creation, the `mongodb+srv://` URI format, I went to the official MongoDB Node.js driver docs rather than asking AI. Two reasons. First, AI sometimes mixes up Mongoose syntax with the native driver's, and I wanted the native one. Second, official docs are the source of truth; LLMs sometimes can't fully access or parse a specific page, and even when they can, version-specific details can drift. For tools where I'm going to write a lot of code against an API surface, reading the docs once is faster than checking AI three times.