# public/fonts — self-hosted subsets

Built by `scripts/fonts/build.sh` (masters are fetched into `media-src/fonts/`, git-ignored, from
[google/fonts](https://github.com/google/fonts) `ofl/`). Declared in `src/styles/fonts.css`.

| file | size | what |
|---|---:|---|
| `archivo-latin.woff2` | 28.8 KB (29476 B) | Archivo, `wdth` pinned to 100, `wght` variable 100–900, latin range, U+02BB patched in |
| `onest-latin.woff2` | 23.1 KB (23656 B) | Onest, `wght` variable 400–800, latin range |
| `poppins-{400,500,600}-latin(-ext).woff2` | ~8 KB each | Poppins, the label face (@fontsource/poppins 5, not built by build.sh). Replaced JetBrains Mono, which the owner banned (2026-09-23) |
| `onest-cyrillic.woff2` | 10.4 KB (10692 B) | Onest, `wght` variable 400–800, cyrillic range |

Cap: 80 KB per file, asserted by the build. Hinting, glyph names and legacy cmaps are stripped;
layout features kept: `kern`, `liga`, `calt`, `tnum` (+ `ccmp`, `locl`, `mark`, `mkmk`, `rvrn` so
combining marks position and the variable fonts substitute correctly). `fvar`/`gvar`/`HVAR` survive
for the single `wght` axis.

## Ranges (identical to the `unicode-range` descriptors in `fonts.css`)

- **latin** (Archivo, Onest):
  `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`
- **latin (mono)** (JetBrains Mono — no combining marks, arrows, division slash, BOM or U+FFFD):
  `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2212`
- **cyrillic** (Onest, JetBrains Mono):
  `U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116`

## The Archivo cmap patch — U+02BB

Uzbek Latin writes oʻ and gʻ with **U+02BB** (modifier letter turned comma) and maʼlumot with
**U+02BC**. Archivo ships U+02BC but not U+02BB, so without help every oʻ/gʻ would fall back to
Arial's glyph — a different weight and shape in the middle of a word. Archivo's U+2018 (‘, `quoteleft`)
is the same turned-comma shape, so `build.py` maps U+02BB to the `quoteleft` glyph in every Unicode
cmap subtable **before** subsetting (`patch_cmap`). The subsetter then keeps the glyph for both
codepoints. Onest and JetBrains Mono carry both apostrophes natively and are not patched.

The build reopens every woff2 and asserts: U+02BB and U+02BC are in the latin cmaps, `fvar` has
exactly one axis (`wght`) for Archivo and Onest (none for Plex), `gvar` is present, and every file
is ≤ 80 KB. It exits non-zero otherwise.

## Rebuild

```bash
scripts/fonts/build.sh
# which is: uv run --with fonttools==4.65.0 --with brotli python scripts/fonts/build.py
```

Masters (media-src/fonts/): `Archivo[wdth,wght].ttf`, `Onest[wght].ttf`, `IBMPlexMono-Regular.ttf`,
`IBMPlexMono-Medium.ttf`. Change a range here **and** in `fonts.css` — they are kept in sync by hand.
Visual check (renders `media-src/fonts/test.html` to `test.png` and prints canvas checks — Archivo's ʻ must be
pixel-identical to its ‘, and no ʻ/ʼ may match the Papyrus fallback the test page ends every stack with):

```bash
NODE_PATH=$PWD/node_modules /opt/homebrew/opt/node@22/bin/node media-src/fonts/shot.js
```
