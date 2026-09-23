/* Stand-in for the screens designed but not yet built (Saved Plans, Vendors,
   Premium). They are in the nav because the shell is designed around five
   destinations; this says plainly that they are on the way rather than
   pretending with sample content. */
export default function ComingSoon({ eyebrow, title, body, onStart }) {
  return (
    <div className="screen">
      <div className="soon">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{body}</p>
        <button className="btn btn-orange" onClick={onStart}>
          Build a plan instead →
        </button>
      </div>
    </div>
  )
}
