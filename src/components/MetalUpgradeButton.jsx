import { MetalFx } from 'metal-fx'
import { useReducedMotion } from '../lib/useReducedMotion'

export default function MetalUpgradeButton({ dark, onClick }) {
  const reducedMotion = useReducedMotion()

  return (
    <MetalFx
      className="upsell-metal"
      preset="gold"
      theme={dark ? 'dark' : 'light'}
      strength={0.62}
      paused={reducedMotion}
      disableGlow={reducedMotion}
    >
      <button onClick={onClick}>Upgrade →</button>
    </MetalFx>
  )
}
