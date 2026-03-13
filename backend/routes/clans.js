/**
 * Clan Routes - Create, Join, Leave, Info
 */
const express = require('express');
const router = express.Router();
const Clan = require('../models/Clan');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// ─── Create Clan ──────────────────────────────────────────────────────────
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, tag, description, color } = req.body;
    if (!name || !tag) return res.status(400).json({ error: 'Name and tag required' });

    const user = await User.findById(req.userId);
    if (user.clan) return res.status(400).json({ error: 'You are already in a clan' });

    const existing = await Clan.findOne({ $or: [{ name }, { tag: tag.toUpperCase() }] });
    if (existing) return res.status(400).json({ error: 'Clan name or tag already taken' });

    const clan = await Clan.create({
      name, tag: tag.toUpperCase(), description, color: color || '#00ffff',
      leader: req.userId, members: [req.userId]
    });

    user.clan = clan._id;
    await user.save();

    res.status(201).json(clan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Join Clan ────────────────────────────────────────────────────────────
router.post('/join/:clanId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (user.clan) return res.status(400).json({ error: 'Leave your current clan first' });

    const clan = await Clan.findById(req.params.clanId);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    if (clan.members.length >= 20) return res.status(400).json({ error: 'Clan is full (max 20)' });

    clan.members.push(req.userId);
    await clan.save();
    user.clan = clan._id;
    await user.save();

    res.json({ message: `Joined clan ${clan.name}`, clan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Leave Clan ───────────────────────────────────────────────────────────
router.post('/leave', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user.clan) return res.status(400).json({ error: 'You are not in a clan' });

    const clan = await Clan.findById(user.clan);
    if (!clan) return res.status(404).json({ error: 'Clan not found' });

    if (clan.leader.toString() === req.userId) {
      // Leader leaves: transfer or disband
      if (clan.members.length > 1) {
        const newLeader = clan.members.find(m => m.toString() !== req.userId);
        clan.leader = newLeader;
      } else {
        // Disband clan
        await Clan.findByIdAndDelete(clan._id);
        user.clan = null;
        await user.save();
        return res.json({ message: 'Clan disbanded (you were the last member)' });
      }
    }

    clan.members = clan.members.filter(m => m.toString() !== req.userId);
    await clan.save();
    user.clan = null;
    await user.save();

    res.json({ message: 'Left clan successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── List Clans (for join page) ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { tag: new RegExp(search, 'i') }] }
      : {};
    const clans = await Clan.find(query)
      .select('name tag description color gems reputation wins losses members')
      .sort({ reputation: -1 })
      .limit(20);
    res.json(clans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Single Clan ─────────────────────────────────────────────────────
router.get('/:clanId', async (req, res) => {
  try {
    const clan = await Clan.findById(req.params.clanId)
      .populate('members', 'username kills deaths')
      .populate('leader', 'username');
    if (!clan) return res.status(404).json({ error: 'Clan not found' });
    res.json(clan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
