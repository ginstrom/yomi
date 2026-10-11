/** Wheel travel, in pixels, that scrolls one row: a notch of a mouse wheel, or a short swipe on a trackpad. */
const WHEEL_PX_PER_ROW = 40

/**
 * Scroll state for a grid of item slots that shows a few rows of a longer
 * list, kept free of Phaser so it can be unit tested. `row` is the list row
 * drawn at the top of the grid.
 */
export class SlotScroll {
  private readonly cols: number
  private readonly rows: number
  private count = 0
  private top = 0
  private wheelTravel = 0

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
  }

  /** The list row at the top of the grid. */
  get row(): number {
    return this.top
  }

  /** Index in the list of the item in the grid's first slot. */
  get firstIndex(): number {
    return this.top * this.cols
  }

  get maxRow(): number {
    return Math.max(0, Math.ceil(this.count / this.cols) - this.rows)
  }

  /** Tells the grid how long the list now is, pulling the view back if the list shrank from under it. */
  setCount(count: number): void {
    this.count = count
    this.top = Math.min(this.top, this.maxRow)
  }

  /** Positive scrolls toward the end of the list. Returns whether the view moved. */
  scrollBy(rows: number): boolean {
    const before = this.top
    this.top = clamp(this.top + rows, 0, this.maxRow)
    return this.top !== before
  }

  scrollToEnd(): void {
    this.top = this.maxRow
  }

  /**
   * Feeds in a wheel event's `deltaY`, scrolling a row once enough has built
   * up: a trackpad sends many small deltas for one swipe. Returns whether the
   * view moved.
   */
  wheel(deltaY: number): boolean {
    // A change of direction starts afresh.
    if (Math.sign(deltaY) !== Math.sign(this.wheelTravel)) this.wheelTravel = 0
    this.wheelTravel += deltaY
    if (Math.abs(this.wheelTravel) < WHEEL_PX_PER_ROW) return false
    const direction = Math.sign(this.wheelTravel)
    this.wheelTravel = 0
    return this.scrollBy(direction)
  }

  /**
   * Scrollbar thumb geometry within a track of the given height, or null
   * when everything fits and no scrollbar is needed. `y` is from the track top.
   */
  thumb(trackHeight: number, minHeight: number): { y: number; height: number } | null {
    const maxRow = this.maxRow
    if (maxRow === 0) return null
    const height = Math.max(minHeight, trackHeight * (this.rows / (maxRow + this.rows)))
    const y = (trackHeight - height) * (this.top / maxRow)
    return { y, height }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
