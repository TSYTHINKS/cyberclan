# ⚡ CyberClan — Multiplayer Voxel Clan Battle Game

A browser-based multiplayer game featuring:
- Real-time clan vs clan combat in voxel arenas
- First-person shooter + melee combat
- Socket.IO real-time multiplayer
- Cyberpunk neon UI with glassmorphism
- Clan system with gems, reputation, and global leaderboard

---

## 🗂️ Project Structure

```
cyberclan/
├── backend/
│   ├── server.js          # Express + Socket.IO entry point
│   ├── gameSocket.js      # Real-time game logic (matchmaking, combat, rooms)
│   ├── models/
│   │   ├── User.js        # Player accounts
│   │   ├── Clan.js        # Clan data, gems, reputation
│   │   └── Match.js       # Match history
│   ├── routes/
│   │   ├── auth.js        # Login, signup, profile
│   │   ├── clans.js       # Create, join, leave, list
│   │   ├── leaderboard.js # Global clan ranking
│   │   └── matches.js     # Match history
│   └── middleware/
│       └── auth.js        # JWT middleware
├── frontend/
│   ├── index.html         # SPA entry (all pages)
│   ├── css/
│   │   └── main.css       # Cyberpunk theme
│   └── js/
│       ├── app.js         # Bootstrap / entry
│       ├── ui/
│       │   ├── api.js     # HTTP API helpers
│       │   ├── auth.js    # Login/signup logic
│       │   ├── pages.js   # Page routing + UI logic
│       │   └── hud.js     # In-game HUD
│       ├── network/
│       │   └── socket.js  # Socket.IO client
│       └── game/
│           ├── engine.js  # Three.js setup + game loop
│           ├── terrain.js # Voxel map generation
│           ├── player.js  # FPS controller + physics
│           ├── weapons.js # Gun + sword combat
│           ├── effects.js # Particles, trails, flash
│           └── audio.js   # Web Audio API sounds
├── .env.example
├── package.json
└── README.md
```


### Technology Stack
| Layer      | Technology              |
|------------|-------------------------|
| Frontend   | Vanilla JS + Three.js   |
| 3D Engine  | Three.js r128           |
| Realtime   | Socket.IO 4             |
| Backend    | Node.js + Express 4     |
| Database   | MongoDB + Mongoose      |
| Auth       | JWT (jsonwebtoken)      |
| Sounds     | Web Audio API (proc.)   |
| Deployment | Render (full) / Netlify (frontend) |

---

## 🔧 Common Issues

| Problem | Solution |
|---------|----------|
| Pointer lock not working | Click the canvas first, then click again to lock |
| "You need a clan" error | Create or join a clan from the Dashboard first |
| Socket won't connect | Check `FRONTEND_URL` env var matches your frontend origin |
| MongoDB auth error | Check `MONGO_URI` includes correct username/password |
| Render cold start slow | Free tier sleeps after 15 min — first load takes ~30s |
| No opponent found | Both players must be in **different** clans to match |

---

## 🎨 Customization

- **Map layout:** Edit `frontend/js/game/terrain.js` — add/move walls and cover
- **Weapon damage:** Edit `frontend/js/game/weapons.js` — `DAMAGE` object
- **Win condition:** Edit `backend/gameSocket.js` — `WIN_KILLS` constant (default 10)
- **Gem rewards:** Edit `backend/gameSocket.js` — gem/reputation amounts after win
- **UI colors:** Edit `frontend/css/main.css` — CSS variables at top of file

---

## 📄 License

MIT License — free to use, modify, and distribute.
