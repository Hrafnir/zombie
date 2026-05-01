(() => {
  "use strict";

  const EM = (window.EM = window.EM || {});

  EM.$ = (id) => document.getElementById(id);

  EM.dom = {
    canvas: EM.$("gameCanvas"),
    titleScreen: EM.$("titleScreen"),
    pauseScreen: EM.$("pauseScreen"),
    helpScreen: EM.$("helpScreen"),
    gameOverScreen: EM.$("gameOverScreen"),
    hud: EM.$("hud"),
    sidePanel: EM.$("sidePanel"),
    sidePanelTitle: EM.$("sidePanelTitle"),
    sidePanelContent: EM.$("sidePanelContent"),
    toastLayer: EM.$("toastLayer"),
    interactionHint: EM.$("interactionHint"),
    messageLog: EM.$("messageLog"),
    objectiveBox: EM.$("objectiveBox"),
    hotbar: EM.$("hotbar"),
    dayLabel: EM.$("dayLabel"),
    threatPill: EM.$("threatPill"),
    damageVignette: EM.$("damageVignette"),
    meters: {
      health: EM.$("healthMeter"),
      stamina: EM.$("staminaMeter"),
      hunger: EM.$("hungerMeter"),
      thirst: EM.$("thirstMeter"),
    },
  };

  EM.ctx = EM.dom.canvas.getContext("2d");

  EM.STORAGE_KEY = "etter-morket-v1-2-refactor-save";

  EM.running = false;
  EM.paused = false;
  EM.lastTime = performance.now();

  EM.selectedBuild = null;
  EM.selectedBuildRecipe = null;
  EM.selectedBuildRotation = 0;
  EM.panelMode = null;
  EM.selectedStationBuilding = null;

  EM.keys = new Set();
  EM.pressed = new Set();

  EM.mouse = {
    x: 0,
    y: 0,
    wx: 0,
    wy: 0,
    down: false,
    clicked: false,
  };

  EM.clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  EM.rand = (min, max) => min + Math.random() * (max - min);
  EM.randi = (min, max) => Math.floor(EM.rand(min, max + 1));
  EM.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  EM.uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  EM.snap = (value, grid = 16) => Math.round(value / grid) * grid;

  EM.itemName = function itemName(id) {
    return EM.ITEMS?.[id] || EM.WEAPONS?.[id]?.name || EM.BUILDINGS?.[id]?.name || id;
  };

  EM.addItem = function addItem(id, amount = 1) {
    if (!EM.state || amount <= 0) return;
    EM.state.inv[id] = (EM.state.inv[id] || 0) + amount;
  };

  EM.removeItem = function removeItem(id, amount = 1) {
    if (!EM.state || (EM.state.inv[id] || 0) < amount) return false;
    EM.state.inv[id] -= amount;
    if (EM.state.inv[id] <= 0) delete EM.state.inv[id];
    return true;
  };

  EM.canPay = function canPay(cost) {
    return Object.entries(cost || {}).every(([id, amount]) => {
      return (EM.state.inv[id] || 0) >= amount;
    });
  };

  EM.pay = function pay(cost) {
    if (!EM.canPay(cost)) return false;
    Object.entries(cost || {}).forEach(([id, amount]) => EM.removeItem(id, amount));
    return true;
  };

  EM.costText = function costText(cost) {
    return Object.entries(cost || {})
      .map(([id, amount]) => `${EM.itemName(id)} ×${amount}`)
      .join(", ");
  };

  EM.missingText = function missingText(cost) {
    return Object.entries(cost || {})
      .filter(([id, amount]) => (EM.state.inv[id] || 0) < amount)
      .map(([id, amount]) => `${EM.itemName(id)} ×${amount - (EM.state.inv[id] || 0)}`)
      .join(", ");
  };

  EM.stationName = function stationName(id) {
    if (!id) return "ingen";
    return EM.BUILDINGS?.[id]?.name || id;
  };

  EM.isDown = function isDown(...values) {
    return values.some((value) => EM.keys.has(value));
  };

  EM.isNight = function isNight() {
    const hour = EM.state.time / 60;
    return hour < 6 || hour >= 21;
  };

  EM.twilightDarkness = function twilightDarkness() {
    const hour = EM.state.time / 60;

    if (hour >= 19 && hour < 21) {
      return ((hour - 19) / 2) * 0.42;
    }

    if (hour >= 6 && hour < 7.5) {
      return (1 - (hour - 6) / 1.5) * 0.38;
    }

    return 0;
  };

  EM.resize = function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    EM.dom.canvas.width = Math.floor(window.innerWidth * dpr);
    EM.dom.canvas.height = Math.floor(window.innerHeight * dpr);
    EM.dom.canvas.style.width = window.innerWidth + "px";
    EM.dom.canvas.style.height = window.innerHeight + "px";
    EM.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  EM.updateMouseWorld = function updateMouseWorld() {
    if (!EM.state) return;
    EM.mouse.wx = EM.mouse.x + EM.state.camera.x;
    EM.mouse.wy = EM.mouse.y + EM.state.camera.y;
  };

  EM.setMouse = function setMouse(event) {
    const rect = EM.dom.canvas.getBoundingClientRect();
    EM.mouse.x = event.clientX - rect.left;
    EM.mouse.y = event.clientY - rect.top;
    EM.updateMouseWorld();
  };

  EM.rectCircleCollision = function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
    const closestX = EM.clamp(cx, rx - rw / 2, rx + rw / 2);
    const closestY = EM.clamp(cy, ry - rh / 2, ry + rh / 2);
    return EM.dist(closestX, closestY, cx, cy) < cr;
  };

  EM.rectRectOverlap = function rectRectOverlap(ax, ay, aw, ah, bx, by, bw, bh, pad = 0) {
    return (
      Math.abs(ax - bx) < (aw + bw) / 2 + pad &&
      Math.abs(ay - by) < (ah + bh) / 2 + pad
    );
  };

  EM.hitEffect = function hitEffect() {
    EM.state.camera.shake = 10;

    if (EM.dom.damageVignette) {
      EM.dom.damageVignette.classList.add("hit");
      setTimeout(() => EM.dom.damageVignette.classList.remove("hit"), 180);
    }
  };

  window.addEventListener("resize", EM.resize);
  EM.resize();
})();
