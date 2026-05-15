#!/usr/bin/env node
/**
 * Generates layout JSON catalog (35 patterns) + token presets + style presets.
 * Run: node scripts/generate-layout-catalog.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const layoutsDir = join(root, "data", "layouts")
const tokensDir = join(root, "data", "design-tokens")
const stylesDir = join(root, "data", "style-presets")

mkdirSync(layoutsDir, { recursive: true })
mkdirSync(tokensDir, { recursive: true })
mkdirSync(stylesDir, { recursive: true })

/** Snap to 12-column grid (0–1). */
function col(c, span) {
  const x = c / 12
  const w = span / 12
  return { x: Math.round(x * 1000) / 1000, w: Math.round(w * 1000) / 1000 }
}

function row(y, h) {
  return { y: Math.round(y * 1000) / 1000, h: Math.round(h * 1000) / 1000 }
}

function region(id, role, c, span, y, h, alignment = "left", importance = "secondary", iconHint) {
  const { x, w } = col(c, span)
  const { y: ry, h: rh } = row(y, h)
  const r = { id, role, relativeRect: { x, y: ry, w, h: rh }, alignment, importance }
  if (role === "icon" && iconHint) r.iconHint = iconHint
  return r
}

/** Optional Lucide icon slot (top-right corner, 1 col). */
function iconRegion(id, iconHint, y = 0.083) {
  return region(id, "icon", 11, 1, y, 0.083, "center", "tertiary", iconHint)
}

const ASPECT_1080 = [{ w: 1080, h: 1080 }]
const ASPECT_LINKEDIN = [{ w: 1080, h: 1350 }]
const ASPECT_SLIDE = [{ w: 1920, h: 1080 }]
const ASPECT_POST = [{ w: 1080, h: 1080 }, { w: 1080, h: 1350 }]

const layouts = [
  // linkedin-carousel (4)
  {
    id: "li-carousel-hero-centered",
    category: "linkedin-carousel",
    archetype: "hero-centered",
    styleTags: ["linkedin", "carousel", "startup", "modern"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 1, 10, 0.08, 0.2, "center", "primary"),
      region("stat", "stats", 2, 8, 0.35, 0.22, "center", "primary"),
      region("body", "body", 2, 8, 0.62, 0.12, "center", "secondary"),
      region("cta", "cta", 4, 4, 0.82, 0.08, "center", "secondary"),
    ],
    supportedAspects: ASPECT_LINKEDIN,
  },
  {
    id: "li-carousel-split",
    category: "linkedin-carousel",
    archetype: "split",
    styleTags: ["linkedin", "carousel", "saas", "professional"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 5, 0.1, 0.25, "left", "primary"),
      region("body", "body", 0, 5, 0.4, 0.35, "left", "secondary"),
      region("visual", "image", 6, 6, 0.1, 0.75, "center", "secondary"),
      region("footer", "footer", 0, 12, 0.9, 0.06, "left", "tertiary"),
    ],
    supportedAspects: ASPECT_LINKEDIN,
  },
  {
    id: "li-carousel-metrics",
    category: "linkedin-carousel",
    archetype: "metrics-grid",
    styleTags: ["linkedin", "metrics", "kpi", "data"],
    density: "medium",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 1, 10, 0.06, 0.14, "center", "primary"),
      region("kpi1", "stats", 0, 4, 0.28, 0.2, "center", "primary"),
      region("kpi2", "stats", 4, 4, 0.28, 0.2, "center", "primary"),
      region("kpi3", "stats", 8, 4, 0.28, 0.2, "center", "primary"),
      region("body", "body", 1, 10, 0.55, 0.2, "center", "secondary"),
    ],
    supportedAspects: ASPECT_LINKEDIN,
  },
  {
    id: "li-carousel-quote",
    category: "linkedin-carousel",
    archetype: "quote-emphasis",
    styleTags: ["linkedin", "quote", "thought-leadership"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("quote", "quote", 1, 10, 0.2, 0.4, "center", "primary"),
      region("attribution", "subheading", 2, 8, 0.65, 0.1, "center", "secondary"),
      region("footer", "footer", 1, 10, 0.85, 0.06, "center", "tertiary"),
    ],
    supportedAspects: ASPECT_LINKEDIN,
  },
  // presentation-slide (4)
  {
    id: "pres-title-hero",
    category: "presentation-slide",
    archetype: "hero-centered",
    styleTags: ["presentation", "pitch", "title"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 2, 8, 0.25, 0.2, "center", "primary"),
      region("subheading", "subheading", 3, 6, 0.48, 0.12, "center", "secondary"),
      region("footer", "footer", 1, 10, 0.88, 0.06, "center", "tertiary"),
    ],
    supportedAspects: ASPECT_SLIDE,
  },
  {
    id: "pres-split-feature",
    category: "presentation-slide",
    archetype: "split",
    styleTags: ["presentation", "feature", "enterprise"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 6, 0.08, 0.18, "left", "primary"),
      region("body", "body", 0, 5, 0.3, 0.4, "left", "secondary"),
      region("visual", "image", 6, 6, 0.08, 0.7, "center", "secondary"),
    ],
    supportedAspects: ASPECT_SLIDE,
  },
  {
    id: "pres-metrics-grid",
    category: "presentation-slide",
    archetype: "metrics-grid",
    styleTags: ["presentation", "metrics", "dashboard"],
    density: "high",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 12, 0.05, 0.12, "left", "primary"),
      region("kpi1", "stats", 0, 3, 0.22, 0.25, "left", "primary"),
      region("kpi2", "stats", 3, 3, 0.22, 0.25, "left", "primary"),
      region("kpi3", "stats", 6, 3, 0.22, 0.25, "left", "primary"),
      region("kpi4", "stats", 9, 3, 0.22, 0.25, "left", "primary"),
      region("body", "body", 0, 8, 0.55, 0.2, "left", "secondary"),
    ],
    supportedAspects: ASPECT_SLIDE,
  },
  {
    id: "pres-timeline",
    category: "presentation-slide",
    archetype: "timeline",
    styleTags: ["presentation", "roadmap", "timeline"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.05, 0.12, "left", "primary"),
      region("step1", "body", 0, 4, 0.25, 0.2, "left", "secondary"),
      region("step2", "body", 4, 4, 0.25, 0.2, "left", "secondary"),
      region("step3", "body", 8, 4, 0.25, 0.2, "left", "secondary"),
      region("body", "body", 0, 10, 0.55, 0.25, "left", "tertiary"),
    ],
    supportedAspects: ASPECT_SLIDE,
  },
  // social-post (4)
  {
    id: "social-hero-bold",
    category: "social-post",
    archetype: "bold-typography-poster",
    styleTags: ["social", "instagram", "bold", "viral"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 12, 0.15, 0.35, "center", "primary"),
      region("subheading", "subheading", 1, 10, 0.55, 0.12, "center", "secondary"),
      region("cta", "cta", 3, 6, 0.78, 0.1, "center", "secondary"),
    ],
    supportedAspects: ASPECT_POST,
  },
  {
    id: "social-bento",
    category: "social-post",
    archetype: "bento-grid",
    styleTags: ["social", "bento", "modern", "startup"],
    density: "high",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 7, 0.05, 0.2, "left", "primary"),
      region("card1", "body", 0, 4, 0.3, 0.28, "left", "secondary"),
      region("card2", "body", 4, 4, 0.3, 0.28, "left", "secondary"),
      region("card3", "stats", 8, 4, 0.3, 0.28, "center", "primary"),
      region("cta", "cta", 0, 12, 0.65, 0.12, "left", "secondary"),
    ],
    supportedAspects: ASPECT_POST,
  },
  {
    id: "social-minimal-swiss",
    category: "social-post",
    archetype: "minimal-swiss",
    styleTags: ["social", "swiss", "minimal", "editorial"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 8, 0.12, 0.3, "left", "primary"),
      region("body", "body", 0, 6, 0.5, 0.25, "left", "secondary"),
      region("accent", "shape", 9, 3, 0.12, 0.15, "right", "tertiary"),
    ],
    supportedAspects: ASPECT_POST,
  },
  {
    id: "social-full-bleed",
    category: "social-post",
    archetype: "full-bleed-image",
    styleTags: ["social", "photo", "lifestyle"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("image", "image", 0, 12, 0, 0.65, "center", "primary"),
      region("headline", "headline", 1, 10, 0.68, 0.15, "left", "primary"),
      region("cta", "cta", 1, 6, 0.86, 0.08, "left", "secondary"),
    ],
    supportedAspects: ASPECT_POST,
  },
  // quote-card (3)
  {
    id: "quote-centered",
    category: "quote-card",
    archetype: "quote-emphasis",
    styleTags: ["quote", "inspirational", "minimal"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("quote", "quote", 1, 10, 0.22, 0.45, "center", "primary"),
      region("attribution", "subheading", 2, 8, 0.72, 0.1, "center", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "quote-editorial",
    category: "quote-card",
    archetype: "editorial-asymmetric",
    styleTags: ["quote", "editorial", "magazine"],
    density: "low",
    hierarchy: "balanced",
    regions: [
      region("quote", "quote", 0, 8, 0.15, 0.5, "left", "primary"),
      region("attribution", "subheading", 0, 6, 0.7, 0.12, "left", "secondary"),
      region("accent", "image", 8, 4, 0.1, 0.8, "center", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "quote-layered",
    category: "quote-card",
    archetype: "layered-card",
    styleTags: ["quote", "card", "layered"],
    density: "medium",
    hierarchy: "strong",
    regions: [
      region("quote", "quote", 1, 10, 0.2, 0.42, "center", "primary"),
      region("attribution", "subheading", 2, 8, 0.68, 0.12, "center", "secondary"),
      region("footer", "footer", 2, 8, 0.86, 0.06, "center", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  // metrics-slide (4)
  {
    id: "metrics-hero-stat",
    category: "metrics-slide",
    archetype: "hero-centered",
    styleTags: ["metrics", "kpi", "hero-stat"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("stat", "stats", 2, 8, 0.28, 0.28, "center", "primary"),
      region("headline", "headline", 1, 10, 0.08, 0.14, "center", "secondary"),
      region("body", "body", 2, 8, 0.62, 0.15, "center", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "metrics-four-grid",
    category: "metrics-slide",
    archetype: "metrics-grid",
    styleTags: ["metrics", "grid", "dashboard"],
    density: "high",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 12, 0.04, 0.1, "left", "primary"),
      region("kpi1", "stats", 0, 6, 0.18, 0.32, "left", "primary"),
      region("kpi2", "stats", 6, 6, 0.18, 0.32, "left", "primary"),
      region("kpi3", "stats", 0, 6, 0.55, 0.32, "left", "primary"),
      region("kpi4", "stats", 6, 6, 0.55, 0.32, "left", "primary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "metrics-split",
    category: "metrics-slide",
    archetype: "split",
    styleTags: ["metrics", "comparison", "saas"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.06, 0.12, "left", "primary"),
      region("left", "stats", 0, 5, 0.22, 0.55, "left", "primary"),
      region("right", "stats", 7, 5, 0.22, 0.55, "left", "primary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "metrics-checklist",
    category: "metrics-slide",
    archetype: "checklist",
    styleTags: ["metrics", "checklist", "results"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.06, 0.12, "left", "primary"),
      region("item1", "body", 0, 10, 0.22, 0.1, "left", "secondary"),
      region("item2", "body", 0, 10, 0.35, 0.1, "left", "secondary"),
      region("item3", "body", 0, 10, 0.48, 0.1, "left", "secondary"),
      region("stat", "stats", 0, 4, 0.65, 0.2, "left", "primary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  // timeline-slide (3)
  {
    id: "timeline-vertical",
    category: "timeline-slide",
    archetype: "timeline",
    styleTags: ["timeline", "roadmap", "process"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.05, 0.1, "left", "primary"),
      region("step1", "body", 1, 10, 0.18, 0.15, "left", "secondary"),
      region("step2", "body", 1, 10, 0.36, 0.15, "left", "secondary"),
      region("step3", "body", 1, 10, 0.54, 0.15, "left", "secondary"),
      region("step4", "body", 1, 10, 0.72, 0.12, "left", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "timeline-alternating",
    category: "timeline-slide",
    archetype: "alternating-sections",
    styleTags: ["timeline", "alternating", "story"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.05, 0.1, "center", "primary"),
      region("left1", "body", 0, 5, 0.2, 0.2, "left", "secondary"),
      region("right1", "body", 7, 5, 0.2, 0.2, "left", "secondary"),
      region("left2", "body", 0, 5, 0.45, 0.2, "left", "secondary"),
      region("right2", "body", 7, 5, 0.45, 0.2, "left", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "timeline-horizontal",
    category: "timeline-slide",
    archetype: "timeline",
    styleTags: ["timeline", "horizontal", "milestones"],
    density: "high",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 12, 0.04, 0.1, "left", "primary"),
      region("m1", "body", 0, 3, 0.2, 0.25, "center", "secondary"),
      region("m2", "body", 3, 3, 0.2, 0.25, "center", "secondary"),
      region("m3", "body", 6, 3, 0.2, 0.25, "center", "secondary"),
      region("m4", "body", 9, 3, 0.2, 0.25, "center", "secondary"),
      region("body", "body", 0, 10, 0.55, 0.2, "left", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  // feature-slide (4)
  {
    id: "feature-split",
    category: "feature-slide",
    archetype: "split",
    styleTags: ["feature", "product", "saas"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 6, 0.1, 0.2, "left", "primary"),
      region("body", "body", 0, 5, 0.35, 0.35, "left", "secondary"),
      region("cta", "cta", 0, 4, 0.75, 0.1, "left", "secondary"),
      region("visual", "image", 6, 6, 0.1, 0.75, "center", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "feature-bento",
    category: "feature-slide",
    archetype: "bento-grid",
    styleTags: ["feature", "bento", "capabilities"],
    density: "high",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.05, 0.1, "left", "primary"),
      region("f1", "body", 0, 6, 0.2, 0.32, "left", "secondary"),
      region("f2", "body", 6, 6, 0.2, 0.32, "left", "secondary"),
      region("f3", "body", 0, 4, 0.58, 0.28, "left", "secondary"),
      region("f4", "body", 4, 4, 0.58, 0.28, "left", "secondary"),
      region("f5", "body", 8, 4, 0.58, 0.28, "left", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "feature-checklist",
    category: "feature-slide",
    archetype: "checklist",
    styleTags: ["feature", "benefits", "list"],
    density: "medium",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 12, 0.08, 0.14, "left", "primary"),
      region("b1", "body", 0, 10, 0.28, 0.1, "left", "secondary"),
      region("b2", "body", 0, 10, 0.4, 0.1, "left", "secondary"),
      region("b3", "body", 0, 10, 0.52, 0.1, "left", "secondary"),
      region("visual", "image", 0, 6, 0.65, 0.25, "left", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "feature-two-col",
    category: "feature-slide",
    archetype: "two-column-editorial",
    styleTags: ["feature", "editorial", "comparison"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.06, 0.12, "left", "primary"),
      region("col1", "body", 0, 5, 0.22, 0.6, "left", "secondary"),
      region("col2", "body", 7, 5, 0.22, 0.6, "left", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  // product-showcase (4)
  {
    id: "product-spotlight",
    category: "product-showcase",
    archetype: "product-spotlight",
    styleTags: ["product", "showcase", "ecommerce"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("product", "image", 2, 8, 0.1, 0.45, "center", "primary"),
      region("headline", "headline", 1, 10, 0.58, 0.12, "center", "primary"),
      region("body", "body", 2, 8, 0.72, 0.1, "center", "secondary"),
      region("cta", "cta", 4, 4, 0.86, 0.08, "center", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "product-split",
    category: "product-showcase",
    archetype: "split",
    styleTags: ["product", "launch", "hardware"],
    density: "medium",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 6, 0.12, 0.18, "left", "primary"),
      region("body", "body", 0, 5, 0.35, 0.3, "left", "secondary"),
      region("cta", "cta", 0, 4, 0.7, 0.1, "left", "secondary"),
      region("product", "image", 6, 6, 0.08, 0.82, "center", "primary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "product-layered",
    category: "product-showcase",
    archetype: "layered-card",
    styleTags: ["product", "card", "premium"],
    density: "medium",
    hierarchy: "strong",
    regions: [
      region("card", "image", 1, 10, 0.12, 0.55, "center", "primary"),
      region("headline", "headline", 2, 8, 0.7, 0.12, "center", "primary"),
      region("cta", "cta", 4, 4, 0.86, 0.08, "center", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "product-grid",
    category: "product-showcase",
    archetype: "bento-grid",
    styleTags: ["product", "catalog", "grid"],
    density: "high",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.05, 0.1, "left", "primary"),
      region("p1", "image", 0, 6, 0.18, 0.35, "center", "primary"),
      region("p2", "image", 6, 6, 0.18, 0.35, "center", "primary"),
      region("body", "body", 0, 10, 0.58, 0.15, "left", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  // editorial-poster (5)
  {
    id: "editorial-asymmetric",
    category: "editorial-poster",
    archetype: "editorial-asymmetric",
    styleTags: ["editorial", "poster", "magazine"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 7, 0.08, 0.35, "left", "primary"),
      region("body", "body", 0, 5, 0.5, 0.3, "left", "secondary"),
      region("visual", "image", 7, 5, 0.08, 0.85, "center", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "editorial-bold-poster",
    category: "editorial-poster",
    archetype: "bold-typography-poster",
    styleTags: ["editorial", "bold", "typography"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("headline", "headline", 0, 12, 0.1, 0.45, "left", "primary"),
      region("subheading", "subheading", 0, 8, 0.6, 0.12, "left", "secondary"),
      region("footer", "footer", 0, 12, 0.88, 0.06, "left", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "editorial-swiss",
    category: "editorial-poster",
    archetype: "minimal-swiss",
    styleTags: ["editorial", "swiss", "grid"],
    density: "low",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 6, 0.15, 0.25, "left", "primary"),
      region("body", "body", 0, 5, 0.45, 0.35, "left", "secondary"),
      region("meta", "footer", 8, 4, 0.15, 0.2, "right", "tertiary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "editorial-full-bleed",
    category: "editorial-poster",
    archetype: "full-bleed-image",
    styleTags: ["editorial", "photo", "poster"],
    density: "low",
    hierarchy: "strong",
    regions: [
      region("image", "image", 0, 12, 0, 0.7, "center", "primary"),
      region("headline", "headline", 1, 10, 0.72, 0.15, "left", "primary"),
      region("body", "body", 1, 8, 0.88, 0.08, "left", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
  {
    id: "editorial-two-col",
    category: "editorial-poster",
    archetype: "two-column-editorial",
    styleTags: ["editorial", "article", "columns"],
    density: "medium",
    hierarchy: "balanced",
    regions: [
      region("headline", "headline", 0, 12, 0.06, 0.15, "left", "primary"),
      region("col1", "body", 0, 5, 0.25, 0.6, "left", "secondary"),
      region("col2", "body", 7, 5, 0.25, 0.6, "left", "secondary"),
    ],
    supportedAspects: ASPECT_1080,
  },
]

const tokenPresets = [
  {
    id: "modern-saas",
    name: "Modern SaaS",
    styleTags: ["saas", "startup", "modern", "clean"],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    typography: { hero: 72, h1: 56, h2: 40, h3: 32, body: 20, caption: 16 },
    colors: {
      background: "#FFFFFF",
      surface: "#F1F5F9",
      textPrimary: "#0F172A",
      textSecondary: "#64748B",
      accent: "#6366F1",
      accentMuted: "#A5B4FC",
    },
    radius: [0, 4, 8, 12, 16],
    shadows: { sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 4px 12px rgba(0,0,0,0.08)", lg: "0 12px 32px rgba(0,0,0,0.12)" },
    rules: { lineHeight: { hero: 1.1, h1: 1.15, body: 1.5, caption: 1.4 }, maxLineWidth: 720, contrastMin: 4.5 },
    headingFont: "Inter",
    bodyFont: "Inter",
  },
  {
    id: "swiss-editorial",
    name: "Swiss Editorial",
    styleTags: ["swiss", "editorial", "minimal", "grid"],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    typography: { hero: 80, h1: 56, h2: 36, h3: 28, body: 18, caption: 14 },
    colors: {
      background: "#FAFAFA",
      surface: "#E5E5E5",
      textPrimary: "#171717",
      textSecondary: "#525252",
      accent: "#DC2626",
    },
    radius: [0, 0, 2, 4],
    shadows: { sm: "none", md: "none", lg: "0 2px 8px rgba(0,0,0,0.06)" },
    rules: { lineHeight: { hero: 1.05, body: 1.55, caption: 1.4 }, maxLineWidth: 640, contrastMin: 7 },
    headingFont: "Helvetica Neue",
    bodyFont: "Helvetica Neue",
  },
  {
    id: "brutalist",
    name: "Brutalist",
    styleTags: ["brutalist", "bold", "raw"],
    spacing: [8, 16, 24, 32, 48, 64, 96],
    typography: { hero: 88, h1: 64, h2: 44, h3: 32, body: 22, caption: 16 },
    colors: {
      background: "#FFFF00",
      surface: "#000000",
      textPrimary: "#000000",
      textSecondary: "#1A1A1A",
      accent: "#FF00FF",
    },
    radius: [0, 0, 0],
    shadows: { sm: "4px 4px 0 #000", md: "8px 8px 0 #000", lg: "12px 12px 0 #000" },
    rules: { lineHeight: { hero: 1, body: 1.4 }, maxLineWidth: 800, contrastMin: 4.5 },
    headingFont: "Arial Black",
    bodyFont: "Arial",
  },
  {
    id: "luxury-minimal",
    name: "Luxury Minimal",
    styleTags: ["luxury", "minimal", "premium"],
    spacing: [8, 16, 24, 40, 56, 72, 96],
    typography: { hero: 72, h1: 48, h2: 36, h3: 28, body: 18, caption: 14 },
    colors: {
      background: "#FDFBF7",
      surface: "#EDE8E0",
      textPrimary: "#1C1917",
      textSecondary: "#78716C",
      accent: "#B45309",
    },
    radius: [0, 2, 4, 8],
    shadows: { sm: "0 1px 3px rgba(28,25,23,0.06)", md: "0 4px 16px rgba(28,25,23,0.08)", lg: "0 8px 24px rgba(28,25,23,0.1)" },
    rules: { lineHeight: { hero: 1.15, body: 1.6 }, maxLineWidth: 560, contrastMin: 4.5 },
    headingFont: "Georgia",
    bodyFont: "Georgia",
  },
  {
    id: "startup-gradient",
    name: "Startup Gradient",
    styleTags: ["startup", "gradient", "playful"],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64],
    typography: { hero: 64, h1: 48, h2: 36, h3: 28, body: 20, caption: 16 },
    colors: {
      background: "#0F172A",
      surface: "#1E293B",
      textPrimary: "#F8FAFC",
      textSecondary: "#94A3B8",
      accent: "#22D3EE",
    },
    radius: [8, 12, 16, 24],
    shadows: { sm: "0 2px 8px rgba(34,211,238,0.15)", md: "0 8px 24px rgba(34,211,238,0.2)", lg: "0 16px 48px rgba(0,0,0,0.3)" },
    rules: { lineHeight: { hero: 1.1, body: 1.5 }, maxLineWidth: 680, contrastMin: 4.5 },
    headingFont: "Inter",
    bodyFont: "Inter",
  },
  {
    id: "enterprise-clean",
    name: "Enterprise Clean",
    styleTags: ["enterprise", "corporate", "clean"],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    typography: { hero: 56, h1: 44, h2: 32, h3: 24, body: 18, caption: 14 },
    colors: {
      background: "#FFFFFF",
      surface: "#EFF6FF",
      textPrimary: "#1E3A5F",
      textSecondary: "#64748B",
      accent: "#2563EB",
    },
    radius: [4, 6, 8],
    shadows: { sm: "0 1px 2px rgba(30,58,95,0.06)", md: "0 4px 12px rgba(30,58,95,0.08)", lg: "0 8px 24px rgba(30,58,95,0.1)" },
    rules: { lineHeight: { hero: 1.2, body: 1.55 }, maxLineWidth: 720, contrastMin: 4.5 },
    headingFont: "Inter",
    bodyFont: "Inter",
  },
  {
    id: "playful-social",
    name: "Playful Social",
    styleTags: ["social", "playful", "colorful"],
    spacing: [4, 8, 12, 16, 24, 32, 48],
    typography: { hero: 72, h1: 52, h2: 36, h3: 28, body: 22, caption: 16 },
    colors: {
      background: "#FEF3C7",
      surface: "#FDE68A",
      textPrimary: "#78350F",
      textSecondary: "#92400E",
      accent: "#EC4899",
    },
    radius: [12, 16, 24, 32],
    shadows: { sm: "0 2px 4px rgba(120,53,15,0.1)", md: "0 6px 16px rgba(120,53,15,0.12)", lg: "0 12px 32px rgba(120,53,15,0.15)" },
    rules: { lineHeight: { hero: 1.1, body: 1.45 }, maxLineWidth: 600, contrastMin: 4.5 },
    headingFont: "Comic Sans MS",
    bodyFont: "Arial",
  },
  {
    id: "linear-inspired",
    name: "Linear-inspired",
    styleTags: ["linear", "dark", "product", "minimal"],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64],
    typography: { hero: 64, h1: 48, h2: 32, h3: 24, body: 16, caption: 13 },
    colors: {
      background: "#09090B",
      surface: "#18181B",
      textPrimary: "#FAFAFA",
      textSecondary: "#A1A1AA",
      accent: "#8B5CF6",
    },
    radius: [6, 8, 12],
    shadows: { sm: "0 0 0 1px rgba(255,255,255,0.06)", md: "0 8px 24px rgba(0,0,0,0.4)", lg: "0 16px 48px rgba(0,0,0,0.5)" },
    rules: { lineHeight: { hero: 1.1, body: 1.5 }, maxLineWidth: 640, contrastMin: 4.5 },
    headingFont: "Inter",
    bodyFont: "Inter",
  },
]

const stylePresets = [
  { id: "modern-saas-style", name: "Modern SaaS", styleTags: ["saas", "startup"], tokenPresetId: "modern-saas", preferredArchetypes: ["hero-centered", "split", "metrics-grid"], layoutDensity: "medium", hierarchy: "strong" },
  { id: "swiss-style", name: "Swiss Editorial", styleTags: ["swiss", "editorial"], tokenPresetId: "swiss-editorial", preferredArchetypes: ["minimal-swiss", "editorial-asymmetric", "two-column-editorial"], layoutDensity: "low", hierarchy: "balanced" },
  { id: "brutalist-style", name: "Brutalist", styleTags: ["brutalist"], tokenPresetId: "brutalist", preferredArchetypes: ["bold-typography-poster", "hero-centered"], layoutDensity: "low", hierarchy: "strong" },
  { id: "luxury-style", name: "Luxury Minimal", styleTags: ["luxury"], tokenPresetId: "luxury-minimal", preferredArchetypes: ["minimal-swiss", "product-spotlight"], layoutDensity: "low", hierarchy: "strong" },
  { id: "startup-style", name: "Startup Gradient", styleTags: ["startup", "gradient"], tokenPresetId: "startup-gradient", preferredArchetypes: ["hero-centered", "bento-grid"], layoutDensity: "medium", hierarchy: "strong" },
  { id: "enterprise-style", name: "Enterprise Clean", styleTags: ["enterprise"], tokenPresetId: "enterprise-clean", preferredArchetypes: ["split", "metrics-grid", "checklist"], layoutDensity: "medium", hierarchy: "balanced" },
  { id: "social-style", name: "Playful Social", styleTags: ["social", "playful"], tokenPresetId: "playful-social", preferredArchetypes: ["bold-typography-poster", "bento-grid"], layoutDensity: "medium", hierarchy: "strong" },
  { id: "linear-style", name: "Linear-inspired", styleTags: ["linear", "product"], tokenPresetId: "linear-inspired", preferredArchetypes: ["split", "feature", "minimal-swiss"], layoutDensity: "low", hierarchy: "strong" },
]

for (const layout of layouts) {
  const full = {
    ...layout,
    grid: { columns: 12, safeMargin: 64 },
    reference: { source: "manual", archetype: layout.archetype, tags: layout.styleTags },
  }
  writeFileSync(join(layoutsDir, `${layout.id}.json`), JSON.stringify(full, null, 2))
}

for (const t of tokenPresets) {
  writeFileSync(join(tokensDir, `${t.id}.json`), JSON.stringify(t, null, 2))
}

writeFileSync(join(stylesDir, "index.json"), JSON.stringify(stylePresets, null, 2))

console.log(`Generated ${layouts.length} layouts, ${tokenPresets.length} token presets, ${stylePresets.length} style presets`)
