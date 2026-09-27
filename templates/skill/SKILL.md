---
name: telegram-post-writer
description: Writes and edits Telegram channel posts in Uzbek or Russian that match the channel's voice, with a hook in the first line, short paragraphs, and one clear call to action. Use when the user asks to write, rewrite, shorten, or translate a Telegram post, a channel announcement, or a caption for a Telegram channel, even if they only say "post" or "e'lon".
---

# Telegram Post Writer

<!--
  TEMPLATE. Copy this folder to skills/<your-skill-name>/ and rewrite everything.
  - `name` above must equal the folder name: lowercase, digits and hyphens, at most 64 characters.
  - `description` is what the agent reads to decide WHEN to load this skill. See CONTRIBUTING.md.
  - Delete this comment block when you are done.
-->

One or two sentences on what this skill makes the agent do, and what "good" looks like.

## Before you start

Ask the user only what you cannot infer:

1. Which language: Uzbek (Latin script) or Russian?
2. The channel's audience and tone (examples of past posts are best).
3. The one action the reader should take.

## Steps

1. **Hook.** Write the first line so it works alone in the notification preview (under ~80 characters).
2. **Body.** Short paragraphs of 1–3 sentences. One idea per paragraph.
3. **Call to action.** One, at the end. A link or a button text, not both.
4. **Check.** Read it back as the reader. Cut every sentence that does not earn its place.

## Rules

- Uzbek: use the correct apostrophes: oʻ and gʻ with ʻ (U+02BB), and ʼ (U+02BC) for the tutuq belgisi (taʼlim, maʼno).
- No more than one emoji per paragraph.
- Never invent facts, prices, or dates. Ask.

## Example

**Input:** "Write a post announcing that enrolment for the AI Praktikum opens on Monday."

**Output:**

> AI Praktikumʼga yozilish dushanba kuni ochiladi.
>
> ...

## Files in this skill

Put long reference material in separate files next to SKILL.md and link them, so the agent reads them only when needed. For example:

- `reference/style-guide.md`: the channel's full style guide (read when the user asks for a long post).
