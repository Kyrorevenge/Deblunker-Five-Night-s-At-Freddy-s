import {
  loadSave,
  saveNight,
  startNewGame,
  markNightWon,
  markJumpscare,
  recordBoopSite,
  breakMarathon,
  autoSaveOn,
} from "./save.js";
import { loadLocalVersion, checkForUpdate } from "./version.js";
import {
  createNight,
  updateNight,
  toggleDoor,
  toggleLight,
  occupants,
  drainSfx,
  applyPassiveScare,
  camerasBlocked,
  hitBonnieSabotage,
  CAMERAS,
  clockLabel,
  MAX_PLAYABLE_NIGHT,
} from "./office.js";
import { NIGHT_INTRO_FEATURES, NIGHT_BRIEFING } from "./ai.js";
import {
  allTasksDone,
  PROP_ITEMS,
  BROWSER_CHECKOUT,
  holdCheckout,
  decayCheckout,
} from "./tasks.js";
import {
  initSettings,
  openSettings,
  closeSettings,
  getSetting,
} from "./settings.js";
import {
  PATHS,
  assetUrl,
  loadImage,
  playAudio,
  stopAudio,
  stopAllAudio,
  preloadCore,
  pausePlayingAudio,
  resumePausedAudio,
  refreshPlayingVolumes,
  getAudio,
  OFFICE_FRAMES,
  OFFICE_SOURCE,
  OFFICE_CONTROLS,
  OFFICE_DOORS,
  OFFICE_LAYERS,
  OFFICE_DOORWAY,
  OFFICE_SCALE_X,
  FRED_OFFICE_FRAMES,
  LIGHT_OVERLAY_ALPHA,
  HALLWAY_DIM_ALPHA,
  CAMERA_HUD_SCALE,
  CAMERA_HUD_MARGIN,
  CAMERA_HUD_BUTTON,
  POSTER_FRAMES,
  POSTER_FPS,
  HAZARD_BON_FPS,
  HAZARD_BON_FRAMES,
  CAM_STATIC,
  camStaticPath,
  CAMERA_FLIP,
  camFlipPath,
  BOOP_HITS,
  officeFrameKey,
  cameraSprite,
} from "./assets.js";
import { initCollections } from "./collections.js";

const scenes = {
  boot: document.getElementById("scene-boot"),
  warning: document.getElementById("scene-warning"),
  menu: document.getElementById("scene-menu"),
  newspaper: document.getElementById("scene-newspaper"),
  hazard: document.getElementById("scene-hazard"),
  nightcard: document.getElementById("scene-nightcard"),
  office: document.getElementById("scene-office"),
  victory: document.getElementById("scene-victory"),
  defeat: document.getElementById("scene-defeat"),
  install: document.getElementById("scene-install"),
  collections: document.getElementById("scene-collections"),
};

const WARNING_TEXT = "Warning: Players may be sensitive to flashing lights and jumpscares during gameplay.";
const WARNING_TYPE_SPEED = 42;

const pauseEl = document.getElementById("pause");
const perfEl = document.getElementById("perf-overlay");
const hud = document.getElementById("hud");
const clockEl = document.getElementById("hud-clock");
const powerEl = document.getElementById("hud-power");
const camView = document.getElementById("cam-view");
const camHudButtons = document.getElementById("cam-hud-buttons");
const officeStage = document.getElementById("office-stage");
const camLabel = document.getElementById("cam-label");
const camImage = document.getElementById("cam-image");
const camStaticEl = document.getElementById("cam-static");
const menuStaticEl = document.getElementById("menu-static");
const officeClock = document.getElementById("office-clock");
const officePower = document.getElementById("office-power");
const muteBtn = document.getElementById("btn-mute");
const chargeBtn = document.getElementById("btn-charge");
const continueBtn = document.getElementById("btn-continue");
const nightsPanel = document.getElementById("nights-panel");
const versionBadge = document.getElementById("version-badge");
const outdatedBanner = document.getElementById("outdated-banner");
const canvas = document.getElementById("office-canvas");
const ctx = canvas.getContext("2d");
const jumpscareEl = document.getElementById("jumpscare");
const jumpscareImg = document.getElementById("jumpscare-img");
const camBoop = document.getElementById("cam-boop");

let coreImages = {};
let currentScene = "menu";
let paused = false;
let nightState = null;
let lastTs = 0;
let raf = 0;
let panX = 0;
let drag = null;
let lastCamSrc = "";
let lightsBuzzing = false;
let menuRaf = 0;
let staticFrame = 0;
let staticTimer = 0;
let toastTimer = 0;
let startingNight = false;
let flip = { playing: false, reverse: false, frame: 0, timer: 0 };
let checkoutHeld = false;
let passiveScareUntil = 0;
const creaks = [PATHS.floorCreak1, PATHS.floorCreak2, PATHS.floorCreak3];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function gameFrozen() {
  return paused || !pauseEl.classList.contains("hidden");
}

function placeHit(el, x, y, w, h, spaceW, spaceH) {
  if (!el) return;
  el.style.left = `${(x / spaceW) * 100}%`;
  el.style.top = `${(y / spaceH) * 100}%`;
  el.style.width = `${(w / spaceW) * 100}%`;
  el.style.height = `${(h / spaceH) * 100}%`;
}

function layoutMenuBoop() {
  const spec = BOOP_HITS.menu;
  placeHit(document.getElementById("menu-boop"), spec.x, spec.y, spec.w, spec.h, spec.space[0], spec.space[1]);
}

function drawLayer(sheet, frame, dx, dy, dw = frame.w, dh = frame.h) {
  ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
}

function drawDoorwaySprite(state, side) {
  const bot = side === "left" ? state.bots.bonnie : state.bots.freddy;
  if (!bot || bot.cam !== "doorway") return;
  if (side === "left") {
    const img = coreImages[PATHS.hazardBon];
    if (!img) return;
    const h = img.naturalHeight || img.height;
    const w = img.naturalWidth || img.width;
    const scale = Math.min(1, OFFICE_DOORWAY.maxH / Math.max(1, h));
    ctx.drawImage(img, OFFICE_DOORWAY.left.x, OFFICE_DOORWAY.left.y, w * scale, h * scale);
    return;
  }
  const sheet = coreImages[PATHS.fredOffice] || coreImages[PATHS.fredOfficeAlt];
  if (sheet) {
    const frame = FRED_OFFICE_FRAMES.fred;
    const scale = Math.min(1, OFFICE_DOORWAY.maxH / frame.h);
    const dw = frame.w * scale;
    const dh = frame.h * scale;
    drawLayer(sheet, frame, OFFICE_DOORWAY.right.x, OFFICE_DOORWAY.right.y, dw, dh);
  }
}

function drawOfficeView() {
  const sheet = coreImages[PATHS.officeSheet];
  if (!sheet || !nightState) return;
  const src = OFFICE_SOURCE;
  canvas.width = src.w;
  canvas.height = src.h;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, src.w, src.h);

  const backdrop = OFFICE_FRAMES.backdrop;
  const backPos = OFFICE_LAYERS.backdrop;
  drawLayer(sheet, backdrop, backPos.x, backPos.y);
  drawDoorwaySprite(nightState, "left");
  drawDoorwaySprite(nightState, "right");

  ctx.fillStyle = `rgba(0, 0, 0, ${HALLWAY_DIM_ALPHA})`;
  const half = backdrop.w / 2;
  if (!nightState.lights.left) ctx.fillRect(backPos.x, backPos.y, half, backdrop.h);
  if (!nightState.lights.right) ctx.fillRect(backPos.x + half, backPos.y, backdrop.w - half, backdrop.h);

  ctx.globalAlpha = LIGHT_OVERLAY_ALPHA;
  if (nightState.lights.left) {
    const l = OFFICE_FRAMES.leftHallLight;
    const p = OFFICE_LAYERS.leftHallLight;
    drawLayer(sheet, l, p.x, p.y);
  }
  if (nightState.lights.right) {
    const r = OFFICE_FRAMES.rightHallLight;
    const p = OFFICE_LAYERS.rightHallLight;
    drawLayer(sheet, r, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  for (const side of ["left", "right"]) {
    const spec = side === "left" ? OFFICE_FRAMES.leftDoorSprite : OFFICE_FRAMES.rightDoorSprite;
    const pos = OFFICE_DOORS[side];
    const t = nightState.doorSlide[side];
    drawLayer(sheet, spec, lerp(pos.openX, pos.closedX, t), lerp(pos.openY, pos.closedY, t));
  }

  const facade = OFFICE_FRAMES[officeFrameKey(nightState.doors)];
  drawLayer(sheet, facade, 0, 0);

  const overlay = OFFICE_FRAMES.lightOverlay;
  ctx.globalAlpha = LIGHT_OVERLAY_ALPHA;
  drawLayer(sheet, overlay, 0, 0);
  ctx.globalAlpha = 1;
  layoutOfficeStage();
}

function layoutOfficeStage() {
  const view = document.getElementById("office-view");
  if (!view) return;
  const viewW = view.clientWidth;
  const viewH = view.clientHeight;
  officeStage.style.width = `${viewW * OFFICE_SCALE_X}px`;
  officeStage.style.height = `${viewH}px`;
  const hits = {
    "left-door": OFFICE_CONTROLS.leftDoor,
    "right-door": OFFICE_CONTROLS.rightDoor,
    "left-light": OFFICE_CONTROLS.leftLight,
    "right-light": OFFICE_CONTROLS.rightLight,
  };
  document.querySelectorAll("#office-hotspots [data-act]").forEach((btn) => {
    const spec = hits[btn.getAttribute("data-act")];
    if (!spec) return;
    btn.style.left = `${(spec.x / OFFICE_SOURCE.w) * 100}%`;
    btn.style.top = `${(spec.y / OFFICE_SOURCE.h) * 100}%`;
    btn.style.width = `${(spec.size / OFFICE_SOURCE.w) * 100}%`;
    btn.style.height = `${(spec.size / OFFICE_SOURCE.h) * 100}%`;
  });
  const officeBoop = BOOP_HITS.office;
  placeHit(
    document.getElementById("office-boop"),
    officeBoop.xPct * OFFICE_SOURCE.w,
    (officeBoop.y / officeBoop.space[1]) * OFFICE_SOURCE.h,
    officeBoop.w * (OFFICE_SOURCE.w / officeBoop.space[0]),
    officeBoop.h * (OFFICE_SOURCE.h / officeBoop.space[1]),
    OFFICE_SOURCE.w,
    OFFICE_SOURCE.h
  );
  const boop2 = BOOP_HITS.office2;
  placeHit(document.getElementById("office-boop-2"), boop2.x, boop2.y, boop2.w, boop2.h, boop2.space[0], boop2.space[1]);
  const desk = BOOP_HITS.frontDesk;
  placeHit(camBoop, desk.x, desk.y, desk.w, desk.h, desk.space[0], desk.space[1]);
  const max = Math.min(0, viewW - viewW * OFFICE_SCALE_X);
  panX = Math.max(max, Math.min(0, panX));
  officeStage.style.transform = `translateX(${panX}px)`;
  layoutCamHud();
}

function layoutCamHud() {
  const wrap = document.getElementById("cam-hud-wrap");
  const img = document.getElementById("cam-hud");
  if (!wrap || !img) return;
  const native = img.naturalWidth || 0;
  if (native) wrap.style.width = `${native * CAMERA_HUD_SCALE}px`;
  wrap.style.right = `${CAMERA_HUD_MARGIN}px`;
  wrap.style.bottom = `${CAMERA_HUD_MARGIN}px`;
  wrap.querySelectorAll(".hud-cam").forEach((btn) => {
    btn.style.width = `${CAMERA_HUD_BUTTON}px`;
    btn.style.height = `${CAMERA_HUD_BUTTON}px`;
  });
}

function staticFrames() {
  const frames = [];
  for (let i = 1; i <= CAM_STATIC.frames; i += 1) {
    const img = coreImages[camStaticPath(i)];
    if (img) frames.push(img);
  }
  return frames;
}

function drawStaticOn(canvasEl, hostEl) {
  if (!canvasEl || !hostEl) return;
  const list = staticFrames();
  const w = Math.max(1, Math.floor(hostEl.clientWidth * CAM_STATIC.scale));
  const h = Math.max(1, Math.floor(hostEl.clientHeight * CAM_STATIC.scale));
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
  }
  const sctx = canvasEl.getContext("2d");
  sctx.clearRect(0, 0, w, h);
  sctx.globalAlpha = CAM_STATIC.alpha;
  if (list.length) {
    const frame = list[staticFrame % list.length];
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(frame, 0, 0, w, h);
    return;
  }
  const img = sctx.createImageData(w, h);
  for (let p = 0; p < img.data.length; p += 4) {
    const v = Math.random() * 255;
    img.data[p] = v;
    img.data[p + 1] = v;
    img.data[p + 2] = v;
    img.data[p + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
}

function drawCamStatic() {
  if (!nightState || !nightState.camerasOpen) return;
  drawStaticOn(camStaticEl, document.getElementById("office-view"));
}

function drawMenuStatic() {
  drawStaticOn(menuStaticEl, document.getElementById("menu-stage"));
}

function setMenuArt() {
  const bg = coreImages[PATHS.menuBg];
  const light = coreImages[PATHS.menuLight];
  const bgEl = document.getElementById("menu-bg");
  const lightEl = document.getElementById("menu-light");
  if (bg) bgEl.src = bg.src;
  if (light) lightEl.src = light.src;
  drawPosterFrame(0);
  layoutMenuBoop();
  const hudArt = coreImages[PATHS.camHud] || coreImages[PATHS.camHudAlt];
  const hudEl = document.getElementById("cam-hud");
  if (hudArt) {
    hudEl.src = hudArt.src;
    hudEl.classList.remove("hidden");
  } else hudEl.classList.add("hidden");
  if (coreImages[PATHS.jumpscare]) jumpscareImg.src = coreImages[PATHS.jumpscare].src;
  const news = coreImages[PATHS.newspaper];
  const newsEl = document.getElementById("newspaper-img");
  if (news && newsEl) newsEl.src = news.src;
}

function drawPosterFrame(index) {
  const sheet = coreImages[PATHS.posterSheet] || coreImages[PATHS.posterSheetAlt];
  const canvasEl = document.getElementById("menu-poster");
  if (!sheet || !canvasEl) return;
  const frame = POSTER_FRAMES[index % POSTER_FRAMES.length];
  canvasEl.width = frame.w;
  canvasEl.height = frame.h;
  const pctx = canvasEl.getContext("2d");
  pctx.clearRect(0, 0, frame.w, frame.h);
  pctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
}

function startMenuAnim() {
  cancelAnimationFrame(menuRaf);
  if (getSetting("Reduce Motion")) {
    drawPosterFrame(0);
    drawMenuStatic();
    return;
  }
  let last = performance.now();
  const tick = (ts) => {
    if (currentScene !== "menu") return;
    const dt = Math.min(0.1, (ts - last) / 1000);
    last = ts;
    staticTimer += dt;
    if (staticTimer >= 1 / CAM_STATIC.fps) {
      staticTimer = 0;
      staticFrame += 1;
    }
    drawPosterFrame(Math.floor(ts / (1000 / POSTER_FPS)));
    drawMenuStatic();
    tickPerf(dt);
    menuRaf = requestAnimationFrame(tick);
  };
  menuRaf = requestAnimationFrame(tick);
}

function playMenuMusic() {
  stopAudio(PATHS.ambience);
  stopAudio(PATHS.fan);
  playAudio(PATHS.menuMusic, { loop: true, volume: 0.45 });
}

function playOfficeAudio() {
  stopAudio(PATHS.menuMusic);
  playAudio(PATHS.ambience, { loop: true, volume: 0.55, restart: false });
  playAudio(PATHS.fan, { loop: true, volume: 0.2, restart: false });
}

function syncLightBuzz() {
  const on = !!(nightState && (nightState.lights.left || nightState.lights.right) && nightState.power > 0);
  if (on && !lightsBuzzing) {
    playAudio(PATHS.buzz, { loop: true, volume: 0.25 });
    lightsBuzzing = true;
  } else if (!on && lightsBuzzing) {
    stopAudio(PATHS.buzz);
    lightsBuzzing = false;
  }
}

function showScene(name) {
  currentScene = name;
  Object.entries(scenes).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== name);
  });
  hud.classList.toggle("hidden", name !== "office");
  document.getElementById("menu-btn").classList.toggle("hidden", name !== "office");
  pauseEl.classList.add("hidden");
  nightsPanel.classList.add("hidden");
  closeSettings();
  scenes.office.classList.remove("paused-office");
  paused = false;
  if (name === "menu") {
    playMenuMusic();
    startMenuAnim();
    layoutMenuBoop();
  }
}

function refreshContinue() {
  const save = loadSave();
  continueBtn.disabled = !save.hasSave;
  continueBtn.classList.toggle("locked", !save.hasSave);
  const sub = document.getElementById("continue-night");
  if (sub) sub.textContent = save.hasSave ? `NIGHT ${save.night}` : "";
}

function buildNightPicks() {
  const root = document.getElementById("menu-night-picks");
  if (!root) return;
  root.innerHTML = "";
  for (let n = 1; n <= 5; n += 1) {
    const btn = document.createElement("button");
    const locked = n > MAX_PLAYABLE_NIGHT;
    btn.className = `night-pick${locked ? " locked" : ""}`;
    btn.type = "button";
    btn.textContent = locked ? `NIGHT ${n}` : `NIGHT ${n}`;
    btn.disabled = locked;
    if (!locked) {
      btn.addEventListener("click", () => {
        nightsPanel.classList.add("hidden");
        beginNight(n, { newspaper: n === 1 });
      });
    }
    root.appendChild(btn);
  }
}

function buildCamHud() {
  camHudButtons.innerHTML = "";
  CAMERAS.forEach((cam) => {
    const btn = document.createElement("button");
    btn.className = "hud-cam";
    btn.type = "button";
    btn.dataset.cam = cam.id;
    btn.style.left = `${cam.hud[0] * 100}%`;
    btn.style.top = `${cam.hud[1] * 100}%`;
    btn.innerHTML = `<span>${cam.name}</span>`;
    btn.addEventListener("click", () => {
      if (!nightState || gameFrozen()) return;
      nightState.currentCam = cam.id;
      playAudio(PATHS.camera, { volume: 0.4 });
      renderOffice();
    });
    camHudButtons.appendChild(btn);
  });
}

function renderOffice() {
  if (!nightState) return;
  clockEl.textContent = clockLabel(nightState.hour);
  powerEl.textContent = `${Math.floor(nightState.power)}%`;
  if (officeClock) officeClock.textContent = clockLabel(nightState.hour);
  const powerPct = Math.max(0, Math.min(100, nightState.power));
  const powerLabel = document.getElementById("power-label");
  if (powerLabel) powerLabel.textContent = `Power: ${Math.floor(powerPct)}%`;
  document.querySelector('[data-act="left-door"]').classList.toggle("active", nightState.doors.left);
  document.querySelector('[data-act="right-door"]').classList.toggle("active", nightState.doors.right);
  document.querySelector('[data-act="left-light"]').classList.toggle("active", nightState.lights.left);
  document.querySelector('[data-act="right-light"]').classList.toggle("active", nightState.lights.right);
  document.getElementById("btn-cameras").classList.toggle("active", nightState.camerasOpen);
  chargeBtn.classList.toggle("hidden", nightState.camerasOpen || nightState.powerOutage || nightState.power >= 100);
  if (officePower) officePower.classList.toggle("hidden", nightState.powerOutage);
  const powerFill = document.getElementById("power-fill");
  if (powerFill) {
    const pct = Math.max(0, Math.min(1, nightState.power / 100));
    powerFill.style.width = `${pct * 100}%`;
    powerFill.classList.toggle("low", pct <= 0.2);
  }
  const popRoot = document.getElementById("power-popups");
  if (popRoot) {
    popRoot.innerHTML = (nightState.chargePopups || [])
      .map((popup) => {
        const alpha = Math.max(0, popup.life / Math.max(0.001, popup.ttl));
        return `<span class="power-popup" style="opacity:${alpha};transform:translateY(${(1 - alpha) * -14}px)">${popup.text}</span>`;
      })
      .join("");
  }
  camView.classList.toggle("hidden", !nightState.camerasOpen || flip.playing);
  const blackout = document.getElementById("power-blackout");
  if (blackout) {
    blackout.classList.toggle("hidden", !nightState.powerOutage);
    blackout.style.opacity = String(nightState.powerOutFade || 0);
  }
  const banner = document.getElementById("office-banner");
  if (banner) {
    banner.textContent = nightState.banner || "";
    banner.classList.toggle("hidden", !nightState.banner);
  }
  const disabled = document.getElementById("cam-disabled");
  if (disabled) disabled.classList.toggle("hidden", !(nightState.camerasDisabled > 0 && nightState.camerasOpen));
  const sabBtn = document.getElementById("sabotage-hit");
  const sab = nightState.bots.bonnie;
  const showSab = nightState.camerasOpen && nightState.currentCam === "parts" && sab.sabotageState === 2;
  if (sabBtn) {
    sabBtn.classList.toggle("hidden", !showSab);
    if (showSab) sabBtn.textContent = `Hits ${sab.sabotageHits}/25`;
  }
  muteBtn.classList.toggle("hidden", !nightState.callActive || nightState.muted);
  camBoop.classList.toggle("hidden", !nightState.camerasOpen || nightState.currentCam !== "frontDesk");
  drawOfficeView();
  if (nightState.camerasOpen) drawCamStatic();
  drawCamFlip();
  const cam = CAMERAS.find((c) => c.id === nightState.currentCam) || CAMERAS[0];
  camLabel.textContent = `${cam.name} — ${cam.label}`;
  camHudButtons.querySelectorAll(".hud-cam").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.cam === cam.id);
  });
  const kitchenOnly = nightState.camerasOpen && nightState.currentCam === "kitchen";
  camView.classList.toggle("sound-only", kitchenOnly);
  const soundOnly = document.getElementById("cam-sound-only");
  if (soundOnly) soundOnly.classList.toggle("hidden", !kitchenOnly);
  camImage.classList.toggle("hidden", kitchenOnly);
  if (kitchenOnly) {
    camImage.removeAttribute("src");
    lastCamSrc = "";
  } else {
    const src = assetUrl(cameraSprite(cam.id, occupants(nightState, cam.id), { bonnieSabotage: sab.sabotageState }));
    if (src !== lastCamSrc) {
      camImage.src = src;
      lastCamSrc = src;
    }
  }
  syncLightBuzz();
  syncKitchenAudio();
  renderTasks();
  if (nightState.powerOutage) {
    stopAudio(PATHS.ambience);
    stopAudio(PATHS.fan);
  }
}

function drawCamFlip() {
  const canvasEl = document.getElementById("cam-flip");
  if (!canvasEl) return;
  if (!flip.playing) {
    canvasEl.classList.add("hidden");
    return;
  }
  const idx = Math.max(1, Math.min(CAMERA_FLIP.frames, flip.frame + 1));
  const img = coreImages[camFlipPath(idx)];
  canvasEl.classList.remove("hidden");
  const w = canvasEl.clientWidth || 320;
  const h = canvasEl.clientHeight || 180;
  canvasEl.width = w;
  canvasEl.height = h;
  const fctx = canvasEl.getContext("2d");
  fctx.fillStyle = "#000";
  fctx.fillRect(0, 0, w, h);
  if (img) fctx.drawImage(img, 0, 0, w, h);
}

function startCamFlip(open) {
  if (flip.playing || !nightState) return;
  flip.playing = true;
  flip.reverse = !open;
  flip.frame = open ? 0 : CAMERA_FLIP.frames - 1;
  flip.timer = 0;
  playAudio(PATHS.camera, { volume: 0.5 });
  if (!open) nightState.camerasOpen = false;
}

function tickCamFlip(dt) {
  if (!flip.playing) return;
  flip.timer += dt;
  if (flip.timer < 1 / CAMERA_FLIP.fps) return;
  flip.timer = 0;
  flip.frame += flip.reverse ? -1 : 1;
  if (flip.frame < 0 || flip.frame >= CAMERA_FLIP.frames) {
    flip.playing = false;
    if (!flip.reverse && nightState && !camerasBlocked(nightState)) nightState.camerasOpen = true;
    if (flip.reverse && nightState) nightState.camerasOpen = false;
  }
}

function playQueuedSfx(state) {
  drainSfx(state).forEach((item) => {
    if (item.name === "creak") {
      const rel = creaks[Math.floor(Math.random() * creaks.length)];
      playAudio(rel, { volume: item.volume });
    } else if (item.name === "boop") {
      playAudio(PATHS.boop, { volume: item.volume });
    } else if (item.name === "powerOff") {
      playAudio(PATHS.powerOff, { volume: item.volume });
    }
  });
}

function syncKitchenAudio() {
  if (!nightState) {
    stopAudio(PATHS.kitchenAmbience);
    return;
  }
  if (nightState.kitchenOn && nightState.bots.freddy.cam === "kitchen") {
    const vol = nightState.camerasOpen && nightState.currentCam === "kitchen" ? 0.4 : 0.1;
    playAudio(PATHS.kitchenAmbience, { loop: true, volume: vol, restart: false });
  } else {
    stopAudio(PATHS.kitchenAmbience);
  }
}

function renderTasks() {
  const handle = document.getElementById("task-handle");
  const drawer = document.getElementById("task-drawer");
  const list = document.getElementById("task-list");
  const endBtn = document.getElementById("task-end");
  const lockEl = document.getElementById("task-lock");
  const ui = nightState && nightState.tasks;
  if (!handle || !drawer || !list) return;
  const show = !!(ui && ui.enabled && nightState.camerasOpen);
  handle.classList.toggle("hidden", !show);
  if (!show) {
    drawer.classList.remove("open");
    document.getElementById("order-browser")?.classList.add("hidden");
    return;
  }
  handle.textContent = ui.open ? "<" : ">";
  drawer.classList.toggle("open", ui.open);
  if (lockEl) {
    lockEl.classList.toggle("hidden", !(nightState.taskLock > 0));
    lockEl.textContent = nightState.taskLock > 0 ? `LOCKED ${Math.ceil(nightState.taskLock)}s` : "";
  }
  if (ui.holdId) {
    const task = ui.tasks.find((t) => t.id === ui.holdId);
    const bar = list.querySelector(`[data-task="${ui.holdId}"] .bar > span`);
    if (task && bar) {
      const pct = Math.round(((task.progress || 0) / Math.max(0.001, task.duration || 1)) * 100);
      bar.style.width = `${task.completed ? 100 : pct}%`;
    }
  } else {
  list.innerHTML = ui.tasks.map((task) => {
    const pct = task.type === "browser"
      ? (task.completed ? 100 : 0)
      : Math.round(((task.progress || 0) / Math.max(0.001, task.duration || 1)) * 100);
    const extra = task.type === "counter_hold" ? ` ${task.count || 0}/${task.target}` : "";
    return `<button class="task-row${task.completed ? " done" : ""}" type="button" data-task="${task.id}">
      <span>${task.label}${extra}</span>
      <span class="bar"><span style="width:${task.completed ? 100 : pct}%"></span></span>
    </button>`;
  }).join("");
  if (endBtn) endBtn.classList.toggle("hidden", !allTasksDone(ui.tasks));
  const browser = document.getElementById("order-browser");
  if (browser) {
    browser.classList.toggle("hidden", !ui.browserOpen);
    const items = document.getElementById("order-items");
    if (items && ui.browserOpen) {
      items.innerHTML = PROP_ITEMS.map((name) => {
        const on = ui.selected.includes(name);
        return `<button class="order-item${on ? " on" : ""}" type="button" data-prop="${name}">${on ? "[x] " : "[ ] "}${name}</button>`;
      }).join("");
    }
    const checkout = document.getElementById("order-checkout");
    if (checkout) {
      checkout.disabled = ui.selected.length < PROP_ITEMS.length;
      const pct = Math.round((ui.checkout / BROWSER_CHECKOUT) * 100);
      checkout.textContent = ui.selected.length < PROP_ITEMS.length
        ? "Hold Checkout"
        : `Hold Checkout ${pct}%`;
    }
  }
  }
}

function playJumpscare(by = "freddy") {
  jumpscareEl.classList.toggle("no-gore", !getSetting("Gore"));
  const art = by === "bonnie"
    ? (coreImages[PATHS.jumpscareBonnie] || coreImages[PATHS.hazardBon])
    : coreImages[PATHS.jumpscare];
  if (art) jumpscareImg.src = art.src;
  jumpscareEl.classList.remove("hidden");
  playAudio(PATHS.jumpscareSfx, { volume: 1 });
  return new Promise((resolve) => setTimeout(resolve, 2200));
}

function playPassiveScare() {
  const el = document.getElementById("passive-scare");
  const img = document.getElementById("passive-scare-img");
  const frame = coreImages[PATHS.jumpscarePassive1] || coreImages[PATHS.jumpscarePassive2];
  if (img && frame) img.src = frame.src;
  if (el) {
    el.classList.toggle("no-gore", !getSetting("Gore"));
    el.classList.remove("hidden");
  }
  playAudio(PATHS.boop, { volume: 0.9 });
  passiveScareUntil = performance.now() + 2000;
}

function hidePassiveScare() {
  document.getElementById("passive-scare")?.classList.add("hidden");
}

let achCache = [];

async function loadAchievements() {
  if (achCache.length) return achCache;
  try {
    const res = await fetch("./data/achievements.json", { cache: "no-store" });
    achCache = res.ok ? await res.json() : [];
  } catch {
    achCache = [];
  }
  return achCache;
}

async function toastUnlocks(ids) {
  if (!ids || !ids.length) return;
  const list = await loadAchievements();
  const lookup = ids.map((id) => list.find((a) => a.id === id)).filter(Boolean);
  playAudio(PATHS.achievement, { volume: 0.85 });
  const toast = document.getElementById("ach-toast");
  for (const ach of lookup.length ? lookup : ids.map((id) => ({ id, name: id, description: "", image: "" }))) {
    document.getElementById("ach-toast-name").textContent = ach.name || ach.id;
    document.getElementById("ach-toast-desc").textContent = ach.description || "";
    const img = document.getElementById("ach-toast-img");
    if (ach.image) {
      img.src = assetUrl(ach.image);
      img.classList.remove("hidden");
    } else img.classList.add("hidden");
    toast.classList.remove("hidden");
    await new Promise((resolve) => {
      toastTimer = setTimeout(resolve, 2400);
    });
  }
  toast.classList.add("hidden");
}

function fireBoop(site) {
  playAudio(PATHS.boop, { volume: 0.9 });
  toastUnlocks(recordBoopSite(site));
}

async function endNight(result) {
  cancelAnimationFrame(raf);
  raf = 0;
  nightState.over = result;
  stopAudio(PATHS.ambience);
  stopAudio(PATHS.fan);
  stopAudio(PATHS.buzz);
  stopAudio(PATHS.nightCall);
  stopAudio(PATHS.kitchenAmbience);
  hidePassiveScare();
  lightsBuzzing = false;
  if (result.type === "victory") {
    const next = nightState.night >= MAX_PLAYABLE_NIGHT ? MAX_PLAYABLE_NIGHT : nightState.night + 1;
    persistAutosave(next);
    const unlocked = markNightWon(nightState.night);
    playAudio(PATHS.applause, { volume: 0.7 });
    document.getElementById("victory-title").textContent = "6 AM";
    document.getElementById("victory-cap").textContent =
      nightState.night >= MAX_PLAYABLE_NIGHT
        ? `NIGHT ${nightState.night} SURVIVED — later nights are locked on mobile`
        : `NIGHT ${nightState.night} SURVIVED`;
    document.getElementById("btn-next-night").classList.toggle("hidden", nightState.night >= MAX_PLAYABLE_NIGHT);
    showScene("victory");
    toastUnlocks(unlocked);
  } else {
    await playJumpscare(result.by);
    jumpscareEl.classList.add("hidden");
    const unlocked = markJumpscare(result.by);
    document.getElementById("defeat-cap").textContent = `Jumpscared by ${result.by}`;
    showScene("defeat");
    toastUnlocks(unlocked);
  }
}

function tickPerf(dt) {
  if (!perfEl || !getSetting("Performance Overlay")) return;
  const fps = dt > 0 ? Math.round(1 / dt) : 0;
  perfEl.textContent = `FPS ${fps}`;
}

function loop(ts) {
  if (!nightState || currentScene !== "office") return;
  const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  tickPerf(dt);
  if (passiveScareUntil && ts >= passiveScareUntil) {
    hidePassiveScare();
    passiveScareUntil = 0;
  }
  if (!gameFrozen()) {
    staticTimer += dt;
    if (staticTimer >= 1 / CAM_STATIC.fps) {
      staticTimer = 0;
      staticFrame += 1;
    }
    tickCamFlip(dt);
    const ui = nightState.tasks;
    if (ui && checkoutHeld) holdCheckout(ui, dt);
    else if (ui) decayCheckout(ui, dt);
    const result = updateNight(nightState, dt);
    playQueuedSfx(nightState);
    renderOffice();
    if (result && result.type === "scare") {
      toastUnlocks(markJumpscare(result.by));
      applyPassiveScare(nightState, result.by);
      if (result.by === "freddy") playPassiveScare();
    } else if (result && (result.type === "victory" || result.type === "defeat")) {
      endNight(result);
      return;
    }
  }
  raf = requestAnimationFrame(loop);
}

function persistAutosave(night) {
  if (!autoSaveOn()) return;
  const n = night != null ? night : nightState ? nightState.night : loadSave().night;
  saveNight(n);
}

function enterOffice(n) {
  const night = Math.max(1, Math.min(MAX_PLAYABLE_NIGHT, n));
  nightState = createNight(night);
  persistAutosave(night);
  lastCamSrc = "";
  panX = 0;
  staticFrame = 0;
  staticTimer = 0;
  flip = { playing: false, reverse: false, frame: 0, timer: 0 };
  checkoutHeld = false;
  hidePassiveScare();
  playOfficeAudio();
  if (night === 1) playAudio(PATHS.nightCall, { volume: 0.7, restart: false });
  showScene("office");
  renderOffice();
  lastTs = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function waitSkip(ms, root, skipState) {
  return new Promise((resolve) => {
    if (skipState.skipped) {
      resolve();
      return;
    }
    let done = false;
    const finish = (skipped) => {
      if (done) return;
      done = true;
      if (skipped) skipState.skipped = true;
      clearTimeout(timer);
      root.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      resolve();
    };
    const onPointer = () => finish(true);
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") finish(true);
    };
    const timer = setTimeout(() => finish(false), ms);
    root.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
  });
}

async function playBootVideo() {
  const root = scenes.boot;
  const video = document.getElementById("boot-video");
  const startHint = document.getElementById("boot-start");
  const skipHint = document.getElementById("boot-skip");
  if (!root || !video) return;
  showScene("boot");
  stopAudio(PATHS.menuMusic);
  video.src = assetUrl(PATHS.bootVideo);
  video.preload = "auto";
  try {
    video.currentTime = 0;
  } catch {
    /* ignore */
  }
  startHint?.classList.add("hidden");
  skipHint?.classList.add("hidden");

  const missing = await new Promise((resolve) => {
    if (video.error) {
      resolve(true);
      return;
    }
    if (video.readyState >= 2) {
      resolve(false);
      return;
    }
    const finish = (failed) => {
      clearTimeout(timer);
      video.removeEventListener("error", onErr);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      resolve(failed);
    };
    const timer = setTimeout(() => finish(true), 12000);
    const onErr = () => finish(true);
    const onReady = () => finish(false);
    video.addEventListener("error", onErr);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
  });
  if (missing) return;

  const waitPlayOrSkip = () =>
    new Promise((resolve) => {
      let done = false;
      const finish = (skipped) => {
        if (done) return;
        done = true;
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onEnded);
        root.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("keydown", onKey);
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        video.removeAttribute("src");
        try {
          video.load();
        } catch {
          /* ignore */
        }
        resolve(skipped);
      };
      const onEnded = () => finish(false);
      const onPointer = () => finish(true);
      const onKey = (e) => {
        if (e.key === "Enter" || e.key === " ") finish(true);
      };
      video.addEventListener("ended", onEnded);
      video.addEventListener("error", onEnded);
      root.addEventListener("pointerdown", onPointer);
      window.addEventListener("keydown", onKey);
    });

  let started = false;
  try {
    const play = video.play();
    if (play && typeof play.then === "function") await play;
    started = !video.paused;
  } catch {
    started = false;
  }

  if (!started) {
    startHint?.classList.remove("hidden");
    await new Promise((resolve) => {
      const begin = async () => {
        startHint?.classList.add("hidden");
        root.removeEventListener("pointerdown", begin);
        window.removeEventListener("keydown", onKey);
        try {
          await video.play();
        } catch {
          resolve();
          return;
        }
        resolve();
      };
      const onKey = (e) => {
        if (e.key === "Enter" || e.key === " ") begin();
      };
      root.addEventListener("pointerdown", begin);
      window.addEventListener("keydown", onKey);
    });
  }

  if (video.error || video.readyState === 0) return;
  skipHint?.classList.remove("hidden");
  await waitPlayOrSkip();
}

async function playWarning() {
  const root = scenes.warning;
  const textEl = document.getElementById("warning-text");
  const promptEl = document.getElementById("warning-prompt");
  if (!root || !textEl) return;
  showScene("warning");
  stopAudio(PATHS.menuMusic);
  textEl.textContent = "";
  textEl.style.opacity = "1";
  if (promptEl) {
    promptEl.textContent = "Tap to skip";
    promptEl.style.opacity = "1";
  }

  let chars = 0;
  let typingDone = false;
  let phase = "typing";
  let phaseStart = performance.now();
  let last = phaseStart;

  await new Promise((resolve) => {
    const accept = () => {
      if (phase !== "typing") return;
      if (!typingDone) {
        typingDone = true;
        chars = WARNING_TEXT.length;
        return;
      }
      playAudio(PATHS.warningAccept, { volume: 0.7 });
      phase = "flash";
      phaseStart = performance.now();
    };
    const onPointer = () => accept();
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " ") accept();
    };
    root.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phase === "typing") {
        if (!typingDone) {
          chars = Math.min(WARNING_TEXT.length, chars + WARNING_TYPE_SPEED * dt);
          if (chars >= WARNING_TEXT.length) typingDone = true;
        }
        textEl.textContent = WARNING_TEXT.slice(0, Math.floor(chars));
        textEl.style.opacity = "1";
        if (promptEl) {
          promptEl.textContent = typingDone ? "Tap to continue" : "Tap to skip";
          promptEl.style.opacity = "1";
        }
      } else if (phase === "flash") {
        const elapsed = now - phaseStart;
        const visible = Math.floor(elapsed / 120) % 2 === 0;
        textEl.textContent = WARNING_TEXT;
        textEl.style.opacity = visible ? "1" : "0";
        if (promptEl) promptEl.style.opacity = visible ? "1" : "0";
        if (elapsed >= 850) {
          phase = "fade";
          phaseStart = now;
        }
      } else if (phase === "fade") {
        const elapsed = now - phaseStart;
        const fade = Math.min(1, elapsed / 750);
        textEl.textContent = WARNING_TEXT;
        textEl.style.opacity = String(1 - fade);
        if (promptEl) promptEl.style.opacity = String(1 - fade);
        if (elapsed >= 750) {
          phase = "hold";
          phaseStart = now;
          textEl.style.opacity = "0";
          if (promptEl) promptEl.style.opacity = "0";
        }
      } else if (now - phaseStart >= 220) {
        root.removeEventListener("pointerdown", onPointer);
        window.removeEventListener("keydown", onKey);
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function playBootSequence() {
  if (getSetting("Skip Intro")) return;
  await playBootVideo();
  await playWarning();
}

async function playNewspaper() {
  const root = scenes.newspaper;
  const img = document.getElementById("newspaper-img");
  const skipState = { skipped: false };
  showScene("newspaper");
  stopAudio(PATHS.menuMusic);
  if (!img || !img.src) return;
  img.style.opacity = "0";
  img.style.transition = "opacity 3s linear";
  requestAnimationFrame(() => {
    img.style.opacity = "1";
  });
  await waitSkip(3000, root, skipState);
  if (skipState.skipped) {
    img.style.transition = "none";
    img.style.opacity = "0";
    return;
  }
  await waitSkip(3000, root, skipState);
  if (skipState.skipped) {
    img.style.transition = "none";
    img.style.opacity = "0";
    return;
  }
  img.style.transition = "opacity 3s linear";
  img.style.opacity = "0";
  await waitSkip(3000, root, skipState);
}

function easeOutCubic(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - (1 - t) ** 3;
}

function startNightCall(night) {
  if (night !== 1) return;
  playAudio(PATHS.nightCall, { volume: 0.7 });
}

function hazardCardForNight(n) {
  const card = { ...(NIGHT_BRIEFING[n] || {}) };
  if (n === 3) {
    card.portrait = "hazardBonSheet";
    card.anim = true;
  }
  return card;
}

async function ensureCoreImage(rel) {
  if (!rel) return null;
  if (coreImages[rel]) return coreImages[rel];
  try {
    coreImages[rel] = await loadImage(rel);
  } catch {
    coreImages[rel] = null;
  }
  return coreImages[rel];
}

function drawHazardPortrait(card, frameIndex) {
  const canvas = document.getElementById("hazard-portrait");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const path = PATHS[card.portrait];
  const art = path ? coreImages[path] : null;
  if (!art) {
    canvas.classList.add("hidden");
    return;
  }
  canvas.classList.remove("hidden");
  if (card.anim) {
    const spec = HAZARD_BON_FRAMES[frameIndex % HAZARD_BON_FRAMES.length];
    canvas.width = spec.w;
    canvas.height = spec.h;
    ctx.clearRect(0, 0, spec.w, spec.h);
    ctx.drawImage(art, spec.x, spec.y, spec.w, spec.h, 0, 0, spec.w, spec.h);
  } else {
    const w = art.naturalWidth || art.width;
    const h = art.naturalHeight || art.height;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(art, 0, 0);
  }
}

async function playHazard(n) {
  const card = hazardCardForNight(n);
  if (!card || !card.name) return;
  const portrait = document.getElementById("hazard-portrait");
  const warning = document.getElementById("hazard-warning");
  const copy = document.getElementById("hazard-copy");
  const desc = document.getElementById("hazard-desc");
  const begin = document.getElementById("hazard-begin");
  showScene("hazard");
  stopAudio(PATHS.menuMusic);
  playAudio(PATHS.hazard, { volume: 0.9 });
  document.getElementById("hazard-night").textContent = `NIGHT ${n}`;
  document.getElementById("hazard-name").textContent = card.name;
  document.getElementById("hazard-sub").textContent = card.subtitle;
  await ensureCoreImage(PATHS[card.portrait]);
  drawHazardPortrait(card, 0);
  portrait.style.opacity = "0";
  portrait.style.transform = "translateX(110%)";
  warning.style.opacity = "1";
  copy.style.opacity = "0";
  desc.textContent = "";
  let mode = "warning";
  let clock = 0;
  let reveal = 0;
  let type = 0;
  let bonFrame = 0;
  let bonTimer = 0;
  let finished = false;
  const finish = () => { finished = true; };
  begin.addEventListener("click", finish, { once: true });
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") finish();
  };
  window.addEventListener("keydown", onKey);

  await new Promise((resolve) => {
    let last = performance.now();
    const tick = (now) => {
      if (finished) {
        resolve();
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      if (card.anim && mode === "reveal" && reveal > 0.01) {
        bonTimer += dt;
        if (bonTimer >= 1 / HAZARD_BON_FPS) {
          bonTimer = 0;
          bonFrame += 1;
          drawHazardPortrait(card, bonFrame);
        }
      }
      if (mode === "warning" && clock >= 3) mode = "reveal";
      if (mode === "reveal") {
        reveal = Math.min(1, reveal + dt / 2.4);
        if (reveal >= 0.3) type = Math.min(1, type + dt / 3);
      }
      const fade = mode === "warning" ? 1 : Math.max(0, 1 - reveal / 0.85);
      warning.style.opacity = String(fade);
      warning.classList.toggle("flash", Math.floor(clock * 5) % 2 === 1);
      const slide = easeOutCubic(reveal);
      portrait.style.opacity = reveal > 0.01 ? "1" : "0";
      portrait.style.transform = `translateX(${(1 - slide) * 110}%)`;
      copy.style.opacity = slide > 0.18 ? String(Math.min(1, (slide - 0.18) / 0.35)) : "0";
      const full = card.description;
      const vis = Math.floor(full.length * type);
      let shown = full.slice(0, vis);
      if (type < 1 && vis < full.length && Math.floor(clock * 8) % 2 === 0) shown += "_";
      desc.textContent = shown;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  window.removeEventListener("keydown", onKey);
  stopAudio(PATHS.hazard);
}

async function playNightCard(n) {
  document.getElementById("nightcard-title").textContent = `Night ${n}`;
  const list = document.getElementById("nightcard-features");
  list.innerHTML = (NIGHT_INTRO_FEATURES[n] || []).map((line) => `<li>• ${line}</li>`).join("");
  showScene("nightcard");
  stopAudio(PATHS.menuMusic);
  playAudio(PATHS.ambience, { loop: true, volume: 0.55, restart: false });
  startNightCall(n);
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

async function beginNight(n, { newspaper = n === 1 } = {}) {
  if (startingNight) return;
  startingNight = true;
  cancelAnimationFrame(raf);
  raf = 0;
  try {
    const night = Math.max(1, Math.min(MAX_PLAYABLE_NIGHT, n));
    persistAutosave(night);
    if (newspaper && night === 1 && !getSetting("Skip Intro")) await playNewspaper();
    await playHazard(night);
    await playNightCard(night);
    enterOffice(night);
  } finally {
    startingNight = false;
  }
}

function goMenu({ abandonNight = false } = {}) {
  cancelAnimationFrame(raf);
  raf = 0;
  if (abandonNight && nightState && !nightState.over) breakMarathon();
  nightState = null;
  stopAllAudio();
  hidePassiveScare();
  lightsBuzzing = false;
  jumpscareEl.classList.add("hidden");
  refreshContinue();
  showScene("menu");
}

function openMenuOverlay() {
  if (currentScene !== "office" || !nightState) return;
  paused = true;
  if (nightState) nightState.charging = false;
  scenes.office.classList.add("paused-office");
  pausePlayingAudio();
  pauseEl.classList.remove("hidden");
}

document.getElementById("menu-btn").addEventListener("click", openMenuOverlay);

document.getElementById("btn-resume").addEventListener("click", () => {
  pauseEl.classList.add("hidden");
  closeSettings();
  scenes.office.classList.remove("paused-office");
  if (currentScene === "office" && nightState) {
    paused = false;
    lastTs = performance.now();
    resumePausedAudio();
  }
});

function applySettingsLive(key) {
  refreshPlayingVolumes();
  if (perfEl) perfEl.classList.toggle("hidden", !getSetting("Performance Overlay"));
  if ((key === "Reduce Motion" || key === "reset") && currentScene === "menu") startMenuAnim();
}

initSettings({
  onClick: () => playAudio(PATHS.click, { volume: 0.5 }),
  onHover: () => playAudio(PATHS.hover, { volume: 0.15 }),
  onChange: (key) => applySettingsLive(key),
});
document.getElementById("btn-settings")?.addEventListener("click", () => {
  playAudio(PATHS.click, { volume: 0.5 });
  nightsPanel.classList.add("hidden");
  openSettings();
});
document.getElementById("btn-pause-settings")?.addEventListener("click", () => {
  playAudio(PATHS.click, { volume: 0.5 });
  openSettings();
});

document.querySelectorAll(".to-menu").forEach((btn) => {
  btn.addEventListener("click", () => {
    const leavingRun = currentScene === "office" || currentScene === "victory" || currentScene === "defeat";
    pauseEl.classList.add("hidden");
    goMenu({ abandonNight: leavingRun });
  });
});

document.getElementById("btn-new").addEventListener("click", () => {
  playAudio(PATHS.click, { volume: 0.5 });
  startNewGame();
  beginNight(1, { newspaper: true });
});
document.getElementById("btn-continue").addEventListener("click", () => {
  if (continueBtn.disabled) return;
  playAudio(PATHS.click, { volume: 0.5 });
  const save = loadSave();
  if (save.hasSave) beginNight(save.night, { newspaper: save.night === 1 });
});
document.getElementById("btn-scenes").addEventListener("click", () => {
  playAudio(PATHS.click, { volume: 0.5 });
  nightsPanel.classList.remove("hidden");
});
document.getElementById("nights-back").addEventListener("click", () => {
  nightsPanel.classList.add("hidden");
});
document.getElementById("btn-collections").addEventListener("click", async () => {
  playAudio(PATHS.click, { volume: 0.5 });
  playAudio(PATHS.menuMusic, { loop: true, volume: 0.35 });
  await collections.open();
  showScene("collections");
});
document.getElementById("btn-install").addEventListener("click", () => showScene("install"));
document.getElementById("btn-next-night").addEventListener("click", () => {
  const save = loadSave();
  beginNight(save.night, { newspaper: false });
});
document.getElementById("btn-retry").addEventListener("click", () => {
  const n = nightState ? nightState.night : loadSave().night;
  beginNight(n, { newspaper: false });
});
document.getElementById("refresh-btn").addEventListener("click", () => location.reload());

document.querySelectorAll("#office-hotspots [data-act]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!nightState || gameFrozen()) return;
    const act = btn.getAttribute("data-act");
    if (act === "office-boop") {
      fireBoop("office");
      return;
    }
    if (act === "left-door" && toggleDoor(nightState, "left")) playAudio(PATHS.door, { volume: 0.7 });
    if (act === "right-door" && toggleDoor(nightState, "right")) playAudio(PATHS.door, { volume: 0.7 });
    if (act === "left-light" && toggleLight(nightState, "left")) playAudio(PATHS.light, { volume: 0.5 });
    if (act === "right-light" && toggleLight(nightState, "right")) playAudio(PATHS.light, { volume: 0.5 });
    renderOffice();
  });
});

document.getElementById("menu-boop").addEventListener("click", (e) => {
  e.stopPropagation();
  fireBoop("main_menu");
});
camBoop.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!nightState || gameFrozen() || nightState.currentCam !== "frontDesk") return;
  fireBoop("front_desk");
});

document.getElementById("btn-cameras").addEventListener("click", () => {
  if (!nightState || gameFrozen() || flip.playing) return;
  if (nightState.camerasOpen) {
    startCamFlip(false);
    renderOffice();
    return;
  }
  if (camerasBlocked(nightState)) return;
  startCamFlip(true);
  renderOffice();
});

document.getElementById("sabotage-hit")?.addEventListener("click", () => {
  if (!nightState || gameFrozen()) return;
  hitBonnieSabotage(nightState);
  renderOffice();
});

document.getElementById("task-handle")?.addEventListener("click", () => {
  if (!nightState || !nightState.tasks.enabled || nightState.taskLock > 0) return;
  nightState.tasks.open = !nightState.tasks.open;
  if (!nightState.tasks.open) nightState.tasks.browserOpen = false;
  playAudio(PATHS.click, { volume: 0.45 });
  renderTasks();
});

document.getElementById("task-list")?.addEventListener("pointerdown", (e) => {
  const row = e.target.closest("[data-task]");
  if (!row || !nightState || nightState.taskLock > 0) return;
  const task = nightState.tasks.tasks.find((t) => t.id === row.dataset.task);
  if (!task || task.completed) return;
  if (task.type === "browser") {
    nightState.tasks.browserOpen = true;
    playAudio(PATHS.click, { volume: 0.45 });
    return;
  }
  nightState.tasks.holdId = task.id;
});
window.addEventListener("pointerup", () => {
  if (nightState && nightState.tasks) nightState.tasks.holdId = null;
  checkoutHeld = false;
});

document.getElementById("order-close")?.addEventListener("click", () => {
  if (nightState && nightState.tasks) nightState.tasks.browserOpen = false;
});
document.getElementById("order-items")?.addEventListener("pointerdown", (e) => {
  const btn = e.target.closest("[data-prop]");
  if (!btn || !nightState) return;
  const name = btn.dataset.prop;
  const ui = nightState.tasks;
  if (ui.selected.includes(name)) return;
  ui.itemHold = name;
  ui.itemHoldProgress = 0;
});
document.getElementById("order-checkout")?.addEventListener("pointerdown", () => {
  checkoutHeld = true;
});
document.getElementById("task-end")?.addEventListener("click", () => {
  if (!nightState || !allTasksDone(nightState.tasks.tasks)) return;
  endNight({ type: "victory" });
});

window.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || currentScene !== "office" || !nightState) return;
  if (!nightState.tasks.enabled || !nightState.camerasOpen || nightState.taskLock > 0) return;
  e.preventDefault();
  nightState.tasks.open = !nightState.tasks.open;
});

const setCharge = (on) => {
  if (nightState && !gameFrozen()) nightState.charging = on;
};
chargeBtn.addEventListener("pointerdown", () => setCharge(true));
chargeBtn.addEventListener("pointerup", () => setCharge(false));
chargeBtn.addEventListener("pointerleave", () => setCharge(false));
chargeBtn.addEventListener("pointercancel", () => setCharge(false));

muteBtn.addEventListener("click", () => {
  if (!nightState || gameFrozen()) return;
  nightState.muted = true;
  nightState.callActive = false;
  stopAudio(PATHS.nightCall);
  renderOffice();
});

const pan = document.getElementById("office-pan");
pan.addEventListener("pointerdown", (e) => {
  if (gameFrozen() || e.target.closest("button") || (nightState && nightState.camerasOpen)) return;
  drag = { x: e.clientX, start: panX };
});
window.addEventListener("pointerup", () => { drag = null; });
window.addEventListener("pointermove", (e) => {
  if (!drag || !canvas.width || gameFrozen()) return;
  const viewW = pan.clientWidth;
  const max = Math.min(0, viewW - viewW * OFFICE_SCALE_X);
  panX = Math.max(max, Math.min(0, drag.start + (e.clientX - drag.x)));
  officeStage.style.transform = `translateX(${panX}px)`;
});
function flushAutosave() {
  if (nightState) persistAutosave(nightState.night);
}

window.addEventListener("pagehide", flushAutosave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushAutosave();
});

window.addEventListener("resize", () => {
  if (currentScene === "office") layoutOfficeStage();
  if (currentScene === "menu") layoutMenuBoop();
});

document.querySelectorAll(".btn, .pad, .slant-btn, .night-pick, .menu-settings").forEach((btn) => {
  btn.addEventListener("pointerenter", () => playAudio(PATHS.hover, { volume: 0.15 }));
});

async function initVersion() {
  try {
    const local = await loadLocalVersion();
    versionBadge.textContent = local.version || "";
    const result = await checkForUpdate(local);
    if (result.outdated) outdatedBanner.classList.remove("hidden");
  } catch {
    versionBadge.textContent = "v?";
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

const collections = initCollections({
  onBack: () => goMenu(),
  onUnlock: (ids) => toastUnlocks(ids),
});

buildCamHud();
buildNightPicks();
refreshContinue();
initVersion();

preloadCore().then(async (imgs) => {
  coreImages = imgs;
  setMenuArt();
  const callEl = getAudio(PATHS.nightCall, { volume: 0.7 });
  callEl.addEventListener("ended", () => {
    if (!nightState) return;
    nightState.callActive = false;
    renderOffice();
  });
  document.getElementById("loading").classList.add("hidden");
  applySettingsLive();
  await playBootSequence();
  showScene("menu");
}).catch(() => {
  document.getElementById("load-status").textContent =
    "Could not reach /Assets. Use start-mobile.bat (not a file:// open).";
});
