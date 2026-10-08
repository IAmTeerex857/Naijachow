import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function PaymentSuccessModal({ onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const keydown = (event) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [onClose])
  return createPortal(
    <div className="success-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="success-modal" role="dialog" aria-modal="true" aria-labelledby="payment-success-title">
        <div className="success-check" aria-hidden="true">
          <svg viewBox="0 0 52 52"><path d="M14 27l8 8 17-18" /></svg>
        </div>
        <p className="eyebrow">PAYMENT CONFIRMED</p>
        <h2 id="payment-success-title">Premium is ready</h2>
        <p>You now have 30 days of access to longer meal plans.</p>
        <button ref={closeRef} className="btn btn-primary" onClick={onClose}>Continue</button>
      </section>
    </div>,
    document.body
  )
}
