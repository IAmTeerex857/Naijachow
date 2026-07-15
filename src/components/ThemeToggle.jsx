export default function ThemeToggle({ dark, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label="Toggle dark mode">
      {dark ? '☀ LIGHT' : '🌙 DARK'}
    </button>
  )
}
