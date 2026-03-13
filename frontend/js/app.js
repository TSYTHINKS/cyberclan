/**
 * App.js — Entry point
 * Bootstraps the application, checks auth, routes to correct page
 */

(async function bootstrap() {
  // Initialize the 3D engine upfront (canvas is always present)
  GameEngine.init();

  // Connect socket early (will need auth token)
  // We connect lazily when user tries to matchmake instead

  // Check if user has a saved session
  const loggedIn = await Auth.loadSession();

  if (loggedIn) {
    showPage('dashboard');
  } else {
    showPage('auth');
  }

  // ─── Lobby: Find Match button ─────────────────────────────────────────
  document.getElementById('btn-find-match').addEventListener('click', () => {
    const user = Auth.getUser();
    if (!user?.clan) {
      document.getElementById('lobby-status').innerHTML =
        '<p style="color:var(--red)">You need a clan to battle!</p>';
      return;
    }

    // Connect socket if not yet connected
    Network.connect();

    // Show arena page with waiting overlay
    showPage('arena');
    document.getElementById('waiting-overlay').classList.remove('hidden');

    // Join matchmaking queue
    Network.joinMatchmaking();

    document.getElementById('btn-find-match').classList.add('hidden');
    document.getElementById('btn-cancel-match').classList.remove('hidden');
  });

  document.getElementById('btn-cancel-match').addEventListener('click', () => {
    cancelMatchmaking();
  });

  // ─── ESC: toggle pointer lock ─────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && GameEngine.isRunning()) {
      if (document.pointerLockElement) document.exitPointerLock();
    }
  });

  console.log('🚀 CyberClan initialized');
})();
