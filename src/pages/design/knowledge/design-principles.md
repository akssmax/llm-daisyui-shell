# Design principles (AI agent context)

## Spacing

- Use an **8px grid**: x, y, width, height should be multiples of 8 unless impossible.
- **Safe margin** from page edges: at least **64px** for hero and editorial layouts.
- **Minimum gap** between unrelated blocks: **16px**; between sections: **48px+**.

## Hierarchy

- One **primary focal** per page (stat, headline, or hero visual)—never two competing hero-sized elements.
- At most **one** primary heading tier (H1-scale) per page; supporting titles one step smaller.
- **Max six** meaningful elements per page (excluding tiny decorative accents).

## Typography

- Body copy **≥16px**; headings **≥24px**; display sparingly (one per design).
- Prefer **≤2** font families: heading + body, aligned with `theme.fontFamily`.

## Color & contrast

- **Solid** `page.backgroundColor` only (no transparent frame fill).
- Aim for **WCAG AA** text contrast on the chosen background; avoid low-contrast gray-on-gray.
- **≤3** dominant colors per page: background, primary text, one accent.

## Density

- **Minimal**: generous whitespace, few elements, large type.
- **Normal**: balanced carousel/slide.
- **Dense**: dashboards only—still respect margins and overlap rules.

## Alignment

- Align blocks to a **shared vertical rhythm** (common left edge or centered column), not arbitrary x offsets.

## Accessibility

- Do not rely on color alone for meaning; keep text readable sizes and contrast.
