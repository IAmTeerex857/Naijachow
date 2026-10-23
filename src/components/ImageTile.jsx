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
  const [parts, setParts] = useState([])

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
    setParts([])
    loader()
      .then((res) => {
        if (alive && res && res.url) {
          setSrc(res.url)
          setCredit(res.credit || '')
          setSourceUrl(res.sourceUrl || '')
        } else if (alive && res?.parts?.length) {
          setParts(res.parts)
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
  const partCredits = [...new Set(parts.map((part) => part.credit).filter(Boolean))]

  return (
    <div ref={tileRef} className={`thumb ${src || parts.length ? 'has-media' : 'has-placeholder'} ${className}`}>
      {src && <img src={src} alt={name || ''} loading="lazy" onError={() => setSrc(null)} />}
      {src && credit && (sourceUrl
        ? <a className="image-credit" href={sourceUrl} target="_blank" rel="noopener noreferrer">{credit}</a>
        : <span className="image-credit">Photo: {credit}</span>)}
      {!src && parts.length > 0 && (
        <span className={`meal-collage parts-${parts.length}`} role="img" aria-label={`${name}: ${parts.map((part) => part.name).join(', ')}`}>
          {parts.map((part) => (
            <span className="meal-collage-part" key={part.id}>
              <img
                src={part.url}
                alt=""
                loading="lazy"
                onError={() => setParts((current) => current.filter((item) => item.id !== part.id))}
              />
              {parts.length > 1 && <small>{part.name}</small>}
            </span>
          ))}
        </span>
      )}
      {!src && partCredits.length > 0 && <span className="image-credit">Photos: {partCredits.join(' · ')}</span>}
      {!parts.length && (!src && placeholder === 'meal'
        ? <span className="meal-image-placeholder"><small>MEAL</small><strong>{name || 'Planned meal'}</strong></span>
        : <span className="fname" aria-hidden="true">{file}</span>)}
      {children}
    </div>
  )
}
