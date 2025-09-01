/* =========================
   AI Prompt Maker Free Version – app.js v6.1
   案1: 簡易撮影モード対応 + プロ版同一辞書読み込み + 修正版
   ========================= */

/* ========= ユーティリティ & 状態 ========= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const toast = (msg) => {
  const t = $("#toast");
  if (!t) { 
    console.log(msg); 
    // 簡易通知を表示
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      background: #333; color: white; padding: 10px 15px;
      border-radius: 5px; font-size: 14px; max-width: 300px;
    `;
    notification.textContent = msg;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
    return; 
  }
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 1500);
};

function dl(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; 
  a.download = filename; 
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function nowStamp() {
  const d = new Date(), z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`;
}

function seedFromName(nm, extra = 0) {
  if (!nm) return Math.floor(Math.random() * 1e9);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < nm.length; i++) { 
    h ^= nm.charCodeAt(i); 
    h = (h >>> 0) * 16777619 >>> 0; 
  }
  if (extra) h = (h + (extra * 2654435761 >>> 0)) >>> 0;
  return h >>> 0;
}

/* ===== 基本値取得 ===== */
function getBFValue(name) {
  const sel = document.querySelector(`input[name="bf_${name}"]:checked`);
  if (sel && sel.value) return sel.value;
  const host = document.body || document.documentElement;
  const key = `bf${name[0].toUpperCase()}${name.slice(1)}`;
  return (host?.dataset?.[key] || "").trim();
}

function getGenderCountTag() {
  const g = document.querySelector('input[name="bf_gender"]:checked')?.value?.toLowerCase() || "";
  if (!g) return "";
  if (/\b(female|girl|woman|feminine|女子|女性)\b/.test(g)) return "1girl";
  if (/\b(male|boy|man|masculine|男子|男性)\b/.test(g)) return "1boy";
  return "";
}

/* ===== ネガティブ構築 ===== */
const NEG_TIGHT = [
  "multiple people", "group", "crowd", "background people", "bystanders", "another person",
  "photobomb", "reflection", "mirror", "poster", "billboard", "tv screen",
  "bad hands", "bad anatomy", "extra fingers", "extra arms", "extra legs",
  "fused fingers", "malformed hands", "long fingers",
  "lowres", "blurry", "low quality", "worst quality", "jpeg artifacts",
  "text", "watermark", "logo"
];

function buildNegative(baseText = "", useDefault = true) {
  const base = useDefault ? [...NEG_TIGHT] : [];
  const custom = baseText
    ? baseText.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  return Array.from(new Set([...base, ...custom])).join(", ");
}

/* ===== 正規化 ===== */
window.normalizeTag = function(t) {
  return String(t ?? "").trim();
};

function toTag(txt) {
  return normalizeTag(txt);
}

/* ===== 辞書（無料版：プロ版と同じJSONから読み込み） ===== */
let SFW = {
  hair_style: [], eyes: [], outfit: [], face: [], skin_body: [], art_style: [], background: [],
  pose: [], composition: [], view: [], expressions: [], accessories: [], lighting: [],
  age: [], gender: [], body_type: [], height: [], personality: [], colors: []
};

let NSFW = {
  expression: [], exposure: [], situation: [], lighting: [], background: [],
  pose: [], accessory: [], outfit: [], body: [], nipples: [], underwear: []
};

function normItem(x) {
  if (typeof x === "string") return { tag: x, label: x, level: "L1" };
  if (!x || typeof x !== "object") return null;
  const tag = x.tag ?? x.en ?? x.keyword ?? x.value ?? x.name;
  const ja = x.ja || x.jp || x["name_ja"] || x["label_ja"] || x.desc || x.label;
  const label = (ja && String(ja).trim()) ? String(ja).trim() : (tag || "");
  const level = (x.level || "L1").toUpperCase();
  if (tag === undefined || tag === null) return null;
  return { ...x, tag: String(tag), label, level };
}

function normList(arr) { 
  return (arr || []).map(normItem).filter(Boolean); 
}

function dedupeByTag(list) {
  const seen = new Set(); 
  const out = [];
  for (const it of normList(list)) { 
    if (seen.has(it.tag)) continue; 
    seen.add(it.tag); 
    out.push(it); 
  }
  return out;
}

function mergeIntoSFW(json) {
  const src = json?.SFW || json || {};
  const next = { ...SFW };
  const KEYMAP = {
    "髪型": "hair_style", "目の形": "eyes", "服": "outfit", "顔の特徴": "face",
    "体型": "skin_body", "視点": "view", "画風": "art_style", "背景": "background",
    "ポーズ": "pose", "構図": "composition", "表情": "expressions",
    "アクセサリー": "accessories", "ライティング": "lighting", "年齢": "age",
    "性別": "gender", "体型(基本)": "body_type", "身長": "height", "性格": "personality",
    "色": "colors"
  };

  for (const [k, v] of Object.entries(src || {})) {
    const key = KEYMAP[k] || k;
    if (next[key] === undefined) continue;
    next[key] = dedupeByTag([...(next[key] || []), ...normList(v)]);
  }
  SFW = next;
}

function normNSFW(ns) {
  const src = (ns && ns.categories) ? ns.categories : (ns || {});
  const ALIAS = {
    expression: ['expression', '表情'],
    exposure: ['exposure', '露出'],
    situation: ['situation', 'シチュ', 'scenario', 'context'],
    lighting: ['lighting', 'ライティング', 'light'],
    background: ['background', '背景'],
    pose: ['pose', 'poses', 'ポーズ'],
    accessory: ['accessory', 'accessories', 'acc', 'アクセ', 'アクセサリー'],
    outfit: ['outfit', 'outfits', 'costume', 'clothes', '衣装'],
    body: ['body', 'anatomy', 'feature', 'features', 'body_features', 'body_shape', '身体', '体型'],
    nipples: ['nipples', 'nipple', '乳首', '乳首系'],
    underwear: ['underwear', 'lingerie', '下着', 'インナー']
  };

  const pickBy = (names) => {
    for (const k of names) {
      if (Array.isArray(src?.[k])) return normList(src[k]);
    }
    return [];
  };

  return {
    expression: pickBy(ALIAS.expression),
    exposure: pickBy(ALIAS.exposure),
    situation: pickBy(ALIAS.situation),
    lighting: pickBy(ALIAS.lighting),
    background: pickBy(ALIAS.background),
    pose: pickBy(ALIAS.pose),
    accessory: pickBy(ALIAS.accessory),
    outfit: pickBy(ALIAS.outfit),
    body: pickBy(ALIAS.body),
    nipples: pickBy(ALIAS.nipples),
    underwear: pickBy(ALIAS.underwear)
  };
}

function mergeIntoNSFW(json) {
  const src = json?.NSFW ? normNSFW(json.NSFW) : normNSFW(json);
  NSFW = NSFW || {};
  const ensure = (k) => { if (!Array.isArray(NSFW[k])) NSFW[k] = []; };
  ['expression', 'exposure', 'situation', 'lighting', 'background', 'pose', 'accessory', 'outfit', 'body', 'nipples', 'underwear'].forEach(ensure);

  NSFW = {
    expression: dedupeByTag([...(NSFW.expression || []), ...(src.expression || [])]),
    exposure: dedupeByTag([...(NSFW.exposure || []), ...(src.exposure || [])]),
    situation: dedupeByTag([...(NSFW.situation || []), ...(src.situation || [])]),
    lighting: dedupeByTag([...(NSFW.lighting || []), ...(src.lighting || [])]),
    background: dedupeByTag([...(NSFW.background || []), ...(src.background || [])]),
    pose: dedupeByTag([...(NSFW.pose || []), ...(src.pose || [])]),
    accessory: dedupeByTag([...(NSFW.accessory || []), ...(src.accessory || [])]),
    outfit: dedupeByTag([...(NSFW.outfit || []), ...(src.outfit || [])]),
    body: dedupeByTag([...(NSFW.body || []), ...(src.body || [])]),
    nipples: dedupeByTag([...(NSFW.nipples || []), ...(src.nipples || [])]),
    underwear: dedupeByTag([...(NSFW.underwear || []), ...(src.underwear || [])])
  };
}

// フォールバック用の最小辞書
function loadFallbackDict() {
  const fallbackSFW = {
    hair_style: [
      { tag: "long hair", label: "ロングヘア", level: "L1" },
      { tag: "short hair", label: "ショートヘア", level: "L1" },
      { tag: "medium hair", label: "ミディアムヘア", level: "L1" },
      { tag: "bob cut", label: "ボブカット", level: "L1" },
      { tag: "ponytail", label: "ポニーテール", level: "L1" },
      { tag: "twin tails", label: "ツインテール", level: "L1" }
    ],
    eyes: [
      { tag: "blue eyes", label: "青い瞳", level: "L1" },
      { tag: "brown eyes", label: "茶色い瞳", level: "L1" },
      { tag: "green eyes", label: "緑の瞳", level: "L1" },
      { tag: "gray eyes", label: "灰色の瞳", level: "L1" }
    ],
    outfit: [
      { tag: "t-shirt", label: "Tシャツ", cat: "top", level: "L1" },
      { tag: "blouse", label: "ブラウス", cat: "top", level: "L1" },
      { tag: "dress", label: "ドレス", cat: "dress", level: "L1" },
      { tag: "jeans", label: "ジーンズ", cat: "pants", level: "L1" },
      { tag: "skirt", label: "スカート", cat: "skirt", level: "L1" },
      { tag: "sneakers", label: "スニーカー", cat: "shoes", level: "L1" }
    ],
    age: [
      { tag: "young", label: "若い", level: "L1" },
      { tag: "adult", label: "大人", level: "L1" }
    ],
    gender: [
      { tag: "1girl", label: "女性", level: "L1" },
      { tag: "1boy", label: "男性", level: "L1" }
    ],
    body_type: [
      { tag: "slender", label: "スレンダー", level: "L1" },
      { tag: "average build", label: "標準体型", level: "L1" }
    ],
    height: [
      { tag: "average height", label: "平均身長", level: "L1" }
    ],
    background: [
      { tag: "plain background", label: "シンプルな背景", level: "L1" },
      { tag: "white background", label: "白背景", level: "L1" },
      { tag: "outdoors", label: "屋外", level: "L1" },
      { tag: "park", label: "公園", level: "L1" },
      { tag: "classroom", label: "教室", level: "L1" }
    ],
    pose: [
      { tag: "standing", label: "立っている", level: "L1" },
      { tag: "sitting", label: "座っている", level: "L1" },
      { tag: "arms at sides", label: "両手を下ろした", level: "L1" },
      { tag: "waving", label: "手を振っている", level: "L1" }
    ],
    composition: [
      { tag: "bust", label: "バストアップ", level: "L1" },
      { tag: "full body", label: "全身", level: "L1" },
      { tag: "portrait", label: "ポートレート", level: "L1" }
    ],
    view: [
      { tag: "front view", label: "正面", level: "L1" },
      { tag: "three-quarter view", label: "斜め前", level: "L1" },
      { tag: "side view", label: "横向き", level: "L1" }
    ],
    expressions: [
      { tag: "neutral expression", label: "普通の表情", level: "L1" },
      { tag: "smiling", label: "笑顔", level: "L1" },
      { tag: "serious", label: "真剣", level: "L1" }
    ],
    lighting: [
      { tag: "even lighting", label: "均等な照明", level: "L1" },
      { tag: "soft lighting", label: "柔らかい照明", level: "L1" },
      { tag: "window light", label: "窓からの光", level: "L1" }
    ]
  };
  
  mergeIntoSFW({ SFW: fallbackSFW });
  renderSFW();
  renderShooting();
  toast("フォールバック辞書を読み込みました");
}

/* ===== 辞書読み込み ===== */
async function loadDefaultDicts() {
  const tryFetch = async (path) => {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) throw new Error("bad status");
      return await r.json();
    } catch (_) { 
      return null; 
    }
  };

  const sfw = await tryFetch("dict/default_sfw.json");
  if (sfw) { 
    mergeIntoSFW(sfw); 
    renderSFW(); 
    renderShooting();
    toast("SFW辞書を読み込みました"); 
  } else {
    // フォールバック：最小限の辞書データ
    console.warn("SFW辞書の読み込みに失敗しました。フォールバック辞書を使用します。");
    loadFallbackDict();
  }

  const nsfw = await tryFetch("dict/default_nsfw.json");
  if (nsfw) { 
    mergeIntoNSFW(nsfw); 
    toast("NSFW辞書を読み込みました（無料版では使用しません）"); 
  }
}

/* ===== レンダリング関数 ===== */
function renderSFW() {
  radioList($("#bf_age"), SFW.age, "bf_age");
  radioList($("#bf_gender"), SFW.gender, "bf_gender");  
  radioList($("#bf_body"), SFW.body_type, "bf_body");
  radioList($("#bf_height"), SFW.height, "bf_height");
  radioList($("#hairStyle"), SFW.hair_style, "hairStyle");
  radioList($("#eyeShape"), SFW.eyes, "eyeShape");

  // 服カテゴリ別レンダリング
  const outfitTop = SFW.outfit.filter(item => item.cat === "top");
  const outfitDress = SFW.outfit.filter(item => item.cat === "dress");
  const outfitPants = SFW.outfit.filter(item => item.cat === "pants");
  const outfitSkirt = SFW.outfit.filter(item => item.cat === "skirt");
  const outfitShoes = SFW.outfit.filter(item => item.cat === "shoes");

  radioList($("#outfit_top"), outfitTop, "outfit_top");
  radioList($("#outfit_dress"), outfitDress, "outfit_dress");
  radioList($("#outfit_pants"), outfitPants, "outfit_pants");
  radioList($("#outfit_skirt"), outfitSkirt, "outfit_skirt");
  radioList($("#outfit_shoes"), outfitShoes, "outfit_shoes");
}

function renderShooting() {
  radioList($("#s_bg"), SFW.background, "s_bg");
  radioList($("#s_pose"), SFW.pose, "s_pose");
  radioList($("#s_comp"), SFW.composition, "s_comp");
  radioList($("#s_view"), SFW.view, "s_view");
  radioList($("#s_expr"), SFW.expressions, "s_expr");
  radioList($("#s_light"), SFW.lighting, "s_light");
}

function radioList(el, list, name, { checkFirst = true } = {}) {
  if (!el) return;
  const items = normList(list);
  
  el.innerHTML = '';
  
  items.forEach((it, i) => {
    const showMini = it.tag && it.label && it.tag !== it.label;
    const checked = (checkFirst && i === 0);
    const radioId = `${name}_${i}_${Date.now()}`;
    
    const label = document.createElement('label');
    label.className = 'chip';
    label.setAttribute('for', radioId);
    
    const input = document.createElement('input');
    input.type = 'radio';
    input.id = radioId;
    input.name = name;
    input.value = it.tag;
    input.checked = checked;
    
    const span = document.createElement('span');
    span.textContent = it.label;
    
    if (showMini) {
      const miniSpan = document.createElement('span');
      miniSpan.className = 'mini';
      miniSpan.textContent = ` ${it.tag}`;
      span.appendChild(miniSpan);
    }
    
    label.appendChild(input);
    label.appendChild(span);
    el.appendChild(label);
    
    label.addEventListener('click', (e) => {
      e.preventDefault();
      if (!input.checked) {
        const others = document.querySelectorAll(`input[name="${name}"]`);
        others.forEach(other => other.checked = false);
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

const getOne = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || "";

/* ===== カラーユーティリティ ===== */
function hslToRgb(h, s, l) {
  s /= 100; 
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, 
        x = c * (1 - Math.abs((h / 60) % 2 - 1)), 
        m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { [r, g, b] = [c, x, 0] } 
  else if (h < 120) { [r, g, b] = [x, c, 0] } 
  else if (h < 180) { [r, g, b] = [0, c, x] }
  else if (h < 240) { [r, g, b] = [0, x, c] } 
  else if (h < 300) { [r, g, b] = [x, 0, c] } 
  else { [r, g, b] = [c, 0, x] }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(v => Math.round(v));
}

function toneToTag(v) {
  if (v <= 10) return "porcelain skin";
  if (v <= 25) return "very fair skin";
  if (v <= 40) return "light skin";
  if (v <= 55) return "medium skin";
  if (v <= 70) return "tan skin";
  if (v <= 85) return "brown skin";
  if (v <= 95) return "dark brown skin";
  return "deep / ebony skin";
}

function colorNameFromHSL(h, s, l) {
  if (l < 12) return "black";
  if (l > 92 && s < 20) return "white";
  if (s < 10) {
    if (l < 30) return "dark gray";
    if (l > 70) return "light gray";
    return "gray";
  }
  const table = [
    { h: 0, name: "red" }, { h: 12, name: "crimson" }, { h: 22, name: "vermilion" },
    { h: 32, name: "orange" }, { h: 45, name: "gold" }, { h: 60, name: "yellow" },
    { h: 75, name: "lime" }, { h: 90, name: "green" }, { h: 110, name: "emerald" },
    { h: 150, name: "teal" }, { h: 180, name: "cyan" }, { h: 200, name: "aqua" },
    { h: 210, name: "sky blue" }, { h: 225, name: "azure" }, { h: 240, name: "blue" },
    { h: 255, name: "indigo" }, { h: 270, name: "violet" }, { h: 285, name: "purple" },
    { h: 300, name: "magenta" }, { h: 320, name: "fuchsia" }, { h: 335, name: "rose" },
    { h: 350, name: "pink" }, { h: 360, name: "red" }
  ];
  let base = table[0].name, min = 360;
  for (const t of table) {
    let d = Math.abs(h - t.h); 
    if (d > 180) d = 360 - d;
    if (d < min) { min = d; base = t.name; }
  }
  let prefix = "";
  if (s >= 70 && l <= 40) prefix = "deep";
  else if (s >= 70 && l >= 70) prefix = "bright";
  else if (l >= 85 && s >= 20 && s <= 60) prefix = "pastel";
  else if (s <= 35) prefix = "muted";
  else if (l <= 30) prefix = "dark";
  else if (l >= 80) prefix = "light";
  return prefix ? `${prefix} ${base}` : base;
}

/* ===== 色ホイール ===== */
function addHueDrag(wheelEl, thumbEl, onHueChange) {
  if (!wheelEl || !thumbEl) return;
  const getCenter = () => {
    const r = wheelEl.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, rOuter: r.width / 2 - 7 };
  };
  const setThumb = (hue) => {
    const { rOuter } = getCenter();
    const rad = (hue - 90) * Math.PI / 180;
    thumbEl.style.left = (wheelEl.clientWidth / 2 + rOuter * Math.cos(rad) - 7) + "px";
    thumbEl.style.top = (wheelEl.clientHeight / 2 + rOuter * Math.sin(rad) - 7) + "px";
  };
  let dragging = false;
  const updateFromEvent = (e) => {
    const { cx, cy } = getCenter();
    const x = (e.clientX ?? (e.touches && e.touches[0]?.clientX)) - cx;
    const y = (e.clientY ?? (e.touches && e.touches[0]?.clientY)) - cy;
    const ang = Math.atan2(y, x);
    const hue = (ang * 180 / Math.PI + 360 + 90) % 360;
    setThumb(hue);
    onHueChange(hue);
  };
  const onDown = (e) => { e.preventDefault(); dragging = true; updateFromEvent(e); };
  const onMove = (e) => { if (dragging) updateFromEvent(e); };
  const onUp = () => { dragging = false; };
  wheelEl.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  return setThumb;
}

function initWheel(wId, tId, sId, lId, swId, tagId, baseTag) {
  const wheel = $(wId), thumb = $(tId), sat = $(sId), lit = $(lId), sw = $(swId), tagEl = $(tagId);
  if (!wheel || !thumb || !sat || !lit || !sw || !tagEl) {
    return () => (document.querySelector(tagId)?.textContent || "").trim();
  }
  let hue = 35;
  function paint() {
    const s = +sat.value, l = +lit.value;
    const [r, g, b] = hslToRgb(hue, s, l);
    sw.style.background = `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
    const cname = colorNameFromHSL(hue, s, l);
    tagEl.textContent = `${cname} ${baseTag}`;
  }
  const onHue = (h) => { hue = h; onHue.__lastHue = h; paint(); };
  onHue.__lastHue = hue;
  addHueDrag(wheel, thumb, onHue);
  sat.addEventListener("input", paint);
  lit.addEventListener("input", paint);
  requestAnimationFrame(() => {
    paint();
    const rect = wheel.getBoundingClientRect();
    const r = rect.width / 2 - 7;
    const rad = (hue - 90) * Math.PI / 180;
    thumb.style.left = (rect.width / 2 + r * Math.cos(rad) - 7) + "px";
    thumb.style.top = (rect.height / 2 + r * Math.sin(rad) - 7) + "px";
  });
  return () => (($(tagId).textContent) || "").trim();
}

function initColorWheel(idBase, defaultHue = 0, defaultS = 80, defaultL = 50) {
  const wheel = document.getElementById("wheel_" + idBase);
  const thumb = document.getElementById("thumb_" + idBase);
  const sat = document.getElementById("sat_" + idBase);
  const lit = document.getElementById("lit_" + idBase);
  const sw = document.getElementById("sw_" + idBase);
  const tag = document.getElementById("tag_" + idBase);
  
  if (!wheel || !thumb || !sat || !lit || !sw || !tag) {
    return () => (document.getElementById("tag_" + idBase)?.textContent || "").trim();
  }
  
  let hue = defaultHue;
  
  sat.value = defaultS;
  lit.value = defaultL;
  
  function paint() {
    const s = +sat.value;
    const l = +lit.value;
    const [r, g, b] = hslToRgb(hue, s, l);
    sw.style.background = `rgb(${r},${g},${b})`;
    
    let useCheckbox = null;
    if (idBase === 'bottom') {
      useCheckbox = document.getElementById("useBottomColor");
    } else if (idBase.startsWith('p_')) {
      useCheckbox = document.getElementById("p_use_" + idBase.substring(2));
    } else {
      useCheckbox = document.getElementById("use_" + idBase);
    }
    
    if (useCheckbox && !useCheckbox.checked) {
      tag.textContent = "—";
    } else {
      const colorName = colorNameFromHSL(hue, s, l);
      tag.textContent = colorName;
    }
  }
  
  const onHue = (h) => {
    hue = h;
    onHue.__lastHue = h;
    paint();
  };
  onHue.__lastHue = hue;
  
  addHueDrag(wheel, thumb, onHue);
  
  sat.addEventListener("input", paint);
  lit.addEventListener("input", paint);
  
  let useCheckbox = null;
  if (idBase === 'bottom') {
    useCheckbox = document.getElementById("useBottomColor");
  } else if (idBase.startsWith('p_')) {
    useCheckbox = document.getElementById("p_use_" + idBase.substring(2));
  } else {
    useCheckbox = document.getElementById("use_" + idBase);
  }
  
  if (useCheckbox) {
    useCheckbox.addEventListener("change", (e) => {
      paint();
    });
  }
  
  requestAnimationFrame(() => {
    paint();
    const rect = wheel.getBoundingClientRect();
    const radius = rect.width / 2 - 7;
    const radians = (hue - 90) * Math.PI / 180;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    thumb.style.left = (centerX + radius * Math.cos(radians) - 7) + "px";
    thumb.style.top = (centerY + radius * Math.sin(radians) - 7) + "px";
  });
  
  return () => tag.textContent.trim();
}

/* ===== プロンプト生成関数 ===== */
function collectBasicInfo() {
  const info = {};
  
  // 基本属性
  info.age = getOne("bf_age");
  info.gender = getOne("bf_gender");
  info.bodyType = getOne("bf_body");
  info.height = getOne("bf_height");
  info.hairStyle = getOne("hairStyle");
  info.eyeShape = getOne("eyeShape");
  
  // 色情報
  info.hairColor = $("#tagH")?.textContent?.replace("hair", "").trim();
  info.eyeColor = $("#tagE")?.textContent?.replace("eyes", "").trim();
  info.skinTone = $("#tagSkin")?.textContent;
  
  // 服装情報
  const isOnepiece = document.querySelector('input[name="outfitMode"]:checked')?.value === "onepiece";
  
  if (isOnepiece) {
    info.outfit = getOne("outfit_dress");
    info.topColor = $("#use_top")?.checked ? $("#tag_top")?.textContent : null;
  } else {
    info.top = getOne("outfit_top");
    info.topColor = $("#use_top")?.checked ? $("#tag_top")?.textContent : null;
    
    const bottomCat = getOne("bottomCat");
    if (bottomCat === "pants") {
      info.bottom = getOne("outfit_pants");
    } else {
      info.bottom = getOne("outfit_skirt");
    }
    info.bottomColor = $("#useBottomColor")?.checked ? $("#tag_bottom")?.textContent : null;
  }
  
  info.shoes = getOne("outfit_shoes");
  info.shoesColor = $("#use_shoes")?.checked ? $("#tag_shoes")?.textContent : null;
  
  // キャラ情報
  info.charName = $("#charName")?.value?.trim();
  info.loraTag = $("#loraTag")?.value?.trim();
  
  return info;
}

function buildPrompt(info, additionalTags = []) {
  const tags = [];
  
  // LoRAタグ
  if (info.loraTag) tags.push(info.loraTag);
  
  // 基本属性
  if (info.gender) tags.push(info.gender);
  if (info.age) tags.push(info.age);
  if (info.bodyType) tags.push(info.bodyType);
  if (info.height) tags.push(info.height);
  
  // 外見
  if (info.hairStyle && info.hairColor) {
    tags.push(`${info.hairColor} ${info.hairStyle}`);
  } else {
    if (info.hairStyle) tags.push(info.hairStyle);
    if (info.hairColor) tags.push(`${info.hairColor} hair`);
  }
  
  if (info.eyeShape && info.eyeColor) {
    tags.push(`${info.eyeColor} ${info.eyeShape}`);
  } else {
    if (info.eyeShape) tags.push(info.eyeShape);
    if (info.eyeColor) tags.push(`${info.eyeColor} eyes`);
  }
  
  if (info.skinTone) tags.push(info.skinTone);
  
  // 服装
  if (info.outfit) {
    // ワンピース
    if (info.topColor) {
      tags.push(`${info.topColor} ${info.outfit}`);
    } else {
      tags.push(info.outfit);
    }
  } else {
    // 上下セパレート
    if (info.top) {
      if (info.topColor) {
        tags.push(`${info.topColor} ${info.top}`);
      } else {
        tags.push(info.top);
      }
    }
    
    if (info.bottom) {
      if (info.bottomColor) {
        tags.push(`${info.bottomColor} ${info.bottom}`);
      } else {
        tags.push(info.bottom);
      }
    }
  }
  
  if (info.shoes) {
    if (info.shoesColor) {
      tags.push(`${info.shoesColor} ${info.shoes}`);
    } else {
      tags.push(info.shoes);
    }
  }
  
  // 追加タグ
  tags.push(...additionalTags);
  
  return tags.filter(Boolean).join(", ");
}

function formatOutput(prompt, negative, format = "a1111") {
  switch (format) {
    case "invoke":
      return `${prompt} [${negative}]`;
    case "comfy":
      return `Positive: ${prompt}\nNegative: ${negative}`;
    case "sdnext":
      return `--prompt "${prompt}" --negative-prompt "${negative}"`;
    case "nai":
      return `${prompt}\nUndesired Content: ${negative}`;
    default: // a1111
      return `${prompt}\nNegative prompt: ${negative}`;
  }
}

/* ===== イベントハンドラー ===== */
function setupBasicHandlers() {
  // 1枚テスト生成
  $("#btnOneLearn")?.addEventListener("click", () => {
    const info = collectBasicInfo();
    const prompt = buildPrompt(info);
    const negative = buildNegative();
    const format = $("#fmtLearn")?.value || "a1111";
    
    const fullOutput = formatOutput(prompt, negative, format);
    const captionOutput = buildPrompt(info); // キャプション用（ネガティブなし）
    
    $("#outLearnTestAll").textContent = fullOutput;
    $("#outLearnTestPrompt").textContent = prompt;
    $("#outLearnTestNeg").textContent = negative;
    $("#outLearnTestCaption").textContent = captionOutput;
  });
  
  // コピーボタン
  $("#btnCopyLearnTestAll")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outLearnTestAll").textContent);
    toast("全体をコピーしました");
  });
  
  $("#btnCopyLearnTestPrompt")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outLearnTestPrompt").textContent);
    toast("プロンプトをコピーしました");
  });
  
  $("#btnCopyLearnTestNeg")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outLearnTestNeg").textContent);
    toast("ネガティブをコピーしました");
  });
  
  $("#btnCopyLearnTestCaption")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outLearnTestCaption").textContent);
    toast("キャプションをコピーしました");
  });
}

function setupShootingHandlers() {
  // 撮影モード生成
  $("#btnShootingOne")?.addEventListener("click", () => {
    const info = collectBasicInfo();
    const fixedTags = $("#fixedShooting")?.value?.split(",").map(s => s.trim()).filter(Boolean) || [];
    
    const additionalTags = [
      ...fixedTags,
      getOne("s_bg"),
      getOne("s_pose"),
      getOne("s_comp"),
      getOne("s_view"),
      getOne("s_expr"),
      getOne("s_light")
    ].filter(Boolean);
    
    const prompt = buildPrompt(info, additionalTags);
    const negative = buildNegative();
    const format = $("#fmtShooting")?.value || "a1111";
    
    const fullOutput = formatOutput(prompt, negative, format);
    const captionOutput = buildPrompt(info, additionalTags);
    
    $("#outShootingAll").textContent = fullOutput;
    $("#outShootingPrompt").textContent = prompt;
    $("#outShootingNeg").textContent = negative;
    $("#outShootingCaption").textContent = captionOutput;
  });
  
  // コピーボタン
  $("#btnCopyShootingAll")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outShootingAll").textContent);
    toast("全体をコピーしました");
  });
  
  $("#btnCopyShootingPrompt")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outShootingPrompt").textContent);
    toast("プロンプトをコピーしました");
  });
  
  $("#btnCopyShootingNeg")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outShootingNeg").textContent);
    toast("ネガティブをコピーしました");
  });
  
  $("#btnCopyShootingCaption")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("#outShootingCaption").textContent);
    toast("キャプションをコピーしました");
  });
}

function initColorWheels() {
  // 髪色（茶色系）
  initWheel("#wheelH", "#thumbH", "#satH", "#litH", "#swH", "#tagH", "hair");
  
  // 瞳色（青系）  
  initWheel("#wheelE", "#thumbE", "#satE", "#litE", "#swE", "#tagE", "eyes");
  
  // 肌色スライダー
  const skinSlider = $("#skinTone");
  const skinSwatch = $("#swSkin");
  const skinTag = $("#tagSkin");
  
  if (skinSlider && skinSwatch && skinTag) {
    const updateSkin = () => {
      const tone = +skinSlider.value;
      const lightness = 85 - (tone * 0.5); // 85% -> 35%
      skinSwatch.style.background = `hsl(25, 40%, ${lightness}%)`;
      skinTag.textContent = toneToTag(tone);
    };
    
    skinSlider.addEventListener("input", updateSkin);
    updateSkin();
  }
  
  // 服色ホイール
  initColorWheel("top", 220, 80, 55);    // 青系
  initColorWheel("bottom", 0, 70, 50);   // 赤系  
  initColorWheel("shoes", 0, 0, 30);     // 黒系
}

/* ===== 初期化 ===== */
function initApp() {
  console.log("アプリケーション初期化開始");
  
  // 辞書読み込み
  loadDefaultDicts().then(() => {
    console.log("辞書読み込み完了");
  }).catch(err => {
    console.error("辞書読み込みエラー:", err);
    loadFallbackDict();
  });
  
  // 色ホイール初期化
  initColorWheels();
  
  // イベントハンドラー設定
  setupBasicHandlers();
  setupShootingHandlers();
  
  console.log("アプリケーション初期化完了");
}

// DOMContentLoaded イベントで初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
