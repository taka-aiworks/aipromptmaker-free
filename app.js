/* =========================
   AI Prompt Maker Free Version – app.js
   ========================= */

/* ========= ユーティリティ & 状態 ========= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const toast = (msg) => {
  const t = $("#toast");
  if (!t) { 
    // トースト要素がない場合は代替表示
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

/* ===== 辞書（無料版：簡易版データ） ===== */
let SFW = {
  hair_style: [
    { tag: "long hair", label: "ロングヘア", level: "L1" },
    { tag: "short hair", label: "ショートヘア", level: "L1" },
    { tag: "medium hair", label: "ミディアムヘア", level: "L1" },
    { tag: "bob cut", label: "ボブカット", level: "L1" },
    { tag: "ponytail", label: "ポニーテール", level: "L1" },
    { tag: "twin tails", label: "ツインテール", level: "L1" },
    { tag: "braided hair", label: "三つ編み", level: "L1" }
  ],
  eyes: [
    { tag: "blue eyes", label: "青い瞳", level: "L1" },
    { tag: "brown eyes", label: "茶色い瞳", level: "L1" },
    { tag: "green eyes", label: "緑の瞳", level: "L1" },
    { tag: "gray eyes", label: "灰色の瞳", level: "L1" },
    { tag: "red eyes", label: "赤い瞳", level: "L1" },
    { tag: "purple eyes", label: "紫の瞳", level: "L1" }
  ],
  outfit: [
    { tag: "t-shirt", label: "Tシャツ", cat: "top", level: "L1" },
    { tag: "blouse", label: "ブラウス", cat: "top", level: "L1" },
    { tag: "hoodie", label: "フーディー", cat: "top", level: "L1" },
    { tag: "sweater", label: "セーター", cat: "top", level: "L1" },
    { tag: "jeans", label: "ジーンズ", cat: "pants", level: "L1" },
    { tag: "shorts", label: "ショーツ", cat: "pants", level: "L1" },
    { tag: "skirt", label: "スカート", cat: "skirt", level: "L1" },
    { tag: "pleated skirt", label: "プリーツスカート", cat: "skirt", level: "L1" },
    { tag: "dress", label: "ドレス", cat: "dress", level: "L1" },
    { tag: "sundress", label: "サンドレス", cat: "dress", level: "L1" },
    { tag: "sneakers", label: "スニーカー", cat: "shoes", level: "L1" },
    { tag: "boots", label: "ブーツ", cat: "shoes", level: "L1" }
  ],
  age: [
    { tag: "young", label: "若い", level: "L1" },
    { tag: "teenager", label: "ティーンエイジャー", level: "L1" },
    { tag: "adult", label: "大人", level: "L1" }
  ],
  gender: [
    { tag: "female", label: "女性", level: "L1" },
    { tag: "male", label: "男性", level: "L1" }
  ],
  body_type: [
    { tag: "slender", label: "スレンダー", level: "L1" },
    { tag: "average build", label: "標準体型", level: "L1" },
    { tag: "athletic", label: "アスレチック", level: "L1" }
  ],
  height: [
    { tag: "short", label: "低身長", level: "L1" },
    { tag: "average height", label: "平均身長", level: "L1" },
    { tag: "tall", label: "高身長", level: "L1" }
  ]
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

/* ===== 肌トーン ===== */
function paintSkin() {
  const v = +($("#skinTone").value || 0);
  const tag = toneToTag(v);
  $("#swSkin").style.background = `hsl(${30}, ${20}%, ${85 - v * 0.7}%)`;
  $("#tagSkin").textContent = tag;
}

/* ===== フォーマッタ ===== */
const FORMATTERS = {
  a1111: { 
    label: "Web UI（汎用）",
    line: (p, n, seed) => `Prompt: ${p}\nNegative prompt: ${n}\nSeed: ${seed}`,
  },
  invoke: { 
    label: "InvokeAI",
    line: (p, n, seed) => `invoke --prompt "${p}" --negative_prompt "${n}" --seed ${seed}`,
  },
  comfy: { 
    label: "ComfyUI（テキスト）",
    line: (p, n, seed) => `positive="${p}"\nnegative="${n}"\nseed=${seed}`,
  },
  sdnext: { 
    label: "SD.Next（dream.py）",
    line: (p, n, seed) => `python dream.py -p "${p}" -n "${n}" -S ${seed}`,
  },
  nai: { 
    label: "NovelAI",
    line: (p, n, seed) => `Prompt: ${p}\nUndesired: ${n}\nSeed: ${seed}`,
  }
};

const getFmt = (selId, fallback = "a1111") => FORMATTERS[$(selId)?.value || fallback] || FORMATTERS[fallback];

/* ===== 服の完成タグを生成 ===== */
function makeFinalOutfitTags(selectedOutfits, colorTags) {
  const sel = Array.isArray(selectedOutfits) ? selectedOutfits.filter(Boolean) : [];
  const colors = {
    top: (colorTags?.top || "").replace(/^—$/, "").trim(),
    bottom: (colorTags?.bottom || "").replace(/^—$/, "").trim(),
    shoes: (colorTags?.shoes || "").replace(/^—$/, "").trim()
  };

  const getCat = (tag) => {
    const k = String(tag || "").toLowerCase();
    // 簡易分類
    if (/(dress|kimono|yukata|cheongsam|hanbok|sari|uniform|gown)$/i.test(k)) return "dress";
    if (/(skirt)$/i.test(k)) return "skirt";
    if (/(jeans|pants|trousers|shorts|overalls|hakama)$/i.test(k)) return "pants";
    if (/(boots|sneakers|loafers|mary janes|socks)$/i.test(k)) return "shoes";
    return "top";
  };

  const hasDress = sel.some(t => getCat(t) === "dress");

  const colorPool = new Set([
    "white", "black", "red", "blue", "green", "yellow", "pink", "purple", "orange", "brown", "gray", "silver", "gold", "beige", "navy",
    "light blue", "sky blue", "teal", "turquoise", "lavender", "violet", "magenta", "crimson", "scarlet", "emerald", "olive",
    "khaki", "ivory", "peach", "mint"
  ].map(s => String(s).toLowerCase()));
  
  const startsWithColor = (s) => {
    const t = String(s || "").toLowerCase();
    return Array.from(colorPool).some(c => t.startsWith(c + " "));
  };

  const out = [];
  if (hasDress) {
    for (const t of sel) {
      const cat = getCat(t);
      if (cat === "dress") {
        const tagged = startsWithColor(t) ? t : (colors.top && colors.top.length > 0 ? `${colors.top} ${t}` : t);
        out.push(tagged);
      } else if (cat === "shoes") {
        const tagged = startsWithColor(t) ? t : (colors.shoes && colors.shoes.length > 0 ? `${colors.shoes} ${t}` : t);
        out.push(tagged);
      }
    }
  } else {
    for (const t of sel) {
      const cat = getCat(t);
      if (cat === "top") {
        const tagged = startsWithColor(t) ? t : (colors.top && colors.top.length > 0 ? `${colors.top} ${t}` : t);
        out.push(tagged);
      } else if (cat === "pants" || cat === "skirt") {
        const tagged = startsWithColor(t) ? t : (colors.bottom && colors.bottom.length > 0 ? `${colors.bottom} ${t}` : t);
        out.push(tagged);
      } else if (cat === "shoes") {
        const tagged = startsWithColor(t) ? t : (colors.shoes && colors.shoes.length > 0 ? `${colors.shoes} ${t}` : t);
        out.push(tagged);
      } else if (cat === "dress") {
        const tagged = startsWithColor(t) ? t : (colors.top && colors.top.length > 0 ? `${colors.top} ${t}` : t);
        out.push(tagged);
      } else {
        out.push(t);
      }
    }
  }
  
  return out;
}

/* ===== キャプション用プロンプトを生成 ===== */
function buildCaptionPrompt() {
  const textOf = id => (document.getElementById(id)?.textContent || "").trim();
  let p = [];
  
  // LoRAタグ
  const loraTag = (document.getElementById('loraTag')?.value || '').trim();
  if (loraTag) p.push(loraTag);
  
  // 基本情報（年齢・性別・体型・身長・髪型・目の形・髪色・目色・肌色のみ）
  [
    getBFValue('age'),
    getBFValue('gender'), 
    getBFValue('body'),
    getBFValue('height'),
    getOne('hairStyle'),
    getOne('eyeShape'),
    textOf('tagH'),  // 髪色
    textOf('tagE'),  // 目色
    textOf('tagSkin') // 肌色
  ].filter(Boolean).forEach(v => p.push(v));
  
  return p.join(", ");
}

/* ===== 1枚テスト生成（無料版の主機能） ===== */
function buildOneLearning(extraSeed = 0) {
  const textOf = id => (document.getElementById(id)?.textContent || "").trim();
  let p = [];
  
  p.push("solo");
  
  const g = getGenderCountTag() || "";
  if (g) p.push(g);

  p.push(...[
    getBFValue('age'), getBFValue('gender'), getBFValue('body'), getBFValue('height'),
    getOne('hairStyle'), getOne('eyeShape'),
    textOf('tagH'), textOf('tagE'), textOf('tagSkin')
  ].filter(Boolean));

  // 服の処理（ワンピース対応）
  const isOnepiece = getIsOnepiece();
  
  const outfits = [];
  const colorTags = {
    top: document.getElementById('use_top')?.checked ? 
         textOf('tag_top').replace(/^—$/, "") : "",
    bottom: document.getElementById('useBottomColor')?.checked ? 
            textOf('tag_bottom').replace(/^—$/, "") : "",
    shoes: document.getElementById('use_shoes')?.checked ? 
           textOf('tag_shoes').replace(/^—$/, "") : ""
  };

  if (isOnepiece) {
    const dress = getOne('outfit_dress');
    if (dress) outfits.push(dress);
  } else {
    const top = getOne('outfit_top');
    const bottomCat = getOne('bottomCat') || 'pants';
    const pants = getOne('outfit_pants');
    const skirt = getOne('outfit_skirt');
    const shoes = getOne('outfit_shoes');
    
    if (top) outfits.push(top);
    if (bottomCat === 'pants' && pants) outfits.push(pants);
    else if (bottomCat === 'skirt' && skirt) outfits.push(skirt);
    if (shoes) outfits.push(shoes);
  }

  const finalOutfits = makeFinalOutfitTags(outfits, colorTags);
  p.push(...finalOutfits);

  // LoRAタグを先頭に移動
  const loraTag = (document.getElementById('loraTag')?.value || '').trim();
  if (loraTag) {
    p = [loraTag, ...p.filter(tag => tag !== loraTag)];
  }

  const useDefNeg = true; // 無料版では常にデフォルトネガティブを使用
  const neg = buildNegative("", useDefNeg);

  const seed = seedFromName((document.getElementById('charName')?.value || ''), extraSeed);
  const prompt = p.join(", ");
  const text = `${prompt}${neg ? ` --neg ${neg}` : ""} seed:${seed}`;
  
  const caption = buildCaptionPrompt();
  
  return { 
    seed, 
    pos: p, 
    neg, 
    prompt, 
    text,
    caption
  };
}

function getIsOnepiece() {
  const outfitMode = getOne('outfitMode');
  return outfitMode === 'onepiece';
}

/* ===== レンダリング関数 ===== */
function renderSFW() {
  radioList($("#hairStyle"), SFW.hair_style, "hairStyle");
  radioList($("#eyeShape"), SFW.eyes, "eyeShape");
  radioList($("#bf_age"), SFW.age, "bf_age");
  radioList($("#bf_gender"), SFW.gender, "bf_gender");
  radioList($("#bf_body"), SFW.body_type, "bf_body");
  radioList($("#bf_height"), SFW.height, "bf_height");

  const C = categorizeOutfit(SFW.outfit);
  radioList($("#outfit_top"), C.top, "outfit_top", {checkFirst: false});
  radioList($("#outfit_pants"), C.pants, "outfit_pants", {checkFirst: false});
  radioList($("#outfit_skirt"), C.skirt, "outfit_skirt", {checkFirst: false});
  radioList($("#outfit_dress"), C.dress, "outfit_dress", {checkFirst: false});
  radioList($("#outfit_shoes"), C.shoes, "outfit_shoes", {checkFirst: false});
}

function categorizeOutfit(list) {
  const L = normList(list || []);
  const C = { top: [], pants: [], skirt: [], dress: [], shoes: [] };

  for (const t of L) {
    const dictCat = (t.cat || "").toLowerCase();
    if (dictCat) {
      if (dictCat === "top") { C.top.push(t); continue; }
      if (dictCat === "pants") { C.pants.push(t); continue; }
      if (dictCat === "skirt") { C.skirt.push(t); continue; }
      if (dictCat === "dress") { C.dress.push(t); continue; }
      if (dictCat === "shoes") { C.shoes.push(t); continue; }
    }

    const tag = (t.tag || "").toLowerCase();
    if (/(t-shirt|tank|blouse|shirt|hoodie|sweater|cardigan|jacket|coat|top)/.test(tag)) { 
      C.top.push(t); continue; 
    }
    if (/(jeans|pants|trousers|shorts|cargo|bermuda|leggings|overalls|hakama)/.test(tag)) { 
      C.pants.push(t); continue; 
    }
    if (/(skirt)/.test(tag)) { 
      C.skirt.push(t); continue; 
    }
    if (/(dress|gown|yukata|kimono|cheongsam|hanbok|sari|uniform)/.test(tag)) { 
      C.dress.push(t); continue; 
    }
    if (/(boots|sneakers|loafers|mary janes|heel|sandal|shoe)/.test(tag)) { 
      C.shoes.push(t); continue; 
    }
    
    C.top.push(t);
  }
  return C;
}

/* ===== テキスト出力 ===== */
function renderTextTriplet(baseId, rows, fmtSelId) {
  const fmt = getFmt(`#${fmtSelId}`);

  if (rows.length > 1) {
    // 複数件の場合（無料版では基本的に1件のみ）
    const allPrompts = rows.map(r => Array.isArray(r.pos) ? r.pos.join(", ") : (r.prompt || "")).join("\n\n");
    const allTexts = rows.map((r, i) => {
      const p = Array.isArray(r.pos) ? r.pos.join(", ") : (r.prompt || "");
      return fmt.line(p, r.neg || "", r.seed || 0);
    }).join("\n\n");

    const negUnion = (() => {
      const negList = rows.map(r => (r.neg || "").trim()).filter(Boolean);
      const allSame = negList.every(n => n === negList[0]);
      if (negList.length === 0) return "";
      if (allSame) return negList[0];
      const tokens = new Set();
      negList.forEach(n => n.split(",").map(s => s.trim()).filter(Boolean).forEach(t => tokens.add(t)));
      return Array.from(tokens).join(", ");
    })();

    const allCaptions = rows.map(r => r.caption || "").filter(Boolean).join("\n\n");

    const outAll = document.getElementById(`${baseId}All`);
    if (outAll) outAll.textContent = allTexts;

    const outPrompt = document.getElementById(`${baseId}Prompt`);
    if (outPrompt) outPrompt.textContent = allPrompts;

    const outNeg = document.getElementById(`${baseId}Neg`);
    if (outNeg) outNeg.textContent = negUnion;

    const outCaption = document.getElementById(`${baseId}Caption`);
    if (outCaption) outCaption.textContent = allCaptions;

  } else {
    // 1件のみの場合
    const r = rows[0];
    const prompt = Array.isArray(r.pos) ? r.pos.join(", ") : (r.prompt || "");
    const neg = r.neg || "";
    const caption = r.caption || "";

    const allText = fmt.line(prompt, neg, r.seed || 0);

    const outAll = document.getElementById(`${baseId}All`);
    if (outAll) outAll.textContent = allText;

    const outPrompt = document.getElementById(`${baseId}Prompt`);
    if (outPrompt) outPrompt.textContent = prompt;

    const outNeg = document.getElementById(`${baseId}Neg`);
    if (outNeg) outNeg.textContent = neg;

    const outCaption = document.getElementById(`${baseId}Caption`);
    if (outCaption) outCaption.textContent = caption;
  }
}

/* ===== 基本情報の初期化とバインド ===== */
function bindBasicInfo() {
  // キャラ設定エクスポート
  const exportChar = document.getElementById("btnExportChar");
  if (exportChar) {
    exportChar.addEventListener("click", () => {
      const data = {
        charName: document.getElementById("charName")?.value || "",
        loraTag: document.getElementById("loraTag")?.value || "",
        outfitMode: getOne('outfitMode'),
        bottomCat: getOne('bottomCat'),
        bf_age: getOne('bf_age'),
        bf_gender: getOne('bf_gender'),
        bf_body: getOne('bf_body'),
        bf_height: getOne('bf_height'),
        hairStyle: getOne('hairStyle'),
        eyeShape: getOne('eyeShape'),
        outfit_top: getOne('outfit_top'),
        outfit_pants: getOne('outfit_pants'),
        outfit_skirt: getOne('outfit_skirt'),
        outfit_dress: getOne('outfit_dress'),
        outfit_shoes: getOne('outfit_shoes'),
        hairColor: {
          h: window.getHairColorTag?.onHue?.__lastHue || 35,
          s: document.getElementById("satH")?.value || 70,
          l: document.getElementById("litH")?.value || 45
        },
        eyeColor: {
          h: window.getEyeColorTag?.onHue?.__lastHue || 240,
          s: document.getElementById("satE")?.value || 80,
          l: document.getElementById("litE")?.value || 55
        },
        skinTone: document.getElementById("skinTone")?.value || 30,
        topColor: {
          use: document.getElementById("use_top")?.checked || false,
          h: window.getTopColor?.onHue?.__lastHue || 35,
          s: document.getElementById("sat_top")?.value || 80,
          l: document.getElementById("lit_top")?.value || 55
        },
        bottomColor: {
          use: document.getElementById("useBottomColor")?.checked || false,
          h: window.getBottomColor?.onHue?.__lastHue || 210,
          s: document.getElementById("sat_bottom")?.value || 70,
          l: document.getElementById("lit_bottom")?.value || 50
        },
        shoesColor: {
          use: document.getElementById("use_shoes")?.checked || false,
          h: window.getShoesColor?.onHue?.__lastHue || 0,
          s: document.getElementById("sat_shoes")?.value || 0,
          l: document.getElementById("lit_shoes")?.value || 30
        }
      };
      
      const filename = `character_${data.charName || 'unnamed'}_${nowStamp()}.json`;
      dl(filename, JSON.stringify(data, null, 2));
      toast("キャラ設定をエクスポートしました");
    });
  }
  
  // 1枚テストボタン
  const btnOneLearn = document.getElementById("btnOneLearn");
  if (btnOneLearn) {
    btnOneLearn.addEventListener("click", () => {
      try {
        const result = buildOneLearning(0);
        renderTextTriplet("outLearnTest", [result], "fmtLearn");
        toast("テスト生成完了");
      } catch (error) {
        console.error("テスト生成エラー:", error);
        toast("テスト生成に失敗しました");
      }
    });
  }
  
  // コピーボタン
  bindCopyTripletExplicit([
    ["btnCopyLearnTestAll", "outLearnTestAll"],
    ["btnCopyLearnTestPrompt", "outLearnTestPrompt"],
    ["btnCopyLearnTestNeg", "outLearnTestNeg"],
    ["btnCopyLearnTestCaption", "outLearnTestCaption"]
  ]);
}

function bindCopyTripletExplicit(pairs) {
  if (!Array.isArray(pairs)) return;
  pairs.forEach(pair => {
    if (!Array.isArray(pair) || pair.length < 2) return;
    const [btnId, outId] = pair;
    const btn = document.getElementById(btnId);
    const out = document.getElementById(outId);
    if (!btn || !out) return;

    btn.addEventListener('click', () => {
      const text = (out.textContent || '').trim();
      if (!text) { toast('コピーする内容がありません'); return; }
      navigator.clipboard?.writeText(text)
        .then(() => toast('コピーしました'))
        .catch(() => {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove(); toast('コピーしました');
        });
    });
  });
}

function initHairEyeAndAccWheels() {
  window.getHairColorTag = initWheel("#wheelH", "#thumbH", "#satH", "#litH", "#swH", "#tagH", "hair");
  window.getEyeColorTag = initWheel("#wheelE", "#thumbE", "#satE", "#litE", "#swE", "#tagE", "eyes");
  
  window.getTopColor = initColorWheel("top", 35, 80, 55);
  window.getBottomColor = initColorWheel("bottom", 210, 70, 50);
  window.getShoesColor = initColorWheel("shoes", 0, 0, 30);
}

function initSkinTone() {
  const s = document.getElementById('skinTone');
  if (s) {
    s.addEventListener('input', paintSkin);
    paintSkin();
  }
}

/* ===== メイン初期化関数 ===== */
function initAll() {
  if (window.__LPM_FREE_INITED) return;
  window.__LPM_FREE_INITED = true;

  // 基本情報の初期化バインド
  bindBasicInfo();
  
  // SFW要素のレンダリング
  renderSFW();
  
  // 色ピッカーの初期化
  initHairEyeAndAccWheels();
  initSkinTone();

  toast("無料版が初期化されました");
}

document.addEventListener('DOMContentLoaded', initAll);

/* ===== プロ版制限メッセージ ===== */
function showProOnlyMessage(featureName) {
  alert(`🔒 ${featureName}はプロ版限定機能です\n\nプロ版では以下の機能をご利用いただけます：\n• 単語モード - 辞書から自由選択\n• 撮影モード - 自由度の高い生成\n• 学習モード - LoRA用プロンプトセット\n• 量産モード - 大量プロンプト生成\n• 高度な設定 - クラウド保存等\n\nプロ版のご購入をご検討ください。`);
}

/* ===== Pro版限定機能の無効化 ===== */
function disableProFeatures() {
  // 制限されたタブをクリック不可にする
  const restrictedTabs = ['word', 'planner', 'learning', 'production', 'settings'];
  
  restrictedTabs.forEach(mode => {
    const tab = document.querySelector(`[data-mode="${mode}"]`);
    if (tab) {
      tab.style.cursor = 'not-allowed';
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showProOnlyMessage(tab.textContent.replace('🔒', '').trim());
        return false;
      }, true);
    }
  });
}

// 制限機能の初期化
document.addEventListener('DOMContentLoaded', disableProFeatures);
