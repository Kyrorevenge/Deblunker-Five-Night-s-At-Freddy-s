import {
  NIGHT_AI,
  CAMERAS,
  MAX_PLAYABLE_NIGHT,
  FREDDY_PATHS,
  BONNIE_PATHS,
  isActive,
  isHostile,
  moveCooldown,
  moveChance,
  pickFreddyPath,
  pickBonniePath,
  doorwayWait,
  MOVE_RETREAT_AFTER_FAILURES,
  FREDDY_DOOR_BLOCK_RETREAT,
  BONNIE_DOOR_BLOCK_RETREAT,
  DOOR_BLOCK_CORNER_CHANCE,
  MAX_KITCHEN_TIME,
  MAX_KITCHEN_BOOPS,
  BOOP_COOLDOWN,
  BONNIE_SABOTAGE_CAP,
  BONNIE_KITCHEN_SABOTAGE,
  POWER_OUTAGE_FADE,
} from "./ai.js";
import { createTaskState, updateTasks } from "./tasks.js";

const HOUR_SECONDS = 70;
const POWER_BASE = 0.15;
const POWER_DOOR = 0.3;
const POWER_LIGHT = 0.2;
const GENERATOR_CHARGE_SECONDS = 6;
const GENERATOR_CHARGE_GAIN = 3;
const GENERATOR_DECAY_RATE = 2;
const DOOR_SLIDE_SPEED = 4;

function clockLabel(hour) {
  if (hour <= 0) return "12 AM";
  if (hour >= 6) return "6 AM";
  return `${hour} AM`;
}

function pushSfx(state, name, volume = 1) {
  state.sfx.push({ name, volume });
}

function makeBot(cam, path) {
  return {
    cam,
    path: path.slice(),
    officeTimer: null,
    moveTimer: 0,
    cooldown: 30,
    failures: 0,
    inOffice: false,
    pathPicked: false,
    prevCam: cam,
    doorBlockTimer: 0,
    doorBlockDuration: 0,
    kitchenTimer: 0,
    kitchenBoops: 0,
    boopCooldown: 0,
    levelBonus: 0,
    bonusTimer: 0,
    sabotageState: 0,
    sabotageTimer: 0,
    sabotageHits: 0,
    sabotageAttempted: false,
    sabotageBonus: 0,
    sabotageCapNext: false,
    inactiveTimer: 0,
    camerasDisabled: 0,
  };
}

export function createNight(nightNumber) {
  const night = Math.max(1, Math.min(5, nightNumber));
  const ai = NIGHT_AI[night];
  return {
    night,
    hour: 0,
    hourTimer: 0,
    power: 100,
    camerasOpen: false,
    currentCam: "stage",
    charging: false,
    chargeTimer: 0,
    chargePopups: [],
    muted: false,
    callActive: night === 1,
    powerOutage: false,
    powerOutPlayed: false,
    powerOutFade: 0,
    cameraLock: 0,
    taskLock: 0,
    camerasDisabled: 0,
    doors: { left: false, right: false },
    lights: { left: false, right: false },
    doorSlide: { left: 0, right: 0 },
    bots: {
      freddy: makeBot("stage", FREDDY_PATHS.foodcourt_hallway),
      bonnie: makeBot("stage", BONNIE_PATHS.left_hallway),
      spring: { cam: null, officeTimer: 0, spawned: false, inOffice: false },
    },
    ai,
    over: null,
    sfx: [],
    kitchenOn: false,
    tasks: createTaskState(night),
    banner: "",
    bannerTimer: 0,
  };
}

export function occupants(state, camId) {
  const names = [];
  for (const [name, bot] of Object.entries(state.bots)) {
    if (name === "spring" && !bot.spawned) continue;
    if (!bot.cam || bot.inOffice) continue;
    if (bot.cam === camId) names.push(name);
  }
  return names;
}

export function occupancyText(state, camId) {
  const names = occupants(state, camId);
  if (!names.length) return "Empty";
  return names.map((n) => n[0].toUpperCase() + n.slice(1)).join(" · ");
}

export function drainSfx(state) {
  const q = state.sfx || [];
  state.sfx = [];
  return q;
}

function botLevel(state, name) {
  const cfg = state.ai[name];
  return Math.min(20, (cfg.level || 0) + (state.bots[name].levelBonus || 0));
}

function resetBot(bot, path) {
  bot.cam = "stage";
  bot.path = path.slice();
  bot.pathPicked = false;
  bot.inOffice = false;
  bot.officeTimer = null;
  bot.failures = 0;
  bot.doorBlockTimer = 0;
  bot.doorBlockDuration = 0;
  bot.kitchenTimer = 0;
}

function watched(state, bot) {
  return !!(state.camerasOpen && state.currentCam === bot.cam && bot.cam !== "stage");
}

function noteMove(state, bot, next) {
  const prev = bot.cam;
  bot.prevCam = prev;
  bot.cam = next;
  if (prev === "stage" && next && next !== "stage") {
    pushSfx(state, "creak", state.camerasOpen ? 0.85 : 0.15);
  }
  if (next === "doorway" && prev !== "doorway") {
    pushSfx(state, "creak", 0.1);
  }
}

function tryEnter(state, name, side) {
  const bot = state.bots[name];
  if (state.doors[side]) return null;
  bot.inOffice = true;
  if (isHostile(state.ai[name])) return { type: "defeat", by: name };
  resetBot(bot, name === "freddy" ? FREDDY_PATHS.foodcourt_hallway : BONNIE_PATHS.left_hallway);
  return { type: "scare", by: name };
}

function processDoorBlock(state, name, side, dt) {
  const bot = state.bots[name];
  const block = name === "freddy" ? ["rightCorner", "doorway"] : ["leftHall", "leftCorner", "doorway"];
  if (!block.includes(bot.cam)) {
    bot.doorBlockTimer = 0;
    bot.doorBlockDuration = 0;
    return false;
  }
  if (!state.doors[side]) return false;
  const range = name === "freddy" ? FREDDY_DOOR_BLOCK_RETREAT : BONNIE_DOOR_BLOCK_RETREAT;
  if (bot.doorBlockDuration <= 0) {
    const wait = range[0] + Math.random() * (range[1] - range[0]);
    bot.officeTimer = null;
    bot.doorBlockTimer = wait;
    bot.doorBlockDuration = wait;
  }
  bot.doorBlockTimer -= dt;
  if (bot.doorBlockTimer > 0) return true;
  rerouteAfterDoor(state, name);
  bot.moveTimer = 0;
  bot.doorBlockTimer = 0;
  bot.doorBlockDuration = 0;
  return false;
}

function rerouteAfterDoor(state, name) {
  const bot = state.bots[name];
  if (name === "freddy") {
    if (bot.cam === "doorway" && Math.random() < DOOR_BLOCK_CORNER_CHANCE) {
      noteMove(state, bot, "rightCorner");
      bot.path = FREDDY_PATHS.foodcourt_hallway.slice();
    } else {
      if (bot.cam === "kitchen") state.kitchenOn = false;
      noteMove(state, bot, "storage");
      bot.path = ["storage", "kitchen"];
    }
    bot.pathPicked = true;
    bot.failures = 0;
    bot.kitchenTimer = 0;
    return;
  }
  if (bot.cam === "doorway" && Math.random() < DOOR_BLOCK_CORNER_CHANCE) {
    noteMove(state, bot, "leftCorner");
    bot.path = BONNIE_PATHS.left_hallway.slice();
  } else {
    noteMove(state, bot, "stage");
    bot.path = BONNIE_PATHS.parts_service.slice();
  }
  bot.pathPicked = true;
  bot.failures = 0;
}

function trySabotage(state) {
  const bot = state.bots.bonnie;
  let chance = BONNIE_SABOTAGE_CAP;
  if (bot.sabotageCapNext) {
    chance = BONNIE_KITCHEN_SABOTAGE;
    bot.sabotageCapNext = false;
    bot.sabotageBonus = 0;
  } else {
    chance = Math.min(BONNIE_SABOTAGE_CAP, 0.1 + Math.max(0, bot.sabotageBonus || 0));
  }
  if (Math.random() < chance) {
    bot.sabotageState = 1;
    bot.sabotageTimer = 5;
    bot.inOffice = false;
    bot.path = BONNIE_PATHS.parts_service.slice();
    bot.pathPicked = true;
    state.banner = "Left hallway light out";
    state.bannerTimer = 5;
    return;
  }
  pushSfx(state, "static", 0.4);
}

function updateSabotage(state, dt) {
  const bot = state.bots.bonnie;
  if (bot.inactiveTimer > 0) bot.inactiveTimer -= dt;
  if (bot.sabotageState <= 0) {
    if (bot.camerasDisabled > 0) {
      bot.camerasDisabled -= dt;
      state.camerasDisabled = bot.camerasDisabled;
      if (bot.camerasDisabled <= 0) {
        state.camerasDisabled = 0;
        state.banner = "Left hallway restored";
        state.bannerTimer = 3;
      }
    }
    return;
  }
  bot.sabotageTimer -= dt;
  if (bot.sabotageState === 1 && bot.sabotageTimer <= 0) {
    bot.sabotageState = 2;
    bot.sabotageHits = 0;
    bot.sabotageTimer = 25;
    state.banner = "Click to stop Bonnie sabotage";
    state.bannerTimer = 25;
  } else if (bot.sabotageState === 2 && bot.sabotageTimer <= 0) {
    bot.sabotageState = 3;
    bot.sabotageTimer = 2.5;
  } else if (bot.sabotageState === 3 && bot.sabotageTimer <= 0) {
    bot.sabotageState = 4;
    bot.camerasDisabled = 20;
    state.camerasDisabled = 20;
    state.camerasOpen = false;
    state.banner = "CAMERAS DISABLED";
    state.bannerTimer = 20;
  } else if (bot.sabotageState === 4) {
    bot.camerasDisabled -= dt;
    state.camerasDisabled = bot.camerasDisabled;
    if (bot.camerasDisabled <= 0) {
      bot.sabotageState = 0;
      state.camerasDisabled = 0;
      state.banner = "Left hallway restored";
      state.bannerTimer = 3;
    }
  }
}

export function hitBonnieSabotage(state) {
  const bot = state.bots.bonnie;
  if (!bot || bot.sabotageState !== 2) return false;
  bot.sabotageHits += 1;
  if (bot.sabotageHits >= 25) {
    bot.sabotageState = 0;
    bot.sabotageTimer = 0;
    bot.inactiveTimer = 20;
    resetBot(bot, BONNIE_PATHS.left_hallway);
    state.banner = "Sabotage prevented";
    state.bannerTimer = 3;
    return true;
  }
  return true;
}

function updateFreddyKitchen(state, dt) {
  const bot = state.bots.freddy;
  const cfg = state.ai.freddy;
  if (!isActive(cfg, state.hour)) {
    if (state.kitchenOn) state.kitchenOn = false;
    return;
  }
  if (bot.bonusTimer > 0) {
    bot.bonusTimer -= dt;
    if (bot.bonusTimer <= 0) bot.levelBonus = 0;
  }
  if (bot.boopCooldown > 0) bot.boopCooldown -= dt;
  if (bot.cam === "kitchen" && bot.prevCam !== "kitchen") {
    state.kitchenOn = true;
    bot.kitchenBoops = 0;
    bot.kitchenTimer = 0;
    if (bot.bonusTimer <= 0) {
      bot.levelBonus = 1;
      bot.bonusTimer = 40;
      state.bots.bonnie.sabotageCapNext = true;
    }
  } else if (bot.prevCam === "kitchen" && bot.cam !== "kitchen") {
    state.kitchenOn = false;
  }
  if (bot.cam === "kitchen") {
    bot.kitchenTimer += dt;
    const aggro = botLevel(state, "freddy");
    const maxBoops = Math.floor((aggro / 20) * MAX_KITCHEN_BOOPS);
    if (bot.kitchenBoops < maxBoops && bot.boopCooldown <= 0) {
      if (Math.random() < (aggro / 20) * 0.1) {
        pushSfx(state, "boop", 0.7);
        bot.kitchenBoops += 1;
        bot.boopCooldown = BOOP_COOLDOWN;
      }
    }
    if (bot.kitchenTimer >= MAX_KITCHEN_TIME) {
      state.kitchenOn = false;
      resetBot(bot, FREDDY_PATHS.foodcourt_hallway);
      bot.prevCam = "stage";
    }
  } else {
    bot.kitchenTimer = 0;
  }
  bot.prevCam = bot.cam;
}

function stepBot(state, name, side, dt) {
  const cfg = state.ai[name];
  const bot = state.bots[name];
  if (!isActive(cfg, state.hour) || bot.inOffice) return null;
  if (name === "bonnie" && bot.inactiveTimer > 0) return null;
  if (name === "bonnie" && bot.sabotageState > 0) return null;

  if (processDoorBlock(state, name, side, dt)) return null;

  if (bot.cam === "doorway") {
    if (bot.officeTimer == null) bot.officeTimer = doorwayWait();
    bot.officeTimer -= dt;
    if (bot.officeTimer <= 0) return tryEnter(state, name, side);
    return null;
  }

  bot.moveTimer += dt;
  const extra = name === "bonnie" ? 2 : 0;
  const cooldown = moveCooldown(botLevel(state, name), extra);
  if (bot.moveTimer < cooldown) return null;
  bot.moveTimer = 0;

  const cornerCommit =
    name === "freddy" &&
    bot.cam === "rightCorner" &&
    !state.doors.right &&
    bot.path[bot.path.indexOf("rightCorner") + 1] === "doorway";

  const chance = moveChance(botLevel(state, name), { watched: watched(state, bot), freddy: name === "freddy" });
  if (!(Math.random() < chance || (cornerCommit && !watched(state, bot)))) {
    bot.failures += 1;
    if (bot.failures >= MOVE_RETREAT_AFTER_FAILURES) {
      const idx = bot.path.indexOf(bot.cam);
      if (idx > 0) noteMove(state, bot, bot.path[idx - 1]);
      bot.failures = 0;
    }
    return null;
  }

  bot.failures = 0;
  if (bot.cam === "stage" && !bot.pathPicked) {
    bot.path = (name === "freddy" ? pickFreddyPath() : pickBonniePath()).slice();
    bot.pathPicked = true;
  }

  const idx = bot.path.indexOf(bot.cam);
  if (idx < 0) {
    noteMove(state, bot, bot.path[0] || "stage");
    return null;
  }
  if (idx >= bot.path.length - 1) {
    if (bot.cam === "kitchen") return null;
    if (bot.cam === "parts") {
      resetBot(bot, BONNIE_PATHS.left_hallway);
      return null;
    }
    noteMove(state, bot, "doorway");
    bot.officeTimer = doorwayWait();
    return null;
  }
  noteMove(state, bot, bot.path[idx + 1]);
  if (bot.cam === "doorway") bot.officeTimer = doorwayWait();
  return null;
}

function updateDoorSlides(state, dt) {
  for (const side of ["left", "right"]) {
    const target = state.doors[side] ? 1 : 0;
    const cur = state.doorSlide[side];
    if (cur < target) state.doorSlide[side] = Math.min(target, cur + DOOR_SLIDE_SPEED * dt);
    else if (cur > target) state.doorSlide[side] = Math.max(target, cur - DOOR_SLIDE_SPEED * dt);
  }
}

export function updateNight(state, dt) {
  if (state.over) return state.over;

  state.hourTimer += dt;
  if (state.hourTimer >= HOUR_SECONDS) {
    state.hourTimer = 0;
    state.hour += 1;
    if (state.hour >= 6) {
      state.over = { type: "victory" };
      return state.over;
    }
  }

  if (state.cameraLock > 0) state.cameraLock -= dt;
  if (state.taskLock > 0) state.taskLock -= dt;
  if (state.bannerTimer > 0) {
    state.bannerTimer -= dt;
    if (state.bannerTimer <= 0) state.banner = "";
  }

  updateDoorSlides(state, dt);
  updateTasks(state.tasks, dt, state.taskLock > 0);

  let drain = POWER_BASE;
  if (state.doors.left) drain += POWER_DOOR;
  if (state.doors.right) drain += POWER_DOOR;
  if (state.lights.left) drain += POWER_LIGHT;
  if (state.lights.right) drain += POWER_LIGHT;
  if (state.night >= 4) drain *= 1.15;
  if (state.night >= 5) drain *= 1.1;
  if (!state.powerOutage) {
    state.power = Math.max(0, state.power - drain * dt);
  }
  if (state.charging && !state.camerasOpen && !state.powerOutage && state.power < 100) {
    state.chargeTimer += dt;
    if (state.chargeTimer >= GENERATOR_CHARGE_SECONDS) {
      state.chargeTimer -= GENERATOR_CHARGE_SECONDS;
      state.power = Math.min(100, state.power + GENERATOR_CHARGE_GAIN);
      state.chargePopups.push({ text: `+${GENERATOR_CHARGE_GAIN}`, life: 1, ttl: 1 });
    }
  } else {
    state.chargeTimer = Math.max(0, state.chargeTimer - dt * GENERATOR_DECAY_RATE);
  }
  if (state.chargePopups.length) {
    state.chargePopups = state.chargePopups.filter((popup) => {
      popup.life -= dt;
      return popup.life > 0;
    });
  }

  if (state.power <= 0) {
    if (!state.powerOutage) {
      state.powerOutage = true;
      state.powerOutPlayed = true;
      pushSfx(state, "powerOff", 0.9);
    }
    state.powerOutFade = Math.min(1, state.powerOutFade + dt / POWER_OUTAGE_FADE);
    state.doors.left = false;
    state.doors.right = false;
    state.lights.left = false;
    state.lights.right = false;
    state.camerasOpen = false;
    state.cameraLock = Math.max(state.cameraLock, 0.2);
  }

  const springCfg = state.ai.spring;
  if (isActive(springCfg, state.hour)) {
    state.bots.spring.spawned = true;
    state.bots.spring.cam = "frontDesk";
  }

  updateSabotage(state, dt);
  if (state.camerasDisabled > 0) state.camerasOpen = false;

  const fred = stepBot(state, "freddy", "right", dt);
  updateFreddyKitchen(state, dt);
  if (fred && fred.type === "defeat") {
    state.over = fred;
    return fred;
  }

  const bon = state.bots.bonnie;
  if (bon.cam === "parts" && !bon.sabotageAttempted && bon.sabotageState === 0 && bon.inactiveTimer <= 0) {
    bon.sabotageAttempted = true;
    trySabotage(state);
  }
  if (bon.cam !== "parts") bon.sabotageAttempted = false;

  const bonResult = stepBot(state, "bonnie", "left", dt);
  if (bonResult && bonResult.type === "defeat") {
    state.over = bonResult;
    return bonResult;
  }
  return fred || bonResult || null;
}

export function applyPassiveScare(state, by) {
  if (by === "freddy") {
    state.cameraLock = Math.max(state.cameraLock, 10);
    state.camerasOpen = false;
    if (Math.random() < 0.5) {
      state.taskLock = Math.max(state.taskLock, 15);
      state.banner = "Sabotage: Task Menu Locked (15s)";
    } else {
      state.bots.bonnie.sabotageBonus = Math.max(state.bots.bonnie.sabotageBonus || 0, 0.1);
      state.banner = "Sabotage: Bonnie Disruption +10%";
    }
    state.bannerTimer = 10;
  }
}

export function toggleDoor(state, side) {
  if (state.power <= 0 || state.powerOutage) return false;
  state.doors[side] = !state.doors[side];
  return true;
}

export function toggleLight(state, side) {
  if (state.power <= 0 || state.powerOutage) return false;
  state.lights[side] = !state.lights[side];
  return true;
}

export function camerasBlocked(state) {
  return !!(state.power <= 0 || state.powerOutage || state.cameraLock > 0 || state.camerasDisabled > 0);
}

export { CAMERAS, clockLabel, MAX_PLAYABLE_NIGHT };
