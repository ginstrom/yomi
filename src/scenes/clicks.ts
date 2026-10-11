/** The part of a Phaser pointer that tells which kind of click it made. */
interface ClickPointer {
  rightButtonDown(): boolean
  event: { ctrlKey?: boolean }
}

/** A right-click, or the Ctrl+click that stands in for one on a Mac trackpad. */
export function isSecondaryClick(pointer: ClickPointer): boolean {
  return pointer.rightButtonDown() || pointer.event.ctrlKey === true
}
