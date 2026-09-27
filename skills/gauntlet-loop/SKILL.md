---
name: gauntlet-loop
description: Run a Gauntlet Loop — give an agent a concrete quality bar it can't talk its way around, let it split the work into independently judgeable pieces, pair each piece with a fresh-context critic that blind A/B tests the output against the bar, and keep looping until it wins. Use whenever the user wants work driven far past "good enough" — phrasings like "production-ready", "make it amazing", "AAA quality", "as good as [some reference]", "keep improving until it's perfect", "don't stop at the first working version", "beat a named competitor's version" — and for any build, redesign, refactor, campaign, or piece of writing where the output can be inspected and compared against something better. Also trigger on "gauntlet loop", "run a gauntlet", "fan out subagents and critique", or requests to set up a self-improving agent run.
---

# Gauntlet Loop

The method behind Matt Shumer's Claude of Duty — a Call of Duty-quality FPS built by Claude Code from a single short prompt. Source: https://somethingbig.ai/gauntlet-loop · original prompt: https://github.com/mshumer/Claude-of-Duty/blob/main/prompt.md

The core, in one line: **give the agent a bar it cannot talk its way around, let it split the work, never let the builder grade itself, and keep looping.**

Most agent runs stop the moment output is decent. A Gauntlet Loop doesn't, because the stopping decision is taken away from the builder and handed to an independent critic comparing against something concretely better.

## First: this needs a real agentic harness

Do **not** run this in a plain chat. It requires an agent that can open files, run code, render results, inspect screenshots, use tools, and spawn subagents — Claude Code or Codex.

- **Claude Code with Opus 5** is the default, especially for visual or creative work. Its subagents each get a clean context window, which is exactly what independent critics need.
- **Codex** is strong for backend work and decent at criticizing a visual result, but weaker at creating one.
- Turn on **ultracode** for serious runs (`/effort` → `ultracode`). It costs more; on large multi-agent runs it's usually worth it.

If the user is in a plain chat, say so and help them draft the run prompt to paste into Claude Code instead of pretending to execute it.

---

# The five moves

## 1. Give the goal, not the implementation

State what you want. Do not prescribe how to build it. The original game prompt contained no architecture, no system list, no renderer design — it named the target, told the agent to fan out subagents, demanded a harsh separate visual critic, named the comparison, and said don't stop.

Recent models are good at deciding how to attack a large goal. Prescribing the architecture, the workstreams, and every step replaces the model's judgment with yours. **Give the destination, let it choose the route.**

When helping someone write a run prompt, keep it short. Resist the urge to over-specify — that urge is the main way people water this method down.

## 2. Give it a real bar

This is the most important part, and the part everyone gets wrong.

**"Make it amazing" is not a bar. Neither is "make it production-ready" or "keep improving it."** Those are adjectives; the agent can argue its way past any of them. A bar is something concrete the critic can *inspect and compare its work against, side by side.*

For the game, the bar was actual Call of Duty screenshots. The critic looked at both and decided which was better.

The bar does not have to be realistically reachable. The game never actually beat Call of Duty — the run was stopped while it was still improving. The bar's job is to give direction and to prevent stopping at "pretty good for AI."

### Picking a bar by domain

| Domain | A real bar looks like |
|---|---|
| Visual / game / 3D | Screenshots or footage from the best real product in the category |
| Website / landing page | 3–5 of the best real sites in that category, screenshotted |
| Product / app UI | The actual competitor app's screens; a design system reference |
| Backend / infra | A test suite, latency target, failure-recovery test, security review, or reference implementation |
| Writing | Paragraphs with the clarity and information density you want — used to ask "is every paragraph at least this clear?", not to copy voice |
| Research | The best existing report on the topic; a source-coverage or falsification checklist |
| Marketing / creative | The top-performing real ads in the category; a named brand's execution quality |
| Data / extraction | Ground-truth labeled samples; a documented accuracy threshold |

**If you don't know the bar, make finding one part of the task.** Don't just tell the agent "decide what good means" — that regenerates the same vagueness. Instead: *find a concrete comparison or measurement that plays the same role here that real Call of Duty screenshots played for Claude of Duty, explain why it's a useful bar, then judge every round against it.*

## 3. Let the lead agent split the work

Tell the lead agent to break the goal into **the smallest pieces that can be improved and judged separately** — then let it decide what those pieces are.

For a game: gun, hands, trees, lighting, movement, enemy behavior, sound, individual effects. For an article: argument, opening, examples, each section, transitions. But don't specify that list up front. The lead agent understands the artifact and can tell which parts separate cleanly, which belong together, and which can run in parallel.

The reason decomposition matters: "make the game better" is too vague to attack repeatedly. "Make this one tree compare favorably with this tree in the reference" is a problem a critic can rule on again and again.

Each piece gets its **own builder and its own critic.**

## 4. Never let the builder grade itself

The builder has seen every decision it made and remembers why. That makes it excellent at explaining why its work is reasonable. You don't want reasonable — you want an independent verdict.

**Spawn a fresh critic subagent.** Give it the goal, the bar, the relevant rules, and the actual artifact. Do **not** give it the builder's history, reasoning, or self-assessment.

The critic must inspect **the real thing** — actual pixels, the running product, the rendered page, real test output, the finished prose. It must never grade a summary the builder wrote about its own work. A critic reviewing a builder's description is not a critic.

### The blind A/B protocol

Where possible the critic behaves like an A/B tester rather than a grader:

1. Present the output and the reference **without labeling which is which**.
2. The critic picks the better one and says why.
3. If ours loses, it names **the single biggest remaining gap** — specific and actionable, not a list of twelve nits.
4. That gap goes back to the builder as the next round's task.
5. Loop.

Blind comparison is the anti-gaming mechanism. A 1–10 self-score is trivially inflated; "which of these two is better" is much harder to fudge. Numeric scores are optional bookkeeping on top — the verdict is the comparison.

## 5. Let it keep going

Do not tell it to do three rounds and stop. **There should be no arbitrary final round.** Claude Code's `/loop` skill helps with repeated agent work, but the idea matters more than the tool.

With a high enough bar there is almost always another gap to close. Stop when:

- you like the result, or
- improvements have become too small to matter, or
- you've spent as much compute as you're willing to spend.

Those are human calls, made from watching the output — not conditions the builder gets to declare for itself. The Claude of Duty run was still improving when it was stopped.

---

# Running it

## The lead agent's job

1. Restate the goal and the bar in one line each.
2. Decompose into the smallest independently-judgeable pieces. Note which can run in parallel.
3. For each piece, fan out a **builder** and a separate **fresh-context critic**.
4. Keep a live progress page updated as work lands.
5. After each major wave, run a **smoothing pass**.
6. Keep looping. Don't announce completion — report state and let the human call it.

## Builder brief (template)

```
Piece: <the specific component>
Goal: <what this piece must achieve>
Bar: <the concrete reference for this piece>
Current gap to close: <the critic's single biggest finding, verbatim>

Build/fix this piece. Make the real artifact — not a description of it.
When done, leave the output in a state a critic can inspect directly
(running, rendered, or executable).
```

## Critic brief (template)

```
You are an independent critic with no history of how this was built.
Do not accept any explanation of the work — inspect the artifact itself.

Bar: <reference artifact / measurement>
Artifact: <path, URL, screenshot, or command to run>

1. Compare the artifact against the bar directly. Blind A/B where possible:
   view both without knowing which is which, and pick the better one.
2. If ours loses, name THE single biggest remaining gap — specific,
   located, and actionable. Not a list.
3. Be harsh. "Good for AI" is a failure. The question is only whether
   ours beats the bar.

Output: winner + the one gap to close next.
```

## Live progress page

For long runs, have the lead agent maintain a simple live HTML page (or a `workbench.md`) and update it as work lands — screenshots, clips, drafts, test results, whatever suits the artifact. Don't over-specify the format; let the agent pick.

The point is that you can check progress from your phone without interrupting the run. Interrupting a Gauntlet Loop every twenty minutes to ask for a status update is how you lose the benefit of it.

## Smoothing pass

When many agents improve separate parts of one artifact, the pieces come out individually good but slightly inconsistent with each other.

At the end of each major wave, spawn one fresh agent to inspect the **complete** result and smooth it: resolve conflicts, align the pieces, make it feel like one thing rather than a collection of separately-optimized parts. Its job is not to redesign.

This is a useful add-on, not the core. The core stays: **split, build, judge, repeat.**

---

# Guardrails

The loop is aggressive by design. These keep it from being destructive:

- **Human checkpoints.** Pause and ask before anything hard to reverse: deleting data, schema migrations, force-pushes, dependency upgrades that break interfaces, publishing, or spending money. Those are decisions, not iterations.
- **Cost is real.** Long multi-agent runs with ultracode consume serious compute. State that up front and agree a rough ceiling, even though there's no fixed round count.
- **Never fake a verdict.** If a critic couldn't actually run or view the artifact, say so and mark that piece unjudged. A fabricated "looks great" is worse than an admitted gap — it silently ends the loop.
- **Keep diffs reviewable.** If one piece balloons into a rewrite, flag it for human review rather than burying it.

---

# Meta-prompt: generate a run prompt

When someone has a goal but no prompt, use this to produce one. Paste it into a strong model along with the goal, then run the output inside Claude Code or Codex.

```
I want to run a Gauntlet Loop for this goal:

[GOAL]

Possible references or quality bars:

[OPTIONAL REFERENCES]

Choose the strongest concrete bar an agent can actually inspect and compare
its work against. If I haven't supplied one, propose a comp or measurement
that plays the same role here that real Call of Duty screenshots played for
Matt Shumer's Claude of Duty project. Explain the bar in one sentence.

Then write a SHORT prompt for Claude Code or Codex. Minimal is better —
we want the agent deciding the specifics.

Give the lead agent the goal and the bar, but let it choose the approach.
Tell it to divide the goal into the smallest pieces that can be improved and
judged independently. For each important piece, fan out a builder and a
separate critic with fresh context.

Each critic must inspect the real output, compare it directly with the bar —
blind A/B where possible — identify the biggest remaining gap, and send it
back for another round. Keep looping until our output wins or I stop the run.

Have the lead agent maintain a simple live progress page showing the work
evolving over time.

Have it use subagents and ultracode. Do not prescribe the architecture, the
exact decomposition, or a fixed number of rounds. Keep the final prompt short.
```

---

# Worked example

Goal: a landing page that doesn't look AI-made.

```
Build a landing page for <product>.

The bar: Linear, Stripe, and Vercel's current homepages — screenshots in
/refs. Ours has to beat them, not resemble them.

Fan out subagents. Split it into the smallest pieces that can be judged
separately and decide that split yourself. For each piece, have a builder
and a SEPARATE critic subagent with fresh context. The critic renders the
real page, puts our piece next to the reference blind, picks which is
better, and if ours loses, names the single biggest gap and sends it back.

The critic must look at actual rendered output, never at the builder's
description of it. Be harsh — "good for an AI site" is a failure.

Keep a live progress page with screenshots as you go. Smoothing pass after
each wave so it reads as one design. /loop until our version wins or I stop
you. Use ultracode.
```

Same shape works for a data pipeline, an API, a research report, or an ad campaign. **Only the bar changes.**

---

# What this skill is not

- Not a fixed phase pipeline. The decomposition is the agent's call, not a template's.
- Not a rubric. A checklist of standards is a grading sheet, not a bar — the agent can satisfy every checkbox and still be mediocre. Use a real reference.
- Not a fixed iteration budget. No arbitrary final round; the human stops it.
- Not single-agent self-review. If the builder is grading itself, this isn't a Gauntlet Loop.
