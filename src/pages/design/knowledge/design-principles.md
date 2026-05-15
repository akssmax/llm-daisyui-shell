# Design principles (AI agent context)

## Spacing

- Use an **8px grid**: x, y, width, height should be multiples of 8 unless impossible.
- **Safe margin** from page edges: at least **64px** for hero and editorial layouts.
- **Minimum gap** between unrelated blocks: **16px**; between sections: **48px+**.
- **CTAs** require at least **48px** whitespace from the bottom edge and from unrelated blocks.

## Hierarchy

- One **primary focal** per page (stat, headline, or hero visual)—never two competing hero-sized elements.
- Headlines should occupy roughly **30–60%** of visual weight on the page.
- At most **one** primary heading tier (H1-scale) per page; supporting titles one step smaller.
- **Max six** meaningful elements per page (excluding tiny decorative accents).
- **Avoid equal-sized elements** competing for attention.

## Typography

- Body copy **≥16px**; headings **≥24px**; display sparingly (one per design).
- Prefer **≤2** font families: heading + body, aligned with `theme.fontFamily`.
- **Never center-align long body copy** (>80 characters)—use left alignment for readability.
- If headline exceeds ~40 characters, reduce line count and prefer shorter phrasing.

## Visual weight

- Assign visual weight so the user's stated focal point dominates (typically headline or stat).
- CTA visual weight ~10–20%; supporting body ~15%; icon accents ~5% or less.
- Do not let body text exceed headline scale.

## Color & contrast

- **Solid** `page.backgroundColor` only (no transparent frame fill).
- Aim for **WCAG AA** text contrast on the chosen background; avoid low-contrast gray-on-gray.
- **≤3** dominant colors per page: background, primary text, one accent.
- Use accent color **sparingly** (CTA, key stat, or single icon).

## Density

- **Minimal**: generous whitespace, few elements, large type.
- **Normal**: balanced carousel/slide.
- **Dense**: dashboards only—still respect margins and overlap rules.

## Alignment

- Align blocks to a **shared vertical rhythm** (common left edge or centered column), not arbitrary x offsets.

## Platform notes

### LinkedIn carousel (1080×1350)

- One idea per slide; hook on slide 1, proof in the middle, CTA on the last slide.
- Large headline, compact body; stats as numerals with short labels.

### Presentation slide (1920×1080)

- Title + subtitle hierarchy; generous margins; avoid more than 5 bullets.

### Social post (1080×1080)

- Bold headline or single stat; minimal copy; strong contrast.

## Negative constraints

- Do not invent pixel coordinates—the engine places regions.
- Do not exceed per-region `maxChars` when provided.
- Do not use more than 2 font families or 3 font weights.
- Do not place tiny CTAs or oversized decorative icons.
- Do not rely on color alone for meaning.

## Accessibility

- Do not rely on color alone for meaning; keep text readable sizes and contrast.
