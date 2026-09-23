import { useEffect, useRef } from 'react'

const SCRIPT_ID = 'cloudflare-turnstile-script'

export default function TurnstileWidget({ onToken, resetKey }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const container = useRef(null)

  useEffect(() => {
    if (!siteKey || !container.current) return
    let widgetId
    let active = true
    const render = () => {
      if (!active || !window.turnstile || !container.current || widgetId) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
        theme: 'auto',
      })
    }
    let script = document.getElementById(SCRIPT_ID)
    if (!script) {
      script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
    script.addEventListener('load', render)
    render()
    return () => {
      active = false
      script.removeEventListener('load', render)
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey, onToken, resetKey])

  if (!siteKey) return null
  return <div className="turnstile-widget" ref={container} />
}
