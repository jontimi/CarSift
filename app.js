const CONFIG = window.CARSIFT_CONFIG || {};
const LOCAL_KEY = "carsift-local-v2";
const LEGACY_LOCAL_KEY = "carsift-local-v1";
const FAV_MODE_KEY = "carsift-favorites-mode";
const SUPABASE_JS = "https://esm.sh/@supabase/supabase-js@2.49.1";
const TESSERACT_JS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm";

const DEFAULT_PROFILE = {
  display_name: "",
  budget_max: 120000,
  year_min: 2019,
  mileage_max: 120000,
  owners_max: 2,
  body_type: "",
  fuel_type: "",
  transmission: "",
  weights: { reliability: 8, economy: 7, safety: 7, maintenance: 6, performance: 4 },
  excluded_terms: [],
};

// Equipment options. `match` = words used to detect the feature in pasted listing text.
const FEATURES = [
  { key: "sunroof", label: "גג שמש / פנורמי", match: ["גג שמש", "גג נפתח", "פנורמי", "sunroof"] },
  { key: "leather", label: "מושבי עור", match: ["עור", "leather"] },
  { key: "reverse_camera", label: "מצלמת רוורס", match: ["מצלמת רוורס", "מצלמה אחורית", "מצלמת נסיעה לאחור"] },
  { key: "adaptive_cruise", label: "בקרת שיוט אדפטיבית", match: ["שיוט אדפטיבי", "בקרת שיוט אדפטיבית", "acc"] },
  { key: "parking_sensors", label: "חיישני חניה", match: ["חיישני חניה", "חיישני רוורס"] },
  { key: "carplay", label: "Apple CarPlay / Android Auto", match: ["carplay", "android auto", "קארפליי"] },
  { key: "blind_spot", label: "ניטור שטחים מתים", match: ["שטחים מתים", "blind spot"] },
  { key: "lane_assist", label: "סייען שמירת נתיב", match: ["שמירת נתיב", "סטייה מנתיב", "lane"] },
  { key: "heated_seats", label: "מושבים מחוממים", match: ["מושבים מחוממים", "חימום מושבים"] },
  { key: "keyless", label: "כניסה והתנעה ללא מפתח", match: ["ללא מפתח", "keyless", "סמארט קי"] },
];
const FEATURE_LABEL = Object.fromEntries(FEATURES.map((f) => [f.key, f.label]));

// Fuel pills group the detailed fuel values stored on each car.
const FUEL_GROUPS = [
  { key: "gasoline", label: "בנזין", values: ["בנזין", "גפ״מ"] },
  { key: "diesel", label: "דיזל", values: ["דיזל"] },
  { key: "hybrid", label: "היברידי", values: ["היברידי", "היברידי נטען"] },
  { key: "ev", label: "חשמלי", values: ["חשמלי"] },
];


const EMPTY_FILTERS = () => ({ makes: [], models: [], priceMin: null, priceMax: null, yearMin: null, mileageMax: null, fuels: [], handMax: null, features: [] });

const state = {
  view: "cars",
  cars: [],
  profile: { ...DEFAULT_PROFILE, weights: { ...DEFAULT_PROFILE.weights } },
  favorites: new Set(),
  priorities: {},
  favMakes: new Set(),
  onlyFavMakes: false,
  prefsKey: null,
  favoritesMode: "local",
  compareIds: new Set(),
  drawerOpen: false,
  filters: EMPTY_FILTERS(),
  filtersOpen: false,
  sort: "score",
  search: "",
  modal: null,
  draft: {},
  editId: null,
  importPreview: null,
  supabase: null,
  session: null,
  user: null,
  cloud: false,
  authRequired: false,
  authDenied: false,
  authMessage: "",
  loading: true,
  busy: false,
  toast: "",
};

const app = document.querySelector("#app");
const html = (value = "") => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const money = (value) => value == null || value === "" ? "—" : new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value));
const number = (value) => value == null || value === "" ? "—" : new Intl.NumberFormat("he-IL").format(Number(value));
const icon = (name, size = 20) => {
  const paths = {
    cars: '<path d="M5 17h14l1.5-5.5A2 2 0 0 0 18.6 9H5.4a2 2 0 0 0-1.9 2.5L5 17Z"/><path d="m7 9 1.2-3h7.6L17 9M6 17v2m12-2v2M7 13h.01M17 13h.01"/>',
    compare: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/><path d="M6.5 9h2M15.5 9h2M6.5 13h2M15.5 13h2"/>',
    profile: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    heart: '<path d="M20.8 8.7c0 5-8.8 10.3-8.8 10.3S3.2 13.7 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.7"/><path d="m16 16 4.5 4.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16"/>',
    upload: '<path d="M12 16V4m0 0L8 8m4-4 4 4M4 20h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2.2-2.2a5 5 0 0 0-7.1-7.1l-1.3 1.3"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.2 2.2a5 5 0 0 0 7.1 7.1l1.3-1.3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
    edit: '<path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15l-0.8 5Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.cars}</svg>`;
};

function showToast(message) {
  state.toast = message;
  const node = document.querySelector(".toast");
  if (node) {
    node.textContent = message;
    node.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => node.classList.remove("visible"), 2800);
  }
}

function defaultCarShape(car) {
  return {
    id: car.id || crypto.randomUUID(), title: car.title || [car.make, car.model].filter(Boolean).join(" ") || "רכב ללא שם",
    make: car.make || "", model: car.model || "", year: car.year || null,
    price_ils: car.price_ils || null, mileage_km: car.mileage_km || null, owners: car.owners || null,
    body_type: car.body_type || "", fuel_type: car.fuel_type || "", transmission: car.transmission || "",
    engine: car.engine || "", trim: car.trim || "", city: car.city || "", source_url: car.source_url || "",
    notes: car.notes || "", reliability: Number(car.reliability || 3), economy: Number(car.economy || 3),
    safety: Number(car.safety || 3), performance: Number(car.performance || 3), maintenance: Number(car.maintenance || 3),
    features: Array.isArray(car.features) ? car.features.filter((key) => FEATURE_LABEL[key]) : [],
    created_by: car.created_by || "local", created_at: car.created_at || new Date().toISOString(),
  };
}

function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || localStorage.getItem(LEGACY_LOCAL_KEY) || "null");
    if (saved) {
      // Drop the old built-in demo cars; only cars the user added or imported are kept.
      state.cars = (saved.cars || []).filter((car) => !String(car?.id || "").startsWith("demo-")).map(defaultCarShape);
      state.profile = { ...DEFAULT_PROFILE, ...(saved.profile || {}), weights: { ...DEFAULT_PROFILE.weights, ...(saved.profile?.weights || {}) } };
      state.favorites = new Set((saved.favorites || []).filter((id) => !String(id).startsWith("demo-")));
      return;
    }
  } catch { /* Ignore invalid browser storage and start a clean demo. */ }
  state.cars = [];
  state.favorites = new Set();
  saveLocal();
}

function saveLocal() {
  try {
    if (state.cloud) {
      // Cloud mode keeps cars/profile in Supabase; favorites may still live on this device.
      if (state.favoritesMode === "local" && state.user) localStorage.setItem(localFavoritesKey(), JSON.stringify([...state.favorites]));
      return;
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ cars: state.cars, profile: state.profile, favorites: [...state.favorites] }));
  } catch { /* Storage can be full or blocked (private mode). The app keeps working in memory. */ }
}

const localFavoritesKey = () => `carsift-favorites-${state.user?.id || "guest"}`;

/* Priorities (1-10 per saved car) and favorite car types (makes) live on this device, per user. */
const prefsStorageKey = () => `carsift-prefs-${state.user?.id || "guest"}`;
function ensurePrefs() {
  const key = prefsStorageKey();
  if (state.prefsKey === key) return;
  state.prefsKey = key;
  state.priorities = {};
  state.favMakes = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved) {
      for (const [id, value] of Object.entries(saved.priorities || {})) {
        const n = Math.round(Number(value));
        if (n >= 1 && n <= 10) state.priorities[id] = n;
      }
      state.favMakes = new Set((saved.favMakes || []).filter((m) => typeof m === "string"));
    }
  } catch { /* ignore broken storage */ }
}
function savePrefs() {
  try { localStorage.setItem(prefsStorageKey(), JSON.stringify({ priorities: state.priorities, favMakes: [...state.favMakes] })); } catch { /* storage blocked */ }
}
const priorityOf = (id) => state.priorities[id] || 0;

function readLocalFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem(localFavoritesKey()) || "[]")); } catch { return new Set(); }
}

// Favorites in cloud mode: "cloud" (Supabase, synced across devices) or "local" (this browser only).
function initialFavoritesMode() {
  let saved = null;
  try { saved = localStorage.getItem(FAV_MODE_KEY); } catch { /* ignore */ }
  const mode = saved || CONFIG.FAVORITES_STORAGE || "cloud";
  return mode === "local" ? "local" : "cloud";
}

async function setFavoritesMode(mode) {
  if (!state.cloud || mode === state.favoritesMode) return;
  try {
    if (mode === "cloud" && state.favorites.size) {
      const rows = [...state.favorites].filter((id) => state.cars.some((car) => car.id === id)).map((car_id) => ({ user_id: state.user.id, car_id }));
      if (rows.length) {
        const { error } = await state.supabase.from("favorites").upsert(rows, { onConflict: "user_id,car_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      const { data, error } = await state.supabase.from("favorites").select("car_id").eq("user_id", state.user.id);
      if (error) throw error;
      state.favorites = new Set((data || []).map((item) => item.car_id));
    }
    state.favoritesMode = mode;
    try { localStorage.setItem(FAV_MODE_KEY, mode); } catch { /* ignore */ }
    saveLocal();
    render();
    showToast(mode === "cloud" ? "המועדפים מסונכרנים עכשיו לחשבון" : "המועדפים נשמרים עכשיו במכשיר הזה בלבד");
  } catch (error) { showToast(`לא הצלחנו להחליף מצב שמירה: ${error.message || "נסו שוב"}`); }
}

function toProfileRow(profile) {
  return {
    display_name: profile.display_name || "", budget_max: Number(profile.budget_max) || 0,
    year_min: Number(profile.year_min) || 0, mileage_max: Number(profile.mileage_max) || 0,
    owners_max: Number(profile.owners_max) || 1, body_type: profile.body_type || "",
    fuel_type: profile.fuel_type || "", transmission: profile.transmission || "",
    weights: profile.weights || DEFAULT_PROFILE.weights,
    excluded_terms: Array.isArray(profile.excluded_terms) ? profile.excluded_terms : [],
  };
}

async function initialize() {
  const configured = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && !String(CONFIG.SUPABASE_URL).includes("YOUR_PROJECT");
  if (!configured) {
    state.cloud = false;
    readLocal();
    state.loading = false;
    render();
    return;
  }
  try {
    const { createClient } = await import(SUPABASE_JS);
    state.favoritesMode = initialFavoritesMode();
    state.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    state.cloud = true;
    const { data, error } = await state.supabase.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    state.user = data.session?.user || null;
    state.supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        state.session = session;
        state.user = session?.user || null;
        if (state.user) await loadCloud();
        else { state.cars = []; state.favorites = new Set(); state.authRequired = true; state.authDenied = false; state.loading = false; render(); }
      }, 0);
    });
    if (state.user) await loadCloud();
    else { state.authRequired = true; state.loading = false; render(); }
  } catch (error) {
    state.loading = false;
    state.authRequired = true;
    state.authMessage = `לא הצלחנו להתחבר ל-Supabase: ${error.message || "בדקו את config.js"}`;
    render();
  }
}

function fromProfileRow(row) {
  return {
    ...DEFAULT_PROFILE, ...row,
    weights: { ...DEFAULT_PROFILE.weights, ...(row.weights || {}) },
    excluded_terms: Array.isArray(row.excluded_terms) ? row.excluded_terms : [],
  };
}

async function loadCloud() {
  if (!state.user || !state.supabase) return;
  state.loading = true;
  state.authRequired = false;
  render();
  try {
    const { data: member, error: memberError } = await state.supabase.from("members").select("user_id").eq("user_id", state.user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!member) {
      state.authDenied = true;
      state.loading = false;
      render();
      return;
    }
    const [carsResult, profileResult, favoritesResult] = await Promise.all([
      state.supabase.from("cars").select("*").order("created_at", { ascending: false }),
      state.supabase.from("profiles").select("*").eq("id", state.user.id).maybeSingle(),
      state.favoritesMode === "cloud" ? state.supabase.from("favorites").select("car_id").eq("user_id", state.user.id) : Promise.resolve({ data: null, error: null }),
    ]);
    if (carsResult.error) throw carsResult.error;
    if (profileResult.error) throw profileResult.error;
    if (favoritesResult.error) throw favoritesResult.error;
    state.cars = (carsResult.data || []).map(defaultCarShape);
    state.favorites = state.favoritesMode === "cloud" ? new Set((favoritesResult.data || []).map((item) => item.car_id)) : readLocalFavorites();
    state.profile = profileResult.data ? fromProfileRow(profileResult.data) : { ...DEFAULT_PROFILE, display_name: state.user.email?.split("@")[0] || "" };
    if (!profileResult.data) {
      const { error } = await state.supabase.from("profiles").insert({ id: state.user.id, ...toProfileRow(state.profile) });
      if (error) throw error;
    }
    state.authDenied = false;
    state.loading = false;
    render();
  } catch (error) {
    state.loading = false;
    state.authMessage = `לא ניתן לטעון את הנתונים: ${error.message || "בדקו את טבלאות Supabase ואת הרשאות RLS"}`;
    render();
  }
}

function scoreCar(car) {
  const profile = state.profile;
  let constraints = 100;
  if (profile.budget_max > 0 && car.price_ils > profile.budget_max) constraints -= Math.min(35, ((car.price_ils - profile.budget_max) / profile.budget_max) * 90);
  if (profile.year_min > 0 && car.year && car.year < profile.year_min) constraints -= Math.min(24, (profile.year_min - car.year) * 7);
  if (profile.mileage_max > 0 && car.mileage_km > profile.mileage_max) constraints -= Math.min(22, ((car.mileage_km - profile.mileage_max) / profile.mileage_max) * 35);
  if (car.owners && profile.owners_max && car.owners > profile.owners_max) constraints -= Math.min(18, (car.owners - profile.owners_max) * 8);
  const wantBody = prefList(profile.body_type), wantFuel = prefList(profile.fuel_type), wantGear = prefList(profile.transmission);
  if (wantBody.length && car.body_type && !wantBody.includes(car.body_type)) constraints -= 12;
  if (wantFuel.length && car.fuel_type && !wantFuel.includes(car.fuel_type)) constraints -= 10;
  if (wantGear.length && car.transmission && !wantGear.includes(car.transmission)) constraints -= 10;
  if (state.favMakes.size && car.make && !state.favMakes.has(car.make)) constraints -= 4;
  const weights = profile.weights || DEFAULT_PROFILE.weights;
  const features = ["reliability", "economy", "safety", "maintenance", "performance"];
  const totalWeight = features.reduce((total, key) => total + (Number(weights[key]) || 0), 0) || 1;
  const weightedFeatures = features.reduce((total, key) => total + ((Number(car[key]) || 3) / 5) * 100 * (Number(weights[key]) || 0), 0) / totalWeight;
  const excluded = (profile.excluded_terms || []).some((term) => term && `${car.title} ${car.make} ${car.model} ${car.engine}`.toLowerCase().includes(term.toLowerCase()));
  let score = Math.round(Math.max(0, Math.min(100, constraints)) * 0.74 + weightedFeatures * 0.26);
  if (excluded) score = Math.max(0, score - 28);
  return score;
}

function scoreLabel(score) {
  if (score >= 82) return ["התאמה גבוהה", "good"];
  if (score >= 65) return ["שווה בדיקה", "medium"];
  return ["פחות מתאים", "low"];
}

function navButton(view, label, iconName, count = null) {
  return `<button class="nav-link ${state.view === view ? "active" : ""}" data-view="${view}">${icon(iconName)}<span>${label}</span>${count != null && count > 0 ? `<span class="nav-count">${count}</span>` : ""}</button>`;
}

function renderShell() {
  const favCount = state.favorites.size;
  const compareCount = state.compareIds.size;
  const identity = state.cloud ? (state.user?.email || "החשבון שלי") : "משתמש מקומי";
  return `<div class="app-shell ${state.compareIds.size && state.view !== "compare" ? "has-drawer" : ""}">
    <div class="sidebar-backdrop" data-action="mobile-menu"></div>
    <aside class="sidebar">
      <a class="brand" href="#" data-view="cars"><span class="brand-mark">C</span><span class="brand-copy"><b>CarSift</b><small>החלטה טובה מתחילה כאן</small></span></a>
      <div class="workspace-label">המרחב שלי</div>
      <nav class="side-nav">${navButton("cars", "מאגר הרכבים", "cars")}${navButton("compare", "השוואה", "compare", compareCount)}${navButton("favorites", "מועדפים", "heart", favCount)}${navButton("profile", "פרופיל חיפוש", "profile")}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-tip"><span class="tip-icon">${icon("bolt", 17)}</span><div><b>בחירה חכמה</b><p>ציון ההתאמה מתעדכן לפי הדרישות האישיות שלך.</p><button data-view="profile">עדכון הדרישות ${icon("arrow", 14)}</button></div></div>
      <div class="account-card"><span class="avatar">${html((state.profile.display_name || identity).slice(0, 1).toUpperCase())}</span><span class="account-copy"><b>${html(state.profile.display_name || identity)}</b><small>${state.cloud ? "חשבון מחובר" : "הנתונים נשמרים בדפדפן"}</small></span>${state.cloud ? `<button class="icon-button account-action" title="יציאה" data-action="signout">↪</button>` : ""}</div>
    </aside>
    <div class="main-column">
      <header class="topbar"><button class="mobile-menu icon-button" aria-label="תפריט" data-action="mobile-menu">${icon("menu")}</button><div class="breadcrumb"><span>CarSift</span><span class="crumb-dot">/</span><b>${state.view === "cars" ? "מאגר הרכבים" : state.view === "compare" ? "השוואה" : state.view === "favorites" ? "המועדפים שלי" : "פרופיל חיפוש"}</b></div><div class="top-actions"><span class="connection-pill ${state.cloud ? "connected" : "local"}"><i></i>${state.cloud ? "מסד משותף" : "שמור במכשיר"}</span><button class="top-icon" title="ייבוא JSON" data-action="import-file">${icon("upload", 18)}</button><button class="top-icon" title="ייצוא JSON" data-action="export">${icon("download", 18)}</button><button class="avatar top-avatar" data-view="profile">${html((state.profile.display_name || identity).slice(0, 1).toUpperCase())}</button></div></header>
      <main class="workspace-content">${state.loading ? `<div class="loading-panel"><span class="spinner"></span><span>טוענים את המאגר שלך…</span></div>` : renderView()}</main>
    </div>
    <nav class="mobile-nav">${navButton("cars", "רכבים", "cars")}${navButton("compare", "השוואה", "compare", compareCount)}${navButton("favorites", "מועדפים", "heart", favCount)}${navButton("profile", "פרופיל", "profile")}</nav>
    <input id="json-file" type="file" accept="application/json,.json" hidden />
    <div class="toast" role="status"></div>
    ${state.loading ? "" : renderCompareDrawer()}
    ${state.modal ? renderModal() : ""}
    ${state.authRequired ? renderAuthGate() : ""}
    ${state.authDenied ? renderDeniedGate() : ""}
  </div>`;
}

function renderView() {
  if (state.view === "compare") return renderCompare();
  if (state.view === "profile") return renderProfile();
  return renderCars(state.view === "favorites");
}

/* ---------- Filtering ---------- */
const fuelGroupOf = (car) => FUEL_GROUPS.find((group) => group.values.includes(car.fuel_type))?.key || "";
const km = (value) => value ? `${number(value)} ק״מ` : "—";
const hand = (value) => value ? `יד ${number(value)}` : "—";
const roundDown = (value, step) => Math.floor(value / step) * step;
const roundUp = (value, step) => Math.ceil(value / step) * step;

function dataBounds() {
  const prices = state.cars.map((car) => car.price_ils).filter(Boolean);
  const years = state.cars.map((car) => car.year).filter(Boolean);
  const mileages = state.cars.map((car) => car.mileage_km).filter((value) => value != null);
  return {
    priceMin: prices.length ? roundDown(Math.min(...prices), 5000) : 0,
    priceMax: prices.length ? roundUp(Math.max(...prices), 5000) : 300000,
    years: [...new Set(years)].sort((a, b) => b - a),
    mileageMax: mileages.length ? Math.max(roundUp(Math.max(...mileages), 10000), 10000) : 300000,
  };
}

function activeFilterCount() {
  const f = state.filters;
  return f.makes.length + f.models.length + f.fuels.length + f.features.length
    + (f.priceMin != null || f.priceMax != null ? 1 : 0) + (f.yearMin ? 1 : 0) + (f.mileageMax != null ? 1 : 0) + (f.handMax ? 1 : 0);
}

const modelKey = (car) => `${car.make}|${car.model}`;

function matchesFilters(car) {
  const f = state.filters;
  if (f.makes.length && !f.makes.includes(car.make)) return false;
  if (f.models.length) {
    // A model filter only narrows the makes it belongs to; other selected makes stay fully visible.
    const makesWithModels = new Set(f.models.map((key) => key.split("|")[0]));
    if (makesWithModels.has(car.make) && !f.models.includes(modelKey(car))) return false;
    if (!f.makes.length && !makesWithModels.has(car.make)) return false;
  }
  if (f.priceMin != null && !(car.price_ils >= f.priceMin)) return false;
  if (f.priceMax != null && !(car.price_ils && car.price_ils <= f.priceMax)) return false;
  if (f.yearMin && !(car.year >= f.yearMin)) return false;
  if (f.mileageMax != null && !(car.mileage_km != null && car.mileage_km <= f.mileageMax)) return false;
  if (f.fuels.length && !f.fuels.includes(fuelGroupOf(car))) return false;
  if (f.handMax && !(car.owners && car.owners <= f.handMax)) return false;
  if (f.features.length && !f.features.every((key) => car.features.includes(key))) return false;
  return true;
}

const SORTS = {
  score: ["התאמה הגבוהה ביותר", (a, b) => scoreCar(b) - scoreCar(a)],
  price_asc: ["מחיר: מהנמוך לגבוה", (a, b) => (a.price_ils ?? Infinity) - (b.price_ils ?? Infinity)],
  price_desc: ["מחיר: מהגבוה לנמוך", (a, b) => (b.price_ils ?? -1) - (a.price_ils ?? -1)],
  year_desc: ["שנתון: החדש ביותר", (a, b) => (b.year ?? 0) - (a.year ?? 0)],
  km_asc: ["קילומטראז׳: הנמוך ביותר", (a, b) => (a.mileage_km ?? Infinity) - (b.mileage_km ?? Infinity)],
  priority: ["עדיפות: 10 עד 1", (a, b) => priorityOf(b.id) - priorityOf(a.id) || scoreCar(b) - scoreCar(a)],
  newest: ["נוספו לאחרונה", (a, b) => String(b.created_at).localeCompare(String(a.created_at))],
};

function visibleCars(favoritesOnly = state.view === "favorites") {
  const query = state.search.trim().toLowerCase();
  return state.cars
    .filter((car) => !favoritesOnly || state.favorites.has(car.id))
    .filter((car) => !state.onlyFavMakes || !state.favMakes.size || state.favMakes.has(car.make))
    .filter(matchesFilters)
    .filter((car) => !query || `${car.title} ${car.make} ${car.model} ${car.trim} ${car.year || ""} ${car.city} ${car.body_type}`.toLowerCase().includes(query))
    .sort((SORTS[state.sort] || SORTS.score)[1]);
}

/* ---------- Filter panel ---------- */
function chip(group, value, label, count = null) {
  const on = state.filters[group].includes(value);
  return `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-filter-toggle="${group}" data-value="${html(value)}">${on ? icon("check", 13) : ""}<span>${html(label)}</span>${count != null ? `<small>${count}</small>` : ""}</button>`;
}

function renderFilterPanel() {
  const f = state.filters;
  const b = dataBounds();
  const count = (fn) => state.cars.filter(fn).length;
  const makes = [...new Set(state.cars.map((car) => car.make).filter(Boolean))].sort((a, z) => a.localeCompare(z));
  const modelSource = state.cars.filter((car) => car.model && (!f.makes.length || f.makes.includes(car.make)));
  const models = [...new Map(modelSource.map((car) => [modelKey(car), car])).values()].sort((a, z) => modelKey(a).localeCompare(modelKey(z)));
  const lo = f.priceMin ?? b.priceMin;
  const hi = f.priceMax ?? b.priceMax;
  const span = Math.max(1, b.priceMax - b.priceMin);
  const mileage = f.mileageMax ?? b.mileageMax;
  const active = activeFilterCount();
  return `<div class="filter-head"><h2>${icon("search", 17)} סינון</h2>${active ? `<button type="button" class="text-button small" data-action="clear-filters">ניקוי (${active})</button>` : ""}<button type="button" class="icon-button filter-close" aria-label="סגירת סינון" data-action="toggle-filters">${icon("close", 18)}</button></div>
    <div class="filter-scroll">
      <section class="filter-group"><h3>יצרן</h3><div class="chip-wrap">${makes.map((make) => chip("makes", make, make, count((car) => car.make === make))).join("") || `<p class="muted">אין עדיין יצרנים במאגר</p>`}</div></section>
      <section class="filter-group"><h3>דגם ${f.makes.length ? "" : `<small>כל היצרנים</small>`}</h3><div class="chip-wrap">${models.map((car) => chip("models", modelKey(car), f.makes.length === 1 ? car.model : `${car.make} ${car.model}`, count((c) => modelKey(c) === modelKey(car)))).join("") || `<p class="muted">אין דגמים</p>`}</div></section>
      <section class="filter-group"><h3>טווח מחיר</h3><div class="range-values"><output id="price-lo-label">${money(lo)}</output><span>—</span><output id="price-hi-label">${money(hi)}</output></div>
        <div class="dual-range" style="--lo:${((lo - b.priceMin) / span) * 100}%;--hi:${((hi - b.priceMin) / span) * 100}%"><div class="dual-track"><i></i></div><input id="f-price-min" type="range" min="${b.priceMin}" max="${b.priceMax}" step="1000" value="${lo}" aria-label="מחיר מינימלי" /><input id="f-price-max" type="range" min="${b.priceMin}" max="${b.priceMax}" step="1000" value="${hi}" aria-label="מחיר מקסימלי" /></div>
        <div class="range-scale"><span>${money(b.priceMin)}</span><span>${money(b.priceMax)}</span></div></section>
      <section class="filter-group"><h3>שנתון מינימלי</h3><select id="f-year" class="sort-select full"><option value="">כל השנים</option>${b.years.map((year) => `<option value="${year}" ${f.yearMin === year ? "selected" : ""}>${year} ומעלה</option>`).join("")}</select></section>
      <section class="filter-group"><h3>קילומטראז׳ מקסימלי</h3><div class="range-values"><output id="km-label">${f.mileageMax == null ? "ללא הגבלה" : `עד ${km(mileage)}`}</output></div><input id="f-mileage" class="single-range" type="range" min="0" max="${b.mileageMax}" step="5000" value="${mileage}" style="--fill:${(mileage / b.mileageMax) * 100}%" aria-label="קילומטראז׳ מקסימלי" /><div class="range-scale"><span>0</span><span>${km(b.mileageMax)}</span></div></section>
      <section class="filter-group"><h3>הנעה</h3><div class="pill-row">${FUEL_GROUPS.map((group) => chip("fuels", group.key, group.label, count((car) => fuelGroupOf(car) === group.key))).join("")}</div></section>
      <section class="filter-group"><h3>יד</h3><div class="segmented">${[[null, "הכל"], [1, "יד 1"], [2, "עד 2"], [3, "עד 3"]].map(([value, label]) => `<button type="button" class="${f.handMax === value ? "on" : ""}" data-hand="${value ?? ""}">${label}</button>`).join("")}</div></section>
      <section class="filter-group"><h3>אבזור <small>כל הנבחרים</small></h3><div class="check-list">${FEATURES.map((feature) => `<label class="check-row"><input type="checkbox" data-feature-filter="${feature.key}" ${f.features.includes(feature.key) ? "checked" : ""} /><span class="box">${icon("check", 12)}</span><span>${feature.label}</span><small>${count((car) => car.features.includes(feature.key))}</small></label>`).join("")}</div></section>
    </div>
    <div class="filter-foot"><button type="button" class="primary-button full-button" data-action="toggle-filters">הצגת <span data-result-count>${number(visibleCars().length)}</span> רכבים</button></div>`;
}

function activeChips() {
  const f = state.filters;
  const out = [];
  f.makes.forEach((value) => out.push(["makes", value, value]));
  f.models.forEach((value) => out.push(["models", value, value.replace("|", " ")]));
  if (f.priceMin != null || f.priceMax != null) out.push(["price", "", `${money(f.priceMin ?? dataBounds().priceMin)} – ${money(f.priceMax ?? dataBounds().priceMax)}`]);
  if (f.yearMin) out.push(["yearMin", "", `מ-${f.yearMin}`]);
  if (f.mileageMax != null) out.push(["mileageMax", "", `עד ${km(f.mileageMax)}`]);
  f.fuels.forEach((value) => out.push(["fuels", value, FUEL_GROUPS.find((g) => g.key === value)?.label || value]));
  if (f.handMax) out.push(["handMax", "", f.handMax === 1 ? "יד 1" : `עד יד ${f.handMax}`]);
  f.features.forEach((value) => out.push(["features", value, FEATURE_LABEL[value]]));
  return out.length ? `<div class="active-chips">${out.map(([group, value, label]) => `<button type="button" class="active-chip" data-action="remove-filter" data-group="${group}" data-value="${html(value)}">${html(label)} ${icon("close", 12)}</button>`).join("")}<button type="button" class="text-button small" data-action="clear-filters">ניקוי הכל</button></div>` : "";
}

function renderResults(favoritesOnly = state.view === "favorites") {
  const list = visibleCars(favoritesOnly);
  const pool = favoritesOnly ? state.cars.filter((car) => state.favorites.has(car.id)) : state.cars;
  const empty = !pool.length
    ? `<div class="empty-state"><span class="empty-icon">${icon(favoritesOnly ? "heart" : "cars", 27)}</span><h3>${favoritesOnly ? "עוד לא שמרת מועדפים" : "המאגר שלך מתחיל כאן"}</h3><p>${favoritesOnly ? "לחץ על הלב בכרטיס רכב כדי לשמור אותו כאן." : "הוסף מודעה, צילום מסך או פרטים ידנית — ונחשב התאמה לפי הפרופיל שלך."}</p>${favoritesOnly ? `<button class="secondary-button" data-view="cars">למאגר הרכבים</button>` : `<button class="primary-button" data-action="open-add">${icon("plus", 17)} הוספת הרכב הראשון</button>`}</div>`
    : `<div class="empty-state"><span class="empty-icon">${icon("search", 27)}</span><h3>לא מצאנו רכבים שמתאימים לסינון</h3><p>נסה להרחיב את טווח המחיר, להסיר אבזור או לנקות את החיפוש.</p><button class="secondary-button" data-action="clear-filters">ניקוי כל המסננים</button></div>`;
  return `${activeChips()}${list.length ? `<div class="car-grid">${list.map(renderCarCard).join("")}</div>` : empty}`;
}

function renderCars(favoritesOnly = false) {
  const title = favoritesOnly ? "המועדפים שלי" : "מאגר הרכבים";
  const sub = favoritesOnly
    ? (state.cloud && state.favoritesMode === "cloud" ? "הרכבים ששמרת — מסונכרנים לחשבון שלך." : "הרכבים ששמרת — נשמרים בדפדפן הזה.")
    : "כל האפשרויות, במקום אחד. הציון מותאם לדרישות האישיות שלך.";
  const avg = state.cars.length ? Math.round(state.cars.reduce((sum, car) => sum + scoreCar(car), 0) / state.cars.length) : 0;
  const underBudget = state.cars.filter((car) => !car.price_ils || car.price_ils <= state.profile.budget_max).length;
  const active = activeFilterCount();
  return `<section class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> החיפוש שלך, מפוקס יותר</div><h1>${title}</h1><p>${sub}</p></div><button class="primary-button" data-action="open-add">${icon("plus", 18)} הוספת רכב</button></section>
    ${!favoritesOnly ? `<section class="summary-grid"><article class="summary-card"><div class="summary-icon violet">${icon("cars")}</div><div><span>רכבים במאגר</span><strong>${number(state.cars.length)}</strong></div><span class="summary-foot">${state.cloud ? "משותף למשתמשים שאושרו" : "נשמר בדפדפן הזה"}</span></article><article class="summary-card"><div class="summary-icon green">${icon("bolt")}</div><div><span>ממוצע התאמה</span><strong>${avg}<small>/100</small></strong></div><span class="summary-foot">לפי הפרופיל שלך</span></article><article class="summary-card"><div class="summary-icon amber">${icon("check")}</div><div><span>בתוך התקציב</span><strong>${number(underBudget)}</strong></div><span class="summary-foot">עד ${money(state.profile.budget_max)}</span></article><article class="summary-card"><div class="summary-icon rose">${icon("heart")}</div><div><span>מועדפים</span><strong>${number(state.favorites.size)}</strong></div><span class="summary-foot">${state.cloud && state.favoritesMode === "cloud" ? "מסונכרנים לחשבון" : "נשמרים במכשיר"}</span></article></section>` : ""}
    <div class="browse-layout">
      <div class="filter-backdrop ${state.filtersOpen ? "open" : ""}" data-action="toggle-filters"></div>
      <aside id="filter-panel" class="filter-panel ${state.filtersOpen ? "open" : ""}" aria-label="סינון רכבים">${renderFilterPanel()}</aside>
      ${renderSiteSearch()}${renderFavTypes()}<section class="listing-toolbar"><div class="toolbar-title"><div><h2>${favoritesOnly ? "הרכבים ששמרת" : "כל הרכבים"}</h2><span><b data-result-count>${number(visibleCars(favoritesOnly).length)}</b> תוצאות</span></div><div class="toolbar-controls"><button type="button" class="secondary-button filter-open" data-action="toggle-filters">${icon("menu", 17)} סינון${active ? ` <span class="nav-count" data-filter-count>${active}</span>` : ""}</button><label class="search-box">${icon("search", 18)}<input id="car-search" type="search" placeholder="חיפוש דגם, שנה או עיר…" value="${html(state.search)}" autocomplete="off" /></label><select class="sort-select" id="car-sort" aria-label="מיון">${Object.entries(SORTS).map(([key, [label]]) => `<option value="${key}" ${state.sort === key ? "selected" : ""}>${label}</option>`).join("")}</select></div></div>
        <div id="results">${renderResults(favoritesOnly)}</div>
      </section>
    </div>`;
}

function featurePreview(car, max = 3) {
  if (!car.features.length) return "";
  const shown = car.features.slice(0, max).map((key) => `<span>${html(FEATURE_LABEL[key])}</span>`).join("");
  return `<div class="feature-preview">${shown}${car.features.length > max ? `<span class="more">+${car.features.length - max}</span>` : ""}</div>`;
}

function priorityControl(id) {
  const current = priorityOf(id);
  return `<label class="prio-row"><span>עדיפות (1–10)</span><select data-prio data-id="${html(id)}" aria-label="עדיפות מ-1 עד 10"><option value="0" ${current ? "" : "selected"}>לא נקבע</option>${Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => `<option value="${n}" ${current === n ? "selected" : ""}>${n}${n === 10 ? " – הכי חשוב" : n === 1 ? " – הכי פחות" : ""}</option>`).join("")}</select></label>`;
}

const SEARCH_SITES = [["yad2.co.il", "יד2"], ["winwin.co.il", "WinWin"], ["facebook.com/marketplace", "Facebook Marketplace"], ["", "גוגל"]];

function siteSearchQuery() {
  const f = state.filters;
  const models = f.models.map((key) => key.split("|").slice(1).join(" "));
  const makes = f.makes.filter((make) => !f.models.some((key) => key.split("|")[0] === make));
  return [...new Set([...makes, ...f.models.map((key) => key.replace("|", " "))])].slice(0, 3).join(" ")
    + (f.yearMin ? ` ${f.yearMin}` : "") + (models.length || makes.length ? "" : "") ;
}

function openSiteSearch(site) {
  const terms = siteSearchQuery() || "רכב משומש";
  let url;
  if (site === "facebook.com/marketplace") url = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(terms)}`;
  else url = `https://www.google.com/search?q=${encodeURIComponent((site ? `site:${site} ` : "") + terms + " למכירה")}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderSiteSearch() {
  return `<section class="site-search"><div><h3>חיפוש באתרי מודעות</h3><p>פותח חיפוש באתר לפי היצרן, הדגם והשנתון שבחרת בסינון. את המודעה שמצאת אפשר להוסיף כאן עם "הוספת רכב".</p></div><div class="chip-row">${SEARCH_SITES.map(([site, label]) => `<button type="button" class="chip" data-site-search="${html(site)}">${icon("arrow", 13)}<span>${html(label)}</span></button>`).join("")}</div></section>`;
}

function renderFavTypes() {
  const makes = allMakes();
  return `<section class="fav-types"><div class="fav-types-head"><div><h3>סוגי הרכב האהובים עליי</h3><p>בחר כמה יצרנים שמעניינים אותך. רכבים מהם יסומנו בכוכב.</p></div>${state.favMakes.size ? `<button type="button" class="chip ${state.onlyFavMakes ? "on" : ""}" aria-pressed="${state.onlyFavMakes}" data-only-fav-makes>${state.onlyFavMakes ? icon("check", 13) : ""}<span>הצג רק אותם</span></button>` : ""}</div><div class="chip-row">${makes.map((make) => { const on = state.favMakes.has(make); return `<button type="button" class="chip ${on ? "on" : ""}" aria-pressed="${on}" data-fav-make="${html(make)}">${on ? icon("heart", 13) : ""}<span>${html(make)}</span></button>`; }).join("")}</div></section>`;
}

function renderCarCard(car) {
  const score = scoreCar(car);
  const [label, tone] = scoreLabel(score);
  const selected = state.compareIds.has(car.id);
  const initials = html((car.make || car.title || "CS").slice(0, 2));
  const fav = state.favorites.has(car.id);
  return `<article class="car-card ${selected ? "is-compared" : ""}"><div class="car-art art-${Math.abs(String(car.id).split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4}" data-action="details" data-id="${html(car.id)}"><div class="art-noise"></div><span class="car-class">${html(car.body_type || "רכב משומש")}</span><button class="favorite-button ${fav ? "favorited" : ""}" aria-pressed="${fav}" aria-label="${fav ? "הסרה ממועדפים" : "הוספה למועדפים"}" data-action="favorite" data-id="${html(car.id)}">${icon("heart", 19)}</button><div class="car-illustration"><span>${initials}</span></div><div class="art-bottom"><span>${html(car.year || "שנתון לא צוין")}</span><span>${html(car.city || "מיקום לא צוין")}</span></div></div>
    <div class="car-card-body"><div class="car-title-row"><div><h3><button class="title-link" data-action="details" data-id="${html(car.id)}">${html(car.title)}</button></h3><p>${html([car.trim, car.engine && `${car.engine} ל׳`].filter(Boolean).join(" · ") || car.make || "פרטים נוספים במודעה")}</p></div><div class="score-ring ${tone}" style="--score:${score}" title="${html(label)}"><strong>${score}</strong><small>התאמה</small></div></div>
      <div class="car-price">${money(car.price_ils)}</div>
      <div class="car-facts"><div><span>שנתון</span><b>${html(car.year || "—")}</b></div><div><span>ק״מ</span><b>${car.mileage_km != null ? number(car.mileage_km) : "—"}</b></div><div><span>יד</span><b>${car.owners ? number(car.owners) : "—"}</b></div></div>
      <div class="car-tags">${state.favMakes.has(car.make) ? `<span class="my-type">★ מהסוגים שלי</span>` : ""}<span>${html(car.fuel_type || "דלק לא צוין")}</span><span>${html(car.transmission || "גיר לא צוין")}</span></div>
      ${featurePreview(car)}
      ${fav ? priorityControl(car.id) : ""}
      <div class="car-card-actions"><button class="text-button" data-action="details" data-id="${html(car.id)}">פרטים מלאים ${icon("arrow", 14)}</button><button class="compare-toggle ${selected ? "selected" : ""}" aria-pressed="${selected}" data-action="compare-toggle" data-id="${html(car.id)}">${selected ? icon("check", 15) : icon("compare", 15)} ${selected ? "בהשוואה" : "השוואה"}</button></div>
    </div></article>`;
}

/* ---------- Comparison ---------- */
const rating = (value) => `<span class="rating-dots" aria-label="${Number(value || 3)} מתוך 5">${Array.from({ length: 5 }, (_, i) => `<i class="${i < Number(value || 3) ? "on" : ""}"></i>`).join("")}</span>`;

// Each row: [label, render(car), bestFn?] — bestFn picks the winning raw value among compared cars.
function compareRows(full = true) {
  const rows = [
    ["ציון התאמה", (car) => `<b>${scoreCar(car)}</b>/100`, { value: scoreCar, best: Math.max }],
    ["מחיר", (car) => money(car.price_ils), { value: (car) => car.price_ils, best: Math.min }],
    ["שנתון", (car) => html(car.year || "—"), { value: (car) => car.year, best: Math.max }],
    ["קילומטראז׳", (car) => km(car.mileage_km), { value: (car) => car.mileage_km, best: Math.min }],
    ["יד", (car) => hand(car.owners), { value: (car) => car.owners, best: Math.min }],
    ["הנעה", (car) => html(car.fuel_type || "—")],
    ["תיבת הילוכים", (car) => html(car.transmission || "—")],
  ];
  if (!full) return [...rows, ["אבזור", (car) => `${car.features.length} / ${FEATURES.length}`, { value: (car) => car.features.length, best: Math.max }]];
  return [...rows,
    ["סוג רכב", (car) => html(car.body_type || "—")],
    ["נפח מנוע", (car) => html(car.engine ? `${car.engine} ל׳` : "—")],
    ["עיר", (car) => html(car.city || "—")],
    ["אמינות", (car) => rating(car.reliability)], ["חיסכון", (car) => rating(car.economy)], ["בטיחות", (car) => rating(car.safety)], ["אחזקה", (car) => rating(car.maintenance)], ["ביצועים", (car) => rating(car.performance)],
    ...FEATURES.map((feature) => [feature.label, (car) => car.features.includes(feature.key) ? `<span class="yes">${icon("check", 15)}</span>` : `<span class="no">—</span>`, null, "feature-row"]),
  ];
}

function compareTable(cars, full = true) {
  const rows = compareRows(full);
  const cell = (row, car) => {
    const [, render, best] = row;
    let cls = "";
    if (best && cars.length > 1) {
      const values = cars.map(best.value).filter((v) => v != null && v !== "");
      const winner = values.length ? best.best(...values) : null;
      if (winner != null && best.value(car) === winner && values.filter((v) => v === winner).length < cars.length) cls = "best";
    }
    return `<td class="${cls}">${render(car)}</td>`;
  };
  return `<table class="compare-grid ${full ? "full" : "mini"}"><thead><tr><th scope="col"><span class="sr-only">נתון</span></th>${cars.map((car) => `<th scope="col"><div class="compare-head"><button class="remove-compare icon-button" title="הסרה מההשוואה" aria-label="הסרת ${html(car.title)} מההשוואה" data-action="compare-toggle" data-id="${html(car.id)}">${icon("close", 14)}</button><span class="compare-car-art">${html((car.make || "CS").slice(0, 2))}</span><button class="title-link" data-action="details" data-id="${html(car.id)}">${html(car.title)}</button><small>${html([car.year, car.trim].filter(Boolean).join(" · "))}</small></div></th>`).join("")}${full ? "" : Array.from({ length: 3 - cars.length }, () => `<th scope="col"><div class="compare-slot">${icon("plus", 18)}<span>הוסיפו רכב<br/>מהרשימה</span></div></th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr class="${row[3] || ""}"><th scope="row">${row[0]}</th>${cars.map((car) => cell(row, car)).join("")}${full ? "" : Array.from({ length: 3 - cars.length }, () => "<td></td>").join("")}</tr>`).join("")}</tbody></table>`;
}

function renderCompareDrawer() {
  const cars = [...state.compareIds].map((id) => state.cars.find((car) => car.id === id)).filter(Boolean);
  if (!cars.length || state.view === "compare") return "";
  return `<aside class="compare-drawer ${state.drawerOpen ? "open" : ""}" aria-label="השוואת רכבים"><div class="drawer-bar"><button type="button" class="drawer-toggle" data-action="toggle-drawer" aria-expanded="${state.drawerOpen}">${icon("compare", 18)}<b>השוואה</b><span class="drawer-count">${cars.length}/3</span><span class="drawer-names">${cars.map((car) => html(car.title)).join(" · ")}</span><span class="chev">${state.drawerOpen ? "▾" : "▴"}</span></button><div class="drawer-actions"><button type="button" class="text-button small" data-action="clear-compare">ניקוי</button><button type="button" class="primary-button small" data-view="compare" ${cars.length < 2 ? "disabled" : ""}>השוואה מלאה ${icon("arrow", 14)}</button></div></div>${state.drawerOpen ? `<div class="drawer-body">${compareTable(cars, false)}</div>` : ""}</aside>`;
}

function renderCompare() {
  const cars = [...state.compareIds].map((id) => state.cars.find((car) => car.id === id)).filter(Boolean);
  return `<section class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> החלטה שמבוססת על הנתונים</div><h1>משווים ומחליטים</h1><p>עד 3 רכבים זה לצד זה. הערך הטוב ביותר בכל שורה מודגש.</p></div><button class="secondary-button" data-view="cars">${icon("cars", 17)} חזרה למאגר</button></section>
    ${cars.length < 2 ? `<div class="empty-state compare-empty"><span class="empty-icon">${icon("compare", 27)}</span><h3>${cars.length ? "צריך עוד רכב אחד להשוואה" : "בחר לפחות שני רכבים"}</h3><p>חזור למאגר ולחץ על כפתור ההשוואה בכרטיסים. אפשר להשוות עד שלושה רכבים יחד.</p><button class="primary-button" data-view="cars">בחירת רכבים ${icon("arrow", 15)}</button></div>` : `<section class="comparison-wrap"><div class="comparison-header"><div class="comparison-label">${icon("shield", 18)} השוואה לפי הפרופיל שלך</div><button class="text-button small" data-action="clear-compare">ניקוי ההשוואה</button></div><div class="table-scroll">${compareTable(cars, true)}</div><div class="comparison-note">${icon("bolt", 16)} ציוני הרכב הם הערכות ראשוניות. כדאי לאמת מצב מכני, היסטוריית טיפולים ותאונות לפני קנייה.</div></section>`}`;
}

const COMMON_MAKES = ["Toyota", "Hyundai", "Kia", "Mazda", "Skoda", "Volkswagen", "Suzuki", "Nissan", "Honda", "Mitsubishi", "Seat", "Renault", "Peugeot", "Citroen", "Chevrolet", "Ford", "BMW", "Mercedes-Benz", "Audi", "Tesla", "BYD", "Volvo", "MG", "Subaru", "Dacia"];
const allMakes = () => [...new Set([...COMMON_MAKES, ...state.cars.map((car) => car.make), ...state.favMakes].filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
const prefList = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);

function multiPick(name, label, values, selectedValue, wide = false) {
  const chosen = new Set(Array.isArray(selectedValue) ? selectedValue : prefList(selectedValue));
  return `<fieldset class="field multi-field ${wide ? "wide-field" : ""}"><span>${label} <small>(אפשר לבחור כמה)</small></span><div class="chip-row">${values.map((value) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${html(value)}" ${chosen.has(value) ? "checked" : ""} /><span>${html(value)}</span></label>`).join("")}</div></fieldset>`;
}

function selectOptions(values, selected = "", placeholder = "לא משנה") {
  return `<option value="">${placeholder}</option>${values.map((value) => `<option value="${html(value)}" ${selected === value ? "selected" : ""}>${html(value)}</option>`).join("")}`;
}

function renderProfile() {
  const p = state.profile;
  const weights = p.weights || DEFAULT_PROFILE.weights;
  const slider = (key, label, value) => `<label class="weight-control"><span><b>${label}</b><strong data-weight-label="${key}">${value}/10</strong></span><input type="range" name="weight_${key}" min="0" max="10" value="${html(value)}" data-weight="${key}" /></label>`;
  return `<section class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> הגדרות אישיות</div><h1>מה חשוב לך ברכב?</h1><p>הדרישות נשמרות בנפרד לכל משתמש ומשפיעות על ציוני ההתאמה.</p></div><span class="private-badge">${icon("shield", 15)} אישי ופרטי</span></section>
    <form id="profile-form" class="profile-layout"><div class="profile-main"><section class="form-panel"><div class="panel-heading"><span class="panel-number">01</span><div><h2>דרישות בסיס</h2><p>סינון ההעדפות העיקריות שלך</p></div></div><div class="form-grid two"><label class="field"><span>שם להצגה</span><input name="display_name" value="${html(p.display_name)}" placeholder="איך לפנות אליך?" maxlength="50" /></label><label class="field"><span>תקציב מקסימלי</span><div class="input-with-suffix"><input name="budget_max" type="number" min="0" step="1000" value="${html(p.budget_max)}" /><em>₪</em></div></label><label class="field"><span>שנתון מינימלי</span><input name="year_min" type="number" min="1980" max="2100" value="${html(p.year_min)}" /></label><label class="field"><span>קילומטראז׳ מקסימלי</span><div class="input-with-suffix"><input name="mileage_max" type="number" min="0" step="5000" value="${html(p.mileage_max)}" /><em>ק״מ</em></div></label><label class="field"><span>מספר בעלים מקסימלי</span><select name="owners_max">${selectOptions(["1", "2", "3", "4", "5"], String(p.owners_max))}</select></label>${multiPick("body_type", "סוג רכב מועדף", ["משפחתית", "סופר מיני", "קרוסאובר", "רכב פנאי", "האצ׳בק", "סדאן", "סטיישן", "קופה", "מסחרי"], p.body_type, true)}${multiPick("fuel_type", "סוג הנעה מועדף", ["בנזין", "דיזל", "היברידי", "היברידי נטען", "חשמלי", "גפ״מ"], p.fuel_type, true)}${multiPick("transmission", "תיבת הילוכים מועדפת", ["אוטומטית", "ידנית", "רובוטית", "רציפה"], p.transmission, true)}${multiPick("fav_make", "יצרנים אהובים", allMakes(), [...state.favMakes], true)}</div></section>
      <section class="form-panel"><div class="panel-heading"><span class="panel-number">02</span><div><h2>מה מקבל יותר משקל?</h2><p>הזז את הסרגלים כדי להתאים את חישוב הציון</p></div></div><div class="weights-grid">${slider("reliability", "אמינות", weights.reliability)}${slider("economy", "צריכת דלק", weights.economy)}${slider("safety", "בטיחות", weights.safety)}${slider("maintenance", "עלויות אחזקה", weights.maintenance)}${slider("performance", "ביצועים", weights.performance)}</div></section>
      <section class="form-panel"><div class="panel-heading"><span class="panel-number">03</span><div><h2>דגמים ופרטים לפסילה</h2><p>הוסף מילות מפתח שלא תרצה לראות בציון גבוה</p></div></div><label class="field"><span>מילים או דגמים, מופרדים בפסיק</span><input name="excluded_terms" value="${html((p.excluded_terms || []).join(", "))}" placeholder="לדוגמה: מנוע 1.2, דגם מסוים" /></label><div class="form-hint">רכב שתואם למילה מהרשימה יקבל הפחתה בציון. אפשר לערוך את הפרופיל בכל עת.</div></section>
      <section class="form-panel"><div class="panel-heading"><span class="panel-number">04</span><div><h2>שמירת מועדפים</h2><p>איפה לשמור את הרכבים שסימנת בלב</p></div></div>${state.cloud ? `<div class="segmented wide" role="radiogroup" aria-label="מיקום שמירת מועדפים"><button type="button" role="radio" aria-checked="${state.favoritesMode === "cloud"}" class="${state.favoritesMode === "cloud" ? "on" : ""}" data-fav-mode="cloud">${icon("shield", 15)} בחשבון (Supabase)</button><button type="button" role="radio" aria-checked="${state.favoritesMode === "local"}" class="${state.favoritesMode === "local" ? "on" : ""}" data-fav-mode="local">${icon("download", 15)} במכשיר הזה</button></div><div class="form-hint">בחשבון — מסונכרן בין מכשירים. במכשיר — נשמר ב-localStorage של הדפדפן בלבד. במעבר לחשבון, המועדפים מהמכשיר מתווספים אליו.</div>` : `<div class="form-hint">${icon("download", 15)} במצב הדגמה המועדפים נשמרים ב-localStorage של הדפדפן. אחרי חיבור Supabase תוכלו לבחור לסנכרן אותם לחשבון.</div>`}</section>
      <div class="form-footer"><span>העדפות אלה נשמרות בפרופיל שלך בלבד.</span><button class="primary-button" type="submit">שמירת הפרופיל ${icon("check", 17)}</button></div>
    </div><aside class="profile-aside"><div class="profile-preview"><span class="preview-orbit orbit-one"></span><span class="preview-orbit orbit-two"></span><div class="preview-icon">${icon("profile", 27)}</div><h3>הפרופיל שלך</h3><p>המאגר משותף, אבל ההתאמה, הדרישות והמועדפים נשמרים בנפרד.</p><div class="preview-stat"><span>תקציב מקסימלי</span><b>${money(p.budget_max)}</b></div><div class="preview-stat"><span>שנתון מינימלי</span><b>${html(p.year_min)}</b></div><div class="preview-stat"><span>מועדפים אישיים</span><b>${number(state.favorites.size)}</b></div><div class="preview-foot">${icon("shield", 15)} הפרופיל מוגן בהרשאות משתמש</div></div></aside></form>`;
}

function addField(label, name, value = "", type = "text", placeholder = "", extra = "") {
  return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${html(value)}" placeholder="${placeholder}" ${extra} /></label>`;
}

function renderModal() {
  if (state.modal === "add") return renderCarModal();
  if (state.modal === "details") return renderDetailsModal();
  if (state.modal === "import") return renderImportModal();
  return "";
}

function renderCarModal() {
  const draft = state.draft || {};
  const editing = Boolean(state.editId);
  const tab = draft.tab || "link";
  const ratingField = (key, label) => `<label class="field"><span>${label}</span><select name="${key}">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(draft[key] || 3) === n ? "selected" : ""}>${n} / 5</option>`).join("")}</select></label>`;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal car-modal" role="dialog" aria-modal="true" aria-labelledby="car-modal-title"><button class="modal-close icon-button" aria-label="סגירה" data-action="close-modal">${icon("close")}</button><div class="modal-heading"><span class="modal-kicker">${editing ? "עדכון פרטי רכב" : "הוספה למאגר"}</span><h2 id="car-modal-title">${editing ? "עריכת רכב" : "בוא נכניס אותו לרשימה"}</h2><p>נחלץ את מה שאפשר, נבדוק יחד ונשמור רק אחרי אישור.</p></div>
    <div class="add-tabs"><button type="button" class="add-tab ${tab === "link" ? "active" : ""}" data-add-tab="link">${icon("link", 17)} קישור / טקסט</button><button type="button" class="add-tab ${tab === "photo" ? "active" : ""}" data-add-tab="photo">${icon("image", 17)} צילום מסך</button><button type="button" class="add-tab ${tab === "manual" ? "active" : ""}" data-add-tab="manual">${icon("edit", 17)} הזנה ידנית</button></div>
    ${tab === "link" ? `<div class="source-panel"><label class="field"><span>קישור למודעה</span><input name="source_url" data-draft="source_url" value="${html(draft.source_url || "")}" placeholder="https://…" dir="ltr" /></label><label class="field"><span>טקסט המודעה (אפשר להדביק כאן)</span><textarea name="listing_text" data-draft="listing_text" rows="3" placeholder="הדבק את תיאור המודעה כדי לחלץ ממנו פרטים…">${html(draft.listing_text || "")}</textarea></label><div class="source-note">${icon("shield", 15)} קישורים נשמרים. אתרי מודעות רבים חוסמים קריאה ישירה מהדפדפן, לכן אפשר להדביק את הטקסט או להעלות צילום מסך.</div><button type="button" class="secondary-button extract-button" data-action="extract-text">${icon("bolt", 16)} חילוץ פרטים מהטקסט</button></div>` : ""}
    ${tab === "photo" ? `<div class="source-panel photo-source"><label class="upload-zone" for="car-image"><span class="upload-icon">${icon("image", 25)}</span><b>העלה צילום מסך של המודעה</b><small>PNG, JPG או WEBP. התמונה מעובדת בדפדפן ולא נשמרת בענן.</small><span class="upload-cta">בחירת תמונה</span><input id="car-image" type="file" accept="image/*" /></label><div id="ocr-status" class="ocr-status">${html(draft.ocrStatus || "")}</div><label class="field"><span>הטקסט שזוהה — אפשר לתקן לפני חילוץ</span><textarea name="listing_text" data-draft="listing_text" rows="3" placeholder="הטקסט מהצילום יופיע כאן…">${html(draft.listing_text || "")}</textarea></label><button type="button" class="secondary-button extract-button" data-action="extract-text">${icon("bolt", 16)} חילוץ פרטים מהטקסט</button></div>` : ""}
    ${tab === "manual" ? `<div class="manual-intro">${icon("edit", 17)} הזן את הפרטים שיש לך. אפשר להשאיר שדות לא ידועים ריקים.</div>` : ""}
    <form id="car-form" class="car-form"><div class="review-header"><span class="review-step">אישור לפני שמירה</span><span>אפשר לתקן כל שדה</span></div><div class="form-grid two">${addField("יצרן", "make", draft.make || "", "text", "למשל Toyota")}${addField("דגם", "model", draft.model || "", "text", "למשל Corolla")}${addField("כותרת להצגה", "title", draft.title || "", "text", "נוצר אוטומטית מהיצרן והדגם")}<label class="field"><span>שנתון</span><input name="year" type="number" min="1950" max="2100" value="${html(draft.year || "")}" placeholder="2021" /></label><label class="field"><span>מחיר</span><div class="input-with-suffix"><input name="price_ils" type="number" min="0" step="1000" value="${html(draft.price_ils || "")}" placeholder="95000" /><em>₪</em></div></label><label class="field"><span>קילומטראז׳</span><div class="input-with-suffix"><input name="mileage_km" type="number" min="0" step="1000" value="${html(draft.mileage_km || "")}" placeholder="65000" /><em>ק״מ</em></div></label><label class="field"><span>מספר ידיים</span><input name="owners" type="number" min="1" max="20" value="${html(draft.owners || "")}" placeholder="2" /></label><label class="field"><span>עיר</span><input name="city" value="${html(draft.city || "")}" placeholder="תל אביב" /></label><label class="field"><span>סוג רכב</span><select name="body_type">${selectOptions(["משפחתית", "סופר מיני", "קרוסאובר", "רכב פנאי", "האצ׳בק", "סדאן", "סטיישן", "קופה", "מסחרי"], draft.body_type)}</select></label><label class="field"><span>סוג הנעה</span><select name="fuel_type">${selectOptions(["בנזין", "דיזל", "היברידי", "היברידי נטען", "חשמלי", "גפ״מ"], draft.fuel_type)}</select></label><label class="field"><span>תיבת הילוכים</span><select name="transmission">${selectOptions(["אוטומטית", "ידנית", "רובוטית", "רציפה"], draft.transmission)}</select></label>${addField("נפח מנוע", "engine", draft.engine || "", "text", "למשל 1.6")}${addField("רמת גימור", "trim", draft.trim || "", "text", "")}</div><div class="rating-heading"><b>הערכת רכב ראשונית</b><span>משפיעה על ציון ההתאמה</span></div><div class="form-grid five">${ratingField("reliability", "אמינות")}${ratingField("economy", "חיסכון")}${ratingField("safety", "בטיחות")}${ratingField("maintenance", "אחזקה")}${ratingField("performance", "ביצועים")}</div><div class="rating-heading"><b>אבזור</b><span>סמנו את מה שקיים ברכב</span></div><div class="check-list form-checks">${FEATURES.map((feature) => `<label class="check-row"><input type="checkbox" name="features" value="${feature.key}" ${(draft.features || []).includes(feature.key) ? "checked" : ""} /><span class="box">${icon("check", 12)}</span><span>${feature.label}</span></label>`).join("")}</div><label class="field notes-field"><span>הערות</span><textarea name="notes" rows="2" placeholder="הערות, מצב הרכב או נקודות לבדיקה…">${html(draft.notes || "")}</textarea></label><div class="form-footer modal-footer"><button type="button" class="text-button" data-action="close-modal">ביטול</button><button class="primary-button" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "שומר…" : editing ? "שמירת עדכון" : "אישור ושמירת הרכב"} ${icon("check", 16)}</button></div></form>
  </section></div>`;
}

function renderDetailsModal() {
  const car = state.cars.find((item) => item.id === state.draft.id);
  if (!car) return "";
  const canEdit = !state.cloud || car.created_by === state.user?.id;
  const score = scoreCar(car);
  const fav = state.favorites.has(car.id);
  const inCompare = state.compareIds.has(car.id);
  const facts = [["מחיר", money(car.price_ils)], ["שנתון", car.year || "—"], ["קילומטראז׳", km(car.mileage_km)], ["יד", hand(car.owners)], ["הנעה", car.fuel_type || "—"], ["גיר", car.transmission || "—"], ["סוג רכב", car.body_type || "—"], ["נפח מנוע", car.engine ? `${car.engine} ל׳` : "—"], ["עיר", car.city || "—"]];
  const ratings = [["אמינות", "reliability"], ["חיסכון", "economy"], ["בטיחות", "safety"], ["אחזקה", "maintenance"], ["ביצועים", "performance"]];
  const perYear = car.year && car.mileage_km != null ? Math.round(car.mileage_km / Math.max(1, new Date().getFullYear() - car.year + 1)) : null;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button class="modal-close icon-button" aria-label="סגירה" data-action="close-modal">${icon("close")}</button>
    <div class="detail-art art-${Math.abs(String(car.id).split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4}"><span>${html((car.make || "CS").slice(0, 2))}</span></div>
    <div class="detail-top"><div><span class="modal-kicker">${html([car.year, car.body_type].filter(Boolean).join(" · ") || "רכב משומש")}</span><h2 id="detail-title">${html(car.title)}</h2><p>${html([car.trim, car.engine && `${car.engine} ל׳`, car.city].filter(Boolean).join(" · "))}</p><div class="detail-price">${money(car.price_ils)}</div></div><div class="detail-score ${scoreLabel(score)[1]}">${score}<small>${scoreLabel(score)[0]}</small></div></div>
    <div class="detail-facts">${facts.map(([a, b]) => `<div><span>${a}</span><b>${html(b)}</b></div>`).join("")}</div>
    ${perYear ? `<p class="detail-hint">${icon("clock", 15)} ממוצע של כ-${number(perYear)} ק״מ לשנה</p>` : ""}
    <div class="detail-section"><h3>אבזור</h3><ul class="feature-list">${FEATURES.map((feature) => `<li class="${car.features.includes(feature.key) ? "has" : "missing"}">${car.features.includes(feature.key) ? icon("check", 14) : icon("close", 14)} ${feature.label}</li>`).join("")}</ul></div>
    <div class="detail-section"><h3>הערכה ראשונית</h3><div class="detail-ratings">${ratings.map(([label, key]) => `<div><span>${label}</span>${rating(car[key])}</div>`).join("")}</div></div>
    ${car.notes ? `<div class="detail-notes"><b>הערות</b><p>${html(car.notes)}</p></div>` : ""}
    ${car.source_url ? `<a class="source-link" href="${html(car.source_url)}" target="_blank" rel="noopener noreferrer">${icon("link", 16)} פתיחת המודעה המקורית ${icon("arrow", 14)}</a>` : ""}
    <div class="form-footer modal-footer"><div class="detail-actions">${fav ? priorityControl(car.id) : ""}<button class="secondary-button ${fav ? "favorited" : ""}" data-action="favorite" data-id="${html(car.id)}">${icon("heart", 16)} ${fav ? "במועדפים" : "שמירה"}</button><button class="compare-toggle ${inCompare ? "selected" : ""}" data-action="compare-toggle" data-id="${html(car.id)}">${icon(inCompare ? "check" : "compare", 15)} ${inCompare ? "בהשוואה" : "השוואה"}</button></div><div class="detail-actions">${canEdit ? `<button class="icon-button danger-button" title="מחיקת רכב" aria-label="מחיקת רכב" data-action="delete-car" data-id="${html(car.id)}">${icon("trash", 17)}</button><button class="secondary-button" data-action="edit-car" data-id="${html(car.id)}">${icon("edit", 16)} עריכה</button>` : ""}<button class="primary-button" data-action="close-modal">סיום</button></div></div></section></div>`;
}

function renderImportModal() {
  const preview = state.importPreview;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal import-modal" role="dialog" aria-modal="true"><button class="modal-close icon-button" aria-label="סגירה" data-action="close-modal">${icon("close")}</button><span class="modal-kicker">גיבוי והעברת נתונים</span><h2>ייבוא קובץ JSON</h2><p>ייבוא רכבים יוסיף אותם למאגר המשותף. הפרופיל שיובא יעדכן את הפרופיל האישי שלך בלבד.</p>${preview ? `<div class="import-preview"><div><b>${number(preview.cars.length)}</b><span>רכבים בקובץ</span></div><div><b>${preview.profile ? "כן" : "לא"}</b><span>פרופיל אישי</span></div><div><b>${number((preview.favorites || []).length)}</b><span>מועדפים</span></div></div><div class="source-note">${icon("shield", 15)} קובץ ממקור לא מוכר עלול להכיל נתונים לא תקינים. בדוק את הסיכום לפני הייבוא.</div><div class="form-footer modal-footer"><button class="text-button" data-action="close-modal">ביטול</button><button class="primary-button" data-action="confirm-import">ייבוא הנתונים ${icon("upload", 16)}</button></div>` : `<label class="upload-zone json-upload"><span class="upload-icon">${icon("upload", 25)}</span><b>בחירת קובץ JSON</b><small>בחר קובץ שיוצא מ-CarSift</small><span class="upload-cta">בחירת קובץ</span><input id="json-file-modal" type="file" accept="application/json,.json" /></label>`}</section></div>`;
}

function renderAuthGate() {
  return `<div class="gate-backdrop"><section class="gate-card"><span class="gate-brand brand-mark">C</span><span class="modal-kicker">ברוכים הבאים ל-CarSift</span><h2>היכנסו למרחב הרכבים</h2><p>נשלח אליכם קישור חד־פעמי למייל. רק משתמשים שאושרו יוכלו לגשת למאגר המשותף.</p>${state.authMessage ? `<div class="error-note">${html(state.authMessage)}</div>` : ""}<form id="auth-form"><label class="field"><span>כתובת מייל</span><input name="email" type="email" required autocomplete="email" placeholder="name@example.com" dir="ltr" /></label><button class="primary-button full-button" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "שולחים…" : "שלחו לי קישור כניסה"} ${icon("arrow", 16)}</button></form><div class="gate-security">${icon("shield", 15)} המייל משמש לכניסה בלבד. פרופיל החיפוש והמועדפים פרטיים.</div></section></div>`;
}

function renderDeniedGate() {
  return `<div class="gate-backdrop"><section class="gate-card"><span class="gate-brand brand-mark">C</span><span class="modal-kicker">אישור גישה נדרש</span><h2>החשבון עדיין לא הוזמן</h2><p>הצלחת להיכנס, אבל כתובת המייל שלך אינה ברשימת המשתמשים המורשים. בקש מבעל המאגר להוסיף אותה ב-Supabase.</p><div class="signed-in-email">${html(state.user?.email || "")}</div><button class="secondary-button full-button" data-action="signout">יציאה והחלפת חשבון</button><div class="gate-security">${icon("shield", 15)} נתוני המאגר נשארים חסומים עד לאישור חשבון.</div></section></div>`;
}

function render() {
  ensurePrefs();
  const y = window.scrollY;
  const filterScroll = document.querySelector(".filter-scroll")?.scrollTop || 0;
  app.innerHTML = renderShell();
  window.scrollTo(0, y);
  const panel = document.querySelector(".filter-scroll");
  if (panel) panel.scrollTop = filterScroll;
  document.body.classList.toggle("no-scroll", Boolean(state.modal || state.filtersOpen));
}

function parseListingText(text) {
  const result = {};
  const normalized = String(text || "").replace(/\u00a0/g, " ").replace(/[,٬]/g, "");
  const price = normalized.match(/(?:מחיר|₪|שח|ש"ח)\s*[:\-]?\s*(\d{4,7})|\b(\d{4,7})\s*(?:₪|שח|ש"ח)\b/i);
  if (price) result.price_ils = Number(price[1] || price[2]);
  const km = normalized.match(/(\d{1,3}(?:\s?\d{3}){1,2}|\d{4,7})\s*(?:ק"מ|קמ|קילומטר)/i);
  if (km) result.mileage_km = Number(km[1].replace(/\s/g, ""));
  const year = normalized.match(/\b(20\d{2}|19\d{2})\b/);
  if (year) result.year = Number(year[1]);
  const owners = normalized.match(/(?:יד|בעלים)\s*(?:מספר)?\s*[:\-]?\s*(\d{1,2})\b/i);
  if (owners) result.owners = Number(owners[1]);
  const fuel = ["היברידי נטען", "היברידי", "חשמלי", "דיזל", "בנזין", "גפ״מ"].find((value) => normalized.includes(value));
  if (fuel) result.fuel_type = fuel;
  const transmission = ["אוטומטית", "ידנית", "רובוטית", "רציפה"].find((value) => normalized.includes(value));
  if (transmission) result.transmission = transmission;
  const body = ["משפחתית", "קרוסאובר", "סופר מיני", "האצ׳בק", "סדאן", "סטיישן"].find((value) => normalized.includes(value));
  if (body) result.body_type = body;
  const lower = normalized.toLowerCase();
  const features = FEATURES.filter((feature) => feature.match.some((word) => lower.includes(word.toLowerCase()))).map((feature) => feature.key);
  if (features.length) result.features = features;
  return result;
}

function carFromForm(form) {
  const data = new FormData(form);
  const make = String(data.get("make") || "").trim();
  const model = String(data.get("model") || "").trim();
  const year = Number(data.get("year")) || null;
  const title = String(data.get("title") || "").trim() || [make, model, year].filter(Boolean).join(" ") || "רכב ללא שם";
  const optionalNumber = (name) => Number(data.get(name)) || null;
  return {
    title, make, model, year, price_ils: optionalNumber("price_ils"), mileage_km: optionalNumber("mileage_km"),
    owners: optionalNumber("owners"), city: String(data.get("city") || "").trim(), body_type: String(data.get("body_type") || ""),
    fuel_type: String(data.get("fuel_type") || ""), transmission: String(data.get("transmission") || ""),
    engine: String(data.get("engine") || "").trim(), trim: String(data.get("trim") || "").trim(),
    source_url: String(data.get("source_url") || state.draft.source_url || "").trim(),
    notes: String(data.get("notes") || "").trim(),
    reliability: Number(data.get("reliability")) || 3, economy: Number(data.get("economy")) || 3,
    safety: Number(data.get("safety")) || 3, performance: Number(data.get("performance")) || 3,
    maintenance: Number(data.get("maintenance")) || 3,
    features: data.getAll("features").map(String).filter((key) => FEATURE_LABEL[key]),
  };
}

async function saveCar(form) {
  const values = carFromForm(form);
  state.busy = true;
  render();
  try {
    if (state.cloud) {
      if (state.editId) {
        const { data, error } = await state.supabase.from("cars").update({ ...values, updated_at: new Date().toISOString() }).eq("id", state.editId).select("*").single();
        if (error) throw error;
        state.cars = state.cars.map((car) => car.id === state.editId ? defaultCarShape(data) : car);
      } else {
        const { data, error } = await state.supabase.from("cars").insert(values).select("*").single();
        if (error) throw error;
        state.cars.unshift(defaultCarShape(data));
      }
    } else if (state.editId) {
      state.cars = state.cars.map((car) => car.id === state.editId ? defaultCarShape({ ...car, ...values }) : car);
      saveLocal();
    } else {
      state.cars.unshift(defaultCarShape({ ...values, created_at: new Date().toISOString(), created_by: "local" }));
      saveLocal();
    }
    state.busy = false;
    state.modal = null;
    state.editId = null;
    showToast("הרכב נשמר במאגר");
    render();
  } catch (error) {
    state.busy = false;
    render();
    showToast(`לא הצלחנו לשמור: ${error.message || "נסו שוב"}`);
  }
}

async function saveProfile(form) {
  const data = new FormData(form);
  const next = {
    display_name: String(data.get("display_name") || "").trim(),
    budget_max: Number(data.get("budget_max")) || 0,
    year_min: Number(data.get("year_min")) || 0,
    mileage_max: Number(data.get("mileage_max")) || 0,
    owners_max: Number(data.get("owners_max")) || 1,
    body_type: data.getAll("body_type").join(","), fuel_type: data.getAll("fuel_type").join(","), transmission: data.getAll("transmission").join(","),
    weights: Object.fromEntries(["reliability", "economy", "safety", "maintenance", "performance"].map((key) => [key, Number(data.get(`weight_${key}`)) || 0])),
    excluded_terms: String(data.get("excluded_terms") || "").split(",").map((term) => term.trim()).filter(Boolean),
  };
  state.busy = true;
  try {
    if (state.cloud) {
      const { error } = await state.supabase.from("profiles").upsert({ id: state.user.id, ...toProfileRow(next), updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
    }
    state.profile = next;
    state.favMakes = new Set(data.getAll("fav_make"));
    if (!state.favMakes.size) state.onlyFavMakes = false;
    savePrefs();
    saveLocal();
    state.busy = false;
    render();
    showToast("הפרופיל האישי עודכן");
  } catch (error) {
    state.busy = false;
    render();
    showToast(`לא הצלחנו לעדכן את הפרופיל: ${error.message || "נסו שוב"}`);
  }
}

async function toggleFavorite(id) {
  const wasFavorite = state.favorites.has(id);
  try {
    if (state.cloud && state.favoritesMode === "cloud") {
      if (wasFavorite) {
        const { error } = await state.supabase.from("favorites").delete().eq("user_id", state.user.id).eq("car_id", id);
        if (error) throw error;
      } else {
        const { error } = await state.supabase.from("favorites").insert({ user_id: state.user.id, car_id: id });
        if (error) throw error;
      }
    }
    if (wasFavorite) { state.favorites.delete(id); delete state.priorities[id]; savePrefs(); } else state.favorites.add(id);
    saveLocal();
    render();
    showToast(wasFavorite ? "הוסר מהמועדפים" : "נשמר במועדפים");
  } catch (error) { showToast(`לא הצלחנו לעדכן מועדפים: ${error.message || "נסו שוב"}`); }
}

function openCarModal(car = null) {
  state.editId = car?.id || null;
  state.draft = car ? { ...car, features: [...car.features], tab: "manual" } : { tab: "link", features: [], reliability: 3, economy: 3, safety: 3, performance: 3, maintenance: 3 };
  state.modal = "add";
  render();
}

function exportData() {
  const payload = { app: "CarSift", version: 1, exportedAt: new Date().toISOString(), cars: state.cars, profile: state.profile, favorites: [...state.favorites], priorities: state.priorities, favMakes: [...state.favMakes] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `carsift-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("קובץ הגיבוי ירד למכשיר");
}

async function importPayload(payload) {
  if (!payload || !Array.isArray(payload.cars) || payload.app !== "CarSift") throw new Error("זה לא נראה כמו קובץ גיבוי של CarSift");
  const currentIds = new Set(state.cars.map((car) => car.id));
  const newCars = payload.cars.filter((car) => car && car.id && !currentIds.has(car.id)).map(defaultCarShape);
  if (state.cloud && newCars.length) {
    const rows = newCars.map(({ id, created_by, created_at, ...car }) => car);
    const { data, error } = await state.supabase.from("cars").insert(rows).select("*");
    if (error) throw error;
    state.cars = [...(data || []).map(defaultCarShape), ...state.cars];
  } else if (!state.cloud) {
    state.cars = [...newCars, ...state.cars];
  }
  if (payload.profile && typeof payload.profile === "object") {
    state.profile = { ...DEFAULT_PROFILE, ...payload.profile, weights: { ...DEFAULT_PROFILE.weights, ...(payload.profile.weights || {}) } };
    if (state.cloud) {
      const { error } = await state.supabase.from("profiles").upsert({ id: state.user.id, ...toProfileRow(state.profile) }, { onConflict: "id" });
      if (error) throw error;
    }
  }
  const importedIds = new Set(state.cars.map((car) => car.id));
  const favorites = new Set(payload.favorites || []);
  if (payload.priorities && typeof payload.priorities === "object") {
    for (const [id, value] of Object.entries(payload.priorities)) { const n = Math.round(Number(value)); if (importedIds.has(id) && n >= 1 && n <= 10) state.priorities[id] = n; }
  }
  if (Array.isArray(payload.favMakes)) payload.favMakes.filter((m) => typeof m === "string").forEach((m) => state.favMakes.add(m));
  savePrefs();
  state.favorites = new Set([...state.favorites, ...[...favorites].filter((id) => importedIds.has(id))]);
  if (state.cloud && state.favoritesMode === "cloud" && state.favorites.size) {
    const rows = [...favorites].filter((id) => importedIds.has(id)).map((car_id) => ({ user_id: state.user.id, car_id }));
    if (rows.length) {
      const { error } = await state.supabase.from("favorites").upsert(rows, { onConflict: "user_id,car_id", ignoreDuplicates: true });
      if (error) throw error;
    }
  }
  saveLocal();
  state.modal = null;
  state.importPreview = null;
  render();
  showToast(`יובאו ${newCars.length} רכבים חדשים`);
}

function applyExtractedText() {
  const extracted = parseListingText(state.draft.listing_text || "");
  if (!Object.keys(extracted).length) {
    showToast(state.draft.listing_text ? "לא זוהו פרטים ברורים. אפשר למלא את הטופס ידנית." : "הדבק את טקסט המודעה או העלה צילום מסך. אתרי מודעות רבים חוסמים קריאה ישירה.");
    return;
  }
  state.draft = { ...state.draft, ...extracted, features: [...new Set([...(state.draft.features || []), ...(extracted.features || [])])] };
  render();
  showToast(`זוהו ${Object.keys(extracted).length} פרטים — בדוק אותם לפני שמירה`);
}

async function runOcr(file) {
  if (!file) return;
  const status = document.querySelector("#ocr-status");
  if (status) status.textContent = "טוענים מנוע OCR בעברית…";
  try {
    const { createWorker } = await import(TESSERACT_JS);
    const worker = await createWorker("heb+eng", undefined, { logger: (message) => {
      const el = document.querySelector("#ocr-status");
      if (el && message.status) el.textContent = message.progress != null ? `${message.status} · ${Math.round(message.progress * 100)}%` : message.status;
    } });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    state.draft.listing_text = data.text || "";
    state.draft.ocrStatus = "הזיהוי הסתיים. בדוק את הטקסט, חלץ פרטים ותקן את הטופס.";
    Object.assign(state.draft, parseListingText(data.text || ""));
    render();
    showToast("הטקסט זוהה במכשיר שלך");
  } catch (error) {
    state.draft.ocrStatus = "לא הצלחנו לזהות את הטקסט. אפשר להקליד או להדביק אותו ידנית.";
    render();
    showToast(`OCR לא זמין כרגע: ${error.message || "בדוק את החיבור לאינטרנט"}`);
  }
}

async function signIn(form) {
  const email = String(new FormData(form).get("email") || "").trim();
  if (!email) return;
  state.busy = true;
  render();
  try {
    const { error } = await state.supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href.split("#")[0] } });
    if (error) throw error;
    state.busy = false;
    state.authMessage = "שלחנו קישור כניסה למייל. פתח אותו באותו מכשיר כדי להיכנס.";
    render();
  } catch (error) {
    state.busy = false;
    state.authMessage = `לא הצלחנו לשלוח קישור: ${error.message || "בדקו את כתובת המייל"}`;
    render();
  }
}

async function signOut() {
  if (!state.supabase) return;
  await state.supabase.auth.signOut();
  state.session = null;
  state.user = null;
  state.authRequired = true;
  state.authDenied = false;
  render();
}

// Partial refresh: keeps slider drag and search focus alive while results update.
function updateCarResults({ panel = false } = {}) {
  if (state.view !== "cars" && state.view !== "favorites") return;
  const results = document.querySelector("#results");
  if (!results) return render();
  results.innerHTML = renderResults();
  const total = number(visibleCars().length);
  document.querySelectorAll("[data-result-count]").forEach((node) => { node.textContent = total; });
  const opener = document.querySelector(".filter-open");
  if (opener) { const n = activeFilterCount(); opener.innerHTML = `${icon("menu", 17)} סינון${n ? ` <span class="nav-count">${n}</span>` : ""}`; }
  if (panel) {
    const scroll = document.querySelector(".filter-scroll")?.scrollTop || 0;
    document.querySelector("#filter-panel").innerHTML = renderFilterPanel();
    const node = document.querySelector(".filter-scroll");
    if (node) node.scrollTop = scroll;
  }
}

function toggleInList(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function updatePriceRange(changed) {
  const b = dataBounds();
  const minInput = document.querySelector("#f-price-min");
  const maxInput = document.querySelector("#f-price-max");
  let lo = Number(minInput.value);
  let hi = Number(maxInput.value);
  if (lo > hi) { if (changed === "min") { lo = hi; minInput.value = lo; } else { hi = lo; maxInput.value = hi; } }
  state.filters.priceMin = lo <= b.priceMin ? null : lo;
  state.filters.priceMax = hi >= b.priceMax ? null : hi;
  const span = Math.max(1, b.priceMax - b.priceMin);
  const wrap = minInput.closest(".dual-range");
  wrap.style.setProperty("--lo", `${((lo - b.priceMin) / span) * 100}%`);
  wrap.style.setProperty("--hi", `${((hi - b.priceMin) / span) * 100}%`);
  document.querySelector("#price-lo-label").textContent = money(lo);
  document.querySelector("#price-hi-label").textContent = money(hi);
  updateCarResults();
}

app.addEventListener("click", async (event) => {
  const siteSearch = event.target.closest("[data-site-search]");
  if (siteSearch) { openSiteSearch(siteSearch.dataset.siteSearch); return; }
  const favMake = event.target.closest("[data-fav-make]");
  if (favMake) {
    const make = favMake.dataset.favMake;
    if (state.favMakes.has(make)) state.favMakes.delete(make); else state.favMakes.add(make);
    if (!state.favMakes.size) state.onlyFavMakes = false;
    savePrefs();
    render();
    return;
  }
  if (event.target.closest("[data-only-fav-makes]")) { state.onlyFavMakes = !state.onlyFavMakes; render(); return; }
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    if (viewButton.disabled) return;
    state.view = viewButton.dataset.view;
    if (state.view === "favorites" && state.sort === "score") state.sort = "priority";
    else if (state.view !== "favorites" && state.sort === "priority") state.sort = "score";
    state.drawerOpen = false;
    state.filtersOpen = false;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const filterToggle = event.target.closest("[data-filter-toggle]");
  if (filterToggle) {
    const { filterToggle: group, value } = filterToggle.dataset;
    state.filters[group] = toggleInList(state.filters[group], value);
    if (group === "makes") state.filters.models = state.filters.models.filter((key) => !state.filters.makes.length || state.filters.makes.includes(key.split("|")[0]));
    updateCarResults({ panel: true });
    return;
  }
  const handButton = event.target.closest("[data-hand]");
  if (handButton) {
    state.filters.handMax = Number(handButton.dataset.hand) || null;
    updateCarResults({ panel: true });
    return;
  }
  const favMode = event.target.closest("[data-fav-mode]");
  if (favMode) { await setFavoritesMode(favMode.dataset.favMode); return; }
  const tabButton = event.target.closest("[data-add-tab]");
  if (tabButton) {
    state.draft.tab = tabButton.dataset.addTab;
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "open-add") openCarModal();
  if (action === "close-modal" || (action === "backdrop" && event.target === button)) { state.modal = null; state.editId = null; state.importPreview = null; render(); }
  if (action === "favorite") { event.stopPropagation(); await toggleFavorite(id); return; }
  if (action === "compare-toggle") {
    if (state.compareIds.has(id)) state.compareIds.delete(id);
    else if (state.compareIds.size >= 3) { showToast("אפשר להשוות עד שלושה רכבים יחד — הסירו רכב מהמגירה"); state.drawerOpen = true; }
    else state.compareIds.add(id);
    if (!state.compareIds.size) state.drawerOpen = false;
    render();
  }
  if (action === "toggle-drawer") { state.drawerOpen = !state.drawerOpen; render(); }
  if (action === "clear-compare") { state.compareIds.clear(); state.drawerOpen = false; render(); }
  if (action === "toggle-filters") { state.filtersOpen = !state.filtersOpen; render(); }
  if (action === "clear-filters") { state.filters = EMPTY_FILTERS(); state.search = ""; render(); }
  if (action === "remove-filter") {
    const { group, value } = button.dataset;
    if (Array.isArray(state.filters[group])) state.filters[group] = state.filters[group].filter((item) => item !== value);
    else if (group === "price") { state.filters.priceMin = null; state.filters.priceMax = null; }
    else state.filters[group] = null;
    if (group === "makes") state.filters.models = state.filters.models.filter((key) => key.split("|")[0] !== value);
    updateCarResults({ panel: true });
  }
  if (action === "details") { state.modal = "details"; state.draft = { id }; state.drawerOpen = false; render(); }
  if (action === "edit-car") { const car = state.cars.find((item) => item.id === id); if (car) openCarModal(car); }
  if (action === "delete-car") {
    const car = state.cars.find((item) => item.id === id);
    if (!car || !window.confirm(`למחוק את ${car.title} מהמאגר המשותף?`)) return;
    try {
      if (state.cloud) {
        const { error } = await state.supabase.from("cars").delete().eq("id", id);
        if (error) throw error;
      }
      state.cars = state.cars.filter((item) => item.id !== id);
      state.favorites.delete(id);
      state.compareIds.delete(id);
      state.modal = null;
      saveLocal();
      render();
      showToast("הרכב הוסר מהמאגר");
    } catch (error) { showToast(`לא הצלחנו למחוק: ${error.message || "נסו שוב"}`); }
  }
  if (action === "export") exportData();
  if (action === "import-file") {
    state.modal = "import";
    state.importPreview = null;
    render();
    document.querySelector("#json-file-modal")?.click();
  }
  if (action === "confirm-import" && state.importPreview) {
    try { await importPayload(state.importPreview); }
    catch (error) { showToast(`הייבוא נכשל: ${error.message || "בדוק את הקובץ"}`); }
  }
  if (action === "extract-text") applyExtractedText();
  if (action === "signout") await signOut();
  if (action === "mobile-menu") document.querySelector(".app-shell")?.classList.toggle("menu-open");
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.modal) { state.modal = null; state.editId = null; state.importPreview = null; render(); }
  else if (state.filtersOpen) { state.filtersOpen = false; render(); }
  else if (state.drawerOpen) { state.drawerOpen = false; render(); }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("#car-search")) { state.search = target.value; updateCarResults(); }
  if (target.matches("[data-draft]")) state.draft[target.dataset.draft] = target.value;
  else if (target.closest("#car-form") && target.name && target.name !== "features") state.draft[target.name] = target.value;
  if (target.matches("#f-price-min")) updatePriceRange("min");
  if (target.matches("#f-price-max")) updatePriceRange("max");
  if (target.matches("#f-mileage")) {
    const max = Number(target.max);
    const value = Number(target.value);
    state.filters.mileageMax = value >= max ? null : value;
    target.style.setProperty("--fill", `${(value / max) * 100}%`);
    document.querySelector("#km-label").textContent = value >= max ? "ללא הגבלה" : `עד ${km(value)}`;
    updateCarResults();
  }
  if (target.matches("[data-weight]")) {
    const label = document.querySelector(`[data-weight-label="${target.dataset.weight}"]`);
    if (label) label.textContent = `${target.value}/10`;
  }
});

app.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.matches("[data-prio]")) {
    const value = Number(target.value);
    if (value >= 1 && value <= 10) state.priorities[target.dataset.id] = value; else delete state.priorities[target.dataset.id];
    savePrefs();
    render();
    return;
  }
  if (target.matches("#car-sort")) { state.sort = target.value; updateCarResults(); }
  if (target.matches("#f-year")) { state.filters.yearMin = Number(target.value) || null; updateCarResults(); }
  if (target.matches("[data-feature-filter]")) { state.filters.features = toggleInList(state.filters.features, target.dataset.featureFilter); updateCarResults({ panel: true }); }
  if (target.closest("#car-form") && target.name === "features") state.draft.features = [...document.querySelectorAll('#car-form input[name="features"]:checked')].map((input) => input.value);
  if (target.matches("#car-image")) await runOcr(target.files?.[0]);
  if (target.matches("#json-file, #json-file-modal")) {
    const file = target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== "CarSift" || !Array.isArray(data.cars)) throw new Error("מבנה קובץ לא מוכר");
      state.modal = "import";
      state.importPreview = data;
      render();
    } catch (error) { showToast(`לא ניתן לקרוא את הקובץ: ${error.message || "בדוק שהקובץ תקין"}`); }
  }
});

app.addEventListener("submit", async (event) => {
  const form = event.target;
  if (form.id === "car-form") { event.preventDefault(); await saveCar(form); }
  if (form.id === "profile-form") { event.preventDefault(); await saveProfile(form); }
  if (form.id === "auth-form") { event.preventDefault(); await signIn(form); }
});

initialize();
