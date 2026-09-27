# Gauntlet workbench

- `verdicts.jsonl` — one line per critic verdict (see scripts/critic-inbox.mjs --record)
- `critic-inbox/<uuid>/{A,B}.png` + `key.json` — blind pairs; critics never open key.json
- `shots/<wave>/<target>/…` — our and reference section screenshots (scripts/shoot.mjs)
- `assets.jsonl` — every Higgsfield/Magnific job with credits before/after
- `progress.html` — the live page (scripts/progress.mjs); published as an Artifact at each smoothing pass
- `CRITIC.md` — the critic brief template
- `NEXT.md` — the session hand-off

## Wave 07 pieces (the kott / lircle / GM bar — `scripts/progress.mjs` `PIECES`, refs in `refs/k3/`)

Shoot ours with `node scripts/shoot.mjs --wave 07 --target ours --pages home --locales uz` (stills + `hero@00…hero@100`
frames), `--sections offer --state hover` for L02, and `--motion` for K00/K02/G02. Reference stills come from
`ONLY=k3 node scripts/capture-refs.mjs` (see `refs/README.md`, "Reference 3").

| id | group | ours (`data-section` / capture) | reference still (`refs/`) |
|---|---|---|---|
| K00 | Kott | preloader filmstrip (`--motion`, `motion/preloader.strip.png`) | `k3/kott.loader.strip.png` |
| K01 | Kott | hero at rest (`hero@00`) | `k3/kott.desktop.hero@00.png` (+ mobile) |
| K02 | Kott | hero scrub (`--motion hero` strip; the `hero@00…@100` stills + `hero.strip` for the frame-by-frame) | `k3/kott.hero.strip.png` = `k3/kott.<vp>.hero.strip.png` |
| K03 | Kott | nav (`nav`) | `k3/kott.desktop.top.png` (header crop) |
| S01 | System | statement (`statement`) | `k3/kott.desktop.work.png` — the "Work that works." head |
| L01 | Lircle | offer list at rest (`offer`) | `k3/lircle.desktop.services.png` |
| L02 | Lircle | offer, row 1 hovered (`offer.hover`, `--state hover`) | `k3/lircle.desktop.services.hover.png` |
| S02 | System | marquee (`marquee`) | `k3/lircle.desktop.collab.png` — lircle collaborators strip |
| S03 | System | stats (`stats`) | `k3/gm.desktop.stats.png` — GM stats band |
| G01 | GM | team fan at rest (`team`) | `k3/gm.desktop.clients.png` |
| G02 | GM | team fan scroll (`--motion team` strip) | `k3/gm.clients.strip.png` = `k3/gm.<vp>.clients.strip.png` (0 / +400 / +800px) |
| S04 | System | testimonials (`testimonials`) | `k3/lircle.desktop.about.png` — nearest craft comp |
| L03 | Lircle | footer (`footer`) | `k3/lircle.desktop.footer.png` |
| X01 | Cross-cutting | full page (`full`, smoothing pass) | `k3/kott.desktop.full.png` |

Every piece is judged at both viewports (mobile references are the `k3/*.mobile.*` twins). The won rule is the one
in `scripts/critic-inbox.mjs`: the last two verdicts ours, two critics, opposite A/B orders, both viewports.
Older H01–H11 / M01–M04 ids (the Axiom bar, waves 01–06) stay readable in `verdicts.jsonl` and are marked legacy.
