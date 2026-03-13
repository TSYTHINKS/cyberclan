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

---

## 🚀 Running Locally

### Prerequisites
- **Node.js** v18+ — https://nodejs.org
- **MongoDB** — either local or free cloud at https://mongodb.com/atlas

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/cyberclan.git
cd cyberclan
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/cyberclan
JWT_SECRET=change_this_to_a_random_string_at_least_32_chars
FRONTEND_URL=http://localhost:3000
```

### 3. Start MongoDB (if local)

```bash
# macOS / Linux
mongod --dbpath ~/data/db

# Windows
"C:\Program Files\MongoDB\Server\6.0\bin\mongod.exe"
```

### 4. Start the Server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

### 5. Open in Browser

Navigate to **http://localhost:3000**

---

## 🎮 How to Play

1. **Sign up** and create an account
2. **Create or join a clan** from the Dashboard
3. Go to **Battle** in the lobby
4. **Select your weapon** (Pulse Gun or Nano Blade)
5. Click **Find Battle** — you'll be matched against a player from a different clan
6. **Controls:**
   - `WASD` — Move
   - `Mouse` — Look around
   - `Left Click` — Attack (hold canvas first to lock mouse)
   - `Space` — Jump
   - `Shift` — Sprint
   - `Esc` — Release mouse cursor
7. First team to **10 kills** wins — winning clan earns **50 gems + 100 reputation**

---

## 📤 Pushing to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial CyberClan commit"

# Create repo at github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/cyberclan.git
git branch -M main
git push -u origin main
```

**Important:** Add `.env` to `.gitignore` — never commit secrets!
```bash
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
git add .gitignore && git commit -m "Add gitignore"
```

---

## ☁️ Database Setup (MongoDB Atlas - Free)

1. Go to https://mongodb.com/atlas → **Create Free Account**
2. Create a **Free Tier Cluster** (M0)
3. Under **Security → Database Access**, create a database user
4. Under **Security → Network Access**, add `0.0.0.0/0` (allow all IPs for simplicity)
5. Click **Connect → Connect your application** → copy the URI
6. Replace `<password>` with your database user password
7. Use this as your `MONGO_URI` in production

---

## 🌐 Deploying Backend (Render — Free)

Render is the easiest free Node.js host that supports WebSockets (required for Socket.IO).

1. Go to https://render.com → Sign up free
2. **New → Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Name:** `cyberclan-api`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add:
   ```
   MONGO_URI    = your_atlas_connection_string
   JWT_SECRET   = your_random_secret_key
   FRONTEND_URL = https://cyberclan.netlify.app  (your frontend URL)
   NODE_ENV     = production
   ```
6. Click **Create Web Service** — Render gives you a URL like `https://cyberclan-api.onrender.com`

> **Note:** Free Render instances spin down after 15 min of inactivity. First request may take ~30s to wake up.

---

## 🌐 Deploying Frontend (Netlify — Free)

Since the frontend is a static SPA served by the backend, you have two options:

### Option A: Let the backend serve the frontend (simplest)

The Express server already serves `frontend/` as static files. Just deploy everything to Render as above — frontend and backend together at the same URL.

### Option B: Separate frontend on Netlify

1. Update the frontend to use the Render backend URL for API + Socket.IO:

In `frontend/js/ui/api.js`, change:
```js
const BASE = '/api';
// to:
const BASE = 'https://cyberclan-api.onrender.com/api';
```

In `frontend/js/network/socket.js`, change:
```js
socket = io({ auth: { token } });
// to:
socket = io('https://cyberclan-api.onrender.com', { auth: { token } });
```

2. Go to https://netlify.com → **New Site → Import from Git**
3. Select your repo, set **Publish Directory** to `frontend`
4. Click **Deploy**
5. Your frontend is live at `https://cyberclan.netlify.app`

---

## 🌐 Deploying to Vercel (Alternative)

Vercel works great for the frontend but **does not support WebSockets** for serverless functions. Use it for frontend only (Option B above), with Render for the backend.

```bash
npm install -g vercel
cd frontend
vercel --prod
```

---

## 🏗️ Architecture Overview

```
Browser
  │
  ├─ HTTP REST (fetch)  ──►  Express /api/*  ──►  MongoDB
  │                                ↑
  └─ WebSocket (Socket.IO)  ──────┘
                          ↕ real-time events
                    [matchmaking queue]
                    [player movement]
                    [combat / hit detection]
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
