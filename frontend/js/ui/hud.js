/**
 * HUD Module — Heads-Up Display management
 * Health bar, kill feed, score, hit markers, match end overlay
 */

const HUD = (() => {
  let hitMarkerTimer = null;

  // ─── Health ─────────────────────────────────────────────────────────────

  function updateHealth(hp) {
    const fill   = document.getElementById('hud-health-fill');
    const text   = document.getElementById('hud-hp-text');
    const pct    = Math.max(0, hp);
    fill.style.width = `${pct}%`;
    text.textContent = pct;

    // Color shifts: green -> yellow -> red
    if (pct > 50)      fill.style.background = 'linear-gradient(90deg, var(--green), var(--cyan))';
    else if (pct > 25) fill.style.background = 'linear-gradient(90deg, var(--yellow), var(--orange))';
    else               fill.style.background = 'linear-gradient(90deg, var(--red), #ff6600)';
  }

  // ─── Weapon ─────────────────────────────────────────────────────────────

  function updateWeapon(weapon) {
    document.getElementById('hud-weapon-icon').textContent = weapon === 'gun' ? '🔫' : '⚔';
    document.getElementById('hud-weapon-name').textContent = weapon === 'gun' ? 'PULSE GUN' : 'NANO BLADE';
  }

  // ─── Score ──────────────────────────────────────────────────────────────

  function setTeamNames(team1, team2) {
    document.getElementById('t1-name').textContent = team1 || 'TEAM 1';
    document.getElementById('t2-name').textContent = team2 || 'TEAM 2';
  }

  function updateScore(kills) {
    if (!kills) return;
    document.getElementById('t1-kills').textContent = kills.team1 || 0;
    document.getElementById('t2-kills').textContent = kills.team2 || 0;
  }

  // ─── Kill Feed ──────────────────────────────────────────────────────────

  function addKillFeedEntry(killer, victim) {
    const feed = document.getElementById('kill-feed');
    const div  = document.createElement('div');
    div.className = 'kill-entry';
    div.innerHTML = `<span style="color:var(--cyan)">${killer}</span> <span style="color:var(--text-dim)">⚡</span> <span style="color:var(--red)">${victim}</span>`;
    feed.appendChild(div);
    // Auto-remove after 4 seconds
    setTimeout(() => div.remove(), 4000);
    // Keep max 5 entries
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
  }

  // ─── Hit Marker ──────────────────────────────────────────────────────────

  function showHitMarker() {
    const ch = document.getElementById('crosshair');
    ch.style.filter = 'brightness(3) hue-rotate(0deg)';
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => { ch.style.filter = ''; }, 150);
  }

  // ─── Damage ──────────────────────────────────────────────────────────────

  function showDamage(damage, hp) {
    // Floating damage number
    const el  = document.createElement('div');
    el.className = 'dmg-num';
    el.textContent = `-${damage}`;
    // Random position near center-top
    el.style.left = (45 + Math.random() * 10) + '%';
    el.style.top  = (40 + Math.random() * 10) + '%';
    document.getElementById('damage-numbers').appendChild(el);
    setTimeout(() => el.remove(), 1000);

    // Low HP warning pulse
    if (hp <= 30) {
      document.getElementById('hud-health-fill').style.animation = 'none';
      requestAnimationFrame(() => {
        document.getElementById('hud-health-fill').style.animation = 'pulseCyan 0.5s ease-in-out 3';
      });
    }
  }

  // ─── Death / Respawn ──────────────────────────────────────────────────────

  function showDeathScreen() {
    // Simple screen overlay (reuse hit-indicator with stronger effect)
    const el = document.getElementById('hit-indicator');
    el.classList.remove('hidden');
    el.style.background = 'rgba(0,0,0,0.7)';
    el.style.animation = 'none';
    // Add respawn text
    const msg = document.createElement('div');
    msg.id = 'respawn-msg';
    msg.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      font-family:var(--font-head);font-size:2rem;color:var(--red);
      text-shadow:var(--glow-red);text-align:center;
    `;
    msg.innerHTML = 'YOU DIED<br><span style="font-size:1rem;color:var(--text-dim)">Respawning in 3s...</span>';
    el.appendChild(msg);
  }

  function hideDeathScreen() {
    const el  = document.getElementById('hit-indicator');
    const msg = document.getElementById('respawn-msg');
    if (msg) msg.remove();
    el.classList.add('hidden');
    el.style.background = '';
  }

  // ─── Match End ────────────────────────────────────────────────────────────

  function showMatchEnd(won, winnerClanName, kills) {
    const overlay = document.getElementById('match-end');
    const title   = document.getElementById('match-end-title');
    const details = document.getElementById('match-end-details');

    overlay.classList.remove('hidden');
    title.className = 'match-end-title ' + (won ? 'victory' : 'defeat');
    title.textContent = won ? '⚡ VICTORY' : '💀 DEFEAT';

    details.innerHTML = `
      <p style="font-family:var(--font-head);font-size:0.8rem;color:var(--text-dim);margin-bottom:0.5rem">
        WINNER: <span style="color:var(--cyan)">${winnerClanName}</span>
      </p>
      <p style="font-size:0.9rem">
        Score: <span class="neon-cyan">${kills?.team1 || 0}</span>
        <span style="color:var(--text-dim)"> vs </span>
        <span class="neon-red">${kills?.team2 || 0}</span>
      </p>
    `;

    if (won) Audio.playVictory();
    else     Audio.playDefeat();

    // Stop pointer lock
    if (document.pointerLockElement) document.exitPointerLock();
  }

  return {
    updateHealth, updateWeapon,
    setTeamNames, updateScore,
    addKillFeedEntry, showHitMarker,
    showDamage, showDeathScreen, hideDeathScreen,
    showMatchEnd
  };
})();
