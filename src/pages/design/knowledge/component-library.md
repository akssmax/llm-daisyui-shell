# Component library (semantic → canvas hints)

## Stat block

- Large numeric text + unit + short label; align number baseline; optional delta chip in accent.

## Card

- `borderRadius` 12–24; padding implied by inner text box inset from card edges (≥24px).
- Optional soft fill at **0.06–0.12** opacity for depth on dark backgrounds.

## CTA pill

- High contrast fill or outline; short verb + arrow optional; keep height comfortable (touch-friendly proportions when scaled).

## Section label / eyebrow

- All caps or small caps style via size (12–14px) + letter spacing implied by tracking in copy; accent color.

## Quote

- Large quote marks optional (icon or text); attribution line smaller and secondary color.

## Icon spot

- Use `kind: "icon"` sparingly for decorative sparkle; pair with label for meaning.

## Image hero

- `objectFit: "cover"` for photographic heroes; reserve text safe area not covered by busy imagery.

## Divider

- Thin horizontal `line` shape or low-contrast rectangle; never compete with text hierarchy.
