import { useEffect, useRef, useState } from 'react'
import '../styles/meal-media.css'

/* The diagonal-stripe slot from the design, which a real photo covers once it
   loads. The stripe is both the placeholder and the genuine no-image fallback,
   so a missing photo is never a broken image — it stays the designed state.

   `loader` is a function returning Promise<{ url }>. `name` identifies the
   subject: when it changes (a swap), the photo is re-fetched. */
export default function ImageTile({ name, loader, className = '', placeholder = 'file', children }) {
  const tileRef = useRef(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [src, setSrc] = useState(null)
  const [credit, setCredit] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  useEffect(() => {
    const tile = tileRef.current
    if (!tile || typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '320px 0px' }
    )
    observer.observe(tile)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!shouldLoad) return undefined
    let alive = true
    setSrc(null)
    setCredit('')
    setSourceUrl('')
    loader()
      .then((res) => {
        if (alive && res && res.url) {
          setSrc(res.url)
          setCredit(res.credit || '')
          setSourceUrl(res.sourceUrl || '')
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // The loader closes over `name`; re-running on the name covers every case
    // where the subject actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, shouldLoad])

  const file = `${(name || 'dish').toLowerCase().replace(/[^a-z0-9]+/g, '')}.jpg`

  return (
    <div ref={tileRef} className={`thumb ${src ? 'has-media' : 'has-placeholder'} ${className}`}>
      {src && <img src={src} alt={name || ''} loading="lazy" onError={() => setSrc(null)} />}
      {src && credit && (sourceUrl
        ? <a className="image-credit" href={sourceUrl} target="_blank" rel="noopener noreferrer">{credit}</a>
        : <span className="image-credit">Photo: {credit}</span>)}
      {!src && placeholder === 'meal'
        ? <span className="meal-image-placeholder"><small>MEAL</small><strong>{name || 'Planned meal'}</strong></span>
        : <span className="fname" aria-hidden="true">{file}</span>}
      {children}
    </div>
  )
}
