import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { headingSlug, renderManual } from './manualHtml.ts'

describe('headingSlug', () => {
  it('makes the anchors GitHub does', () => {
    expect(headingSlug('1. Starting a game')).toBe('1-starting-a-game')
    expect(headingSlug('10. Winning, losing and saving')).toBe('10-winning-losing-and-saving')
  })
})

describe('renderManual', () => {
  it('gives headings ids, numbering repeats', () => {
    const { html } = renderManual('# Top\n\n## Notes\n\n## Notes\n', (src) => src)
    expect(html).toContain('<h1 id="top">Top</h1>')
    expect(html).toContain('<h2 id="notes">Notes</h2>')
    expect(html).toContain('<h2 id="notes-1">Notes</h2>')
  })

  it('passes image paths through the given mapping', () => {
    const { html } = renderManual('![The menu](images/menu.png)', (src) => `/served/${src}`)
    expect(html).toContain('src="/served/images/menu.png"')
  })

  it('lists the second-level headings as the contents', () => {
    const { contents } = renderManual('# Top\n\n## 1. One\n\n### Detail\n\n## 2. Two\n', (src) => src)
    expect(contents).toEqual([
      { id: '1-one', text: '1. One' },
      { id: '2-two', text: '2. Two' },
    ])
  })

  it('has a heading for every link of the real manual', () => {
    const markdown = readFileSync(new URL('../../docs/manual/README.md', import.meta.url), 'utf8')
    const { html } = renderManual(markdown, (src) => src)
    const anchors = [...markdown.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1])
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) expect(html).toContain(`id="${anchor}"`)
  })
})
