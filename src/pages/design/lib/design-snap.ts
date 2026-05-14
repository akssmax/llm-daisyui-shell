/** Snap a coordinate to an 8px grid when enabled (design grid / AI layout rules). */
export function snapToDesignGrid(value: number, enabled: boolean, grid = 8): number {
  if (!enabled) return value
  return Math.round(value / grid) * grid
}
