# NEXT: skills.head.uz hand-off

## Session 2026-09-27 → 2026-09-28

### Done
- Repo `~/Downloads/head-skills` (public: github.com/anvarovali/head-skills). Work is on `build/v1` (pushed); master holds only the foundation plus the two skills.
- Stack: Vite 8 / React 19 / react-router 7 / CSS Modules / GSAP, with uz (default) / ru / en.
- Skills: `skills/<id>/SKILL.md` plus `head.json` (titles/summaries per locale, category, author, badges, `youtube` per locale). `scripts/build-catalog.mjs` builds catalog.json, zips, icons and `.claude-plugin/marketplace.json`.
- Pages: marketplace (All / Skills / Bundles), `/skill/:id` (For Agent / For Human install card, YouTube slot, Guide / Files tabs), `/bundle/praktikum-starter`, `/submit`, 404.
- Student flow: `validate:skills` (secrets / unsafe / unicode / schema checks), a CI workflow, CONTRIBUTING (uz/ru/en), a PR template and `templates/skill/`.
- Gauntlet against qoder.com/marketplace (verdicts in `workbench/verdicts.jsonl`, page in `workbench/progress.html`):
  - Won: DETAIL (desktop and mobile), SKILLS (desktop), LIST (mobile).
  - Frozen: LIST desktop after 12 rounds; the critics flip-flopped on the hero tile layout.
- Hero tiles: agent logos from simple-icons (Claude, Cursor, Gemini, Copilot; the owner approved logos) plus the two skill marks. simple-icons has no OpenAI mark.
- Intro A: picker → greeting → drop → folders / card burst → command → iris → cards land in the grid. The music is Magnific; 51 Envato SFX cues are baked into `public/audio/intro.mp3`.
- Intro B (`?intro=b`): all of A, then the cards morph into the six hero icons, which fly to their seats, and the hero builds. Playable (fad6776).
- Deployed to Vercel project `head-skills` (team `aliwebdevelopers-projects`), live at head-skills.vercel.app. This deploy predates the SFX and intro B work.

### Unfinished
- Intro B sound: DONE (a6fc905, 69 cues, onsets within 6 ms). Merged into build/v1.
- Owner hasn't listened to A or B with sound yet, and hasn't picked the default: `INTRO_VARIANT` in `src/components/intro/replay.ts`, currently 'a'.
- Not redeployed since the SFX / intro B / picker-hint changes.

### Owner to do
- Cloudflare DNS: `A skills 76.76.21.21`, DNS-only (grey cloud). Never switch head.uz's nameservers.
- Approve merging `build/v1` → master.
- Provide the Praktikum starter-pack skill list, and the YouTube IDs per skill (put them in head.json `youtube`).
- Author label: the card shows @handle, the detail page shows "HEAD". Pick one.

### Landmines
- LICENCE: the repo is public. Never commit Envato source files. SFX exist only baked into intro(.b).mp3. Raw files are in `~/Downloads/head-skills-sfx/raw`; rebuild with `node scripts/mix-intro.mjs`.
- The intro timeline is clocked to the audio (INTRO_OFFSET 3.8 s into the track). Changing the music or cutting audio shifts every cue.
- The intro flies the real `ExtensionCard` / hero tiles and relies on `data-grid`, `data-card-id` and `data-hero-*`. Keep those attributes when restyling.
- Uzbek copy uses ʻ/ʼ. Run `npm run validate:uz` (it now scans `const uz = {` blocks too).
- `?demo=1` (dev only) repeats cards, and the critics' shots used it. Production has only 2 skills and 1 bundle.
- `npx skills` groups skills under the LAST marketplace.json plugin entry listing them. That's why bundles are emitted first; keep that order.
- Deploy: `vercel deploy --prod --yes --scope aliwebdevelopers-projects` from the repo root (it's linked).

### Next session should
1. Have the owner listen to A and B with sound and pick INTRO_VARIANT.
2. `npm run build && vercel deploy --prod …`, then check skills.head.uz once DNS is set.
3. Merge build/v1 → master after the owner approves.
