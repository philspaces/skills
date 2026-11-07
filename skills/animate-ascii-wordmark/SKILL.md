---
name: animate-ascii-wordmark
description: Create a custom animated ASCII wordmark from supplied text, with a standalone web preview, looping GIFs, and static fallbacks for websites and GitHub READMEs.
license: MIT; bundled fonts use SIL OFL 1.1
---

# Animate ASCII wordmark

Turn the user's text into a sparse, readable ASCII silhouette. One `@` cursor moves on the glyph grid, chasing and restoring several loose colored characters. The animation runs automatically and returns physically to its initial state for a seamless loop.

## Generate and export

The text is the only required creative input. Use the supplied text and choose a fresh output directory appropriate to the task; do not ask the user to design the animation mechanics. Default to transparent output and both dark and light exports. Respect explicit preferences for theme, width, or seed.

Run commands from this skill's directory. Use Node.js 22 or newer. If dependencies are missing, run `npm install` here, then `npx playwright install chromium`. GIF export requires `ffmpeg` on `PATH`.

```bash
node scripts/generate.mjs --text "Acme" --out /absolute/path/to/acme
node scripts/export.mjs --input /absolute/path/to/acme --out /absolute/path/to/acme/media
```

Generation accepts `--seed 71339`, `--theme dark|light`, and `--width 820`. Export accepts `--theme dark|light|both`, `--width 820`, and `--max-seconds 90`; its default theme is `both`.

Generation and export each require a new output folder; choose fresh paths for repeated runs. Generation writes `index.html`, local assets including fonts, and `wordmark.json`. Export writes `wordmark-dark.gif`, `wordmark-light.gif`, `wordmark-dark-static.png`, `wordmark-light-static.png`, and `export.json` when exporting both themes. Inspect the validation result before reporting export success.

Serve the web preview locally instead of opening it with `file://`:

```bash
python3 -m http.server --directory /absolute/path/to/acme 8000
```

Inspect the browser render and exported images. Confirm readable text, a clean loop, transparent edges, and appropriate contrast on both backgrounds. If an export cannot finish, deliver the working artifacts and state which output remains unavailable.

## Preserve the behavior

Keep the grid-stepped chase, readable silhouette, one `@` cursor, several loose colored glyphs, and complete physical return to the starting state. Do not add reset/play controls or use a final-frame reset to hide an unfinished chase. Use the bundled original implementation and fonts; do not substitute another product's logo or artwork.

The bundled fonts cover Latin alphabets, including Vietnamese, digits, and punctuation. The text limit is 40 characters; short names produce the clearest silhouette. Wrapping follows word boundaries, and explicit newlines are supported. Review long single words at the requested width. If text contains unsupported glyphs, report the affected text and obtain a suitable licensed font rather than silently rendering replacement boxes; do not promise arbitrary Unicode coverage.

- Read [references/animation.md](references/animation.md) when changing motion, glyph density, timing, or loop construction.
- Read [references/integration.md](references/integration.md) when embedding the output into a website, React component, or GitHub README. Preserve reduced-motion behavior and include a static fallback.

Deliver links to the preview and requested media, with a short usage note. Do not publish or deploy the output unless the user requests it.
