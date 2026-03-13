/**
 * Match Model - records game history
 */
const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  winnerClan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
  loserClan:  { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
  kills:      { team1: Number, team2: Number },
  duration:   { type: Number }, // milliseconds
  playedAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
