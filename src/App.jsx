import { useState, useEffect, useRef, useCallback } from "react";
import { dbGet, dbSet, dbRemove, dbListen } from "./firebase.js";

/* ══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */

const LOCATIONS = [
  {
    id: 0,
    name: "Samuel Beckett Bridge",
    clue: "Named for an Irishman who waited endlessly for Godot, I stretch across the Liffey like a harp laid on its side. Find me where the docklands meet the river.",
    hint: "Head east along the quays — look for the striking white cable-stayed bridge",
    emoji: "🌉",
  },
  {
    id: 1,
    name: "Famine Memorial",
    clue: "We are gaunt bronze figures, forever walking toward the emigrant ships on Custom House Quay. Our story is Ireland's greatest tragedy — find us and remember.",
    hint: "North side of the Liffey, east of O'Connell Bridge along the quay",
    emoji: "🗿",
  },
  {
    id: 2,
    name: "Custom House",
    clue: "James Gandon designed my neoclassical beauty in 1791. I watched the Easter Rising and was set ablaze in 1921. My copper dome stands proud on the north bank.",
    hint: "You can't miss my grand facade from across the river",
    emoji: "🏛️",
  },
  {
    id: 3,
    name: "The Spire, O'Connell Street",
    clue: "I pierce the Dublin sky at 120 metres, a needle of stainless steel on Ireland's widest street. Admiral Nelson once stood where I now stand — but I'm far taller.",
    hint: "Right in the middle of Dublin's main thoroughfare",
    emoji: "📍",
  },
  {
    id: 4,
    name: "GPO (General Post Office)",
    clue: "In Easter 1916, Pearse read the Proclamation of the Republic from my steps. Bullet holes still scar my pillars. I am Ireland's most sacred building.",
    hint: "You'll find me on O'Connell Street — look for the iconic columned entrance",
    emoji: "🏤",
  },
  {
    id: 5,
    name: "Ha'penny Bridge",
    clue: "I'm Dublin's most photographed crossing — an elegant iron arch over the Liffey since 1816. Once you'd pay half a penny to cross me. My toll days are long gone, but my charm remains.",
    hint: "A pedestrian bridge connecting Merchant's Arch to Liffey Street",
    emoji: "🌁",
  },
  {
    id: 6,
    name: "Temple Bar Square",
    clue: "Cobblestones, street performers, and more pubs than you can count — I'm Dublin's cultural quarter. My name comes from Sir William Temple, not a place of worship!",
    hint: "South of the Liffey, between Dame Street and the river",
    emoji: "🎭",
  },
  {
    id: 7,
    name: "Molly Malone Statue",
    clue: "She wheeled her wheelbarrow through streets broad and narrow, crying 'cockles and mussels, alive alive oh!' Find her bronze form — she's been a Dublin icon since 1988.",
    hint: "At the bottom of Grafton Street, near Trinity College",
    emoji: "🐚",
  },
  {
    id: 8,
    name: "Trinity College Front Gate",
    clue: "Ireland's oldest university, founded by Elizabeth I in 1592. The Book of Kells hides behind my walls. Pass through my grand entrance and feel centuries of learning.",
    hint: "The grand entrance on College Green — you'll see the campanile beyond",
    emoji: "🎓",
  },
  {
    id: 9,
    name: "St. Stephen's Green",
    clue: "I'm 22 acres of green tranquillity in the city's heart. During the 1916 Rising, both sides paused their fighting so the park keeper could feed my ducks!",
    hint: "At the top of Grafton Street — look for the Fusiliers' Arch",
    emoji: "🌳",
  },
  {
    id: 10,
    name: "Dublin Castle",
    clue: "Built on a Viking fortress, I was the seat of British rule in Ireland for over 700 years. Now I host presidential inaugurations and state events in my grand apartments.",
    hint: "Off Dame Street — enter through the main gate on Castle Street",
    emoji: "🏰",
  },
  {
    id: 11,
    name: "Christ Church Cathedral",
    clue: "Dublin's oldest building — I've stood since 1030 when the Viking King Sitric Silkenbeard built me. Descend to my medieval crypt and you'll find a mummified cat chasing a mummified rat!",
    hint: "Up the hill from Dublin Castle on Christchurch Place",
    emoji: "⛪",
  },
];

const TEAM_NAMES = [
  "The Wild Rovers",
  "Celtic Thunder",
  "Dublin Daredevils",
  "Liffey Legends",
  "Shamrock Shakers",
  "The Craic Addicts",
  "Guinness Gurus",
  "Temple Brawlers",
  "Spire Seekers",
  "Ha'penny Heroes",
  "Viking Voyagers",
  "Castle Crashers",
];

const TEAM_COLORS = [
  "#c44536", "#2a7f62", "#d4a853", "#4a6fa5",
  "#8b5e3c", "#7b4f8a", "#c47a2b", "#3a7d7b",
  "#9b2335", "#5a8a3c", "#6b5b95", "#cc6633",
];

const getTeamRoute = (teamNum) => {
  const offset = teamNum - 1;
  return Array.from({ length: 12 }, (_, i) => (i + offset) % 12);
};

const END_PUB = {
  name: "The Ferryman",
  address: "35 Sir John Rogerson's Quay, Grand Canal Dock",
  emoji: "🍺",
};

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
   COMPONENTS
   ══════════════════════════════════════════════════════════════ */

// ── Splash ────────────────────────────────────────────────────

function Splash({ onAdmin, onTeam }) {
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
        <p style={S.splashInfo}>12 Teams · 12 Locations · 1 City</p>
        <p style={S.splashInfoSmall}>
          Starting at Bord Gáis Energy Theatre
          <br />
          Ending at {END_PUB.name} {END_PUB.emoji}
        </p>
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          <button style={S.btnPrimary} onClick={onTeam}>
            <span style={{ fontSize: 22 }}>🏃</span> Join as a Team
          </button>
          <button style={S.btnOutline} onClick={onAdmin}>
            <span style={{ fontSize: 18 }}>⚙️</span> Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Login ───────────────────────────────────────────────

function AdminLogin({ onLogin, onBack }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const game = await dbGet("game");
    if (!game) {
      // First time — set the PIN
      await dbSet("game", { started: false, mode: "auto", pin: pin || "6767" });
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

// ── Admin Dashboard ───────────────────────────────────────────

function AdminDashboard({ onBack }) {
  const [game, setGame] = useState(null);
  const [teams, setTeams] = useState({});
  const [tab, setTab] = useState("overview");

  // Real-time listeners — no polling needed
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
    const newState = { ...game, started: !game.started };
    await dbSet("game", newState);
  };

  const toggleMode = async () => {
    const newMode = game.mode === "auto" ? "approval" : "auto";
    await dbSet("game", { ...game, mode: newMode });
  };

  const approveTeam = async (teamNum) => {
    const td = teams[teamNum];
    if (!td || !td.pendingApproval) return;
    await dbSet(`teams/${teamNum}`, {
      ...td,
      currentStep: td.currentStep + 1,
      pendingApproval: false,
      lastApproved: Date.now(),
    });
  };

  const resetGame = async () => {
    await dbRemove("teams");
    await dbSet("game", { ...game, started: false });
  };

  if (!game) {
    return (
      <div style={S.page}>
        <p style={S.cardText}>Loading…</p>
      </div>
    );
  }

  const teamEntries = Object.entries(teams);
  const pendingTeams = teamEntries.filter(([, t]) => t.pendingApproval);
  const activeTeams = teamEntries.filter(([, t]) => t.joined);

  return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={onBack}>
        ← Back
      </button>
      <h1 style={S.pageTitle}>Admin Dashboard</h1>

      {/* Controls */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            style={game.started ? S.btnDanger : S.btnPrimary}
            onClick={toggleGame}
          >
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
        </div>
        <p style={S.cardTextSmall}>
          {game.started ? "🟢 Game is LIVE" : "🔴 Game not started"} ·{" "}
          {activeTeams.length} team(s) joined · Mode: {game.mode}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["overview", "pending"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...S.tabBtn,
              ...(tab === t ? S.tabBtnActive : {}),
            }}
          >
            {t === "overview"
              ? "📊 Teams"
              : `⏳ Pending (${pendingTeams.length})`}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
            const td = teams[num];
            const route = getTeamRoute(num);
            const step = td?.currentStep || 0;
            const progress = Math.round((step / 12) * 100);
            const currentLoc = step < 12 ? LOCATIONS[route[step]] : null;
            return (
              <div key={num} style={S.teamCard}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        ...S.badge,
                        backgroundColor: TEAM_COLORS[num - 1],
                      }}
                    >
                      {num}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.cream }}>
                      {TEAM_NAMES[num - 1]}
                    </span>
                  </div>
                  {td?.pendingApproval && (
                    <button style={S.approveBtn} onClick={() => approveTeam(num)}>
                      ✓
                    </button>
                  )}
                </div>
                <div style={S.progressBar}>
                  <div style={{ ...S.progressFill, width: `${progress}%` }} />
                </div>
                <p style={{ fontSize: 12, color: T.text2, margin: "6px 0 0" }}>
                  {!td?.joined
                    ? "Not joined"
                    : step >= 12
                    ? "🎉 Finished!"
                    : td?.pendingApproval
                    ? `⏳ Awaiting approval at ${currentLoc?.name}`
                    : `📍 ${step}/12 — Heading to ${currentLoc?.name}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {tab === "pending" && (
        <div>
          {pendingTeams.length === 0 ? (
            <div style={S.card}>
              <p style={S.cardText}>No pending approvals ✨</p>
            </div>
          ) : (
            pendingTeams.map(([num, td]) => {
              const route = getTeamRoute(Number(num));
              const loc = LOCATIONS[route[td.currentStep]];
              return (
                <div
                  key={num}
                  style={{
                    ...S.card,
                    borderLeft: `4px solid ${TEAM_COLORS[num - 1]}`,
                  }}
                >
                  <h3 style={S.cardSubtitle}>
                    Team {num}: {TEAM_NAMES[num - 1]}
                  </h3>
                  <p style={S.cardText}>
                    Claims to be at:{" "}
                    <strong>
                      {loc.emoji} {loc.name}
                    </strong>
                  </p>
                  <p style={S.cardTextSmall}>
                    Submitted: {new Date(td.submittedAt).toLocaleTimeString()}
                  </p>
                  <button
                    style={{ ...S.btnPrimary, marginTop: 10 }}
                    onClick={() => approveTeam(Number(num))}
                  >
                    ✅ Approve & Send Next Clue
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Select ───────────────────────────────────────────────

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
      <p style={S.subTitle}>Pick your team number to join the hunt</p>
      <div style={S.teamSelectGrid}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => {
          const taken = teams[num]?.joined;
          return (
            <button
              key={num}
              style={{
                ...S.teamSelectBtn,
                borderColor: TEAM_COLORS[num - 1],
                opacity: taken ? 0.5 : 1,
              }}
              onClick={() => onSelect(num)}
            >
              <span
                style={{
                  ...S.teamSelectNum,
                  backgroundColor: TEAM_COLORS[num - 1],
                }}
              >
                {num}
              </span>
              <span style={S.teamSelectName}>{TEAM_NAMES[num - 1]}</span>
              {taken && (
                <span style={{ fontSize: 11, color: T.text2, fontStyle: "italic" }}>
                  Joined
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Team Game ─────────────────────────────────────────────────

function TeamGame({ teamNum, onBack }) {
  const [game, setGame] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const prevStepRef = useRef(null);
  const fileRef = useRef();
  const route = getTeamRoute(teamNum);

  // Initialise team in DB and listen for updates
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const existing = await dbGet(`teams/${teamNum}`);
      if (!existing) {
        const initial = {
          joined: true,
          currentStep: 0,
          pendingApproval: false,
          startedAt: Date.now(),
        };
        await dbSet(`teams/${teamNum}`, initial);
      } else if (!existing.joined) {
        await dbSet(`teams/${teamNum}`, { ...existing, joined: true });
      }
    };
    init();

    const unsubGame = dbListen("game", (val) => {
      if (!cancelled && val) setGame(val);
    });

    const unsubTeam = dbListen(`teams/${teamNum}`, (val) => {
      if (!cancelled && val) {
        setTeamData((prev) => {
          // Celebrate when step advances (admin approval in manual mode)
          if (
            prev &&
            val.currentStep > prev.currentStep &&
            !val.pendingApproval
          ) {
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
    };
  }, [teamNum]);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!photo || submitting) return;
    setSubmitting(true);

    const isAuto = game?.mode === "auto";
    const newData = {
      ...teamData,
      pendingApproval: !isAuto,
      submittedAt: Date.now(),
      ...(isAuto
        ? { currentStep: teamData.currentStep + 1, lastApproved: Date.now() }
        : {}),
    };
    await dbSet(`teams/${teamNum}`, newData);
    setPhoto(null);
    setShowHint(false);
    setSubmitting(false);

    if (isAuto) {
      setCelebration(true);
      setTimeout(() => setCelebration(false), 2500);
    }
  };

  // ── Loading state ──
  if (!game || !teamData) {
    return (
      <div style={S.page}>
        <p style={{ ...S.cardText, textAlign: "center", marginTop: 60 }}>
          Loading your adventure…
        </p>
      </div>
    );
  }

  const step = teamData.currentStep;
  const currentLocIdx = step < 12 ? route[step] : null;
  const currentLoc = currentLocIdx !== null ? LOCATIONS[currentLocIdx] : null;

  // ── Waiting for start ──
  if (!game.started) {
    return (
      <div style={S.page}>
        <button style={S.backBtn} onClick={onBack}>
          ← Leave
        </button>
        <div style={{ ...S.splashInner, marginTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>⏳</div>
          <h2 style={S.pageTitle}>Team {teamNum}</h2>
          <h3 style={{ ...S.subTitle, color: TEAM_COLORS[teamNum - 1] }}>
            {TEAM_NAMES[teamNum - 1]}
          </h3>
          <div style={{ ...S.card, textAlign: "center", marginTop: 24 }}>
            <p style={S.cardText}>Waiting for the hunt to begin…</p>
            <p style={S.cardTextSmall}>
              The admin will start the game shortly. Get ready at Bord Gáis
              Energy Theatre! 🎭
            </p>
            <div style={S.pulsingDot} />
          </div>
        </div>
      </div>
    );
  }

  // ── Completed ──
  if (step >= 12) {
    return (
      <div style={S.page}>
        <div style={{ ...S.splashInner, marginTop: 40 }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>🏆</div>
          <h1 style={S.pageTitle}>You Did It!</h1>
          <h3 style={{ ...S.subTitle, color: T.gold }}>
            {TEAM_NAMES[teamNum - 1]}
          </h3>
          <div style={{ ...S.card, textAlign: "center", marginTop: 20 }}>
            <p style={{ ...S.cardText, fontSize: 18 }}>
              You've conquered all 12 locations across Dublin!
            </p>
            <div style={S.pubCard}>
              <span style={{ fontSize: 48 }}>{END_PUB.emoji}</span>
              <h3
                style={{
                  ...S.cardSubtitle,
                  color: T.gold,
                  margin: "8px 0 4px",
                }}
              >
                Now head to the finish!
              </h3>
              <p
                style={{
                  ...S.cardText,
                  fontSize: 20,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                {END_PUB.name}
              </p>
              <p style={S.cardTextSmall}>{END_PUB.address}</p>
            </div>
            <p style={S.cardTextSmall}>🍺 A well-earned pint awaits you!</p>
          </div>
          <div style={{ marginTop: 16 }}>
            <h4 style={{ ...S.cardSubtitle, marginBottom: 12 }}>
              Your Journey
            </h4>
            {route.map((locIdx, i) => (
              <div key={i} style={S.journeyItem}>
                <span style={S.journeyNum}>{i + 1}</span>
                <span style={S.journeyName}>
                  {LOCATIONS[locIdx].emoji} {LOCATIONS[locIdx].name}
                </span>
                <span style={{ color: T.greenLight, fontWeight: 800 }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Active gameplay ──
  return (
    <div style={S.page}>
      {/* Celebration overlay */}
      {celebration && (
        <div style={S.celebration}>
          <div style={S.celebrationInner}>🎉 Location Found! 🎉</div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <button style={S.backBtn} onClick={onBack}>
          ← Leave
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <span style={S.cardTextSmall}>
            Location {step + 1} of 12
          </span>
          <span style={S.cardTextSmall}>
            {Math.round((step / 12) * 100)}% complete
          </span>
        </div>
        <div style={S.progressBar}>
          <div
            style={{ ...S.progressFill, width: `${(step / 12) * 100}%` }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 4,
            marginTop: 8,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor:
                  i < step ? T.green : i === step ? T.gold : T.border,
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
          <p style={S.cardText}>
            Waiting for the admin to verify your selfie at{" "}
            <strong>{currentLoc.name}</strong>
          </p>
          <div style={S.pulsingDot} />
          <p style={S.cardTextSmall}>
            Sit tight — the next clue is coming soon!
          </p>
        </div>
      ) : (
        <>
          {/* Clue */}
          <div style={S.clueCard}>
            <div style={S.clueHeader}>
              <span style={{ fontSize: 42 }}>{currentLoc.emoji}</span>
              <span style={S.clueLabel}>CLUE #{step + 1}</span>
            </div>
            <p style={S.clueText}>{currentLoc.clue}</p>
            <button
              style={S.hintBtn}
              onClick={() => setShowHint(!showHint)}
            >
              {showHint ? "Hide Hint 🙈" : "Need a Hint? 💡"}
            </button>
            {showHint && (
              <p style={S.hintText}>💡 {currentLoc.hint}</p>
            )}
          </div>

          {/* Photo */}
          <div style={S.card}>
            <h3 style={S.cardSubtitle}>📸 Prove You're There!</h3>
            <p style={S.cardTextSmall}>
              Take a team selfie at the location to unlock the next clue
            </p>

            {photo ? (
              <div style={{ marginTop: 12 }}>
                <img src={photo} alt="Selfie" style={S.previewImg} />
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button style={S.btnOutline} onClick={() => setPhoto(null)}>
                    📷 Retake
                  </button>
                  <button
                    style={{ ...S.btnPrimary, flex: 1 }}
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting…" : "✅ Submit & Get Next Clue"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                style={S.cameraBtn}
                onClick={() => fileRef.current?.click()}
              >
                <span style={{ fontSize: 36 }}>📷</span>
                <span>Tap to Take Selfie</span>
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

      {/* Completed locations */}
      {step > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ ...S.cardSubtitle, marginBottom: 10 }}>
            ✅ Completed
          </h4>
          {route.slice(0, step).map((locIdx, i) => (
            <div key={i} style={S.journeyItem}>
              <span style={S.journeyNum}>{i + 1}</span>
              <span style={S.journeyName}>
                {LOCATIONS[locIdx].emoji} {LOCATIONS[locIdx].name}
              </span>
              <span style={{ color: T.greenLight, fontWeight: 800 }}>✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */

export default function App() {
  const [view, setView] = useState("splash");
  const [teamNum, setTeamNum] = useState(null);

  return (
    <div style={S.root}>
      <style>{cssReset}</style>

      {view === "splash" && (
        <Splash
          onAdmin={() => setView("admin-login")}
          onTeam={() => setView("team-select")}
        />
      )}
      {view === "admin-login" && (
        <AdminLogin
          onLogin={() => setView("admin")}
          onBack={() => setView("splash")}
        />
      )}
      {view === "admin" && (
        <AdminDashboard onBack={() => setView("splash")} />
      )}
      {view === "team-select" && (
        <TeamSelect
          onSelect={(n) => {
            setTeamNum(n);
            setView("team-game");
          }}
          onBack={() => setView("splash")}
        />
      )}
      {view === "team-game" && teamNum && (
        <TeamGame
          teamNum={teamNum}
          onBack={() => {
            setTeamNum(null);
            setView("splash");
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CSS RESET & ANIMATIONS
   ══════════════════════════════════════════════════════════════ */

const cssReset = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=Nunito:wght@400;600;700;800&display=swap');

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
  splashInner: { textAlign: "center", maxWidth: 400, width: "100%", animation: "slideUp 0.6s ease-out" },
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
  splashSub: {
    fontFamily: "'Cinzel', serif",
    fontSize: 15,
    color: T.text2,
    margin: "0 0 20px",
    letterSpacing: 1,
  },
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
  pageTitle: {
    fontFamily: "'Cinzel Decorative', serif",
    fontSize: 26,
    color: T.gold,
    margin: "0 0 4px",
    textAlign: "center",
  },
  subTitle: {
    fontFamily: "'Cinzel', serif",
    fontSize: 14,
    color: T.text2,
    textAlign: "center",
    margin: "0 0 20px",
  },
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
  card: {
    backgroundColor: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
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
  error: { color: T.redLight, fontSize: 14, margin: "0 0 12px", textAlign: "center" },

  // Team cards (admin)
  teamCard: {
    backgroundColor: T.bgCard,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 14,
  },
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
  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: T.bgCardLight,
    borderRadius: 3,
    margin: "8px 0 0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: `linear-gradient(90deg, ${T.green}, ${T.gold})`,
    borderRadius: 3,
    transition: "width 0.5s ease",
  },

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
  clueText: { fontSize: 17, color: T.cream, lineHeight: 1.7, fontStyle: "italic", margin: "0 0 16px" },
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
  previewImg: {
    width: "100%",
    maxHeight: 300,
    objectFit: "cover",
    borderRadius: 12,
    border: `2px solid ${T.border}`,
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

  // Pub card
  pubCard: {
    background: `linear-gradient(135deg, #2a1f0e 0%, #1a2e27 100%)`,
    border: `2px solid ${T.gold}40`,
    borderRadius: 16,
    padding: 20,
    margin: "16px 0",
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
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    backgroundColor: T.gold,
    margin: "16px auto",
    animation: "pulse 1.5s infinite",
  },
};
