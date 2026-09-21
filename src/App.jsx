import { useState, useMemo, useEffect } from "react";
import { MapPin, Clock, Users, Search, ArrowUpDown, Music, Check, Navigation, CalendarClock, ShieldCheck, Lock } from "lucide-react";

// shortened for demo purposes so the cooldown is visible in one sitting; represents a ~20min window in production
const CHECKIN_COOLDOWN_MS = 2 * 60 * 1000;
const CHECKIN_PROXIMITY_MI = 0.15;

const VIBES = [
  { key: "dead", label: "Dead", min: 0, max: 19 },
  { key: "chill", label: "Chill", min: 20, max: 49 },
  { key: "lively", label: "Lively", min: 50, max: 79 },
  { key: "packed", label: "Packed", min: 80, max: 100 },
];

const WHEN_OPTIONS = [
  { key: "now", label: "Now", hour: null },
  { key: "t9", label: "Tonight 9pm", hour: 21 },
  { key: "t11", label: "Tonight 11pm", hour: 23 },
  { key: "tmw", label: "Tomorrow 9pm", hour: 21 },
];

function vibeFor(score) {
  return VIBES.find((v) => score >= v.min && score <= v.max) || VIBES[0];
}

// Real bars, grouped by city. Coordinates are approximate (derived from known street
// addresses, not precise geocoding) which is fine for a prototype's distance sorting.
const CITIES = {
  jaxbeach: {
    label: "Jax Beach area",
    fallbackLat: 30.2947,
    fallbackLng: -81.3958,
    bars: [
      { id: "jb1", name: "The Ritz", genre: "Nightclub / Dance", neighborhood: "Jacksonville Beach", lat: 30.292279, lng: -81.391212, score: 82, checkins: 14, updatedMin: 3, peakHour: 25, peakScore: 90, floor: 12 },
      { id: "jb2", name: "Monkey's Uncle Tavern", genre: "Sports Bar / Live Music", neighborhood: "Jacksonville Beach", lat: 30.304593, lng: -81.395957, score: 64, checkins: 22, updatedMin: 5, peakHour: 21, peakScore: 78, floor: 20 },
      { id: "jb3", name: "Lynch's Irish Pub", genre: "Irish Pub / Live Music", neighborhood: "Jacksonville Beach", lat: 30.293469, lng: -81.390605, score: 58, checkins: 17, updatedMin: 8, peakHour: 22, peakScore: 82, floor: 18 },
      { id: "jb4", name: "Lemon Bar", genre: "Beachfront Lounge", neighborhood: "Neptune Beach", lat: 30.323921, lng: -81.395031, score: 41, checkins: 9, updatedMin: 20, peakHour: 20, peakScore: 65, floor: 14 },
      { id: "jb5", name: "Pete's Bar", genre: "Dive Bar", neighborhood: "Neptune Beach", lat: 30.323962, lng: -81.395877, score: 71, checkins: 19, updatedMin: 6, peakHour: 24, peakScore: 85, floor: 15 },
      { id: "jb6", name: "Culhane's Irish Pub", genre: "Irish Pub / Sports", neighborhood: "Atlantic Beach", lat: 30.325704, lng: -81.410610, score: 47, checkins: 10, updatedMin: 14, peakHour: 21, peakScore: 68, floor: 16 },
      { id: "jb7", name: "Harbor Tavern", genre: "Dive Bar", neighborhood: "Atlantic Beach", lat: 30.325866, lng: -81.419430, score: 22, checkins: 4, updatedMin: 35, peakHour: 22, peakScore: 55, floor: 10 },
      { id: "jb8", name: "Mayport Garden Club", genre: "Speakeasy / Tiki Lounge", neighborhood: "Atlantic Beach", lat: 30.333987, lng: -81.415086, score: 36, checkins: 7, updatedMin: 25, peakHour: 21, peakScore: 60, floor: 12 },
    ],
  },
  daytona: {
    label: "Daytona Beach area",
    fallbackLat: 29.2108,
    fallbackLng: -81.0031,
    bars: [
      { id: "db1", name: "Boot Hill Saloon", genre: "Biker Dive Bar", neighborhood: "Main Street", lat: 29.2108, lng: -81.0107, score: 68, checkins: 16, updatedMin: 6, peakHour: 23, peakScore: 85, floor: 15 },
      { id: "db2", name: "Froggy's Saloon", genre: "Biker Bar / Live Music", neighborhood: "Main Street", lat: 29.2110, lng: -81.0034, score: 74, checkins: 20, updatedMin: 4, peakHour: 24, peakScore: 88, floor: 12 },
      { id: "db3", name: "Main Street Station", genre: "Garage Bar / Live Music", neighborhood: "Main Street", lat: 29.2108, lng: -81.0106, score: 52, checkins: 11, updatedMin: 12, peakHour: 22, peakScore: 75, floor: 10 },
      { id: "db4", name: "Bank & Blues Club", genre: "Blues & Live Music", neighborhood: "Main Street", lat: 29.2109, lng: -81.0047, score: 45, checkins: 9, updatedMin: 18, peakHour: 21, peakScore: 70, floor: 8 },
      { id: "db5", name: "Dirty Harry's Pub", genre: "Dive Bar", neighborhood: "Main Street", lat: 29.2109, lng: -81.0046, score: 38, checkins: 7, updatedMin: 22, peakHour: 22, peakScore: 65, floor: 15 },
      { id: "db6", name: "Full Moon Saloon", genre: "Saloon / Live Music", neighborhood: "Main Street", lat: 29.2109, lng: -81.0048, score: 55, checkins: 12, updatedMin: 10, peakHour: 23, peakScore: 72, floor: 10 },
      { id: "db7", name: "Oyster Pub", genre: "Sports Bar", neighborhood: "Seabreeze", lat: 29.2168, lng: -81.0037, score: 61, checkins: 18, updatedMin: 7, peakHour: 19, peakScore: 68, floor: 20 },
    ],
  },
};

// haversine distance in miles
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// bell-curve style baseline prediction for a given hour (hour can exceed 24 to represent past-midnight peaks)
function baselineScore(bar, hour) {
  const h = hour < 6 ? hour + 24 : hour; // treat early morning as "late night" on the same curve
  const sigma = 3.2;
  const raw = bar.peakScore * Math.exp(-((h - bar.peakHour) ** 2) / (2 * sigma * sigma));
  return Math.round(Math.max(bar.floor, raw));
}

function confidenceFor(updatedMin) {
  if (updatedMin <= 15) return { tier: "fresh", label: `${updatedMin}m ago` };
  if (updatedMin <= 60) return { tier: "aging", label: `${updatedMin}m ago, aging` };
  return { tier: "stale", label: "No recent check-ins" };
}

// horizontal gauge, the signature element: a flat fill bar on a light track,
// near-black for normal levels, the single accent color once a place is genuinely packed
function CrowdGauge({ score, muted = false }) {
  const vibe = vibeFor(score);
  const isPacked = vibe.key === "packed" && !muted;
  return (
    <div className="w-full">
      <div style={{ height: 6, background: "#EAE8E0", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(4, score)}%`,
            height: "100%",
            background: muted ? "#B8B6AC" : isPacked ? "#CCFF00" : "#0D0D0D",
            borderRadius: 3,
            animation: isPacked ? "livePulse 1.4s ease-in-out infinite" : "none",
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

function VibeTag({ score, muted }) {
  const vibe = vibeFor(score);
  const isPacked = vibe.key === "packed" && !muted;
  return (
    <span
      className="inline-flex items-center px-2 py-[3px] rounded-[6px]"
      style={{
        background: isPacked ? "#0D0D0D" : "transparent",
        border: isPacked ? "none" : "1px solid #DEDCD3",
        color: isPacked ? "#CCFF00" : muted ? "#9B998F" : "#0D0D0D",
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {vibe.label}
    </span>
  );
}

function BarCard({ bar, distance, expanded, onToggle, onCheckIn, when, gate }) {
  const isNow = when.key === "now";
  const conf = isNow ? confidenceFor(bar.updatedMin) : null;
  const predicted = isNow ? null : baselineScore(bar, when.hour);
  const displayScore = isNow ? (conf.tier === "stale" ? baselineScore(bar, new Date().getHours()) : bar.score) : predicted;
  const isBaselineDisplay = !isNow || conf.tier === "stale";

  return (
    <div className="overflow-hidden transition-all" style={{ background: "#FFFFFF", border: "1px solid #E4E2DB", borderRadius: 16 }}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3.5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h3 className="truncate" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 17, color: "#0D0D0D", letterSpacing: "-0.01em" }}>
              {bar.name}
            </h3>
            <div className="flex items-center gap-2.5 mt-0.5" style={{ color: "#9B998F", fontSize: 11.5 }}>
              <span className="flex items-center gap-1"><Music size={10} />{bar.genre}</span>
              <span className="flex items-center gap-1"><MapPin size={10} />{bar.neighborhood} &middot; {distance.toFixed(1)} mi</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 600, color: isBaselineDisplay ? "#B8B6AC" : "#0D0D0D", lineHeight: 1 }}>
              {displayScore}
            </div>
          </div>
        </div>

        <div className="mt-2.5 mb-2">
          <CrowdGauge score={displayScore} muted={isBaselineDisplay} />
        </div>

        <div className="flex items-center justify-between">
          <VibeTag score={displayScore} muted={isBaselineDisplay} />
          <div className="flex items-center gap-1" style={{ color: "#9B998F", fontSize: 10.5 }}>
            {isNow ? (
              <>
                <Clock size={10} />
                {conf.label}
              </>
            ) : (
              <>
                <CalendarClock size={10} />
                typical for {when.label.toLowerCase()}
              </>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid #E4E2DB" }}>
          {isBaselineDisplay && (
            <div
              className="flex items-center gap-2 mb-3 px-2.5 py-2"
              style={{ background: "#F7F6F1", border: "1px solid #E4E2DB", borderRadius: 10, color: "#6B6B63", fontSize: 11.5 }}
            >
              <CalendarClock size={13} className="shrink-0" />
              {isNow
                ? "No fresh check-ins, showing what's typical for this bar right now."
                : `Prediction based on how ${bar.name} usually looks at this time. Check-ins aren't possible for future times.`}
            </div>
          )}

          {isNow && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5" style={{ color: "#6B6B63", fontSize: 12 }}>
                <Users size={13} />
                <span>{bar.checkins} check-ins in the last hour</span>
              </div>
            </div>
          )}

          {isNow && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p style={{ color: "#6B6B63", fontSize: 12 }}>What's it like right now?</p>
                {gate.canCheckIn && (
                  <span className="flex items-center gap-1" style={{ color: "#6B6B63", fontSize: 10.5 }}>
                    <ShieldCheck size={11} />
                    verified nearby
                  </span>
                )}
              </div>
              {gate.canCheckIn ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {VIBES.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => onCheckIn(bar.id, v)}
                      className="py-2 text-center transition-transform active:scale-95"
                      style={{ background: "#FFFFFF", border: "1px solid #DEDCD3", borderRadius: 6, color: "#0D0D0D", fontSize: 11.5, fontWeight: 600 }}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 px-2.5 py-2.5"
                  style={{ background: "#F7F6F1", border: "1px solid #E4E2DB", borderRadius: 10, color: "#6B6B63", fontSize: 11.5 }}
                >
                  <Lock size={13} className="shrink-0" />
                  {gate.reason}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [cityKey, setCityKey] = useState("jaxbeach");
  const city = CITIES[cityKey];
  const [bars, setBars] = useState(city.bars);
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All areas");
  const [sortBy, setSortBy] = useState("busy");
  const [when, setWhen] = useState(WHEN_OPTIONS[0]);
  const [toast, setToast] = useState(null);
  const [userLoc, setUserLoc] = useState(null);
  const [locStatus, setLocStatus] = useState("idle"); // idle | granted | denied
  const [deviceId] = useState(() => "anon-" + Math.random().toString(36).slice(2, 10));
  const [lastCheckIn, setLastCheckIn] = useState({}); // barId -> timestamp ms, scoped to this device
  const [demoBarId, setDemoBarId] = useState(null); // when set, pretend we're standing right at this bar

  const neighborhoods = useMemo(
    () => ["All areas", ...Array.from(new Set(city.bars.map((b) => b.neighborhood)))],
    [city]
  );

  function handleCityChange(nextKey) {
    setCityKey(nextKey);
    setBars(CITIES[nextKey].bars);
    setArea("All areas");
    setExpandedId(null);
    setDemoBarId(null);
    setQuery("");
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      { timeout: 5000 }
    );
  }, []);

  const withDistance = useMemo(() => {
    return bars.map((b) => {
      if (demoBarId === b.id) return { ...b, distance: 0.02 };
      const d = userLoc
        ? distanceMiles(userLoc.lat, userLoc.lng, b.lat, b.lng)
        : distanceMiles(city.fallbackLat, city.fallbackLng, b.lat, b.lng);
      return { ...b, distance: d };
    });
  }, [bars, userLoc, demoBarId, city]);

  const filtered = useMemo(() => {
    let list = withDistance.filter(
      (b) => b.name.toLowerCase().includes(query.toLowerCase()) && (area === "All areas" || b.neighborhood === area)
    );
    const scoreFor = (b) => (when.key === "now" ? b.score : baselineScore(b, when.hour));
    list.sort((a, b) => (sortBy === "busy" ? scoreFor(b) - scoreFor(a) : a.distance - b.distance));
    return list;
  }, [withDistance, query, area, sortBy, when]);

  function gateFor(bar, distance) {
    const locationVerified = locStatus === "granted" || demoBarId === bar.id;
    if (!locationVerified) {
      return { canCheckIn: false, reason: "Turn on location (or use demo mode below) so we can confirm you're actually here." };
    }
    if (distance > CHECKIN_PROXIMITY_MI) {
      return { canCheckIn: false, reason: `You need to be within ${CHECKIN_PROXIMITY_MI} mi of ${bar.name} to check in.` };
    }
    const last = lastCheckIn[bar.id];
    if (last && Date.now() - last < CHECKIN_COOLDOWN_MS) {
      const minsLeft = Math.ceil((CHECKIN_COOLDOWN_MS - (Date.now() - last)) / 60000);
      return { canCheckIn: false, reason: `You already checked in here recently. Try again in ${minsLeft}m.` };
    }
    return { canCheckIn: true, reason: null };
  }

  function handleCheckIn(id, vibe) {
    const bar = withDistance.find((b) => b.id === id);
    const gate = gateFor(bar, bar.distance);
    if (!gate.canCheckIn) {
      setToast(gate.reason);
      setTimeout(() => setToast(null), 2200);
      return;
    }
    setBars((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const range = vibe.max - vibe.min;
        const newScore = Math.round(vibe.min + Math.random() * range);
        return { ...b, score: newScore, checkins: b.checkins + 1, updatedMin: 0 };
      })
    );
    setLastCheckIn((prev) => ({ ...prev, [id]: Date.now() }));
    setToast(`Checked in at ${bar.name}, marked ${vibe.label}`);
    setTimeout(() => setToast(null), 2200);
    setExpandedId(null);
  }

  return (
    <div style={{ background: "#F7F6F1", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        select { appearance: none; -webkit-appearance: none; }
      `}</style>

      <div className="max-w-md mx-auto px-4 pt-7 pb-10">
        <header className="mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26, color: "#0D0D0D", letterSpacing: "-0.02em" }}>
              Next Stop
            </h1>
            <span
              className="px-1.5 py-[2px]"
              style={{ background: "#0D0D0D", color: "#CCFF00", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", borderRadius: 4 }}
            >
              LIVE
            </span>
          </div>
          <p style={{ color: "#6B6B63", fontSize: 13 }}>See how poppin it is before you go.</p>

          <div className="flex gap-2 mt-3">
            {Object.entries(CITIES).map(([key, c]) => (
              <button
                key={key}
                onClick={() => handleCityChange(key)}
                className="flex-1 py-1.5 text-center transition-colors"
                style={{
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background: cityKey === key ? "#0D0D0D" : "#FFFFFF",
                  color: cityKey === key ? "#CCFF00" : "#6B6B63",
                  border: "1px solid " + (cityKey === key ? "#0D0D0D" : "#E4E2DB"),
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-3" style={{ color: locStatus === "granted" ? "#0D0D0D" : "#9B998F", fontSize: 11 }}>
            <Navigation size={11} />
            {locStatus === "granted" && "Using your location"}
            {locStatus === "denied" && "Location unavailable, showing distances from downtown"}
            {locStatus === "idle" && "Finding your location..."}
          </div>

          <div className="flex items-center gap-2 mt-2 px-2.5 py-2" style={{ background: "#FFFFFF", border: "1px solid #E4E2DB", borderRadius: 10 }}>
            <span style={{ color: "#9B998F", fontSize: 11 }}>Demo mode, pretend I'm at:</span>
            <select
              value={demoBarId || ""}
              onChange={(e) => setDemoBarId(e.target.value || null)}
              className="flex-1 outline-none px-1.5 py-1"
              style={{ background: "#F7F6F1", border: "1px solid #E4E2DB", borderRadius: 6, color: "#0D0D0D", fontSize: 11.5 }}
            >
              <option value="">Off</option>
              {bars.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="flex gap-2 mb-2">
          <div className="flex-1 flex items-center gap-2 px-3" style={{ background: "#FFFFFF", border: "1px solid #E4E2DB", borderRadius: 10, height: 40 }}>
            <Search size={15} color="#9B998F" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bars"
              className="bg-transparent outline-none w-full"
              style={{ color: "#0D0D0D", fontSize: 13 }}
            />
          </div>
          <button
            onClick={() => setSortBy((s) => (s === "busy" ? "distance" : "busy"))}
            className="flex items-center gap-1.5 px-3 shrink-0"
            style={{ background: "#FFFFFF", border: "1px solid #E4E2DB", borderRadius: 10, color: "#0D0D0D", fontSize: 12.5, fontWeight: 500, height: 40 }}
          >
            <ArrowUpDown size={13} />
            {sortBy === "busy" ? "Busiest" : "Nearest"}
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="flex-1 px-3 outline-none"
            style={{ background: "#FFFFFF", border: "1px solid #E4E2DB", borderRadius: 10, color: "#0D0D0D", fontSize: 12.5, height: 38 }}
          >
            {neighborhoods.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={when.key}
            onChange={(e) => setWhen(WHEN_OPTIONS.find((w) => w.key === e.target.value))}
            className="flex-1 px-3 outline-none"
            style={{ background: "#FFFFFF", border: "1px solid #E4E2DB", borderRadius: 10, color: "#0D0D0D", fontSize: 12.5, height: 38 }}
          >
            {WHEN_OPTIONS.map((w) => (
              <option key={w.key} value={w.key}>{w.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2.5">
          {filtered.map((bar) => (
            <BarCard
              key={bar.id}
              bar={bar}
              distance={bar.distance}
              when={when}
              expanded={expandedId === bar.id}
              onToggle={() => setExpandedId(expandedId === bar.id ? null : bar.id)}
              onCheckIn={handleCheckIn}
              gate={gateFor(bar, bar.distance)}
            />
          ))}
          {filtered.length === 0 && (
            <p style={{ color: "#9B998F", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No bars match that search.</p>
          )}
        </div>

        <p style={{ color: "#9B998F", fontSize: 11, marginTop: 20 }}>
          Live scores are simulated. "Typical for" predictions come from time-of-day patterns.
        </p>
        <p style={{ color: "#C4C2B8", fontSize: 10, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
          checking in as {deviceId}, no login needed
        </p>
      </div>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5"
          style={{ background: "#0D0D0D", border: "1px solid #0D0D0D", borderRadius: 10, color: "#FFFFFF", fontSize: 12.5 }}
        >
          <Check size={14} color="#CCFF00" />
          {toast}
        </div>
      )}
    </div>
  );
}
