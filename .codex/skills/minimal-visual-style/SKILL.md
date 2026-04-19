---
name: minimal-visual-style
description: Preserve and extend the current minimal visual style in this repo. Use when editing the home page, search UI, or related frontend surfaces and the goal is to keep the interface minimal, search-first, editorial, and token-driven instead of introducing a new visual direction.
---

# Supervisor Search Visual Style

Use this skill when frontend work should feel like a continuation of the current app, not a redesign.

## Source Of Truth

Inspect these files before making visual changes:

- `src/tailwind-input.css`
- `src/views/home.ts`
- `src/views/home-script.ts`
- `specs/supervisor-search/spec.md`

If a screenshot disagrees with the code, the code wins. Treat `docs/screenshots/home.png` as documentation, not the style authority.

## Visual Direction

- Keep the page minimal and search-first.
- Favor an editorial feel over a product-marketing feel.
- Use one clear accent color and let typography carry most of the visual weight.
- Keep surfaces quiet: soft rings, light tinting, and very limited shadow or ornament.
- Preserve the sense of open space around a single primary interaction.

## Style Contract

### Typography

- Keep the sans stack from `src/tailwind-input.css` unless the user explicitly asks for a new direction.
- Use tight tracking on large headings and slightly expanded tracking on small uppercase labels.
- Let headings be bold and compact; supporting text should stay calm and readable.

### Color

- Continue using the `app-*` theme tokens from `src/tailwind-input.css`.
- Keep the palette restrained: canvas, text, soft text, accent, line, and accent ghost are the main working colors.
- Support both light and dark mode through token changes rather than separate component designs.

### Layout

- Keep content in a narrow centered column instead of filling the full viewport width.
- Preserve generous outer spacing and a compact vertical rhythm inside interactive elements.
- The search control is the visual anchor. Keep it prominent, sticky when needed, and above the results flow.

### Components

- Inputs should feel soft and precise: rounded corners, subtle tinted background, thin ring, stronger focus ring.
- Results should read like clean editorial rows, not dense cards or dashboards.
- Status text stays quiet and inline rather than becoming a banner or callout.

## Anti-Patterns

- Do not add gradient-heavy hero treatments, glossy cards, or marketing-style sections.
- Do not introduce multiple accent colors or decorative illustration unless the user explicitly wants a new identity.
- Do not replace the single-column search-first composition with a busy app shell.
- Do not use stale screenshots to justify visual regressions.
