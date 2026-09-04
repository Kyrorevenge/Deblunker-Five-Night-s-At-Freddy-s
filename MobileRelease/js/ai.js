/** Campaign AI — same tables as Code/Night.py */
export const MAX_PLAYABLE_NIGHT = 3;

/** Same bullets as Code/Night.py `_intro_features`. */
export const NIGHT_INTRO_FEATURES = {
  1: ["Freddy activates at 1 AM"],
  2: ["Freddy activates at 1 AM", "Bonnie activates at 1 AM"],
  3: ["Freddy is now Hostile", "Decommissioned Bon active"],
  4: ["Bonnie is Hostile", "Freddy is aggressive", "Spring is hostile", "Taser active"],
  5: ["Bonnie aggressive", "Freddy aggressive", "Spring aggressive", "Taser active"],
};

/** Same copy as Code/NightBriefing.py */
export const NIGHT_BRIEFING = {
  1: {
    id: "freddy",
    name: "Freddy",
    subtitle: "Active · 1 AM",
    portrait: "hazardFred",
    description:
      "Freddy begins moving after 1 AM. He is not lethal yet — watch the cameras and learn his path.",
  },
  2: {
    id: "bonnie",
    name: "Bonnie",
    subtitle: "Active · 1 AM",
    portrait: "hazardBon",
    description:
      "Bonnie activates at 1 AM. Keep the left door ready and track him through the halls. Freddy still patrols after 1 AM.",
  },
  3: {
    id: "decommissioned_bonnie",
    name: "Decommissioned Bon",
    subtitle: "Sabotage",
    portrait: "hazardBonSheet",
    anim: true,
    description:
      "Bon sabotage can now hinder more cameras alongside the doors and camera systems. Higher chance of movement, and more aggressive.",
  },
  4: {
    id: "spring",
    name: "Spring",
    subtitle: "Hostile · 2 AM",
    portrait: "hazardBon",
    description:
      "Spring becomes active later in the night. Listen for his approach. Decommissioned Bonnie and aggressive Freddy are also in play — the taser is available.",
  },
  5: {
    id: "decommissioned_freddy",
    name: "Decommissioned Fred",
    subtitle: "Aggressive · Door Lift",
    portrait: "hazardFred",
    description:
      "Decommissioned Fred can force the right door open. Use the taser on his hands during a door lift. Bonnie and Spring are fully aggressive tonight.",
  },
};

export const NIGHT_AI = {
  1: {
    freddy: { level: 10, type: "passive", ai: "freddy", aggressive: false, hour: 1 },
    bonnie: { level: 0, type: "passive", ai: "bonnie", aggressive: false, hour: null },
    spring: { level: 0, hour: null },
  },
  2: {
    freddy: { level: 12, type: "passive", ai: "freddy", aggressive: false, hour: 1 },
    bonnie: { level: 10, type: "passive", ai: "bonnie", aggressive: false, hour: 1 },
    spring: { level: 0, hour: null },
  },
  3: {
    freddy: { level: 10, type: "hostile", ai: "hostile_freddy", aggressive: false, hour: 0 },
    bonnie: { level: 12, type: "hostile", ai: "decommissioned_bonnie", aggressive: false, hour: 0 },
    spring: { level: 0, hour: null },
  },
  4: {
    freddy: { level: 13, type: "hostile", ai: "hostile_freddy", aggressive: true, hour: 0 },
    bonnie: { level: 13, type: "hostile", ai: "decommissioned_bonnie", aggressive: false, hour: 0 },
    spring: { level: 12, hour: 2 },
  },
  5: {
    freddy: { level: 15, type: "hostile", ai: "decommissioned_freddy", aggressive: true, hour: 0 },
    bonnie: { level: 15, type: "hostile", ai: "decommissioned_bonnie", aggressive: true, hour: 0 },
    spring: { level: 13, hour: 2 },
  },
};

export const CAMERAS = [
  { id: "stage", name: "CAM 1", label: "Stage", hud: [0.38, 0.05] },
  { id: "storage", name: "CAM 2", label: "Storage", hud: [0.65, 0.30] },
  { id: "backDump", name: "CAM 3", label: "Back Dump", hud: [0.11, 0.58] },
  { id: "rightCorner", name: "CAM 4", label: "Right Corner", hud: [0.51, 0.90] },
  { id: "bathrooms", name: "CAM 5", label: "Bathrooms", hud: [0.88, 0.22] },
  { id: "leftHall", name: "CAM 6", label: "Left Hall", hud: [0.25, 0.70] },
  { id: "rightHall", name: "CAM 7", label: "Right Hall", hud: [0.50, 0.70] },
  { id: "parts", name: "CAM 8", label: "Parts & Service", hud: [0.02, 0.19] },
  { id: "kitchen", name: "CAM 9", label: "Kitchen", hud: [0.74, 0.559] },
  { id: "leftCorner", name: "CAM 10", label: "Left Corner", hud: [0.25, 0.90] },
  { id: "frontDesk", name: "CAM 11", label: "Front Desk", hud: [0.72, 0.08] },
  { id: "foodCourt", name: "FoodCourt", label: "Food Court", hud: [0.25, 0.30] },
];

/** PC Animatronic_AI.py camera paths (doorway = office threshold). */
export const FREDDY_PATHS = {
  foodcourt_hallway: ["stage", "foodCourt", "rightHall", "rightCorner", "doorway"],
  storage_hallway: ["stage", "storage", "rightHall", "rightCorner", "doorway"],
  foodcourt_kitchen: ["stage", "foodCourt", "kitchen"],
};

export const BONNIE_PATHS = {
  left_hallway: ["stage", "foodCourt", "leftHall", "leftCorner", "doorway"],
  parts_service: ["stage", "parts"],
};

export const FREDDY_PATH = FREDDY_PATHS.foodcourt_hallway;
export const BONNIE_PATH = BONNIE_PATHS.left_hallway;

export const BASE_MOVE_COOLDOWN_FREDDY = 25;
export const BASE_MOVE_COOLDOWN_BONNIE = 27;
export const MOVE_FAIL_RATE_CAP = 0.25;
export const MOVE_RETREAT_AFTER_FAILURES = 4;
export const DOORWAY_WAIT_MIN = 5;
export const DOORWAY_WAIT_MAX = 10;
export const FREDDY_DOOR_BLOCK_RETREAT = [7, 20];
export const BONNIE_DOOR_BLOCK_RETREAT = [7, 15];
export const DOOR_BLOCK_CORNER_CHANCE = 0.15;
export const MAX_KITCHEN_TIME = 10;
export const MAX_KITCHEN_BOOPS = 2;
export const BOOP_COOLDOWN = 3;
export const BONNIE_SABOTAGE_CAP = 0.15;
export const BONNIE_KITCHEN_SABOTAGE = 0.3;
export const POWER_OUTAGE_FADE = 12;

export function isHostile(cfg) {
  if (!cfg) return false;
  if (cfg.type === "hostile") return true;
  const id = String(cfg.ai || "").toLowerCase();
  return id.includes("hostile") || id.includes("decommissioned");
}

export function isActive(cfg, hour) {
  if (!cfg || !cfg.level) return false;
  if (cfg.hour == null) return false;
  return hour >= cfg.hour;
}

export function moveCooldown(level, extra = 0) {
  const aggro = Math.min(20, Math.max(1, Number(level) || 1));
  return Math.max(5, BASE_MOVE_COOLDOWN_FREDDY - (aggro - 1) * 0.5) + extra;
}

export function moveChance(level, { watched = false, freddy = true } = {}) {
  const aggro = Math.min(20, Math.max(1, Number(level) || 1));
  let threshold = (freddy ? 85 : 80) - (aggro - 1) * 1.75;
  if (watched) threshold = Math.max(threshold, 75);
  let chance = Math.max(0, Math.min(1, (100 - threshold) / 100));
  if (!watched) chance = Math.max(chance, 1 - MOVE_FAIL_RATE_CAP);
  return chance;
}

export function pickFreddyPath() {
  const roll = Math.random();
  if (roll < 0.45) return FREDDY_PATHS.storage_hallway;
  if (roll < 0.9) return FREDDY_PATHS.foodcourt_hallway;
  return FREDDY_PATHS.foodcourt_kitchen;
}

export function pickBonniePath() {
  return Math.random() < 0.7 ? BONNIE_PATHS.left_hallway : BONNIE_PATHS.parts_service;
}

export function doorwayWait() {
  return DOORWAY_WAIT_MIN + Math.random() * (DOORWAY_WAIT_MAX - DOORWAY_WAIT_MIN);
}

export function moveInterval(level) {
  return moveCooldown(level);
}
