/**
 * Scale for a frame of frameW x frameH drawn in a free area of freeW x freeH, keeping `margin` clear in total
 * on each axis: fractional below 1 (down to 0), 1 from there to under 2, and whole steps from 2 (the pixel art stays crisp).
 * Never above the fit.
 */
export function overlayScale(freeW: number, freeH: number, frameW: number, frameH: number, margin = 32): number {
  const fit = Math.max(0, Math.min((freeW - margin) / frameW, (freeH - margin) / frameH))
  return fit >= 2 ? Math.floor(fit) : Math.min(1, fit)
}
