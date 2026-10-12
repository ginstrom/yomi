import Phaser from 'phaser'
import { SPRITE_ATLAS, spriteAnim, spriteFrame, UNIT_REST_FRAME, type UnitAnim } from './unitLook.ts'

/**
 * A unit as it is drawn: its body's sprite and, over it, a sprite for each
 * thing it holds (`gearLayers` in unitLook.ts says which), all from the atlas
 * and animated as one. Its position is where the unit's feet are. It has no
 * logic of its own: the scene says what it holds and what it does.
 */
export class UnitFigure extends Phaser.GameObjects.Container {
  private readonly base: Phaser.GameObjects.Sprite
  private gear: Phaser.GameObjects.Sprite[] = []
  private readonly kind: string
  private readonly spriteScale: number
  private flipped = false
  private playing: UnitAnim | null = null

  /** `spriteScale` is how much the sprites are enlarged: a unit's canvas class is drawn for 3. */
  constructor(scene: Phaser.Scene, kind: string, spriteScale: number) {
    super(scene, 0, 0)
    this.kind = kind
    this.spriteScale = spriteScale
    this.base = this.layer(kind)
    this.add(this.base)
    scene.add.existing(this)
  }

  /** How tall the figure stands on screen, its whole canvas counted. */
  get standingHeight(): number {
    return this.base.displayHeight
  }

  /** Lays these sprites over the body, the first lowest, in place of what was there. */
  setGear(sprites: readonly string[]): this {
    for (const sprite of this.gear) sprite.destroy()
    this.gear = sprites.map((sprite) => this.layer(sprite))
    this.add(this.gear)
    for (const sprite of this.gear) sprite.setFlipX(this.flipped).setAlpha(this.base.alpha)
    // From the top, so that the layers breathe together.
    if (this.playing) this.play(this.playing)
    return this
  }

  /** Sprites are drawn facing right. */
  faceLeft(left: boolean): this {
    this.flipped = left
    for (const sprite of this.layers()) sprite.setFlipX(left)
    return this
  }

  /**
   * Plays an animation on every layer that has it, after `delayMs`; a layer
   * without it rests, as gear does through a walk, which moves only the legs.
   */
  play(anim: UnitAnim, delayMs = 0): this {
    this.playing = anim
    for (const sprite of this.layers()) {
      const key = spriteAnim(this.spriteOf(sprite), anim)
      if (this.scene.anims.exists(key)) sprite.play({ key, delay: delayMs })
      else this.rest(sprite)
    }
    return this
  }

  /** Stands still, on the frame every sprite rests on. */
  stop(): this {
    this.playing = null
    for (const sprite of this.layers()) this.rest(sprite)
    return this
  }

  setFigureAlpha(alpha: number): this {
    for (const sprite of this.layers()) sprite.setAlpha(alpha)
    return this
  }

  setFigureTint(tint: number | null): this {
    for (const sprite of this.layers()) {
      if (tint === null) sprite.clearTint()
      else sprite.setTint(tint)
    }
    return this
  }

  private layers(): Phaser.GameObjects.Sprite[] {
    return [this.base, ...this.gear]
  }

  private layer(sprite: string): Phaser.GameObjects.Sprite {
    // The atlas carries each canvas class's anchor as the frame's pivot: a unit's is its feet.
    return this.scene.make
      .sprite({ key: SPRITE_ATLAS, frame: spriteFrame(sprite, UNIT_REST_FRAME) }, false)
      .setName(sprite)
      .setScale(this.spriteScale)
  }

  private spriteOf(layer: Phaser.GameObjects.Sprite): string {
    return layer === this.base ? this.kind : layer.name
  }

  private rest(sprite: Phaser.GameObjects.Sprite): void {
    sprite.anims.stop()
    sprite.setFrame(spriteFrame(this.spriteOf(sprite), UNIT_REST_FRAME))
  }
}
