import { assetUrl, playAudio, PATHS } from "./assets.js";
import { getUnlockedIds, unlockIds } from "./save.js";

const TABS = [
  { id: "personnel", label: "PERSONNEL FILE", hint: "Achievements & polaroids", locked: false },
  { id: "credits", label: "TAPE CREDITS", hint: "Recording log · staff", locked: false },
  { id: "gallery", label: "GALLERY", hint: "Recovered image archive", locked: true },
  { id: "extras", label: "EXTRAS", hint: "Ultimate Custom Night", locked: true },
  { id: "terminal", label: "SYSTEM", hint: "secret rushed features", locked: true },
];

const CREDITS = [
  ["INSPIRED BY", "Five Nights at Freddy's, by Scott Cawthon."],
  ["DESIGN & CODE", "NiftyTechGuy"],
  ["PIXEL FONTS", "Pixelify Sans (Google Fonts)"],
  ["AUDIO", "FNAF-style cues, custom recordings, royalty-free SFX"],
  ["THANKS", "to every player brave enough to clock in for another night."],
];

const CREDITS_LINKS = [
  ["YouTube", "https://www.youtube.com/@NiftyTechGuy"],
  ["itch.io", "https://niftytechguy.itch.io/"],
  ["Game Jolt", "https://gamejolt.com/@NiftyTechGuy"],
];

export function initCollections({ onBack, onUnlock }) {
  const root = document.getElementById("scene-collections");
  const tabsEl = document.getElementById("col-tabs");
  const body = document.getElementById("col-body");
  const countEl = document.getElementById("col-count");
  let tab = "personnel";
  let achievements = [];

  tabsEl.innerHTML = "";
  TABS.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = `btn col-tab${t.locked ? " locked-tab" : ""}`;
    btn.type = "button";
    btn.innerHTML = `${t.label}<small>${t.hint}</small>`;
    btn.dataset.tab = t.id;
    btn.addEventListener("click", () => {
      playAudio(PATHS.click, { volume: 0.45 });
      tab = t.id;
      render();
    });
    tabsEl.appendChild(btn);
  });

  document.getElementById("col-back").addEventListener("click", () => {
    playAudio(PATHS.click, { volume: 0.45 });
    onBack();
  });

  window.addEventListener("keydown", (e) => {
    if (root.classList.contains("hidden")) return;
    if (e.key === "Escape") {
      if (document.getElementById("focus-back")) render();
      else onBack();
      return;
    }
    const map = { 1: "personnel", 2: "credits", 3: "gallery", 4: "extras", 5: "terminal" };
    if (map[e.key]) {
      tab = map[e.key];
      render();
    }
  });

  async function loadData() {
    const achRes = await fetch("./data/achievements.json", { cache: "no-store" });
    achievements = achRes.ok ? await achRes.json() : [];
  }

  function updateCount() {
    const unlocked = getUnlockedIds();
    const visible = achievements.filter((a) => !a.hidden || unlocked.has(a.id));
    const on = visible.filter((a) => unlocked.has(a.id)).length;
    if (countEl) {
      countEl.textContent = `${String(on).padStart(2, "0")} / ${String(visible.length).padStart(2, "0")} ACHIEVEMENTS UNLOCKED`;
    }
  }

  function renderPersonnel() {
    const unlocked = getUnlockedIds();
    const visible = achievements.filter((a) => !a.hidden || unlocked.has(a.id));
    const cards = visible.map((ach) => {
      const on = unlocked.has(ach.id);
      const img = ach.image ? `<img src="${assetUrl(ach.image)}" alt="" />` : "";
      return `<button class="polaroid ${on ? "on" : "off"}" data-id="${ach.id}" type="button">
        ${img}
        <span>${on ? ach.name : "LOCKED"}</span>
      </button>`;
    }).join("");
    body.innerHTML = `<h2 class="col-section-head">PERSONNEL FILE</h2>
      <p class="col-section-sub">${unlocked.size} of ${visible.length} achievements recovered  ·  click any photo to view it isolated</p>
      <div class="polaroid-grid">${cards}</div>`;
    body.querySelectorAll(".polaroid").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ach = achievements.find((a) => a.id === btn.dataset.id);
        if (!ach) return;
        const on = unlocked.has(ach.id);
        body.innerHTML = `<div class="focus-card">
          ${ach.image ? `<img src="${assetUrl(ach.image)}" alt="" />` : ""}
          <h2>${on ? ach.name : "LOCKED"}</h2>
          <p>${on ? ach.description : "File sealed."}</p>
          <button class="btn" type="button" id="focus-back">BACK</button>
        </div>`;
        document.getElementById("focus-back").addEventListener("click", render);
      });
    });
  }

  function renderCredits() {
    const rows = CREDITS.map(([k, v]) => `<p><strong>${k}</strong><br>${v}</p>`).join("");
    const links = CREDITS_LINKS.map(
      ([label, url]) => `<p class="credits-links"><a href="${url}" target="_blank" rel="noopener">${label}: ${url}</a></p>`
    ).join("");
    body.innerHTML = `<div class="paper">
      <h2>CREDITS</h2>
      <p><strong>-Nifty tech guy</strong></p>
      ${links}
      ${rows}
      <label class="apreesh-row">
        <input id="apreesh-check" type="checkbox" />
        I appreciate it
      </label>
      <p class="hint">Scroll to the bottom and check the box if you appreciate the work.</p>
      <p class="hint">— END —</p>
    </div>`;
    const box = document.getElementById("apreesh-check");
    if (box && getUnlockedIds().has("apreesh")) box.checked = true;
    box?.addEventListener("change", () => {
      if (!box.checked) return;
      const fresh = unlockIds(["apreesh"]);
      if (fresh.length) onUnlock?.(fresh);
      updateCount();
    });
  }

  function renderLocked(title, copy) {
    body.innerHTML = `<div class="paper locked-panel">
      <h2>LOCKED</h2>
      <p><strong>${title}</strong></p>
      <p>${copy}</p>
      <p class="hint">Available on the PC build.</p>
    </div>`;
  }

  function render() {
    tabsEl.querySelectorAll(".col-tab").forEach((btn) => {
      btn.classList.toggle("primary", btn.dataset.tab === tab);
    });
    updateCount();
    if (tab === "personnel") renderPersonnel();
    else if (tab === "credits") renderCredits();
    else if (tab === "gallery") renderLocked("GALLERY", "Recovered image archive is sealed on mobile.");
    else if (tab === "extras") renderLocked("EXTRAS", "Ultimate Custom Night is not available on mobile.");
    else renderLocked("SYSTEM", "Maintenance terminal is sealed on mobile.");
  }

  return {
    root,
    async open() {
      await loadData();
      tab = "personnel";
      render();
    },
  };
}
