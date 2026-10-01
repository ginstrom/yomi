/**
 * Scroll state for the battle log, kept free of Phaser so it can be unit
 * tested. `offset` counts lines scrolled up from the newest one; at 0 the log
 * follows new lines, otherwise the view stays put as lines arrive.
 */
export class ScrollingLog {
  private readonly history: number
  private readonly visible: number
  private lines: string[] = []
  private offset = 0

  constructor(history: number, visible: number) {
    this.history = history
    this.visible = visible
  }

  get length(): number {
    return this.lines.length
  }

  get maxScroll(): number {
    return Math.max(0, this.lines.length - this.visible)
  }

  /** Lines scrolled up from the bottom (0 = following the newest line). */
  get scrollOffset(): number {
    return this.offset
  }

  push(line: string): void {
    this.lines.push(line)
    if (this.lines.length > this.history) this.lines.shift()
    // Keep a scrolled-back view on the same lines instead of drifting.
    if (this.offset > 0) this.offset = Math.min(this.offset + 1, this.maxScroll)
  }

  /** Positive scrolls toward older lines. */
  scrollBy(lines: number): void {
    this.offset = clamp(this.offset + lines, 0, this.maxScroll)
  }

  /** 0 = newest lines at the bottom, 1 = oldest lines at the top. */
  scrollToRatio(ratio: number): void {
    this.offset = Math.round(clamp(ratio, 0, 1) * this.maxScroll)
  }

  visibleLines(): string[] {
    const start = Math.max(0, this.lines.length - this.visible - this.offset)
    return this.lines.slice(start, start + this.visible)
  }

  /**
   * Scrollbar thumb geometry within a track of the given height, or null
   * when everything fits and no scrollbar is needed. `y` is from the track top.
   */
  thumb(trackHeight: number, minHeight: number): { y: number; height: number } | null {
    const maxScroll = this.maxScroll
    if (maxScroll === 0) return null
    const height = Math.max(minHeight, trackHeight * (this.visible / this.lines.length))
    const y = (trackHeight - height) * (1 - this.offset / maxScroll)
    return { y, height }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
