import manualMarkdown from '../../docs/manual/README.md?raw'
import { renderManual } from './manualHtml.ts'

/**
 * The player's manual, shown over the game as a page of its own: plain HTML laid over the
 * canvas, so the game under it, paused behind the menu, is left exactly as it was. The menu
 * loads this module only when Manual is clicked, which keeps the manual out of the first load.
 */

/** The manual's screenshots, as the page serves them, by their path in the Markdown. */
const IMAGES = import.meta.glob<string>('../../docs/manual/images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

const imageUrl = (src: string): string => IMAGES[`../../docs/manual/${src}`] ?? src

const STYLE_ID = 'yomi-manual-style'
const STYLE = `
#yomi-manual {
  position: fixed; inset: 0; z-index: 10; overflow-y: auto;
  background: #14100c; color: #e6dccb;
  font: 16px/1.6 Georgia, 'Times New Roman', serif;
}
#yomi-manual:focus { outline: none; }
#yomi-manual .manual-bar {
  position: sticky; top: 0; padding: 10px 16px;
  background: #1f1912; border-bottom: 1px solid #4a3d2c;
  font-family: monospace;
}
#yomi-manual .manual-back { color: #90cdf4; font-size: 16px; text-decoration: none; }
#yomi-manual .manual-back:hover { text-decoration: underline; }
#yomi-manual .manual-page { max-width: 860px; margin: 0 auto; padding: 16px 16px 64px; }
#yomi-manual h1, #yomi-manual h2, #yomi-manual h3 { color: #e8c766; font-family: monospace; line-height: 1.3; }
#yomi-manual [id] { scroll-margin-top: 56px; }
#yomi-manual h2 { border-bottom: 1px solid #4a3d2c; padding-bottom: 4px; margin-top: 2em; }
#yomi-manual a { color: #90cdf4; }
#yomi-manual img { max-width: 100%; border: 1px solid #4a3d2c; }
#yomi-manual hr { border: none; border-top: 1px solid #4a3d2c; }
#yomi-manual table { border-collapse: collapse; margin: 1em 0; }
#yomi-manual th, #yomi-manual td { border: 1px solid #4a3d2c; padding: 4px 10px; text-align: left; vertical-align: top; }
#yomi-manual th { background: #1f1912; }
#yomi-manual code { font-size: 0.9em; }
`

let html: string | null = null

/**
 * Lays the manual over the game, at its top, and calls `onClose` once it is closed by its
 * Back to game link or Esc. While it is open it takes every key, so the game under it hears none.
 */
export function openManual(onClose: () => void): void {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLE
    document.head.append(style)
  }
  html ??= renderManual(manualMarkdown, imageUrl)

  const root = document.createElement('div')
  root.id = 'yomi-manual'
  root.tabIndex = -1
  root.innerHTML =
    '<div class="manual-bar"><a href="#" class="manual-back">&larr; Back to game</a></div>' +
    `<article class="manual-page">${html}</article>`

  const close = (): void => {
    document.removeEventListener('keydown', onKey, true)
    root.remove()
    onClose()
  }
  // Caught on its way down, so it never reaches the game's keyboard, which listens on the window.
  const onKey = (event: KeyboardEvent): void => {
    event.stopPropagation()
    if (event.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey, true)

  root.addEventListener('click', (event) => {
    const link = (event.target as Element).closest('a')
    if (!link) return
    const href = link.getAttribute('href') ?? ''
    if (link.classList.contains('manual-back')) {
      event.preventDefault()
      close()
    } else if (href.startsWith('#')) {
      // The contents' links scroll the manual, leaving the page's address alone.
      event.preventDefault()
      root.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)?.scrollIntoView()
    } else {
      link.target = '_blank'
      link.rel = 'noopener'
    }
  })

  document.body.append(root)
  root.focus()
}
