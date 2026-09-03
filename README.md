# RITIKOMAL LOVE — Next.js + MongoDB version

## What's new in this update

- **Bigger, redesigned chat layout** — the side contacts rail is gone (it's
  just the two of you), so the chat area is full width. The top bar now
  shows a bigger profile block (avatar + name + status) right next to the
  heading, with Call / Video Call / **☰ More** on the right. Tap ☰ to reach
  Gallery, Quiz, and Settings.
- **Hero photo carousel** — the old small static banner is now an
  auto-sliding carousel of your latest 10 shared photos (`app/chat/page.js`,
  fed by the new `Photo` collection below). Tap a slide to view + download it.
- **Profile picture zoom** — tap either avatar in the header to see it big
  in a square view; tap again (or tap the backdrop) to shrink back.
- **Online/offline with last-seen** — offline now shows "Last seen today,
  4:45 PM" / "Last seen 2 Sep, 4:45 PM" instead of just a grey dot.
- **Permanent Gallery (`models/Photo.js`)** — every photo you send is now
  also saved to a standalone `Photo` collection, decoupled from the chat
  message. Deleting a chat message (or its message doc) never removes the
  photo from Gallery or the Hero carousel again.
- **Quiz feature is now wired up** (`models/Quiz.js` already existed but had
  no API/UI before) — `/api/quiz`, `/api/quiz/[id]`, `/api/quiz/[id]/attempt`.
  Make a quiz (question + 4 options + pick the right one, add more questions
  optionally) and send it; the other person solves it question-by-question,
  gets a final score (1 point per correct answer), and both of you can see
  each other's scores on that quiz card.
- **Voice notes** — record and send voice notes from the composer
  (`/api/upload-voice`), stored on Cloudinary like photos. Settings →
  "Voice notes" lists every clip either of you has sent, labeled by name.
- **Real in-browser camera capture** — the 🤳 button in the composer opens a
  live camera preview (with a front/back flip) to snap and send a photo,
  separate from the 📷 button which still opens your device's normal photo
  picker.
- **Instagram Reel sharing** — the 🎬 button lets you paste an Instagram
  Reel/post link; it's sent as a small link-card in chat (opens in a new
  tab/the Instagram app on tap) — Instagram itself is never opened or
  embedded inside the app.
- **Settings additions** — change your PIN (`/api/auth/change-password`),
  change your own profile photo by uploading a new one or picking any photo
  from your shared Gallery (`/api/auth/avatar`), and 10 wallpaper themes
  built from your own gallery photos. Wallpaper choice is now stored
  server-side (`models/CoupleSettings.js`, `/api/settings/wallpaper`) so
  picking one updates it for **both** of you, not just your own browser.
- **Calling improvements** — added a public TURN relay alongside the
  existing STUN servers (this is usually why a call "wasn't going through"
  — plain STUN fails on many mobile networks/firewalls); added a
  best-effort loudspeaker toggle 🔊/🔈 (full device-output switching isn't
  supported on every browser, but it always updates the on-screen state);
  and a front/back camera flip button 🔄 during video calls.


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
