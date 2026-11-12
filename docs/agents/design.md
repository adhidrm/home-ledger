# Design Docs

How the engineering skills should consume this repo's visual design when building or changing UI.

## Before touching UI, read these

- **`design/Main.dc.html`** — reference layout for the main screens (dashboard, lists).
- **`design/Struk.dc.html`** — reference layout for receipt capture/review.
- **`design/canvas.json`** — design-canvas export; coordinate/token source behind the two HTML files.
- **`app/globals.css`** — the actual tokens (color, spacing, radius, type scale) shipped to the browser.

The HTML files are **references, not build inputs**. Nothing imports them. Match their intent; implement with the real component set.

## Ground rules

1. **Tokens live in `app/globals.css`.** No ad-hoc hex, no magic px in component files. If a value recurs and no token exists, add the token first.
2. **Primitives in `components/`** (`money-input`, `nav`, `sheet`). Screens in `app/**/*-screen.tsx` compose primitives; they don't re-implement them.
3. **Mobile-first.** This is a phone-first household app. Test at 390px before anything else; desktop is the adaptation.
4. **UI copy is Indonesian.** Matches `README.md`. Don't introduce English strings in user-facing text.
5. **Money is never a raw number on screen.** Use `lib/format.ts`; never hand-roll currency formatting in a component.

## When design and code disagree

The shipped code wins for behavior; `design/` wins for intent. If a reference screen shows a pattern the code dropped, that's a signal to reopen, not to silently follow either side. Surface it:

> _`design/Main.dc.html` shows a sticky summary bar that the shipped dashboard dropped — worth reopening because…_

## Gaps

If a needed screen has no reference in `design/`, don't invent a new visual language. Reuse the nearest existing pattern and note the gap for `/domain-modeling` or a design update.
