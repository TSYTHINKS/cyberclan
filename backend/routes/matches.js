/**
 * Match History Routes
 */
const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

router.get('/recent', async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('winnerClan', 'name tag color')
      .populate('loserClan', 'name tag color')
      .sort({ playedAt: -1 })
      .limit(10);
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
