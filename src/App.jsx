import { useState, useEffect, useRef } from "react";
import { dbGet, dbSet, dbUpdate, dbRemove, dbListen } from "./firebase.js";

/* ══════════════════════════════════════════════════════════════
   IMAGE HELPERS
   ══════════════════════════════════════════════════════════════ */

async function compressImage(file, maxWidth = 800, quality = 0.7) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function safeName(s) {
  return (s || "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
}

function genId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function fmtTime(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function medal(rank) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";
}

/* ══════════════════════════════════════════════════════════════
   DATA

   • START      — where every team gathers.
   • END_PUB    — the SECRET finish. Its name/address is only ever
                  shown once a team reaches its final step, and never
                  on the splash or to teams still hunting.
   • LOCATIONS  — the pool of landmarks, keyed by id.
   • ROUTES     — one ordered list of landmark ids per team (1–10).
                  Each route is unique, fans out from the start in a
                  different direction, has 5–6 stops, and is planned
                  to run under ~90 min including photos + walking.

   To change the game just edit these four. See README.md.
   ══════════════════════════════════════════════════════════════ */

const NUM_TEAMS = 10;

const START = {
  name: "Accenture, Grand Canal Square",
  emoji: "🏢",
};

// SECRET — do not surface anywhere until a team hits its final step.
// The clue is deliberately cryptic (no address, no pub name). Teams solve it
// from the music history; the hint is the safety net for anyone truly stuck.
const END_PUB = {
  name: "O'Donoghue's",
  address: "15 Merrion Row, Dublin 2, D02 PF50",
  emoji: "🍺",
  clue:
    "No address this time — you'll have to earn the last one. 🎵\n\n" +
    "In 1962, in a snug little bar just off the NORTHEAST corner of St Stephen's Green, " +
    "a few ballad singers pulled up stools, started a session, and took their band's name " +
    "from the very city all around them. From that back room came Ireland's most famous " +
    "folk group — and to this day the fiddles, bodhráns and singalongs still spill out its " +
    "door most nights.\n\n" +
    "Follow the music to the little pub where 'The Dubliners' were born. It sits on the short " +
    "row that runs off the top corner of the Green, in the shadow of the city's grandest hotel.\n\n" +
    "Take a team photo OUTSIDE the door — then head in for the session and join everyone else!",
  hint:
    "It's O'Donoghue's — the legendary trad-music pub on Merrion Row, right beside the " +
    "Shelbourne Hotel (and the tiny walled French graveyard next door).",
};

const LOCATIONS = {
  // ── Docklands (north of the Liffey) ──────────────────────────
  "samuel-beckett-bridge": {
    name: "Samuel Beckett Bridge",
    emoji: "🌉",
    clue: "Named for an Irishman who waited endlessly for Godot, I arc across the Liffey like a harp turned on its side. Cross me to leave the south bank behind.",
    hint: "The striking white cable-stayed bridge just north of Grand Canal Square.",
  },
  "jeanie-johnston": {
    name: "Jeanie Johnston Tall Ship",
    emoji: "⛵",
    clue: "A three-masted replica of a famine ship, I never lost a single soul on my Atlantic crossings. I'm moored on the north quays waiting to be boarded.",
    hint: "A wooden tall ship on Custom House Quay, north bank.",
  },
  "epic-chq": {
    name: "EPIC / CHQ Building",
    emoji: "🚢",
    clue: "Once a bonded warehouse for tobacco and wine, my vaulted vaults now tell the story of ten million who left these shores. Find me right on the quay.",
    hint: "The CHQ building on Custom House Quay — home of EPIC The Irish Emigration Museum.",
  },
  "custom-house": {
    name: "The Custom House",
    emoji: "🏛️",
    clue: "James Gandon gave me my neoclassical grandeur in 1791. Burned in 1921, I rose again — my green copper dome still watches over the river.",
    hint: "The grand domed building on the north bank, near Butt Bridge.",
  },
  "famine-memorial": {
    name: "Famine Memorial",
    emoji: "🗿",
    clue: "We are gaunt bronze figures walking forever toward the emigrant ships. Our thin faces remember Ireland's darkest years.",
    hint: "On Custom House Quay, just east of the Custom House.",
  },
  "sean-ocasey-bridge": {
    name: "Seán O'Casey Bridge",
    emoji: "🚶",
    clue: "A slender bridge for walkers only, I pivot open to let ships through. I carry the name of a playwright of the Dublin tenements.",
    hint: "The pedestrian swing bridge between City Quay and North Wall Quay.",
  },
  "convention-centre": {
    name: "Convention Centre Dublin",
    emoji: "🛢️",
    clue: "A great glass barrel tilted on the north quays, lit up at night — Dubliners joke I look like a giant pint glass laid on its side.",
    hint: "On the north bank at Spencer Dock, near Samuel Beckett Bridge.",
  },
  "mv-cill-airne": {
    name: "MV Cill Airne",
    emoji: "🚢",
    clue: "A 1960s riverboat, once a tender ferrying passengers out to ocean liners, now a floating bar and restaurant moored on the quay.",
    hint: "A moored vintage steamship on North Wall Quay.",
  },

  // ── Grand Canal Dock / east ──────────────────────────────────
  "waterways-box": {
    name: "Waterways Ireland Visitor Centre",
    emoji: "🧊",
    clue: "A glass box perched out over the old dock basin — locals simply call me 'the box in the docks'.",
    hint: "On the boardwalk in Grand Canal Dock basin.",
  },
  "grand-canal-dock": {
    name: "Grand Canal Dock Basin",
    emoji: "🛶",
    clue: "Kayakers and paddleboarders skim across me now, but I was once crowded with cargo barges. The glass towers of the tech giants watch my still water.",
    hint: "The large water basin just south of the theatre.",
  },
  "diving-bell": {
    name: "The Diving Bell",
    emoji: "⚓",
    clue: "A giant iron chamber that once lowered workers to the riverbed to build Dublin's deep quay walls. Now I stand as a rusty-red monument on the boardwalk.",
    hint: "On Sir John Rogerson's Quay, south bank.",
  },
  "windmill-lane": {
    name: "Windmill Lane",
    emoji: "🎸",
    clue: "A wall of ever-changing graffiti marks the lane where a very famous Dublin band recorded their earliest albums. Fans still leave their mark on me.",
    hint: "Windmill Lane, off Sir John Rogerson's Quay.",
  },
  "grand-canal-locks": {
    name: "Grand Canal Sea Locks",
    emoji: "🚪",
    clue: "Great wooden gates where the canal steps down to meet the tide — the very last lock before boats slip out into the Liffey and the sea.",
    hint: "Where the Grand Canal joins the Liffey, at the east end of the dock.",
  },
  "bolands-mill": {
    name: "Boland's Mill",
    emoji: "🏭",
    clue: "In Easter 1916 a young commandant named de Valera held these old flour mills against the British. My tall silos still stand by the dock.",
    hint: "Barrow Street, beside Grand Canal Dock.",
  },
  "aviva-stadium": {
    name: "Aviva Stadium",
    emoji: "🏉",
    clue: "A shimmering glass bowl rising over the rooftops of Lansdowne — I roar to life on match days for rugby and football.",
    hint: "Lansdowne Road — follow the river east then head south.",
  },

  // ── Central quays / Temple Bar ───────────────────────────────
  "rosie-hackett-bridge": {
    name: "Rosie Hackett Bridge",
    emoji: "🌉",
    clue: "The newest bridge across the Liffey and the first ever named for a woman — a trade unionist who fought for Dublin's working people.",
    hint: "The Liffey bridge that carries the Luas trams, between O'Connell and Butt Bridges.",
  },
  "hapenny-bridge": {
    name: "Ha'penny Bridge",
    emoji: "🌁",
    clue: "Dublin's most photographed crossing — an elegant white iron arch since 1816. Once you'd pay a half-penny to cross me; now I'm free.",
    hint: "The pedestrian bridge linking Temple Bar to Liffey Street.",
  },
  "temple-bar-square": {
    name: "Temple Bar Square",
    emoji: "🎭",
    clue: "Cobblestones, buskers and more pubs than you can count — Dublin's cultural quarter. My name honours a Sir Temple, not a place of prayer.",
    hint: "South of the Liffey, between Dame Street and the river.",
  },
  "bank-of-ireland": {
    name: "Bank of Ireland, College Green",
    emoji: "🏦",
    clue: "Once the Irish Parliament — the first purpose-built two-chamber house in the world. I curve grandly opposite Trinity's gates.",
    hint: "The great columned building facing Trinity College on College Green.",
  },
  "molly-malone": {
    name: "Molly Malone Statue",
    emoji: "🐚",
    clue: "She wheeled her barrow through streets broad and narrow, crying 'cockles and mussels, alive alive oh!'.",
    hint: "On Suffolk Street, just off the bottom of Grafton Street.",
  },

  // ── Trinity / Pearse Street ──────────────────────────────────
  "science-gallery": {
    name: "Science Gallery",
    emoji: "🔬",
    clue: "Where Pearse Street meets Trinity's eastern edge, I blur art and science in ever-changing exhibitions. Students and the curious pass through my doors.",
    hint: "Corner of Pearse Street, at the east end of Trinity College.",
  },
  "trinity-front-gate": {
    name: "Trinity College Front Gate",
    emoji: "🎓",
    clue: "Ireland's oldest university, founded by a queen in 1592. The Book of Kells sleeps behind my walls. Enter beneath my grand arch.",
    hint: "The main entrance on College Green.",
  },
  campanile: {
    name: "Trinity Campanile",
    emoji: "🔔",
    clue: "A bell tower rising from the cobbles at the heart of the square — legend says a student who walks beneath me as I ring will fail their exams.",
    hint: "In Trinity's Parliament Square, straight through the front gate.",
  },
  "sweny-pharmacy": {
    name: "Sweny's Pharmacy",
    emoji: "💊",
    clue: "A tiny Victorian chemist frozen in time, where Leopold Bloom bought a bar of lemon soap in 'Ulysses'. Readers still gather to read Joyce aloud in me.",
    hint: "On Lincoln Place, at the back of Trinity College.",
  },

  // ── Merrion Square / Georgian core ───────────────────────────
  "merrion-square": {
    name: "Merrion Square",
    emoji: "🌳",
    clue: "A perfect Georgian square of red brick and rainbow-coloured doors. Poets and patriots once lived all around my leafy park.",
    hint: "The large Georgian square just east of Leinster House.",
  },
  "oscar-wilde": {
    name: "Oscar Wilde Statue",
    emoji: "🎭",
    clue: "I lounge on a boulder in my smoking jacket, wit dripping from my lips, watching over the square where I spent my childhood.",
    hint: "The reclining statue in the corner of Merrion Square park.",
  },
  "natural-history": {
    name: "Natural History Museum",
    emoji: "🦌",
    clue: "Dubliners call me the 'Dead Zoo' — two crowded floors of stuffed beasts and glass cases, barely changed since Victorian times.",
    hint: "On Merrion Street, beside Leinster House.",
  },
  "national-gallery": {
    name: "National Gallery of Ireland",
    emoji: "🖼️",
    clue: "A long-lost Caravaggio masterpiece hangs within my walls, alongside the very best of Irish art — and it costs nothing to come in.",
    hint: "On Merrion Square West, beside the government buildings.",
  },
  "leinster-house": {
    name: "Leinster House",
    emoji: "🏛️",
    clue: "A Georgian ducal palace that now houses the Dáil — the seat of Ireland's parliament. A harp flies above my gates.",
    hint: "Between Kildare Street and Merrion Square.",
  },
  "national-museum": {
    name: "National Museum (Archaeology)",
    emoji: "🏺",
    clue: "Bog bodies, Viking gold and the great Tara Brooch sleep beneath my domed rotunda. Ireland's ancient treasure lives in me.",
    hint: "On Kildare Street, beside Leinster House.",
  },
  "peppercanister": {
    name: "St Stephen's 'Peppercanister' Church",
    emoji: "⛪",
    clue: "My nickname comes from my shape — a domed lantern like a pepper pot, perfectly closing off the view down Mount Street.",
    hint: "At Mount Street Crescent, top of Upper Mount Street.",
  },
  "number-29": {
    name: "Number 29 Georgian House",
    emoji: "🚪",
    clue: "A perfectly preserved middle-class home of the 1790s, from the cellar kitchen right up to the children's nursery at the top.",
    hint: "Corner of Lower Fitzwilliam Street and Mount Street.",
  },
  "fitzwilliam-square": {
    name: "Fitzwilliam Square",
    emoji: "🔑",
    clue: "The last and smallest of the great Georgian squares — my central garden is private still, locked and open only to keyholders.",
    hint: "South of Merrion Square, off Fitzwilliam Street.",
  },

  // ── Grand Canal / Baggot Street ──────────────────────────────
  "huband-bridge": {
    name: "Huband Bridge",
    emoji: "🌉",
    clue: "A pretty stone hump-backed bridge from 1791, arching over the calm green Grand Canal where the swans drift by.",
    hint: "A small stone canal bridge near Upper Mount Street.",
  },
  "kavanagh-statue": {
    name: "Patrick Kavanagh Statue",
    emoji: "🪑",
    clue: "By the leafy canal a poet sits forever on a bench, just as he asked: 'O commemorate me where there is water'.",
    hint: "The bench statue on the canal bank at Baggot Street Bridge.",
  },
  "wilton-terrace": {
    name: "Wilton Terrace Canal Walk",
    emoji: "🦢",
    clue: "A tree-lined towpath where office workers eat their lunch by the still water and the swans come begging for crumbs.",
    hint: "The canal-side walk between Baggot Street and Leeson Street bridges.",
  },
  "mount-street-bridge": {
    name: "Mount Street Bridge",
    emoji: "🕊️",
    clue: "Here in 1916 a handful of Volunteers held off hundreds of soldiers marching up from the sea. A fierce battle by this quiet water.",
    hint: "Where Northumberland Road crosses the Grand Canal.",
  },

  // ── St Stephen's Green area ──────────────────────────────────
  "stephens-green": {
    name: "St Stephen's Green",
    emoji: "🦆",
    clue: "Twenty-two acres of green in the city's heart. During the 1916 Rising both sides paused their fighting so the keeper could feed my ducks.",
    hint: "The large park at the top of Grafton Street.",
  },
  "fusiliers-arch": {
    name: "Fusiliers' Arch",
    emoji: "🏛️",
    clue: "A great stone arch guarding the corner of the Green — some Dubliners nicknamed me 'Traitor's Gate'. I list the fallen of a distant war.",
    hint: "The arch at the northwest corner of St Stephen's Green, at the top of Grafton Street.",
  },
  "newman-church": {
    name: "University Church (Newman)",
    emoji: "💒",
    clue: "Behind a plain and narrow front on the Green I hide a jewel-box of Byzantine colour — a favourite little church for weddings.",
    hint: "On the south side of St Stephen's Green, beside Newman House.",
  },
  rcsi: {
    name: "Royal College of Surgeons",
    emoji: "🩺",
    clue: "My columns on the west side of the Green still carry the bullet scars of 1916, when the Citizen Army held me against the soldiers.",
    hint: "The grand building on the west side of St Stephen's Green.",
  },
  "little-museum": {
    name: "Little Museum of Dublin",
    emoji: "🏙️",
    clue: "A Georgian townhouse crammed with the story of 20th-century Dublin, every object donated by the ordinary people of the city.",
    hint: "On the north side of St Stephen's Green.",
  },
  "shelbourne-hotel": {
    name: "The Shelbourne Hotel",
    emoji: "🏨",
    clue: "Dublin's grandest hotel since 1824 — the 1922 Constitution was drafted in my Room 112, and bronze princesses flank my front door.",
    hint: "On the north side of St Stephen's Green, facing the park.",
  },
  "national-concert-hall": {
    name: "National Concert Hall",
    emoji: "🎻",
    clue: "Once the great examination hall of a university, I am now Ireland's home of orchestral music, just south of the Green.",
    hint: "On Earlsfort Terrace, a short walk south of St Stephen's Green.",
  },
  "iveagh-gardens": {
    name: "Iveagh Gardens",
    emoji: "🌿",
    clue: "Dublin's 'secret garden' — a hidden Victorian pleasure ground with a rosarium, a maze and a waterfall that few tourists ever find.",
    hint: "Tucked behind the National Concert Hall, entrance off Clonmel Street.",
  },

  // ── Dawson Street / Grafton Street ───────────────────────────
  "grafton-street": {
    name: "Grafton Street",
    emoji: "🎶",
    clue: "Dublin's most famous shopping street, paved just for strolling and alive with buskers — a 'wonderland' in a well-known song.",
    hint: "The pedestrian street between Trinity College and St Stephen's Green.",
  },
  "powerscourt-centre": {
    name: "Powerscourt Townhouse",
    emoji: "🛍️",
    clue: "A grand Georgian merchant's mansion, now a hidden courtyard of cafés and boutiques beneath a soaring glass roof.",
    hint: "On South William Street, just off Grafton Street.",
  },
  "george-street-arcade": {
    name: "George's Street Arcade",
    emoji: "🏬",
    clue: "A red-brick Victorian market arcade, one of the oldest in Europe, full of quirky stalls, vinyl records and fortune-tellers.",
    hint: "Between South Great George's Street and Drury Street.",
  },
  "mansion-house": {
    name: "The Mansion House",
    emoji: "🎩",
    clue: "The Lord Mayor of Dublin has lived in my Queen Anne house since 1715, and the very first Dáil met in my Round Room in 1919.",
    hint: "On Dawson Street, between Trinity and St Stephen's Green.",
  },
  "st-anns-church": {
    name: "St Ann's Church, Dawson Street",
    emoji: "⛪",
    clue: "A grand Romanesque front on Dawson Street. Bram Stoker married here, and I still leave loaves of bread on a shelf for the poor, as a 1723 bequest demands.",
    hint: "On Dawson Street, near the Mansion House.",
  },
  "freemasons-hall": {
    name: "Freemasons' Hall",
    emoji: "🏛️",
    clue: "The home of the Grand Lodge of Ireland — behind my doors are rooms decked out as Egyptian temples, Gothic chapels and more.",
    hint: "On Molesworth Street, off Dawson Street.",
  },
  "phil-lynott": {
    name: "Phil Lynott Statue",
    emoji: "🎸",
    clue: "A bronze rocker with his bass guitar — the frontman of Thin Lizzy, standing outside the pub where the music crowd still gathers.",
    hint: "On Harry Street, off Grafton Street (outside Bruxelles).",
  },
};

// One unique ordered route per team. Each begins in a different direction
// out of Grand Canal Square and ends near O'Donoghue's. No landmark repeats
// across any two routes.
const ROUTES = {
  1: ["samuel-beckett-bridge", "jeanie-johnston", "epic-chq", "custom-house", "famine-memorial", "sean-ocasey-bridge"],
  2: ["rosie-hackett-bridge", "hapenny-bridge", "temple-bar-square", "bank-of-ireland", "molly-malone"],
  3: ["science-gallery", "trinity-front-gate", "campanile", "sweny-pharmacy", "national-gallery", "oscar-wilde"],
  4: ["waterways-box", "grand-canal-dock", "aviva-stadium", "mount-street-bridge", "peppercanister"],
  5: ["huband-bridge", "kavanagh-statue", "wilton-terrace", "fitzwilliam-square", "number-29"],
  6: ["bolands-mill", "grand-canal-locks", "merrion-square", "natural-history", "leinster-house"],
  7: ["national-concert-hall", "iveagh-gardens", "newman-church", "rcsi", "fusiliers-arch"],
  8: ["diving-bell", "windmill-lane", "grafton-street", "powerscourt-centre", "george-street-arcade"],
  9: ["convention-centre", "national-museum", "mansion-house", "freemasons-hall", "phil-lynott"],
  10: ["mv-cill-airne", "little-museum", "stephens-green", "shelbourne-hotel", "st-anns-church"],
};

const getRoute = (teamNum) => ROUTES[teamNum] || [];
// Total submittable steps for a team: every landmark + the final O'Donoghue's photo.
const totalSteps = (teamNum) => getRoute(teamNum).length + 1;

const TEAM_NAMES = [
  "The Wild Rovers",
  "Celtic Thunder",
  "Dublin Daredevils",
  "Liffey Legends",
  "Shamrock Shakers",
  "The Craic Addicts",
  "Guinness Gurus",
  "Temple Trailblazers",
  "Spire Seekers",
  "Ha'penny Heroes",
];

const TEAM_COLORS = [
  "#c44536", "#2a7f62", "#d4a853", "#4a6fa5", "#8b5e3c",
  "#7b4f8a", "#c47a2b", "#3a7d7b", "#9b2335", "#5a8a3c",
];

/* ══════════════════════════════════════════════════════════════
   MESSAGING HELPERS
   ══════════════════════════════════════════════════════════════ */

// messages is an object keyed by id; return a chronologically sorted array.
function sortedMessages(messages) {
  return Object.values(messages || {}).sort((a, b) => (a.at || 0) - (b.at || 0));
}

// Count of team messages sent since the admin's last reply (admin's "unread").
function unreadForAdmin(messages) {
  const arr = sortedMessages(messages);
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].from === "admin") break;
    if (arr[i].from === "team") count++;
  }
  return count;
}

// Count of admin messages sent since the team's last message (team's "unread").
function unreadForTeam(messages) {
  const arr = sortedMessages(messages);
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].from === "team") break;
    if (arr[i].from === "admin") count++;
  }
  return count;
}

async function postMessage(teamNum, from, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  const id = genId();
  await dbSet(`teams/${teamNum}/messages/${id}`, {
    from,
    text: trimmed.slice(0, 2000),
    at: Date.now(),
  });
}

// The clue/target a team is currently working on — used as context for the admin.
function teamContext(teamNum, td) {
  const route = getRoute(teamNum);
  const step = td?.currentStep || 0;
  if (!td?.joined) return { label: "Not joined yet", clue: null };
  if (step >= totalSteps(teamNum)) return { label: "🎉 Finished the whole hunt", clue: null };
  if (step === route.length) {
    return { label: `FINAL clue → ${END_PUB.name} (secret)`, clue: END_PUB.clue };
  }
  const loc = LOCATIONS[route[step]];
  return {
    label: `Clue ${step + 1} of ${route.length} → ${loc.name}`,
    clue: loc.clue,
    hint: loc.hint,
  };
}

/* ══════════════════════════════════════════════════════════════
   ROSTER HELPERS
   ══════════════════════════════════════════════════════════════ */

// members is an object keyed by id; return an array of { id, name, addedAt }
// sorted by the order they were added.
function sortedMembers(members) {
  return Object.entries(members || {})
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
}

/* ══════════════════════════════════════════════════════════════
   LEADERBOARD

   Built from the lightweight `standings/` node (just step + finishedAt
   per team) so hunter phones never have to download everyone's photos.
   Finished teams rank by finish time; the rest sort by progress.
   ══════════════════════════════════════════════════════════════ */

function leaderboard(standings) {
  const rows = Object.entries(standings || {})
    .filter(([num]) => ROUTES[num])
    .map(([num, s]) => ({
      teamNum: Number(num),
      step: s.step || 0,
      finishedAt: s.finishedAt || null,
      total: totalSteps(Number(num)),
    }));
  const finished = rows
    .filter((r) => r.finishedAt)
    .sort((a, b) => a.finishedAt - b.finishedAt);
  const hunting = rows
    .filter((r) => !r.finishedAt)
    .sort((a, b) => b.step - a.step || a.teamNum - b.teamNum);
  finished.forEach((r, i) => (r.rank = i + 1));
  return { rows: [...finished, ...hunting], finishedCount: finished.length };
}

async function setStanding(teamNum, patch) {
  await dbUpdate(`standings/${teamNum}`, patch);
}

/* ══════════════════════════════════════════════════════════════
   THEME
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#0f1f1a",
  bgCard: "#1a2e27",
  bgCardLight: "#243b33",
  cream: "#f5edd8",
  gold: "#d4a853",
  goldLight: "#e8c97a",
  green: "#2a7f62",
  greenLight: "#3aaf85",
  red: "#c44536",
  redLight: "#e05a4a",
  text1: "#f5edd8",
  text2: "#a8bab4",
  border: "#2d4a40",
};

/* ══════════════════════════════════════════════════════════════
   SHARED SMALL COMPONENTS
   ══════════════════════════════════════════════════════════════ */

// A compact chat thread shared by team + admin views.
function MessageThread({ messages, onSend, meLabel, otherLabel, placeholder }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const arr = sortedMessages(messages);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <div>
      <div style={S.chatWindow}>
        {arr.length === 0 ? (
          <p style={{ ...S.cardTextSmall, textAlign: "center", padding: "20px 0" }}>
            No messages yet.
          </p>
        ) : (
          arr.map((m, i) => {
            const mine = m.from === (meLabel === "admin" ? "admin" : "team");
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  marginBottom: 8,
                }}
              >
                <div style={mine ? S.bubbleMine : S.bubbleTheirs}>
                  <div style={{ fontSize: 15, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                    {m.text}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: "right" }}>
                    {m.from === "admin" ? otherLabel === "admin" ? "You" : "Organiser" : mine ? "You" : "Team"} · {fmtTime(m.at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          style={{ ...S.input, marginBottom: 0, textAlign: "left", letterSpacing: 0, fontSize: 15, flex: 1 }}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button style={{ ...S.btnPrimary, width: "auto", padding: "0 20px" }} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SPLASH
   ══════════════════════════════════════════════════════════════ */

function Splash({ onAdmin, onTeam, onResume, teamNum }) {
  return (
    <div style={S.splash}>
      <div style={S.splashInner}>
        <div style={{ fontSize: 72, marginBottom: 8 }}>🗺️</div>
        <h1 style={S.splashTitle}>
          DUBLIN
          <br />
          TREASURE HUNT
        </h1>
        <p style={S.splashSub}>A grand adventure through the streets of Dublin</p>
        <div style={S.divider}>
          <span style={S.dividerLine} />
          <span style={{ fontSize: 20 }}>☘️</span>
          <span style={S.dividerLine} />
        </div>
        <p style={S.splashInfo}>{NUM_TEAMS} Teams · Unique Routes · 1 City</p>
        <p style={S.splashInfoSmall}>
          Starting at {START.name} {START.emoji}
          <br />
          Finishing at a secret final location 🤫
        </p>
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {teamNum ? (
            <button style={S.btnPrimary} onClick={onResume}>
              <span style={{ fontSize: 22 }}>🎯</span> Resume as Team {teamNum}
            </button>
          ) : (
            <button style={S.btnPrimary} onClick={onTeam}>
              <span style={{ fontSize: 22 }}>🏃</span> Join as a Team
            </button>
          )}
          <button style={S.btnOutline} onClick={onAdmin}>
            <span style={{ fontSize: 18 }}>⚙️</span> Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN LOGIN
   ══════════════════════════════════════════════════════════════ */

function AdminLogin({ onLogin, onBack }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const game = await dbGet("game");
    if (!game) {
      const newPin = pin || "6767";
      if (!/^[0-9]{4,6}$/.test(newPin)) {
        setError("PIN must be 4–6 digits.");
        return;
      }
      await dbSet("game", { started: false, mode: "auto", pin: newPin });
      onLogin();
    } else if (game.pin === pin) {
      onLogin();
    } else {
      setError("Wrong PIN. Try again.");
    }
  };

  return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={onBack}>
        ← Back
      </button>
      <div style={S.card}>
        <h2 style={S.cardTitle}>🔐 Admin Access</h2>
        <p style={S.cardText}>Enter the admin PIN (first time sets it):</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError("");
          }}
          placeholder="Enter PIN"
          style={S.input}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        {error && <p style={S.error}>{error}</p>}
        <button style={S.btnPrimary} onClick={handleLogin}>
          Enter
        </button>
        <p style={S.cardTextSmall}>
          First time? Enter any PIN to set it as the admin password.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN DASHBOARD
   ══════════════════════════════════════════════════════════════ */

function AdminDashboard({ onBack }) {
  const [game, setGame] = useState(null);
  const [teams, setTeams] = useState({});
  const [tab, setTab] = useState("overview");
  const [openThread, setOpenThread] = useState(null); // teamNum whose chat is open
  const [rosterOpen, setRosterOpen] = useState({}); // { [teamNum]: bool }

  useEffect(() => {
    const unsubGame = dbListen("game", (val) => {
      if (val) setGame(val);
    });
    const unsubTeams = dbListen("teams", (val) => {
      setTeams(val || {});
    });
    return () => {
      unsubGame();
      unsubTeams();
    };
  }, []);

  const toggleGame = async () => {
    const starting = !game.started;
    // Stamp the hunt start time the first time we go live — it's the baseline
    // every team's finishing time is measured from.
    await dbSet("game", {
      ...game,
      started: starting,
      ...(starting ? { startedAt: Date.now() } : {}),
    });
  };

  const toggleMode = async () => {
    const newMode = game.mode === "auto" ? "approval" : "auto";
    await dbSet("game", { ...game, mode: newMode });
  };

  const approveTeam = async (teamNum) => {
    const td = teams[teamNum];
    if (!td || !td.pendingApproval) return;
    const now = Date.now();
    const newStep = td.currentStep + 1;
    const finishing = newStep >= totalSteps(Number(teamNum));
    await dbUpdate(`teams/${teamNum}`, {
      currentStep: newStep,
      pendingApproval: false,
      lastApproved: now,
      ...(finishing ? { finishedAt: now } : {}),
    });
    await setStanding(Number(teamNum), { step: newStep, ...(finishing ? { finishedAt: now } : {}) });
  };

  const resetGame = async () => {
    if (!window.confirm("Reset the whole game? This wipes every team's progress, photos, messages and the leaderboard.")) return;
    await dbRemove("teams");
    await dbRemove("standings");
    // Fresh game object — keep the PIN, drop the old start time.
    await dbSet("game", { started: false, mode: game.mode, pin: game.pin });
  };

  const kickMember = async (teamNum, memberId, name) => {
    if (!window.confirm(`Remove ${name} from Team ${teamNum}? This just takes them off the roster.`)) return;
    await dbRemove(`teams/${teamNum}/members/${memberId}`);
  };

  const downloadAllPhotos = async () => {
    const items = [];
    Object.entries(teams).forEach(([num, td]) => {
      if (!td.photos) return;
      const route = getRoute(Number(num));
      Object.entries(td.photos).forEach(([step, photo]) => {
        const s = Number(step);
        const locName = s < route.length ? LOCATIONS[route[s]]?.name : END_PUB.name;
        const said = photo.locationName ? `-said-${safeName(photo.locationName)}` : "";
        const filename = `team-${num}-step-${s + 1}-${safeName(locName)}${said}.jpg`;
        items.push({ filename, data: photo.data });
      });
    });
    if (items.length === 0) {
      alert("No photos submitted yet.");
      return;
    }
    for (const { filename, data } of items) {
      triggerDownload(data, filename);
      await new Promise((r) => setTimeout(r, 150));
    }
  };

  const totalPhotos = Object.values(teams).reduce(
    (sum, td) => sum + Object.keys(td.photos || {}).length,
    0
  );

  if (!game) {
    return (
      <div style={S.page}>
        <p style={S.cardText}>Loading…</p>
      </div>
    );
  }

  const teamNums = Array.from({ length: NUM_TEAMS }, (_, i) => i + 1);
  const teamEntries = Object.entries(teams);
  const pendingTeams = teamEntries.filter(([, t]) => t.pendingApproval);
  const activeTeams = teamEntries.filter(([, t]) => t.joined);
  const totalUnread = teamEntries.reduce((n, [, t]) => n + unreadForAdmin(t.messages), 0);

  // Finish order + times for the overview.
  const rankOf = {};
  teamEntries
    .filter(([, t]) => t.finishedAt)
    .sort((a, b) => a[1].finishedAt - b[1].finishedAt)
    .forEach(([num], i) => (rankOf[num] = i + 1));
  const baseline = game.startedAt;

  // ── Individual chat thread view ──
  if (openThread) {
    const num = openThread;
    const td = teams[num] || {};
    const ctx = teamContext(num, td);
    return (
      <div style={S.page}>
        <button style={S.backBtn} onClick={() => setOpenThread(null)}>
          ← Back to dashboard
        </button>
        <h2 style={{ ...S.pageTitle, color: TEAM_COLORS[num - 1] }}>
          Team {num}: {TEAM_NAMES[num - 1]}
        </h2>
        <div style={{ ...S.card, borderLeft: `4px solid ${TEAM_COLORS[num - 1]}` }}>
          <p style={S.cardTextSmall}>📍 Where they're headed now</p>
          <p style={{ ...S.cardText, margin: "4px 0 8px", fontWeight: 700, color: T.cream }}>
            {ctx.label}
          </p>
          {ctx.clue && (
            <p style={{ ...S.hintText, fontStyle: "italic" }}>
              🧩 Their clue: “{ctx.clue}”
            </p>
          )}
          {ctx.hint && (
            <p style={S.cardTextSmall}>💡 Hint available to them: {ctx.hint}</p>
          )}
        </div>
        <MessageThread
          messages={td.messages}
          onSend={(text) => postMessage(num, "admin", text)}
          meLabel="admin"
          otherLabel="admin"
          placeholder="Reply to this team…"
        />
      </div>
    );
  }

  return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={onBack}>
        ← Back
      </button>
      <h1 style={S.pageTitle}>Admin Dashboard</h1>

      {/* Controls */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={game.started ? S.btnDanger : S.btnPrimary} onClick={toggleGame}>
            {game.started ? "⏹ Stop Game" : "▶️ Start Game"}
          </button>
          <button style={S.btnOutline} onClick={toggleMode}>
            Mode: {game.mode === "auto" ? "⚡ Auto" : "👁️ Manual"}
          </button>
          <button
            style={{ ...S.btnOutline, borderColor: T.red, color: T.red }}
            onClick={resetGame}
          >
            🔄 Reset All
          </button>
          <button style={S.btnOutline} onClick={downloadAllPhotos} disabled={totalPhotos === 0}>
            📥 Download Photos ({totalPhotos})
          </button>
        </div>
        <p style={S.cardTextSmall}>
          {game.started ? "🟢 Game is LIVE" : "🔴 Game not started"} · {activeTeams.length} team(s) joined · Mode: {game.mode}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          ["overview", "📊 Teams"],
          ["pending", `⏳ Pending (${pendingTeams.length})`],
          ["messages", `💬 Messages${totalUnread ? ` (${totalUnread})` : ""}`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ ...S.tabBtn, ...(tab === key ? S.tabBtnActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div style={{ display: "grid", gap: 12 }}>
          {teamNums.map((num) => {
            const td = teams[num];
            const route = getRoute(num);
            const total = totalSteps(num);
            const step = td?.currentStep || 0;
            const progress = Math.round((Math.min(step, total) / total) * 100);
            const ctx = teamContext(num, td);
            const unread = unreadForAdmin(td?.messages);
            return (
              <div key={num} style={S.teamCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...S.badge, backgroundColor: TEAM_COLORS[num - 1] }}>{num}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.cream }}>
                      {TEAM_NAMES[num - 1]}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {unread > 0 && (
                      <button style={S.msgPill} onClick={() => setOpenThread(num)}>
                        💬 {unread}
                      </button>
                    )}
                    {td?.pendingApproval && (
                      <button style={S.approveBtn} onClick={() => approveTeam(num)}>
                        ✓
                      </button>
                    )}
                  </div>
                </div>
                <div style={S.progressBar}>
                  <div style={{ ...S.progressFill, width: `${progress}%` }} />
                </div>
                <p style={{ fontSize: 12, color: T.text2, margin: "6px 0 0" }}>
                  {!td?.joined
                    ? "Not joined"
                    : step >= total
                    ? rankOf[num]
                      ? `${medal(rankOf[num])} Finished ${ordinal(rankOf[num])}${
                          baseline && td.finishedAt ? ` · ${fmtDuration(td.finishedAt - baseline)}` : ""
                        }`
                      : "🎉 Finished — at O'Donoghue's!"
                    : td?.pendingApproval
                    ? `⏳ Awaiting approval · ${ctx.label}`
                    : `📍 ${step}/${total} · ${ctx.label}`}
                </p>
                {td?.joined && (() => {
                  const members = sortedMembers(td.members);
                  const open = rosterOpen[num];
                  return (
                    <div style={{ marginTop: 8 }}>
                      <button
                        style={S.rosterToggle}
                        onClick={() => setRosterOpen((p) => ({ ...p, [num]: !p[num] }))}
                      >
                        👥 {members.length} member{members.length === 1 ? "" : "s"}
                        {members.length ? (open ? " ▲" : " ▼") : ""}
                      </button>
                      {open &&
                        (members.length === 0 ? (
                          <p style={S.cardTextSmall}>No members listed for this team.</p>
                        ) : (
                          members.map((m) => (
                            <div key={m.id} style={S.memberRow}>
                              <span style={S.memberName}>{m.name}</span>
                              <button style={S.kickBtn} onClick={() => kickMember(num, m.id, m.name)}>
                                Kick ✕
                              </button>
                            </div>
                          ))
                        ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Pending approvals */}
      {tab === "pending" && (
        <div>
          {pendingTeams.length === 0 ? (
            <div style={S.card}>
              <p style={S.cardText}>No pending approvals ✨</p>
            </div>
          ) : (
            pendingTeams.map(([num, td]) => {
              const route = getRoute(Number(num));
              const loc = LOCATIONS[route[td.currentStep]];
              const photoObj = td.photos?.[td.currentStep];
              const photo = photoObj?.data;
              const said = photoObj?.locationName;
              const filename = `team-${num}-step-${td.currentStep + 1}-${safeName(loc?.name)}.jpg`;
              return (
                <div key={num} style={{ ...S.card, borderLeft: `4px solid ${TEAM_COLORS[num - 1]}` }}>
                  <h3 style={S.cardSubtitle}>
                    Team {num}: {TEAM_NAMES[num - 1]}
                  </h3>
                  <p style={S.cardText}>
                    Should be at:{" "}
                    <strong>
                      {loc?.emoji} {loc?.name}
                    </strong>
                  </p>
                  <p style={{ ...S.cardText, margin: "0 0 10px" }}>
                    📝 Team wrote:{" "}
                    <strong style={{ color: said ? T.goldLight : T.redLight }}>
                      {said || "(no location entered)"}
                    </strong>
                  </p>
                  {photo ? (
                    <>
                      <img src={photo} alt="Team photo" style={S.adminPhoto} />
                      <button
                        style={{ ...S.btnOutline, marginTop: 8 }}
                        onClick={() => triggerDownload(photo, filename)}
                      >
                        📥 Download Photo
                      </button>
                    </>
                  ) : (
                    <p style={{ ...S.cardTextSmall, color: T.redLight }}>⚠️ No photo attached</p>
                  )}
                  <p style={S.cardTextSmall}>Submitted: {fmtTime(td.submittedAt)}</p>
                  <button style={{ ...S.btnPrimary, marginTop: 10 }} onClick={() => approveTeam(Number(num))}>
                    ✅ Approve & Send Next Clue
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Messages */}
      {tab === "messages" && (
        <div style={{ display: "grid", gap: 12 }}>
          {teamEntries.filter(([, t]) => t.messages).length === 0 ? (
            <div style={S.card}>
              <p style={S.cardText}>No messages from any team yet 📭</p>
            </div>
          ) : (
            teamEntries
              .filter(([, t]) => t.messages)
              .sort((a, b) => unreadForAdmin(b[1].messages) - unreadForAdmin(a[1].messages))
              .map(([num, td]) => {
                const arr = sortedMessages(td.messages);
                const last = arr[arr.length - 1];
                const unread = unreadForAdmin(td.messages);
                return (
                  <button key={num} style={S.threadRow} onClick={() => setOpenThread(Number(num))}>
                    <span style={{ ...S.badge, backgroundColor: TEAM_COLORS[num - 1], flexShrink: 0 }}>
                      {num}
                    </span>
                    <div style={{ flex: 1, textAlign: "left", overflow: "hidden" }}>
                      <div style={{ fontWeight: 700, color: T.cream, fontSize: 14 }}>
                        {TEAM_NAMES[num - 1]}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: T.text2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {last ? `${last.from === "admin" ? "You: " : ""}${last.text}` : ""}
                      </div>
                    </div>
                    {unread > 0 && <span style={S.unreadDot}>{unread}</span>}
                  </button>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEAM SELECT
   ══════════════════════════════════════════════════════════════ */

function TeamSelect({ onSelect, onBack }) {
  const [teams, setTeams] = useState({});

  useEffect(() => {
    const unsub = dbListen("teams", (val) => setTeams(val || {}));
    return unsub;
  }, []);

  return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={onBack}>
        ← Back
      </button>
      <h1 style={S.pageTitle}>Choose Your Team</h1>
      <p style={S.subTitle}>The captain picks your team number to join the hunt</p>
      <div style={S.teamSelectGrid}>
        {Array.from({ length: NUM_TEAMS }, (_, i) => i + 1).map((num) => {
          const taken = teams[num]?.joined;
          return (
            <button
              key={num}
              disabled={taken}
              style={{
                ...S.teamSelectBtn,
                borderColor: TEAM_COLORS[num - 1],
                opacity: taken ? 0.5 : 1,
                cursor: taken ? "not-allowed" : "pointer",
              }}
              onClick={() => onSelect(num)}
            >
              <span style={{ ...S.teamSelectNum, backgroundColor: TEAM_COLORS[num - 1] }}>{num}</span>
              <span style={S.teamSelectName}>{TEAM_NAMES[num - 1]}</span>
              {taken && (
                <span style={{ fontSize: 11, color: T.text2, fontStyle: "italic" }}>Joined</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEAM ROSTER (name collection at join time)
   ══════════════════════════════════════════════════════════════ */

function TeamRoster({ teamNum, onDone, onBack }) {
  const [names, setNames] = useState([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const addName = () => {
    const n = draft.trim();
    if (!n) return;
    setNames((prev) => [...prev, n]);
    setDraft("");
  };
  const removeName = (i) => setNames((prev) => prev.filter((_, idx) => idx !== i));

  const join = async () => {
    if (names.length === 0 || saving) return;
    setSaving(true);
    const members = {};
    let t = Date.now();
    names.forEach((name) => {
      members[genId()] = { name: name.slice(0, 80), addedAt: t++ };
    });
    try {
      const existing = await dbGet(`teams/${teamNum}`);
      await dbSet(`teams/${teamNum}`, {
        joined: true,
        currentStep: existing?.currentStep || 0,
        pendingApproval: existing?.pendingApproval || false,
        startedAt: existing?.startedAt || Date.now(),
        members,
      });
      onDone();
    } catch (err) {
      console.error("Failed to join:", err);
      alert("Couldn't join. Check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={onBack}>
        ← Back
      </button>
      <h1 style={{ ...S.pageTitle, color: TEAM_COLORS[teamNum - 1] }}>Team {teamNum}</h1>
      <p style={S.subTitle}>{TEAM_NAMES[teamNum - 1]}</p>
      <div style={S.card}>
        <h3 style={S.cardSubtitle}>👥 Who's on your team?</h3>
        <p style={S.cardTextSmall}>
          Add everyone playing on this team — including you, the captain. The organiser will see
          this list and needs real names, so no nicknames that no one will recognise!
        </p>
        <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
          <input
            style={{ ...S.input, textAlign: "left", letterSpacing: 0, fontSize: 16, marginBottom: 0, flex: 1 }}
            value={draft}
            placeholder="Team member's name"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addName()}
          />
          <button style={{ ...S.btnPrimary, width: "auto", padding: "0 20px" }} onClick={addName}>
            Add
          </button>
        </div>
        {names.length === 0 ? (
          <p style={{ ...S.cardTextSmall, textAlign: "center" }}>No one added yet.</p>
        ) : (
          names.map((n, i) => (
            <div key={i} style={S.memberRow}>
              <span style={S.memberName}>
                {i + 1}. {n}
              </span>
              <button style={S.kickBtn} onClick={() => removeName(i)}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>
      <button
        style={{ ...S.btnPrimary, opacity: names.length === 0 ? 0.5 : 1 }}
        onClick={join}
        disabled={names.length === 0 || saving}
      >
        {saving ? "Joining…" : `🏃 Join with ${names.length} ${names.length === 1 ? "player" : "players"}`}
      </button>
    </div>
  );
}

// Editable roster card shown on the team screen so a captain can fix names,
// add a latecomer, or drop someone mid-hunt. Kept in sync with the admin view.
function RosterCard({ teamNum, members }) {
  const [draft, setDraft] = useState("");
  const list = sortedMembers(members);

  const add = async () => {
    const n = draft.trim();
    if (!n) return;
    await dbSet(`teams/${teamNum}/members/${genId()}`, { name: n.slice(0, 80), addedAt: Date.now() });
    setDraft("");
  };
  const remove = async (id) => {
    await dbRemove(`teams/${teamNum}/members/${id}`);
  };

  return (
    <div style={{ ...S.card, marginTop: 20 }}>
      <h4 style={S.cardSubtitle}>👥 Your team ({list.length})</h4>
      {list.length === 0 && <p style={S.cardTextSmall}>No members listed — add your team below.</p>}
      {list.map((m) => (
        <div key={m.id} style={S.memberRow}>
          <span style={S.memberName}>{m.name}</span>
          <button style={S.kickBtn} onClick={() => remove(m.id)}>
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          style={{ ...S.input, textAlign: "left", letterSpacing: 0, fontSize: 15, marginBottom: 0, flex: 1 }}
          value={draft}
          placeholder="Add a team member"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button style={{ ...S.btnOutline, flex: "none", width: "auto", padding: "0 18px" }} onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   TEAM GAME
   ══════════════════════════════════════════════════════════════ */

function TeamGame({ teamNum, onBack }) {
  const [game, setGame] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [locName, setLocName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [standings, setStandings] = useState({});
  const fileRef = useRef();
  const route = getRoute(teamNum);
  const total = totalSteps(teamNum);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const existing = await dbGet(`teams/${teamNum}`);
      if (!existing) {
        await dbSet(`teams/${teamNum}`, {
          joined: true,
          currentStep: 0,
          pendingApproval: false,
          startedAt: Date.now(),
        });
      } else if (!existing.joined) {
        await dbUpdate(`teams/${teamNum}`, { joined: true });
      }
      // Mirror progress into the lightweight standings node for the leaderboard.
      await setStanding(teamNum, {
        step: existing?.currentStep || 0,
        ...(existing?.finishedAt ? { finishedAt: existing.finishedAt } : {}),
      });
    };
    init();

    const unsubGame = dbListen("game", (val) => {
      if (!cancelled && val) setGame(val);
    });

    const unsubStandings = dbListen("standings", (val) => {
      if (!cancelled) setStandings(val || {});
    });

    const unsubTeam = dbListen(`teams/${teamNum}`, (val) => {
      if (!cancelled && val) {
        setTeamData((prev) => {
          if (prev && val.currentStep > prev.currentStep && !val.pendingApproval) {
            setCelebration(true);
            setTimeout(() => setCelebration(false), 2500);
          }
          return val;
        });
      }
    });

    return () => {
      cancelled = true;
      unsubGame();
      unsubTeam();
      unsubStandings();
    };
  }, [teamNum]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProcessingPhoto(true);
    try {
      const compressed = await compressImage(file);
      setPhoto(compressed);
    } catch (err) {
      console.error("Failed to process photo:", err);
      alert("Couldn't process that photo. Try again.");
    } finally {
      setProcessingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const step = teamData?.currentStep ?? 0;
  const isFinalStep = step === route.length; // O'Donoghue's photo
  const currentLoc = !isFinalStep && step < route.length ? LOCATIONS[route[step]] : null;

  const handleSubmit = async () => {
    if (!photo || submitting) return;
    if (!isFinalStep && !locName.trim()) {
      alert("Please type where you think you are before submitting.");
      return;
    }
    setSubmitting(true);

    const isAuto = game?.mode === "auto";
    // Every step (including the final O'Donoghue's photo) honours the game mode:
    // auto counts instantly, approval waits for the admin. The finish time is
    // therefore the moment the last photo is *accepted*.
    const advance = isAuto;
    const now = Date.now();
    const newStep = step + 1;
    const finishing = advance && newStep >= total;
    const stepKey = step;

    const updates = {
      [`photos/${stepKey}`]: {
        data: photo,
        locationName: isFinalStep ? END_PUB.name : locName.trim().slice(0, 200),
        submittedAt: now,
      },
      submittedAt: now,
      pendingApproval: !advance,
    };
    if (advance) {
      updates.currentStep = newStep;
      updates.lastApproved = now;
    }
    if (finishing) updates.finishedAt = now;

    try {
      await dbUpdate(`teams/${teamNum}`, updates);
      if (advance) {
        await setStanding(teamNum, { step: newStep, ...(finishing ? { finishedAt: now } : {}) });
      }
      setPhoto(null);
      setLocName("");
      setShowHint(false);
      if (advance) {
        setCelebration(true);
        setTimeout(() => setCelebration(false), 2500);
      }
    } catch (err) {
      console.error("Failed to submit:", err);
      alert("Submission failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!game || !teamData) {
    return (
      <div style={S.page}>
        <p style={{ ...S.cardText, textAlign: "center", marginTop: 60 }}>
          Loading your adventure…
        </p>
      </div>
    );
  }

  const unread = unreadForTeam(teamData.messages);

  // ── Waiting for start ──
  if (!game.started) {
    return (
      <div style={S.page}>
        <button style={S.backBtn} onClick={onBack}>
          ← Home
        </button>
        <div style={{ ...S.splashInner, marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>⏳</div>
          <h2 style={S.pageTitle}>Team {teamNum}</h2>
          <h3 style={{ ...S.subTitle, color: TEAM_COLORS[teamNum - 1] }}>{TEAM_NAMES[teamNum - 1]}</h3>
          <div style={{ ...S.card, textAlign: "center", marginTop: 24 }}>
            <p style={S.cardText}>Waiting for the hunt to begin…</p>
            <p style={S.cardTextSmall}>
              The admin will start the game shortly. Get ready at {START.name}! {START.emoji}
            </p>
            <div style={S.pulsingDot} />
          </div>
          <RosterCard teamNum={teamNum} members={teamData.members} />
          <ChatCard
            teamNum={teamNum}
            messages={teamData.messages}
            unread={unread}
            open={showChat}
            setOpen={setShowChat}
          />
        </div>
      </div>
    );
  }

  // ── Completed (past the final O'Donoghue's photo) ──
  if (step >= total) {
    const board = leaderboard(standings);
    const myRow = board.rows.find((r) => r.teamNum === teamNum);
    const myRank = myRow?.rank;
    const baseline = game.startedAt || teamData.startedAt;
    const myTime = teamData.finishedAt && baseline ? teamData.finishedAt - baseline : null;
    return (
      <div style={S.page}>
        <div style={{ ...S.splashInner, marginTop: 40 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>{myRank ? medal(myRank) : "🏆"}</div>
          <h1 style={S.pageTitle}>{myRank ? `You finished ${ordinal(myRank)}!` : "You Did It!"}</h1>
          <h3 style={{ ...S.subTitle, color: T.gold }}>{TEAM_NAMES[teamNum - 1]}</h3>
          {myTime && (
            <div style={S.timeChip}>
              ⏱️ Your time: <strong>{fmtDuration(myTime)}</strong>
            </div>
          )}
          <div style={{ ...S.card, textAlign: "center", marginTop: 20 }}>
            <p style={{ ...S.cardText, fontSize: 18 }}>
              You've completed the Dublin Treasure Hunt! 🎉
            </p>
            <div style={S.pubCard}>
              <span style={{ fontSize: 48 }}>{END_PUB.emoji}</span>
              <h3 style={{ ...S.cardSubtitle, color: T.gold, margin: "8px 0 4px" }}>
                Head inside to join everyone!
              </h3>
              <p style={{ ...S.cardText, fontSize: 20, fontFamily: "'Cinzel', serif" }}>
                {END_PUB.name}
              </p>
              <p style={S.cardTextSmall}>{END_PUB.address}</p>
            </div>
            <p style={S.cardTextSmall}>🍺 Go on in — the rest of the group is waiting for you!</p>
          </div>
          <div style={{ marginTop: 16 }}>
            <h4 style={{ ...S.cardSubtitle, marginBottom: 12 }}>Your Journey</h4>
            {route.map((locId, i) => (
              <div key={i} style={S.journeyItem}>
                <span style={S.journeyNum}>{i + 1}</span>
                <span style={S.journeyName}>
                  {LOCATIONS[locId].emoji} {LOCATIONS[locId].name}
                </span>
                <span style={{ color: T.greenLight, fontWeight: 800 }}>✓</span>
              </div>
            ))}
            <div style={S.journeyItem}>
              <span style={{ ...S.journeyNum, backgroundColor: T.gold }}>🏁</span>
              <span style={S.journeyName}>
                {END_PUB.emoji} {END_PUB.name}
              </span>
              <span style={{ color: T.greenLight, fontWeight: 800 }}>✓</span>
            </div>
          </div>

          <div style={{ ...S.card, marginTop: 16, textAlign: "left" }}>
            <h4 style={{ ...S.cardSubtitle, marginBottom: 12 }}>🏆 Leaderboard</h4>
            <Leaderboard standings={standings} meTeam={teamNum} startedAt={baseline} />
          </div>

          <ChatCard
            teamNum={teamNum}
            messages={teamData.messages}
            unread={unread}
            open={showChat}
            setOpen={setShowChat}
          />
        </div>
      </div>
    );
  }

  // ── Active gameplay ──
  const activeClue = isFinalStep
    ? { emoji: END_PUB.emoji, clueText: END_PUB.clue, hint: END_PUB.hint, label: "FINAL CLUE" }
    : { emoji: currentLoc.emoji, clueText: currentLoc.clue, hint: currentLoc.hint, label: `CLUE #${step + 1}` };

  return (
    <div style={S.page}>
      {celebration && (
        <div style={S.celebration}>
          <div style={S.celebrationInner}>🎉 Location Found! 🎉</div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <button style={S.backBtn} onClick={onBack}>
          ← Home
        </button>
        <span
          style={{
            ...S.badge,
            backgroundColor: TEAM_COLORS[teamNum - 1],
            fontSize: 12,
            padding: "4px 12px",
            borderRadius: 20,
            width: "auto",
            height: "auto",
          }}
        >
          Team {teamNum}
        </span>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={S.cardTextSmall}>
            {isFinalStep ? "Final destination" : `Location ${step + 1} of ${route.length}`}
          </span>
          <span style={S.cardTextSmall}>{Math.round((step / total) * 100)}% complete</span>
        </div>
        <div style={S.progressBar}>
          <div style={{ ...S.progressFill, width: `${(step / total) * 100}%` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 8 }}>
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: i < step ? T.green : i === step ? T.gold : T.border,
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>

      {/* Pending approval */}
      {teamData.pendingApproval ? (
        <div style={{ ...S.card, textAlign: "center", borderColor: T.gold }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
          <h3 style={S.cardSubtitle}>Photo Submitted!</h3>
          {isFinalStep ? (
            <p style={S.cardText}>
              You're at the finish! Waiting for the organiser to check your photo and{" "}
              <strong>officially clock you in</strong>…
            </p>
          ) : (
            <p style={S.cardText}>
              Waiting for the admin to verify your photo at <strong>{currentLoc?.name}</strong>
            </p>
          )}
          <div style={S.pulsingDot} />
          <p style={S.cardTextSmall}>
            {isFinalStep ? "Almost there — your final time is being locked in!" : "Sit tight — the next clue is coming soon!"}
          </p>
        </div>
      ) : (
        <>
          {/* Clue */}
          <div style={S.clueCard}>
            <div style={S.clueHeader}>
              <span style={{ fontSize: 42 }}>{activeClue.emoji}</span>
              <span style={S.clueLabel}>{activeClue.label}</span>
            </div>
            <p style={S.clueText}>{activeClue.clueText}</p>
            <button style={S.hintBtn} onClick={() => setShowHint(!showHint)}>
              {showHint ? "Hide Hint 🙈" : "Need a Hint? 💡"}
            </button>
            {showHint && <p style={S.hintText}>💡 {activeClue.hint}</p>}
          </div>

          {/* Photo */}
          <div style={S.card}>
            <h3 style={S.cardSubtitle}>
              {isFinalStep ? "📸 Photo Outside O'Donoghue's!" : "📸 Prove You're There!"}
            </h3>
            <p style={S.cardTextSmall}>
              {isFinalStep
                ? "Take one last team photo outside the pub to finish the hunt."
                : "Take a team photo at the location to unlock the next clue."}
            </p>
            <div style={S.disclaimer}>
              ⚠️ <strong>Every team member must be visible in the photo.</strong> Captains — make sure
              nobody's left out of shot!
            </div>

            {processingPhoto ? (
              <div style={{ ...S.cameraBtn, cursor: "default" }}>
                <span style={{ fontSize: 36 }}>⏳</span>
                <span>Processing photo…</span>
              </div>
            ) : photo ? (
              <div style={{ marginTop: 12 }}>
                <img src={photo} alt="Team" style={S.previewImg} />
                {!isFinalStep && (
                  <div style={{ marginTop: 12 }}>
                    <label style={S.fieldLabel}>📝 Where are you? (location name)</label>
                    <input
                      style={{ ...S.input, textAlign: "left", letterSpacing: 0, fontSize: 16, marginBottom: 0 }}
                      value={locName}
                      placeholder="e.g. Ha'penny Bridge"
                      onChange={(e) => setLocName(e.target.value)}
                    />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button style={S.btnOutline} onClick={() => setPhoto(null)}>
                    📷 Retake
                  </button>
                  <button style={{ ...S.btnPrimary, flex: 1 }} onClick={handleSubmit} disabled={submitting}>
                    {submitting
                      ? "Submitting…"
                      : isFinalStep
                      ? "🏁 Finish the Hunt!"
                      : "✅ Submit & Get Next Clue"}
                  </button>
                </div>
              </div>
            ) : (
              <button style={S.cameraBtn} onClick={() => fileRef.current?.click()}>
                <span style={{ fontSize: 36 }}>📷</span>
                <span>Tap to Take Team Photo</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhoto}
              style={{ display: "none" }}
            />
          </div>
        </>
      )}

      {/* Team roster */}
      <RosterCard teamNum={teamNum} members={teamData.members} />

      {/* Message the organiser */}
      <ChatCard
        teamNum={teamNum}
        messages={teamData.messages}
        unread={unread}
        open={showChat}
        setOpen={setShowChat}
      />

      {/* Completed locations */}
      {step > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ ...S.cardSubtitle, marginBottom: 10 }}>✅ Completed</h4>
          {route.slice(0, step).map((locId, i) => (
            <div key={i} style={S.journeyItem}>
              <span style={S.journeyNum}>{i + 1}</span>
              <span style={S.journeyName}>
                {LOCATIONS[locId].emoji} {LOCATIONS[locId].name}
              </span>
              <span style={{ color: T.greenLight, fontWeight: 800 }}>✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Collapsible "message the organiser" card used across team screens.
function ChatCard({ teamNum, messages, unread, open, setOpen }) {
  return (
    <div style={{ ...S.card, marginTop: 20, borderColor: unread ? T.gold : T.border }}>
      <button style={S.chatToggle} onClick={() => setOpen(!open)}>
        <span>
          💬 Message the organiser
          {unread > 0 && <span style={S.unreadInline}> {unread} new</span>}
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {!open && (
        <p style={S.cardTextSmall}>
          Lost, or stuck on a clue? Tap to send the admin a message — they can see where you're headed
          and will reply here.
        </p>
      )}
      {open && (
        <div style={{ marginTop: 12 }}>
          <MessageThread
            messages={messages}
            onSend={(text) => postMessage(teamNum, "team", text)}
            meLabel="team"
            otherLabel="team"
            placeholder="Message the organiser…"
          />
        </div>
      )}
    </div>
  );
}

// Ranked list of every team, highlighting the current one. Fed by `standings`.
function Leaderboard({ standings, meTeam, startedAt }) {
  const { rows } = leaderboard(standings);
  if (rows.length === 0) {
    return <p style={S.cardTextSmall}>No teams have joined yet.</p>;
  }
  return (
    <div>
      {rows.map((r) => {
        const me = r.teamNum === meTeam;
        const finished = !!r.finishedAt;
        const time = finished && startedAt ? fmtDuration(r.finishedAt - startedAt) : null;
        return (
          <div key={r.teamNum} style={{ ...S.lbRow, ...(me ? S.lbRowMe : {}) }}>
            <span style={S.lbRank}>{finished ? medal(r.rank) : "🏃"}</span>
            <span
              style={{ ...S.badge, backgroundColor: TEAM_COLORS[r.teamNum - 1], width: 22, height: 22, fontSize: 11 }}
            >
              {r.teamNum}
            </span>
            <span style={S.lbName}>
              {TEAM_NAMES[r.teamNum - 1]}
              {me ? " (you)" : ""}
            </span>
            <span style={S.lbStatus}>
              {finished ? `${ordinal(r.rank)}${time ? ` · ${time}` : ""}` : `${r.step}/${r.total}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */

export default function App() {
  const [teamNum, setTeamNum] = useState(() => {
    try {
      const stored = localStorage.getItem("dh-team");
      return stored ? Number(stored) : null;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState(teamNum ? "team-game" : "splash");
  // A team number chosen but not yet joined (waiting on the roster step).
  // Not persisted to localStorage until the captain finishes joining.
  const [pendingTeam, setPendingTeam] = useState(null);

  useEffect(() => {
    try {
      if (teamNum) localStorage.setItem("dh-team", String(teamNum));
      else localStorage.removeItem("dh-team");
    } catch {
      // ignore — localStorage may be disabled
    }
  }, [teamNum]);

  return (
    <div style={S.root}>
      <style>{cssReset}</style>

      {view === "splash" && (
        <Splash
          onAdmin={() => setView("admin-login")}
          onTeam={() => setView("team-select")}
          onResume={() => setView("team-game")}
          teamNum={teamNum}
        />
      )}
      {view === "admin-login" && (
        <AdminLogin onLogin={() => setView("admin")} onBack={() => setView("splash")} />
      )}
      {view === "admin" && <AdminDashboard onBack={() => setView("splash")} />}
      {view === "team-select" && (
        <TeamSelect
          onSelect={(n) => {
            setPendingTeam(n);
            setView("team-roster");
          }}
          onBack={() => setView("splash")}
        />
      )}
      {view === "team-roster" && pendingTeam && (
        <TeamRoster
          teamNum={pendingTeam}
          onDone={() => {
            setTeamNum(pendingTeam);
            setPendingTeam(null);
            setView("team-game");
          }}
          onBack={() => {
            setPendingTeam(null);
            setView("team-select");
          }}
        />
      )}
      {view === "team-game" && teamNum && (
        <TeamGame teamNum={teamNum} onBack={() => setView("splash")} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CSS RESET & ANIMATIONS
   ══════════════════════════════════════════════════════════════ */

const cssReset = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.1); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes celebrationPop {
    0% { opacity: 0; transform: scale(0.5) translateY(20px); }
    40% { opacity: 1; transform: scale(1.1) translateY(-10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  button:active { transform: scale(0.97); }
`;

/* ══════════════════════════════════════════════════════════════
   STYLE OBJECTS
   ══════════════════════════════════════════════════════════════ */

const S = {
  root: {
    fontFamily: "'Nunito', sans-serif",
    color: T.text1,
    minHeight: "100vh",
    background: `linear-gradient(170deg, ${T.bg} 0%, #0a1612 50%, #111f18 100%)`,
  },

  // Splash
  splash: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: `radial-gradient(ellipse at 50% 30%, rgba(42,127,98,0.15) 0%, transparent 70%)`,
  },
  splashInner: { textAlign: "center", maxWidth: 400, width: "100%", animation: "slideUp 0.6s ease-out", margin: "0 auto" },
  splashTitle: {
    fontFamily: "'Cinzel Decorative', serif",
    fontSize: 36,
    fontWeight: 900,
    color: T.gold,
    lineHeight: 1.2,
    margin: "0 0 12px",
    letterSpacing: 2,
    textShadow: "0 2px 20px rgba(212,168,83,0.3)",
  },
  splashSub: { fontFamily: "'Cinzel', serif", fontSize: 15, color: T.text2, margin: "0 0 20px", letterSpacing: 1 },
  splashInfo: {
    fontFamily: "'Cinzel', serif",
    fontSize: 14,
    color: T.gold,
    fontWeight: 600,
    margin: "0 0 4px",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  splashInfoSmall: { fontSize: 13, color: T.text2, margin: 0, lineHeight: 1.6 },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0" },
  dividerLine: { flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${T.border}, transparent)` },

  // Buttons
  btnPrimary: {
    width: "100%",
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: T.bg,
    backgroundColor: T.gold,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.2s",
  },
  btnOutline: {
    flex: 1,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: T.cream,
    backgroundColor: "transparent",
    border: `2px solid ${T.border}`,
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.2s",
  },
  btnDanger: {
    width: "auto",
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: "#fff",
    backgroundColor: T.red,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  // Page
  page: { padding: "16px 20px 40px", maxWidth: 600, margin: "0 auto", animation: "fadeIn 0.3s ease-out" },
  pageTitle: { fontFamily: "'Cinzel Decorative', serif", fontSize: 26, color: T.gold, margin: "0 0 4px", textAlign: "center" },
  subTitle: { fontFamily: "'Cinzel', serif", fontSize: 14, color: T.text2, textAlign: "center", margin: "0 0 20px" },
  backBtn: {
    background: "none",
    border: "none",
    color: T.text2,
    fontSize: 15,
    fontFamily: "'Nunito', sans-serif",
    cursor: "pointer",
    padding: "8px 0",
    marginBottom: 8,
  },

  // Cards
  card: { backgroundColor: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontFamily: "'Cinzel', serif", fontSize: 20, color: T.cream, margin: "0 0 8px" },
  cardSubtitle: { fontFamily: "'Cinzel', serif", fontSize: 16, color: T.cream, margin: "0 0 6px" },
  cardText: { fontSize: 15, color: T.text2, margin: "0 0 12px", lineHeight: 1.5 },
  cardTextSmall: { fontSize: 13, color: T.text2, margin: "8px 0 0", lineHeight: 1.5, opacity: 0.8 },

  // Input
  input: {
    width: "100%",
    padding: "14px 16px",
    fontSize: 20,
    fontFamily: "'Nunito', sans-serif",
    color: T.cream,
    backgroundColor: T.bgCardLight,
    border: `2px solid ${T.border}`,
    borderRadius: 12,
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 16,
    outline: "none",
  },
  fieldLabel: { display: "block", fontSize: 13, color: T.goldLight, marginBottom: 6, fontWeight: 700 },
  error: { color: T.redLight, fontSize: 14, margin: "0 0 12px", textAlign: "center" },
  disclaimer: {
    marginTop: 12,
    padding: "10px 14px",
    backgroundColor: "rgba(196,69,54,0.12)",
    border: `1px solid ${T.red}66`,
    borderRadius: 10,
    fontSize: 13,
    color: T.cream,
    lineHeight: 1.5,
  },

  // Team cards (admin)
  teamCard: { backgroundColor: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: "50%",
    fontWeight: 800,
    fontSize: 14,
    color: "#fff",
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: `2px solid ${T.green}`,
    backgroundColor: "transparent",
    color: T.greenLight,
    fontSize: 18,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  msgPill: {
    height: 36,
    padding: "0 12px",
    borderRadius: 18,
    border: `2px solid ${T.gold}`,
    backgroundColor: "transparent",
    color: T.goldLight,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  progressBar: { width: "100%", height: 6, backgroundColor: T.bgCardLight, borderRadius: 3, margin: "8px 0 0", overflow: "hidden" },
  progressFill: { height: "100%", background: `linear-gradient(90deg, ${T.green}, ${T.gold})`, borderRadius: 3, transition: "width 0.5s ease" },

  // Tabs
  tabBtn: {
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: T.text2,
    backgroundColor: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    cursor: "pointer",
  },
  tabBtnActive: { color: T.gold, borderColor: T.gold, backgroundColor: T.bgCardLight },

  // Team select
  teamSelectGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  teamSelectBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: 16,
    backgroundColor: T.bgCard,
    border: `2px solid ${T.border}`,
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "'Nunito', sans-serif",
  },
  teamSelectNum: {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
    color: "#fff",
  },
  teamSelectName: { fontWeight: 700, fontSize: 13, color: T.cream, textAlign: "center" },

  // Roster / members
  rosterToggle: {
    background: "none",
    border: "none",
    color: T.text2,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    fontFamily: "'Nunito', sans-serif",
  },
  memberRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "8px 12px",
    backgroundColor: T.bgCardLight,
    borderRadius: 8,
    marginTop: 6,
  },
  memberName: {
    fontSize: 14,
    color: T.cream,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  kickBtn: {
    background: "none",
    border: `1px solid ${T.red}66`,
    color: T.redLight,
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 8,
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "'Nunito', sans-serif",
  },

  // Clue
  clueCard: {
    background: `linear-gradient(135deg, ${T.bgCard} 0%, #1f3a30 100%)`,
    border: `2px solid ${T.gold}40`,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    textAlign: "center",
    animation: "slideUp 0.4s ease-out",
  },
  clueHeader: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 16 },
  clueLabel: {
    fontFamily: "'Cinzel', serif",
    fontSize: 13,
    color: T.gold,
    letterSpacing: 3,
    textTransform: "uppercase",
    fontWeight: 700,
  },
  clueText: { fontSize: 17, color: T.cream, lineHeight: 1.7, fontStyle: "italic", margin: "0 0 16px", whiteSpace: "pre-wrap" },
  hintBtn: {
    background: "none",
    border: `1px solid ${T.border}`,
    color: T.text2,
    fontSize: 13,
    fontFamily: "'Nunito', sans-serif",
    padding: "8px 16px",
    borderRadius: 20,
    cursor: "pointer",
  },
  hintText: { marginTop: 12, fontSize: 14, color: T.goldLight, fontStyle: "italic" },

  // Camera
  cameraBtn: {
    width: "100%",
    padding: "28px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    backgroundColor: T.bgCardLight,
    border: `2px dashed ${T.border}`,
    borderRadius: 16,
    color: T.text2,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    cursor: "pointer",
    marginTop: 12,
    transition: "all 0.2s",
  },
  previewImg: { width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 12, border: `2px solid ${T.border}` },
  adminPhoto: {
    width: "100%",
    maxHeight: 260,
    objectFit: "cover",
    borderRadius: 10,
    border: `2px solid ${T.border}`,
    marginTop: 8,
    display: "block",
  },

  // Journey items
  journeyItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    backgroundColor: T.bgCard,
    borderRadius: 10,
    marginBottom: 6,
  },
  journeyNum: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    backgroundColor: T.green,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  journeyName: { flex: 1, fontSize: 14, color: T.cream },

  // Leaderboard
  timeChip: {
    display: "inline-block",
    margin: "4px auto 0",
    padding: "6px 16px",
    borderRadius: 20,
    backgroundColor: T.bgCardLight,
    border: `1px solid ${T.border}`,
    color: T.cream,
    fontSize: 14,
  },
  lbRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, marginBottom: 4 },
  lbRowMe: { backgroundColor: T.bgCardLight, border: `1px solid ${T.gold}66` },
  lbRank: { fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 },
  lbName: { flex: 1, fontSize: 14, color: T.cream, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  lbStatus: { fontSize: 12, color: T.text2, fontWeight: 700, flexShrink: 0 },

  // Pub card
  pubCard: {
    background: `linear-gradient(135deg, #2a1f0e 0%, #1a2e27 100%)`,
    border: `2px solid ${T.gold}40`,
    borderRadius: 16,
    padding: 20,
    margin: "16px 0",
  },

  // Chat
  chatToggle: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "none",
    border: "none",
    color: T.cream,
    fontFamily: "'Nunito', sans-serif",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
  },
  unreadInline: { color: T.gold, fontWeight: 800 },
  chatWindow: {
    maxHeight: 320,
    overflowY: "auto",
    padding: 12,
    backgroundColor: T.bg,
    borderRadius: 12,
    border: `1px solid ${T.border}`,
  },
  bubbleMine: {
    maxWidth: "80%",
    backgroundColor: T.green,
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "14px 14px 4px 14px",
  },
  bubbleTheirs: {
    maxWidth: "80%",
    backgroundColor: T.bgCardLight,
    color: T.cream,
    padding: "8px 12px",
    borderRadius: "14px 14px 14px 4px",
  },
  threadRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "'Nunito', sans-serif",
    width: "100%",
  },
  unreadDot: {
    minWidth: 22,
    height: 22,
    padding: "0 6px",
    borderRadius: 11,
    backgroundColor: T.gold,
    color: T.bg,
    fontSize: 12,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Celebration
  celebration: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 1000,
    animation: "fadeIn 0.2s",
  },
  celebrationInner: {
    fontSize: 28,
    fontFamily: "'Cinzel Decorative', serif",
    color: T.gold,
    backgroundColor: T.bgCard,
    padding: "30px 40px",
    borderRadius: 20,
    border: `2px solid ${T.gold}`,
    animation: "celebrationPop 0.5s ease-out",
    textAlign: "center",
    textShadow: "0 2px 20px rgba(212,168,83,0.4)",
  },

  // Pulsing dot
  pulsingDot: { width: 12, height: 12, borderRadius: "50%", backgroundColor: T.gold, margin: "16px auto", animation: "pulse 1.5s infinite" },
};
