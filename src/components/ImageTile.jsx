import { useEffect, useState } from 'react'

/* The diagonal-stripe slot from the design, which a real photo covers once it
   loads. The stripe is both the placeholder and the genuine no-image fallback,
   so a missing photo is never a broken image — it stays the designed state.

   `loader` is a function returning Promise<{ url }>. `name` identifies the
   subject: when it changes (a swap), the photo is re-fetched. */
export default function ImageTile({ name, loader, className = '', children }) {
  const [src, setSrc] = useState(null)
  const [credit, setCredit] = useState('')

  useEffect(() => {
    let alive = true
    setSrc(null)
    setCredit('')
    loader()
      .then((res) => {
        if (alive && res && res.url) {
          setSrc(res.url)
          setCredit(res.credit || '')
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // The loader closes over `name`; re-running on the name covers every case
    // where the subject actually changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  const file = `${(name || 'dish').toLowerCase().replace(/[^a-z0-9]+/g, '')}.jpg`

  return (
    <div className={`thumb ${className}`}>
      {src && <img src={src} alt="" loading="lazy" onError={() => setSrc(null)} />}
      {src && credit && <span className="image-credit">Photo: {credit}</span>}
      <span className="fname" aria-hidden="true">
        {file}
      </span>
      {children}
    </div>
  )
}
