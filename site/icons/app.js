"use strict";

const LOADER_URL = "https://molto.pages.dev/source.lua";
const SET_URL = (id) => `../data/${id}.set.json`;
const CHUNK = 500;
const SPRITE_SIZE = 24;
const DEFAULTS = { color: null, stroke: null, size: 24, nss: false };

const $ = (id) => document.getElementById(id);
const el = {
  providers: $("providers"), grid: $("grid"), status: $("status"), sentinel: $("sentinel"), search: $("search"), sort: $("sort"), kbd: $("kbd"),
  color: $("color"), colorText: $("color-text"),
  size: $("size"), sizeOut: $("size-out"), nss: $("nss"), nssCtl: $("nss-ctl"), reset: $("reset"),
  drawer: $("drawer"), dPreview: $("d-preview"), dName: $("d-name"), dMeta: $("d-meta"), dAliases: $("d-aliases"), dHint: $("d-hint"),
  miFont: $("mi-font"), toast: $("toast"),
};

const state = {
  providers: [],
  provider: null,
  data: null, // { info, names, aliasesOf, set, hasStroke }
  results: [],
  shown: 0,
  query: "",
  sort: "az",
  selected: null,
  ...DEFAULTS,
};

const cache = new Map();

//--// Helpers \\--//
function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
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

function normalizeHex(text) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return `#${hex}`;
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

// Inner svg markup (flips and rotation applied) plus a square viewBox
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

function standaloneSvg(name, { size, color, stroke, nss }) {
  const parts = iconParts(name);
  if (!parts) return "";

  let body = parts.body;
  if (color) body = body.replace(/currentColor/gi, color);
  if (stroke != null) body = body.replace(/stroke-width="[^"]*"/g, `stroke-width="${stroke}"`);

  if (nss) body = body.replace(/<(path|circle|rect|line|polyline|polygon|ellipse)\b/g, '<$1 vector-effect="non-scaling-stroke"');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${parts.viewBox}" width="${size}" height="${size}">${body}</svg>`;
}

function inlineSvg(name) {
  const parts = iconParts(name);
  return parts ? `<svg viewBox="${parts.viewBox}" aria-hidden="true">${parts.body}</svg>` : "";
}

const currentOptions = () => ({ size: state.size, color: state.color, stroke: state.stroke, nss: state.nss });

//--// Loading \\--//
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function loadProvider(id) {
  if (cache.has(id)) return cache.get(id);

  const info = state.providers.find((provider) => provider.id === id);
  const [index, set] = await Promise.all([fetchJson(`../data/${id}.json`), fetchJson(SET_URL(info.id))]);

  const aliasesOf = new Map();
  for (const [alias, target] of Object.entries(index.aliases ?? {})) {
    if (!aliasesOf.has(target)) aliasesOf.set(target, []);
    aliasesOf.get(target).push(alias);
  }

  // Only icons present in both the built registry and the downloaded set can be drawn
  const names = index.icons.filter((name) => set.icons[name] || set.aliases?.[name]);

  // Does this set draw with strokes? Decides whether the stroke controls are useful
  const sample = names.slice(0, 60).filter((name) => set.icons[name]?.body.includes("stroke-width")).length;
  const data = { info, names, aliasesOf, set, hasStroke: sample > 12 };

  cache.set(id, data);
  return data;
}

//--// Customizer \\--//
function applyCustomizer() {
  const grid = el.grid;
  grid.style.setProperty("--icon-color", state.color ?? "var(--text)");
  grid.style.setProperty("--icon-size", `${state.size}px`);
  grid.classList.toggle("nss", state.nss);

  el.sizeOut.textContent = `${state.size}px`;
  el.size.value = state.size;
  el.nss.checked = state.nss;
  el.colorText.value = state.color ?? "";
  if (state.color) el.color.value = state.color;

  el.nssCtl.hidden = !state.data?.hasStroke;
  renderDrawer();
}

//--// Rendering \\--//
function renderProviders() {
  el.providers.innerHTML = state.providers
    .map(
      (provider) =>
        `<li><button type="button" data-id="${provider.id}" aria-current="${provider.id === state.provider}">${escapeHtml(provider.label)}<small>${provider.count.toLocaleString()}</small></button></li>`
    )
    .join("");
}

function setStatus(html) {
  el.status.innerHTML = html;
}

function filterResults() {
  const query = state.query.trim().toLowerCase();
  const { names, aliasesOf } = state.data;

  let results = names;
  if (query) {
    const terms = query.split(/\s+/);
    const exact = [];
    const rest = [];
    for (const name of names) {
      const haystack = [name, ...(aliasesOf.get(name) ?? [])].join(" ");
      if (!terms.every((term) => haystack.includes(term))) continue;
      (name === query || name.startsWith(query) ? exact : rest).push(name);
    }
    results = exact.concat(rest);
  }

  if (state.sort === "za") return [...results].sort().reverse();
  if (state.sort === "short") return [...results].sort((a, b) => a.length - b.length || a.localeCompare(b));
  return query ? results : names;
}

function renderChunk() {
  const slice = state.results.slice(state.shown, state.shown + CHUNK);
  const html = slice
    .map(
      (name) =>
        `<button class="tile" type="button" role="option" data-name="${name}" aria-label="${name}" aria-selected="${name === state.selected}">${inlineSvg(name)}</button>`
    )
    .join("");
  el.grid.insertAdjacentHTML("beforeend", html);
  state.shown += slice.length;
  setTimeout(fillViewport, 30);
}

// The observer only fires when the sentinel enters view, so a wide screen that a chunk does not fill would stall. Keep loading until it is filled
function fillViewport() {
  if (!state.data || state.shown >= state.results.length) return;
  if (el.sentinel.getBoundingClientRect().top < window.innerHeight + 1200) renderChunk();
}
window.addEventListener("resize", fillViewport);

function renderGrid() {
  state.results = filterResults();
  state.shown = 0;
  el.grid.innerHTML = "";
  renderChunk();

  const total = state.data.names.length;
  setStatus(
    state.results.length
      ? state.query
        ? `${state.results.length.toLocaleString()} of ${total.toLocaleString()} icons`
        : ""
      : `No icons match "${escapeHtml(state.query)}"`
  );
  el.search.placeholder = `Search ${total.toLocaleString()} icons…`;
}

//--// Lua snippets \\--//
const CODE_DEFAULTS = { load: true, provider: true, preload: false, style: true, format: "auto", variable: "Icons" };
const codeEls = {
  load: $("cg-load"), provider: $("cg-provider"), preload: $("cg-preload"), style: $("cg-style"),
  format: $("cg-format"), variable: $("cg-var"), reset: $("cg-reset"),
};
const code = { ...CODE_DEFAULTS };
try {
  Object.assign(code, JSON.parse(localStorage.getItem("molto-code") || "{}"));
} catch {}

function syncCodeControls() {
  for (const key of ["load", "provider", "preload", "style"]) codeEls[key].checked = code[key];
  codeEls.format.value = code.format;
  codeEls.variable.value = code.variable;
}
function saveCode() {
  try {
    localStorage.setItem("molto-code", JSON.stringify(code));
  } catch {}
}
for (const key of ["load", "provider", "preload", "style"]) {
  codeEls[key].addEventListener("change", () => { code[key] = codeEls[key].checked; saveCode(); });
}
codeEls.format.addEventListener("change", () => { code.format = codeEls.format.value; saveCode(); });
codeEls.variable.addEventListener("input", () => {
  const value = codeEls.variable.value.trim();
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) { code.variable = value; saveCode(); }
});
codeEls.reset.addEventListener("click", () => {
  Object.assign(code, CODE_DEFAULTS);
  syncCodeControls();
  saveCode();
  toast("Code settings reset");
});
syncCodeControls();

function luaFor(name, kind) {
  const { info } = state.data;
  const rgb = state.color ? hexToRgb(state.color) : [255, 255, 255];
  const V = code.variable;
  // Without SetProvider the snippet names the provider on each call instead
  const via = code.provider ? "" : `, "${info.id}"`;
  const header = [];

  if (code.load) header.push(`local ${V} = loadstring(game:HttpGet("${LOADER_URL}"))()`);
  if (code.provider) header.push(`${V}.SetProvider("${info.id}")`);
  if (code.preload) header.push(`${V}.PreloadAsync({ "${name}" }${via})`);

  const lines = [];
  if (kind === "font") {
    lines.push(`local label = Instance.new("TextLabel")`, `label.BackgroundTransparency = 1`);
    if (code.style) {
      lines.push(`label.Size = UDim2.fromOffset(${state.size}, ${state.size})`, `label.TextSize = ${Math.min(100, state.size)}`, `label.TextColor3 = Color3.fromRGB(${rgb.join(", ")})`);
    }
    lines.push(`${V}.SetIcon(label, "${name}"${via})`);
  } else {
    lines.push(`local image = Instance.new("ImageLabel")`, `image.BackgroundTransparency = 1`);
    if (code.style) {
      lines.push(`image.Size = UDim2.fromOffset(${state.size}, ${state.size})`, `image.ImageColor3 = Color3.fromRGB(${rgb.join(", ")})`);
    }
    lines.push(`${V}.SetIcon(image, "${name}"${via})`);
  }

  return (header.length ? header.join("\n") + "\n\n" : "") + lines.join("\n");
}

//--// Drawer \\--//
function renderDrawer() {
  const name = state.selected;
  if (!name || !state.data) {
    el.drawer.hidden = true;
    return;
  }

  const { info, aliasesOf } = state.data;
  el.drawer.hidden = false;
  el.dName.textContent = name;
  el.dMeta.textContent = `${info.label} · ${info.license}`;

  el.dPreview.style.color = state.color ?? "var(--text)";
  el.dPreview.classList.toggle("nss", state.nss);
  el.dPreview.innerHTML = inlineSvg(name);

  const aliases = aliasesOf.get(name) ?? [];
  const shown = aliases.slice(0, 5);
  el.dAliases.innerHTML =
    shown.map((alias) => `<span>${escapeHtml(alias)}</span>`).join("") +
    (aliases.length > shown.length ? `<b>+${aliases.length - shown.length}</b>` : "");

  el.miFont.disabled = !info.font;
  el.dHint.hidden = info.font || state.size <= SPRITE_SIZE;
}

function select(name, { scroll = false } = {}) {
  el.grid.querySelector('.tile[aria-selected="true"]')?.setAttribute("aria-selected", "false");

  state.selected = name;
  const tile = name ? el.grid.querySelector(`.tile[data-name="${CSS.escape(name)}"]`) : null;
  tile?.setAttribute("aria-selected", "true");
  if (tile && scroll) tile.scrollIntoView({ block: "center" });

  closeMenus();
  renderDrawer();
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
  renderDrawer();
  el.grid.innerHTML = "";
  setStatus("Loading icons…");

  try {
    const data = await loadProvider(id);
    if (state.provider !== id) return; // user switched again while loading

    state.data = data;
    renderGrid();
    applyCustomizer();
    if (name && data.names.includes(name)) select(name, { scroll: true });
    else syncHash();
  } catch (error) {
    if (state.provider !== id) return;
    console.error(error);
    setStatus(`Could not load this icon set. <button type="button" id="retry">Retry</button>`);
    $("retry").addEventListener("click", () => showProvider(id, { name, query }));
  }
}

//--// Menus \\--//
function closeMenus() {
  for (const menu of document.querySelectorAll(".menu")) menu.hidden = true;
  for (const button of document.querySelectorAll("[data-menu]")) button.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-menu]");
  if (toggle) {
    const menu = $(toggle.dataset.menu);
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector("button:not([disabled])")?.focus();
    return;
  }

  const item = event.target.closest(".menu [data-act]");
  if (item) {
    runAction(item.dataset.act);
    closeMenus();
    return;
  }

  if (!event.target.closest(".menu")) closeMenus();
});

function runAction(action) {
  const name = state.selected;
  if (!name) return;
  const options = currentOptions();

  switch (action) {
    case "lua":
      // Fonts are crisp at any size, so they are the default whenever the provider has one
      if (code.format === "image") return runAction("lua-image");
      return runAction(state.data.info.font && code.format !== "image" ? "lua-font" : "lua-image");
    case "lua-image":
      return copy(luaFor(name, "image"), "Luau copied");
    case "lua-font":
      return copy(luaFor(name, "font"), "Font Luau copied");
    case "name":
      return copy(name, "Name copied");
    case "svg":
      return copy(standaloneSvg(name, options), "SVG copied");
    case "data-url":
      return copy(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(standaloneSvg(name, options))}`, "Data URL copied");
    case "dl-svg":
      return download(`${name}.svg`, new Blob([standaloneSvg(name, options)], { type: "image/svg+xml" }));
    case "dl-png": {
      // PNGs need a concrete color, and the "default" one is the page text color, so use white like Roblox does
      const size = Math.max(options.size, 128);
      const svg = standaloneSvg(name, { ...options, size, color: options.color ?? "#ffffff" });
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        canvas.getContext("2d").drawImage(image, 0, 0, size, size);
        canvas.toBlob((blob) => download(`${name}.png`, blob));
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      return;
    }
  }
}

$("b-lua").addEventListener("click", () => runAction("lua"));
$("b-svg").addEventListener("click", () => runAction("svg"));
$("d-close").addEventListener("click", () => select(null));

//--// Events \\--//
el.providers.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (button && button.dataset.id !== state.provider) showProvider(button.dataset.id);
});

el.grid.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");
  if (tile) select(tile.dataset.name === state.selected ? null : tile.dataset.name);
});

// Arrow keys move between tiles like a grid
el.grid.addEventListener("keydown", (event) => {
  const tile = event.target.closest(".tile");
  if (!tile || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;

  const tiles = [...el.grid.children];
  const index = tiles.indexOf(tile);
  const columns = getComputedStyle(el.grid).gridTemplateColumns.split(" ").length;
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
  const next = tiles[index + delta];
  if (!next) return;

  event.preventDefault();
  next.focus();
  if (index + delta >= tiles.length - columns && state.shown < state.results.length) renderChunk();
});

new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && state.data && state.shown < state.results.length) renderChunk();
  },
  { rootMargin: "1200px" }
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

el.sort.addEventListener("change", () => {
  state.sort = el.sort.value;
  if (state.data) renderGrid();
});

el.color.addEventListener("input", () => {
  state.color = el.color.value;
  applyCustomizer();
});
el.colorText.addEventListener("input", () => {
  const text = el.colorText.value.trim();
  if (!text) {
    state.color = null;
    el.grid.style.setProperty("--icon-color", "var(--text)");
    renderDrawer();
    return;
  }
  const hex = normalizeHex(text);
  if (!hex) return;
  state.color = hex;
  el.color.value = hex;
  el.grid.style.setProperty("--icon-color", hex);
  renderDrawer();
});
el.colorText.addEventListener("change", applyCustomizer);

el.size.addEventListener("input", () => {
  state.size = Number(el.size.value);
  applyCustomizer();
});
el.nss.addEventListener("change", () => {
  state.nss = el.nss.checked;
  applyCustomizer();
});
el.reset.addEventListener("click", () => {
  Object.assign(state, DEFAULTS);
  applyCustomizer();
  toast("Customizer reset");
});

document.addEventListener("keydown", (event) => {
  const typing = event.target.matches("input, textarea, select");
  const mod = event.metaKey || event.ctrlKey;

  if ((event.key === "/" && !typing) || (mod && event.key.toLowerCase() === "k")) {
    event.preventDefault();
    el.search.focus();
    el.search.select();
  } else if (event.key === "Escape") {
    if (document.querySelector(".menu:not([hidden])")) closeMenus();
    else if (event.target === el.search && el.search.value) {
      el.search.value = "";
      el.search.dispatchEvent(new Event("input"));
    } else if (state.selected) select(null);
  }
});

el.kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

window.addEventListener("hashchange", () => {
  const { provider, name, query } = parseHash();
  if (!provider || !state.providers.some((p) => p.id === provider)) return;
  if (provider === state.provider && state.data) {
    if (query !== state.query) {
      state.query = query;
      el.search.value = query;
      renderGrid();
    }
    if ((name ?? null) !== state.selected) select(name ?? null);
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
    applyCustomizer();
    await showProvider(initial, route.provider === initial ? route : {});
  } catch (error) {
    console.error(error);
    setStatus("Could not load the provider list. Run the build to generate site/data.");
  }
})();
