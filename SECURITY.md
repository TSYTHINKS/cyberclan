# CyberClan — Security Policy

## Reporting a Vulnerability

If you find a security issue, **do not open a public GitHub issue.**

Email: tejasva366@gmail.com 

Please include:
- What the vulnerability is
- Steps to reproduce it
- What damage it could cause

You will get a response within 48 hours. We take all reports seriously.

---

## What Is Protected

### 1. Authentication
- Passwords are hashed using **bcryptjs** (12 salt rounds) — never stored as plain text
- Sessions use **JWT tokens** that expire after 7 days
- Login and signup are **rate limited** to 10 attempts per 15 minutes per IP address
- Brute force attacks will be automatically blocked

### 2. API Security
- All API routes are **rate limited** to 100 requests per minute per IP
- Request body size is capped at **2MB** to prevent memory attacks
- All inputs are scanned for dangerous MongoDB operators (`$where`, `$gt`, `$regex` etc.) and rejected if found
- SQL/NoSQL injection attempts are blocked before they reach the database

### 3. HTTP Security Headers
Every response includes these headers:
- `X-Content-Type-Options: nosniff` — stops MIME type sniffing attacks
- `X-Frame-Options: DENY` — prevents the site being loaded inside an iframe (clickjacking protection)
- `X-XSS-Protection: 1; mode=block` — browser-level XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer data leakage
- `Permissions-Policy` — disables camera, microphone, geolocation access
- `X-Powered-By` header is **removed** so attackers can't see you are running Express

### 4. Game Anti-Cheat (Server-Side)
- **All damage is validated on the server** — the client never decides how much damage was dealt
- **Friendly fire is blocked server-side** — you cannot hurt your own teammates even if you modify the client code
- **Dead players cannot be hit** — the `dead` flag is tracked server-side, not client-side
- **Clan leader verification** — only the actual clan leader (verified by database) can start battles or send challenges
- **JWT verified on every socket connection** — you cannot connect to the game server without a valid token

### 5. Data
- MongoDB connection uses environment variables — credentials are never in the code
- `.env` file is in `.gitignore` — secrets are never pushed to GitHub
- User passwords are never returned in any API response

---

## Known Limitations (Not Yet Fixed)

| Issue | Risk | Plan |
|-------|------|------|
| Client-side hit detection for gun | A cheater could modify client to auto-aim | Move full hit detection to server in future |
| No CAPTCHA on signup | Bots could create accounts | Add hCaptcha to signup form |
| Base64 clan logo stored in DB | Large images could slow database | Move to cloud storage (Cloudinary) |
| No email verification | Fake accounts possible | Add email confirmation on signup |

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` branch | ✅ Yes |
| Older commits | ❌ No — always use latest |

---

## Dependencies We Monitor

Run this command regularly to check for known vulnerabilities in packages:

```bash
npm audit
```

If it shows vulnerabilities:
```bash
npm audit fix
```

---

## Production Checklist

Before going live make sure you have done all of these:

- [ ] Changed `JWT_SECRET` in `.env` to a long random string (minimum 32 characters)
- [ ] Set `FRONTEND_URL` in `.env` to your exact domain (not `*`)
- [ ] Using MongoDB Atlas with a strong password
- [ ] MongoDB user has only read/write access, not admin access
- [ ] Render environment variables are set (not hardcoded)
- [ ] Ran `npm audit` and fixed any high/critical issues
- [ ] HTTPS is enabled (Render and Netlify do this automatically)

