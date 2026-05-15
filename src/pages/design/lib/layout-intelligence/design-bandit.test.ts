import { describe, expect, it, beforeEach } from "vitest"
import {
  buildBanditContextKey,
  getBanditReward,
  initBanditCache,
  recordBanditReward,
} from "./design-bandit"
import { buildContentProfile } from "./content-profile"

describe("design-bandit", () => {
  beforeEach(async () => {
    await initBanditCache()
  })

  it("records and returns bandit reward for layout arm", async () => {
    const profile = buildContentProfile(
      [[{ regionId: "headline", content: "Test headline" }]],
      1,
    )
    const ctx = buildBanditContextKey("linkedin-carousel", profile, "modern")
    await recordBanditReward(ctx, "li-carousel-split", 1)
    const reward = getBanditReward(ctx, "li-carousel-split")
    expect(reward).toBeGreaterThan(0)
  })
})
