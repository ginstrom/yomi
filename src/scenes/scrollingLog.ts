/**
 * Scroll state for the battle log, kept free of Phaser so it can be unit
 * tested. Each line is wrapped into rows to fit the log box; `offset` counts
 * rows scrolled up from the newest one. At 0 the log follows new lines,
 * otherwise the view stays put as lines arrive.
 */
export class ScrollingLog {
  private readonly history: number
  private readonly visible: number
  private lines: string[] = []
  /** Each line's rows under the current wrap. */
  private wrapped: string[][] = []
  private wrap: (line: string) => string[] = (line) => [line]
  private offset = 0

  constructor(history: number, visible: number) {
    this.history = history
    this.visible = visible
  }

  /** Rows in the history, after wrapping. */
  get length(): number {
    return this.rows().length
  }

  get maxScroll(): number {
    return Math.max(0, this.length - this.visible)
  }

  /** Rows scrolled up from the bottom (0 = following the newest row). */
  get scrollOffset(): number {
    return this.offset
  }

  /** Rewraps every line, for when the log box changes width. */
  setWrap(wrap: (line: string) => string[]): void {
    this.wrap = wrap
    this.wrapped = this.lines.map(wrap)
    this.offset = Math.min(this.offset, this.maxScroll)
  }

  push(line: string): void {
    const rows = this.wrap(line)
    this.lines.push(line)
    this.wrapped.push(rows)
    if (this.lines.length > this.history) {
      this.lines.shift()
      this.wrapped.shift()
    }
    // Keep a scrolled-back view on the same rows instead of drifting.
    if (this.offset > 0) this.offset = Math.min(this.offset + rows.length, this.maxScroll)
  }

  /** Positive scrolls toward older rows. */
  scrollBy(rows: number): void {
    this.offset = clamp(this.offset + rows, 0, this.maxScroll)
  }

  /** 0 = newest rows at the bottom, 1 = oldest rows at the top. */
  scrollToRatio(ratio: number): void {
    this.offset = Math.round(clamp(ratio, 0, 1) * this.maxScroll)
  }

  visibleLines(): string[] {
    const rows = this.rows()
    const start = Math.max(0, rows.length - this.visible - this.offset)
    return rows.slice(start, start + this.visible)
  }

  /**
   * Scrollbar thumb geometry within a track of the given height, or null
   * when everything fits and no scrollbar is needed. `y` is from the track top.
   */
  thumb(trackHeight: number, minHeight: number): { y: number; height: number } | null {
    const maxScroll = this.maxScroll
    if (maxScroll === 0) return null
    const height = Math.max(minHeight, trackHeight * (this.visible / this.length))
    const y = (trackHeight - height) * (1 - this.offset / maxScroll)
    return { y, height }
  }

  private rows(): string[] {
    return this.wrapped.flat()
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
