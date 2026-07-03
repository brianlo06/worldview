---
name: verify
description: How to run and drive the worldview frontend for end-to-end verification (dev server, prod-API proxy, Playwright, boot splash, /game flows)
---

# Verifying worldview changes end-to-end

## Launch

The frontend needs the worldview-api backend at `http://127.0.0.1:8088`
(default `API_BASE`). The backend rarely runs locally — proxy prod instead:

1. **API proxy**: run a small Node forwarder on 8088 → `https://api.jarvisworlds.com`
   that answers `OPTIONS` preflights and adds `Access-Control-Allow-Origin: *` +
   `Access-Control-Allow-Headers: Content-Type,X-Player-Token`. (Prod CORS does not
   allow localhost origins, so a plain `VITE_API_BASE=https://api.jarvisworlds.com`
   fails in the browser.)
2. **Dev server**: `npm run dev -- --port 5173 --strictPort` in `worldview/`.
   Use `http://127.0.0.1:5173` — plain `localhost` hits the cloudflare vite
   plugin oddly (302/404).

## Driving with Playwright

- Playwright is not a repo dep; `npm i playwright` in a scratch dir works
  (browsers cache in `~/Library/Caches/ms-playwright`; run
  `npx playwright install chromium-headless-shell` on version mismatch).
- **Boot splash**: a full-screen `div.z-[1000]` types a boot log, then any
  keypress dismisses it. Poke `Enter` every ~700ms until the locator count is 0.
- **/game**: fresh browser context = fresh anonymous player with 3 free scans
  on prod (harmless). Scan reveal: click `SCAN THE WORLD`, wait for the
  `NEXT|DONE` button.
- **Timing is 2-3x slower headless**: SwiftShader WebGL janks the main thread,
  so setTimeout-driven choreography stretches (a ~6s reveal takes ~15s) and CSS
  transitions lag behind state flips. Don't treat that as a bug; judge sequencing,
  not duration.
- **Screenshots lag ~1s** on the WebGL page. To capture fast animation stages,
  record video (`recordVideo` context option) and extract frames with the bundled
  ffmpeg: `~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac -i page.webm -r 2 f%03d.png`
  (its minimal build lacks the `fps=` filter — use `-r`).

## Gotchas

- The globe's ambient tour rotation (0.06 rad/s) drifts the camera whenever
  tour mode is on; GameView suspends it while mounted.
- `prefers-reduced-motion` paths: use the `reducedMotion: 'reduce'` context option.
