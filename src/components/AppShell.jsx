import { lazy, Suspense } from 'react'

/* Navigation shell: a persistent side rail on desktop, a bottom tab bar on
   mobile, per the two design files. Both drive the same `screen` state — the
   mobile mock's phone frame is presentation of the mock, not part of the app,
   so this is one responsive layout rather than two builds. */

const MetalUpgradeButton = lazy(() => import('./MetalUpgradeButton'))

const NAV = [
  { key: 'home', label: 'Home', glyph: 'round' },
  { key: 'select', label: 'New Plan', glyph: 'square' },
  { key: 'saved', label: 'Saved', railLabel: 'Saved Plans', glyph: 'square' },
  { key: 'premium', label: 'Premium', glyph: 'solid' },
]

/* The New Plan tab stays lit through the loading and plan sub-states. */
function isActive(key, screen) {
  if (key === 'select') return ['preferences', 'select', 'loading', 'plan'].includes(screen)
  return key === screen
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">
        <span />
      </div>
      <div className="brand-text">
        <span className="brand-name">Naijachow</span>
        <span className="brand-sub">MEAL PLANNER</span>
      </div>
    </div>
  )
}

function ThemeButton({ dark, onToggle }) {
  return (
    <button
      className="themebtn"
      onClick={onToggle}
      aria-label={dark ? 'Use light theme' : 'Use dark theme'}
      title={dark ? 'Use light theme' : 'Use dark theme'}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 15.5A8.5 8.5 0 0 1 8.5 3.6 8.5 8.5 0 1 0 20.4 15.5Z" /></svg>
      )}
    </button>
  )
}

export default function AppShell({ screen, onNavigate, dark, onToggleTheme, user, premiumActive, onAccount, children }) {
  return (
    <div className="app">
      <aside className="rail">
        <Brand />
        <nav className="railnav" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.key}
              href={`#/${item.key}`}
              className={`navbtn ${isActive(item.key, screen) ? 'active' : ''}`}
              data-active={isActive(item.key, screen) ? 'true' : 'false'}
              onClick={(event) => { event.preventDefault(); onNavigate(item.key) }}
              aria-current={isActive(item.key, screen) ? 'page' : undefined}
            >
              {item.railLabel || item.label}
            </a>
          ))}
        </nav>

        <div className="railfoot">
          {premiumActive === false && screen !== 'premium' && <div className="upsell">
            <div className="upsell-tag">FREE PLAN</div>
            <p>Plans for up to 7 days. Upgrade for 14 or 30 days.</p>
            <Suspense fallback={<button onClick={() => onNavigate('premium')}>Upgrade</button>}>
              <MetalUpgradeButton dark={dark} onClick={() => onNavigate('premium')} />
            </Suspense>
          </div>}
          {user && (
            <div className="account-menu">
              <button onClick={onAccount}>
                <span className="account-avatar" aria-hidden="true">{user.email?.[0]?.toUpperCase() || 'N'}</span>
                <span>Account</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <div className="desktop-utility"><ThemeButton dark={dark} onToggle={onToggleTheme} /></div>
        <header className="topbar">
          <Brand />
          <div className="topbar-actions">
            {user && <button className="linkbtn" onClick={onAccount}>Account</button>}
            <ThemeButton dark={dark} onToggle={onToggleTheme} />
          </div>
        </header>
        {children}

        <footer className="footer">
          <strong>Naijachow</strong> Smart meal planning for Nigerian homes
          <span>
            Calorie and macro figures are estimates for general guidance only. Always consult a
            registered dietitian for medical nutrition advice.
          </span>
        </footer>
      </main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <a
            key={item.key}
            href={`#/${item.key}`}
            className={`tabbtn ${item.glyph === 'round' ? 'round' : ''} ${
              item.glyph === 'solid' ? 'solid' : ''
            } ${isActive(item.key, screen) ? 'active' : ''}`}
            onClick={(event) => { event.preventDefault(); onNavigate(item.key) }}
            aria-current={isActive(item.key, screen) ? 'page' : undefined}
          >
            <span className="glyph" aria-hidden="true" />
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
