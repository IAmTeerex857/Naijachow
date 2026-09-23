export function haptic(kind = 'selection') {
  if (!('vibrate' in navigator)) return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  const patterns = {
    selection: 12,
    success: [18, 35, 24],
    warning: [30, 45, 30],
  }
  return navigator.vibrate(patterns[kind] || patterns.selection)
}
