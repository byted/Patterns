# AGENTS.md

## Cursor Cloud specific instructions

### What this is
"Patterns" is a single-process, browser-based multiplayer card game (a "Set"-style game). There is no database or auxiliary service — all game state lives in memory.

- Server entry: `server/app.js` (`connect` + `serve-static` HTTP server that also serves the static `client/` and runs a `socket.io` WebSocket backend). Listens on `process.env.PORT || 3000`.
- Client: static `client/index.html` + `client/js/app.js` (vanilla JS + jQuery/chardin.js from CDN; the socket.io client is served locally at `/socket.io/socket.io.js`).

### Running
- Start the server with `npm start` (runs `node server/app.js`), then open `http://localhost:3000`. There is no separate dev/watch script — `start` is used for both dev and prod, and there is no hot reload, so restart the process after editing `server/app.js`.

### Testing / linting
- There is no automated test suite. `npm test` is only a placeholder that exits 1.
- There is no working lint script: the repo ships a legacy `.eslintrc` and lists only `eslint-plugin-react` as a devDependency (ESLint itself is not installed and the config predates flat config). Use `node --check <file>` for a quick syntax check instead.

### How to verify gameplay end-to-end
- Opening `http://localhost:3000` auto-creates a session and deals 12 cards; a "How to play" popup shows on first load (dismiss with "Got it").
- `client/js/app.js` exposes a console helper: run `debugPatterns.checkSets()` in the browser console to list valid sets (card IDs). Click a card to claim the turn, then select 2 more; a valid triplet scores +1 (`pts`). Multiplayer = open multiple tabs to the shared `#sid_...` URL.
