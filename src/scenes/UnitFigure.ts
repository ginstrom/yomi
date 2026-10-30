import Phaser from 'phaser'
import {
  GRIP_POINT,
  SPRITE_ATLAS,
  SWUNG_GEAR,
  pointFromAnchor,
  spriteAnim,
  spriteFrame,
  UNIT_REST_FRAME,
  type UnitAnim,
} from './unitLook.ts'

/** How far a swing raises the weapon back, and how far past upright it cuts, in degrees. */
const SWING_RAISE = -55
const SWING_CUT = 85
/** How long the weapon takes to come back upright after the cut. */
const SWING_RECOVER_MS = 170
/** How strong a pulsed outline starts, and how far it reaches, in screen pixels. */
const OUTLINE_STRENGTH = 5
const OUTLINE_DISTANCE = 5

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
  /** The outline a hit pulses, made the first time one does. */
  private outline: Phaser.Filters.Glow | null = null

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

  /**
   * Swings the blade or axe in the weapon hand about the fist: raised back over
   * `raiseMs`, cut down past upright over `cutMs`, then brought back. A figure
   * holding nothing that swings (a bow, a wand, bare hands, a monster's own
   * claws) does nothing here; its lunge is the blow.
   */
  swing(raiseMs: number, cutMs: number): this {
    const weapon = this.gear.find((sprite) => SWUNG_GEAR.has(sprite.name))
    // The fist is the body's, a point of the frame it shows now (it sinks as the body breathes).
    const fist = pointFromAnchor(this.base.frame.customData, GRIP_POINT)
    if (!weapon || !fist) return this
    const turn = { angle: 0 }
    const side = this.flipped ? -1 : 1
    // The sprite turns about its origin, the feet; moving it keeps the grip where the fist is.
    const grip = { x: fist.x * this.spriteScale * side, y: fist.y * this.spriteScale }
    const apply = () => {
      const radians = Phaser.Math.DegToRad(turn.angle * side)
      const cos = Math.cos(radians)
      const sin = Math.sin(radians)
      weapon.setRotation(radians)
      weapon.setPosition(grip.x - (grip.x * cos - grip.y * sin), grip.y - (grip.x * sin + grip.y * cos))
    }
    this.scene.tweens.killTweensOf(turn)
    this.scene.tweens.chain({
      targets: turn,
      tweens: [
        { angle: SWING_RAISE, duration: raiseMs, ease: 'Quad.easeOut', onUpdate: apply },
        { angle: SWING_CUT, duration: cutMs, ease: 'Quad.easeIn', onUpdate: apply },
        { angle: 0, duration: SWING_RECOVER_MS, ease: 'Quad.easeOut', onUpdate: apply },
      ],
      onComplete: () => weapon.active && weapon.setRotation(0).setPosition(0, 0),
    })
    return this
  }

  /**
   * Rings the figure in `colour` for a moment, fading out over `durationMs`:
   * what a hit, a heal or a spell's help shows on the unit it lands on. Only
   * the WebGL renderer draws filters, so elsewhere it shows nothing.
   */
  pulseOutline(colour: number, durationMs: number): this {
    if (this.scene.renderer.type !== Phaser.WEBGL) return this
    if (!this.outline) {
      this.enableFilters()
      this.outline = this.filters!.internal.addGlow(colour, 0, 0, 1, false, 10, OUTLINE_DISTANCE)
      this.outline.setPaddingOverride(null)
    }
    const outline = this.outline
    outline.color = colour
    this.renderFilters = true
    this.scene.tweens.killTweensOf(outline)
    this.scene.tweens.add({
      targets: outline,
      outerStrength: { from: OUTLINE_STRENGTH, to: 0 },
      duration: durationMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.renderFilters = false
      },
    })
    return this
  }

  /**
   * Stops a pulsed outline at once. A faded figure (a fallen unit) is all edge
   * to the glow, which would fill it rather than ring it.
   */
  clearOutline(): this {
    if (this.outline) {
      this.scene.tweens.killTweensOf(this.outline)
      this.renderFilters = false
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
