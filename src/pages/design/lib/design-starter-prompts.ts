/** Pool of one-tap design prompts; a random subset is shown in the empty chat state. */
export const DESIGN_STARTER_PROMPT_POOL: readonly string[] = [
  "Create a LinkedIn carousel about AI trends, 3 slides, dark theme",
  "Design an Instagram post for a product launch with bold typography",
  "Make a presentation slide with a hero section and bullet points",
  "Create a LinkedIn post with a gradient background and white text",
  "Design a 1080×1080 quote card for Twitter/X with a soft gradient and serif headline",
  "Build a 3-slide pitch deck cover + problem + solution, navy and gold",
  "Create a webinar promo graphic with date, time, and CTA button styling",
  "Design a hiring announcement post with team photo placeholder and perks list",
  "Make a minimalist SaaS landing hero for a notes app, light mode",
  "Create a dark-mode feature comparison slide (3 columns, checkmarks)",
  "Design a customer testimonial card with stars and pull quote",
  "Build a before/after layout for a skincare brand, soft pinks",
  "Create a conference session title slide with speaker name and track",
  "Design a podcast cover art style square with bold title and waveform accent",
  "Make a restaurant menu board style graphic for weekend specials",
  "Create a savings tips carousel for personal finance, 4 slides, green accents",
  "Design a product roadmap slide with quarters and milestones",
  "Build a thank-you card layout for email header use, warm neutrals",
  "Create a Black Friday sale banner with countdown and discount badge",
  "Design a mobile app onboarding screen with 3 illustrated steps",
  "Make a nonprofit impact infographic slide with one stat hero number",
  "Create a real estate listing hero with price pill and key specs",
  "Design a newsletter header graphic with logo area and headline",
  "Build a slide for OKRs with objective and 3 key results rows",
]

const DEFAULT_SHOW = 4

/** Fisher–Yates shuffle then take the first `count` entries (no duplicates). */
export function pickRandomStarterPrompts(count: number = DEFAULT_SHOW): string[] {
  const n = Math.min(Math.max(1, count), DESIGN_STARTER_PROMPT_POOL.length)
  const a = [...DESIGN_STARTER_PROMPT_POOL]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}
