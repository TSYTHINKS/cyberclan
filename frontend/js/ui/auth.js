/**
 * Auth Module — Login, Signup, Logout, Session management
 */

const Auth = (() => {
  let currentUser = null;

  /** Check if user is logged in */
  function isLoggedIn() { return !!localStorage.getItem('cc_token'); }

  /** Get current user data */
  function getUser() { return currentUser; }

  /** Set user after login/signup */
  function setUser(userData, token) {
    currentUser = userData;
    if (token) localStorage.setItem('cc_token', token);
  }

  /** Clear session */
  function clearSession() {
    currentUser = null;
    localStorage.removeItem('cc_token');
  }

  /** Load user from API (on page refresh) */
  async function loadSession() {
    if (!isLoggedIn()) return false;
    try {
      const user = await API.me();
      currentUser = user;
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  // ─── Login Handler ─────────────────────────────────────────────────────
  document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('auth-error');
    errEl.classList.add('hidden');

    if (!email || !password) {
      errEl.textContent = 'Please fill all fields'; errEl.classList.remove('hidden'); return;
    }
    try {
      const { token, user } = await API.login(email, password);
      setUser(user, token);
      showPage('dashboard');
      Pages.refreshDashboard();
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.remove('hidden');
    }
  });

  // ─── Signup Handler ────────────────────────────────────────────────────
  document.getElementById('btn-signup').addEventListener('click', async () => {
    const username = document.getElementById('signup-username').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const errEl    = document.getElementById('signup-error');
    errEl.classList.add('hidden');

    if (!username || !email || !password) {
      errEl.textContent = 'Please fill all fields'; errEl.classList.remove('hidden'); return;
    }
    try {
      const { token, user } = await API.signup(username, email, password);
      setUser(user, token);
      showPage('dashboard');
      Pages.refreshDashboard();
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.remove('hidden');
    }
  });

  // ─── Tab switching ─────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  return { isLoggedIn, getUser, setUser, clearSession, loadSession };
})();

/** Global logout */
function logout() {
  Auth.clearSession();
  showPage('auth');
}
