const CONFIG = window.CARSIFT_CONFIG || {};
const LOCAL_KEY = "carsift-local-v1";
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

const SAMPLE_CARS = [
  { id: "demo-1", title: "Toyota Corolla Hybrid", make: "Toyota", model: "Corolla", year: 2022, price_ils: 112000, mileage_km: 54000, owners: 1, body_type: "משפחתית", fuel_type: "היברידי", transmission: "אוטומטית", engine: "1.8", trim: "Sun", city: "תל אביב", source_url: "", notes: "רכב הדגמה — יש לאמת את הפרטים מול המודעה.", reliability: 5, economy: 5, safety: 4, performance: 3, maintenance: 4, created_by: "local", created_at: new Date().toISOString() },
  { id: "demo-2", title: "Kia Niro Hybrid", make: "Kia", model: "Niro", year: 2021, price_ils: 105000, mileage_km: 68000, owners: 2, body_type: "קרוסאובר", fuel_type: "היברידי", transmission: "אוטומטית", engine: "1.6", trim: "EX", city: "חיפה", source_url: "", notes: "רכב הדגמה — יש לאמת את הפרטים מול המודעה.", reliability: 4, economy: 5, safety: 4, performance: 3, maintenance: 4, created_by: "local", created_at: new Date().toISOString() },
  { id: "demo-3", title: "Mazda 3 Comfort", make: "Mazda", model: "3", year: 2020, price_ils: 89000, mileage_km: 76000, owners: 2, body_type: "משפחתית", fuel_type: "בנזין", transmission: "אוטומטית", engine: "2.0", trim: "Comfort", city: "ירושלים", source_url: "", notes: "רכב הדגמה — יש לאמת את הפרטים מול המודעה.", reliability: 4, economy: 3, safety: 4, performance: 4, maintenance: 3, created_by: "local", created_at: new Date().toISOString() },
];

const state = {
  view: "cars",
  cars: [],
  profile: { ...DEFAULT_PROFILE, weights: { ...DEFAULT_PROFILE.weights } },
  favorites: new Set(),
  compareIds: new Set(),
  filter: "all",
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
    created_by: car.created_by || "local", created_at: car.created_at || new Date().toISOString(),
  };
}

function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    if (saved) {
      state.cars = (saved.cars || []).map(defaultCarShape);
      state.profile = { ...DEFAULT_PROFILE, ...(saved.profile || {}), weights: { ...DEFAULT_PROFILE.weights, ...(saved.profile?.weights || {}) } };
      state.favorites = new Set(saved.favorites || []);
      return;
    }
  } catch { /* Ignore invalid browser storage and start a clean demo. */ }
  state.cars = SAMPLE_CARS.map(defaultCarShape);
  state.favorites = new Set(["demo-1"]);
  saveLocal();
}

function saveLocal() {
  if (state.cloud) return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ cars: state.cars, profile: state.profile, favorites: [...state.favorites] }));
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
      state.supabase.from("favorites").select("car_id").eq("user_id", state.user.id),
    ]);
    if (carsResult.error) throw carsResult.error;
    if (profileResult.error) throw profileResult.error;
    if (favoritesResult.error) throw favoritesResult.error;
    state.cars = (carsResult.data || []).map(defaultCarShape);
    state.favorites = new Set((favoritesResult.data || []).map((item) => item.car_id));
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
  if (profile.body_type && car.body_type && car.body_type !== profile.body_type) constraints -= 12;
  if (profile.fuel_type && car.fuel_type && car.fuel_type !== profile.fuel_type) constraints -= 10;
  if (profile.transmission && car.transmission && car.transmission !== profile.transmission) constraints -= 10;
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
  const identity = state.cloud ? (state.user?.email || "החשבון שלי") : "מצב הדגמה";
  return `<div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#" data-view="cars"><span class="brand-mark">C</span><span class="brand-copy"><b>CarSift</b><small>החלטה טובה מתחילה כאן</small></span></a>
      <div class="workspace-label">המרחב שלי</div>
      <nav class="side-nav">${navButton("cars", "מאגר הרכבים", "cars")}${navButton("compare", "השוואה", "compare", compareCount)}${navButton("favorites", "מועדפים", "heart", favCount)}${navButton("profile", "פרופיל חיפוש", "profile")}</nav>
      <div class="sidebar-spacer"></div>
      <div class="sidebar-tip"><span class="tip-icon">${icon("bolt", 17)}</span><div><b>בחירה חכמה</b><p>ציון ההתאמה מתעדכן לפי הדרישות האישיות שלך.</p><button data-view="profile">עדכון הדרישות ${icon("arrow", 14)}</button></div></div>
      <div class="account-card"><span class="avatar">${html((state.profile.display_name || identity).slice(0, 1).toUpperCase())}</span><span class="account-copy"><b>${html(state.profile.display_name || identity)}</b><small>${state.cloud ? "חשבון מחובר" : "הנתונים נשמרים בדפדפן"}</small></span>${state.cloud ? `<button class="icon-button account-action" title="יציאה" data-action="signout">↪</button>` : ""}</div>
    </aside>
    <div class="main-column">
      <header class="topbar"><button class="mobile-menu icon-button" aria-label="תפריט" data-action="mobile-menu">${icon("menu")}</button><div class="breadcrumb"><span>CarSift</span><span class="crumb-dot">/</span><b>${state.view === "cars" ? "מאגר הרכבים" : state.view === "compare" ? "השוואה" : state.view === "favorites" ? "המועדפים שלי" : "פרופיל חיפוש"}</b></div><div class="top-actions"><span class="connection-pill ${state.cloud ? "connected" : "local"}"><i></i>${state.cloud ? "מסד משותף" : "הדגמה מקומית"}</span><button class="top-icon" title="ייבוא JSON" data-action="import-file">${icon("upload", 18)}</button><button class="top-icon" title="ייצוא JSON" data-action="export">${icon("download", 18)}</button><button class="avatar top-avatar" data-view="profile">${html((state.profile.display_name || identity).slice(0, 1).toUpperCase())}</button></div></header>
      <main class="workspace-content">${state.loading ? `<div class="loading-panel"><span class="spinner"></span><span>טוענים את המאגר שלך…</span></div>` : renderView()}</main>
    </div>
    <nav class="mobile-nav">${navButton("cars", "רכבים", "cars")}${navButton("compare", "השוואה", "compare", compareCount)}${navButton("favorites", "מועדפים", "heart", favCount)}${navButton("profile", "פרופיל", "profile")}</nav>
    <input id="json-file" type="file" accept="application/json,.json" hidden />
    <div class="toast" role="status"></div>
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

function renderCars(favoritesOnly = false) {
  let list = state.cars.filter((car) => !favoritesOnly || state.favorites.has(car.id));
  if (state.filter === "favorites" && !favoritesOnly) list = list.filter((car) => state.favorites.has(car.id));
  if (state.filter === "high") list = list.filter((car) => scoreCar(car) >= 82);
  if (state.search.trim()) {
    const query = state.search.trim().toLowerCase();
    list = list.filter((car) => `${car.title} ${car.make} ${car.model} ${car.year || ""} ${car.city} ${car.body_type}`.toLowerCase().includes(query));
  }
  const title = favoritesOnly ? "המועדפים שלי" : "מאגר הרכבים";
  const sub = favoritesOnly ? "הרכבים ששמרת לבדיקה נוספת." : "כל האפשרויות, במקום אחד. הציון מותאם לדרישות האישיות שלך.";
  const avg = state.cars.length ? Math.round(state.cars.reduce((sum, car) => sum + scoreCar(car), 0) / state.cars.length) : 0;
  const underBudget = state.cars.filter((car) => !car.price_ils || car.price_ils <= state.profile.budget_max).length;
  return `<section class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> החיפוש שלך, מפוקס יותר</div><h1>${title}</h1><p>${sub}</p></div><button class="primary-button" data-action="open-add">${icon("plus", 18)} הוספת רכב</button></section>
    ${!favoritesOnly ? `<section class="summary-grid"><article class="summary-card"><div class="summary-icon violet">${icon("cars")}</div><div><span>רכבים במאגר</span><strong>${number(state.cars.length)}</strong></div><span class="summary-foot">${state.cloud ? "משותף למשתמשים שאושרו" : "נשמר בדפדפן הזה"}</span></article><article class="summary-card"><div class="summary-icon green">${icon("bolt")}</div><div><span>ממוצע התאמה</span><strong>${avg}<small>/100</small></strong></div><span class="summary-foot">לפי הפרופיל שלך</span></article><article class="summary-card"><div class="summary-icon amber">${icon("check")}</div><div><span>בתוך התקציב</span><strong>${number(underBudget)}</strong></div><span class="summary-foot">מתוך ${number(state.cars.length)} רכבים</span></article><article class="summary-card"><div class="summary-icon rose">${icon("heart")}</div><div><span>מועדפים</span><strong>${number(state.favorites.size)}</strong></div><span class="summary-foot">נשמרים בפרופיל האישי</span></article></section>` : ""}
    <section class="listing-toolbar"><div class="toolbar-title"><div><h2>${favoritesOnly ? "הרכבים ששמרת" : "כל הרכבים"}</h2><span>${number(list.length)} תוצאות</span></div><div class="toolbar-controls"><label class="search-box">${icon("search", 18)}<input id="car-search" type="search" placeholder="חיפוש דגם, שנה או עיר…" value="${html(state.search)}" autocomplete="off" /></label><select class="sort-select" id="car-filter" aria-label="סינון רכבים"><option value="all" ${state.filter === "all" ? "selected" : ""}>כל ההתאמות</option><option value="high" ${state.filter === "high" ? "selected" : ""}>התאמה גבוהה</option><option value="favorites" ${state.filter === "favorites" ? "selected" : ""}>מועדפים</option></select></div></div>
      ${state.compareIds.size ? `<div class="compare-banner"><span>${icon("compare", 17)} נבחרו ${state.compareIds.size} רכבים להשוואה</span><button data-view="compare">מעבר להשוואה ${icon("arrow", 15)}</button></div>` : ""}
      ${list.length ? `<div class="car-grid">${list.map(renderCarCard).join("")}</div>` : `<div class="empty-state"><span class="empty-icon">${icon(favoritesOnly ? "heart" : "cars", 27)}</span><h3>${favoritesOnly ? "עוד לא שמרת מועדפים" : state.cars.length ? "לא מצאנו התאמות לחיפוש הזה" : "המאגר שלך מתחיל כאן"}</h3><p>${favoritesOnly ? "לחץ על הלב בכרטיס רכב כדי לשמור אותו כאן." : state.cars.length ? "נסה לשנות את החיפוש או את הסינון." : "הוסף מודעה, צילום מסך או פרטים ידנית — ונחשב התאמה לפי הפרופיל שלך."}</p>${!state.cars.length ? `<button class="primary-button" data-action="open-add">${icon("plus", 17)} הוספת הרכב הראשון</button>` : ""}</div>`}
    </section>`;
}

function renderCarCard(car) {
  const score = scoreCar(car);
  const [label, tone] = scoreLabel(score);
  const selected = state.compareIds.has(car.id);
  const initials = html((car.make || car.title || "CS").slice(0, 2));
  return `<article class="car-card"><div class="car-art art-${Math.abs(String(car.id).split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4}"><div class="art-noise"></div><span class="car-class">${html(car.body_type || "רכב משומש")}</span><button class="favorite-button ${state.favorites.has(car.id) ? "favorited" : ""}" aria-label="${state.favorites.has(car.id) ? "הסרה ממועדפים" : "הוספה למועדפים"}" data-action="favorite" data-id="${html(car.id)}">${icon("heart", 19)}</button><div class="car-illustration"><span>${initials}</span></div><div class="art-bottom"><span>${html(car.year || "שנתון לא צוין")}</span><span>${html(car.city || "מיקום לא צוין")}</span></div></div>
    <div class="car-card-body"><div class="car-title-row"><div><h3>${html(car.title)}</h3><p>${html([car.trim, car.engine && `${car.engine} ל׳`].filter(Boolean).join(" · ") || car.make || "פרטים נוספים במודעה")}</p></div><div class="score-ring ${tone}" style="--score:${score}"><strong>${score}</strong><small>התאמה</small></div></div>
      <div class="car-facts"><div><span>מחיר</span><b>${money(car.price_ils)}</b></div><div><span>קילומטראז׳</span><b>${car.mileage_km ? `${number(car.mileage_km)} ק״מ` : "—"}</b></div><div><span>יד</span><b>${car.owners ? `${number(car.owners)}׳` : "—"}</b></div></div>
      <div class="car-tags"><span>${html(car.fuel_type || "סוג דלק לא צוין")}</span><span>${html(car.transmission || "גיר לא צוין")}</span><span>${html(label)}</span></div>
      <div class="car-card-actions"><button class="text-button" data-action="details" data-id="${html(car.id)}">פרטים מלאים ${icon("arrow", 14)}</button><button class="compare-toggle ${selected ? "selected" : ""}" data-action="compare-toggle" data-id="${html(car.id)}">${selected ? icon("check", 15) : icon("compare", 15)} ${selected ? "נבחר" : "השוואה"}</button></div>
    </div></article>`;
}

function renderCompare() {
  const cars = [...state.compareIds].map((id) => state.cars.find((car) => car.id === id)).filter(Boolean);
  return `<section class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> החלטה שמבוססת על הנתונים</div><h1>משווים ומחליטים</h1><p>כל רכב מקבל ציון אישי לפי התקציב והעדיפויות שלך.</p></div><button class="secondary-button" data-view="cars">${icon("cars", 17)} חזרה למאגר</button></section>
    ${cars.length < 2 ? `<div class="empty-state compare-empty"><span class="empty-icon">${icon("compare", 27)}</span><h3>${cars.length ? "צריך עוד רכב אחד להשוואה" : "בחר לפחות שני רכבים"}</h3><p>חזור למאגר ולחץ על כפתור ההשוואה בכרטיסים. אפשר להשוות עד שלושה רכבים יחד.</p><button class="primary-button" data-view="cars">בחירת רכבים ${icon("arrow", 15)}</button></div>` : `<section class="comparison-wrap"><div class="comparison-header"><div class="comparison-label">${icon("shield", 18)} השוואה לפי הפרופיל שלך</div><span>אפשר לבחור עד 3 רכבים</span></div><div class="comparison-table" style="--compare-columns:${cars.length}"><div class="compare-label-column"><div class="compare-label-title">נתון להשוואה</div>${["ציון התאמה", "מחיר", "שנתון", "קילומטראז׳", "מספר ידיים", "סוג רכב", "הנעה", "תיבת הילוכים", "נפח מנוע", "עיר", "אמינות", "צריכת דלק", "בטיחות", "אחזקה", "ביצועים"].map((label) => `<div class="compare-row-label">${label}</div>`).join("")}</div>${cars.map((car) => `<div class="compare-car-column"><div class="compare-car-head"><button class="remove-compare" title="הסרה מההשוואה" data-action="compare-toggle" data-id="${html(car.id)}">${icon("close", 15)}</button><div class="compare-car-art">${html((car.make || "CS").slice(0, 2))}</div><h3>${html(car.title)}</h3><p>${html(car.trim || car.make || "")}</p><span class="compare-score ${scoreLabel(scoreCar(car))[1]}">${scoreCar(car)}<small>/100</small></span></div><div class="compare-value highlight">${scoreLabel(scoreCar(car))[0]}</div><div class="compare-value price-value">${money(car.price_ils)}</div><div class="compare-value">${html(car.year || "—")}</div><div class="compare-value">${car.mileage_km ? `${number(car.mileage_km)} ק״מ` : "—"}</div><div class="compare-value">${car.owners ? `${number(car.owners)}׳` : "—"}</div><div class="compare-value">${html(car.body_type || "—")}</div><div class="compare-value">${html(car.fuel_type || "—")}</div><div class="compare-value">${html(car.transmission || "—")}</div><div class="compare-value">${html(car.engine ? `${car.engine} ל׳` : "—")}</div><div class="compare-value">${html(car.city || "—")}</div>${["reliability", "economy", "safety", "maintenance", "performance"].map((key) => `<div class="compare-value"><span class="rating-dots">${Array.from({ length: 5 }, (_, i) => `<i class="${i < Number(car[key] || 3) ? "on" : ""}"></i>`).join("")}</span></div>`).join("")}</div>`).join("")}</div><div class="comparison-note">${icon("bolt", 16)} ציוני הרכב הם הערכות ראשוניות. כדאי לאמת מצב מכני, היסטוריית טיפולים ותאונות לפני קנייה.</div></section>`}`;
}

function selectOptions(values, selected = "", placeholder = "לא משנה") {
  return `<option value="">${placeholder}</option>${values.map((value) => `<option value="${html(value)}" ${selected === value ? "selected" : ""}>${html(value)}</option>`).join("")}`;
}

function renderProfile() {
  const p = state.profile;
  const weights = p.weights || DEFAULT_PROFILE.weights;
  const slider = (key, label, value) => `<label class="weight-control"><span><b>${label}</b><strong data-weight-label="${key}">${value}/10</strong></span><input type="range" name="weight_${key}" min="0" max="10" value="${html(value)}" data-weight="${key}" /></label>`;
  return `<section class="page-head"><div><div class="eyebrow"><span class="eyebrow-line"></span> הגדרות אישיות</div><h1>מה חשוב לך ברכב?</h1><p>הדרישות נשמרות בנפרד לכל משתמש ומשפיעות על ציוני ההתאמה.</p></div><span class="private-badge">${icon("shield", 15)} אישי ופרטי</span></section>
    <form id="profile-form" class="profile-layout"><div class="profile-main"><section class="form-panel"><div class="panel-heading"><span class="panel-number">01</span><div><h2>דרישות בסיס</h2><p>סינון ההעדפות העיקריות שלך</p></div></div><div class="form-grid two"><label class="field"><span>שם להצגה</span><input name="display_name" value="${html(p.display_name)}" placeholder="איך לפנות אליך?" maxlength="50" /></label><label class="field"><span>תקציב מקסימלי</span><div class="input-with-suffix"><input name="budget_max" type="number" min="0" step="1000" value="${html(p.budget_max)}" /><em>₪</em></div></label><label class="field"><span>שנתון מינימלי</span><input name="year_min" type="number" min="1980" max="2100" value="${html(p.year_min)}" /></label><label class="field"><span>קילומטראז׳ מקסימלי</span><div class="input-with-suffix"><input name="mileage_max" type="number" min="0" step="5000" value="${html(p.mileage_max)}" /><em>ק״מ</em></div></label><label class="field"><span>מספר בעלים מקסימלי</span><select name="owners_max">${selectOptions(["1", "2", "3", "4", "5"], String(p.owners_max))}</select></label><label class="field"><span>סוג רכב מועדף</span><select name="body_type">${selectOptions(["משפחתית", "סופר מיני", "קרוסאובר", "רכב פנאי", "האצ׳בק", "סדאן", "סטיישן", "קופה", "מסחרי"], p.body_type)}</select></label><label class="field"><span>סוג הנעה מועדף</span><select name="fuel_type">${selectOptions(["בנזין", "דיזל", "היברידי", "היברידי נטען", "חשמלי", "גפ״מ"], p.fuel_type)}</select></label><label class="field"><span>תיבת הילוכים מועדפת</span><select name="transmission">${selectOptions(["אוטומטית", "ידנית", "רובוטית", "רציפה"], p.transmission)}</select></label></div></section>
      <section class="form-panel"><div class="panel-heading"><span class="panel-number">02</span><div><h2>מה מקבל יותר משקל?</h2><p>הזז את הסרגלים כדי להתאים את חישוב הציון</p></div></div><div class="weights-grid">${slider("reliability", "אמינות", weights.reliability)}${slider("economy", "צריכת דלק", weights.economy)}${slider("safety", "בטיחות", weights.safety)}${slider("maintenance", "עלויות אחזקה", weights.maintenance)}${slider("performance", "ביצועים", weights.performance)}</div></section>
      <section class="form-panel"><div class="panel-heading"><span class="panel-number">03</span><div><h2>דגמים ופרטים לפסילה</h2><p>הוסף מילות מפתח שלא תרצה לראות בציון גבוה</p></div></div><label class="field"><span>מילים או דגמים, מופרדים בפסיק</span><input name="excluded_terms" value="${html((p.excluded_terms || []).join(", "))}" placeholder="לדוגמה: מנוע 1.2, דגם מסוים" /></label><div class="form-hint">רכב שתואם למילה מהרשימה יקבל הפחתה בציון. אפשר לערוך את הפרופיל בכל עת.</div></section>
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
    <form id="car-form" class="car-form"><div class="review-header"><span class="review-step">אישור לפני שמירה</span><span>אפשר לתקן כל שדה</span></div><div class="form-grid two">${addField("יצרן", "make", draft.make || "", "text", "למשל Toyota")}${addField("דגם", "model", draft.model || "", "text", "למשל Corolla")}${addField("כותרת להצגה", "title", draft.title || "", "text", "נוצר אוטומטית מהיצרן והדגם")}<label class="field"><span>שנתון</span><input name="year" type="number" min="1950" max="2100" value="${html(draft.year || "")}" placeholder="2021" /></label><label class="field"><span>מחיר</span><div class="input-with-suffix"><input name="price_ils" type="number" min="0" step="1000" value="${html(draft.price_ils || "")}" placeholder="95000" /><em>₪</em></div></label><label class="field"><span>קילומטראז׳</span><div class="input-with-suffix"><input name="mileage_km" type="number" min="0" step="1000" value="${html(draft.mileage_km || "")}" placeholder="65000" /><em>ק״מ</em></div></label><label class="field"><span>מספר ידיים</span><input name="owners" type="number" min="1" max="20" value="${html(draft.owners || "")}" placeholder="2" /></label><label class="field"><span>עיר</span><input name="city" value="${html(draft.city || "")}" placeholder="תל אביב" /></label><label class="field"><span>סוג רכב</span><select name="body_type">${selectOptions(["משפחתית", "סופר מיני", "קרוסאובר", "רכב פנאי", "האצ׳בק", "סדאן", "סטיישן", "קופה", "מסחרי"], draft.body_type)}</select></label><label class="field"><span>סוג הנעה</span><select name="fuel_type">${selectOptions(["בנזין", "דיזל", "היברידי", "היברידי נטען", "חשמלי", "גפ״מ"], draft.fuel_type)}</select></label><label class="field"><span>תיבת הילוכים</span><select name="transmission">${selectOptions(["אוטומטית", "ידנית", "רובוטית", "רציפה"], draft.transmission)}</select></label>${addField("נפח מנוע", "engine", draft.engine || "", "text", "למשל 1.6")}${addField("רמת גימור", "trim", draft.trim || "", "text", "")}</div><div class="rating-heading"><b>הערכת רכב ראשונית</b><span>משפיעה על ציון ההתאמה</span></div><div class="form-grid five">${ratingField("reliability", "אמינות")}${ratingField("economy", "חיסכון")}${ratingField("safety", "בטיחות")}${ratingField("maintenance", "אחזקה")}${ratingField("performance", "ביצועים")}</div><label class="field notes-field"><span>הערות</span><textarea name="notes" rows="2" placeholder="הערות, מצב הרכב או נקודות לבדיקה…">${html(draft.notes || "")}</textarea></label><div class="form-footer modal-footer"><button type="button" class="text-button" data-action="close-modal">ביטול</button><button class="primary-button" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "שומר…" : editing ? "שמירת עדכון" : "אישור ושמירת הרכב"} ${icon("check", 16)}</button></div></form>
  </section></div>`;
}

function renderDetailsModal() {
  const car = state.cars.find((item) => item.id === state.draft.id);
  if (!car) return "";
  const canEdit = !state.cloud || car.created_by === state.user?.id;
  const score = scoreCar(car);
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal detail-modal" role="dialog" aria-modal="true"><button class="modal-close icon-button" aria-label="סגירה" data-action="close-modal">${icon("close")}</button><div class="detail-art">${html((car.make || "CS").slice(0, 2))}</div><div class="detail-top"><div><span class="modal-kicker">${html(car.year || "רכב משומש")} ${html(car.body_type || "")}</span><h2>${html(car.title)}</h2><p>${html([car.trim, car.engine && `${car.engine} ל׳`, car.city].filter(Boolean).join(" · "))}</p></div><div class="detail-score ${scoreLabel(score)[1]}">${score}<small>/100 התאמה</small></div></div><div class="detail-facts">${[["מחיר", money(car.price_ils)], ["קילומטראז׳", car.mileage_km ? `${number(car.mileage_km)} ק״מ` : "—"], ["יד", car.owners ? `${number(car.owners)}׳` : "—"], ["הנעה", car.fuel_type || "—"], ["גיר", car.transmission || "—"], ["עיר", car.city || "—"]].map(([a,b]) => `<div><span>${a}</span><b>${html(b)}</b></div>`).join("")}</div>${car.notes ? `<div class="detail-notes"><b>הערות</b><p>${html(car.notes)}</p></div>` : ""}${car.source_url ? `<a class="source-link" href="${html(car.source_url)}" target="_blank" rel="noopener noreferrer">${icon("link", 16)} פתיחת המודעה המקורית ${icon("arrow", 14)}</a>` : ""}<div class="form-footer modal-footer"><button class="compare-toggle ${state.compareIds.has(car.id) ? "selected" : ""}" data-action="compare-toggle" data-id="${html(car.id)}">${icon("compare", 15)} ${state.compareIds.has(car.id) ? "הסר מהשוואה" : "השוואה"}</button><div class="detail-actions">${canEdit ? `<button class="icon-button danger-button" title="מחיקת רכב" data-action="delete-car" data-id="${html(car.id)}">${icon("trash", 17)}</button><button class="secondary-button" data-action="edit-car" data-id="${html(car.id)}">${icon("edit", 16)} עריכה</button>` : ""}<button class="primary-button" data-action="close-modal">סיום</button></div></div></section></div>`;
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
  app.innerHTML = renderShell();
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
    body_type: String(data.get("body_type") || ""), fuel_type: String(data.get("fuel_type") || ""), transmission: String(data.get("transmission") || ""),
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
    if (state.cloud) {
      if (wasFavorite) {
        const { error } = await state.supabase.from("favorites").delete().eq("user_id", state.user.id).eq("car_id", id);
        if (error) throw error;
      } else {
        const { error } = await state.supabase.from("favorites").insert({ user_id: state.user.id, car_id: id });
        if (error) throw error;
      }
    }
    if (wasFavorite) state.favorites.delete(id); else state.favorites.add(id);
    saveLocal();
    render();
  } catch (error) { showToast(`לא הצלחנו לעדכן מועדפים: ${error.message || "נסו שוב"}`); }
}

function openCarModal(car = null) {
  state.editId = car?.id || null;
  state.draft = car ? { ...car, tab: "manual" } : { tab: "link", reliability: 3, economy: 3, safety: 3, performance: 3, maintenance: 3 };
  state.modal = "add";
  render();
}

function exportData() {
  const payload = { app: "CarSift", version: 1, exportedAt: new Date().toISOString(), cars: state.cars, profile: state.profile, favorites: [...state.favorites] };
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
  state.favorites = new Set([...state.favorites, ...[...favorites].filter((id) => importedIds.has(id))]);
  if (state.cloud && state.favorites.size) {
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
  state.draft = { ...state.draft, ...extracted };
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

function updateCarResults() {
  if (state.view !== "cars" && state.view !== "favorites") return;
  const workspace = document.querySelector(".workspace-content");
  if (!workspace) return;
  workspace.innerHTML = renderView();
  const input = document.querySelector("#car-search");
  if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}

app.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    state.view = viewButton.dataset.view;
    state.filter = "all";
    render();
    return;
  }
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
  if (action === "favorite") await toggleFavorite(id);
  if (action === "compare-toggle") {
    if (state.compareIds.has(id)) state.compareIds.delete(id);
    else if (state.compareIds.size >= 3) showToast("אפשר להשוות עד שלושה רכבים יחד");
    else state.compareIds.add(id);
    render();
  }
  if (action === "details") { state.modal = "details"; state.draft = { id }; render(); }
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
  if (action === "mobile-menu") document.querySelector(".sidebar")?.classList.toggle("mobile-open");
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("#car-search")) { state.search = target.value; updateCarResults(); }
  if (target.matches("[data-draft]")) state.draft[target.dataset.draft] = target.value;
  if (target.matches("[data-weight]")) {
    const label = document.querySelector(`[data-weight-label="${target.dataset.weight}"]`);
    if (label) label.textContent = `${target.value}/10`;
  }
});

app.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.matches("#car-filter")) { state.filter = target.value; updateCarResults(); }
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
