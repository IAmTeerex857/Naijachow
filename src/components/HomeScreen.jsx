import { lazy, Suspense } from 'react'
import { BotAvatar } from 'bot-avatars'
import { FOODS } from '../data/foods'
import { fetchFoodImage } from '../lib/api'
import ImageTile from './ImageTile'

const HeroLiquid = lazy(() => import('./HeroLiquid'))

/* A fixed, recognisable spread across the categories — not a random sample, so
   the home page looks the same on every visit. */
const POPULAR_IDS = ['jollof', 'egusi', 'poundedyam', 'friedrice', 'moimoi']
const POPULAR = POPULAR_IDS.map((id) => FOODS.find((f) => f.id === id)).filter(Boolean)

const STEPS = [
  {
    avatar: 'square',
    state: 'default',
    n: 'STEP 01',
    title: 'Select your dishes',
    body: 'Choose from 60 finished Nigerian dishes across soups, swallows, carbs, protein & fruits.',
  },
  {
    avatar: 'clover',
    state: 'working',
    n: 'STEP 02',
    title: 'We build the plan',
    body: 'AI pairs your dishes into balanced days, respecting soup-and-swallow rules and nutrition.',
  },
  {
    avatar: 'flower',
    state: 'default',
    n: 'STEP 03',
    title: 'Cook & swap',
    body: "Get recipes, swap any meal you don't fancy, and print or order from a nearby vendor.",
  },
]

export default function HomeScreen({ onStart, onSeeSaved }) {
  return (
    <div style={{ animation: 'rise .5s ease both' }}>
      <section className="hero">
        <Suspense fallback={<div className="hero-liquid-fallback" aria-hidden="true" />}>
          <HeroLiquid />
        </Suspense>
        <div className="hero-copy">
          <div className="badge">
            <i aria-hidden="true" />
            Powered by AI meal pairing
          </div>
          <h1>
            What can you <em>cook</em> today?
          </h1>
          <p>
            Pick the finished Nigerian dishes you can make. We arrange a balanced multi-day plan
            with breakfast, lunch and dinner using only what you selected.
          </p>
          <div className="hero-actions">
            <button className="btn btn-orange" onClick={onStart}>
              Start planning →
            </button>
            <button className="btn btn-outline" onClick={onSeeSaved}>
              See saved plans
            </button>
          </div>
        </div>
        <div className="hero-art">
          <div className="glow" aria-hidden="true" />
          <img src="/mascot.gif" alt="" width="300" height="300" />
        </div>
      </section>

      <section className="section">
        <div className="steps">
          {STEPS.map((s) => (
            <div className="card step" key={s.n}>
              <div className="step-avatar" aria-hidden="true">
                <BotAvatar type={s.avatar} state={s.state} size={64} />
              </div>
              <div className="step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section last">
        <div className="section-head">
          <h2>Popular dishes</h2>
          <button className="linkbtn" onClick={onStart}>
            Browse all {FOODS.length} →
          </button>
        </div>
        <div className="popgrid">
          {POPULAR.map((food) => (
            <div className="popcard" key={food.id}>
              <ImageTile name={food.name} loader={() => fetchFoodImage(food)} />
              <div className="popcard-body">
                <div className="popcard-name">{food.name}</div>
                <span className={`popcard-cat`} style={{ color: `var(--cat-${food.cat})` }}>
                  {food.cat}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
