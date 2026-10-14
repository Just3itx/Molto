"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";
const SET_URL = (prefix) => `https://cdn.jsdelivr.net/gh/iconify/icon-sets@master/json/${prefix}.json`;
const CHUNK = 500;
const SPRITE_SIZE = 24;
const DEFAULTS = { color: null, stroke: null, size: 24, nss: false };

const $ = (id) => document.getElementById(id);
const el = {
  providers: $("providers"), grid: $("grid"), status: $("status"), sentinel: $("sentinel"), search: $("search"), sort: $("sort"), kbd: $("kbd"),
  color: $("color"), colorText: $("color-text"), stroke: $("stroke"), strokeOut: $("stroke-out"), strokeCtl: $("stroke-ctl"),
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
  const [index, set] = await Promise.all([fetchJson(`../data/${id}.json`), fetchJson(SET_URL(info.prefix))]);

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
  grid.style.setProperty("--sw", state.stroke ?? 2);
  grid.classList.toggle("sw-on", state.stroke != null);
  grid.classList.toggle("nss", state.nss);

  el.strokeOut.textContent = `${state.stroke ?? 2}px`;
  el.sizeOut.textContent = `${state.size}px`;
  el.stroke.value = state.stroke ?? 2;
  el.size.value = state.size;
  el.nss.checked = state.nss;
  el.colorText.value = state.color ?? "";
  if (state.color) el.color.value = state.color;

  el.strokeCtl.hidden = el.nssCtl.hidden = !state.data?.hasStroke;
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
}

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
function luaFor(name, kind) {
  const { info } = state.data;
  const rgb = state.color ? hexToRgb(state.color) : [255, 255, 255];
  const header = `local Icons = loadstring(game:HttpGet("${LOADER_URL}"))()\nIcons.SetProvider("${info.id}")\n\nlocal icon = Icons.GetAsset("${name}")`;

  if (kind === "font") {
    return `${header}\n\nlocal label = Instance.new("TextLabel")\nlabel.BackgroundTransparency = 1\nlabel.Size = UDim2.fromOffset(${state.size}, ${state.size})\nlabel.TextSize = ${Math.min(100, state.size)}\nlabel.TextColor3 = Color3.fromRGB(${rgb.join(", ")})\nlabel.FontFace = icon.FontFace -- nil when the executor can't load fonts\nlabel.Text = icon.Text`;
  }

  return `${header}\n\nlocal image = Instance.new("ImageLabel")\nimage.BackgroundTransparency = 1\nimage.Size = UDim2.fromOffset(${state.size}, ${state.size})\nimage.ImageColor3 = Color3.fromRGB(${rgb.join(", ")})\nimage.Image = icon.Url\nimage.ImageRectSize = icon.ImageRectSize\nimage.ImageRectOffset = icon.ImageRectOffset`;
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
  el.dPreview.style.setProperty("--sw", state.stroke ?? 2);
  el.dPreview.classList.toggle("sw-on", state.stroke != null);
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
      return runAction(state.data.info.font ? "lua-font" : "lua-image");
    case "lua-image":
      return copy(luaFor(name, "image"), "Lua copied");
    case "lua-font":
      return copy(luaFor(name, "font"), "Font Lua copied");
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

el.stroke.addEventListener("input", () => {
  state.stroke = Number(el.stroke.value);
  applyCustomizer();
});
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
