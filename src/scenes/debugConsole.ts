import type Phaser from 'phaser'
import { completions, runCommand, type DebugContext, type DebugSource } from './debugCommands.ts'
import { SEED_KEY } from './seed.ts'

/**
 * The debug console, in dev builds: ~ (or `) drops a command line over the top of the game,
 * plain HTML as the manual is, and ~ or Esc lifts it. While it is open it takes every key, so
 * the game under it hears none. The commands are debugCommands.ts's; this finds the scene in
 * front that offers a `DebugSource` (`debugSource()`), runs the line typed and, when the
 * command changed the game, lets that scene redraw and save.
 */

const STYLE_ID = 'yomi-debug-style'
const STYLE = `
#yomi-debug {
  position: fixed; left: 0; right: 0; top: 0; z-index: 20; height: 45vh; min-height: 200px;
  display: flex; flex-direction: column; box-sizing: border-box;
  background: rgba(10, 12, 14, 0.94); border-bottom: 2px solid #4a6a4a;
  color: #cfe8cf; font: 13px/1.4 monospace;
}
#yomi-debug .debug-output { flex: 1; overflow-y: auto; margin: 0; padding: 8px 12px; white-space: pre-wrap; }
#yomi-debug .debug-output .debug-echo { color: #8fbf8f; }
#yomi-debug .debug-line { display: flex; align-items: center; padding: 4px 12px 8px; border-top: 1px solid #2a3a2a; }
#yomi-debug .debug-line span { color: #8fbf8f; margin-right: 6px; }
#yomi-debug input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #e6ffe6; font: inherit; caret-color: #e6ffe6;
}
`

/** The scenes that may offer a game to the console, the one in front first. */
const SOURCE_SCENES = ['Battle', 'World']

const isToggle = (event: KeyboardEvent): boolean => event.key === '~' || event.key === '`'

/** What the console sees of the running game: the scenes, the seed and the source of the scene in front. */
function contextOf(game: Phaser.Game): DebugContext {
  const scenes = game.scene
    .getScenes(false)
    .filter((scene) => scene.sys.isActive() || scene.sys.isPaused())
    .map((scene) => `${scene.sys.settings.key}${scene.sys.isPaused() ? ' (paused)' : ''}`)
  let source: DebugSource | null = null
  for (const key of SOURCE_SCENES) {
    const scene = game.scene.getScene(key) as (Phaser.Scene & { debugSource?: () => DebugSource }) | null
    if (!scene?.debugSource || !(scene.sys.isActive() || scene.sys.isPaused())) continue
    source = scene.debugSource()
    // Under an overlay a scene is only read: it would not show a change until it resumed.
    if (scene.sys.isPaused()) source = { ...source, changed: undefined }
    break
  }
  const seed = game.registry.get(SEED_KEY) as number | null | undefined
  return { scenes, seed: seed ?? null, source }
}

/** Installs the console's key, ~ (or `), which opens it over `game` and closes it again. */
export function installDebugConsole(game: Phaser.Game): void {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLE
    document.head.append(style)
  }

  const root = document.createElement('div')
  root.id = 'yomi-debug'
  root.innerHTML =
    '<pre class="debug-output"></pre><div class="debug-line"><span>&gt;</span><input type="text" spellcheck="false" autocomplete="off" /></div>'
  const output = root.querySelector<HTMLPreElement>('.debug-output')!
  const input = root.querySelector<HTMLInputElement>('input')!
  const history: string[] = []
  let recalled = 0

  const print = (lines: string[], className?: string): void => {
    for (const line of lines) {
      const div = document.createElement('div')
      div.textContent = line
      if (className) div.className = className
      output.append(div)
    }
    output.scrollTop = output.scrollHeight
  }
  print(['Yomi debug console. Type help for the commands.'])

  const open = (): void => {
    document.body.append(root)
    input.focus()
  }
  const close = (): void => {
    root.remove()
  }

  const submit = (): void => {
    const line = input.value
    input.value = ''
    if (line.trim() === '') return
    if (history.at(-1) !== line) history.push(line)
    recalled = history.length
    print([`> ${line}`], 'debug-echo')
    if (line.trim().toLowerCase() === 'clear') {
      output.replaceChildren()
      return
    }
    const context = contextOf(game)
    try {
      const { lines, changed } = runCommand(line, context)
      print(lines)
      if (changed) context.source?.changed?.()
    } catch (error) {
      print([`Error: ${error instanceof Error ? error.message : String(error)}`])
      console.error(error)
    }
  }

  // Caught on its way down, so that while the console is open the game's keyboard, which
  // listens on the window, hears nothing.
  document.addEventListener(
    'keydown',
    (event) => {
      const shown = root.isConnected
      if (isToggle(event)) {
        // Another overlay taking text (the manual) keeps the key.
        if (!shown && document.activeElement instanceof HTMLInputElement) return
        event.preventDefault()
        event.stopPropagation()
        if (shown) close()
        else open()
        return
      }
      if (!shown) return
      event.stopPropagation()
      switch (event.key) {
        case 'Escape':
          close()
          break
        case 'Enter':
          submit()
          break
        case 'ArrowUp':
        case 'ArrowDown':
          event.preventDefault()
          recalled = Math.max(0, Math.min(history.length, recalled + (event.key === 'ArrowUp' ? -1 : 1)))
          input.value = history[recalled] ?? ''
          break
        case 'Tab': {
          event.preventDefault()
          if (input.value.includes(' ')) break
          const matches = completions(input.value)
          if (matches.length === 1) input.value = `${matches[0]} `
          else if (matches.length > 1) print(matches)
          break
        }
      }
    },
    true,
  )
  // Phaser takes the keyboard's focus back when the canvas is clicked; a click on the console keeps it.
  root.addEventListener('mousedown', (event) => {
    event.stopPropagation()
    if (event.target !== input && window.getSelection()?.toString() === '') setTimeout(() => input.focus())
  })
}
