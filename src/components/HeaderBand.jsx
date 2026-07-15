/* Full-bleed dark hero band with logo, mono step indicator, headline. */
export default function HeaderBand({ step = 1 }) {
  const steps = [
    { n: 1, label: 'SELECT' },
    { n: 2, label: 'BUILD' },
    { n: 3, label: 'PLAN' },
  ]
  return (
    <div className="headerband">
      <div className="headerband-top">
        <div className="logo">
          <b>Naija</b>Plate
        </div>
        <div className="stepind">
          {steps.map((s, i) => (
            <span key={s.n}>
              <span className={step === s.n ? 'on' : ''}>
                {s.n} · {s.label}
              </span>
              {i < steps.length - 1 ? ' → ' : ''}
            </span>
          ))}
        </div>
      </div>
      <h1>What can you cook today?</h1>
      <p className="sub">
        Pick the finished Nigerian dishes you can make. We arrange a balanced multi-day plan —
        breakfast, lunch &amp; dinner — from only what you selected.
      </p>
    </div>
  )
}
