# Bugs

Issues that cause incorrect or broken behavior.

---

## B1 · SVG fill references non-existent pattern — ✅ Fixed (PR #32)
Removed stray `}` and `fill="url(#diagonal-stripes)"` from `buildSymbol`. CSS classes handle fill.

## B2 · Score doesn't update on quick 3-card click — ✅ Fixed (PR #32)
Added `pendingSelection` buffer; selection is sent immediately when turn is granted.

## B3 · Bottom row clipped on mobile — ✅ Fixed (PR #32)
Added `max-height: calc(100dvh - 10vh)` and `overflow-y: auto` to `#board`.

## B4 · `$(window).unload` is deprecated — ✅ Fixed (PR #32)
Replaced with `$(window).on('beforeunload', ...)`.

## B5 · Socket.io client/server version mismatch — ✅ Fixed (PR #32)
Client now loads socket.io from the server at `/socket.io/socket.io.js`.

## B6 · Orphaned sessions accumulate in memory — ✅ Fixed (PR #32)
Added 2-hour session TTL with 15-minute cleanup interval.
