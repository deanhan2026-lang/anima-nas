/**
 * STELLAR NYX 1.0 — Theme Manager
 * Light/Dark mode toggle with localStorage persistence.
 */
(function () {
  const THEME_KEY = 'stellar-theme';
  let currentTheme = localStorage.getItem(THEME_KEY) || 'dark';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeToggleIcon');
    if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, theme);
    currentTheme = theme;
  }

  function toggleTheme() {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function injectToggle() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return setTimeout(injectToggle, 100);

    const btn = document.createElement('a');
    btn.id = 'themeToggle';
    btn.href = '#';
    btn.style.cssText = 'cursor:pointer;font-size:1.2rem;padding:6px 10px;margin-left:8px;';
    btn.title = '切换白天/黑夜模式';
    btn.innerHTML = '<span id="themeToggleIcon">' + (currentTheme === 'light' ? '☀️' : '🌙') + '</span>';
    btn.onclick = function (e) { e.preventDefault(); toggleTheme(); };
    nav.appendChild(btn);
  }

  // Init
  applyTheme(currentTheme);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectToggle);
  } else {
    injectToggle();
  }
})();
