# RITIKOMAL LOVE — Next.js + MongoDB version

Converted from the original PHP + MySQL app. Same idea: a private,
two-person couple chat with text + image messages, online presence, and
video-call signaling — now on Next.js (App Router) with MongoDB
(Mongoose) instead of PHP/PDO.

## What's included (working)

- **Register / Login (PIN)** — bcrypt-hashed 6-digit PIN, capped at
  exactly 2 accounts, same as before.
- **Session** — httpOnly signed JWT cookie instead of PHP's server session
  (`lib/auth.js`).
- **Chat** — send text, send images (uploaded to Cloudinary — see
  `app/api/upload/route.js`), 2-second polling, edit or delete your own
  messages, message timestamps.
- **Presence** — "online" if the partner hit `/api/auth/me` in the last 8
  seconds (same window as the PHP version).
- **Gallery** — `/api/gallery` returns every image message.
- **Call signaling** — `/api/call` (POST to send an offer/answer/ICE
  candidate, GET to poll+clear what's addressed to you), replacing the old
  `signals.json` file with a MongoDB collection that auto-expires entries
  after 2 minutes (TTL index).
- **Face ID** — `components/FaceCapture.jsx` loads `face-api.js` models
  (same public CDN mirror the original `js/auth.js` used) client-side,
  starts the webcam, and captures a 128-number face descriptor:
  - Registration now has a 2-step flow: name+PIN, then a "Scan & create" /
    "Skip — add Face ID later" step (mirrors the old two-step register).
  - Login has a PIN / Face ID toggle.
  - Once logged in, a "Face ID" button in the chat header lets you
    enrol/replace your descriptor any time via `/api/auth/face`.
  - Uses the front camera (`facingMode: 'user'`) so it works on phones too.
  - **Mobile/browser requirement:** `getUserMedia` (camera access) only
    works over **HTTPS** or on `localhost` — it will silently fail to even
    prompt for camera permission on a plain `http://` address on a phone.
    Any real deployment (Vercel, Railway, etc.) gives you HTTPS by default,
    so this only matters if you're testing on your phone against your dev
    machine's local IP.

## What's scaffolded but not wired into the UI yet

- **Video/voice calling is now wired up** (WebRTC via `/api/call`
  signaling, mute/camera toggles, ringing + connected states) — this
  section now only lists what's still pending.
- **Quiz feature** — `models/Quiz.js` mirrors the old `quizzes` /
  `quiz_questions` / `quiz_attempts` tables as one embedded document, but
  there's no API route or UI for it yet.

## UI

Ported to match the original PHP app's exact visual design — same dark
red/black theme, same Google Fonts (Playfair Display + Quicksand), same
Tailwind CDN approach (no build step, `<script src="https://cdn.tailwindcss.com">`
in `app/layout.js`), and the same `css/style.css` copied byte-for-byte into
`app/globals.css`. That includes the floating-hearts background, the photo
marquee + glow ring on the login screen, the face-scan camera overlay, chat
bubbles, the top bar, contacts rail, and working Gallery + Settings (Face
ID) drawers. The Quiz button is still an inert placeholder (see the note above); the
Video/Voice Call buttons are fully wired up.

## Setup

1. `npm install`
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `MONGODB_URI` — a MongoDB connection string (MongoDB Atlas has a free
     tier that works fine for this).
   - `JWT_SECRET` — any long random string.
3. `npm run dev` and open `http://localhost:3000`.

No manual schema import needed — Mongoose creates collections/indexes on
first use.

## Deploying to Vercel (via GitHub)

1. **MongoDB Atlas** — create a free cluster at mongodb.com/atlas, add a
   database user, and under Network Access allow `0.0.0.0/0` (or Vercel's
   IP ranges) so Vercel's servers can reach it. Copy the connection string.
2. **Push this project to a GitHub repo** (plain git — no special steps,
   `.env.local` is already git-ignored so your secrets won't leak).
3. On vercel.com: **New Project → Import** your GitHub repo.
4. Under **Settings → Environment Variables**, add:
   - `MONGODB_URI` — the Atlas connection string from step 1
   - `JWT_SECRET` — any long random string
5. Sign up free at cloudinary.com, and under **Settings → Environment
   Variables** add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
   `CLOUDINARY_API_SECRET` from your Cloudinary dashboard — `app/api/upload`
   needs these for image uploads.
6. Click **Deploy**. Vercel builds and gives you a live `https://…` URL —
   camera/Face ID needs HTTPS, which Vercel provides by default, so that
   works out of the box.
7. Every future `git push` to the connected branch auto-redeploys.

## Deploying elsewhere (self-hosted)

- **VPS, Railway, Render, etc.** — works as-is; the upload route already
  targets Cloudinary (works from anywhere, not just Vercel), so just set the
  same three `CLOUDINARY_*` env vars there too.

## Data model differences from MySQL

- `users.id` / `messages.sender_id` → Mongo `ObjectId`s instead of
  auto-increment ints.
- `face_data` (JSON string in MySQL) → a native `[Number]` array in Mongo.
- `signals.json` file → a `Signal` collection with a TTL index (auto-expires
  after 2 minutes) instead of manual file cleanup.
