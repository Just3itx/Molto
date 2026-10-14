"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// The moon icon of each set (Iconify JSON, same data the registry is built from), so the diagram never waits on a request
const MOONS = {"lucide":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>"},"tabler":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z\"/>"},"heroicons":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M21.752 15.002A9.7 9.7 0 0 1 18 15.75A9.75 9.75 0 0 1 8.25 6c0-1.33.266-2.597.748-3.752A9.75 9.75 0 0 0 3 11.25A9.75 9.75 0 0 0 12.75 21a9.75 9.75 0 0 0 9.002-5.998\"/>"},"ph":{"name":"moon","w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"M233.54 142.23a8 8 0 0 0-8-2a88.08 88.08 0 0 1-109.8-109.8a8 8 0 0 0-10-10a104.84 104.84 0 0 0-52.91 37A104 104 0 0 0 136 224a103.1 103.1 0 0 0 62.52-20.88a104.84 104.84 0 0 0 37-52.91a8 8 0 0 0-1.98-7.98m-44.64 48.11A88 88 0 0 1 65.66 67.11a89 89 0 0 1 31.4-26A106 106 0 0 0 96 56a104.11 104.11 0 0 0 104 104a106 106 0 0 0 14.92-1.06a89 89 0 0 1-26.02 31.4\"/>"},"fluent":{"name":"weather-moon-24-regular","w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"M20.026 17.001c-2.762 4.784-8.879 6.423-13.663 3.661A10 10 0 0 1 3.13 17.68a.75.75 0 0 1 .365-1.132c3.767-1.348 5.785-2.91 6.956-5.146c1.233-2.353 1.551-4.93.689-8.463a.75.75 0 0 1 .769-.927a9.96 9.96 0 0 1 4.457 1.327c4.784 2.762 6.423 8.879 3.66 13.662m-8.247-4.903c-1.252 2.389-3.312 4.1-6.818 5.499a8.5 8.5 0 0 0 2.152 1.766a8.502 8.502 0 0 0 8.502-14.725a8.5 8.5 0 0 0-2.792-1.015c.647 3.384.23 6.043-1.045 8.475\"/>"}};
const ORDER = ["lucide", "tabler", "heroicons", "ph", "fluent"];
const LABELS = { lucide: "Lucide", tabler: "Tabler", heroicons: "Heroicons", ph: "Phosphor", fluent: "Fluent UI" };
const IDS = { ph: "phosphor" };
const NS = "http://www.w3.org/2000/svg";

//--// Toast \--//
const toastEl = $("toast");
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1800);
}

$("copy").addEventListener("click", async () => {
  const text = `local Icons = loadstring(game:HttpGet("${LOADER_URL}"))()\nIcons.SetProvider("lucide")\n\nlocal icon = Icons.GetAsset("moon")`;
  try {
    await navigator.clipboard.writeText(text);
    toast("Loader copied");
  } catch {
    toast("Copy blocked by the browser");
  }
});

//--// ASCII moon \--//
// The moon photo, sampled to a grid and dithered with a Bayer matrix so the maria and craters read in characters.
(function ascii() {
  const out = $("ascii");
  const COLS = 120, ROWS = 72;
  const RAMP = " .,:;ox%#@";
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const image = new Image();
  image.src = "assets/moon-photo.webp";
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = COLS;
    canvas.height = ROWS;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, COLS, ROWS);
    const pixels = ctx.getImageData(0, 0, COLS, ROWS).data;
    const lines = [];
    for (let y = 0; y < ROWS; y++) {
      let line = "";
      for (let x = 0; x < COLS; x++) {
        const i = (y * COLS + x) * 4;
        let light = (0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]) / 255;
        light = Math.min(1, Math.max(0, (light - 0.06) * 1.35));
        const level = light * (RAMP.length - 1) + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.9;
        line += RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(level)))];
      }
      lines.push(line);
    }
    if (REDUCED) {
      out.textContent = lines.join("\n");
      return;
    }
    // Reveal row by row from the top, like a scan
    let shown = 0;
    const tick = () => {
      shown = Math.min(ROWS, shown + 2);
      out.textContent = lines.slice(0, shown).join("\n");
      if (shown < ROWS) requestAnimationFrame(tick);
    };
    tick();
  };
})();

//--// Beam diagram \--//
const svg = $("beam-svg");
const el = (name, attrs = {}, parent = svg) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent.appendChild(node);
  return node;
};
const glyph = (parent, key, cx, cy, size) => {
  const moon = MOONS[key];
  const g = el("svg", { x: cx - size / 2, y: cy - size / 2, width: size, height: size, viewBox: `0 0 ${moon.w} ${moon.h}`, class: "glyph" }, parent);
  g.innerHTML = moon.body;
};

const defs = el("defs");
const grad = el("linearGradient", { id: "beamgrad", gradientUnits: "userSpaceOnUse", x1: 0, x2: 800, y1: 0, y2: 0 }, defs);
el("stop", { offset: "0", "stop-color": "#ff5a1f" }, grad);
el("stop", { offset: "1", "stop-color": "#ffd2ad" }, grad);

const HUB = { x: 400, y: 215 };
const SPOTS = [
  { x: 90, y: 50 }, { x: 90, y: 215 }, { x: 90, y: 380 },
  { x: 710, y: 130 }, { x: 710, y: 300 },
];
const counts = {};
const on = new Set(ORDER);
const totalEl = $("total");
let shownTotal = 0;
let raf;

function animateTotal() {
  const target = [...on].reduce((sum, key) => sum + (counts[key] || 0), 0);
  cancelAnimationFrame(raf);
  const from = shownTotal;
  const start = performance.now();
  const step = (now) => {
    const t = REDUCED ? 1 : Math.min(1, (now - start) / 500);
    shownTotal = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
    totalEl.textContent = shownTotal.toLocaleString();
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

const tracks = [];
ORDER.forEach((key, i) => {
  const s = SPOTS[i];
  const left = s.x < HUB.x;
  const from = { x: s.x + (left ? 44 : -44), y: s.y };
  const to = { x: HUB.x + (left ? -50 : 50), y: HUB.y + (s.y - HUB.y) * 0.25 };
  const mid = (from.x + to.x) / 2;
  const d = `M${from.x} ${from.y} C${mid} ${from.y} ${mid} ${to.y} ${to.x} ${to.y}`;
  const group = el("g", { class: "path" });
  el("path", { d, class: "track" }, group);
  const pulse = el("path", { d, class: "pulse", style: `animation-delay:${-i * 0.6}s` }, group);
  tracks[i] = pulse;
});

const hub = el("g", { class: "hub" });
el("circle", { cx: HUB.x, cy: HUB.y, r: 58 }, hub);
glyph(hub, "lucide", HUB.x, HUB.y, 56);
el("text", { x: HUB.x, y: HUB.y + 92, "text-anchor": "middle", fill: "currentColor", style: "fill:#f6e9df;font:700 22px 'Libre Franklin',sans-serif" }, hub).textContent = "Molto";

ORDER.forEach((key, i) => {
  const s = SPOTS[i];
  const node = el("g", { class: "node", role: "button", tabindex: 0, "aria-pressed": "true", "aria-label": LABELS[key] });
  el("circle", { cx: s.x, cy: s.y, r: 44 }, node);
  glyph(node, key, s.x, s.y, 40);
  el("text", { x: s.x, y: s.y + 72 }, node).textContent = LABELS[key];
  node.count = el("text", { x: s.x, y: s.y + 94, class: "n" }, node);
  node.count.textContent = "";
  const toggle = () => {
    const state = !on.has(key);
    state ? on.add(key) : on.delete(key);
    node.setAttribute("aria-pressed", String(state));
    tracks[i].style.opacity = state ? 1 : 0;
    animateTotal();
  };
  node.addEventListener("click", toggle);
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
  });
  node.dataset.key = key;
});

(async () => {
  try {
    const response = await fetch("data/providers.json");
    const { providers } = await response.json();
    for (const p of providers) {
      const key = p.id === "phosphor" ? "ph" : p.id;
      counts[key] = p.count;
      const node = svg.querySelector(`.node[data-key="${key}"]`);
      if (node) node.count.textContent = `${p.count.toLocaleString()} icons`;
    }
    animateTotal();
  } catch {
    totalEl.textContent = "9,500+";
  }
})();

//--// Entrance \--//
const targets = document.querySelectorAll(".hero-copy > *, .load h2, .beam");
targets.forEach((node, i) => { node.classList.add("rise"); node.style.setProperty("--i", i % 4); });
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
}, { threshold: 0.15 });
targets.forEach((node) => io.observe(node));
