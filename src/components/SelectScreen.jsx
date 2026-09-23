import { useMemo } from 'react'
import { FOODS, CATEGORIES } from '../data/foods'
import FoodCard from './FoodCard'
import TurnstileWidget from './TurnstileWidget'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DURATIONS = [{ n: 3 }, { n: 5 }, { n: 7 }, { n: 14, premium: true }, { n: 30, premium: true }]

export default function SelectScreen({
  selected,
  onToggle,
  onClear,
  search,
  setSearch,
  cat,
  setCat,
  fasting,
  onToggleFasting,
  fday,
  setFday,
  duration,
  setDuration,
  onGenerate,
  onPremium,
  error,
  signedIn,
  onTurnstileToken,
  turnstileToken,
  turnstileResetKey,
}) {
  const query = search.trim().toLowerCase()

  const visible = useMemo(() => {
    return FOODS.filter((food) => {
      const categoryMatches = cat === 'all' || food.cat === cat
      const searchMatches = !query || `${food.name} ${food.id} ${food.q}`.toLowerCase().includes(query)
      return categoryMatches && searchMatches
    })
  }, [query, cat])

  const count = selected.size
  const enough = count >= 3

  const status =
    count === 0
      ? 'Tap dishes to select'
      : enough
      ? `${count} dishes selected — ready`
      : `selected — pick ${3 - count} more`

  return (
    <>
      <div className="screen">
        <div className="screen-head">
          <div className="eyebrow">STEP 01 · SELECT</div>
          <h1>What can you cook?</h1>
          <p>Tap the dishes you can make. Pick at least 3 to build a plan.</p>
        </div>

        {error && (
          <div className={`notice ${error.premium ? 'premium' : 'warn'}`} role="alert">
            <span className="mark" aria-hidden="true" />
            <span>
              {error.premium && <strong>Premium plan length. </strong>}
              {error.message}
              {error.premium && (
                <>
                  {' '}
                  <button className="linkbtn" onClick={onPremium}>
                    See Premium →
                  </button>
                </>
              )}
            </span>
          </div>
        )}

        <div className="filters">
          <div className="searchfield">
            <span className="glass" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes — jollof, egusi, dodo…"
              aria-label="Search dishes"
            />
          </div>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={`chip ${cat === c.key && !query ? 'active' : ''}`}
                onClick={() => {
                  setCat(c.key)
                  setSearch('')
                }}
                aria-pressed={cat === c.key && !query}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty">
            <strong>No dishes match your search</strong>
            <span>Try a different name or clear the search.</span>
          </div>
        ) : (
          <div className="dishgrid">
            {visible.map((f) => (
              <FoodCard key={f.id} food={f} selected={selected.has(f.id)} onToggle={onToggle} />
            ))}
          </div>
        )}

        <div className="options">
          <div className="card optcard">
            <div className="optcard-title">
              Fasting day <span>(optional)</span>
            </div>
            <div className="fastrow">
              <button
                className={`switch ${fasting ? 'on' : ''}`}
                onClick={onToggleFasting}
                role="switch"
                aria-checked={fasting}
                aria-label="Include a fasting day"
              >
                <span className="knob" />
              </button>
              <div>
                <div className="fastlabel">Include a light fasting day</div>
                <div className="fasthint">We plan a rest day with hydration tips.</div>
              </div>
            </div>
            {fasting && (
              <div className="weekdays">
                {WEEKDAYS.map((d, i) => {
                  // A plan always starts on Monday, so a weekday beyond its
                  // length can never occur — disable it rather than accept a
                  // choice that would silently vanish from the plan.
                  const reachable = i < duration
                  return (
                    <button
                      key={d}
                      className={`daybtn ${fday === d ? 'active' : ''}`}
                      onClick={() => setFday(d)}
                      disabled={!reachable}
                      aria-pressed={fday === d}
                      title={reachable ? undefined : `Outside a ${duration}-day plan`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="card optcard">
            <div className="optcard-title">How many days?</div>
            <div className="durations">
              {DURATIONS.map((d) => (
                <button
                  key={d.n}
                  className={`durbtn ${duration === d.n ? 'active' : ''}`}
                  onClick={() => (d.premium ? onPremium() : setDuration(d.n))}
                  aria-pressed={duration === d.n}
                >
                  <span className="n">{d.n}</span>
                  <span className="u">days</span>
                  {d.premium && <span className="premium">PREMIUM</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="selbar">
        <div className="selbar-left">
          <span className="selcount">{count}</span>
          <span className="selstatus">{status}</span>
          {count > 0 && (
            <button className="selclear" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
        {!signedIn && <TurnstileWidget onToken={onTurnstileToken} resetKey={turnstileResetKey} />}
        <button
          className="btn btn-orange btn-sm"
          onClick={onGenerate}
          disabled={!enough || (!signedIn && Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY) && !turnstileToken)}
        >
          Plan my meals →
        </button>
      </div>
    </>
  )
}
