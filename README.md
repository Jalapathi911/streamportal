# StreamPortal

Portrait-mode P2P video streaming platform. Stack: React + Vite + TailwindCSS | Node.js + Socket.io | WebRTC | JWT Auth.

---

## Local Development

### 1. Start the server
```bash
cd server
npm install
npm run dev       # nodemon — auto-reloads on change
```
Server runs at http://localhost:4000.

### 2. Start the client
```bash
cd client
npm install
npm run dev       # Vite dev server
```
Client runs at http://localhost:5173. `/api` and `/socket.io` are proxied to the server.

### 3. Test locally (3 tabs)
1. Open http://localhost:5173/dashboard → login (admin / admin123) → create a room → copy link
2. Open the room link in Tab 2 → choose **Sender** → camera preview appears
3. Open the room link in Tab 3 → choose **Receiver** → stream appears
4. Press `Ctrl+Shift+D` to toggle the debug overlay

---

## TURN Server Setup (metered.ca free tier)
1. Go to https://www.metered.ca/tools/openrelay/
2. Create a free account
3. Copy: TURN URL, Username, Credential
4. Add to `client/.env`:
   ```
   VITE_TURN_URL=turn:...
   VITE_TURN_USERNAME=...
   VITE_TURN_CREDENTIAL=...
   ```
5. Also add to Railway environment variables (see below)

---

## Deploy — Railway (Backend)
1. Push project to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Select repo, set **root directory** to `/server`
4. Add environment variables from `server/.env.example`
5. Deploy → copy the Railway public URL (e.g. `https://streamportal-xxx.railway.app`)

---

## Deploy — Cloudflare Pages (Frontend)
1. Go to pages.cloudflare.com → Create a project → Connect GitHub repo
2. Set **root directory**: `/client`
3. **Build command**: `npm run build`
4. **Output directory**: `dist`
5. Add environment variables from `client/.env.example`  
   (`VITE_SERVER_URL` = your Railway URL)
6. Deploy → copy Cloudflare Pages URL (e.g. `https://streamportal.pages.dev`)
7. Go back to Railway → add `CLIENT_ORIGIN` = Cloudflare Pages URL → redeploy

---

## Production Test Checklist

### Auth
- [ ] Visit Cloudflare Pages URL → redirected to `/login`
- [ ] Login with admin credentials → reaches `/dashboard`

### Room Management
- [ ] Create a room → appears in list
- [ ] Copy link → URL is Cloudflare Pages URL (not localhost)
- [ ] Delete room → removed from list

### Streaming (same network)
- [ ] Open room link on two browser tabs
- [ ] Tab 1: choose Sender → camera preview appears
- [ ] Tab 2: choose Receiver → stream appears within 3 seconds
- [ ] Rotation controls work on both sides
- [ ] `Ctrl+Shift+D` shows debug overlay

### Streaming (different networks — TURN test)
- [ ] Open room link on mobile data + desktop
- [ ] Stream connects successfully (TURN relay used)
- [ ] Check browser DevTools → ICE candidate type = `relay` confirms TURN working

### Recording
- [ ] Start recording on sender
- [ ] Stop after 30 seconds → file downloads as `.webm`
- [ ] File plays correctly in VLC or browser

### Disconnect handling
- [ ] Sender closes tab → receiver sees "Sender Disconnected" message
- [ ] Sender reopens link → rejoins as Sender → stream resumes
