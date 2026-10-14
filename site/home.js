"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// The moon icon of each set (Iconify JSON, same data the registry is built from), so the hero never waits on a request
const MOONS = {"lucide":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>"},"tabler":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z\"/>"},"heroicons":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M21.752 15.002A9.7 9.7 0 0 1 18 15.75A9.75 9.75 0 0 1 8.25 6c0-1.33.266-2.597.748-3.752A9.75 9.75 0 0 0 3 11.25A9.75 9.75 0 0 0 12.75 21a9.75 9.75 0 0 0 9.002-5.998\"/>"},"ph":{"name":"moon","w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"M233.54 142.23a8 8 0 0 0-8-2a88.08 88.08 0 0 1-109.8-109.8a8 8 0 0 0-10-10a104.84 104.84 0 0 0-52.91 37A104 104 0 0 0 136 224a103.1 103.1 0 0 0 62.52-20.88a104.84 104.84 0 0 0 37-52.91a8 8 0 0 0-1.98-7.98m-44.64 48.11A88 88 0 0 1 65.66 67.11a89 89 0 0 1 31.4-26A106 106 0 0 0 96 56a104.11 104.11 0 0 0 104 104a106 106 0 0 0 14.92-1.06a89 89 0 0 1-26.02 31.4\"/>"},"fluent":{"name":"weather-moon-24-regular","w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"M20.026 17.001c-2.762 4.784-8.879 6.423-13.663 3.661A10 10 0 0 1 3.13 17.68a.75.75 0 0 1 .365-1.132c3.767-1.348 5.785-2.91 6.956-5.146c1.233-2.353 1.551-4.93.689-8.463a.75.75 0 0 1 .769-.927a9.96 9.96 0 0 1 4.457 1.327c4.784 2.762 6.423 8.879 3.66 13.662m-8.247-4.903c-1.252 2.389-3.312 4.1-6.818 5.499a8.5 8.5 0 0 0 2.152 1.766a8.502 8.502 0 0 0 8.502-14.725a8.5 8.5 0 0 0-2.792-1.015c.647 3.384.23 6.043-1.045 8.475\"/>"}};
const ORDER = ["lucide", "tabler", "heroicons", "ph", "fluent"];
const PROVIDER_IDS = { lucide: "lucide", tabler: "tabler", heroicons: "heroicons", ph: "phosphor", fluent: "fluent" };

//--// Toast \--//
const toastEl = $("toast");
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1700);
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

//--// Hero moon \--//
const moonSvg = $("moon-svg");
const readout = $("readout");
const setButtons = [...document.querySelectorAll("#sets button")];
let current = "lucide";
let cycle = null;

function showMoon(key, { animate = true } = {}) {
  const moon = MOONS[key];
  current = key;

  moonSvg.setAttribute("viewBox", `0 0 ${moon.w} ${moon.h}`);
  moonSvg.innerHTML = moon.body;
  if (animate && !REDUCED) {
    moonSvg.classList.remove("swap");
    void moonSvg.getBoundingClientRect();
    moonSvg.classList.add("swap");
  }

  for (const button of setButtons) button.setAttribute("aria-pressed", String(button.dataset.set === key));
  readout.textContent = `Icons.SetProvider("${PROVIDER_IDS[key]}")\nIcons.GetAsset("${moon.name}")`;
}

function stopCycle() {
  clearInterval(cycle);
  cycle = null;
}

$("sets").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  stopCycle();
  showMoon(button.dataset.set);
});

if (!REDUCED) {
  // Walk through the five sets until the visitor takes over
  cycle = setInterval(() => showMoon(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]), 3400);
}

//--// Entrances \--//
const riseTargets = [
  ".field", ".sw-text", ".statement", ".discs li", ".providers h2", ".table li", ".arch", ".ask", ".chips", ".figure", ".how",
  ".start-copy > *", ".dialog", ".foot-grid > *", ".blocks span",
];
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
);

for (const selector of riseTargets) {
  document.querySelectorAll(selector).forEach((node, index) => {
    node.classList.add("rise");
    node.style.setProperty("--d", index % 6);
    observer.observe(node);
  });
}
document.querySelectorAll(".hero-copy > *").forEach((node, index) => node.style.setProperty("--d", index));

//--// Switches \--//
for (const toggle of document.querySelectorAll(".toggle")) {
  toggle.addEventListener("click", () => {
    const on = toggle.getAttribute("aria-checked") !== "true";
    toggle.setAttribute("aria-checked", String(on));
    toggle.closest(".sw").classList.toggle("on", on);
  });
}

//--// Reach figure \--//
const figure = $("figure");
let shown = Number(figure.textContent.replace(/,/g, ""));
let frame;

function tween(to) {
  cancelAnimationFrame(frame);
  if (REDUCED) {
    shown = to;
    figure.textContent = to.toLocaleString("en-US");
    return;
  }

  const from = shown;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 520);
    shown = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
    figure.textContent = shown.toLocaleString("en-US");
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}

$("chips").addEventListener("click", (event) => {
  const chip = event.target.closest("button");
  if (!chip) return;
  chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
  const total = [...document.querySelectorAll("#chips button[aria-pressed='true']")].reduce((sum, c) => sum + Number(c.dataset.count), 0);
  tween(total);
});

//--// Loader dialog \--//
$("dialog").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("name").value.trim() || "moon";
  const provider = document.querySelector("#seg input:checked").value;
  copy(
    `local Icons = loadstring(game:HttpGet("${LOADER_URL}"))()\nIcons.SetProvider("${provider}")\n\nlocal icon = Icons.GetAsset(${JSON.stringify(name)})`,
    "Lua copied"
  );
});

//--// The rotating moon plays only while visible \--//
const video = $("rotation");
if (video && !REDUCED) {
  new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    }
  }).observe(video);
}

//--// Live provider numbers \--//
(async function refreshProviders() {
  try {
    const response = await fetch("data/providers.json");
    if (!response.ok) return;
    const { providers } = await response.json();
    const byId = Object.fromEntries(providers.map((provider) => [provider.id, provider]));

    for (const link of document.querySelectorAll("#rows a")) {
      const id = link.getAttribute("href").split("#")[1];
      const provider = byId[id];
      if (!provider) continue;
      link.querySelector(".kind").textContent = provider.license;
      link.querySelector(".who").textContent = provider.label;
      link.querySelector(".num").firstChild.textContent = provider.count.toLocaleString("en-US");
    }

    for (const chip of document.querySelectorAll("#chips button")) {
      const provider = Object.values(byId).find((p) => p.label.toLowerCase().startsWith(chip.textContent.toLowerCase().slice(0, 5)));
      if (provider) chip.dataset.count = provider.count;
    }
  } catch {
    // The page already carries the numbers it was built with
  }
})();
