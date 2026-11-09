import { describe, expect, it } from 'vitest'
import { ExchangeScene } from './ExchangeScene.ts'

describe('ExchangeScene', () => {
  it('registers itself under the "Exchange" scene key', () => {
    expect(new ExchangeScene().sys.settings.key).toBe('Exchange')
  })
})
