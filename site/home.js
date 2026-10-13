"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";

const toastEl = document.getElementById("toast");
let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

document.getElementById("loader-url").textContent = LOADER_URL;

document.getElementById("copy-loader").addEventListener("click", async () => {
  const code = `local Icons = loadstring(game:HttpGet("${LOADER_URL}"))()`;
  try {
    await navigator.clipboard.writeText(code);
    toast("Loader copied");
  } catch {
    toast("Copy failed, select the code below instead");
  }
});

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

(async function loadProviders() {
  const cards = document.getElementById("provider-cards");
  try {
    const response = await fetch("data/providers.json");
    if (!response.ok) throw new Error(response.status);
    const { providers } = await response.json();

    cards.innerHTML = providers
      .map(
        (provider) => `
      <a class="card" href="icons/#${encodeURIComponent(provider.id)}">
        <div class="card-top">
          <h3>${escapeHtml(provider.label)}</h3>
          ${provider.font ? '<span class="badge">Font</span>' : ""}
        </div>
        <div class="card-meta"><span><b>${provider.count.toLocaleString()}</b> icons</span><span>${escapeHtml(provider.license)}</span></div>
        <span class="card-go">Browse →</span>
      </a>`
      )
      .join("");

    const total = providers.reduce((sum, provider) => sum + provider.count, 0);
    document.getElementById("stat-icons").textContent = total.toLocaleString();
    document.getElementById("stat-providers").textContent = providers.length;
    document.getElementById("stats").hidden = false;
  } catch (error) {
    console.error(error);
    cards.innerHTML = '<p class="muted">Provider list unavailable. Browse the icons directly instead.</p>';
  }
})();
