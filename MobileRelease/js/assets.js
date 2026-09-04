/** Packed copy inside MobileRelease/Assets — works offline / hosted without the PC. */
import { mixVolume } from "./settings.js";

export const ASSETS_BASE = "Assets";

export function assetUrl(rel) {
  const clean = String(rel || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return `${ASSETS_BASE}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}

export function loadImage(rel) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Missing asset: ${rel}`));
    img.src = assetUrl(rel);
  });
}

const audioCache = new Map();

function inferChannel(rel, opts = {}) {
  if (opts.channel) return opts.channel;
  const s = String(rel || "");
  if (/MainMenuStatic|OfficeAmbience|FanSound/i.test(s)) return "music";
  return "sfx";
}

function applyVolume(el, rel, opts = {}) {
  const channel = inferChannel(rel, opts);
  const base = opts.volume == null ? 1 : Number(opts.volume);
  el.dataset.baseVolume = String(base);
  el.dataset.channel = channel;
  el.volume = mixVolume(channel, base);
}

export function refreshPlayingVolumes() {
  audioCache.forEach((el, rel) => {
    const base = Number(el.dataset.baseVolume || 1);
    const channel = el.dataset.channel || inferChannel(rel);
    el.volume = mixVolume(channel, base);
  });
}

export function getAudio(rel, opts = {}) {
  const { loop = false } = opts;
  let el = audioCache.get(rel);
  if (!el) {
    el = new Audio(assetUrl(rel));
    el.preload = "auto";
    audioCache.set(rel, el);
  }
  el.loop = loop;
  applyVolume(el, rel, opts);
  return el;
}

export function playAudio(rel, opts = {}) {
  const el = getAudio(rel, opts);
  const already = !el.paused && !el.ended;
  if (opts.restart === false && already) return el;
  if (opts.restart !== false) {
    try {
      el.currentTime = 0;
    } catch {
      /* iOS may block seek before load */
    }
  }
  const p = el.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
  return el;
}

export function stopAudio(rel) {
  const el = audioCache.get(rel);
  if (!el) return;
  el.pause();
  try {
    el.currentTime = 0;
  } catch {
    /* ignore */
  }
}

let pausedAudioRels = [];

export function pausePlayingAudio() {
  pausedAudioRels = [];
  audioCache.forEach((el, rel) => {
    if (!el.paused && !el.ended) {
      el.pause();
      pausedAudioRels.push(rel);
    }
  });
}

export function resumePausedAudio() {
  pausedAudioRels.forEach((rel) => {
    const el = audioCache.get(rel);
    if (!el) return;
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  });
  pausedAudioRels = [];
}

export function stopAllAudio() {
  pausedAudioRels = [];
  audioCache.forEach((el) => {
    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  });
}

export const PATHS = {
  font: "Images/FinalNight/Miscellaneous/Pixelify_Sans/PixelifySans-VariableFont_wght.ttf",
  menuBg: "Images/MainMenu/MainMenu/MainMenuBG.PNG",
  menuLight: "Images/MainMenu/MainMenu/MainMenuLight.PNG",
  posterSheet: "Images/MainMenu/MainMenu/PosterBoy.png",
  posterSheetAlt: "Images/MainMenu/MainMenu/PosterBoy.PNG",
  officeSheet: "Images/Office/Office.png",
  fredOffice: "Images/Office/FredOfficeScene.png",
  fredOfficeAlt: "Images/Office/FredOfficeScene.PNG",
  camHud: "Images/CameraHud.png",
  camHudAlt: "Images/CameraHUD.png",
  jumpscare: "Images/Animation/Jumpscares/Freddy/Hostile/FreddyJumpscare.png",
  jumpscarePassive1: "Images/Animation/Jumpscares/Freddy/Passive/Frame (1).PNG",
  jumpscarePassive2: "Images/Animation/Jumpscares/Freddy/Passive/Frame (2).PNG",
  jumpscareBonnie: "Images/Animatronics/Bonnie.PNG",
  menuMusic: "Audio/MainMenuStatic.mp3",
  ambience: "Audio/OfficeAmbience.mp3",
  door: "Audio/Door_Close.mp3",
  light: "Audio/LightButtonPress.mp3",
  camera: "Audio/CameraButtonPress.mp3",
  hover: "Audio/ButtonHover.mp3",
  click: "Audio/ButtonClick.mp3",
  buzz: "Audio/OfficeLightBuzzing.mp3",
  nightCall: "Audio/NightCalls/Night1Call.wav",
  applause: "Audio/Applause.mp3",
  jumpscareSfx: "Audio/Jumpscare.mp3",
  powerOff: "Audio/OfficeScene/PowerOff.mp3",
  fan: "Audio/FanSound.mp3",
  boop: "Audio/FreddyBoop.mp3",
  achievement: "Audio/Acheivment.mp3",
  newspaper: "Images/Background/NewsPaper.png",
  hazard: "Audio/OfficeScene/CharacterHazard.mp3",
  hazardFred: "Images/Animatronics/Freddy.PNG",
  hazardBon: "Images/Animatronics/Bonnie.PNG",
  hazardBonSheet: "Images/Animatronics/HazardScreenBon.png",
  kitchenAmbience: "Audio/Noise/KitchenAmbience.mp3",
  floorCreak1: "Audio/Noise/PizzareaAmbiance/FloorCreaking1.mp3",
  floorCreak2: "Audio/Noise/PizzareaAmbiance/FloorCreaking2.mp3",
  floorCreak3: "Audio/Noise/PizzareaAmbiance/FloorCreaking3.mp3",
  bootVideo: "Videos/GameIntro-Troll.mp4",
  warningAccept: "Audio/WarningScreenAcceptance.mp3",
};

/** PC: Office.py + DisplayUtils 1920×1080 */
export const LIGHT_OVERLAY_ALPHA = 15 / 255;
export const HALLWAY_DIM_ALPHA = 217 / 255;
export const OFFICE_SCALE_X = 1.25;
export const CAMERA_HUD_SCALE = 1.2;
export const CAMERA_HUD_MARGIN = 20;
export const CAMERA_HUD_BUTTON = 30;
export const CAMERA_FLIP = { width: 0.4, y: 0.92, height: 120 / 1080, frames: 7, fps: 60 };
export const CAMERA_FLIP_DIR = "Images/CameraAnimation";

export function camFlipPath(index) {
  return `${CAMERA_FLIP_DIR}/Frame (${index}).png`;
}

export const OFFICE_SOURCE = { w: 1900, h: 1050 };
export const OFFICE_FRAMES = {
  rightDoor: { x: 0, y: 0, w: 1900, h: 1050 },
  leftDoor: { x: 1900, y: 0, w: 1900, h: 1050 },
  base: { x: 0, y: 1050, w: 1900, h: 1050 },
  bothDoors: { x: 1900, y: 1050, w: 1900, h: 1050 },
  leftDoorSprite: { x: 352, y: 2100, w: 352, h: 742 },
  rightDoorSprite: { x: 0, y: 2100, w: 352, h: 745 },
  backdrop: { x: 1900, y: 2845, w: 1900, h: 467 },
  lightOverlay: { x: 0, y: 2845, w: 1900, h: 1050 },
  leftHallLight: { x: 566, y: 3895, w: 566, h: 824 },
  rightHallLight: { x: 0, y: 3895, w: 566, h: 824 },
};

/** PC Office.py layered door placement (source XML space). */
export const OFFICE_DOORS = {
  left: { closedX: 25, closedY: 308, openX: 25, openY: -434 },
  right: { closedX: 1525, closedY: 305, openX: 1548, openY: -440 },
};

/** layer_positions from Office.py load_office_images */
export const OFFICE_LAYERS = {
  backdrop: { x: 0, y: 1050 - 467 },
  leftHallLight: { x: 0, y: 1050 - 824 },
  rightHallLight: { x: 1900 - 566, y: 1050 - 824 },
};

export const OFFICE_DOORWAY = {
  left: { x: 100, y: 450 },
  right: { x: 1600, y: 450 },
  maxH: 550,
};

export const FRED_OFFICE_FRAMES = {
  fred: { x: 0, y: 0, w: 381, h: 719 },
  decom: { x: 664, y: 719, w: 377, h: 714 },
};

export const POSTER_FRAMES = [
  { x: 0, y: 0, w: 297, h: 533 },
  { x: 0, y: 533, w: 296, h: 535 },
];
export const POSTER_FPS = 12;
export const POSTER_DESIGN = { x: 1260, y: 665, w: 297, h: 533 };

export const HAZARD_BON_FPS = 4;
export const HAZARD_BON_FRAMES = [
  { x: 0, y: 0, w: 652, h: 1436 },
  { x: 0, y: 1436, w: 662, h: 1432 },
];
export const CAM_STATIC = { frames: 10, fps: 24, alpha: 120 / 255, scale: 1.1 };
export const CAM_STATIC_DIR = "Images/CameraStatic/Base";

export function camStaticPath(index) {
  return `${CAM_STATIC_DIR}/Frame (${index}).png`;
}

/** Same hitboxes as Code/MainMenu.py, Office.py, Camera.py */
export const BOOP_HITS = {
  menu: { x: 1240, y: 625, w: 25, h: 25, space: [1920, 1080] },
  office: { xPct: 0.6, y: 440, w: 25, h: 25, space: [1920, 1080] },
  office2: { x: 810, y: 390, w: 15, h: 15, space: [1900, 1050] },
  frontDesk: { x: 1175, y: 300, w: 25, h: 25, space: [1920, 1080] },
};

/** Same office-space coords as Code/Office.py */
export const OFFICE_CONTROLS = {
  leftDoor: { x: 370, y: 570, size: 55 },
  rightDoor: { x: 1480, y: 570, size: 55 },
  leftLight: { x: 370, y: 625, size: 55 },
  rightLight: { x: 1480, y: 625, size: 55 },
};

export function officeFrameKey(doors) {
  if (doors.left && doors.right) return "bothDoors";
  if (doors.left) return "leftDoor";
  if (doors.right) return "rightDoor";
  return "base";
}

export function cameraSprite(camId, occupants, extra = {}) {
  const hasF = occupants.includes("freddy");
  const hasB = occupants.includes("bonnie");
  const hasS = occupants.includes("spring");
  const cam = "Images/Camera Screens";
  const pick = (name) => `${cam}/${name}`;
  const sab = extra.bonnieSabotage || 0;
  switch (camId) {
    case "stage":
      if (hasF && hasB) return pick("Fred_Bon_Stage.PNG");
      if (hasF) return pick("Fred_Stage.PNG");
      if (hasB) return pick("Bon_Stage.PNG");
      return pick("Stage.PNG");
    case "storage":
      return pick(hasF ? "Storage_Fred.PNG" : "Storage.PNG");
    case "backDump":
      return pick("BackDump.PNG");
    case "bathrooms":
      return pick("Bathrooms.PNG");
    case "parts":
      if (sab >= 3) return pick("PartsAndService_Bon State 3.PNG");
      if (sab === 2) return pick("PartsAndService_Bon State 2.PNG");
      return pick(hasB || sab === 1 ? "PartsAndService_Bon.PNG" : "PartsAndService.PNG");
    case "kitchen":
      return pick("Kitchen.png");
    case "foodCourt":
      if (hasF && hasB) return pick("FoodCourt_Fred_Bon.PNG");
      if (hasF) return pick("FoodCourt_Fred.PNG");
      if (hasB) return pick("FoodCourt_Bon.PNG");
      return pick("FoodCourt.PNG");
    case "leftHall":
      return pick(hasB ? "LeftHallway_Bon.PNG" : "LeftHallway.PNG");
    case "leftCorner":
      return pick(hasB ? "Left_Corner_Bon.PNG" : "LeftCorner.PNG");
    case "rightHall":
      return pick(hasF ? "RightHallway_Fred.PNG" : "RightHallway.PNG");
    case "rightCorner":
      return pick(hasF ? "RightCorner_Fred.PNG" : "RightCorner.PNG");
    case "frontDesk":
      return pick(hasS ? "FrontDeskSpring.PNG" : "FrontDesk.PNG");
    default:
      return pick("Stage.PNG");
  }
}

export async function preloadCore() {
  const images = [
    PATHS.menuBg,
    PATHS.menuLight,
    PATHS.posterSheet,
    PATHS.posterSheetAlt,
    PATHS.officeSheet,
    PATHS.fredOffice,
    PATHS.fredOfficeAlt,
    PATHS.jumpscare,
    PATHS.camHud,
    PATHS.camHudAlt,
    PATHS.newspaper,
    PATHS.hazardFred,
    PATHS.hazardBon,
    PATHS.hazardBonSheet,
    PATHS.jumpscarePassive1,
    PATHS.jumpscarePassive2,
    PATHS.jumpscareBonnie,
  ];
  for (let i = 1; i <= CAM_STATIC.frames; i += 1) images.push(camStaticPath(i));
  for (let i = 1; i <= CAMERA_FLIP.frames; i += 1) images.push(camFlipPath(i));
  const results = {};
  await Promise.all(
    images.map(async (rel) => {
      try {
        results[rel] = await loadImage(rel);
      } catch {
        results[rel] = null;
      }
    })
  );
  return results;
}
