(() => {
  "use strict";

  const EM = window.EM;

  EM.createDefaultState = function createDefaultState() {
    return {
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
      inv: {
        wood: 8,
        stone: 5,
        food: 3,
        water: 2,
        cloth: 3,
      },
      weapons: new Set(["knife"]),
      nodes: [],
      buildings: [],
      zombies: [],
      drops: [],
      projectiles: [],
      particles: [],
      messages: [],
    };
  };

  EM.state = EM.createDefaultState();

  EM.serializeState = function serializeState() {
    return {
      ...EM.state,
      weapons: [...EM.state.weapons],
      projectiles: [],
      particles: [],
    };
  };

  EM.restoreState = function restoreState(data) {
    const fresh = EM.createDefaultState();

    EM.state.worldW = data.worldW || fresh.worldW;
    EM.state.worldH = data.worldH || fresh.worldH;
    EM.state.dayLength = data.dayLength || fresh.dayLength;
    EM.state.day = data.day || fresh.day;
    EM.state.time = data.time || fresh.time;
    EM.state.camera = data.camera || fresh.camera;
    EM.state.player = data.player || fresh.player;
    EM.state.inv = data.inv || fresh.inv;
    EM.state.weapons = new Set(Array.isArray(data.weapons) ? data.weapons : ["knife"]);
    EM.state.nodes = data.nodes || [];
    EM.state.buildings = data.buildings || [];
    EM.state.zombies = data.zombies || [];
    EM.state.drops = data.drops || [];
    EM.state.projectiles = [];
    EM.state.particles = [];
    EM.state.messages = data.messages || [];
  };

  EM.saveGame = function saveGame() {
    localStorage.setItem(EM.STORAGE_KEY, JSON.stringify(EM.serializeState()));
    EM.toast?.("Lagret.");
  };

  EM.loadGame = function loadGame() {
    const raw = localStorage.getItem(EM.STORAGE_KEY);

    if (!raw) {
      EM.toast?.("Ingen lagring funnet.");
      return false;
    }

    try {
      const data = JSON.parse(raw);
      EM.restoreState(data);
      EM.selectedBuild = null;
      EM.selectedBuildRecipe = null;
      EM.selectedBuildRotation = 0;
      EM.toast?.("Lagring lastet.");
      return true;
    } catch (error) {
      console.error(error);
      EM.toast?.("Kunne ikke laste lagring.");
      return false;
    }
  };

  EM.clearSave = function clearSave() {
    localStorage.removeItem(EM.STORAGE_KEY);
  };
})();
