# Style Issues

Visual and UX polish problems observed during play.

---

## S1 · Stats bar icons are cryptic
**Severity:** High (first impression)

Points, bad attempts, good attempts, and cards left are represented by weather icon font glyphs (thermometer, storm cloud, sun, hamburger menu). These have no semantic connection to game concepts. A new player has no idea what each counter means without reading the chardin tooltip — which only appears once.

**Fix:** Use text labels or purpose-built icons (e.g. ✓, ✗, 🃏 or simple SVG icons).

---

## S2 · Tutorial overlay (chardinjs) shown on every load but only useful once
**Severity:** Medium

The chardinjs tutorial fires on first load and is then suppressed via `localStorage`. But on mobile, the tooltips overflow into the card area and obscure the board before the player can dismiss them. There is no visible "dismiss" button — only a click anywhere works.

**Fix:** Add a visible "Got it" or "×" dismiss button. Consider a modal-based tutorial instead.

---

## S3 · No visual feedback for wrong selection
**Severity:** Medium

When 3 cards are selected and the solution is wrong, the only feedback is a bad-attempts counter incrementing. There is no shake animation, red flash, or message. The cards just deselect quietly.

**Fix:** Add a brief shake animation or red highlight on the selected cards before they deselect.

---

## S4 · Selected card state too subtle
**Severity:** Medium

Selected cards scale down to 80% (`transform: scale(0.8)`). This is easy to miss, especially on small screens. The transition is smooth but doesn't feel "active" enough.

**Fix:** Add a border color change, a shadow, or a checkmark overlay on selected cards.

---

## S5 · "More cards" button uses a weather arrow icon
**Severity:** Low

The "more cards" button inside the 16th card slot uses a meteocons weather icon that looks like wind/arrows. It's unclear it means "deal more cards".

**Fix:** Use a `+3` label, a card icon, or plain text like "Deal more".

---

## S6 · Board background inconsistent across themes
**Severity:** Low

On desktop (default browser white background), cards appear white. The board and cards have no explicit background-color set — they inherit whatever the browser/OS default is. In dark-mode browsers or some mobile environments the cards may appear dark or transparent.

**Fix:** Set explicit `background-color: #fff` on `.card > .content` (or themed equivalent).

---

## S7 · Countdown timer appearance is jarring
**Severity:** Low

The countdown bar occupies the full width at the top with a dark semi-transparent background, abruptly appearing and disappearing. It overlaps the stats bar on some screen sizes.

**Fix:** Use a thinner progress bar or an inline countdown within the stats row.

---

## S8 · No favicon or page title differentiation
**Severity:** Low

The page title is just "Patterns" and there is no favicon. In a browser with multiple tabs the game is indistinguishable.

**Fix:** Add a favicon and optionally update the title with game state (e.g. "Patterns — 12 pts").
