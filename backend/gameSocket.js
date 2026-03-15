/**
 * CyberClan - Game Socket Handler
 * Manages real-time multiplayer: movement, combat, matchmaking,
 * clan battles, challenges, online status, timed matches
 */

const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Clan = require('./models/Clan');
const Match = require('./models/Match');

const gameRooms = new Map();
const matchmakingQueue = [];

function initGameSockets(io) {

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
    console.log('🎮 Player connected: ' + socket.user.username);

    socket.join('user_' + socket.user._id);
    if (socket.user.clan) socket.join('clan_' + socket.user.clan._id);

    io.emit('memberStatusChange', {
      userId: socket.user._id,
      username: socket.user.username,
      status: 'online'
    });

    socket.on('joinMatchmaking', async () => {
      const clanId = socket.user.clan?._id?.toString();
      if (!clanId) {
        socket.emit('matchmakingError', { message: 'You must be in a clan to battle' });
        return;
      }
      const clan = await Clan.findById(clanId);
      const clanColor = clan?.color || '#00ffff';
      const queueEntry = {
        socketId: socket.id,
        userId: socket.user._id.toString(),
        clanId,
        clanName: socket.user.clan.name,
        clanColor,
        username: socket.user.username,
        socket
      };
      matchmakingQueue.push(queueEntry);
      socket.emit('matchmakingJoined', { position: matchmakingQueue.length });
      tryMatchPlayers(io);
    });

    socket.on('leaveMatchmaking', () => {
      const idx = matchmakingQueue.findIndex(e => e.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);
      socket.emit('matchmakingLeft');
    });

    socket.on('hostStartBattle', async () => {
      const clan = await Clan.findById(socket.user.clan?._id).populate('members');
      if (!clan) return;
      if (clan.leader.toString() !== socket.user._id.toString()) {
        socket.emit('error', { message: 'Only the clan leader can start a battle' });
        return;
      }
      clan.members.forEach(member => {
        io.to('user_' + member._id).emit('forcedMatchStart');
      });
    });

    socket.on('challengeClan', async ({ targetClanId }) => {
      const myClan = await Clan.findById(socket.user.clan?._id);
      if (!myClan) return;
      if (myClan.leader.toString() !== socket.user._id.toString()) return;
      io.to('clan_' + targetClanId).emit('challengeReceived', {
        fromClanId: myClan._id,
        fromClanName: myClan.name
      });
    });

    socket.on('respondChallenge', async ({ fromClanId, accepted }) => {
      if (accepted) {
        const myClan = await Clan.findById(socket.user.clan?._id).populate('members');
        if (!myClan) return;
        myClan.members.forEach(member => {
          io.to('user_' + member._id).emit('forcedMatchStart');
        });
        const fromClan = await Clan.findById(fromClanId).populate('members');
        if (!fromClan) return;
        fromClan.members.forEach(member => {
          io.to('user_' + member._id).emit('forcedMatchStart');
        });
        io.to('clan_' + fromClanId).emit('challengeAccepted', { byClanName: myClan.name });
      } else {
        io.to('clan_' + fromClanId).emit('challengeDeclined', { byClanName: socket.user.clan?.name });
      }
    });

    socket.on('playerMove', (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = gameRooms.get(roomId);
      const playerData = room?.players.get(socket.id);
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        username: socket.user.username,
        team: playerData?.team || 'team2',
        clanColor: playerData?.clanColor || '#ff4400',
        ...data
      });
    });

    socket.on('shoot', (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('bulletFired', {
        id: socket.id + '_' + Date.now(),
        shooterId: socket.id,
        ...data
      });
    });

    socket.on('swordSwing', (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('swordSwung', {
        id: socket.id,
        username: socket.user.username,
        ...data
      });
    });

    socket.on('hitPlayer', async (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      const room = gameRooms.get(roomId);
      if (!room) return;
      const target = room.players.get(data.targetId);
      const attacker = room.players.get(socket.id);
      if (!target || !attacker) return;
      if (target.team === attacker.team) return;
      if (target.dead) return;
      target.hp = Math.max(0, (target.hp || 100) - data.damage);
      io.to(data.targetId).emit('damaged', {
        hp: target.hp,
        damage: data.damage,
        attackerId: socket.id
      });
      socket.to(roomId).emit('playerHit', {
        targetId: data.targetId,
        damage: data.damage,
        weapon: data.weapon,
        hp: target.hp
      });
      if (target.hp <= 0) {
        await handlePlayerDeath(io, roomId, socket.id, data.targetId, room);
      }
    });

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

    socket.on('disconnect', () => {
      console.log('👋 Player disconnected: ' + socket.user.username);
      io.emit('memberStatusChange', {
        userId: socket.user._id,
        username: socket.user.username,
        status: 'offline'
      });
      const idx = matchmakingQueue.findIndex(e => e.socketId === socket.id);
      if (idx !== -1) matchmakingQueue.splice(idx, 1);
      if (socket.roomId) {
        const room = gameRooms.get(socket.roomId);
        if (room) {
          room.players.delete(socket.id);
          socket.to(socket.roomId).emit('playerLeft', { id: socket.id });
          if (room.players.size === 0) {
            if (room.matchTimer) clearTimeout(room.matchTimer);
            gameRooms.delete(socket.roomId);
          }
        }
      }
    });

  });
}

function tryMatchPlayers(io) {
  if (matchmakingQueue.length < 2) return;
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
  matchmakingQueue.splice(Math.max(p1.index, p2.index), 1);
  matchmakingQueue.splice(Math.min(p1.index, p2.index), 1);

  const roomId = 'room_' + Date.now();
  gameRooms.set(roomId, {
    players: new Map(),
    team1ClanId: p1.clanId,
    team2ClanId: p2.clanId,
    team1ClanName: p1.clanName,
    team2ClanName: p2.clanName,
    team1Color: p1.clanColor,
    team2Color: p2.clanColor,
    kills: { team1: 0, team2: 0 },
    state: 'active',
    startTime: Date.now(),
    matchTimer: null
  });

  const room = gameRooms.get(roomId);

  [p1, p2].forEach((p, idx) => {
    const team = idx === 0 ? 'team1' : 'team2';
    const clanColor = idx === 0 ? p1.clanColor : p2.clanColor;
    const spawnPoint = getSpawnPoint(team);
    room.players.set(p.socketId, {
      userId: p.userId,
      username: p.username,
      clanId: p.clanId,
      clanColor,
      team,
      hp: 100,
      dead: false,
      kills: 0,
      deaths: 0
    });
    p.socket.roomId = roomId;
    p.socket.join(roomId);
    p.socket.emit('matchFound', {
      roomId,
      team,
      spawnPoint,
      myClanName: p.clanName,
      myClanColor: clanColor,
      oppClanName: idx === 0 ? p2.clanName : p1.clanName,
      oppClanColor: idx === 0 ? p2.clanColor : p1.clanColor,
      team1Clan: p1.clanName,
      team2Clan: p2.clanName,
      team1Color: p1.clanColor,
      team2Color: p2.clanColor
    });
  });

  console.log('Match: ' + p1.clanName + ' vs ' + p2.clanName);

  // 5 MINUTE TIMER
  room.matchTimer = setTimeout(async () => {
    if (room.state !== 'active') return;
    room.state = 'ended';
    const t1 = room.kills.team1 || 0;
    const t2 = room.kills.team2 || 0;
    const winnerTeam = t1 >= t2 ? 'team1' : 'team2';
    const winnerClanId = winnerTeam === 'team1' ? room.team1ClanId : room.team2ClanId;
    const loserClanId = winnerTeam === 'team1' ? room.team2ClanId : room.team1ClanId;
    const winnerClanName = winnerTeam === 'team1' ? room.team1ClanName : room.team2ClanName;
    io.to(roomId).emit('matchEnded', {
      winnerTeam,
      winnerClanName,
      kills: room.kills,
      reason: 'time'
    });
    await Clan.findByIdAndUpdate(winnerClanId, { $inc: { gems: 50, wins: 1, reputation: 100 } });
    await Clan.findByIdAndUpdate(loserClanId, { $inc: { losses: 1 } });
    await Match.create({
      winnerClan: winnerClanId,
      loserClan: loserClanId,
      kills: room.kills,
      duration: Date.now() - room.startTime
    });
    setTimeout(() => gameRooms.delete(roomId), 30000);
  }, 5 * 60 * 1000);
}

async function handlePlayerDeath(io, roomId, killerId, victimId, room) {
  const killer = room.players.get(killerId);
  const victim = room.players.get(victimId);
  if (!killer || !victim) return;
  killer.kills = (killer.kills || 0) + 1;
  victim.deaths = (victim.deaths || 0) + 1;
  victim.dead = true;
  room.kills[killer.team] = (room.kills[killer.team] || 0) + 1;
  io.to(roomId).emit('playerDied', {
    victimId,
    killerId,
    killerUsername: killer.username,
    victimUsername: victim.username,
    teamKills: room.kills
  });
}

function getSpawnPoint(team) {
  return team === 'team1'
    ? { x: -20, y: 2, z: 0 }
    : { x: 20, y: 2, z: 0 };
}

module.exports = { initGameSockets };
