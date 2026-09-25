import { Liquid } from 'liquid-gooey'

export default function HeroLiquid() {
  return (
    <div className="hero-liquid" aria-hidden="true">
      <Liquid fill="var(--orange)" blur={12} contrast={20}>
        <Liquid.Item effect="move" move={{ stretch: 0.2, trail: 0.18 }}>
          <span className="hero-liquid-drop hero-liquid-drop-a" />
        </Liquid.Item>
        <Liquid.Item effect="move" move={{ stretch: 0.16, trail: 0.14 }}>
          <span className="hero-liquid-drop hero-liquid-drop-b" />
        </Liquid.Item>
      </Liquid>
    </div>
  )
}
