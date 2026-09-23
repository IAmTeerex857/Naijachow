import { useCallback, useEffect, useState } from 'react'

const KEY = 'np-theme'

/* Theme hook — sets data-theme on <html>, persists the choice, and honours the
   OS preference for a first-time visitor. The initial value is read from the
   attribute the inline script in index.html already set, so React never
   disagrees with what is on screen. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, dark: theme === 'dark', toggle }
}
