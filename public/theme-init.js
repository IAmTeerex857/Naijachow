try {
  var savedTheme = localStorage.getItem('np-theme')
  var initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
  document.documentElement.setAttribute('data-theme', initialTheme)
} catch (_error) {
  document.documentElement.setAttribute('data-theme', 'dark')
}
