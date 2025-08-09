import React, { useEffect, useMemo, useRef, useState } from "react";

// Raccoon Rocket — v0.3.b (React canvas)
// - Radar pings hidden parts
// - Loss screen shows remaining part locations
// - Water mechanics with 5s trap and land connectivity

const randi = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const choice = arr => arr[Math.floor(Math.random() * arr.length)];

const GRID_W = 18;
const GRID_H = 14;
const TOTAL = GRID_W * GRID_H;

const PieceIDs = ["nose", "window", "body", "engine", "fin-left", "fin-right"];
const BonusIDs = ["speed", "score", "radar", "time"];
const PenaltyIDs = ["slow", "oops", "sandstorm"];

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg,#f3f8ff,#fff6e6)",
    color: "#1f2a37",
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid #e5e7eb",
    background: "rgba(255,255,255,.7)",
    backdropFilter: "blur(6px)",
  },
  wrap: { maxWidth: 1100, margin: "0 auto", padding: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginTop: 16 },
  card: {
    background: "#fff",
    borderRadius: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,.08)",
    padding: 14,
  },
  btn: {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    color: "#fff",
    background: "#111827",
    cursor: "pointer",
  },
  chip: { padding: "6px 10px", borderRadius: 999, color: "#fff", fontWeight: 700, boxShadow: "0 3px 10px rgba(0,0,0,.15)" },
};

function RaccoonIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-label="raccoon">
      <circle cx="64" cy="64" r="60" fill="#f4efe6" stroke="#a8a29e" strokeWidth="4" />
      <ellipse cx="44" cy="62" rx="28" ry="20" fill="#4b5563" />
      <ellipse cx="84" cy="62" rx="28" ry="20" fill="#4b5563" />
      <circle cx="44" cy="62" r="10" fill="#111827" />
      <circle cx="84" cy="62" r="10" fill="#111827" />
      <circle cx="44" cy="62" r="4" fill="#fff" />
      <circle cx="84" cy="62" r="4" fill="#fff" />
      <ellipse cx="64" cy="88" rx="12" ry="8" fill="#fb7185" />
      <path d="M30 40 L64 20 L98 40" fill="#9ca3af" />
    </svg>
  );
}

function pieceSVGPath(id) {
  switch (id) {
    case "nose":
      return <path d="M50 5 L80 60 L20 60 Z" fill="url(#g1)" stroke="#8b1d1d" strokeWidth="3" />;
    case "window":
      return <circle cx="50" cy="50" r="30" fill="#7ad3ff" stroke="#1f6b8b" strokeWidth="5" />;
    case "body":
      return <rect x="25" y="10" width="50" height="80" rx="12" fill="#f7b733" stroke="#8a5a00" strokeWidth="5" />;
    case "engine":
      return <path d="M20 70 H80 V90 L50 95 L20 90 Z" fill="#9aa1a6" stroke="#3d4348" strokeWidth="4" />;
    case "fin-left":
      return <path d="M25 50 L10 90 L45 75 Z" fill="#90e39a" stroke="#2c6e34" strokeWidth="4" />;
    case "fin-right":
      return <path d="M75 50 L55 75 L90 90 Z" fill="#90e39a" stroke="#2c6e34" strokeWidth="4" />;
    default:
      return null;
  }
}

function PieceSVG({ id, size = 60 }) {
  const defs =
    id === "nose" ? (
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop stopColor="#ff7a7a" offset="0" />
          <stop stopColor="#ff3d3d" offset="1" />
        </linearGradient>
      </defs>
    ) : null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {defs}
      {pieceSVGPath(id)}
    </svg>
  );
}

const RocketLayout = [
  { id: "nose", left: 90, top: 0 },
  { id: "window", left: 90, top: 90 },
  { id: "body", left: 90, top: 180 },
  { id: "engine", left: 90, top: 300 },
  { id: "fin-left", left: 10, top: 270 },
  { id: "fin-right", left: 170, top: 270 },
];

const xy2i = (x, y) => y * GRID_W + x;
const inside = (x, y) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;

export default function App() {
  const [cells, setCells] = useState(() => makeBoard());
  const [pos, setPos] = useState({ x: 1, y: 1 });
  const [lastLandPos, setLastLandPos] = useState({ x: 1, y: 1 });
  const [inventory, setInventory] = useState([]);
  const [placed, setPlaced] = useState({});
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [ringReveal, setRingReveal] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [menu, setMenu] = useState("home");
  const [toast, setToast] = useState("");
  const [effect, setEffect] = useState(null); // {type,label}
  const [trap, setTrap] = useState({ active: false, until: 0 });
  const lastMoveRef = useRef(0);

  // timer
  useEffect(() => {
    if (menu !== "playing") return;
    const id = setInterval(() => setTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [menu]);

  useEffect(() => {
    if (timeLeft === 0 && menu === "playing") setMenu("lose");
  }, [timeLeft, menu]);

  // keyboard
  useEffect(() => {
    const onKey = e => {
      if (menu !== "playing") return;
      if (trap.active) return; // frozen while trapped
      const now = performance.now();
      const throttle = 100 / speed;
      if (now - lastMoveRef.current < throttle) return;
      let dx = 0, dy = 0;
      if (["w", "W", "ArrowUp"].includes(e.key)) dy = -1;
      if (["s", "S", "ArrowDown"].includes(e.key)) dy = 1;
      if (["a", "A", "ArrowLeft"].includes(e.key)) dx = -1;
      if (["d", "D", "ArrowRight"].includes(e.key)) dx = 1;
      if (!dx && !dy) return;
      lastMoveRef.current = now;
      const nx = Math.max(0, Math.min(GRID_W - 1, pos.x + dx));
      const ny = Math.max(0, Math.min(GRID_H - 1, pos.y + dy));
      moveTo(nx, ny);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, speed, pos, trap]);

  // Trap timer UI heartbeat
  useEffect(() => {
    if (!trap.active) return;
    const t = setInterval(() => {
      if (Date.now() >= trap.until) {
        setTrap({ active: false, until: 0 });
        setPos(lastLandPos);
        playEffect("glow", "Rescued from water");
      }
    }, 200);
    return () => clearInterval(t);
  }, [trap, lastLandPos]);

  const flashToast = text => {
    setToast(text);
    clearTimeout(flashToast._t);
    flashToast._t = setTimeout(() => setToast(""), 1200);
  };

  const playEffect = (type, label, ms = 1200) => {
    setEffect({ type, label });
    clearTimeout(playEffect._t);
    playEffect._t = setTimeout(() => setEffect(null), ms);
  };

  function handleBonus(id) {
    if (id === "speed") {
      setSpeed(v => Math.min(1.9, v + 0.35));
      setScore(s => s + 25);
      playEffect("speed", "Speed Boost!");
    } else if (id === "score") {
      setScore(s => s + 120);
      playEffect("glow", "+120 Points!");
    } else if (id === "radar") {
      setRingReveal(true);
      const DURATION = 6500;
      playEffect("glow", "Radar On", DURATION);
      setTimeout(() => setRingReveal(false), DURATION);
    } else if (id === "time") {
      setTimeLeft(t => t + 25);
      playEffect("glow", "+25s");
    }
  }
  function handlePenalty(id) {
    if (id === "slow") {
      setSpeed(v => Math.max(0.6, v - 0.3));
      setScore(s => Math.max(0, s - 20));
      playEffect("shake", "Sticky Sand");
    } else if (id === "oops") {
      setScore(s => Math.max(0, s - 80));
      playEffect("shake", "Oops! -80");
    } else if (id === "sandstorm") {
      playEffect("sandstorm", "SANDSTORM!", 1800);
      setCells(prev => {
        const copy = [...prev];
        for (let i = 0; i < 18; i++) {
          const idx = randi(0, TOTAL - 1);
          if (copy[idx].type === "water") continue; // water unaffected
          copy[idx] = { ...copy[idx], seen: false, layers: Math.min(3, (copy[idx].layers || 0) + 1) };
        }
        return copy;
      });
    }
  }

  function moveTo(nx, ny) {
    const idx = xy2i(nx, ny);
    const cell = cells[idx];

    // Entering water triggers a trap. No digging. No movement beyond.
    if (cell.type === "water") {
      setPos({ x: nx, y: ny });
      setTrap({ active: true, until: Date.now() + 5000 });
      playEffect("shake", "Splash! Trapped in water", 1200);
      return;
    }

    // Normal land movement + digging
    setPos({ x: nx, y: ny });
    setLastLandPos({ x: nx, y: ny });
    digAt(nx, ny);
  }

  function digAt(x, y) {
    setCells(prev => {
      const idx = xy2i(x, y);
      const c = prev[idx];
      if (c.type === "water") return prev; // redundant safety
      const cell = { ...c, seen: true };
      const copy = [...prev];
      if ((cell.layers ?? 1) > 0) {
        cell.layers = (cell.layers ?? 1) - 1;
        copy[idx] = cell;
        setScore(s => s + 1);
        return copy;
      }
      if (cell.payload) {
        const pay = cell.payload;
        cell.payload = null;
        copy[idx] = cell;
        if (pay.kind === "piece") {
          setInventory(inv => (inv.includes(pay.id) ? inv : [...inv, pay.id]));
          setScore(s => s + 60);
          flashToast("Found a rocket part!");
          playEffect("glow", "Rocket Part!");
        } else if (pay.kind === "bonus") {
          handleBonus(pay.id);
        } else if (pay.kind === "penalty") {
          handlePenalty(pay.id);
        }
        return copy;
      }
      copy[idx] = cell;
      setScore(s => s + 1);
      return copy;
    });
  }

  useEffect(() => {
    if (PieceIDs.every(id => placed[id]) && menu === "playing") setMenu("win");
  }, [placed, menu]);

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
  };
  const onDrop = (e, slotId) => {
    e.preventDefault();
    const pieceId = e.dataTransfer.getData("text/plain");
    if (!pieceId) return;
    if (pieceId === slotId) {
      setPlaced(p => ({ ...p, [slotId]: true }));
      setInventory(inv => inv.filter(x => x !== pieceId));
      setScore(s => s + 160);
      flashToast("Part Installed");
      playEffect("glow", "Part Installed");
    } else {
      setScore(s => Math.max(0, s - 10));
      flashToast("That doesn't go there.");
    }
  };
  const onDragOver = e => e.preventDefault();

  const nearbyRing = useMemo(() => {
    if (!ringReveal) return new Set();
    const ring = new Set();
    for (let yy = -2; yy <= 2; yy++) {
      for (let xx = -2; xx <= 2; xx++) {
        const x = pos.x + xx;
        const y = pos.y + yy;
        if (inside(x, y)) ring.add(xy2i(x, y));
      }
    }
    return ring;
  }, [ringReveal, pos]);

  const placedCount = Object.values(placed).filter(Boolean).length;

  return (
    <div style={styles.page} className={effect?.type === "sandstorm" ? "wiggle" : undefined}>
      <style>{`
        .grid{display:grid;gap:6px}
        .row{display:flex;gap:8px;align-items:center}
        .hud{display:flex;gap:8px;align-items:center}
        .cell{position:relative;width:36px;height:36px;border-radius:6px;border:1px solid rgba(217,119,6,.5);transition:opacity .15s,transform .05s}
        .seen{opacity:1}
        .unseen{opacity:.6}

        /* Sand depth -> bedrock visual: 3..1 = sand hues, 0 = gray rock */
        .layer3{background:#d97706}
        .layer2{background:#f59e0b}
        .layer1{background:#fbbf24}
        .layer0{
          background:#9ca3af;
          background-image:
            radial-gradient(1px 1px at 10% 20%, rgba(0,0,0,.12), transparent 60%),
            radial-gradient(1px 1px at 70% 80%, rgba(0,0,0,.12), transparent 60%),
            radial-gradient(1px 1px at 40% 50%, rgba(0,0,0,.12), transparent 60%);
          border-color: rgba(55,65,81,.5);
        }

        .grain{position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(45deg,rgba(0,0,0,.05),rgba(0,0,0,.05) 6px,rgba(0,0,0,.1) 6px,rgba(0,0,0,.1) 12px)}
        .radar{outline:4px solid rgba(236,72,153,.6)}

        .overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:20}

        .effectWrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:40}
        .effectCard{display:flex;gap:8px;align-items:center;color:#fff;font-weight:900;padding:14px 18px;border-radius:14px;box-shadow:0 18px 40px rgba(0,0,0,.35);font-size:22px;letter-spacing:.5px}

        .glow{background:#7c3aed}
        .speed{background:#10b981;animation:pulse .8s infinite}
        .shake{background:#ef4444}

        /* Make Sandstorm extra legible */
        .sandstorm{
          background:#0b1220;
          border:3px solid #f59e0b;
          color:#fde68a;
          text-shadow:0 2px 0 rgba(0,0,0,.5), 0 0 10px rgba(245,158,11,.4);
        }

        @keyframes pulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
        .wiggle{animation:wiggle .15s ease-in-out 10}
        @keyframes wiggle{0%,100%{transform:translate(0)}25%{transform:translate(-4px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,-3px)}}
        .toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#111827;color:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.2);opacity:0;transition:all .2s;z-index:50}
        .toast.show{opacity:1;transform:translate(-50%,0)}
        .speedlines{position:fixed;inset:0;pointer-events:none;z-index:30;opacity:.28;background:repeating-linear-gradient(90deg,transparent,transparent 12px,white 12px,white 13px)}

        /* Blowing sand overlay during sandstorm */
        .sandFX{ position:fixed;inset:0;pointer-events:none;z-index:35; background: repeating-linear-gradient(10deg, rgba(245,158,11,.0), rgba(245,158,11,.0) 12px, rgba(245,158,11,.15) 12px, rgba(245,158,11,.15) 18px); mix-blend-mode:multiply; animation:sweep 1.2s linear infinite; opacity:.65; }
        @keyframes sweep{ from{background-position:0 0} to{background-position:200px -200px} }

        /* Water tiles */
        .water{
          background: radial-gradient(circle at 30% 30%, #93c5fd 0%, #60a5fa 40%, #3b82f6 100%);
          border-color: rgba(29,78,216,.6);
          position:relative;
        }
        .water:after{
          content:""; position:absolute; inset:0; border-radius:6px;
          background: radial-gradient(ellipse at 60% 40%, rgba(255,255,255,.35), rgba(255,255,255,0) 60%);
          opacity:.6;
        }
        .trapBanner{ position:fixed; top:10px; left:50%; transform:translateX(-50%); z-index:60; background:#1d4ed8; color:#fff; padding:10px 14px; border-radius:12px; font-weight:800; box-shadow:0 10px 30px rgba(0,0,0,.25); }

        /* Radar piece ping */
        .ping{position:absolute; inset:0; display:flex; align-items:center; justify-content:center;}
        .pingDot{ width:10px; height:10px; border-radius:999px; background:#f43f5e; box-shadow:0 0 0 3px rgba(244,63,94,.35); animation: ping 1s infinite; }
        @keyframes ping{ 0%{ transform:scale(0.9); opacity:.9 } 70%{ transform:scale(1.6); opacity:.2 } 100%{ transform:scale(0.9); opacity:.0 } }

        /* Reveal map styles */
        .miniMap{ display:grid; gap:3px; grid-template-columns: repeat(${GRID_W}, 12px); }
        .miniCell{ width:12px; height:12px; border-radius:3px; background:#fbbf24 }
        .miniRock{ background:#9ca3af }
        .miniWater{ background:#60a5fa }
        .miniPiece{ width:12px; height:12px; border-radius:3px; background:#ef4444 }
      `}</style>

      {trap.active ? (
        <div className="trapBanner">Water! Rescued in {Math.max(0, Math.ceil((trap.until - Date.now()) / 1000))}s</div>
      ) : null}

      <header style={styles.header}>
        <div className="row">
          <RaccoonIcon />
          <div style={{ marginLeft: 8 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Raccoon Rocket</h1>
            <div style={{ fontSize: 12, color: "#64748b" }}>Dig. Discover. Build your ship.</div>
          </div>
        </div>
        <div className="row">
          <button style={{ ...styles.btn, background: "#0f172a" }} onClick={() => setMenu("home")}>Menu</button>
          <button style={{ ...styles.btn, background: "#10b981" }} onClick={() => setMenu("help")}>How to Play</button>
        </div>
      </header>

      <div style={styles.wrap}>
        <main style={styles.grid}>
          <section>
            <div className="hud" style={{ marginBottom: 8 }}>
              <div style={{ ...styles.chip, background: "#10b981" }}>Score: {score}</div>
              <div style={{ ...styles.chip, background: timeLeft < 30 ? "#ef4444" : "#0ea5e9" }}>Time: {timeLeft}s</div>
              <div style={{ ...styles.chip, background: "#6366f1" }}>Speed: {speed.toFixed(1)}x</div>
              <div style={{ ...styles.chip, background: "#f59e0b" }}>Placed: {placedCount}/{PieceIDs.length}</div>
              {ringReveal ? <div style={{ ...styles.chip, background: "#ec4899" }}>Radar: ON</div> : null}
              <div style={{ marginLeft: "auto" }} className="row">
                <button style={{ ...styles.btn, background: "#0f172a" }} onClick={() => setMenu("pause")}>Pause</button>
                <button style={{ ...styles.btn, background: "#b91c1c" }} onClick={() => resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos)}>Reset</button>
              </div>
            </div>
            <div style={styles.card}>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${GRID_W}, 36px)` }}>
                {cells.map((c, i) => {
                  const x = i % GRID_W;
                  const y = Math.floor(i / GRID_W);
                  const isPlayer = pos.x === x && pos.y === y;
                  const baseLayer = `layer${Math.max(0, Math.min(3, c.layers ?? 0))}`;
                  const classes = [
                    "cell",
                    c.type === "water" ? "water" : baseLayer,
                    c.seen ? "seen" : "unseen",
                    ringReveal && Math.abs(x - pos.x) <= 2 && Math.abs(y - pos.y) <= 2 ? "radar" : "",
                  ].join(" ");
                  const showPing = ringReveal && nearbyRing.has(i) && c?.payload?.kind === "piece";
                  return (
                    <div key={i} className={classes}>
                      {c.type !== "water" ? <div className="grain" /> : null}
                      {isPlayer ? <RaccoonIcon size={26} /> : null}
                      {showPing ? (
                        <div className="ping" title="Piece nearby!">
                          <div className="pingDot" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                Move with W A S D or arrow keys. Each step digs one layer. Gray = bedrock. Blue = water trap.
              </div>
            </div>
          </section>

          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={styles.card}>
              <h3 style={{ margin: "0 0 4px 0" }}>Rocket Assembly</h3>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Drag parts onto the silhouette to install.</div>
              <div style={{ position: "relative", width: 260, height: 360, margin: "0 auto" }}>
                <svg viewBox="0 0 200 320" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                  <path d="M100 5 L170 120 L30 120 Z" fill="#fee2e2" />
                  <rect x="60" y="90" width="80" height="140" rx="16" fill="#fff7ed" />
                  <rect x="40" y="250" width="120" height="40" rx="8" fill="#e5e7eb" />
                  <path d="M40 250 L20 300 L70 280 Z" fill="#ecfccb" />
                  <path d="M160 250 L130 280 L180 300 Z" fill="#ecfccb" />
                </svg>
                {RocketLayout.map(s => (
                  <div key={s.id}
                    onDrop={e => onDrop(e, s.id)}
                    onDragOver={onDragOver}
                    style={{ position: "absolute", left: s.left, top: s.top, width: 80, height: 80, border: "2px dashed #cbd5e1", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: placed[s.id] ? "#ecfdf5" : "#f8fafc", boxShadow: placed[s.id] ? "inset 0 0 0 2px #86efac" : undefined }}>
                    {!placed[s.id] ? <div style={{ opacity: 0.45 }}><PieceSVG id={s.id} size={40} /></div> : null}
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={{ margin: "0 0 4px 0" }}>Backpack</h3>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Found parts appear here. Drag to the rocket.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 64 }}>
                {inventory.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Nothing yet. Keep digging!</div>
                ) : (
                  inventory.map(id => (
                    <div key={id} draggable onDragStart={e => onDragStart(e, id)} title={id}>
                      <PieceSVG id={id} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </main>
      </div>

      {menu !== "playing" ? (
        <div className="overlay">
          <div style={{ ...styles.card, width: "min(600px,90vw)" }}>
            {menu === "home" && (
              <>
                <h2 style={{ marginTop: 0 }}>Raccoon Rocket</h2>
                <div style={{ color: "#5b6b7a", fontSize: 14 }}>A cozy dig-and-build game.</div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button style={{ ...styles.btn, background: "#10b981" }} onClick={() => setMenu("playing")}>Start Game</button>
                  <button style={{ ...styles.btn, background: "#0f172a" }} onClick={() => setMenu("help")}>How to Play</button>
                </div>
              </>
            )}
            {menu === "help" && (
              <>
                <h2 style={{ marginTop: 0 }}>How to Play</h2>
                <div style={{ color: "#5b6b7a", fontSize: 14 }}>
                  <ol>
                    <li>Move with W A S D or arrow keys. Each step digs one layer. Cells need 1–3 digs.</li>
                    <li>Find rocket parts. They go to your Backpack.</li>
                    <li>Drag parts onto the silhouette to install.</li>
                    <li>Bonuses add time, speed, points, or show an extended radar ring. Penalties slow you, steal points, or cause a sandstorm.</li>
                    <li>Gray rock means bedrock. Blue water traps you for 5 seconds and returns you to your last land tile.</li>
                    <li>Finish before the timer reaches zero.</li>
                  </ol>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button style={{ ...styles.btn, background: "#10b981" }} onClick={() => setMenu("playing")}>Play</button>
                  <button style={{ ...styles.btn, background: "#0f172a" }} onClick={() => setMenu("home")}>Back</button>
                </div>
              </>
            )}
            {menu === "pause" && (
              <>
                <h2 style={{ marginTop: 0 }}>Paused</h2>
                <div className="row" style={{ marginTop: 12 }}>
                  <button style={{ ...styles.btn, background: "#10b981" }} onClick={() => setMenu("playing")}>Resume</button>
                  <button style={{ ...styles.btn, background: "#b91c1c" }} onClick={() => resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos)}>Reset</button>
                </div>
              </>
            )}
            {menu === "win" && (
              <>
                <h2 style={{ marginTop: 0 }}>Lift-off!</h2>
                <div style={{ color: "#5b6b7a", fontSize: 14 }}>You built the rocket in time. Score: {score}</div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button style={{ ...styles.btn, background: "#10b981" }} onClick={() => resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos, true)}>Play Again</button>
                  <button style={{ ...styles.btn, background: "#0f172a" }} onClick={() => resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos)}>Menu</button>
                </div>
              </>
            )}
            {menu === "lose" && (
              <>
                <h2 style={{ marginTop: 0 }}>Time's up</h2>
                <div style={{ color: "#5b6b7a", fontSize: 14, marginBottom: 8 }}>Score: {score}. Here's where the remaining parts were hiding:</div>
                <div className="miniMap" aria-label="part reveal map">
                  {cells.map((c, i) => {
                    const isPiece = c?.payload?.kind === "piece";
                    const cls = c.type === "water" ? "miniWater" : (c.layers === 0 ? "miniRock" : "miniCell");
                    return <div key={i} className={isPiece ? "miniPiece" : cls} title={isPiece ? "Part" : undefined} />;
                  })}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button style={{ ...styles.btn, background: "#10b981" }} onClick={() => resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos, true)}>Try Again</button>
                  <button style={{ ...styles.btn, background: "#0f172a" }} onClick={() => resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos)}>Menu</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {effect ? (
        <div className="effectWrap">
          <div className={`effectCard ${effect.type}`}>{effect.label}</div>
        </div>
      ) : null}

      {effect?.type === "sandstorm" ? <div className="sandFX" /> : null}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
      {effect?.type === "speed" ? <div className="speedlines" /> : null}
    </div>
  );
}

function resetGame(setCells, setPos, setInventory, setPlaced, setScore, setTimeLeft, setRingReveal, setSpeed, setMenu, setLastLandPos, autoPlay = false) {
  const board = makeBoard();
  setCells(board);
  setPos({ x: 1, y: 1 });
  setLastLandPos({ x: 1, y: 1 });
  setInventory([]);
  setPlaced({});
  setScore(0);
  setTimeLeft(180);
  setRingReveal(false);
  setSpeed(1);
  setMenu(autoPlay ? "playing" : "home");
}

function makeBoard() {
  // Start with all land cells
  let cells = Array.from({ length: TOTAL }, () => ({ type: "land", layers: randi(1, 3), seen: false, payload: null }));

  // Carve organic water blobs, then ensure land connectivity
  const WATER_TARGET = Math.round(TOTAL * 0.12); // ~12% water
  const MAX_TRIES = 40;

  let best = null;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const tmp = cells.map(c => ({ ...c, type: "land" }));
    const water = new Set();

    // Multiple seeds that random-walk to create blobs
    const seeds = randi(2, 4);
    for (let s = 0; s < seeds; s++) {
      let sx = randi(0, GRID_W - 1);
      let sy = randi(0, GRID_H - 1);
      for (let k = 0; k < Math.floor(WATER_TARGET / seeds); k++) {
        if (!inside(sx, sy)) break;
        const idx = xy2i(sx, sy);
        // keep start tile (1,1) and its direct neighbors as land to avoid softlocks on spawn
        if (!(sx === 1 && sy === 1) && !(Math.abs(sx - 1) + Math.abs(sy - 1) === 1)) {
          water.add(idx);
        }
        // small bias to keep walks cohesive
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
          [2, 0],
          [0, 2],
        ];
        const [dx, dy] = choice(dirs);
        sx += dx; sy += dy;
        if (!inside(sx, sy)) { sx = Math.min(GRID_W - 2, Math.max(1, sx)); sy = Math.min(GRID_H - 2, Math.max(1, sy)); }
      }
    }

    for (const idx of water) tmp[idx].type = "water";

    // Connectivity check: BFS over land from start (1,1)
    if (tmp[xy2i(1, 1)].type === "water") continue; // never allow start in water
    const totalLand = tmp.reduce((a, c) => a + (c.type === "land" ? 1 : 0), 0);
    const seen = new Set();
    const q = [[1, 1]];
    seen.add(xy2i(1, 1));
    const dirs4 = [[1,0],[-1,0],[0,1],[0,-1]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of dirs4) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const ii = xy2i(nx, ny);
        if (seen.has(ii)) continue;
        if (tmp[ii].type !== "land") continue;
        seen.add(ii);
        q.push([nx, ny]);
      }
    }

    if (seen.size === totalLand) { best = tmp; break; }
    // Keep the best attempt with the largest connected land area as fallback
    if (!best || seen.size > best._conn) { best = tmp; best._conn = seen.size; }
  }

  cells = best.map(c => ({ ...c }));

  // Place payloads only on land
  const used = new Set();
  const pickLandIndex = () => {
    let idx = randi(0, TOTAL - 1);
    let safety = 0;
    while ((cells[idx].type !== "land" || used.has(idx)) && safety++ < 5000) idx = randi(0, TOTAL - 1);
    used.add(idx);
    return idx;
  };

  for (const id of PieceIDs) {
    const idx = pickLandIndex();
    cells[idx].payload = { kind: "piece", id };
  }
  for (let i = 0; i < 10; i++) {
    const idx = pickLandIndex();
    cells[idx].payload = { kind: "bonus", id: BonusIDs[randi(0, BonusIDs.length - 1)] };
  }
  for (let i = 0; i < 8; i++) {
    const idx = pickLandIndex();
    cells[idx].payload = { kind: "penalty", id: PenaltyIDs[randi(0, PenaltyIDs.length - 1)] };
  }

  return cells;
}
