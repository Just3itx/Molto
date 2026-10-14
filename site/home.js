"use strict";

const LOADER_URL = "https://raw.githubusercontent.com/notpoiu/Molto/refs/heads/main/source.lua";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);

// The moon icon of each set (Iconify JSON, same data the registry is built from), so the diagram never waits on a request
const MOONS = {"lucide":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>"},"tabler":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12 3h.393a7.5 7.5 0 0 0 7.92 12.446A9 9 0 1 1 12 2.992z\"/>"},"heroicons":{"name":"moon","w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M21.752 15.002A9.7 9.7 0 0 1 18 15.75A9.75 9.75 0 0 1 8.25 6c0-1.33.266-2.597.748-3.752A9.75 9.75 0 0 0 3 11.25A9.75 9.75 0 0 0 12.75 21a9.75 9.75 0 0 0 9.002-5.998\"/>"},"ph":{"name":"moon","w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"M233.54 142.23a8 8 0 0 0-8-2a88.08 88.08 0 0 1-109.8-109.8a8 8 0 0 0-10-10a104.84 104.84 0 0 0-52.91 37A104 104 0 0 0 136 224a103.1 103.1 0 0 0 62.52-20.88a104.84 104.84 0 0 0 37-52.91a8 8 0 0 0-1.98-7.98m-44.64 48.11A88 88 0 0 1 65.66 67.11a89 89 0 0 1 31.4-26A106 106 0 0 0 96 56a104.11 104.11 0 0 0 104 104a106 106 0 0 0 14.92-1.06a89 89 0 0 1-26.02 31.4\"/>"},"fluent":{"name":"weather-moon-24-regular","w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"M20.026 17.001c-2.762 4.784-8.879 6.423-13.663 3.661A10 10 0 0 1 3.13 17.68a.75.75 0 0 1 .365-1.132c3.767-1.348 5.785-2.91 6.956-5.146c1.233-2.353 1.551-4.93.689-8.463a.75.75 0 0 1 .769-.927a9.96 9.96 0 0 1 4.457 1.327c4.784 2.762 6.423 8.879 3.66 13.662m-8.247-4.903c-1.252 2.389-3.312 4.1-6.818 5.499a8.5 8.5 0 0 0 2.152 1.766a8.502 8.502 0 0 0 8.502-14.725a8.5 8.5 0 0 0-2.792-1.015c.647 3.384.23 6.043-1.045 8.475\"/>"}};
const SAMPLES = {"lucide":[{"w":24,"h":24,"body":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/></g>"},{"w":24,"h":24,"body":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"},{"w":24,"h":24,"body":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></g>"},{"w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/>"}],"tabler":[{"w":24,"h":24,"body":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7\"/><path d=\"M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6\"/></g>"},{"w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m18 11l-6-6\"/>"},{"w":24,"h":24,"body":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065\"/><path d=\"M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0\"/></g>"},{"w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M19.5 12.572L12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572\"/>"}],"heroicons":[{"w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"m2.25 12l8.955-8.955a1.124 1.124 0 0 1 1.59 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25\"/>"},{"w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607\"/>"},{"w":24,"h":24,"body":"<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path d=\"M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87q.11.06.22.127c.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a8 8 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7 7 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a7 7 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7 7 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124q.108-.066.22-.128c.332-.183.582-.495.644-.869z\"/><path d=\"M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0\"/></g>"},{"w":24,"h":24,"body":"<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M21 8.25c0-2.485-2.099-4.5-4.687-4.5c-1.936 0-3.598 1.126-4.313 2.733c-.715-1.607-2.377-2.733-4.312-2.733C5.098 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12\"/>"}],"ph":[{"w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"m219.31 108.68l-80-80a16 16 0 0 0-22.62 0l-80 80A15.87 15.87 0 0 0 32 120v96a8 8 0 0 0 8 8h64a8 8 0 0 0 8-8v-56h32v56a8 8 0 0 0 8 8h64a8 8 0 0 0 8-8v-96a15.87 15.87 0 0 0-4.69-11.32M208 208h-48v-56a8 8 0 0 0-8-8h-48a8 8 0 0 0-8 8v56H48v-88l80-80l80 80Z\"/>"},{"w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"m229.66 218.34l-50.07-50.06a88.11 88.11 0 1 0-11.31 11.31l50.06 50.07a8 8 0 0 0 11.32-11.32M40 112a72 72 0 1 1 72 72a72.08 72.08 0 0 1-72-72\"/>"},{"w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"M128 80a48 48 0 1 0 48 48a48.05 48.05 0 0 0-48-48m0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32m88-29.84q.06-2.16 0-4.32l14.92-18.64a8 8 0 0 0 1.48-7.06a107.2 107.2 0 0 0-10.88-26.25a8 8 0 0 0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186 40.54a8 8 0 0 0-3.94-6a107.7 107.7 0 0 0-26.25-10.87a8 8 0 0 0-7.06 1.49L130.16 40h-4.32L107.2 25.11a8 8 0 0 0-7.06-1.48a107.6 107.6 0 0 0-26.25 10.88a8 8 0 0 0-3.93 6l-2.64 23.76q-1.56 1.49-3 3L40.54 70a8 8 0 0 0-6 3.94a107.7 107.7 0 0 0-10.87 26.25a8 8 0 0 0 1.49 7.06L40 125.84v4.32L25.11 148.8a8 8 0 0 0-1.48 7.06a107.2 107.2 0 0 0 10.88 26.25a8 8 0 0 0 6 3.93l23.72 2.64q1.49 1.56 3 3L70 215.46a8 8 0 0 0 3.94 6a107.7 107.7 0 0 0 26.25 10.87a8 8 0 0 0 7.06-1.49L125.84 216q2.16.06 4.32 0l18.64 14.92a8 8 0 0 0 7.06 1.48a107.2 107.2 0 0 0 26.25-10.88a8 8 0 0 0 3.93-6l2.64-23.72q1.56-1.48 3-3l23.78-2.8a8 8 0 0 0 6-3.94a107.7 107.7 0 0 0 10.87-26.25a8 8 0 0 0-1.49-7.06Zm-16.1-6.5a74 74 0 0 1 0 8.68a8 8 0 0 0 1.74 5.48l14.19 17.73a91.6 91.6 0 0 1-6.23 15l-22.6 2.56a8 8 0 0 0-5.1 2.64a74 74 0 0 1-6.14 6.14a8 8 0 0 0-2.64 5.1l-2.51 22.58a91.3 91.3 0 0 1-15 6.23l-17.74-14.19a8 8 0 0 0-5-1.75h-.48a74 74 0 0 1-8.68 0a8 8 0 0 0-5.48 1.74l-17.78 14.2a91.6 91.6 0 0 1-15-6.23L82.89 187a8 8 0 0 0-2.64-5.1a74 74 0 0 1-6.14-6.14a8 8 0 0 0-5.1-2.64l-22.58-2.52a91.3 91.3 0 0 1-6.23-15l14.19-17.74a8 8 0 0 0 1.74-5.48a74 74 0 0 1 0-8.68a8 8 0 0 0-1.74-5.48L40.2 100.45a91.6 91.6 0 0 1 6.23-15L69 82.89a8 8 0 0 0 5.1-2.64a74 74 0 0 1 6.14-6.14A8 8 0 0 0 82.89 69l2.51-22.57a91.3 91.3 0 0 1 15-6.23l17.74 14.19a8 8 0 0 0 5.48 1.74a74 74 0 0 1 8.68 0a8 8 0 0 0 5.48-1.74l17.77-14.19a91.6 91.6 0 0 1 15 6.23L173.11 69a8 8 0 0 0 2.64 5.1a74 74 0 0 1 6.14 6.14a8 8 0 0 0 5.1 2.64l22.58 2.51a91.3 91.3 0 0 1 6.23 15l-14.19 17.74a8 8 0 0 0-1.74 5.53Z\"/>"},{"w":256,"h":256,"body":"<path fill=\"currentColor\" d=\"M178 40c-20.65 0-38.73 8.88-50 23.89C116.73 48.88 98.65 40 78 40a62.07 62.07 0 0 0-62 62c0 70 103.79 126.66 108.21 129a8 8 0 0 0 7.58 0C136.21 228.66 240 172 240 102a62.07 62.07 0 0 0-62-62m-50 174.8c-18.26-10.64-96-59.11-96-112.8a46.06 46.06 0 0 1 46-46c19.45 0 35.78 10.36 42.6 27a8 8 0 0 0 14.8 0c6.82-16.67 23.15-27 42.6-27a46.06 46.06 0 0 1 46 46c0 53.61-77.76 102.15-96 112.8\"/>"}],"fluent":[{"w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"M10.55 2.532a2.25 2.25 0 0 1 2.9 0l6.75 5.692c.507.428.8 1.057.8 1.72v9.31a1.75 1.75 0 0 1-1.75 1.75h-3.5a1.75 1.75 0 0 1-1.75-1.75v-5.007a.25.25 0 0 0-.25-.25h-3.5a.25.25 0 0 0-.25.25v5.007a1.75 1.75 0 0 1-1.75 1.75h-3.5A1.75 1.75 0 0 1 3 19.254v-9.31c0-.663.293-1.292.8-1.72zm1.933 1.147a.75.75 0 0 0-.966 0L4.767 9.37a.75.75 0 0 0-.267.573v9.31c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-5.007c0-.967.784-1.75 1.75-1.75h3.5c.966 0 1.75.783 1.75 1.75v5.007c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-9.31a.75.75 0 0 0-.267-.573z\"/>"},{"w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"M16.102 17.162a8 8 0 1 1 1.06-1.06l4.618 4.618a.75.75 0 1 1-1.06 1.06zM17.5 11a6.5 6.5 0 1 0-13 0a6.5 6.5 0 0 0 13 0\"/>"},{"w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"M12.012 2.25c.734.008 1.465.093 2.182.253a.75.75 0 0 1 .582.649l.17 1.527a1.384 1.384 0 0 0 1.927 1.116l1.4-.615a.75.75 0 0 1 .85.174a9.8 9.8 0 0 1 2.205 3.792a.75.75 0 0 1-.272.825l-1.241.916a1.38 1.38 0 0 0 0 2.226l1.243.915a.75.75 0 0 1 .272.826a9.8 9.8 0 0 1-2.204 3.792a.75.75 0 0 1-.849.175l-1.406-.617a1.38 1.38 0 0 0-1.926 1.114l-.17 1.526a.75.75 0 0 1-.571.647a9.5 9.5 0 0 1-4.406 0a.75.75 0 0 1-.572-.647l-.169-1.524a1.382 1.382 0 0 0-1.925-1.11l-1.406.616a.75.75 0 0 1-.85-.175a9.8 9.8 0 0 1-2.203-3.796a.75.75 0 0 1 .272-.826l1.243-.916a1.38 1.38 0 0 0 0-2.226l-1.243-.914a.75.75 0 0 1-.272-.826a9.8 9.8 0 0 1 2.205-3.792a.75.75 0 0 1 .85-.174l1.4.615a1.387 1.387 0 0 0 1.93-1.118l.17-1.526a.75.75 0 0 1 .583-.65q1.074-.238 2.201-.252m0 1.5a9 9 0 0 0-1.354.117l-.11.977A2.886 2.886 0 0 1 6.526 7.17l-.899-.394A8.3 8.3 0 0 0 4.28 9.092l.797.587a2.88 2.88 0 0 1 .001 4.643l-.799.588c.32.842.776 1.626 1.348 2.322l.905-.397a2.882 2.882 0 0 1 4.017 2.318l.109.984c.89.15 1.799.15 2.688 0l.11-.984a2.88 2.88 0 0 1 4.018-2.322l.904.396a8.3 8.3 0 0 0 1.348-2.318l-.798-.588a2.88 2.88 0 0 1-.001-4.643l.797-.587a8.3 8.3 0 0 0-1.348-2.317l-.897.393a2.884 2.884 0 0 1-4.023-2.324l-.109-.976a9 9 0 0 0-1.334-.117M12 8.25a3.75 3.75 0 1 1 0 7.5a3.75 3.75 0 0 1 0-7.5m0 1.5a2.25 2.25 0 1 0 0 4.5a2.25 2.25 0 0 0 0-4.5\"/>"},{"w":24,"h":24,"body":"<path fill=\"currentColor\" d=\"m12.82 5.58l-.82.822l-.824-.824a5.375 5.375 0 1 0-7.601 7.602l7.895 7.895a.75.75 0 0 0 1.06 0l7.902-7.897a5.376 5.376 0 0 0-.001-7.599a5.38 5.38 0 0 0-7.611 0m6.548 6.54L12 19.485L4.635 12.12a3.875 3.875 0 1 1 5.48-5.48l1.358 1.357a.75.75 0 0 0 1.073-.012L13.88 6.64a3.88 3.88 0 0 1 5.487 5.48\"/>"}]};
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

const HUB = { x: 400, y: 225 };
const SPOTS = [
  { x: 90, y: 55 }, { x: 90, y: 225 }, { x: 90, y: 395 },
  { x: 710, y: 140 }, { x: 710, y: 310 },
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
  const from = { x: s.x + (left ? 52 : -52), y: s.y };
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
  el("circle", { cx: s.x, cy: s.y, r: 52 }, node);
  SAMPLES[key].forEach((icon, n) => {
    const size = 30, gap = 6;
    const cx = s.x + (n % 2 ? 1 : -1) * (size + gap) / 2;
    const cy = s.y + (n > 1 ? 1 : -1) * (size + gap) / 2;
    const g = el("svg", { x: cx - size / 2, y: cy - size / 2, width: size, height: size, viewBox: `0 0 ${icon.w} ${icon.h}`, class: "glyph" }, node);
    g.innerHTML = icon.body;
  });
  el("text", { x: s.x, y: s.y + 82 }, node).textContent = LABELS[key];
  node.count = el("text", { x: s.x, y: s.y + 104, class: "n" }, node);
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
