/* Etter Mørket v1.1.1
   Komplett spillfil.

   Fikset:
   - Bærbusker og malmstein rister ikke lenger.
   - Bygg trekker ikke ressurser før plassering er gyldig.
   - Bygg har grønn/rød forhåndsvisning.
   - Feil plassering koster ikke ressurser.

   Innhold:
   - Trær
   - Store steiner
   - Malmstein
   - Hakke
   - Øks
   - Smelter
   - Bål
   - Vannpytter
   - Skittent/rent vann
   - Feltflaske
   - Regnsamler
   - Vegger
   - Piggfeller
   - Fakkel
   - Sovepose
   - Flere zombie-typer
*/

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const canvas = $("gameCanvas");
  const ctx = canvas.getContext("2d");

  const titleScreen = $("titleScreen");
  const pauseScreen = $("pauseScreen");
  const helpScreen = $("helpScreen");
  const gameOverScreen = $("gameOverScreen");

  const hud = $("hud");
  const sidePanel = $("sidePanel");
  const sidePanelTitle = $("sidePanelTitle");
  const sidePanelContent = $("sidePanelContent");

  const toastLayer = $("toastLayer");
  const interactionHint = $("interactionHint");
  const messageLog = $("messageLog");
  const objectiveBox = $("objectiveBox");
  const hotbar = $("hotbar");

  const dayLabel = $("dayLabel");
  const threatPill = $("threatPill");
  const damageVignette = $("damageVignette");

  const meters = {
    health: $("healthMeter"),
    stamina: $("staminaMeter"),
    hunger: $("hungerMeter"),
    thirst: $("thirstMeter"),
  };

  const STORAGE_KEY = "etter-morket-v1-1-save";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const randi = (min, max) => Math.floor(rand(min, max + 1));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const ITEMS = {
    wood: "Treverk",
    stone: "Stein",
    ore: "Jernmalm",
    metal: "Metall",
    coal: "Kull",
    scrap: "Skrapmetall",
    cloth: "Tøy",
    food: "Mat",
    dirtyWater: "Skittent vann",
    water: "Rent vann",
    herbs: "Urter",
    ammo: "Ammunisjon",
    arrows: "Piler",
    parts: "Deler",
    bandage: "Bandasje",
    medkit: "Førstehjelpspakke",
    canteen: "Feltflaske",
  };

  const WEAPONS = {
    knife: {
      name: "Kniv",
      type: "melee",
      damage: 16,
      range: 42,
      cooldown: 0.42,
      noise: 40,
      stamina: 5,
    },
    axe: {
      name: "Øks",
      type: "melee",
      damage: 32,
      range: 50,
      cooldown: 0.62,
      noise: 80,
      stamina: 10,
    },
    pickaxe: {
      name: "Hakke",
      type: "melee",
      damage: 28,
      range: 48,
      cooldown: 0.72,
      noise: 95,
      stamina: 12,
    },
    spear: {
      name: "Spyd",
      type: "melee",
      damage: 36,
      range: 68,
      cooldown: 0.72,
      noise: 60,
      stamina: 11,
    },
    bow: {
      name: "Bue",
      type: "projectile",
      damage: 42,
      range: 520,
      speed: 560,
      cooldown: 0.68,
      noise: 75,
      ammo: "arrows",
    },
    pistol: {
      name: "Pistol",
      type: "projectile",
      damage: 48,
      range: 640,
      speed: 820,
      cooldown: 0.32,
      noise: 360,
      ammo: "ammo",
    },
    shotgun: {
      name: "Hagle",
      type: "spread",
      damage: 30,
      pellets: 6,
      range: 380,
      speed: 720,
      cooldown: 0.92,
      noise: 520,
      ammo: "ammo",
    },
  };

  const BUILDINGS = {
    campfire: {
      name: "Bål",
      hp: 120,
      w: 42,
      h: 42,
      color: "#e76f28",
      light: 170,
      station: true,
    },
    workbench: {
      name: "Arbeidsbenk",
      hp: 180,
      w: 62,
      h: 42,
      color: "#8b5e34",
      station: true,
    },
    smelter: {
      name: "Smelter",
      hp: 240,
      w: 58,
      h: 58,
      color: "#59656a",
      light: 150,
      station: true,
    },
    woodWall: {
      name: "Trevegg",
      hp: 190,
      w: 54,
      h: 28,
      color: "#72502f",
      solid: true,
    },
    stoneWall: {
      name: "Steinvegg",
      hp: 360,
      w: 56,
      h: 32,
      color: "#7d8587",
      solid: true,
    },
    spikes: {
      name: "Piggfelle",
      hp: 110,
      w: 48,
      h: 48,
      color: "#a07a48",
      trap: true,
    },
    rainCollector: {
      name: "Regnsamler",
      hp: 140,
      w: 46,
      h: 46,
      color: "#6d93a4",
      waterStore: 0,
    },
    torch: {
      name: "Fakkel",
      hp: 45,
      w: 22,
      h: 22,
      color: "#ffb347",
      light: 230,
    },
    bedroll: {
      name: "Sovepose",
      hp: 80,
      w: 56,
      h: 32,
      color: "#36527a",
    },
    storage: {
      name: "Lagerkasse",
      hp: 120,
      w: 46,
      h: 38,
      color: "#8b6a3d",
    },
  };

  const RECIPES = [
    {
      id: "axe",
      name: "Lag øks",
      category: "Verktøy",
      cost: { wood: 4, stone: 3, cloth: 1 },
      weapon: "axe",
      station: null,
      desc: "Gir mer tre fra trær og fungerer som våpen.",
    },
    {
      id: "pickaxe",
      name: "Lag hakke",
      category: "Verktøy",
      cost: { wood: 4, stone: 5, cloth: 1 },
      weapon: "pickaxe",
      station: null,
      desc: "Kreves for effektiv gruvedrift og malm.",
    },
    {
      id: "spear",
      name: "Lag spyd",
      category: "Våpen",
      cost: { wood: 5, stone: 2, cloth: 1 },
      weapon: "spear",
      station: null,
      desc: "Lengre rekkevidde i nærkamp.",
    },
    {
      id: "bandage",
      name: "Lag 2 bandasjer",
      category: "Medisin",
      cost: { cloth: 3, herbs: 1 },
      item: "bandage",
      amount: 2,
      station: null,
      desc: "Trygg tidlig healing.",
    },
    {
      id: "arrows",
      name: "Lag 10 piler",
      category: "Ammo",
      cost: { wood: 3, stone: 1 },
      item: "arrows",
      amount: 10,
      station: null,
      desc: "Ammunisjon til bue.",
    },
    {
      id: "campfire",
      name: "Bygg bål",
      category: "Bygg",
      cost: { wood: 6, stone: 4 },
      build: "campfire",
      station: null,
      desc: "Renser vann og lager kull.",
    },
    {
      id: "workbench",
      name: "Bygg arbeidsbenk",
      category: "Bygg",
      cost: { wood: 12, scrap: 6 },
      build: "workbench",
      station: null,
      desc: "Låser opp flere oppskrifter.",
    },
    {
      id: "woodWall",
      name: "Bygg trevegg",
      category: "Bygg",
      cost: { wood: 5 },
      build: "woodWall",
      station: null,
      desc: "Billig baseforsvar.",
    },
    {
      id: "spikes",
      name: "Bygg piggfelle",
      category: "Bygg",
      cost: { wood: 7, stone: 3 },
      build: "spikes",
      station: null,
      desc: "Skader zombier som går over den.",
    },
    {
      id: "bow",
      name: "Lag bue",
      category: "Våpen",
      cost: { wood: 8, cloth: 4 },
      weapon: "bow",
      station: "workbench",
      desc: "Stille avstandsvåpen.",
    },
    {
      id: "canteen",
      name: "Lag feltflaske",
      category: "Utstyr",
      cost: { scrap: 3, cloth: 2 },
      item: "canteen",
      amount: 1,
      station: "workbench",
      desc: "Samler mer vann fra pytter.",
    },
    {
      id: "rainCollector",
      name: "Bygg regnsamler",
      category: "Bygg",
      cost: { wood: 8, cloth: 4, scrap: 3 },
      build: "rainCollector",
      station: "workbench",
      desc: "Produserer rent vann over tid.",
    },
    {
      id: "torch",
      name: "Bygg fakkel",
      category: "Bygg",
      cost: { wood: 2, cloth: 1 },
      build: "torch",
      station: "workbench",
      desc: "Lys rundt basen.",
    },
    {
      id: "bedroll",
      name: "Bygg sovepose",
      category: "Bygg",
      cost: { cloth: 6, wood: 2 },
      build: "bedroll",
      station: "workbench",
      desc: "Setter respawnpunkt.",
    },
    {
      id: "storage",
      name: "Bygg lagerkasse",
      category: "Bygg",
      cost: { wood: 10, scrap: 2 },
      build: "storage",
      station: "workbench",
      desc: "Baseobjekt og fremtidig lagring.",
    },
    {
      id: "smelter",
      name: "Bygg smelter",
      category: "Bygg",
      cost: { stone: 14, scrap: 6, wood: 6 },
      build: "smelter",
      station: "workbench",
      desc: "Smelter jernmalm til metall.",
    },
    {
      id: "stoneWall",
      name: "Bygg steinvegg",
      category: "Bygg",
      cost: { stone: 10, metal: 1 },
      build: "stoneWall",
      station: "smelter",
      desc: "Sterkere baseforsvar.",
    },
    {
      id: "pistol",
      name: "Reparer pistol",
      category: "Våpen",
      cost: { scrap: 14, parts: 4, metal: 2 },
      weapon: "pistol",
      station: "workbench",
      desc: "Bråkete, men effektiv.",
    },
    {
      id: "shotgun",
      name: "Bygg hagle",
      category: "Våpen",
      cost: { scrap: 22, parts: 8, wood: 6, metal: 4 },
      weapon: "shotgun",
      station: "smelter",
      desc: "Kraftig baseforsvar.",
    },
  ];

  const REFINING = [
    {
      id: "charcoal",
      name: "Brenn treverk til kull",
      station: "campfire",
      cost: { wood: 2 },
      output: { coal: 1 },
      time: 4,
    },
    {
      id: "cleanWater",
      name: "Rens skittent vann",
      station: "campfire",
      cost: { dirtyWater: 1, wood: 1 },
      output: { water: 1 },
      time: 3,
    },
    {
      id: "smeltIron",
      name: "Smelt jernmalm til metall",
      station: "smelter",
      cost: { ore: 2, coal: 1 },
      output: { metal: 1 },
      time: 5,
    },
    {
      id: "ammo",
      name: "Press 12 patroner",
      station: "smelter",
      cost: { scrap: 5, metal: 1 },
      output: { ammo: 12 },
      time: 4,
    },
  ];

  const state = {
    worldW: 5120,
    worldH: 5120,
    dayLength: 460,
    day: 1,
    time: 8 * 60,
    camera: { x: 0, y: 0, shake: 0 },
    player: {
      x: 2560,
      y: 2560,
      spawnX: 2560,
      spawnY: 2560,
      r: 16,
      hp: 100,
      stamina: 100,
      hunger: 86,
      thirst: 84,
      weapon: "knife",
      attackCd: 0,
      interactCd: 0,
      iframe: 0,
      noise: 0,
      frame: 0,
    },
    inv: {},
    weapons: new Set(["knife"]),
    nodes: [],
    buildings: [],
    zombies: [],
    drops: [],
    projectiles: [],
    particles: [],
    messages: [],
  };

  let running = false;
  let paused = false;
  let lastTime = performance.now();
  let selectedBuild = null;
  let selectedBuildRecipe = null;
  let panelMode = null;
  let selectedStationBuilding = null;

  const keys = new Set();
  const pressed = new Set();

  const mouse = {
    x: 0,
    y: 0,
    wx: 0,
    wy: 0,
    down: false,
    clicked: false,
  };

  function itemName(id) {
    return ITEMS[id] || WEAPONS[id]?.name || BUILDINGS[id]?.name || id;
  }

  function addItem(id, amount = 1) {
    if (amount <= 0) return;
    state.inv[id] = (state.inv[id] || 0) + amount;
  }

  function removeItem(id, amount = 1) {
    if ((state.inv[id] || 0) < amount) return false;
    state.inv[id] -= amount;
    if (state.inv[id] <= 0) delete state.inv[id];
    return true;
  }

  function canPay(cost) {
    return Object.entries(cost || {}).every(([id, amount]) => {
      return (state.inv[id] || 0) >= amount;
    });
  }

  function pay(cost) {
    if (!canPay(cost)) return false;
    Object.entries(cost || {}).forEach(([id, amount]) => removeItem(id, amount));
    return true;
  }

  function costText(cost) {
    return Object.entries(cost || {})
      .map(([id, amount]) => `${itemName(id)} ×${amount}`)
      .join(", ");
  }

  function missingText(cost) {
    return Object.entries(cost || {})
      .filter(([id, amount]) => (state.inv[id] || 0) < amount)
      .map(([id, amount]) => `${itemName(id)} ×${amount - (state.inv[id] || 0)}`)
      .join(", ");
  }

  function stationName(id) {
    if (!id) return "ingen";
    return BUILDINGS[id]?.name || id;
  }

  function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    toastLayer.appendChild(el);
    setTimeout(() => el.remove(), 3200);

    state.messages.unshift(message);
    state.messages = state.messages.slice(0, 5);
    renderLog();
  }

  function renderLog() {
    messageLog.innerHTML = state.messages.map((m) => `<div>${m}</div>`).join("");
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", resize);
  resize();

  function updateMouseWorld() {
    mouse.wx = mouse.x + state.camera.x;
    mouse.wy = mouse.y + state.camera.y;
  }

  function setMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    updateMouseWorld();
  }

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (!keys.has(key)) pressed.add(key);
    keys.add(key);

    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }

    handleKey(key);
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  canvas.addEventListener("mousemove", setMouse);

  canvas.addEventListener("mousedown", (event) => {
    setMouse(event);
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
      handleClick();
    }
  });

  window.addEventListener("mouseup", () => {
    mouse.down = false;
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  $("startBtn").addEventListener("click", () => start(false));
  $("continueBtn").addEventListener("click", () => start(true));
  $("howToBtn").addEventListener("click", () => helpScreen.classList.add("screen--active"));
  $("closeHelpBtn").addEventListener("click", () => helpScreen.classList.remove("screen--active"));
  $("resumeBtn").addEventListener("click", () => togglePause(false));
  $("saveBtn").addEventListener("click", saveGame);

  $("newGameBtn").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    resetWorld();
    togglePause(false);
  });

  $("restartBtn").addEventListener("click", () => {
    gameOverScreen.classList.remove("screen--active");
    resetWorld();
    running = true;
    hud.classList.remove("hidden");
    requestAnimationFrame(loop);
  });

  $("backToTitleBtn").addEventListener("click", () => {
    gameOverScreen.classList.remove("screen--active");
    titleScreen.classList.add("screen--active");
    hud.classList.add("hidden");
    running = false;
  });

  $("closePanelBtn").addEventListener("click", closePanel);

  function start(tryLoad) {
    if (!tryLoad || !loadGame()) {
      resetWorld();
    }

    titleScreen.classList.remove("screen--active");
    helpScreen.classList.remove("screen--active");
    pauseScreen.classList.remove("screen--active");

    hud.classList.remove("hidden");

    running = true;
    paused = false;
    lastTime = performance.now();

    toast("Finn vann, lag hakke og bygg før natten.");
    requestAnimationFrame(loop);
  }

  function saveGame() {
    const saveData = {
      ...state,
      weapons: [...state.weapons],
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    toast("Lagret.");
  }

  function loadGame() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      toast("Ingen lagring funnet.");
      return false;
    }

    try {
      const data = JSON.parse(raw);

      state.worldW = data.worldW || 5120;
      state.worldH = data.worldH || 5120;
      state.dayLength = data.dayLength || 460;
      state.day = data.day || 1;
      state.time = data.time || 8 * 60;
      state.camera = data.camera || { x: 0, y: 0, shake: 0 };
      state.player = data.player;
      state.inv = data.inv || {};
      state.weapons = new Set(Array.isArray(data.weapons) ? data.weapons : ["knife"]);
      state.nodes = data.nodes || [];
      state.buildings = data.buildings || [];
      state.zombies = data.zombies || [];
      state.drops = data.drops || [];
      state.projectiles = [];
      state.particles = [];
      state.messages = data.messages || [];

      selectedBuild = null;
      selectedBuildRecipe = null;

      renderHotbar();
      renderObjectives();
      renderLog();

      toast("Lagring lastet.");
      return true;
    } catch (error) {
      console.error(error);
      toast("Kunne ikke laste lagring.");
      return false;
    }
  }

  function resetWorld() {
    state.worldW = 5120;
    state.worldH = 5120;
    state.dayLength = 460;
    state.day = 1;
    state.time = 8 * 60;

    state.camera = { x: 0, y: 0, shake: 0 };

    state.player = {
      x: state.worldW / 2,
      y: state.worldH / 2,
      spawnX: state.worldW / 2,
      spawnY: state.worldH / 2,
      r: 16,
      hp: 100,
      stamina: 100,
      hunger: 86,
      thirst: 84,
      weapon: "knife",
      attackCd: 0,
      interactCd: 0,
      iframe: 0,
      noise: 0,
      frame: 0,
    };

    state.inv = {
      wood: 8,
      stone: 5,
      food: 3,
      water: 2,
      cloth: 3,
    };

    state.weapons = new Set(["knife"]);
    state.nodes = [];
    state.buildings = [];
    state.zombies = [];
    state.drops = [];
    state.projectiles = [];
    state.particles = [];
    state.messages = [];

    selectedBuild = null;
    selectedBuildRecipe = null;
    panelMode = null;
    selectedStationBuilding = null;

    generateWorld();
    renderHotbar();
    renderObjectives();
    renderLog();
  }

  function generateWorld() {
    function addNode(type, x, y) {
      const def = nodeDef(type);

      state.nodes.push({
        id: uid(),
        type,
        x,
        y,
        hp: def.hp,
        maxHp: def.hp,
        depleted: false,
        cooldown: 0,
        rotation: rand(-0.2, 0.2),
      });
    }

    function place(type, count, minSpawnDistance = 360) {
      for (let i = 0; i < count; i++) {
        let x;
        let y;
        let tries = 0;

        do {
          x = rand(80, state.worldW - 80);
          y = rand(80, state.worldH - 80);
          tries++;
        } while (
          dist(x, y, state.player.x, state.player.y) < minSpawnDistance &&
          tries < 40
        );

        addNode(type, x, y);
      }
    }

    place("tree", 260, 120);
    place("rock", 78, 170);
    place("oreRock", 46, 330);
    place("puddle", 34, 160);
    place("bush", 55, 130);
    place("scrapPile", 42, 220);

    const starterNodes = [
      ["tree", -140, -80],
      ["tree", -190, 70],
      ["rock", 160, -110],
      ["puddle", 155, 75],
      ["bush", 70, -120],
      ["scrapPile", -210, -80],
      ["oreRock", 260, 180],
    ];

    for (const [type, dx, dy] of starterNodes) {
      addNode(type, state.player.x + dx, state.player.y + dy);
    }

    for (let i = 0; i < 36; i++) {
      spawnZombie(true);
    }
  }

  function nodeDef(type) {
    const defs = {
      tree: {
        name: "Tre",
        hp: 5,
        color: "#245c36",
        needs: null,
        noise: 130,
      },
      rock: {
        name: "Stor stein",
        hp: 7,
        color: "#737d80",
        needs: null,
        noise: 170,
      },
      oreRock: {
        name: "Malmstein",
        hp: 9,
        color: "#586165",
        needs: "pickaxe",
        noise: 190,
      },
      puddle: {
        name: "Vannpytt",
        hp: 1,
        color: "#236d88",
        needs: null,
        noise: 35,
      },
      bush: {
        name: "Bærbusk",
        hp: 2,
        color: "#357a45",
        needs: null,
        noise: 45,
      },
      scrapPile: {
        name: "Skrothaug",
        hp: 4,
        color: "#82745e",
        needs: null,
        noise: 120,
      },
    };

    return defs[type];
  }

  function zombieDef(type) {
    const defs = {
      walker: {
        name: "Vandrer",
        hp: 56,
        speed: 56,
        damage: 8,
        radius: 15,
        sense: 235,
        color: "#6e8f62",
        attackCooldown: 1.0,
      },
      runner: {
        name: "Løper",
        hp: 38,
        speed: 102,
        damage: 7,
        radius: 14,
        sense: 285,
        color: "#8f9160",
        attackCooldown: 0.72,
      },
      brute: {
        name: "Kjempe",
        hp: 160,
        speed: 42,
        damage: 20,
        radius: 22,
        sense: 230,
        color: "#65705f",
        attackCooldown: 1.25,
      },
      spitter: {
        name: "Spytter",
        hp: 70,
        speed: 50,
        damage: 6,
        radius: 16,
        sense: 310,
        color: "#73996f",
        attackCooldown: 1.4,
      },
    };

    return defs[type];
  }

  function spawnZombie(farFromPlayer = false) {
    let x;
    let y;
    let tries = 0;

    do {
      x = rand(80, state.worldW - 80);
      y = rand(80, state.worldH - 80);
      tries++;
    } while (
      farFromPlayer &&
      dist(x, y, state.player.x, state.player.y) < 720 &&
      tries < 60
    );

    const roll = Math.random();
    const type =
      roll < 0.72 ? "walker" :
      roll < 0.90 ? "runner" :
      roll < 0.97 ? "spitter" :
      "brute";

    const def = zombieDef(type);

    state.zombies.push({
      id: uid(),
      type,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      state: "wander",
      targetX: x + rand(-220, 220),
      targetY: y + rand(-220, 220),
      attackTimer: rand(0, 1),
      spitTimer: rand(1, 4),
      frame: 0,
    });
  }

  function handleKey(key) {
    if (key === "escape") {
      if (selectedBuild) {
        selectedBuild = null;
        selectedBuildRecipe = null;
        toast("Bygging avbrutt.");
        return;
      }

      if (!sidePanel.classList.contains("hidden")) {
        closePanel();
        return;
      }

      if (running) {
        togglePause();
      }

      return;
    }

    if (!running || paused) return;

    if (key === "i") showInventory();
    if (key === "c") showCrafting();
    if (key === "b") showBuildMenu();
    if (key === "f") useFood();
    if (key === "v") drink();
    if (key === "h") heal();
    if (key === "e") interact();
    if (key === " ") dodge();

    if (["1", "2", "3", "4", "5", "6"].includes(key)) {
      selectWeapon(Number(key) - 1);
    }
  }

  function togglePause(force) {
    paused = typeof force === "boolean" ? force : !paused;
    pauseScreen.classList.toggle("screen--active", paused);
    if (paused) saveGame();
  }

  function closePanel() {
    sidePanel.classList.add("hidden");
    panelMode = null;
    selectedStationBuilding = null;
  }

  function handleClick() {
    if (!running || paused) return;

    if (selectedBuild) {
      placeBuilding(selectedBuild, mouse.wx, mouse.wy);
      return;
    }

    attack();
  }

  function loop(time) {
    const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
    lastTime = time;

    if (running && !paused) {
      update(dt);
    }

    draw();

    pressed.clear();
    mouse.clicked = false;

    if (running) {
      requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    const player = state.player;

    player.attackCd = Math.max(0, player.attackCd - dt);
    player.interactCd = Math.max(0, player.interactCd - dt);
    player.iframe = Math.max(0, player.iframe - dt);
    player.noise = Math.max(0, player.noise - dt * 240);

    state.time += dt * (24 * 60 / state.dayLength);

    if (state.time >= 1440) {
      state.time -= 1440;
      state.day++;

      while (state.zombies.length < Math.min(110, 36 + state.day * 7)) {
        spawnZombie(true);
      }

      toast(`Dag ${state.day}. Flere zombier samles.`);
    }

    updatePlayer(dt);
    updateNodes(dt);
    updateBuildings(dt);
    updateProjectiles(dt);
    updateZombies(dt);
    updateDrops(dt);
    updateParticles(dt);
    autoPickup();
    updateHud();

    if (player.hp <= 0) {
      gameOver();
    }
  }

  function updatePlayer(dt) {
    const player = state.player;

    const inputX =
      (isDown("d", "arrowright") ? 1 : 0) -
      (isDown("a", "arrowleft") ? 1 : 0);

    const inputY =
      (isDown("s", "arrowdown") ? 1 : 0) -
      (isDown("w", "arrowup") ? 1 : 0);

    const length = Math.hypot(inputX, inputY) || 1;
    const sprinting = isDown("shift") && player.stamina > 4 && (inputX || inputY);

    const speed = 148 * (sprinting ? 1.62 : 1);

    movePlayer(
      player.x + (inputX / length) * speed * dt,
      player.y + (inputY / length) * speed * dt
    );

    if (inputX || inputY) {
      player.frame += dt * (sprinting ? 12 : 7);
      player.noise = Math.max(player.noise, sprinting ? 155 : 72);
      player.stamina = clamp(player.stamina + (sprinting ? -22 : 10) * dt, 0, 100);
    } else {
      player.stamina = clamp(player.stamina + 16 * dt, 0, 100);
    }

    player.hunger = clamp(player.hunger - dt * 0.38, 0, 100);
    player.thirst = clamp(player.thirst - dt * 0.54, 0, 100);

    if (player.hunger <= 0 || player.thirst <= 0) {
      player.hp = clamp(player.hp - dt * 3.4, 0, 100);
    }

    if (player.hunger > 72 && player.thirst > 72) {
      player.hp = clamp(player.hp + dt * 0.65, 0, 100);
    }
  }

  function movePlayer(nextX, nextY) {
    const player = state.player;
    const oldX = player.x;
    const oldY = player.y;

    player.x = clamp(nextX, 20, state.worldW - 20);
    player.y = clamp(nextY, 20, state.worldH - 20);

    for (const building of state.buildings) {
      const def = BUILDINGS[building.type];
      if (!def.solid) continue;

      if (
        rectCircleCollision(
          building.x,
          building.y,
          building.w,
          building.h,
          player.x,
          player.y,
          player.r
        )
      ) {
        player.x = oldX;
        player.y = oldY;
        return;
      }
    }
  }

  function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
    const closestX = clamp(cx, rx - rw / 2, rx + rw / 2);
    const closestY = clamp(cy, ry - rh / 2, ry + rh / 2);
    return dist(closestX, closestY, cx, cy) < cr;
  }

  function isDown(...values) {
    return values.some((value) => keys.has(value));
  }

  function isNight() {
    const hour = state.time / 60;
    return hour < 6 || hour >= 21;
  }

  function attack() {
    const player = state.player;
    const weapon = WEAPONS[player.weapon] || WEAPONS.knife;

    if (player.attackCd > 0) return;

    if (weapon.ammo && !removeItem(weapon.ammo, 1)) {
      toast(`Mangler ${itemName(weapon.ammo)}.`);
      return;
    }

    player.attackCd = weapon.cooldown;
    player.stamina = clamp(player.stamina - (weapon.stamina || 0), 0, 100);
    player.noise = Math.max(player.noise, weapon.noise);

    const angle = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);

    if (weapon.type === "projectile") {
      state.projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        damage: weapon.damage,
        life: weapon.range / weapon.speed,
        enemy: false,
        kind: "arrow",
      });
      return;
    }

    if (weapon.type === "spread") {
      for (let i = 0; i < weapon.pellets; i++) {
        const spreadAngle = angle + rand(-0.26, 0.26);
        state.projectiles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(spreadAngle) * weapon.speed,
          vy: Math.sin(spreadAngle) * weapon.speed,
          damage: weapon.damage,
          life: weapon.range / weapon.speed,
          enemy: false,
          kind: "shot",
        });
      }
      return;
    }

    let hit = false;

    for (const zombie of state.zombies) {
      const distance = dist(player.x, player.y, zombie.x, zombie.y);
      const zombieAngle = Math.atan2(zombie.y - player.y, zombie.x - player.x);
      const deltaAngle = Math.abs(
        Math.atan2(Math.sin(zombieAngle - angle), Math.cos(zombieAngle - angle))
      );

      if (distance < weapon.range + zombie.radius && deltaAngle < 1.05) {
        damageZombie(
          zombie,
          weapon.damage,
          Math.cos(angle) * 45,
          Math.sin(angle) * 45
        );
        hit = true;
        break;
      }
    }

    if (!hit) {
      hitNodeInArc(angle, weapon);
    }
  }

  function hitNodeInArc(angle, weapon) {
    const player = state.player;

    for (const node of state.nodes) {
      if (node.depleted) continue;

      const distance = dist(player.x, player.y, node.x, node.y);
      const nodeAngle = Math.atan2(node.y - player.y, node.x - player.x);
      const deltaAngle = Math.abs(
        Math.atan2(Math.sin(nodeAngle - angle), Math.cos(nodeAngle - angle))
      );

      if (distance < 58 && deltaAngle < 0.9) {
        harvest(node, true);
        return;
      }
    }
  }

  function damageZombie(zombie, amount, knockX = 0, knockY = 0) {
    zombie.hp -= amount;
    zombie.x += knockX;
    zombie.y += knockY;
    zombie.state = "chase";

    particle(zombie.x, zombie.y, zombieDef(zombie.type).color, 8);

    if (zombie.hp <= 0) {
      state.zombies = state.zombies.filter((z) => z !== zombie);

      const loot =
        zombie.type === "brute"
          ? { scrap: [1, 4], parts: [0, 2] }
          : { cloth: [0, 2], food: [0, 1], scrap: [0, 1] };

      giveLoot(loot, zombie.x, zombie.y);

      setTimeout(() => spawnZombie(true), randi(1200, 5000));
    }
  }

  function dodge() {
    const player = state.player;
    if (player.stamina < 20) return;

    const angle = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);

    movePlayer(
      player.x - Math.cos(angle) * 60,
      player.y - Math.sin(angle) * 60
    );

    player.stamina -= 20;
    player.iframe = 0.25;
  }

  function interact() {
    const player = state.player;

    if (player.interactCd > 0) return;
    player.interactCd = 0.25;

    const drop = nearestDrop();
    if (drop) {
      collectDrop(drop);
      return;
    }

    const building = nearestBuilding(player.x, player.y, 72);
    if (building) {
      useBuilding(building);
      return;
    }

    const node = nearestNode();
    if (node) {
      harvest(node, false);
      return;
    }

    toast("Ingenting å bruke her.");
  }

  function nearestNode() {
    let best = null;
    let bestDistance = 68;

    for (const node of state.nodes) {
      if (node.depleted) continue;

      const distance = dist(state.player.x, state.player.y, node.x, node.y);
      if (distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }

    return best;
  }

  function nearestDrop() {
    let best = null;
    let bestDistance = 42;

    for (const drop of state.drops) {
      const distance = dist(state.player.x, state.player.y, drop.x, drop.y);
      if (distance < bestDistance) {
        best = drop;
        bestDistance = distance;
      }
    }

    return best;
  }

  function nearestBuilding(x, y, radius, predicate = () => true) {
    let best = null;
    let bestDistance = radius;

    for (const building of state.buildings) {
      if (!predicate(building)) continue;

      const distance = dist(x, y, building.x, building.y);
      if (distance < bestDistance) {
        best = building;
        bestDistance = distance;
      }
    }

    return best;
  }

  function harvest(node, fromAttack) {
    const def = nodeDef(node.type);

    if (def.needs && !state.weapons.has(def.needs)) {
      toast(`${def.name} krever ${itemName(def.needs)}.`);
      return;
    }

    if (node.type === "puddle") {
      const amount = state.inv.canteen ? randi(3, 5) : randi(1, 2);
      addItem("dirtyWater", amount);
      node.depleted = true;
      node.cooldown = 55;
      toast(`Samlet skittent vann ×${amount}.`);
      refreshPanel();
      return;
    }

    const tool = bestToolFor(node.type);
    const goodTool =
      (node.type === "tree" && tool === "axe") ||
      ((node.type === "rock" || node.type === "oreRock") && tool === "pickaxe");

    node.hp -= goodTool ? 2 : 1;

    state.player.noise = Math.max(
      state.player.noise,
      def.noise + (goodTool ? -30 : 20)
    );

    if (!fromAttack) {
      state.player.stamina = clamp(state.player.stamina - 6, 0, 100);
    }

    particle(node.x, node.y, def.color, 6);

    if (node.hp <= 0) {
      node.depleted = true;
      node.cooldown = node.type === "tree" ? 95 : 140;
      node.hp = node.maxHp;

      const loot = nodeLoot(node.type, goodTool);
      giveLoot(loot, node.x, node.y);

      toast(`${def.name} samlet.`);
      refreshPanel();
    }
  }

  function bestToolFor(nodeType) {
    if (nodeType === "tree" && state.weapons.has("axe")) return "axe";
    if ((nodeType === "rock" || nodeType === "oreRock") && state.weapons.has("pickaxe")) {
      return "pickaxe";
    }
    return state.player.weapon;
  }

  function nodeLoot(type, goodTool) {
    if (type === "tree") {
      return { wood: goodTool ? [5, 9] : [2, 5] };
    }

    if (type === "rock") {
      return {
        stone: goodTool ? [7, 12] : [2, 4],
        ore: goodTool ? [0, 1] : [0, 0],
      };
    }

    if (type === "oreRock") {
      return {
        stone: goodTool ? [5, 9] : [2, 4],
        ore: goodTool ? [4, 8] : [1, 2],
        coal: goodTool ? [0, 1] : [0, 0],
      };
    }

    if (type === "bush") {
      return {
        food: [1, 3],
        herbs: [0, 2],
        wood: [0, 1],
      };
    }

    if (type === "scrapPile") {
      return {
        scrap: [1, 4],
        cloth: [0, 2],
        parts: [0, 1],
        metal: [0, 1],
      };
    }

    return {};
  }

  function giveLoot(table, x, y) {
    for (const [id, range] of Object.entries(table)) {
      const amount = Array.isArray(range) ? randi(range[0], range[1]) : range;

      if (amount > 0) {
        state.drops.push({
          id,
          amount,
          x: x + rand(-14, 14),
          y: y + rand(-14, 14),
          vx: rand(-30, 30),
          vy: rand(-30, 30),
        });
      }
    }
  }

  function collectDrop(drop) {
    addItem(drop.id, drop.amount);
    state.drops = state.drops.filter((d) => d !== drop);
    toast(`Plukket opp ${itemName(drop.id)} ×${drop.amount}`);
    refreshPanel();
  }

  function autoPickup() {
    for (const drop of [...state.drops]) {
      if (dist(state.player.x, state.player.y, drop.x, drop.y) < 22) {
        collectDrop(drop);
      }
    }
  }

  function useBuilding(building) {
    if (
      building.type === "workbench" ||
      building.type === "campfire" ||
      building.type === "smelter"
    ) {
      showStation(building);
      return;
    }

    if (building.type === "rainCollector") {
      const amount = Math.floor(building.waterStore || 0);

      if (amount > 0) {
        addItem("water", amount);
        building.waterStore = 0;
        toast(`Tømte regnsamler: rent vann ×${amount}`);
      } else {
        toast("Regnsamleren er tom.");
      }

      refreshPanel();
      return;
    }

    if (building.type === "bedroll") {
      state.player.spawnX = building.x;
      state.player.spawnY = building.y;
      toast("Respawnpunkt satt.");
      return;
    }

    toast(`${BUILDINGS[building.type].name} står her.`);
  }

  function getBuildRecipe(type) {
    if (selectedBuildRecipe) {
      const selectedRecipe = RECIPES.find(
        (recipe) => recipe.id === selectedBuildRecipe && recipe.build === type
      );

      if (selectedRecipe) return selectedRecipe;
    }

    return RECIPES.find((recipe) => recipe.build === type);
  }

  function canPlaceBuildingAt(type, x, y) {
    const def = BUILDINGS[type];

    if (!def) {
      return { ok: false, reason: "Ukjent bygg." };
    }

    if (x < 30 || y < 30 || x > state.worldW - 30 || y > state.worldH - 30) {
      return { ok: false, reason: "Kan ikke bygge utenfor kartet." };
    }

    for (const building of state.buildings) {
      const overlap =
        Math.abs(building.x - x) < (building.w + def.w) / 2 + 8 &&
        Math.abs(building.y - y) < (building.h + def.h) / 2 + 8;

      if (overlap) {
        return { ok: false, reason: "For nær et annet bygg." };
      }
    }

    for (const node of state.nodes) {
      if (!node.depleted && dist(x, y, node.x, node.y) < 54) {
        return { ok: false, reason: "Rydd området først." };
      }
    }

    return { ok: true, reason: "Kan bygges her." };
  }

  function placeBuilding(type, x, y) {
    const def = BUILDINGS[type];
    const recipe = getBuildRecipe(type);

    if (!def || !recipe) return;

    if (!stationNear(recipe.station)) {
      toast(`Du må stå ved ${stationName(recipe.station)}.`);
      return;
    }

    if (!canPay(recipe.cost)) {
      toast(`Mangler: ${missingText(recipe.cost)}`);
      return;
    }

    const placement = canPlaceBuildingAt(type, x, y);

    if (!placement.ok) {
      toast(placement.reason);
      return;
    }

    if (!pay(recipe.cost)) {
      toast(`Mangler: ${missingText(recipe.cost)}`);
      return;
    }

    const building = {
      id: uid(),
      type,
      x,
      y,
      w: def.w,
      h: def.h,
      hp: def.hp,
      maxHp: def.hp,
      waterStore: 0,
      job: null,
    };

    state.buildings.push(building);

    if (type === "bedroll") {
      state.player.spawnX = x;
      state.player.spawnY = y;
    }

    selectedBuild = null;
    selectedBuildRecipe = null;

    toast(`${def.name} bygget.`);
    refreshPanel();
  }

  function stationNear(station) {
    if (!station) return true;
    return Boolean(
      nearestBuilding(state.player.x, state.player.y, 110, (building) => {
        return building.type === station;
      })
    );
  }

  function craft(id) {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) return;

    if (recipe.build) {
      if (!stationNear(recipe.station)) {
        toast(`Du må stå ved ${stationName(recipe.station)}.`);
        return;
      }

      if (!canPay(recipe.cost)) {
        toast(`Mangler: ${missingText(recipe.cost)}`);
        return;
      }

      selectedBuild = recipe.build;
      selectedBuildRecipe = recipe.id;

      toast(
        `Velg plassering for ${BUILDINGS[recipe.build].name}. Ressursene trekkes først når bygget plasseres.`
      );

      refreshPanel();
      return;
    }

    if (!stationNear(recipe.station)) {
      toast(`Du må stå ved ${stationName(recipe.station)}.`);
      return;
    }

    if (!pay(recipe.cost)) {
      toast(`Mangler: ${missingText(recipe.cost)}`);
      return;
    }

    if (recipe.weapon) {
      state.weapons.add(recipe.weapon);
      state.player.weapon = recipe.weapon;
      toast(`Laget ${WEAPONS[recipe.weapon].name}.`);
      renderHotbar();
    }

    if (recipe.item) {
      addItem(recipe.item, recipe.amount || 1);
      toast(`Laget ${itemName(recipe.item)} ×${recipe.amount || 1}.`);
    }

    refreshPanel();
  }

  function refine(id, building) {
    const recipe = REFINING.find((r) => r.id === id);
    if (!recipe) return;

    const station =
      building ||
      nearestBuilding(state.player.x, state.player.y, 110, (b) => b.type === recipe.station);

    if (!station) {
      toast(`Du må stå ved ${stationName(recipe.station)}.`);
      return;
    }

    if (station.job) {
      toast("Stasjonen er opptatt.");
      return;
    }

    if (!pay(recipe.cost)) {
      toast(`Mangler: ${missingText(recipe.cost)}`);
      return;
    }

    station.job = {
      id: recipe.id,
      t: 0,
      total: recipe.time,
    };

    toast(`${recipe.name} startet.`);
    refreshPanel();
  }

  function updateNodes(dt) {
    for (const node of state.nodes) {
      if (node.depleted) {
        node.cooldown -= dt;

        if (node.cooldown <= 0) {
          node.depleted = false;
          node.hp = node.maxHp;
        }
      }
    }
  }

  function updateBuildings(dt) {
    for (const building of state.buildings) {
      if (building.job) {
        const recipe = REFINING.find((r) => r.id === building.job.id);
        building.job.t += dt;

        if (building.job.t >= building.job.total) {
          for (const [id, amount] of Object.entries(recipe.output)) {
            addItem(id, amount);
          }

          toast(`Ferdig: ${costText(recipe.output)}`);
          building.job = null;
          refreshPanel();
        }
      }

      if (building.type === "rainCollector") {
        building.waterStore = clamp((building.waterStore || 0) + dt * 0.025, 0, 8);
      }
    }

    state.buildings = state.buildings.filter((building) => building.hp > 0);
  }

  function updateProjectiles(dt) {
    for (const projectile of state.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;

      if (projectile.enemy) {
        if (
          dist(projectile.x, projectile.y, state.player.x, state.player.y) <
          state.player.r + 6
        ) {
          if (state.player.iframe <= 0) {
            state.player.hp -= projectile.damage;
            state.player.iframe = 0.35;
            hitEffect();
          }

          projectile.life = -1;
        }

        continue;
      }

      for (const zombie of state.zombies) {
        if (dist(projectile.x, projectile.y, zombie.x, zombie.y) < zombie.radius + 5) {
          damageZombie(
            zombie,
            projectile.damage,
            projectile.vx * 0.035,
            projectile.vy * 0.035
          );
          projectile.life = -1;
          break;
        }
      }
    }

    state.projectiles = state.projectiles.filter((p) => {
      return (
        p.life > 0 &&
        p.x > 0 &&
        p.y > 0 &&
        p.x < state.worldW &&
        p.y < state.worldH
      );
    });
  }

  function updateZombies(dt) {
    const player = state.player;

    for (const zombie of [...state.zombies]) {
      const def = zombieDef(zombie.type);
      const distanceToPlayer = dist(player.x, player.y, zombie.x, zombie.y);

      const aggro =
        def.sense +
        (isNight() ? 95 : 0) +
        Math.min(180, player.noise);

      if (distanceToPlayer < aggro) {
        zombie.state = "chase";
      } else if (distanceToPlayer > aggro * 1.75 && zombie.state === "chase") {
        zombie.state = "wander";
      }

      let targetX = zombie.targetX;
      let targetY = zombie.targetY;
      let speed = def.speed;

      if (zombie.state === "chase") {
        targetX = player.x;
        targetY = player.y;
        if (isNight()) speed *= 1.1;
      } else if (
        dist(zombie.x, zombie.y, zombie.targetX, zombie.targetY) < 25 ||
        Math.random() < dt * 0.04
      ) {
        zombie.targetX = clamp(zombie.x + rand(-260, 260), 40, state.worldW - 40);
        zombie.targetY = clamp(zombie.y + rand(-260, 260), 40, state.worldH - 40);
      }

      const angle = Math.atan2(targetY - zombie.y, targetX - zombie.x);

      zombie.x += Math.cos(angle) * speed * dt;
      zombie.y += Math.sin(angle) * speed * dt;
      zombie.frame += dt * 7;
      zombie.attackTimer -= dt;
      zombie.spitTimer -= dt;

      const blockingBuilding = nearestBuilding(
        zombie.x,
        zombie.y,
        45,
        (b) => BUILDINGS[b.type].solid || BUILDINGS[b.type].trap
      );

      if (blockingBuilding && zombie.attackTimer <= 0) {
        blockingBuilding.hp -= def.damage * 0.8;
        zombie.attackTimer = 0.8;

        particle(blockingBuilding.x, blockingBuilding.y, "#d6b47a", 4);

        if (BUILDINGS[blockingBuilding.type].trap) {
          damageZombie(zombie, 24);
        }
      }

      if (
        zombie.type === "spitter" &&
        zombie.state === "chase" &&
        distanceToPlayer < 320 &&
        zombie.spitTimer <= 0
      ) {
        const spitAngle = Math.atan2(player.y - zombie.y, player.x - zombie.x);

        state.projectiles.push({
          x: zombie.x,
          y: zombie.y,
          vx: Math.cos(spitAngle) * 320,
          vy: Math.sin(spitAngle) * 320,
          damage: 10,
          life: 1.3,
          enemy: true,
          kind: "acid",
        });

        zombie.spitTimer = 2.5;
      }

      if (
        distanceToPlayer < zombie.radius + player.r + 7 &&
        zombie.attackTimer <= 0
      ) {
        if (player.iframe <= 0) {
          player.hp = clamp(player.hp - def.damage, 0, 100);
          player.iframe = 0.45;
          hitEffect();
        }

        zombie.attackTimer = def.attackCooldown;
      }
    }
  }

  function updateDrops(dt) {
    for (const drop of state.drops) {
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vx *= Math.pow(0.05, dt);
      drop.vy *= Math.pow(0.05, dt);
    }
  }

  function updateParticles(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }

    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function particle(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x,
        y,
        vx: rand(-60, 60),
        vy: rand(-60, 60),
        life: rand(0.2, 0.65),
        color,
      });
    }
  }

  function hitEffect() {
    state.camera.shake = 10;

    if (damageVignette) {
      damageVignette.classList.add("hit");
      setTimeout(() => damageVignette.classList.remove("hit"), 180);
    }
  }

  function useFood() {
    if (!removeItem("food", 1)) {
      toast("Du har ikke mat.");
      return;
    }

    state.player.hunger = clamp(state.player.hunger + 28, 0, 100);
    toast("Du spiste mat.");
    refreshPanel();
  }

  function drink() {
    if (removeItem("water", 1)) {
      state.player.thirst = clamp(state.player.thirst + 35, 0, 100);
      toast("Du drakk rent vann.");
    } else if (removeItem("dirtyWater", 1)) {
      state.player.thirst = clamp(state.player.thirst + 22, 0, 100);

      if (Math.random() < 0.35) {
        state.player.hp -= 8;
        toast("Skittent vann gjorde deg syk.");
      } else {
        toast("Du drakk skittent vann.");
      }
    } else {
      toast("Du har ikke vann.");
    }

    refreshPanel();
  }

  function heal() {
    if (removeItem("medkit", 1)) {
      state.player.hp = clamp(state.player.hp + 65, 0, 100);
      toast("Førstehjelpspakke brukt.");
    } else if (removeItem("bandage", 1)) {
      state.player.hp = clamp(state.player.hp + 28, 0, 100);
      toast("Bandasje brukt.");
    } else {
      toast("Du har ikke førstehjelp.");
    }

    refreshPanel();
  }

  function selectWeapon(index) {
    const list = [...state.weapons];

    if (list[index]) {
      state.player.weapon = list[index];
      renderHotbar();
      toast(`Valgt: ${WEAPONS[list[index]].name}`);
    }
  }

  function showPanel(title, html) {
    sidePanelTitle.textContent = title;
    sidePanelContent.innerHTML = html;
    sidePanel.classList.remove("hidden");
  }

  function tabs(active) {
    return `
      <div class="panelTabs">
        <button data-tab="inventory" class="${active === "inventory" ? "active" : ""}">Inventory</button>
        <button data-tab="craft" class="${active === "craft" ? "active" : ""}">Crafting</button>
        <button data-tab="build" class="${active === "build" ? "active" : ""}">Bygg</button>
      </div>
    `;
  }

  function showInventory() {
    panelMode = "inventory";

    const weaponRows = [...state.weapons].map((weaponId) => {
      return `
        <div class="craftRow">
          <div>
            <strong>${WEAPONS[weaponId].name}</strong>
            <p>Våpen/verktøy</p>
          </div>
        </div>
      `;
    });

    const itemRows = Object.entries(state.inv).map(([id, amount]) => {
      const usable = ["food", "water", "dirtyWater", "bandage", "medkit"].includes(id);

      return `
        <div class="craftRow">
          <div>
            <strong>${itemName(id)} ×${amount}</strong>
            <p>${itemHint(id)}</p>
          </div>
          ${usable ? `<button data-use="${id}">Bruk</button>` : ""}
        </div>
      `;
    });

    showPanel("Inventory", tabs("inventory") + weaponRows.join("") + itemRows.join(""));
  }

  function itemHint(id) {
    if (id === "dirtyWater") return "Kan renses på bål.";
    if (id === "ore") return "Smeltes i smelter.";
    if (id === "coal") return "Brensel til smelter.";
    if (id === "metal") return "Brukes til avansert utstyr.";
    if (id === "canteen") return "Gir mer vann fra pytter.";
    return "";
  }

  function showCrafting(station = null) {
    panelMode = "craft";
    selectedStationBuilding = station;

    const rows = RECIPES
      .filter((recipe) => {
        if (recipe.build) return false;
        if (!station) return true;
        return recipe.station === station.type || !recipe.station;
      })
      .map(recipeRow)
      .join("");

    showPanel(
      "Crafting",
      tabs("craft") +
        `<p class="panelHint">Stasjoner: arbeidsbenk, bål og smelter åpner flere valg.</p>` +
        rows
    );
  }

  function showBuildMenu() {
    panelMode = "build";

    const rows = RECIPES
      .filter((recipe) => recipe.build)
      .map(recipeRow)
      .join("");

    showPanel(
      "Bygging",
      tabs("build") +
        `<p class="panelHint">Velg bygg, klikk i verden. Esc avbryter.</p>` +
        rows
    );
  }

  function recipeRow(recipe) {
    const ok = canPay(recipe.cost) && stationNear(recipe.station);

    return `
      <div class="craftRow">
        <div>
          <strong>${recipe.name}</strong>
          <p>${recipe.desc || ""}</p>
          <small>Koster: ${costText(recipe.cost)} • Stasjon: ${stationName(recipe.station)}</small>
        </div>
        <button ${ok ? "" : "disabled"} data-craft="${recipe.id}">
          ${ok ? "Lag/velg" : "Mangler"}
        </button>
      </div>
    `;
  }

  function showStation(building) {
    panelMode = "station";
    selectedStationBuilding = building;

    const relevant = REFINING.filter((recipe) => recipe.station === building.type);
    const job = building.job ? REFINING.find((recipe) => recipe.id === building.job.id) : null;

    const rows = relevant
      .map((recipe) => {
        const ok = canPay(recipe.cost) && !building.job;

        return `
          <div class="craftRow">
            <div>
              <strong>${recipe.name}</strong>
              <p>Koster: ${costText(recipe.cost)} → Gir: ${costText(recipe.output)}</p>
            </div>
            <button ${ok ? "" : "disabled"} data-refine="${recipe.id}">
              ${building.job ? "Opptatt" : "Start"}
            </button>
          </div>
        `;
      })
      .join("");

    showPanel(
      BUILDINGS[building.type].name,
      tabs("craft") +
        (job
          ? `<p class="panelHint">Pågår: ${job.name} (${Math.round(
              (building.job.t / building.job.total) * 100
            )}%)</p>`
          : "") +
        rows
    );
  }

  function refreshPanel() {
    if (sidePanel.classList.contains("hidden")) return;

    if (panelMode === "inventory") showInventory();
    if (panelMode === "craft") showCrafting(selectedStationBuilding);
    if (panelMode === "build") showBuildMenu();
    if (panelMode === "station" && selectedStationBuilding) {
      showStation(selectedStationBuilding);
    }
  }

  sidePanelContent.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.tab === "inventory") showInventory();
    if (button.dataset.tab === "craft") showCrafting();
    if (button.dataset.tab === "build") showBuildMenu();

    if (button.dataset.craft) craft(button.dataset.craft);

    if (button.dataset.refine) {
      refine(button.dataset.refine, selectedStationBuilding);
    }

    if (button.dataset.use) {
      if (button.dataset.use === "food") useFood();
      else if (button.dataset.use === "water" || button.dataset.use === "dirtyWater") drink();
      else heal();
    }
  });

  function renderHotbar() {
    const list = [...state.weapons];

    hotbar.innerHTML = list
      .map((weaponId, index) => {
        return `
          <button class="slot ${state.player.weapon === weaponId ? "active" : ""}" data-weapon="${weaponId}">
            <b>${index + 1}</b>${WEAPONS[weaponId].name}
          </button>
        `;
      })
      .join("");

    hotbar.querySelectorAll("button").forEach((button, index) => {
      button.addEventListener("click", () => selectWeapon(index));
    });
  }

  function renderObjectives() {
    objectiveBox.innerHTML = `
      <strong>Mål</strong>
      <ul>
        <li>Lag hakke og finn malm</li>
        <li>Bygg arbeidsbenk og smelter</li>
        <li>Rens vann eller bygg regnsamler</li>
        <li>Forsterk basen før natten</li>
      </ul>
    `;
  }

  function updateHud() {
    meters.health.value = state.player.hp;
    meters.stamina.value = state.player.stamina;
    meters.hunger.value = state.player.hunger;
    meters.thirst.value = state.player.thirst;

    const hour = Math.floor(state.time / 60) % 24;
    const minute = Math.floor(state.time % 60);

    dayLabel.textContent = `Dag ${state.day} • ${String(hour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")}`;

    threatPill.textContent = isNight() ? "Natt: høy fare" : "Dagslys";
    threatPill.classList.toggle("danger", isNight());

    const node = nearestNode();
    const building = nearestBuilding(state.player.x, state.player.y, 72);

    if (selectedBuild) {
      const placement = canPlaceBuildingAt(selectedBuild, mouse.wx, mouse.wy);
      showHint(placement.reason);
    } else if (node) {
      showHint(`E: ${nodeDef(node.type).name}`);
    } else if (building) {
      showHint(`E: ${BUILDINGS[building.type].name}`);
    } else {
      interactionHint.classList.add("hidden");
    }
  }

  function showHint(text) {
    interactionHint.textContent = text;
    interactionHint.classList.remove("hidden");
  }

  function gameOver() {
    running = false;
    hud.classList.add("hidden");
    $("gameOverStats").textContent = `Du overlevde til dag ${state.day}.`;
    gameOverScreen.classList.add("screen--active");
  }

  function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.clearRect(0, 0, width, height);

    state.camera.x = clamp(state.player.x - width / 2, 0, Math.max(0, state.worldW - width));
    state.camera.y = clamp(state.player.y - height / 2, 0, Math.max(0, state.worldH - height));

    updateMouseWorld();

    if (state.camera.shake > 0) {
      state.camera.shake = Math.max(0, state.camera.shake - 0.8);
    }

    ctx.save();

    const shakeX = state.camera.shake > 0 ? rand(-state.camera.shake, state.camera.shake) : 0;
    const shakeY = state.camera.shake > 0 ? rand(-state.camera.shake, state.camera.shake) : 0;

    ctx.translate(-state.camera.x + shakeX, -state.camera.y + shakeY);

    drawWorld();
    drawEntities();

    ctx.restore();

    drawNight(width, height);
    drawMinimap(width, height);

    if (paused) {
      drawPause(width, height);
    }
  }

  function drawWorld() {
    ctx.fillStyle = "#17281b";
    ctx.fillRect(state.camera.x, state.camera.y, window.innerWidth, window.innerHeight);

    const grid = 96;
    const startX = Math.floor(state.camera.x / grid) * grid;
    const startY = Math.floor(state.camera.y / grid) * grid;

    for (let y = startY; y < state.camera.y + window.innerHeight + grid; y += grid) {
      for (let x = startX; x < state.camera.x + window.innerWidth + grid; x += grid) {
        const value = Math.abs(Math.sin(x * 0.013 + y * 0.021));

        ctx.fillStyle = value > 0.55 ? "#1c3020" : "#142319";
        ctx.fillRect(x, y, grid, grid);

        if (value > 0.78) {
          ctx.fillStyle = "#29482b";
          ctx.beginPath();
          ctx.arc(x + 30, y + 40, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawEntities() {
    const visible = [
      ...state.nodes
        .filter((node) => !node.depleted)
        .map((node) => ({ ...node, kind: "node", sort: node.y })),
      ...state.drops.map((drop) => ({ ...drop, kind: "drop", sort: drop.y })),
      ...state.buildings.map((building) => ({ ...building, kind: "building", sort: building.y })),
      ...state.zombies.map((zombie) => ({ ...zombie, kind: "zombie", sort: zombie.y })),
      { kind: "player", sort: state.player.y },
    ];

    visible.sort((a, b) => a.sort - b.sort);

    for (const object of visible) {
      if (object.kind === "node") drawNode(object);
      else if (object.kind === "drop") drawDrop(object);
      else if (object.kind === "building") drawBuilding(object);
      else if (object.kind === "zombie") drawZombie(object);
      else if (object.kind === "player") drawPlayer();
    }

    for (const projectile of state.projectiles) drawProjectile(projectile);
    for (const p of state.particles) drawParticle(p);

    if (selectedBuild) drawBuildGhost();
  }

  function drawNode(node) {
    const def = nodeDef(node.type);

    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(node.rotation || 0);

    if (node.type === "tree") {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(-5, 4, 10, 30);

      ctx.fillStyle = def.color;

      for (const size of [28, 22, 16]) {
        ctx.beginPath();
        ctx.moveTo(0, -size - 10);
        ctx.lineTo(-size, size / 2);
        ctx.lineTo(size, size / 2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (node.type === "puddle") {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#9ee8ff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = "rgba(220, 250, 255, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(4, -2, 14, 5, -0.2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (node.type === "bush") {
      ctx.fillStyle = def.color;

      const leaves = [
        [-11, 0, 11],
        [-4, -8, 12],
        [8, -4, 11],
        [10, 8, 10],
        [-5, 9, 11],
      ];

      for (const [x, y, r] of leaves) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#b43a45";

      const berries = [
        [4, -4],
        [11, 3],
        [-7, 6],
      ];

      for (const [x, y] of berries) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(-22, 16);
      ctx.lineTo(-14, -10);
      ctx.lineTo(4, -20);
      ctx.lineTo(23, -4);
      ctx.lineTo(18, 19);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.beginPath();
      ctx.moveTo(-14, -10);
      ctx.lineTo(4, -20);
      ctx.lineTo(-3, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(23, -4);
      ctx.lineTo(18, 19);
      ctx.closePath();
      ctx.fill();

      if (node.type === "oreRock") {
        ctx.fillStyle = "#c87541";

        const oreSpots = [
          [-8, -3, 3],
          [7, -8, 4],
          [12, 6, 3],
          [-1, 10, 3],
        ];

        for (const [x, y, r] of oreSpots) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = "rgba(255, 213, 150, 0.55)";
        ctx.beginPath();
        ctx.arc(7, -8, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawBuilding(building) {
    const def = BUILDINGS[building.type];

    ctx.save();
    ctx.translate(building.x, building.y);

    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(0, building.h * 0.35, building.w * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = def.color;

    if (building.type.includes("Wall")) {
      ctx.fillRect(-building.w / 2, -building.h / 2, building.w, building.h);

      ctx.strokeStyle = "#24160d";
      for (let x = -building.w / 2 + 8; x < building.w / 2; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, -building.h / 2);
        ctx.lineTo(x, building.h / 2);
        ctx.stroke();
      }
    } else if (building.type === "spikes") {
      for (let x = -18; x <= 18; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x - 5, 18);
        ctx.lineTo(x, -20);
        ctx.lineTo(x + 5, 18);
        ctx.fill();
      }
    } else {
      ctx.fillRect(-building.w / 2, -building.h / 2, building.w, building.h);
      ctx.strokeStyle = "#111";
      ctx.strokeRect(-building.w / 2, -building.h / 2, building.w, building.h);
    }

    if (building.job) {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(
        -building.w / 2,
        -building.h / 2 - 8,
        building.w * (building.job.t / building.job.total),
        4
      );
    }

    if (building.type === "rainCollector") {
      ctx.fillStyle = "#bdefff";
      ctx.fillRect(-12, 10, (24 * (building.waterStore || 0)) / 8, 5);
    }

    if (building.hp < building.maxHp) {
      ctx.fillStyle = "#2a1a16";
      ctx.fillRect(-building.w / 2, -building.h / 2 - 14, building.w, 4);
      ctx.fillStyle = "#8fd46e";
      ctx.fillRect(-building.w / 2, -building.h / 2 - 14, building.w * (building.hp / building.maxHp), 4);
    }

    ctx.restore();
  }

  function drawDrop(drop) {
    ctx.fillStyle = "#f4e7b0";
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(itemName(drop.id)[0], drop.x, drop.y + 3);

    if (drop.amount > 1) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px system-ui";
      ctx.fillText(String(drop.amount), drop.x + 10, drop.y + 11);
    }
  }

  function drawZombie(zombie) {
    const def = zombieDef(zombie.type);

    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(zombie.x, zombie.y + 14, zombie.radius * 1.3, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y - 8, zombie.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(
      zombie.x - zombie.radius * 0.75,
      zombie.y,
      zombie.radius * 1.5,
      zombie.radius * 1.7
    );

    if (zombie.hp < zombie.maxHp) {
      ctx.fillStyle = "#351";
      ctx.fillRect(zombie.x - 18, zombie.y - 28, 36, 4);

      ctx.fillStyle = "#d35d5d";
      ctx.fillRect(zombie.x - 18, zombie.y - 28, 36 * (zombie.hp / zombie.maxHp), 4);
    }
  }

  function drawPlayer() {
    const player = state.player;
    const angle = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(angle);

    ctx.fillStyle = player.iframe > 0 ? "#ffe0b0" : "#d5b083";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#496b42";
    ctx.fillRect(-7, -11, 16, 22);

    ctx.strokeStyle = "#f1e0a8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(36, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawProjectile(projectile) {
    ctx.strokeStyle = projectile.enemy ? "#8eff78" : "#ead39a";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(projectile.x, projectile.y);
    ctx.lineTo(projectile.x - projectile.vx * 0.025, projectile.y - projectile.vy * 0.025);
    ctx.stroke();
  }

  function drawParticle(particleObj) {
    ctx.globalAlpha = clamp(particleObj.life * 2, 0, 1);
    ctx.fillStyle = particleObj.color;

    ctx.beginPath();
    ctx.arc(particleObj.x, particleObj.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  function drawBuildGhost() {
    const def = BUILDINGS[selectedBuild];
    if (!def) return;

    const placement = canPlaceBuildingAt(selectedBuild, mouse.wx, mouse.wy);
    const recipe = getBuildRecipe(selectedBuild);

    const hasResources = recipe ? canPay(recipe.cost) : false;
    const hasStation = recipe ? stationNear(recipe.station) : false;

    const valid = placement.ok && hasResources && hasStation;

    ctx.save();

    ctx.globalAlpha = 0.58;
    ctx.fillStyle = valid ? "rgba(108, 184, 106, 0.75)" : "rgba(217, 95, 95, 0.75)";
    ctx.fillRect(mouse.wx - def.w / 2, mouse.wy - def.h / 2, def.w, def.h);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = valid ? "#9fff9c" : "#ff8b8b";
    ctx.lineWidth = 3;
    ctx.setLineDash(valid ? [] : [7, 5]);
    ctx.strokeRect(mouse.wx - def.w / 2, mouse.wy - def.h / 2, def.w, def.h);
    ctx.setLineDash([]);

    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = valid ? "#dfffd9" : "#ffd7d7";

    let text = placement.reason;

    if (!hasResources && recipe) {
      text = `Mangler: ${missingText(recipe.cost)}`;
    } else if (!hasStation && recipe) {
      text = `Må stå ved ${stationName(recipe.station)}`;
    }

    ctx.fillText(text, mouse.wx, mouse.wy - def.h / 2 - 10);

    ctx.restore();
  }

  function drawNight(width, height) {
    if (!isNight()) return;

    ctx.fillStyle = "rgba(2,5,9,.58)";
    ctx.fillRect(0, 0, width, height);

    const lights = [
      { x: state.player.x, y: state.player.y, r: 145 },
      ...state.buildings
        .filter((building) => BUILDINGS[building.type].light)
        .map((building) => ({
          x: building.x,
          y: building.y,
          r: BUILDINGS[building.type].light,
        })),
    ];

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";

    for (const light of lights) {
      const x = light.x - state.camera.x;
      const y = light.y - state.camera.y;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, light.r);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, light.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawMinimap(width, height) {
    const mapW = 160;
    const mapH = 120;
    const x = width - mapW - 14;
    const y = height - mapH - 14;

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x, y, mapW, mapH);

    ctx.strokeStyle = "#789";
    ctx.strokeRect(x, y, mapW, mapH);

    const sx = mapW / state.worldW;
    const sy = mapH / state.worldH;

    ctx.fillStyle = "#fff";
    ctx.fillRect(x + state.player.x * sx - 2, y + state.player.y * sy - 2, 4, 4);

    ctx.fillStyle = "#d35d5d";
    for (const zombie of state.zombies) {
      if (dist(zombie.x, zombie.y, state.player.x, state.player.y) < 600) {
        ctx.fillRect(x + zombie.x * sx - 1, y + zombie.y * sy - 1, 2, 2);
      }
    }

    ctx.fillStyle = "#d5b56c";
    for (const building of state.buildings) {
      ctx.fillRect(x + building.x * sx - 1, y + building.y * sy - 1, 3, 3);
    }
  }

  function drawPause(width, height) {
    ctx.fillStyle = "rgba(0,0,0,.4)";
    ctx.fillRect(0, 0, width, height);
  }

  function boot() {
    ctx.fillStyle = "#10191d";
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  boot();
})();
