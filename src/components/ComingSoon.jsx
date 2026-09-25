/* Stand-in for navigation destinations that are not available yet. */
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
