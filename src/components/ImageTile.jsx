import { useEffect, useState } from 'react'

/* Category gradient tile + emoji that upgrades to a real photo when one loads.
   The emoji tile is BOTH the placeholder and the genuine no-image fallback.
   `loader` is a function returning a Promise<{ url, credit }>. */
export default function ImageTile({ cat, emoji, alt, loader, className = '', emojiSize }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let alive = true
    setSrc(null)
    loader()
      .then((res) => {
        if (alive && res && res.url) setSrc(res.url)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alt])

  return (
    <div className={`tile ${cat} ${className}`}>
      <span className="emoji" style={emojiSize ? { fontSize: emojiSize } : undefined}>
        {emoji}
      </span>
      {src && <img src={src} alt={alt} loading="lazy" onError={() => setSrc(null)} />}
    </div>
  )
}
