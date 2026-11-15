/**
 * Phaser's keyboard plugin processes the whole of its manager's queue each
 * time a key event arrives, and empties it only at the end of the game's
 * step, so two keys pressed within one frame (fast typing, or a slow frame
 * after a redraw) hand the first keydown to a scene's `keydown` listeners a
 * second time: "Borin" typed quickly became "BBoBoBoriiin". A listener
 * wrapped in `onceEachEvent` hears each event object once.
 */
export function onceEachEvent<E extends object>(handler: (event: E) => void): (event: E) => void {
  const seen = new WeakSet<E>()
  return (event) => {
    if (seen.has(event)) return
    seen.add(event)
    handler(event)
  }
}
