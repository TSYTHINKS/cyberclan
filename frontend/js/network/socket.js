/**
 * Network Module — Socket.IO client
 * Handles all real-time events between browser and server
 */

const Network = (() => {
  let socket    = null;
  let connected = false;

  function connect() {
    if (connected) return;
    const token = localStorage.getItem('cc_token');
    socket = io({ auth: { token } });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      connected = true;
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      connected = false;
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket error:', err.message);
    });

    // ── MATCHMAKING ─────────────────────────────────────────────────────────

    socket.on('matchmakingJoined', ({ position }) => {
      const el = document.getElementById('lobby-status');
      if (el) el.innerHTML = '<p class="neon-cyan">Searching for opponent... (queue: ' + position + ')</p>';
    });

    socket.on('matchmakingError', ({ message }) => {
      const el = document.getElementById('lobby-status');
      if (el) el.innerHTML = '<p style="color:var(--red)">' + message + '</p>';
      const btnFind   = document.getElementById('btn-find-match');
      const btnCancel = document.getElementById('btn-cancel-match');
      if (btnFind)   btnFind.classList.remove('hidden');
      if (btnCancel) btnCancel.classList.add('hidden');
    });

    // Server found a match — go to arena
    socket.on('matchFound', (data) => {
      console.log('Match found!', data);
      window.currentMatch = data;
      showPage('arena');
      GameEngine.startMatch(data);
    });

    // Host forced everyone to join — auto enter matchmaking
    socket.on('forcedMatchStart', () => {
      const user = Auth.getUser();
      if (!user || !user.clan) return;
      Network.joinMatchmaking();
      showPage('arena');
      const waitingOverlay = document.getElementById('waiting-overlay');
      if (waitingOverlay) waitingOverlay.classList.remove('hidden');
    });

    // Challenge received from another clan
    socket.on('challengeReceived', ({ fromClanId, fromClanName }) => {
      const accepted = confirm(fromClanName + ' is challenging your clan to battle! Accept?');
      socket.emit('respondChallenge', { fromClanId, accepted });
    });

    socket.on('challengeAccepted', ({ byClanName }) => {
      alert(byClanName + ' accepted your challenge! Entering matchmaking...');
    });

    socket.on('challengeDeclined', ({ byClanName }) => {
      alert(byClanName + ' declined your challenge.');
    });

    // ── MULTIPLAYER SYNC ────────────────────────────────────────────────────

    socket.on('playerMoved', (data) => { GameEngine.onRemotePlayerMove(data); });
    socket.on('playerLeft',  (data) => { GameEngine.onPlayerLeft(data.id); });

    socket.on('bulletFired', (data) => { Effects.createBulletTrail(data); });
    socket.on('swordSwung',  (data) => { Effects.createSwordArc(data); });

    // Someone else got hit — show hit marker for shooter
    socket.on('playerHit', () => { HUD.showHitMarker(); });

    // YOU got hit — update your health bar only, don't freeze yet
    socket.on('damaged', (data) => {
      HUD.updateHealth(data.hp);
      HUD.showDamage(data.damage, data.hp);
      Effects.showHitFlash();
      Audio.playDamage();
    });

    // A player died
    socket.on('playerDied', (data) => {
      HUD.addKillFeedEntry(data.killerUsername, data.victimUsername);
      HUD.updateScore(data.teamKills);

      if (data.victimId === socket.id) {
        // YOU died — explode into pieces, freeze, then respawn after 3 seconds
        Effects.deathExplosion(
          Player.getPosition(),
          0xff2244,
          GameEngine.getScene()
        );
        Player.setHP(0);       // freeze movement
        HUD.showDeathScreen();
        setTimeout(() => { socket.emit('requestRespawn'); }, 3000);
      }
    });

    socket.on('respawned', (data) => {
      Player.respawn(data.spawnPoint);
      HUD.hideDeathScreen();
    });

    socket.on('playerRespawned', (data) => {
      GameEngine.onRemotePlayerRespawn(data);
    });

    // Match ended (time ran out)
    socket.on('matchEnded', (data) => {
      const myTeam = window.currentMatch?.team;
      const won    = data.winnerTeam === myTeam;
      HUD.stopTimer();
      HUD.showMatchEnd(won, data.winnerClanName, data.kills);
    });

    // Online/offline status of clan members
    socket.on('memberStatusChange', (data) => {
      Pages.updateMemberStatus(data.userId, data.status);
    });
  }

  function disconnect() { if (socket) socket.disconnect(); }

  function sendMove(position, rotationY, animation) {
    if (!socket) return;
    socket.emit('playerMove', { position, rotation: { y: rotationY }, animation });
  }

  function sendShoot(origin, direction) {
    if (!socket) return;
    socket.emit('shoot', { origin, direction, weapon: 'gun' });
  }

  function sendSwordSwing(position, direction) {
    if (!socket) return;
    socket.emit('swordSwing', { position, direction });
  }

  function sendHit(targetId, damage, weapon) {
    if (!socket) return;
    socket.emit('hitPlayer', { targetId, damage, weapon });
  }

  function joinMatchmaking() {
    if (!socket) connect();
    socket.emit('joinMatchmaking');
  }

  function leaveMatchmaking() {
    if (!socket) return;
    socket.emit('leaveMatchmaking');
  }

  function challengeClan(targetClanId) {
    if (!socket) return;
    socket.emit('challengeClan', { targetClanId });
  }

  function hostStartBattle() {
    if (!socket) connect();
    socket.emit('hostStartBattle');
  }

  function getSocketId() { return socket?.id; }

  return {
    connect, disconnect,
    sendMove, sendShoot, sendSwordSwing, sendHit,
    joinMatchmaking, leaveMatchmaking,
    challengeClan, hostStartBattle,
    getSocketId
  };
})();
