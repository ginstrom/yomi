import { describe, expect, it } from 'vitest'
import { GuildHallScene } from './GuildHallScene.ts'

describe('GuildHallScene', () => {
  it('registers itself under the "GuildHall" scene key', () => {
    expect(new GuildHallScene().sys.settings.key).toBe('GuildHall')
  })
})
