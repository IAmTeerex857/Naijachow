/* Navigation shell: a persistent side rail on desktop, a bottom tab bar on
   mobile, per the two design files. Both drive the same `screen` state — the
   mobile mock's phone frame is presentation of the mock, not part of the app,
   so this is one responsive layout rather than two builds. */

const NAV = [
  { key: 'home', label: 'Home', glyph: 'round' },
  { key: 'select', label: 'New Plan', glyph: 'square' },
  { key: 'saved', label: 'Saved', railLabel: 'Saved Plans', glyph: 'square' },
  { key: 'imports', label: 'Imports', glyph: 'round' },
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
        <span className="brand-name">NaijaPlate</span>
        <span className="brand-sub">MEAL PLANNER</span>
      </div>
    </div>
  )
}

function ThemeButton({ dark, onToggle }) {
  return (
    <button className="themebtn" onClick={onToggle} aria-label="Toggle colour theme">
      <span>Theme</span>
      <span className="dot">
        <i aria-hidden="true" />
        {dark ? 'Dark' : 'Light'}
      </span>
    </button>
  )
}

export default function AppShell({ screen, onNavigate, dark, onToggleTheme, user, onSignOut, onAccount, children }) {
  return (
    <div className="app">
      <aside className="rail">
        <Brand />
        <nav className="railnav" aria-label="Main">
          {NAV.map((item) => (
            <button
              key={item.key}
              className={`navbtn ${isActive(item.key, screen) ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              aria-current={isActive(item.key, screen) ? 'page' : undefined}
            >
              {item.railLabel || item.label}
            </button>
          ))}
        </nav>

        <div className="railfoot">
          <div className="upsell">
            <div className="upsell-tag">FREE PLAN</div>
            <p>Up to 7-day plans. Upgrade for 14 &amp; 30-day.</p>
            <button onClick={() => onNavigate('premium')}>Upgrade →</button>
          </div>
          <ThemeButton dark={dark} onToggle={onToggleTheme} />
          {user && <button className="linkbtn" onClick={onAccount}>Account</button>}
          {user && <button className="linkbtn" onClick={onSignOut}>Sign out</button>}
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <Brand />
          <div className="topbar-actions">
            {user && <button className="linkbtn" onClick={onAccount}>Account</button>}
            <ThemeButton dark={dark} onToggle={onToggleTheme} />
          </div>
        </div>
        {children}

        <footer className="footer">
          <strong>NaijaPlate</strong> · Smart meal planning for Nigerian homes
          <span>
            Calorie and macro figures are estimates for general guidance only. Always consult a
            registered dietitian for medical nutrition advice.
          </span>
        </footer>
      </div>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <button
            key={item.key}
            className={`tabbtn ${item.glyph === 'round' ? 'round' : ''} ${
              item.glyph === 'solid' ? 'solid' : ''
            } ${isActive(item.key, screen) ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-current={isActive(item.key, screen) ? 'page' : undefined}
          >
            <span className="glyph" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
