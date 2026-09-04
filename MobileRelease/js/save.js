import { MAX_PLAYABLE_NIGHT } from "./ai.js";
import { getSetting } from "./settings.js";

const SAVE_KEY = "dfnaf-mobile-save";
const BOOP_SITES = ["main_menu", "office", "front_desk"];

function read() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function write(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, updatedAt: Date.now(), autosave: true }));
}

export function autoSaveOn() {
  return getSetting("Auto Save", true) !== false;
}

function unlockInto(data, ids) {
  const unlocked = new Set(data.unlocked || []);
  const fresh = [];
  for (const id of ids) {
    if (!id || unlocked.has(id)) continue;
    unlocked.add(id);
    fresh.push(id);
  }
  data.unlocked = [...unlocked];
  return fresh;
}

export function loadSave() {
  const data = read();
  const night = Math.max(1, Math.min(MAX_PLAYABLE_NIGHT, Number(data.night) || 1));
  return { night, hasSave: Boolean(data.hasSave || data.night), jumped: Boolean(data.jumped) };
}

export function saveNight(night, { force = false } = {}) {
  if (!force && !autoSaveOn()) return loadSave().night;
  const n = Math.max(1, Math.min(MAX_PLAYABLE_NIGHT, Number(night) || 1));
  const data = read();
  write({ ...data, night: n, hasSave: true, autosave: true });
  return n;
}

export function startNewGame() {
  const data = read();
  write({
    ...data,
    night: 1,
    hasSave: true,
    jumped: false,
    marathon: true,
    completed: [],
    autosave: true,
  });
  return 1;
}

export function breakMarathon() {
  const data = read();
  if (data.marathon) write({ ...data, marathon: false });
}

export function markJumpscare(name) {
  const data = read();
  const ids = [];
  if (name === "freddy") ids.push("har_har");
  if (name === "bonnie") ids.push("bon_bon_bon");
  const fresh = unlockInto(data, ids);
  write({ ...data, jumped: true });
  return fresh;
}

export function markNightWon(night) {
  const data = read();
  const completed = new Set(data.completed || []);
  completed.add(Number(night));
  const ids = [];
  if (night >= 1) ids.push("night_1");
  if (night >= 5) {
    ids.push("night_5");
    if (!data.jumped) ids.push("unscathed");
  }
  const allFive = [1, 2, 3, 4, 5].every((n) => completed.has(n));
  if (data.marathon && allFive) ids.push("midnight_marathon");
  const fresh = unlockInto(data, ids);
  write({ ...data, completed: [...completed] });
  return fresh;
}

export function recordBoopSite(site) {
  const data = read();
  const sites = new Set(data.boopSites || []);
  sites.add(String(site || ""));
  write({ ...data, boopSites: [...sites] });
  if (BOOP_SITES.every((id) => sites.has(id))) return unlockIds(["boop"]);
  return [];
}

export function unlockIds(ids) {
  const data = read();
  const fresh = unlockInto(data, ids);
  if (fresh.length) write(data);
  return fresh;
}

export function getUnlockedIds() {
  const data = read();
  return new Set(data.unlocked || []);
}
