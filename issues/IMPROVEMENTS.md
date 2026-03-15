# Potential Improvements

Ideas for making the game better. Not bugs — just things that would improve the experience.

---

## I1 · Explain the turn system
**Priority:** High

The game is multiplayer but operates on a "buzz in" model: clicking a card silently requests a turn lock; if someone else already has the lock your click is ignored. This is never explained. Solo players are also confused because they have to "compete" against themselves.

**Suggestion:** Add a brief text explanation ("Click a card to claim your turn") or make the first click visibly trigger a "Your turn!" indicator.

---

## I2 · Solo mode without turn locking
**Priority:** High

When playing alone, the turn-locking system (3-second countdown, solution_block) adds friction for no benefit. A single-player session could skip the lock entirely and just accept solutions directly.

---

## I3 · Hint system
**Priority:** Medium

When no valid set exists on the board, the player is stuck indefinitely. At minimum, the game should deal more cards automatically (or offer a button) when no set exists. Optionally, a "hint" could highlight one card in a valid set.

---

## I4 · "No set exists" detection and auto-deal
**Priority:** Medium

The real Set card game deals 3 more cards when no set is possible on the board. This implementation doesn't check for that — the player can manually request more cards, but only when the board has ≤9 cards (`drawCards` logic). If all 12 cards have no valid set, the player is stuck.

---

## I5 · Scoring balance
**Priority:** Medium

Current scoring: +1 for correct, -3 for wrong (including timeout). The penalty is very harsh and makes the game feel punishing rather than fun, especially for beginners.

**Suggestion:** Make the penalty configurable, or use +3/-1, or only deduct for wrong answers (not timeouts).

---

## I6 · Multiplayer awareness
**Priority:** Medium

When another player finds a set, their cards disappear from the board but there's no notification of who found it or their score. In multiplayer, a small "Alice found a set! (+1)" toast would improve the experience significantly.

---

## I7 · Shareable game URL
**Priority:** Medium

The session ID is already in the URL hash (`#sid_...`). But there's no "Share this game" button or copy-to-clipboard action. Players have to manually share the URL.

---

## I8 · Mobile layout: 2-column grid option
**Priority:** Low

On narrow screens, 4 columns of cards make each card very small. A 2 or 3-column layout with scrolling might be more usable on phones.

---

## I9 · Keyboard accessibility
**Priority:** Low

No keyboard navigation is possible — cards can only be selected by mouse/touch.

---

## I10 · Game end condition is unclear
**Priority:** Low

The "I'm done" button only appears when `cardsLeft === 0`. But a player might want to end early. Also, the game-over splash screen with `spruch` ("Nah, not your best game. Maybe you're drunk?") may not land well for all audiences.

---

## I11 · Dependency updates
**Priority:** Low

All dependencies are pinned to 2015-era versions (`express ^4.13.3`, `socket.io ^1.3.6`, `connect ^3.4.0`). The client-side jQuery is 1.7.2. Security and compatibility updates are overdue.
