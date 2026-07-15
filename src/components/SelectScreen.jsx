import { useMemo } from 'react'
import { FOODS, CATEGORIES } from '../data/foods'
import FoodCard from './FoodCard'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DURATIONS = [
  { n: 3, note: null },
  { n: 5, note: null },
  { n: 7, note: { kind: 'popular', text: '⭐ Popular' } },
  { n: 14, note: { kind: 'premium', text: '✨ Premium' } },
  { n: 30, note: { kind: 'premium', text: '✨ Premium' } },
]

export default function SelectScreen({
  selected,
  onToggle,
  onClear,
  search,
  setSearch,
  cat,
  setCat,
  fasting,
  setFasting,
  fday,
  setFday,
  duration,
  setDuration,
  onGenerate,
  error,
}) {
  const query = search.trim().toLowerCase()

  // When a query is present it takes precedence over the active tab.
  const visible = useMemo(() => {
    if (query) return FOODS.filter((f) => f.name.toLowerCase().includes(query))
    if (cat === 'all') return FOODS
    return FOODS.filter((f) => f.cat === cat)
  }, [query, cat])

  const count = selected.size
  const enough = count >= 3

  return (
    <>
      {/* Search + tabs */}
      <div className="searchtabs">
        <div className="searchfield">
          <span aria-hidden="true">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes — jollof, egusi, dodo…"
            aria-label="Search dishes"
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
        <div className="tabs" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`tab ${cat === c.key && !query ? 'active' : ''}`}
              onClick={() => setCat(c.key)}
              role="tab"
              aria-selected={cat === c.key && !query}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div className="cardgrid">
        {visible.length === 0 ? (
          <div className="empty-state">
            <div className="big">🍽️</div>
            No dishes match “{search}”
          </div>
        ) : (
          visible.map((f) => (
            <FoodCard key={f.id} food={f} selected={selected.has(f.id)} onToggle={onToggle} />
          ))
        )}
      </div>

      {/* Options — fasting + duration */}
      <div className="options">
        <div>
          <div className="optblock-title">Fasting day (optional)</div>
          <div className="fastrow">
            <button
              className={`switch ${fasting ? 'on' : ''}`}
              onClick={() => setFasting(!fasting)}
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
            <div className="daypicker">
              {DAYS.map((d) => (
                <button
                  key={d}
                  className={`daybtn ${fday === d ? 'active' : ''}`}
                  onClick={() => setFday(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="optblock-title">How many days?</div>
          <div className="durations">
            {DURATIONS.map((d) => (
              <button
                key={d.n}
                className={`durpill ${duration === d.n ? 'active' : ''}`}
                onClick={() => setDuration(d.n)}
              >
                <span className="num">{d.n}</span>
                <span className="lbl">day{d.n > 1 ? 's' : ''}</span>
                {d.note && <span className={`note ${d.note.kind}`}>{d.note.text}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selection bar + CTA (sticky) */}
      <div className="selbar">
        <div className="selbar-left">
          <span className="selcount">{count}</span>
          <span className="selstatus">
            {count === 0 ? 'Tap dishes to select' : `dish${count === 1 ? '' : 'es'} selected`}
          </span>
          {count > 0 && (
            <button className="selclear" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
        <div className="selbar-right">
          {error && <span className="validation-msg">{error}</span>}
          <button className="btn btn-cta" onClick={onGenerate} disabled={!enough}>
            🍽️ Plan My Meals
          </button>
        </div>
      </div>
    </>
  )
}
