/* The generative moment between Select and Plan. In the prototype this was a
   fixed 2.4s timer; here it lasts exactly as long as the real AI call, so
   it is a status indicator rather than theatre. */
export default function LoadingScreen() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="orb a" aria-hidden="true" />
      <div className="orb b" aria-hidden="true" />
      <div className="orb c" aria-hidden="true" />
      <div className="loading-inner">
        <div className="loading-blob" aria-hidden="true"><span /><span /></div>
        <h2>Building your meal plan...</h2>
        <p>Finding realistic Nigerian meals around your preferences.</p>
      </div>
    </div>
  )
}
