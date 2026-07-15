export default function NutritionStrip({ plan }) {
  const stats = [
    { val: plan.avg_calories ? `${plan.avg_calories}` : '—', lbl: 'Avg kcal' },
    { val: plan.avg_protein || '—', lbl: 'Protein' },
    { val: plan.avg_carbs || '—', lbl: 'Carbs' },
    { val: plan.avg_fat || '—', lbl: 'Fat' },
    { val: plan.balance_score || '—', lbl: 'Balance' },
  ]
  return (
    <div className="nutrition-strip">
      {stats.map((s) => (
        <div className="nstat" key={s.lbl}>
          <div className="val">{s.val}</div>
          <div className="lbl">{s.lbl}</div>
        </div>
      ))}
    </div>
  )
}
