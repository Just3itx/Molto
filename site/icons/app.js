"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";
const SET_URL = (prefix) => `https://cdn.jsdelivr.net/gh/iconify/icon-sets@master/json/${prefix}.json`;
const CHUNK = 400;
const SPRITE_SIZE = 24;

const $ = (id) => document.getElementById(id);
const el = {
  providers: $("providers"), grid: $("grid"), status: $("status"), sentinel: $("sentinel"), search: $("search"),
  color: $("color"), colorReset: $("color-reset"), stroke: $("stroke"), strokeOut: $("stroke-out"), strokeTool: $("stroke-tool"),
  detail: $("detail"), dName: $("d-name"), dPreview: $("d-preview"), dHint: $("d-hint"), dSize: $("d-size"),
  dSizeNum: $("d-size-num"), dAliases: $("d-aliases"), dTabs: $("d-tabs"), dCode: $("d-code"), dMeta: $("d-meta"),
  toast: $("toast"),
};

const state = {
  providers: [],
  provider: null,
  data: null, // { info, names, aliasesOf, set }
  results: [],
  shown: 0,
  query: "",
  color: null, // null = follow the page text color
  stroke: null, // null = icon default
  size: 32,
  selected: null,
  tab: "image",
};

const cache = new Map();

//--// Helpers \\--//
function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1600);
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  toast(message);
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

//--// Iconify icons (port of build.luau ResolveIcon/BuildSvg) \\--//
function resolveIcon(set, name, seen = new Set()) {
  const icon = set.icons[name];
  if (icon) {
    return {
      body: icon.body,
      width: icon.width ?? set.width ?? 16,
      height: icon.height ?? set.height ?? 16,
      rotate: icon.rotate ?? 0,
      hFlip: !!icon.hFlip,
      vFlip: !!icon.vFlip,
    };
  }

  const alias = set.aliases?.[name];
  if (!alias || seen.has(name)) return null;
  seen.add(name);

  const parent = resolveIcon(set, alias.parent, seen);
  if (!parent) return null;

  return {
    body: parent.body,
    width: alias.width ?? parent.width,
    height: alias.height ?? parent.height,
    rotate: (parent.rotate + (alias.rotate ?? 0)) % 4,
    hFlip: parent.hFlip !== !!alias.hFlip,
    vFlip: parent.vFlip !== !!alias.vFlip,
  };
}

// Returns the inner svg markup (body with flips and rotation applied) plus a square viewBox
function iconParts(name) {
  const icon = resolveIcon(state.data.set, name);
  if (!icon) return null;

  const side = Math.max(icon.width, icon.height);
  const cx = icon.width / 2;
  const cy = icon.height / 2;
  let body = icon.body;

  if (icon.hFlip || icon.vFlip) {
    body = `<g transform="translate(${cx} ${cy}) scale(${icon.hFlip ? -1 : 1} ${icon.vFlip ? -1 : 1}) translate(${-cx} ${-cy})">${body}</g>`;
  }
  if (icon.rotate) {
    body = `<g transform="rotate(${icon.rotate * 90} ${cx} ${cy})">${body}</g>`;
  }

  return { body, viewBox: `${(icon.width - side) / 2} ${(icon.height - side) / 2} ${side} ${side}` };
}

function standaloneSvg(name, { size, color, stroke }) {
  const parts = iconParts(name);
  if (!parts) return "";

  let body = parts.body;
  if (color) body = body.replace(/currentColor/gi, color);
  if (stroke != null) body = body.replace(/stroke-width="[^"]*"/g, `stroke-width="${stroke}"`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${parts.viewBox}" width="${size}" height="${size}">${body}</svg>`;
}

function gridSvg(name) {
  const parts = iconParts(name);
  return parts ? `<svg viewBox="${parts.viewBox}" aria-hidden="true">${parts.body}</svg>` : "";
}

//--// Loading \\--//
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function loadProvider(id) {
  if (cache.has(id)) return cache.get(id);

  const info = state.providers.find((provider) => provider.id === id);
  const [index, set] = await Promise.all([fetchJson(`../data/${id}.json`), fetchJson(SET_URL(info.prefix))]);

  const aliasesOf = new Map();
  for (const [alias, target] of Object.entries(index.aliases ?? {})) {
    if (!aliasesOf.has(target)) aliasesOf.set(target, []);
    aliasesOf.get(target).push(alias);
  }

  // Only icons present in both the built registry and the downloaded set can be drawn
  const names = index.icons.filter((name) => set.icons[name] || set.aliases?.[name]);

  // Does this set draw with strokes? Decides whether the stroke slider is useful
  const sample = names.slice(0, 60).filter((name) => set.icons[name]?.body.includes("stroke-width")).length;
  const data = { info, names, aliasesOf, set, hasStroke: sample > 12 };

  cache.set(id, data);
  return data;
}

//--// Rendering \\--//
function renderProviders() {
  el.providers.innerHTML = state.providers
    .map(
      (provider) =>
        `<button class="pill" type="button" data-id="${provider.id}" aria-pressed="${provider.id === state.provider}">${escapeHtml(provider.label)} <small>${provider.count.toLocaleString()}</small></button>`
    )
    .join("");
}

function setStatus(html) {
  el.status.innerHTML = html;
}

function filterResults() {
  const query = state.query.trim().toLowerCase();
  const { names, aliasesOf } = state.data;

  if (!query) return names;

  const terms = query.split(/\s+/);
  const exact = [];
  const rest = [];
  for (const name of names) {
    const haystack = [name, ...(aliasesOf.get(name) ?? [])].join(" ");
    if (!terms.every((term) => haystack.includes(term))) continue;
    (name === query || name.startsWith(query) ? exact : rest).push(name);
  }
  return exact.concat(rest);
}

function renderChunk() {
  const slice = state.results.slice(state.shown, state.shown + CHUNK);
  const html = slice
    .map(
      (name) =>
        `<button class="cell" type="button" data-name="${name}" aria-pressed="${name === state.selected}" title="${name}">${gridSvg(name)}<span>${name}</span></button>`
    )
    .join("");
  el.grid.insertAdjacentHTML("beforeend", html);
  state.shown += slice.length;
}

function renderGrid() {
  state.results = filterResults();
  state.shown = 0;
  el.grid.innerHTML = "";
  renderChunk();

  const total = state.data.names.length;
  setStatus(
    state.results.length
      ? `${state.results.length.toLocaleString()} of ${total.toLocaleString()} icons`
      : `No icons match "${escapeHtml(state.query)}"`
  );
}

function applyGridStyle() {
  el.grid.style.setProperty("--icon-color", state.color ?? "currentColor");
  el.grid.style.setProperty("--sw", state.stroke ?? 2);
  el.grid.classList.toggle("sw-on", state.stroke != null);
  el.strokeOut.textContent = state.stroke ?? "default";
}

//--// Detail panel \\--//
function luaFor(name) {
  const { info } = state.data;
  const rgb = state.color ? hexToRgb(state.color) : [255, 255, 255];
  const header = `local Icons = loadstring(game:HttpGet("${LOADER_URL}"))()\nIcons.SetProvider("${info.id}")\n\nlocal icon = Icons.GetAsset("${name}")`;

  if (state.tab === "font") {
    return `${header}\n\nlocal label = Instance.new("TextLabel")\nlabel.BackgroundTransparency = 1\nlabel.Size = UDim2.fromOffset(${state.size}, ${state.size})\nlabel.TextSize = ${state.size}\nlabel.TextColor3 = Color3.fromRGB(${rgb.join(", ")})\nlabel.FontFace = icon.FontFace -- nil when the executor can't load fonts\nlabel.Text = icon.Text`;
  }

  return `${header}\n\nlocal image = Instance.new("ImageLabel")\nimage.BackgroundTransparency = 1\nimage.Size = UDim2.fromOffset(${state.size}, ${state.size})\nimage.ImageColor3 = Color3.fromRGB(${rgb.join(", ")})\nimage.Image = icon.Url\nimage.ImageRectSize = icon.ImageRectSize\nimage.ImageRectOffset = icon.ImageRectOffset`;
}

function codeFor(name) {
  if (state.tab === "svg") return standaloneSvg(name, { size: state.size, color: state.color, stroke: state.stroke });
  return luaFor(name);
}

function renderTabs() {
  const tabs = [
    ["image", "ImageLabel"],
    ...(state.data.info.font ? [["font", "TextLabel (font)"]] : []),
    ["svg", "SVG"],
  ];
  if (!tabs.some(([id]) => id === state.tab)) state.tab = "image";

  el.dTabs.innerHTML = tabs
    .map(([id, label]) => `<button class="tab" type="button" role="tab" data-tab="${id}" aria-selected="${id === state.tab}">${label}</button>`)
    .join("");
}

function renderDetail() {
  const name = state.selected;
  if (!name || !state.data) {
    el.detail.hidden = true;
    return;
  }

  el.detail.hidden = false;
  el.dName.textContent = name;
  el.dPreview.style.color = state.color ?? "var(--text)";
  el.dPreview.innerHTML = standaloneSvg(name, { size: state.size, color: null, stroke: state.stroke });
  el.dHint.hidden = state.size <= SPRITE_SIZE;

  const aliases = state.data.aliasesOf.get(name) ?? [];
  el.dAliases.hidden = !aliases.length;
  el.dAliases.innerHTML = aliases.map((alias) => `<span>${escapeHtml(alias)}</span>`).join("");

  const { info } = state.data;
  el.dMeta.textContent = `${info.label} · ${info.license} license`;

  renderTabs();
  el.dCode.textContent = codeFor(name);
}

function select(name) {
  const previous = el.grid.querySelector('.cell[aria-pressed="true"]');
  previous?.setAttribute("aria-pressed", "false");

  state.selected = name;
  el.grid.querySelector(`.cell[data-name="${CSS.escape(name ?? "")}"]`)?.setAttribute("aria-pressed", "true");
  renderDetail();
  syncHash();
}

//--// Routing \\--//
function syncHash() {
  const path = state.selected ? `${state.provider}/${state.selected}` : state.provider;
  const query = state.query ? `?q=${encodeURIComponent(state.query)}` : "";
  history.replaceState(null, "", `#${path}${query}`);
}

function parseHash() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  const [provider, name] = path.split("/");
  return { provider, name, query: new URLSearchParams(query).get("q") ?? "" };
}

async function showProvider(id, { name = null, query = "" } = {}) {
  state.provider = id;
  state.selected = null;
  state.query = query;
  el.search.value = query;
  renderProviders();
  renderDetail();
  el.grid.innerHTML = "";
  setStatus("Loading icons…");

  try {
    const data = await loadProvider(id);
    if (state.provider !== id) return; // user switched again while loading

    state.data = data;
    el.strokeTool.hidden = !data.hasStroke;
    renderGrid();
    applyGridStyle();
    if (name && data.names.includes(name)) select(name);
    else syncHash();
  } catch (error) {
    if (state.provider !== id) return;
    console.error(error);
    setStatus(`Could not load this icon set. <button type="button" id="retry">Retry</button>`);
    $("retry").addEventListener("click", () => showProvider(id, { name, query }));
  }
}

//--// Events \\--//
el.providers.addEventListener("click", (event) => {
  const pill = event.target.closest(".pill");
  if (pill && pill.dataset.id !== state.provider) showProvider(pill.dataset.id);
});

el.grid.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (cell) select(cell.dataset.name);
});

new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && state.data && state.shown < state.results.length) renderChunk();
  },
  { rootMargin: "800px" }
).observe(el.sentinel);

let searchTimer;
el.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (!state.data) return;
    state.query = el.search.value;
    renderGrid();
    syncHash();
  }, 90);
});

el.color.addEventListener("input", () => {
  state.color = el.color.value;
  applyGridStyle();
  renderDetail();
});

el.colorReset.addEventListener("click", () => {
  state.color = null;
  applyGridStyle();
  renderDetail();
});

el.stroke.addEventListener("input", () => {
  state.stroke = Number(el.stroke.value);
  applyGridStyle();
  renderDetail();
});

function setSize(value) {
  state.size = Math.min(512, Math.max(12, Math.round(Number(value) || 32)));
  el.dSize.value = Math.min(128, state.size);
  el.dSizeNum.value = state.size;
  renderDetail();
}
el.dSize.addEventListener("input", () => setSize(el.dSize.value));
el.dSizeNum.addEventListener("change", () => setSize(el.dSizeNum.value));

$("d-close").addEventListener("click", () => select(null));

el.dTabs.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (!tab) return;
  state.tab = tab.dataset.tab;
  renderDetail();
});

function currentSvg() {
  // Downloads need a concrete color, and viewers default to black, so "auto" stays currentColor
  return standaloneSvg(state.selected, { size: state.size, color: state.color, stroke: state.stroke });
}

$("a-lua").addEventListener("click", () => {
  const tab = state.tab;
  state.tab = tab === "svg" ? "image" : tab;
  copy(luaFor(state.selected), "Lua copied");
  state.tab = tab;
});
$("a-name").addEventListener("click", () => copy(state.selected, "Name copied"));
$("a-svg").addEventListener("click", () => copy(currentSvg(), "SVG copied"));
$("a-dl-svg").addEventListener("click", () => {
  download(`${state.selected}.svg`, new Blob([currentSvg()], { type: "image/svg+xml" }));
});
$("a-dl-png").addEventListener("click", () => {
  const svg = standaloneSvg(state.selected, { size: state.size, color: state.color ?? "#000000", stroke: state.stroke });
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = state.size;
    canvas.getContext("2d").drawImage(image, 0, 0, state.size, state.size);
    canvas.toBlob((blob) => download(`${state.selected}.png`, blob));
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});

document.addEventListener("keydown", (event) => {
  const typing = event.target.matches("input, textarea");
  if (event.key === "/" && !typing) {
    event.preventDefault();
    el.search.focus();
    el.search.select();
  } else if (event.key === "Escape") {
    if (typing && el.search.value && event.target === el.search) {
      el.search.value = "";
      el.search.dispatchEvent(new Event("input"));
    } else if (state.selected) {
      select(null);
    }
  }
});

window.addEventListener("hashchange", () => {
  const { provider, name, query } = parseHash();
  if (!provider || !state.providers.some((p) => p.id === provider)) return;
  if (provider === state.provider && state.data) {
    if (query !== state.query) {
      state.query = query;
      el.search.value = query;
      renderGrid();
    }
    if (name !== state.selected) select(name ?? null);
  } else {
    showProvider(provider, { name, query });
  }
});

//--// Start \\--//
(async function start() {
  try {
    const registry = await fetchJson("../data/providers.json");
    state.providers = registry.providers;

    const route = parseHash();
    const initial = state.providers.some((p) => p.id === route.provider) ? route.provider : registry.default;
    el.dSizeNum.value = state.size;
    await showProvider(initial, route.provider === initial ? route : {});
  } catch (error) {
    console.error(error);
    setStatus("Could not load the provider list. Run the build to generate site/data.");
  }
})();
