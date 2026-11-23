/**
 * The world map header's status lines (blight, stock, last yield), wrapped to
 * the room the header has: a line breaks only after a list's separator (", "
 * or "; "), so "iron 6" is never split, and a line that has no break in it is
 * left whole.
 */
export function wrapLine(line: string, width: number): string[] {
  const parts = line.split(/(?<=[,;]) /)
  const lines: string[] = []
  let current = ''
  for (const part of parts) {
    if (current === '') current = part
    else if (current.length + 1 + part.length <= width) current += ` ${part}`
    else {
      lines.push(current)
      current = part
    }
  }
  return [...lines, current]
}

/**
 * The status lines wrapped to `width` characters, in at most `maxLines` lines
 * where they can be: when they would take more, the list in line `cut` (the
 * stock, which the encampment's screens show in full) keeps as many of its
 * entries as fit and ends "+N more". The other lines are never shortened.
 */
export function headerLines(lines: readonly string[], width: number, maxLines = Infinity, cut = 1): string[] {
  const wrapped = lines.map((line) => wrapLine(line, width))
  const total = wrapped.reduce((sum, w) => sum + w.length, 0)
  if (total <= maxLines || cut >= lines.length) return wrapped.flat()
  const room = Math.max(1, maxLines - (total - wrapped[cut].length))
  const entries = lines[cut].split(/(?<=,) /)
  const kept = (count: number) => wrapLine(`${entries.slice(0, count).join(' ').replace(/,$/, '')}, +${entries.length - count} more`, width)
  let count = entries.length - 1
  while (count > 1 && kept(count).length > room) count--
  return wrapped.map((w, i) => (i === cut ? kept(count) : w)).flat()
}
