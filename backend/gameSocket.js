/**
 * CyberClan - Game Socket Handler
 * Manages real-time multiplayer: movement, combat, matchmaking
 */

const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Clan = require('./models/Clan');
const Match = require('./models/Match');

// Active game rooms: { roomId: { players: Map, team1: [], team2: [], state: 'waiting'|'active'|'ended' } }
const gameRooms = new Map();

// Matchmaking queue: { socketId, userId, clanId, username }
const matchmakingQueue = [];

/**
 * Initialize all Socket.IO event handlers
 * @param {Server} io - Socket.IO server instance
 */
function initGameSockets(io) {
  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cyberclan_secret');
      const user = await User.findById(decoded.userId).populate('clan');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🎮 Player connected: ${socket.user.username}`);

    // ─── Matchmaking ─────────────────────────────────────────────────────────

    socket.on('joinMatchmaking', async () => {
      const clanId = socket.user.clan?._id?.toString();
      if (!clanId) {
        socket.emit('matchmakingError', { message: 'You must be in a clan to battle' });
        return;
      }

      // Add to queue
      const queueEntry = {
        socketId: socket.id,
        userId: socket.user._id.toString(),
        clanId,
        clanName: socket.user.clan.name,
        username: socket.user.username,
        socket
      };
      matchmakingQueue.push(queueEntry);
      socket.emit('matchmakingJoined', { position: matchmakingQueue.length });

      // Try to match two different clans
      tryMatchPlayers(io);
    });

    socket.on('leaveMatchmaking', () => {
      const idx = matchmakingQueue.findIndex(e => e.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);
      socket.emit('matchmakingLeft');
    });

    // ─── Player Movement Sync ─────────────────────────────────────────────────

  socket.on('playerMove', (data) => {
  // data: { position: {x,y,z}, rotation: {y}, animation: 'idle'|'walk'|'sprint'|'jump' }
  const roomId = socket.roomId;
  if (!roomId) return;
  const room = gameRooms.get(roomId);
  const playerData = room?.players.get(socket.id);
  // Broadcast to others in same room (not sender)
  socket.to(roomId).emit('playerMoved', {
    id: socket.id,
    username: socket.user.username,
    team: playerData?.team || 'team2',
    ...data
  });
});

    // ─── Combat Events ────────────────────────────────────────────────────────

    socket.on('shoot', (data) => {
      // data: { origin: {x,y,z}, direction: {x,y,z}, weapon: 'gun' }
      const roomId = socket.roomId;
      if (!roomId) return;
      const bulletId = `${socket.id}_${Date.now()}`;
      socket.to(roomId).emit('bulletFired', {
        id: bulletId,
        shooterId: socket.id,
        ...data
      });
    });

    socket.on('swordSwing', (data) => {
      // data: { direction, position }
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('swordSwung', {
        id: socket.id,
        username: socket.user.username,
        ...data
      });
    });

    socket.on('hitPlayer', async (data) => {
      // data: { targetId, damage, weapon }
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = gameRooms.get(roomId);
      if (!room) return;

      const target = room.players.get(data.targetId);
      if (!target) return;

      // Don't hit teammates
      if (target.team === room.players.get(socket.id)?.team) return;

      target.hp = Math.max(0, (target.hp || 100) - data.damage);
      if (target.dead) return;

      // Notify target of damage
      io.to(data.targetId).emit('damaged', {
        hp: target.hp,
        damage: data.damage,
        attackerId: socket.id
      });

      // Broadcast hit to room
      socket.to(roomId).emit('playerHit', {
        targetId: data.targetId,
        damage: data.damage,
        weapon: data.weapon,
        hp: target.hp
      });

      // Check if player died
      if (target.hp <= 0) {
        await handlePlayerDeath(io, roomId, socket.id, data.targetId, room);
      }
    });

    // ─── Respawn ──────────────────────────────────────────────────────────────

    socket.on('requestRespawn', () => {
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = gameRooms.get(roomId);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      player.hp = 100;
      player.dead = false;
      const spawn = getSpawnPoint(player.team);
      socket.emit('respawned', { hp: 100, spawnPoint: spawn });
      socket.to(roomId).emit('playerRespawned', { id: socket.id, spawnPoint: spawn });
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`👋 Player disconnected: ${socket.user.username}`);

      // Remove from matchmaking
      const idx = matchmakingQueue.findIndex(e => e.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);

      // Remove from game room
      if (socket.roomId) {
        const room = gameRooms.get(socket.roomId);
        if (room) {
          room.players.delete(socket.id);
          socket.to(socket.roomId).emit('playerLeft', { id: socket.id });
          // Clean up empty rooms
          if (room.players.size === 0) gameRooms.delete(socket.roomId);
        }
      }
    });
  });
}

/**
 * Try to match two players from different clans
 */
function tryMatchPlayers(io) {
  if (matchmakingQueue.length < 2) return;

  // Find two players from different clans
  let p1 = null, p2 = null;
  for (let i = 0; i < matchmakingQueue.length && !p2; i++) {
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      if (matchmakingQueue[i].clanId !== matchmakingQueue[j].clanId) {
        p1 = { ...matchmakingQueue[i], index: i };
        p2 = { ...matchmakingQueue[j], index: j };
        break;
      }
    }
  }

  if (!p1 || !p2) return;

  // Remove from queue (higher index first)
  matchmakingQueue.splice(Math.max(p1.index, p2.index), 1);
  matchmakingQueue.splice(Math.min(p1.index, p2.index), 1);

  // Create room
  const roomId = `room_${Date.now()}`;
  gameRooms.set(roomId, {
    players: new Map(),
    team1: [p1.userId],
    team2: [p2.userId],
    team1ClanId: p1.clanId,
    team2ClanId: p2.clanId,
    team1ClanName: p1.clanName,
    team2ClanName: p2.clanName,
    kills: { team1: 0, team2: 0 },
    state: 'active',
    startTime: Date.now()
  });

  const room = gameRooms.get(roomId);

  // Add players to room
  [p1, p2].forEach((p, idx) => {
    const team = idx === 0 ? 'team1' : 'team2';
    const spawnPoint = getSpawnPoint(team);
    room.players.set(p.socketId, {
      userId: p.userId,
      username: p.username,
      clanId: p.clanId,
      team,
      hp: 100,
      kills: 0,
      deaths: 0
    });
    p.socket.roomId = roomId;
    p.socket.join(roomId);
    p.socket.emit('matchFound', {
      roomId,
      team,
      opponent: idx === 0 ? p2.username : p1.username,
      opponentClan: idx === 0 ? p2.clanName : p1.clanName,
      spawnPoint,
      team1Clan: p1.clanName,
      team2Clan: p2.clanName
    });
  });

  console.log(`⚔️  Match created: ${p1.clanName} vs ${p2.clanName} in ${roomId}`);
}

/**
 * Handle player death, check win condition
 */
async function handlePlayerDeath(io, roomId, killerId, victimId, room) {
  const killer = room.players.get(killerId);
  const victim = room.players.get(victimId);
  if (!killer || !victim) return;

  killer.kills = (killer.kills || 0) + 1;
  victim.deaths = (victim.deaths || 0) + 1;
  victim.dead = true;

  // Track team kills
  room.kills[killer.team] = (room.kills[killer.team] || 0) + 1;

  io.to(roomId).emit('playerDied', {
    victimId,
    killerId,
    killerUsername: killer.username,
    victimUsername: victim.username,
    teamKills: room.kills
  });

  // Win condition: first to 10 kills
  const WIN_KILLS = 10;
  if (room.kills[killer.team] >= WIN_KILLS && room.state === 'active') {
    room.state = 'ended';
    const winnerClanId = killer.team === 'team1' ? room.team1ClanId : room.team2ClanId;
    const loserClanId = killer.team === 'team1' ? room.team2ClanId : room.team1ClanId;

    io.to(roomId).emit('matchEnded', {
      winnerTeam: killer.team,
      winnerClanName: killer.team === 'team1' ? room.team1ClanName : room.team2ClanName,
      kills: room.kills
    });

    // Award gems to winning clan
    await Clan.findByIdAndUpdate(winnerClanId, {
      $inc: { gems: 50, wins: 1, reputation: 100 }
    });
    await Clan.findByIdAndUpdate(loserClanId, {
      $inc: { losses: 1 }
    });

    // Save match record
    await Match.create({
      winnerClan: winnerClanId,
      loserClan: loserClanId,
      kills: room.kills,
      duration: Date.now() - room.startTime
    });

    // Clean up room after delay
    setTimeout(() => gameRooms.delete(roomId), 30000);
  }
}

/**
 * Get spawn point for a team
 */
function getSpawnPoint(team) {
  return team === 'team1'
    ? { x: -20, y: 2, z: 0 }
    : { x: 20, y: 2, z: 0 };
}

module.exports = { initGameSockets };
