# Skribbl Clone

A real-time multiplayer draw-and-guess game, faithfully recreating Skribbl.io with a full game state machine, Socket.io sync, flood-fill canvas, scoring, and word hints.

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

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run build` before `start` — the dev script does this automatically
- `express.static` serves from `dist/public/` in both dev and prod (build copies it)
- Socket.io path `/socket.io` must not be overridden by Express middleware

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
