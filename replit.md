# eon-skribbl

A real-time multiplayer draw-and-guess game, clone of skribbl.io with a full game state machine, Socket.io sync, flood-fill canvas, scoring, and word hints. Deployed at https://eon-skribbl.up.railway.app/

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — build + run the game server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Server: Express 5 + Socket.io (HTTP server with WS support)
- Game state: in-memory Map (rooms)
- Frontend: Vanilla HTML5 / CSS / JS (no framework)
- Canvas: HTML5 2D Context with flood-fill, undo stack, 25ms packet throttle
- DB: PostgreSQL + Drizzle ORM (available but not used by game itself)

## Where things live

- `artifacts/api-server/src/game/engine.ts` — Socket.io game engine + full state machine
- `artifacts/api-server/src/game/types.ts` — TypeScript room/player types
- `artifacts/api-server/src/game/words.ts` — 200+ word list + room code generator
- `artifacts/api-server/public/index.html` — Landing page (username, avatar, create/join room)
- `artifacts/api-server/public/game.html` — Three-column game dashboard
- `artifacts/api-server/public/css/style.css` — Complete styles (dark theme, responsive)
- `artifacts/api-server/public/js/socket.js` — Client socket event pipeline
- `artifacts/api-server/public/js/canvas.js` — Canvas engine (draw, fill, undo, sync)
- `artifacts/api-server/public/js/ui.js` — DOM engine (overlays, scoreboard, chat, timer)

## Architecture decisions

- Socket.io attached to Node.js `http.createServer` (not Express directly) — required for WS support
- Rooms stored in a `Map<string, Room>` — no DB, pure in-memory state with cleanup on empty room
- Canvas sync uses 25ms throttled packet batching to reduce socket traffic
- Flood fill runs locally on all clients from a broadcast seed coordinate — avoids transmitting full ImageData
- Undo snapshots are dataURL strings broadcast to all clients; limited to 15 history entries per turn
- Levenshtein distance (threshold 1-2) intercepts close guesses as private hints without broadcasting

## Product

- Landing page: username, avatar color picker, create room with settings (players/rounds/time), join with code
- Game states: LOBBY → WORD_SELECTION → DRAWING → TURN_OVER → ROUND_OVER → GAME_OVER
- Drawer: picks from 3 words, draws on 800×600 canvas, has full tool belt (pencil, eraser, fill, undo, clear, 24 colors, size slider)
- Guessers: see masked word (`_ _ _`), get two hints (75%/50% timer), type guesses in chat
- Scoring: time-based points (up to 500) + 100 first-guesser bonus; drawer earns 50× correct guessers
- Host migration: if host disconnects, next player becomes host automatically

## User preferences

- The user provided zip archives of original skribbl.io assets (zip2/zip3 contain the correct 480×480 avatar atlases with transparent backgrounds).
- Audio .ogg files (roundStart, roundEndSuccess, roundEndFailure, join, leave, playerGuessed, tick) are simply missing from all provided archives — the game is functional without them.

## Bug fixes applied

- **Avatar atlas** — Replaced zipA's opaque-black-background 509×509 atlases with zip2's transparent 480×480 atlases (color_atlas, eyes_atlas, mouth_atlas). The special_atlas was unchanged.
- **Avatar background-position** — `game.js`'s `ue()` function uses `background-position: -c*100%` which the CSS spec formula places outside the viewport for non-zero sprite indices. Fixed via `public/js/avatarfix.js` (MutationObserver that converts percentages to pixel offsets on all `.avatar` children).
- **Nunito OTS errors** — `fonts.css` now loads Nunito from Google Fonts CDN WOFF2 instead of broken local `.ttf` files.
- **Corrupted image assets** — Replaced all broken/corrupted GIF files (arrow.gif had an impossible 64845×64814 frame; logo, tutorial steps, settings icons, atlases also wrong) with correct versions from user-provided zip. Both `public/img/` and `dist/public/img/` must be updated when replacing images.
- **Invite link hardcoded to skribbl.io** — `game.js` built the invite URL as `"https://skribbl.io/?"+roomId`. Changed to `window.location.origin+"/?"+roomId` so it always points to the current host. Fix applied to both `public/js/game.js` and `dist/public/js/game.js`.
- **Start game blocked with < 2 players** — `engine.ts` refused to start unless 2+ players were present, sending a WARNING that the client displayed only briefly. Removed the minimum player check so the host can start a private room solo (useful for testing). After any change to `engine.ts`, run `pnpm --filter @workspace/api-server run build` to recompile, then restart the workflow.
- **Round announcement shows wrong round number** — `buildState` for `ST.ROUND_START` was sending `room.currentRound` (1-indexed), but the client renders `data + 1`, so Round 1 displayed as "Round 2". Fixed by sending `room.currentRound - 1` so the client adds 1 and shows the correct number. Also fixed: the client resets visual scores on `data === 0` (first round), which now correctly triggers.
- **Word selection clicks ignored** — Client sends the chosen word as a plain number index (0/1/2) via `ha(this.index)`, but the server's case 18 handler only checked for `string` or `Array` types, leaving the number path unhandled. Added `typeof data === 'number'` branch: `room.wordOptions[data]`.
- **Scoring: wrong values at turn end and drawer gets no credit** — `buildScoresFlat` was emitting `[id, earnedThisTurn, rank]` per player. The client reads `scores[i+1]` to update the sidebar running total and uses a comma-expression `(scores[i+1], scores[i+2])` so the earned overlay actually reads `scores[i+2]`. With the old format that meant sidebar got `earnedThisTurn` (wiping cumulative totals) and the overlay showed `rank` ("+1" for second place). Fixed format to `[id, p.score, p.earnedThisTurn]`: sidebar now shows correct cumulative total, overlay shows the correct earned-this-turn delta. Drawer points (`50 × guessedCount`, max 200) were already calculated before `endTurn`; this fix makes them appear correctly in both views.

## Gotchas

- Always run `pnpm run build` before `start` — the dev script does this automatically
- `express.static` serves from `dist/public/` in both dev and prod (build copies it)
- Socket.io path `/socket.io` must not be overridden by Express middleware

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
