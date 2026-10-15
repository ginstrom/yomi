import { Marked, type Tokens } from 'marked'

/**
 * A heading's anchor as GitHub makes it, which is what the manual's contents link to:
 * lower case, punctuation dropped, spaces to hyphens ("1. Starting a game" → "1-starting-a-game").
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/**
 * The player's manual (`docs/manual/README.md`) as HTML for the game's page: headings
 * carry the anchors its links name, and each image's path is passed through `imageUrl`,
 * since the page serves the images from elsewhere than beside the Markdown.
 */
export function renderManual(markdown: string, imageUrl: (src: string) => string): string {
  const used = new Map<string, number>()
  const marked = new Marked({
    walkTokens(token) {
      if (token.type === 'image') (token as Tokens.Image).href = imageUrl((token as Tokens.Image).href)
    },
    renderer: {
      heading({ tokens, depth, text }) {
        const base = headingSlug(text)
        const seen = used.get(base) ?? 0
        used.set(base, seen + 1)
        const id = seen === 0 ? base : `${base}-${seen}`
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
      },
    },
  })
  return marked.parse(markdown, { async: false })
}
