const SAVE_KEY = "dfnaf-mobile-settings";

export const SETTINGS_DEFAULTS = {
  "Master Volume": 0.5,
  "Music Volume": 0.5,
  "SFX Volume": 0.5,
  Fullscreen: false,
  VSync: true,
  AntiAliasing: false,
  "Reduce Motion": false,
  Gore: false,
  "Skip Intro": false,
  "Auto Save": true,
  "Performance Overlay": false,
};

const TABS = [
  { id: "display", label: "DISPLAY" },
  { id: "audio", label: "AUDIO" },
  { id: "game", label: "GAMEPLAY" },
  { id: "system", label: "SYSTEM" },
];

const CONTROLS = {
  display: [
    { key: "Fullscreen", label: "Fullscreen", type: "toggle" },
    { key: "AntiAliasing", label: "Anti-Aliasing", type: "toggle" },
    { key: "VSync", label: "VSync", type: "toggle" },
  ],
  audio: [
    { key: "Master Volume", label: "Master", type: "slider" },
    { key: "Music Volume", label: "Music", type: "slider" },
    { key: "SFX Volume", label: "SFX", type: "slider" },
  ],
  game: [
    { key: "Reduce Motion", label: "Reduce Motion", type: "toggle" },
    { key: "Gore", label: "Gore", type: "toggle" },
    { key: "Skip Intro", label: "Skip Intro", type: "toggle" },
    { key: "Auto Save", label: "Auto Save", type: "toggle" },
  ],
  system: [{ key: "Performance Overlay", label: "Performance Overlay", type: "toggle" }],
};

let overlayEl = null;
let tabsEl = null;
let bodyEl = null;
let activeTab = "display";
let dragging = null;
let hooks = { onClick: () => {}, onHover: () => {}, onChange: () => {} };
let lastHover = "";

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {};
    return { ...SETTINGS_DEFAULTS, ...raw };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export function saveSettings(next) {
  const data = { ...SETTINGS_DEFAULTS, ...next };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return data;
}

export function setSetting(key, value) {
  const data = loadSettings();
  data[key] = value;
  return saveSettings(data);
}

export function getSetting(key, fallback) {
  const data = loadSettings();
  if (data[key] === undefined) return fallback;
  return data[key];
}

export function mixVolume(channel, base = 1) {
  const s = loadSettings();
  const master = Number(s["Master Volume"] ?? 0.5);
  const bus = channel === "music" ? Number(s["Music Volume"] ?? 0.5) : Number(s["SFX Volume"] ?? 0.5);
  return Math.max(0, Math.min(1, Number(base) * master * bus));
}

export function isSettingsOpen() {
  return !!(overlayEl && !overlayEl.classList.contains("hidden"));
}

async function applyFullscreen(on) {
  try {
    if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    } else if (!on && document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    /* browser blocked fullscreen */
  }
  setSetting("Fullscreen", !!document.fullscreenElement);
}

function applyValue(key, value) {
  if (key === "Fullscreen") {
    applyFullscreen(!!value);
    hooks.onChange(key);
    return;
  }
  setSetting(key, value);
  hooks.onChange(key);
}

function renderTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = TABS.map(
    (tab) =>
      `<button class="settings-tab${tab.id === activeTab ? " on" : ""}" type="button" data-tab="${tab.id}">${tab.label}</button>`
  ).join("");
}

function renderBody() {
  if (!bodyEl) return;
  const state = loadSettings();
  bodyEl.innerHTML = CONTROLS[activeTab]
    .map((ctrl) => {
      if (ctrl.type === "slider") {
        const value = Math.max(0, Math.min(1, Number(state[ctrl.key] ?? 0.5)));
        const pct = Math.round(value * 100);
        return `<div class="settings-row" data-key="${ctrl.key}" data-type="slider">
          <span class="settings-label">${ctrl.label}</span>
          <div class="settings-track"><div class="settings-fill" style="width:${pct}%"></div><div class="settings-thumb" style="left:${pct}%"></div></div>
          <span class="settings-readout">${pct}%</span>
        </div>`;
      }
      const on = !!state[ctrl.key];
      return `<div class="settings-row" data-key="${ctrl.key}" data-type="toggle">
        <span class="settings-label">${ctrl.label}</span>
        <span class="settings-switch${on ? " on" : ""}">${on ? "ON" : "OFF"}</span>
      </div>`;
    })
    .join("");
}

function renderSettings() {
  const fs = !!document.fullscreenElement;
  if (getSetting("Fullscreen") !== fs) setSetting("Fullscreen", fs);
  renderTabs();
  renderBody();
}

function setSliderFromClientX(row, clientX) {
  const track = row.querySelector(".settings-track");
  if (!track) return;
  const rect = track.getBoundingClientRect();
  const value = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  applyValue(row.dataset.key, value);
  const pct = Math.round(value * 100);
  const fill = row.querySelector(".settings-fill");
  const thumb = row.querySelector(".settings-thumb");
  const readout = row.querySelector(".settings-readout");
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
  if (readout) readout.textContent = `${pct}%`;
}

export function openSettings() {
  if (!overlayEl) return;
  renderSettings();
  overlayEl.classList.remove("hidden");
}

export function closeSettings() {
  if (!overlayEl) return;
  overlayEl.classList.add("hidden");
  dragging = null;
}

export function initSettings(opts = {}) {
  overlayEl = document.getElementById("settings");
  tabsEl = document.getElementById("settings-tabs");
  bodyEl = document.getElementById("settings-body");
  hooks = {
    onClick: opts.onClick || (() => {}),
    onHover: opts.onHover || (() => {}),
    onChange: opts.onChange || (() => {}),
  };
  if (!overlayEl || !tabsEl || !bodyEl) return;

  renderSettings();

  tabsEl.addEventListener("pointerenter", (e) => {
    if (e.target.closest(".settings-tab")) hooks.onHover();
  });
  tabsEl.addEventListener("click", (e) => {
    const tab = e.target.closest(".settings-tab");
    if (!tab) return;
    const id = tab.dataset.tab;
    if (!id || id === activeTab) return;
    activeTab = id;
    hooks.onClick();
    renderSettings();
  });

  bodyEl.addEventListener("pointerenter", (e) => {
    const row = e.target.closest(".settings-row");
    if (row && row.dataset.key !== lastHover) {
      lastHover = row.dataset.key;
      hooks.onHover();
    }
  });
  bodyEl.addEventListener("pointerdown", (e) => {
    const row = e.target.closest(".settings-row");
    if (!row) return;
    if (row.dataset.type === "slider") {
      dragging = row;
      row.setPointerCapture?.(e.pointerId);
      setSliderFromClientX(row, e.clientX);
      hooks.onClick();
    } else if (row.dataset.type === "toggle") {
      applyValue(row.dataset.key, !getSetting(row.dataset.key));
      hooks.onClick();
      renderBody();
    }
  });
  bodyEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    setSliderFromClientX(dragging, e.clientX);
  });
  const stopDrag = () => {
    dragging = null;
  };
  bodyEl.addEventListener("pointerup", stopDrag);
  bodyEl.addEventListener("pointercancel", stopDrag);

  document.getElementById("settings-back")?.addEventListener("click", () => {
    hooks.onClick();
    closeSettings();
  });
  document.getElementById("settings-reset")?.addEventListener("click", () => {
    saveSettings({ ...SETTINGS_DEFAULTS });
    applyFullscreen(false);
    hooks.onClick();
    hooks.onChange("reset");
    renderSettings();
  });
  document.getElementById("settings-back")?.addEventListener("pointerenter", () => hooks.onHover());
  document.getElementById("settings-reset")?.addEventListener("pointerenter", () => hooks.onHover());

  document.addEventListener("fullscreenchange", () => {
    setSetting("Fullscreen", !!document.fullscreenElement);
    if (isSettingsOpen() && activeTab === "display") renderBody();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isSettingsOpen()) return;
    e.preventDefault();
    closeSettings();
  });
}
