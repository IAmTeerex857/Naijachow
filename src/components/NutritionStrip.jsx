import { planNutrition } from '../lib/nutrition'

/* Averages are computed from the days on screen, never read from the model's
   avg_* fields — those describe the plan as first generated and go stale the
   moment a meal is swapped. */
export default function NutritionStrip({ days }) {
  const n = planNutrition(days)

  const stats = [
    { val: n.calories || '—', lbl: 'AVG KCAL', color: 'var(--orange)' },
    { val: n.protein ? `${n.protein}g` : '—', lbl: 'PROTEIN', color: 'var(--green)' },
    { val: n.carbs ? `${n.carbs}g` : '—', lbl: 'CARBS', color: 'var(--blue)' },
    { val: n.fat ? `${n.fat}g` : '—', lbl: 'FAT', color: 'var(--purple)' },
    { val: n.days ? n.balance : '—', lbl: 'BALANCE', color: 'var(--ink)' },
  ]

  return (
    <div className="nutrition">
      {stats.map((s) => (
        <div className="nstat" key={s.lbl}>
          <div className="val" style={{ color: s.color }}>
            {s.val}
          </div>
          <div className="lbl">{s.lbl}</div>
        </div>
      ))}
    </div>
  )
}
