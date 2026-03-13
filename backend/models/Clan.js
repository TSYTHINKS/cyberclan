/**
 * Clan Model - stores clan data, members, gems, reputation
 */
const mongoose = require('mongoose');

const clanSchema = new mongoose.Schema({
  name:       { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 24 },
  tag:        { type: String, required: true, unique: true, uppercase: true, minlength: 2, maxlength: 5 },
  description:{ type: String, default: '', maxlength: 200 },
  leader:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  gems:       { type: Number, default: 0 },
  reputation: { type: Number, default: 0 },
  wins:       { type: Number, default: 0 },
  losses:     { type: Number, default: 0 },
  color:      { type: String, default: '#00ffff' }, // clan color (neon)
  createdAt:  { type: Date, default: Date.now }
});

// Virtual: win rate
clanSchema.virtual('winRate').get(function () {
  const total = this.wins + this.losses;
  return total === 0 ? 0 : Math.round((this.wins / total) * 100);
});

module.exports = mongoose.model('Clan', clanSchema);
