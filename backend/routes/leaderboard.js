/**
 * Leaderboard Routes
 */
const express = require('express');
const router = express.Router();
const Clan = require('../models/Clan');

// Top 20 clans by reputation
router.get('/', async (req, res) => {
  try {
    const clans = await Clan.find()
      .select('name tag color gems reputation wins losses members')
      .sort({ reputation: -1, gems: -1 })
      .limit(20);

    const ranked = clans.map((c, i) => ({
      rank: i + 1,
      name: c.name,
      tag: c.tag,
      color: c.color,
      gems: c.gems,
      reputation: c.reputation,
      wins: c.wins,
      losses: c.losses,
      members: c.members.length,
      winRate: c.wins + c.losses === 0 ? 0 : Math.round((c.wins / (c.wins + c.losses)) * 100)
    }));

    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
