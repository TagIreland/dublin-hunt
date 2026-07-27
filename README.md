# Dublin Treasure Hunt — Setup Guide

Everything you need to get the app live and on everyone's phones.

---

## What You'll Need

- A Google account (for Firebase — it's free)
- Node.js installed on your computer (https://nodejs.org — download the LTS version)
- About 15–20 minutes

---

## Step 1: Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Create a project"** (or "Add project")
3. Name it something like `dublin-treasure-hunt`
4. You can disable Google Analytics (not needed) — click **Continue**
5. Wait for the project to be created, then click **Continue**

---

## Step 2: Create a Realtime Database

1. In the Firebase console sidebar, click **Build → Realtime Database**
2. Click **"Create Database"**
3. Choose a location — pick **europe-west1 (Belgium)** since you're in Dublin
4. Start in **locked mode** (we'll paste in proper rules in the next step)
5. Click **Enable**

---

## Step 2b: Lock Down the Database Rules

The repo ships a hardened ruleset in [`database.rules.json`](database.rules.json). **Do not leave the database in open "test mode"** — anyone who finds your database URL could otherwise read every team's photos or wipe the game.

1. In the Realtime Database, click the **Rules** tab
2. Delete what's there and paste in the entire contents of `database.rules.json`
3. Click **Publish**

These rules:
- Block all access outside the app's own `dublin-hunt` data
- Validate the shape/size of everything written (team numbers 1–10, capped photo sizes, capped message length, no junk fields)
- Keep team progress, photos (with the location the team typed) and the team↔admin message thread all cleanly separated
- Make the admin PIN **write-once**, so a stranger can't change it and lock you out

> **Important limitation:** This app has no login system — the admin PIN is checked in the browser, so the rules **cannot** stop a determined person from reading the PIN or writing data. For a one-day, share-the-link event that's an acceptable trade-off. If you need real protection, see **Securing the database further** at the end of this guide.

---

## Step 3: Register a Web App

1. On the Firebase project homepage, click the **web icon** `</>` (it says "Add app")
2. Give it a nickname like `treasure-hunt-web`
3. **Don't** tick "Firebase Hosting" (we'll use Vercel instead — it's easier)
4. Click **Register app**
5. You'll see a code block with your Firebase config. It looks like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "dublin-treasure-hunt.firebaseapp.com",
  databaseURL: "https://dublin-treasure-hunt-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "dublin-treasure-hunt",
  storageBucket: "dublin-treasure-hunt.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def456"
};
```

6. **Copy these values** — you'll need them in the next step
7. Click **Continue to console**

---

## Step 4: Set Up the Project Locally

Open a terminal / command prompt and run:

```bash
# Navigate to the project folder (wherever you saved it)
cd dublin-hunt

# Install dependencies
npm install
```

Now create the environment file:

```bash
# Copy the example env file
cp .env.example .env
```

Open `.env` in any text editor and paste in your Firebase values from Step 3:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=dublin-treasure-hunt.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://dublin-treasure-hunt-default-rtdb.europe-west1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=dublin-treasure-hunt
VITE_FIREBASE_STORAGE_BUCKET=dublin-treasure-hunt.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
```

Save the file.

---

## Step 5: Test Locally

```bash
npm run dev
```

This starts a local server (usually at `http://localhost:5173`). Open it in your browser to check everything works. Try opening it in two browser tabs — one as admin, one as a team — to see the real-time sync in action.

---

## Step 6: Deploy to Vercel (Free)

This gives you a public URL that everyone can open on their phones.

### Option A: Vercel CLI (quickest)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Follow the prompts:
# - Log in with your email (or GitHub)
# - Confirm the project settings (defaults are fine)
# - It will build and deploy automatically
```

When it's done, Vercel gives you a URL like `https://dublin-treasure-hunt.vercel.app`.

**Important:** You also need to add your environment variables on Vercel:

1. Go to https://vercel.com → your project → **Settings → Environment Variables**
2. Add each `VITE_FIREBASE_*` variable and its value
3. Redeploy: run `vercel --prod` in your terminal

### Option B: Vercel Dashboard (no terminal needed)

1. Push your project to a **GitHub repository**
2. Go to **https://vercel.com** and sign in with GitHub
3. Click **"Add New Project"** → import your repo
4. In the **Environment Variables** section, add all your `VITE_FIREBASE_*` values
5. Click **Deploy**
6. You'll get a URL like `https://dublin-treasure-hunt.vercel.app`

---

## Step 7: Share With Your Teams

Send the Vercel URL to all team captains. They open it on their phone's browser — no app install needed.

**Pro tip:** Create a QR code for the URL (use https://qr.io or similar) and display it on a screen at Accenture, Grand Canal Square before the hunt starts. Everyone just scans it.

---

## On the Day: How to Run It

### Before the event
1. Open the app URL on your phone or laptop
2. Tap **Admin Dashboard** → set a PIN
3. Choose your mode:
   - **⚡ Auto-Approve**: Teams submit a selfie and instantly get the next clue (trust-based, faster pace)
   - **👁️ Manual Approve**: You verify each selfie before they get the next clue (more control)

### Starting the hunt
1. Gather everyone at **Accenture, Grand Canal Square**
2. Each team has **one captain** who runs the app and takes every team photo
3. Each captain opens the URL and taps **Join as a Team** → picks their team number
4. When everyone's in, hit **▶️ Start Game** on the admin dashboard
5. All teams instantly see their first clue

### During the hunt
- Each team sees a riddle clue pointing to a Dublin landmark
- **Every team has a completely different route** — 5–6 landmarks, each starting in a
  different direction out of Grand Canal Square, so teams don't bump into each other
- The captain walks the team there, takes a **team photo (everyone must be in shot)**,
  types in **where they think they are**, and submits it
- They get the next clue (auto, or after you approve the photo in Manual mode)
- **Lost or stuck?** A team can tap **💬 Message the organiser** to text you. On your
  dashboard you'll see their message *plus* which clue they're on and where they should be
  heading, so you can nudge them in the right direction. Reply straight from the app.

### The secret finish
- The final pub — **O'Donoghue's, 15 Merrion Row** — is **hidden** from every team until
  they clear their last landmark. Only then does their final clue reveal it.
- When a team reaches O'Donoghue's they take one last photo **outside** the pub, then get a
  "You've finished — head inside!" message. That's your cue: they're at the door.
- You (the admin) sit inside O'Donoghue's, approving photos, replying to messages, and
  downloading everyone's pictures as they roll in. Track all 10 teams live on the dashboard.

---

## Customisation

Everything you'd want to change lives in one clearly-marked **DATA** block near the top of
`src/App.jsx`.

### Change the locations or clues
Edit the `LOCATIONS` object in `src/App.jsx`. It's keyed by a short `id`, and each landmark has:
- `name` — the real name (shown to the admin and after completing)
- `clue` — the riddle teams see
- `hint` — shown if they tap "Need a Hint?"
- `emoji` — displayed alongside the clue

### Change the routes (the important one)
Edit the `ROUTES` object. Each of the 10 teams has one ordered list of landmark `id`s — its
own unique 5–6 stop journey. Rules of thumb the current routes follow:
- **No landmark is repeated across two routes** — every team is fully individual.
- **Each route opens in a different direction** out of Grand Canal Square so teams fan out.
- **Each route is planned to run under ~90 minutes** including photos, walking and chat.
  If you add far-flung landmarks (e.g. the west-side cathedrals), keep that route short or
  the 90-minute target will slip — that's the main thing to sanity-check if you edit routes.
- The final pub (`END_PUB`) is appended automatically — don't add it to a route.

If you change how many landmarks a route has, nothing else needs touching; the progress bar
and step logic adapt automatically.

### Change the start or the secret finish
- `START` — where everyone gathers (currently Accenture, Grand Canal Square).
- `END_PUB` — the secret final pub (currently O'Donoghue's). Its `clue` is the reveal text
  teams see on their final step, so keep the "take a photo outside, then head in" wording.
  Nothing about `END_PUB` is shown anywhere until a team reaches its final step.

### Change team names / colours / count
Edit `TEAM_NAMES` and `TEAM_COLORS` (10 entries each). To change the number of teams, set
`NUM_TEAMS`, add matching `ROUTES`, and add names/colours to match.

### Change the photo disclaimer or the location prompt
The "every team member must be visible" disclaimer and the "Where are you?" location box are
both in the `TeamGame` component's photo card. Edit the copy there.

### After making changes
Run `vercel --prod` to redeploy, or push to GitHub and Vercel auto-deploys.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Permission denied" in Firebase | Make sure you published the rules from `database.rules.json` (Step 2b) and didn't leave the DB in locked mode |
| App loads but nothing syncs | Check your `VITE_FIREBASE_DATABASE_URL` is correct and includes the full URL |
| Camera doesn't open on phone | Make sure the site is served over HTTPS (Vercel does this automatically) |
| Changes not showing after deploy | Check environment variables are set on Vercel, then redeploy |

---

## Securing the database further (optional)

The rules in `database.rules.json` are as tight as they can be *without a login system*. Because the admin PIN is verified in the browser, the rules can't truly tell an admin apart from a player or a stranger. If you want real security (e.g. for a longer-running or higher-stakes event):

1. **Turn on Firebase App Check** (reCAPTCHA v3 for web). This is the single biggest win — it blocks requests that don't come from *your* deployed app, so random scripts hitting the database URL are rejected. Requires a small change to `src/firebase.js` to initialise App Check.
2. **Add Firebase Authentication** (even Anonymous Auth) and tighten the rules to `auth != null`, with a separate admin claim so only the admin can write to `game` or reset teams.
3. **Move the PIN check server-side** (Cloud Function or Auth custom claims) so it's never sent to the browser at all.

## After the Event

- Delete the Firebase project or disable the database (Firebase Console → Project Settings → Delete Project)
- This prevents any accidental charges (though the free tier is very generous)

---

Enjoy the hunt! 🗺️☘️🍺
