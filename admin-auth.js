/**
 * Client-side gate for admin.html (static site — not server-grade security).
 * Password: data/admin-config.json (gitignored) or FALLBACK_PASSWORD below.
 */
(function () {
  const SESSION_KEY = 'portfolio-admin-session';
  const CONFIG_URL = 'data/admin-config.json';
  /** Change via admin-config.json; this is only used when that file is missing. */
  const FALLBACK_PASSWORD = 'portfolio-admin';

  const loginEl = document.getElementById('admin-login');
  const appEl = document.getElementById('admin-app');
  const form = document.getElementById('admin-login-form');
  const errorEl = document.getElementById('admin-login-error');
  const passwordInput = document.getElementById('admin-password');

  function lockUi() {
    document.body.removeAttribute('data-admin-authenticated');
    document.body.setAttribute('data-admin-locked', '');
    loginEl?.removeAttribute('hidden');
    appEl?.setAttribute('hidden', '');
    if (appEl) appEl.setAttribute('aria-hidden', 'true');
    if (loginEl) loginEl.removeAttribute('aria-hidden');
  }

  function isAuthenticated() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === 'ok';
    } catch (_) {
      return false;
    }
  }

  function setAuthenticated() {
    try {
      sessionStorage.setItem(SESSION_KEY, 'ok');
    } catch (_) {}
  }

  function showApp() {
    document.body.setAttribute('data-admin-authenticated', '');
    document.body.removeAttribute('data-admin-locked');
    loginEl?.setAttribute('hidden', '');
    if (loginEl) loginEl.setAttribute('aria-hidden', 'true');
    appEl?.removeAttribute('hidden');
    if (appEl) appEl.removeAttribute('aria-hidden');
    document.dispatchEvent(new CustomEvent('portfolio-admin-authenticated'));
  }

  async function getExpectedPassword() {
    try {
      const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`);
      if (res.ok) {
        const cfg = await res.json();
        if (typeof cfg.password === 'string' && cfg.password.length > 0) {
          return cfg.password;
        }
      }
    } catch (_) {}
    return FALLBACK_PASSWORD;
  }

  async function handleLogin(e) {
    e.preventDefault();
    const expected = await getExpectedPassword();
    const entered = passwordInput?.value ?? '';
    if (entered === expected) {
      setAuthenticated();
      passwordInput.value = '';
      if (errorEl) errorEl.textContent = '';
      showApp();
    } else {
      if (errorEl) errorEl.textContent = 'Helytelen jelszó.';
      passwordInput?.focus();
    }
  }

  function init() {
    lockUi();
    if (isAuthenticated()) {
      showApp();
      return;
    }
    form?.addEventListener('submit', handleLogin);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
