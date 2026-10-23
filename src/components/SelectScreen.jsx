import { useEffect, useMemo, useState } from 'react'
import { FOODS, CATEGORIES } from '../data/foods'
import FoodCard from './FoodCard'
import TurnstileWidget from './TurnstileWidget'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DURATIONS = [{ n: 3 }, { n: 5 }, { n: 7 }, { n: 14, premium: true }, { n: 30, premium: true }]
const PAGE_SIZE = 16

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
  fastingType,
  setFastingType,
  fday,
  setFday,
  duration,
  setDuration,
  onGenerate,
  onPremium,
  premiumActive,
  fastingAllowed,
  error,
  signedIn,
  onTurnstileToken,
  turnstileToken,
  turnstileResetKey,
}) {
  const query = search.trim().toLowerCase()
  const [page, setPage] = useState(1)

  const visible = useMemo(() => {
    return FOODS.filter((food) => {
      const categoryMatches = cat === 'all' || food.cat === cat
      const searchMatches = !query || `${food.name} ${food.id} ${food.q}`.toLowerCase().includes(query)
      return categoryMatches && searchMatches
    })
  }, [query, cat])
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const effectivePage = Math.min(page, pageCount)
  const pageFoods = visible.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [query, cat])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const count = selected.size
  const enough = count >= 3

  const status =
    count === 0
      ? 'Select at least 3 dishes to enable meal planning.'
      : enough
      ? `${count} dishes selected and ready`
      : `${count} selected. Pick ${3 - count} more to enable meal planning.`

  function changeFoodPage(nextPage) {
    setPage(nextPage)
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }

  return (
    <>
      <div className="screen">
        <div className="screen-head">
          <div className="eyebrow">STEP 01 SELECT</div>
          <h1>What can you cook?</h1>
          <p>Pick at least 3 favourites from this starter list. We will use them as anchors and add realistic complementary foods. Fruits you pick become your daily snack.</p>
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
                    See Premium
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
              placeholder="Search dishes: jollof, egusi, dodo"
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
            {pageFoods.map((f) => (
              <FoodCard key={f.id} food={f} selected={selected.has(f.id)} onToggle={onToggle} />
            ))}
          </div>
        )}

        {visible.length > PAGE_SIZE && (
          <nav className="food-pagination" aria-label="Food pages">
            <button className="btn btn-outline btn-sm" onClick={() => changeFoodPage(Math.max(1, effectivePage - 1))} disabled={effectivePage === 1}>Previous</button>
            <span>Page {effectivePage} of {pageCount}</span>
            <button className="btn btn-outline btn-sm" onClick={() => changeFoodPage(Math.min(pageCount, effectivePage + 1))} disabled={effectivePage === pageCount}>Next</button>
          </nav>
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
                disabled={!fastingAllowed}
                role="switch"
                aria-checked={fasting}
                aria-label="Include a fasting day"
              >
                <span className="knob" />
              </button>
              <div>
                <div className="fastlabel">Include a light fasting day</div>
                <div className="fasthint">
                  {fastingAllowed
                    ? 'We leave meals unscheduled and provide hydration reminders.'
                    : 'Unavailable with selected health considerations. Ask your clinician first.'}
                </div>
              </div>
            </div>
            {fasting && (
              <>
              <div className="fasting-types" role="radiogroup" aria-label="Fasting type">
                <button type="button" className={`daybtn ${fastingType === 'food' ? 'active' : ''}`} onClick={() => setFastingType('food')} aria-pressed={fastingType === 'food'}>Food fast</button>
                <button type="button" className={`daybtn ${fastingType === 'spiritual' ? 'active' : ''}`} onClick={() => setFastingType('spiritual')} aria-pressed={fastingType === 'spiritual'}>Spiritual fast</button>
              </div>
              <p className="fasthint">{fastingType === 'spiritual' ? 'Meals stay unscheduled and the day includes a short scripture.' : 'Meals stay unscheduled and the day includes an encouraging reminder.'}</p>
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
                      title={reachable ? undefined : `Outside a ${duration} day plan`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
              </>
            )}
          </div>

          <div className="card optcard">
            <div className="optcard-title">How many days?</div>
            <div className="durations">
              {DURATIONS.map((d) => (
                <button
                  key={d.n}
                  className={`durbtn ${duration === d.n ? 'active' : ''}`}
                  onClick={() => {
                    setDuration(d.n)
                    if (d.premium && !premiumActive) onPremium()
                  }}
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
          <span className="selstatus" id="selection-requirement" role="status" aria-live="polite" aria-atomic="true">{status}</span>
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
          aria-describedby="selection-requirement"
        >
          Plan my meals
        </button>
      </div>
    </>
  )
}
