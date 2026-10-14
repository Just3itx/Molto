"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";
const ICON_API = (prefix, names) => `https://api.iconify.design/${prefix}.json?icons=${names.join(",")}`;

// The same eight ideas, spelled the way each set names them
const SAMPLES = {
  lucide: ["moon", "house", "search", "settings", "heart", "bell", "user", "camera"],
  tabler: ["moon", "home", "search", "settings", "heart", "bell", "user", "camera"],
  heroicons: ["moon", "home", "magnifying-glass", "cog-6-tooth", "heart", "bell", "user", "camera"],
  phosphor: ["moon", "house", "magnifying-glass", "gear", "heart", "bell", "user", "camera"],
  fluent: ["weather-moon-24-regular", "home-24-regular", "search-24-regular", "settings-24-regular", "heart-24-regular", "alert-24-regular", "person-24-regular", "camera-24-regular"],
};

const $ = (id) => document.getElementById(id);
const toastEl = $("toast");
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

$("loader-url").textContent = `"${LOADER_URL}"`;

$("copy-loader").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(`local Icons = loadstring(game:HttpGet("${LOADER_URL}"))()`);
    toast("Loader copied");
  } catch {
    toast("Copy failed, select the code below instead");
  }
});

//--// Provider stage \\--//
const stage = { providers: [], provider: null, name: null, icons: new Map() };

function svgFor(set, name) {
  const icon = set.icons[name];
  if (!icon) return "";
  const width = icon.width ?? set.width ?? 16;
  const height = icon.height ?? set.height ?? 16;
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${icon.body}</svg>`;
}

function renderCode() {
  $("code").innerHTML =
    `<span class="k">local</span> Icons = <span class="f">loadstring</span>(game:<span class="f">HttpGet</span>(<span class="s">"…/source.lua"</span>))()\n\n` +
    `Icons.<span class="f">SetProvider</span>(<span class="s">"${escapeHtml(stage.provider)}"</span>)\n` +
    `<span class="k">local</span> icon = Icons.<span class="f">GetAsset</span>(<span class="s">"${escapeHtml(stage.name)}"</span>)`;
}

async function loadSamples(id) {
  if (stage.icons.has(id)) return stage.icons.get(id);

  const info = stage.providers.find((provider) => provider.id === id);
  const promise = fetch(ICON_API(info.prefix, SAMPLES[id]))
    .then((response) => {
      if (!response.ok) throw new Error(response.status);
      return response.json();
    })
    .catch(() => null);

  stage.icons.set(id, promise);
  return promise;
}

async function showStage(id) {
  stage.provider = id;
  stage.name = SAMPLES[id][0];

  for (const tab of $("tabs").children) tab.setAttribute("aria-selected", String(tab.dataset.id === id));
  renderCode();

  const set = await loadSamples(id);
  if (stage.provider !== id) return;

  if (!set) {
    $("swatch").innerHTML = '<p class="muted" style="grid-column:1/-1;margin:12px">Previews need a connection to api.iconify.design.</p>';
    return;
  }

  $("swatch").innerHTML = SAMPLES[id]
    .map(
      (name, index) =>
        `<button type="button" role="option" style="--i:${index}" data-name="${name}" aria-selected="${name === stage.name}" title="${name}">${svgFor(set, name)}<span>${name}</span></button>`
    )
    .join("");
}

$("tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("button");
  if (tab && tab.dataset.id !== stage.provider) showStage(tab.dataset.id);
});

$("swatch").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  stage.name = button.dataset.name;
  for (const other of $("swatch").children) other.setAttribute("aria-selected", String(other === button));
  renderCode();
});

//--// Registry data \\--//
(async function start() {
  try {
    const response = await fetch("data/providers.json");
    if (!response.ok) throw new Error(response.status);
    const { providers, default: fallback } = await response.json();
    stage.providers = providers.filter((provider) => SAMPLES[provider.id]);

    const total = providers.reduce((sum, provider) => sum + provider.count, 0);
    $("count").textContent = `${total.toLocaleString()} icons across ${providers.length} providers`;
    $("count").hidden = false;

    $("tabs").innerHTML = stage.providers
      .map((provider) => `<button type="button" role="tab" data-id="${provider.id}" aria-selected="false">${escapeHtml(provider.label)}</button>`)
      .join("");
    if (stage.providers.length) showStage(stage.providers.some((p) => p.id === fallback) ? fallback : stage.providers[0].id);

    $("rows").innerHTML = providers
      .map(
        (provider) => `
      <li><a href="icons/#${encodeURIComponent(provider.id)}">
        <span class="name">${escapeHtml(provider.label)}</span>
        <span class="meta">${provider.count.toLocaleString()} icons</span>
        <span class="meta license">${escapeHtml(provider.license)}</span>
        <span class="tag-cell">${provider.font ? '<span class="tag">font</span>' : ""}</span>
        <span class="go" aria-hidden="true">→</span>
      </a></li>`
      )
      .join("");
  } catch (error) {
    console.error(error);
    $("rows").innerHTML = '<li class="muted" style="padding:16px 4px">Provider list unavailable. <a href="icons/">Browse the icons</a> directly.</li>';
  }
})();
