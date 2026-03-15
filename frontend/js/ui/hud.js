/**
 * HUD Module — everything you see on screen during a match
 * Health bar, timer, kill feed, score, damage numbers, match end
 */

const HUD = (() => {
  let hitMarkerTimer = null;
  let timerInterval  = null;

  // ── HEALTH BAR ────────────────────────────────────────────────────────────

  function updateHealth(hp) {
    const fill = document.getElementById('hud-health-fill');
    const text = document.getElementById('hud-hp-text');
    const pct  = Math.max(0, hp);
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = pct;
    if (!fill) return;
    if (pct > 50)      fill.style.background = 'linear-gradient(90deg, var(--green), var(--cyan))';
    else if (pct > 25) fill.style.background = 'linear-gradient(90deg, var(--yellow), var(--orange))';
    else               fill.style.background = 'linear-gradient(90deg, var(--red), #ff6600)';
  }

  // ── WEAPON DISPLAY ────────────────────────────────────────────────────────

  function updateWeapon(weapon) {
    const icon = document.getElementById('hud-weapon-icon');
    const name = document.getElementById('hud-weapon-name');
    if (icon) icon.textContent = weapon === 'gun' ? '🔫' : '⚔';
    if (name) name.textContent = weapon === 'gun' ? 'PULSE GUN [1/Q]' : 'NANO BLADE [2/E]';
  }

  // ── SCORE ─────────────────────────────────────────────────────────────────

  function setTeamNames(team1, team2, color1, color2) {
    const t1 = document.getElementById('t1-name');
    const t2 = document.getElementById('t2-name');
    if (t1) { t1.textContent = team1 || 'TEAM 1'; if (color1) t1.style.color = color1; }
    if (t2) { t2.textContent = team2 || 'TEAM 2'; if (color2) t2.style.color = color2; }
  }

  function updateScore(kills) {
    if (!kills) return;
    const t1k = document.getElementById('t1-kills');
    const t2k = document.getElementById('t2-kills');
    if (t1k) t1k.textContent = kills.team1 || 0;
    if (t2k) t2k.textContent = kills.team2 || 0;
  }

  // ── MATCH TIMER (top left) ────────────────────────────────────────────────

  function startTimer(seconds) {
    let remaining = seconds;
    const el = document.getElementById('hud-timer');
    if (!el) return;
    // Clear any old timer
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el.textContent = m + ':' + (s < 10 ? '0' + s : s);
      // Go red in last 30 seconds
      if (remaining <= 30) el.style.color = 'var(--red)';
      else                 el.style.color = 'var(--cyan)';
      if (remaining <= 0) clearInterval(timerInterval);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const el = document.getElementById('hud-timer');
    if (el) el.textContent = '0:00';
  }

  // ── KILL FEED ─────────────────────────────────────────────────────────────

  function addKillFeedEntry(killer, victim) {
    const feed = document.getElementById('kill-feed');
    if (!feed) return;
    const div = document.createElement('div');
    div.className = 'kill-entry';
    div.innerHTML =
      '<span style="color:var(--cyan)">' + killer + '</span>' +
      ' <span style="color:var(--text-dim)">⚡</span> ' +
      '<span style="color:var(--red)">' + victim + '</span>';
    feed.appendChild(div);
    setTimeout(() => div.remove(), 4000);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
  }

  // ── HIT MARKER (crosshair flash) ─────────────────────────────────────────

  function showHitMarker() {
    const ch = document.getElementById('crosshair');
    if (!ch) return;
    ch.style.filter = 'brightness(3)';
    clearTimeout(hitMarkerTimer);
    hitMarkerTimer = setTimeout(() => { ch.style.filter = ''; }, 150);
  }

  // ── FLOATING DAMAGE NUMBERS ───────────────────────────────────────────────

  function showDamage(damage, hp) {
    const container = document.getElementById('damage-numbers');
    if (!container) return;
    const el = document.createElement('div');
    el.className   = 'dmg-num';
    el.textContent = '-' + damage;
    el.style.left  = (45 + Math.random() * 10) + '%';
    el.style.top   = (40 + Math.random() * 10) + '%';
    container.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // ── DEATH SCREEN ──────────────────────────────────────────────────────────

  function showDeathScreen() {
    const el = document.getElementById('hit-indicator');
    if (!el) return;
    el.classList.remove('hidden');
    el.style.background = 'rgba(0,0,0,0.75)';
    el.style.animation  = 'none';
    const msg = document.createElement('div');
    msg.id = 'respawn-msg';
    msg.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'font-family:var(--font-head);font-size:2rem;color:var(--red);' +
      'text-shadow:var(--glow-red);text-align:center;';
    msg.innerHTML = 'YOU DIED<br><span style="font-size:1rem;color:var(--text-dim)">Respawning in 3s...</span>';
    el.appendChild(msg);
  }

  function hideDeathScreen() {
    const el  = document.getElementById('hit-indicator');
    const msg = document.getElementById('respawn-msg');
    if (msg) msg.remove();
    if (el)  { el.classList.add('hidden'); el.style.background = ''; }
  }

  // ── MATCH END OVERLAY ─────────────────────────────────────────────────────

  function showMatchEnd(won, winnerClanName, kills) {
    const overlay = document.getElementById('match-end');
    const title   = document.getElementById('match-end-title');
    const details = document.getElementById('match-end-details');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    title.className   = 'match-end-title ' + (won ? 'victory' : 'defeat');
    title.textContent = won ? '⚡ VICTORY' : '💀 DEFEAT';
    details.innerHTML =
      '<p style="font-family:var(--font-head);font-size:0.8rem;color:var(--text-dim);margin-bottom:0.5rem">' +
      'WINNER: <span style="color:var(--cyan)">' + winnerClanName + '</span></p>' +
      '<p style="font-size:0.9rem">Score: <span class="neon-cyan">' + (kills?.team1 || 0) + '</span>' +
      '<span style="color:var(--text-dim)"> vs </span>' +
      '<span class="neon-red">' + (kills?.team2 || 0) + '</span></p>';
    if (won) Audio.playVictory();
    else     Audio.playDefeat();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  return {
    updateHealth, updateWeapon,
    setTeamNames, updateScore,
    startTimer,   stopTimer,
    addKillFeedEntry, showHitMarker,
    showDamage, showDeathScreen, hideDeathScreen,
    showMatchEnd
  };
})();
