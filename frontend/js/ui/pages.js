/**
 * Pages Module — Handles page routing and page-specific logic
 */

/** Global page switcher */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  // Trigger page-specific logic
  if (name === 'dashboard')  Pages.refreshDashboard();
  if (name === 'leaderboard') Pages.refreshLeaderboard();
  if (name === 'join-clan')   Pages.loadClanList();
  if (name === 'lobby')       Pages.refreshLobby();
}

const Pages = (() => {

  // ─── Dashboard ──────────────────────────────────────────────────────────
  async function refreshDashboard() {
    const user = Auth.getUser();
    if (!user) return;

    // Update nav usernames across pages
    document.querySelectorAll('[id^="nav-username"]').forEach(el => {
      el.textContent = user.username;
    });

    document.getElementById('dash-username').textContent = user.username;
    document.getElementById('dash-kills').textContent = user.kills || 0;
    document.getElementById('dash-deaths').textContent = user.deaths || 0;
    const kd = user.deaths > 0 ? (user.kills / user.deaths).toFixed(2) : (user.kills || 0).toFixed(2);
    document.getElementById('dash-kd').textContent = kd;

    if (user.clan) {
      document.getElementById('no-clan-msg').classList.add('hidden');
      document.getElementById('clan-info').classList.remove('hidden');
      document.getElementById('dash-clan-name').textContent = user.clan.name;
      document.getElementById('dash-clan-tag').textContent  = `[${user.clan.tag}]`;
      document.getElementById('dash-clan-gems').textContent = user.clan.gems || 0;
      document.getElementById('dash-clan-rep').textContent  = user.clan.reputation || 0;
      document.getElementById('dash-clan-wl').textContent   = `${user.clan.wins || 0}/${user.clan.losses || 0}`;
      const badge = document.getElementById('clan-badge-display');
      badge.textContent = user.clan.tag;
      badge.style.borderColor = user.clan.color || 'var(--cyan)';
      badge.style.color = user.clan.color || 'var(--cyan)';
      badge.style.boxShadow = `0 0 10px ${user.clan.color || 'var(--cyan)'}`;
    } else {
      document.getElementById('no-clan-msg').classList.remove('hidden');
      document.getElementById('clan-info').classList.add('hidden');
    }

    // Load recent matches
    try {
      const matches = await API.recentMatches();
      const el = document.getElementById('recent-matches-list');
      if (!matches.length) { el.innerHTML = '<p class="dim-text">No battles recorded yet.</p>'; return; }
      el.innerHTML = matches.map(m => `
        <div class="match-item">
          <span class="match-winner">${m.winnerClan?.name || '?'} [WIN]</span>
          <span class="match-score">${m.kills?.team1 || 0} vs ${m.kills?.team2 || 0}</span>
          <span class="match-loser">${m.loserClan?.name || '?'}</span>
        </div>`).join('');
    } catch { /* silently fail */ }
  }

  // ─── Leaderboard ────────────────────────────────────────────────────────
  async function refreshLeaderboard() {
    const el = document.getElementById('leaderboard-list');
    el.innerHTML = '<p class="dim-text" style="padding:1rem">Loading...</p>';
    try {
      const clans = await API.leaderboard();
      el.innerHTML = clans.map(c => `
        <div class="lb-row rank-${c.rank}">
          <span class="lb-rank neon-cyan">#${c.rank}</span>
          <span class="lb-clan-name">
            <span class="clan-tag-badge" style="color:${c.color};border-color:${c.color};background:${c.color}1a">${c.tag}</span>
            ${c.name}
          </span>
          <span class="neon-cyan">${c.gems}</span>
          <span class="neon-green">${c.reputation}</span>
          <span>${c.wins}</span>
          <span class="neon-red">${c.losses}</span>
          <span class="neon-yellow">${c.winRate}%</span>
        </div>`).join('') || '<p class="dim-text" style="padding:1rem">No clans yet.</p>';
    } catch (err) {
      el.innerHTML = `<p style="color:var(--red);padding:1rem">${err.message}</p>`;
    }
  }

  // ─── Clan List ───────────────────────────────────────────────────────────
  async function loadClanList(search = '') {
    const el = document.getElementById('clan-list');
    el.innerHTML = '<p class="dim-text">Searching...</p>';
    try {
      const clans = await API.listClans(search);
      el.innerHTML = clans.map(c => `
        <div class="clan-item">
          <div class="clan-item-left">
            <div class="clan-tag-badge" style="color:${c.color};border-color:${c.color};background:${c.color}1a">${c.tag}</div>
            <div>
              <div class="clan-item-name">${c.name}</div>
              <div class="clan-item-stats">👥 ${c.members?.length || 0}/20 · 💎 ${c.gems || 0} gems · ⚡ ${c.reputation || 0} rep</div>
            </div>
          </div>
          <button class="cyber-btn secondary" onclick="Pages.joinClan('${c._id}')">JOIN</button>
        </div>`).join('') || '<p class="dim-text">No clans found.</p>';
    } catch (err) {
      el.innerHTML = `<p style="color:var(--red)">${err.message}</p>`;
    }
  }

  async function joinClan(clanId) {
    try {
      const { clan } = await API.joinClan(clanId);
      const user = Auth.getUser();
      user.clan = clan;
      showPage('dashboard');
    } catch (err) {
      alert('Could not join clan: ' + err.message);
    }
  }

  // ─── Lobby ───────────────────────────────────────────────────────────────
  function refreshLobby() {
    const user = Auth.getUser();
    if (!user) return;
    if (!user.clan) {
      document.getElementById('lobby-status').innerHTML =
        '<p style="color:var(--red);font-size:0.85rem">⚠ You need a clan to battle!</p>';
      document.getElementById('btn-find-match').disabled = true;
    } else {
      document.getElementById('lobby-status').innerHTML =
        `<p class="dim-text">Clan: <span class="neon-cyan">${user.clan.name}</span></p>`;
      document.getElementById('btn-find-match').disabled = false;
    }
  }

  // Setup clan search
  document.getElementById('btn-search-clans').addEventListener('click', () => {
    const q = document.getElementById('clan-search').value.trim();
    loadClanList(q);
  });
  document.getElementById('clan-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-search-clans').click();
  });

  // Create clan form
  document.getElementById('btn-create-clan').addEventListener('click', async () => {
    const name  = document.getElementById('clan-name').value.trim();
    const tag   = document.getElementById('clan-tag').value.trim();
    const desc  = document.getElementById('clan-desc').value.trim();
    const color = document.getElementById('clan-color').value;
    const errEl = document.getElementById('create-clan-error');
    errEl.classList.add('hidden');

    if (!name || !tag) { errEl.textContent = 'Name and tag required'; errEl.classList.remove('hidden'); return; }
    try {
      const clan = await API.createClan({ name, tag, description: desc, color });
      const user = Auth.getUser();
      user.clan = clan;
      showPage('dashboard');
    } catch (err) {
      errEl.textContent = err.message; errEl.classList.remove('hidden');
    }
  });

  return { refreshDashboard, refreshLeaderboard, loadClanList, joinClan, refreshLobby };
})();

/** Global leave clan */
async function leaveClan() {
  if (!confirm('Leave your clan?')) return;
  try {
    await API.leaveClan();
    const user = Auth.getUser();
    user.clan = null;
    Pages.refreshDashboard();
  } catch (err) {
    alert('Could not leave clan: ' + err.message);
  }
}
