import { BorderBeam } from 'border-beam'
import { useReducedMotion } from '../lib/useReducedMotion'

function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(value))
}

export default function PremiumScreen({
  user,
  status,
  loading,
  actionLoading,
  message,
  onCheckout,
  onSignIn,
  onPlan,
  dark,
}) {
  const reducedMotion = useReducedMotion()
  const subscription = status?.subscription
  const endDate = formatDate(subscription?.current_period_end)

  return (
    <div className="screen">
      <section className="premium-screen">
        <div className="eyebrow">PREMIUM</div>
        <h1>Plan the whole month.</h1>
        <p className="premium-lede">Get 30 days of Premium access with one payment of ₦2,500.</p>

        <BorderBeam
          className="premium-beam"
          size="md"
          colorVariant="sunset"
          theme={dark ? 'dark' : 'light'}
          strength={0.82}
          active={!reducedMotion}
        >
          <div className="card premium-card">
            <div className="premium-price"><strong>₦2,500</strong><span>for 30 days</span></div>
            <ul>
              <li>Meal plans for 14 or 30 days</li>
              <li>One time payment</li>
              <li>No automatic renewal</li>
            </ul>

            {message && <div className="notice info" role="status"><span className="mark" />{message}</div>}
            {loading && user && <p className="premium-status">Checking your Premium access...</p>}
            {!loading && status?.active && (
              <div className="premium-status">
                <strong>Premium is active</strong>
                <span>{endDate ? `Access ends ${endDate}.` : 'Your longer plans are unlocked.'}</span>
              </div>
            )}
            {!loading && user && !status?.active && subscription?.provider_status === 'pending' && (
              <div className="premium-status"><strong>Payment confirmation pending</strong><span>Your access will update as soon as the payment is confirmed.</span></div>
            )}
            {!loading && user && !status?.active && ['past_due', 'unpaid', 'paused'].includes(subscription?.provider_status) && (
              <div className="premium-status"><strong>Premium access is unavailable</strong><span>A new payment is required before longer plans unlock.</span></div>
            )}

            <div className="premium-actions">
              {!user && <button className="btn btn-orange" onClick={onSignIn}>Sign in to subscribe</button>}
              {user && !status?.active && <button className="btn btn-orange" onClick={onCheckout} disabled={actionLoading}>Subscribe</button>}
              {status?.active && <button className="btn btn-orange" onClick={onPlan}>Build a longer plan</button>}
            </div>
          </div>
        </BorderBeam>
      </section>
    </div>
  )
}
