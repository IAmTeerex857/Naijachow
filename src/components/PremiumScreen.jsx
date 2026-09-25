import { BorderBeam } from 'border-beam'

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
  onCancel,
  onRefresh,
  onPlan,
  dark,
}) {
  const subscription = status?.subscription
  const endDate = formatDate(subscription?.current_period_end)
  const ending = status?.active && subscription?.cancel_at_period_end

  return (
    <div className="screen">
      <section className="premium-screen">
        <div className="eyebrow">PREMIUM</div>
        <h1>Plan the whole month.</h1>
        <p className="premium-lede">Build culturally realistic 14- and 30-day meal plans for ₦2,500/month.</p>

        <BorderBeam
          className="premium-beam"
          size="pulse-outside"
          colorVariant="sunset"
          theme={dark ? 'dark' : 'light'}
          strength={0.5}
        >
          <div className="card premium-card">
            <div className="premium-price"><strong>₦2,500</strong><span>/ month</span></div>
            <ul>
              <li>14-day and 30-day meal plans</li>
              <li>Recurring monthly subscription</li>
              <li>Cancel before renewal; keep access through the paid period</li>
            </ul>

            {message && <div className="notice info" role="status"><span className="mark" />{message}</div>}
            {loading && user && <p className="premium-status">Checking your subscription...</p>}
            {!loading && status?.active && (
              <div className="premium-status">
                <strong>{ending ? 'Cancellation scheduled' : 'Premium is active'}</strong>
                <span>{endDate ? `${ending ? 'Access ends' : 'Current period ends'} ${endDate}.` : 'Your longer plans are unlocked.'}</span>
              </div>
            )}
            {!loading && user && !status?.active && subscription?.provider_status === 'pending' && (
              <div className="premium-status"><strong>Payment confirmation pending</strong><span>Refresh after checkout while Bachs confirms your subscription.</span></div>
            )}
            {!loading && user && !status?.active && ['past_due', 'unpaid', 'paused'].includes(subscription?.provider_status) && (
              <div className="premium-status"><strong>Premium access is paused</strong><span>Your subscription needs payment attention before longer plans unlock.</span></div>
            )}

            <div className="premium-actions">
              {!user && <button className="btn btn-orange" onClick={onSignIn}>Sign in to subscribe →</button>}
              {user && !status?.active && <button className="btn btn-orange" onClick={onCheckout} disabled={actionLoading}>Subscribe with Bachs →</button>}
              {status?.active && <button className="btn btn-orange" onClick={onPlan}>Build a longer plan →</button>}
              {user && <button className="btn btn-outline" onClick={onRefresh} disabled={actionLoading}>Refresh status</button>}
              {status?.active && !ending && <button className="linkbtn" onClick={onCancel} disabled={actionLoading}>Cancel at period end</button>}
            </div>
          </div>
        </BorderBeam>
      </section>
    </div>
  )
}
