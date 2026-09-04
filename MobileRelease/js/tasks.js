/** Camera tasks — same list and timings as Code/Camera.py */

export const TASK_DECAY = 0.08;
export const PROP_ITEMS = [
  "Balloons",
  "Cardboard Cutouts",
  "Table Covers",
  "Confetti Packs",
  "Party Hats",
  "Streamers",
  "Plastic Cups",
  "Plate Sets",
];
export const BROWSER_ITEM_HOLD = 0.73;
export const BROWSER_CHECKOUT = 18.18;

export function tasksEnabled(night) {
  return night === 1 || night === 2;
}

export function createTasks() {
  return [
    { id: "reboot_printers", label: "Reboot Printer Systems", type: "hold", duration: 18.18, progress: 0, completed: false },
    { id: "print_posters", label: "Print Posters", type: "counter_hold", duration: 10.91, progress: 0, count: 0, target: 5, completed: false },
    { id: "reboot_fire_alarms", label: "Reboot Fire Alarms", type: "hold", duration: 10.91, progress: 0, completed: false },
    { id: "wifi_check", label: "WiFi Check", type: "hold", duration: 9.09, progress: 0, completed: false },
    { id: "order_props", label: "Order Props", type: "browser", completed: false },
  ];
}

export function allTasksDone(tasks) {
  return !!(tasks && tasks.length && tasks.every((t) => t.completed));
}

export function createTaskState(night) {
  if (!tasksEnabled(night)) {
    return { enabled: false, tasks: [], open: false, holdId: null, browserOpen: false, selected: [], itemHold: null, itemHoldProgress: 0, checkout: 0 };
  }
  return {
    enabled: true,
    tasks: createTasks(),
    open: false,
    holdId: null,
    browserOpen: false,
    selected: [],
    itemHold: null,
    itemHoldProgress: 0,
    checkout: 0,
  };
}

function finishHold(task) {
  if (task.type === "counter_hold") {
    task.count = (task.count || 0) + 1;
    task.progress = 0;
    if (task.count >= (task.target || 1)) task.completed = true;
  } else {
    task.completed = true;
    task.progress = task.duration;
  }
}

export function updateTasks(ui, dt, locked) {
  if (!ui || !ui.enabled) return;
  if (locked) {
    ui.holdId = null;
    ui.itemHold = null;
    return;
  }
  for (const task of ui.tasks) {
    if (task.completed || (task.type !== "hold" && task.type !== "counter_hold")) continue;
    if (ui.holdId === task.id) continue;
    const duration = Math.max(0.001, task.duration || 1);
    task.progress = Math.max(0, (task.progress || 0) - duration * TASK_DECAY * dt);
  }
  if (ui.holdId) {
    const task = ui.tasks.find((t) => t.id === ui.holdId);
    if (task && !task.completed) {
      task.progress = (task.progress || 0) + dt;
      if (task.progress >= task.duration) finishHold(task);
    }
  }
  if (ui.browserOpen) {
    if (ui.itemHold) {
      ui.itemHoldProgress += dt;
      if (ui.itemHoldProgress >= BROWSER_ITEM_HOLD) {
        if (!ui.selected.includes(ui.itemHold)) ui.selected = [...ui.selected, ui.itemHold];
        ui.itemHold = null;
        ui.itemHoldProgress = 0;
      }
    } else {
      ui.itemHoldProgress = Math.max(0, ui.itemHoldProgress - BROWSER_ITEM_HOLD * TASK_DECAY * dt);
    }
  }
}

export function holdCheckout(ui, dt) {
  if (!ui || !ui.browserOpen) return false;
  if (ui.selected.length < PROP_ITEMS.length) return false;
  ui.checkout += dt;
  if (ui.checkout >= BROWSER_CHECKOUT) {
    const task = ui.tasks.find((t) => t.id === "order_props");
    if (task) task.completed = true;
    ui.browserOpen = false;
    ui.checkout = 0;
    ui.selected = [];
    return true;
  }
  return false;
}

export function decayCheckout(ui, dt) {
  if (!ui) return;
  ui.checkout = Math.max(0, ui.checkout - BROWSER_CHECKOUT * TASK_DECAY * dt);
}
