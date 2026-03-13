/**
 * Network Module — Socket.IO client for real-time multiplayer
 * Handles matchmaking, movement sync, and combat events
 */

const Network = (() => {
  let socket = null;
  let connected = false;

  /** Connect to game server with auth token */
  function connect() {
    if (connected) return;
    const token = localStorage.getItem('cc_token');
    socket = io({ auth: { token } });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      connected = true;
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
      connected = false;
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket auth error:', err.message);
    });

    // ─── Matchmaking events ───────────────────────────────────────────────
    socket.on('matchmakingJoined', ({ position }) => {
      document.getElementById('lobby-status').innerHTML =
        `<p class="neon-cyan">Searching for opponent... (queue: ${position})</p>`;
    });

    socket.on('matchmakingError', ({ message }) => {
      document.getElementById('lobby-status').innerHTML =
        `<p style="color:var(--red)">${message}</p>`;
      document.getElementById('btn-find-match').classList.remove('hidden');
      document.getElementById('btn-cancel-match').classList.add('hidden');
    });

    socket.on('matchFound', (data) => {
      console.log('⚔️  Match found!', data);
      // Store match data globally
      window.currentMatch = data;
      // Start the game engine
      showPage('arena');
      GameEngine.startMatch(data);
    });

    // ─── Multiplayer sync events ──────────────────────────────────────────
    socket.on('playerMoved', (data) => { GameEngine.onRemotePlayerMove(data); });
    socket.on('playerLeft',  (data) => { GameEngine.onPlayerLeft(data.id); });

    socket.on('bulletFired', (data) => { Effects.createBulletTrail(data); });
    socket.on('swordSwung',  (data) => { Effects.createSwordArc(data); });

    socket.on('playerHit', (data)  => { HUD.showHitMarker(); });
    socket.on('damaged',   (data)  => {
      Player.setHP(data.hp);
      HUD.showDamage(data.damage, data.hp);
      Effects.showHitFlash();
    });

    socket.on('playerDied', (data) => {
      HUD.addKillFeedEntry(data.killerUsername, data.victimUsername);
      HUD.updateScore(data.teamKills);
      if (data.victimId === socket.id) {
        setTimeout(() => {
          Player.setHP(0);
          HUD.showDeathScreen();
          setTimeout(() => { socket.emit('requestRespawn'); }, 3000);
        }, 100);
      }
    });

    socket.on('respawned', (data) => {
      Player.respawn(data.spawnPoint);
      HUD.hideDeathScreen();
    });

    socket.on('playerRespawned', (data) => {
      GameEngine.onRemotePlayerRespawn(data);
    });

    socket.on('matchEnded', (data) => {
      const user = Auth.getUser();
      const myTeam = window.currentMatch?.team;
      const won = data.winnerTeam === myTeam;
      HUD.showMatchEnd(won, data.winnerClanName, data.kills);
    });
  }

  /** Disconnect socket */
  function disconnect() { if (socket) socket.disconnect(); }

  /** Emit player movement */
  function sendMove(position, rotationY, animation) {
    if (!socket) return;
    socket.emit('playerMove', { position, rotation: { y: rotationY }, animation });
  }

  /** Emit shoot event */
  function sendShoot(origin, direction) {
    if (!socket) return;
    socket.emit('shoot', { origin, direction, weapon: 'gun' });
  }

  /** Emit sword swing */
  function sendSwordSwing(position, direction) {
    if (!socket) return;
    socket.emit('swordSwing', { position, direction });
  }

  /** Emit hit detection */
  function sendHit(targetId, damage, weapon) {
    if (!socket) return;
    socket.emit('hitPlayer', { targetId, damage, weapon });
  }

  /** Join matchmaking queue */
  function joinMatchmaking() {
    if (!socket) connect();
    socket.emit('joinMatchmaking');
  }

  /** Leave matchmaking queue */
  function leaveMatchmaking() {
    if (!socket) return;
    socket.emit('leaveMatchmaking');
  }

  function getSocketId() { return socket?.id; }

  return { connect, disconnect, sendMove, sendShoot, sendSwordSwing, sendHit, joinMatchmaking, leaveMatchmaking, getSocketId };
})();
