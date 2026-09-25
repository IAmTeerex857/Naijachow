import { Component } from 'react'

/* Without this, one unexpected field in a generated plan unmounts the whole
   tree and the user gets a blank page with no way back. */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('[Naijachow] render error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="screen">
        <div className="soon">
          <div className="eyebrow">SOMETHING BROKE</div>
          <h1>That plan didn&apos;t load</h1>
          <p>
            Something went wrong while showing your plan. Your dishes are safe — start again and
            we&apos;ll rebuild it.
          </p>
          <button className="btn btn-orange" onClick={() => window.location.reload()}>
            Reload Naijachow
          </button>
        </div>
      </div>
    )
  }
}
