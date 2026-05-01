/* Etter Mørket — Top-down zombie survival
   GitHub Pages ready. No build step. Uses canvas, JSON data and a sprite sheet.
*/

const FALLBACK_CONFIG = {
  meta: { title: "Etter Mørket", version: "fallback" },
  world: { seed: 133742, widthTiles: 140, heightTiles: 140, tileSize: 32, startHour: 8, dayLengthSeconds: 420, nightStart: 0.58, nightEnd: 0.94, baseRadiusTiles: 9 },
  resources: {
    wood: { name: "Treverk" }, stone: { name: "Stein" }, scrap: { name: "Skrapmetall" }, cloth: { name: "Tøy" },
    food: { name: "Mat" }, water: { name: "Vann" }, herbs: { name: "Urter" }, ammo: { name: "Ammunisjon" },
    parts: { name: "Deler" }, arrows: { name: "Piler" }, fuel: { name: "Drivstoff" }
  },
  weapons: {
    knife: { name: "Kniv", type: "melee", damage: 18, range: 42, cooldown: 0.42, noise: 45, stamina: 5 },
    axe: { name: "Øks", type: "melee", damage: 34, range: 48, cooldown: 0.7, noise: 70, stamina: 11, gatherBonus: 1.4 },
    bow: { name: "Bue", type: "projectile", damage: 42, range: 480, speed: 520, cooldown: 0.72, noise: 70, ammo: "arrows" },
    pistol: { name: "Pistol", type: "projectile", damage: 46, range: 560, speed: 780, cooldown: 0.34, noise: 380, ammo: "ammo" },
    shotgun: { name: "Hagle", type: "spread", damage: 28, pellets: 5, range: 360, speed: 690, cooldown: 0.95, noise: 520, ammo: "ammo" }
  },
  recipes: [],
  buildables: {},
  enemies: {},
  milestones: [],
  lootTables: {}
};

const TILE = {
  GRASS: 0,
  GRASS_DARK: 1,
  FOREST: 2,
  ROAD: 3,
  WATER: 4,
  ASPHALT: 5,
  FLOOR: 6,
  DIRT: 7
};

const SPRITES = {
  tiles: {
    [TILE.GRASS]: { col: 0, row: 8 },
    [TILE.GRASS_DARK]: { col: 1, row: 8 },
    [TILE.FOREST]: { col: 2, row: 8 },
    [TILE.ROAD]: { col: 3, row: 8 },
    [TILE.WATER]: { col: 4, row: 8 },
    [TILE.ASPHALT]: { col: 5, row: 8 },
    [TILE.FLOOR]: { col: 6, row: 8 },
    [TILE.DIRT]: { col: 7, row: 8 }
  },
  objects: {
    tree: { col: 0, row: 9 },
    rock: { col: 1, row: 9 },
    bush: { col: 2, row: 9 },
    crate: { col: 3, row: 9 },
    barrel: { col: 4, row: 9 },
    car: { col: 5, row: 9 },
    campfire: { col: 6, row: 9 },
    workbench: { col: 7, row: 9 },
    barricade: { col: 8, row: 9 },
    spikes: { col: 9, row: 9 },
    wall: { col: 10, row: 9 },
    rainCollector: { col: 11, row: 9 },
    corpse: { col: 12, row: 9 },
    kitchen: { col: 13, row: 9 },
    med: { col: 14, row: 9 }
  },
  items: {
    wood: { col: 0, row: 10 }, stone: { col: 1, row: 10 }, scrap: { col: 2, row: 10 }, cloth: { col: 3, row: 10 },
    food: { col: 4, row: 10 }, water: { col: 5, row: 10 }, herbs: { col: 6, row: 10 }, ammo: { col: 7, row: 10 },
    parts: { col: 8, row: 10 }, arrows: { col: 9, row: 10 }, fuel: { col: 10, row: 10 }, bandage: { col: 11, row: 10 }, medkit: { col: 12, row: 10 }
  },
  effects: {
    blood: { col: 0, row: 11 }, smoke: { col: 1, row: 11 }, muzzle: { col: 2, row: 11 }, slash: { col: 3, row: 11 }, hit: { col: 4, row: 11 },
    fire: { col: 5, row: 11 }, spark: { col: 6, row: 11 }
  }
};

const STORAGE_KEY = "etter-morket-save-v1";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const now = () => performance.now() / 1000;
const choice = (arr, rng = Math) => arr[Math.floor((rng.next ? rng.next() : rng.random()) * arr.length)];
const formatItemName = (config, id) => (config.resources[id]?.name || id);

function normalize(x, y) {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
}

function rectCircleCollides(rect, cx, cy, cr) {
  const closestX = clamp(cx, rect.x - rect.w / 2, rect.x + rect.w / 2);
  const closestY = clamp(cy, rect.y - rect.h / 2, rect.y + rect.h / 2);
  return Math.hypot(cx - closestX, cy - closestY) < cr;
}

class RNG {
  constructor(seed = 1) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  range(min, max) {
    return min + this.next() * (max - min);
  }
  chance(p) {
    return this.next() < p;
  }
}

class ValueNoise {
  constructor(seed) {
    this.seed = seed;
  }
  hash(ix, iy) {
    let x = ix * 374761393 + iy * 668265263 + this.seed * 1442695041;
    x = (x ^ (x >> 13)) * 1274126177;
    return ((x ^ (x >> 16)) >>> 0) / 4294967295;
  }
  smooth(t) {
    return t * t * (3 - 2 * t);
  }
  sample(x, y, scale = 12) {
    x /= scale;
    y /= scale;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const xf = this.smooth(x - x0), yf = this.smooth(y - y0);
    const a = this.hash(x0, y0);
    const b = this.hash(x0 + 1, y0);
    const c = this.hash(x0, y0 + 1);
    const d = this.hash(x0 + 1, y0 + 1);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  }
}

class Assets {
  constructor() {
    this.images = new Map();
    this.audio = new Map();
    this.enabled = true;
    this.music = null;
  }

  async load() {
    await Promise.all([
      this.loadImage("sprites", "assets/images/spritesheet.png"),
      this.loadImage("cover", "assets/images/title_cover.png"),
      this.loadAudio("shot", "assets/audio/shot.wav"),
      this.loadAudio("melee", "assets/audio/melee.wav"),
      this.loadAudio("pickup", "assets/audio/pickup.wav"),
      this.loadAudio("craft", "assets/audio/craft.wav"),
      this.loadAudio("build", "assets/audio/build.wav"),
      this.loadAudio("damage", "assets/audio/damage.wav"),
      this.loadAudio("zombie", "assets/audio/zombie.wav"),
      this.loadAudio("ambient", "assets/audio/ambient_loop.wav")
    ]);
  }

  loadImage(name, src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { this.images.set(name, img); resolve(); };
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  loadAudio(name, src) {
    return new Promise(resolve => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.oncanplaythrough = () => { this.audio.set(name, audio); resolve(); };
      audio.onerror = () => resolve();
      audio.src = src;
      window.setTimeout(resolve, 900);
    });
  }

  play(name, volume = 0.65, rate = 1) {
    if (!this.enabled) return;
    const template = this.audio.get(name);
    if (!template) return;
    try {
      const a = template.cloneNode();
      a.volume = clamp(volume, 0, 1);
      a.playbackRate = rate;
      a.play().catch(() => {});
    } catch {
      // Audio is optional in browsers that block autoplay.
    }
  }

  startMusic() {
    if (!this.enabled || this.music) return;
    const template = this.audio.get("ambient");
    if (!template) return;
    this.music = template.cloneNode();
    this.music.loop = true;
    this.music.volume = 0.22;
    this.music.play().catch(() => {});
  }
}

class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, right: false, clicked: false };
    this.canvas = canvas;

    window.addEventListener("keydown", e => {
      const code = e.key.toLowerCase();
      if (!this.keys.has(code)) this.pressed.add(code);
      this.keys.add(code);
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(code)) e.preventDefault();
    });

    window.addEventListener("keyup", e => {
      this.keys.delete(e.key.toLowerCase());
    });

    canvas.addEventListener("mousemove", e => this.setMouse(e));
    canvas.addEventListener("mousedown", e => {
      this.setMouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
      if (e.button === 2) this.mouse.right = true;
    });
    window.addEventListener("mouseup", e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener("contextmenu", e => e.preventDefault());
  }

  setMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  isDown(...keys) {
    return keys.some(k => this.keys.has(k));
  }

  wasPressed(...keys) {
    return keys.some(k => this.pressed.has(k));
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}

class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.shake = 0;
  }
  update(target, world, dt) {
    const desiredX = target.x - this.canvas.width / 2;
    const desiredY = target.y - this.canvas.height / 2;
    this.x = lerp(this.x, clamp(desiredX, 0, world.pixelWidth - this.canvas.width), 1 - Math.pow(0.001, dt));
    this.y = lerp(this.y, clamp(desiredY, 0, world.pixelHeight - this.canvas.height), 1 - Math.pow(0.001, dt));
    this.shake = Math.max(0, this.shake - dt * 20);
  }
  apply(ctx) {
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(Math.round(-this.x + sx), Math.round(-this.y + sy));
  }
  screenToWorld(x, y) {
    return { x: x + this.x, y: y + this.y };
  }
}

class SpriteRenderer {
  constructor(assets) {
    this.assets = assets;
    this.cell = 32;
  }
  drawCell(ctx, col, row, x, y, w = 32, h = 32, options = {}) {
    const sheet = this.assets.images.get("sprites");
    if (!sheet) {
      ctx.fillStyle = options.fallback || "#ccc";
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      return;
    }
    ctx.save();
    if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
    if (options.angle) {
      ctx.translate(x, y);
      ctx.rotate(options.angle);
      x = 0;
      y = 0;
      ctx.drawImage(sheet, col * this.cell, row * this.cell, this.cell, this.cell, -w / 2, -h / 2, w, h);
    } else {
      ctx.drawImage(sheet, col * this.cell, row * this.cell, this.cell, this.cell, x - w / 2, y - h / 2, w, h);
    }
    ctx.restore();
  }
  drawSpriteKey(ctx, group, key, x, y, w = 32, h = 32, options = {}) {
    const s = SPRITES[group][key];
    if (!s) return;
    this.drawCell(ctx, s.col, s.row, x, y, w, h, options);
  }
}

class WorldObject {
  constructor(type, x, y, w = 32, h = 32, options = {}) {
    this.id = `${type}_${Math.random().toString(36).slice(2)}`;
    this.type = type;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.hp = options.hp ?? 1;
    this.maxHp = this.hp;
    this.collides = options.collides ?? true;
    this.gather = options.gather || null;
    this.lootTable = options.lootTable || null;
    this.looted = options.looted || false;
    this.blocking = options.blocking ?? this.collides;
    this.building = options.building || false;
    this.name = options.name || type;
    this.produces = options.produces || null;
    this.angle = options.angle || 0;
  }
  get rect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class LootDrop {
  constructor(item, amount, x, y) {
    this.item = item;
    this.amount = amount;
    this.x = x;
    this.y = y;
    this.r = 12;
    this.life = 999;
    this.vx = (Math.random() - 0.5) * 35;
    this.vy = (Math.random() - 0.5) * 35;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.02, dt);
    this.vy *= Math.pow(0.02, dt);
  }
  draw(ctx, renderer) {
    renderer.drawSpriteKey(ctx, "items", this.item, this.x, this.y, 25, 25);
    if (this.amount > 1) {
      ctx.fillStyle = "#fff7d0";
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(this.amount), this.x + 9, this.y + 12);
    }
  }
}

class World {
  constructor(config) {
    this.config = config;
    this.seed = config.world.seed;
    this.rng = new RNG(this.seed);
    this.noise = new ValueNoise(this.seed);
    this.width = config.world.widthTiles;
    this.height = config.world.heightTiles;
    this.tileSize = config.world.tileSize;
    this.pixelWidth = this.width * this.tileSize;
    this.pixelHeight = this.height * this.tileSize;
    this.tiles = new Uint8Array(this.width * this.height);
    this.objects = [];
    this.loot = [];
    this.spawn = { x: this.pixelWidth / 2, y: this.pixelHeight / 2 };
    this.baseCenter = { ...this.spawn };
    this.generate();
  }

  idx(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getTile(tx, ty) {
    if (!this.inBounds(tx, ty)) return TILE.WATER;
    return this.tiles[this.idx(tx, ty)];
  }

  setTile(tx, ty, tile) {
    if (this.inBounds(tx, ty)) this.tiles[this.idx(tx, ty)] = tile;
  }

  tileAtPixel(x, y) {
    return this.getTile(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }

  isTileBlockedAt(x, y) {
    return this.tileAtPixel(x, y) === TILE.WATER;
  }

  isBlockedCircle(x, y, r, ignoreObject = null) {
    if (x < r || y < r || x > this.pixelWidth - r || y > this.pixelHeight - r) return true;
    const checks = [
      [x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]
    ];
    if (checks.some(p => this.isTileBlockedAt(p[0], p[1]))) return true;
    for (const obj of this.objects) {
      if (obj === ignoreObject || !obj.collides) continue;
      if (rectCircleCollides(obj.rect, x, y, r)) return true;
    }
    return false;
  }

  canPlaceBuildable(x, y, w, h) {
    const tx = Math.floor(x / this.tileSize);
    const ty = Math.floor(y / this.tileSize);
    if (!this.inBounds(tx, ty)) return false;
    if ([TILE.WATER, TILE.FOREST].includes(this.getTile(tx, ty))) return false;
    const rect = { x, y, w, h };
    for (const obj of this.objects) {
      if (!obj.collides) continue;
      const overlap = Math.abs(obj.x - x) < (obj.w + w) / 2 && Math.abs(obj.y - y) < (obj.h + h) / 2;
      if (overlap) return false;
    }
    return true;
  }

  generate() {
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    const roadY = centerY + this.rng.int(-4, 4);
    const roadX = centerX + this.rng.int(-5, 5);

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const n1 = this.noise.sample(x, y, 12);
        const n2 = this.noise.sample(x + 99, y - 51, 28);
        const pond = this.noise.sample(x - 13, y + 41, 16);
        let tile = TILE.GRASS;

        const dxRoad = Math.abs(x - roadX - Math.sin(y * 0.09) * 4);
        const dyRoad = Math.abs(y - roadY - Math.sin(x * 0.07) * 4);
        if (dxRoad < 1.6 || dyRoad < 1.6) tile = TILE.ROAD;
        else if (pond > 0.78 && n2 > 0.62) tile = TILE.WATER;
        else if (n1 > 0.64) tile = TILE.FOREST;
        else if (n1 < 0.31) tile = TILE.GRASS_DARK;
        else if (n2 < 0.25) tile = TILE.DIRT;

        const distFromBase = Math.hypot(x - centerX, y - centerY);
        if (distFromBase < this.config.world.baseRadiusTiles) tile = distFromBase < 3 ? TILE.ROAD : TILE.GRASS;
        this.setTile(x, y, tile);
      }
    }

    // Safe-ish spawn clearing.
    for (let y = centerY - 7; y <= centerY + 7; y++) {
      for (let x = centerX - 7; x <= centerX + 7; x++) {
        if (this.inBounds(x, y) && Math.hypot(x - centerX, y - centerY) < 7) this.setTile(x, y, TILE.GRASS);
      }
    }

    this.addNaturalObjects();
    this.addRoadsideRuins(roadX, roadY);
    this.addBaseStart();
  }

  tileCenter(tx, ty) {
    return { x: tx * this.tileSize + this.tileSize / 2, y: ty * this.tileSize + this.tileSize / 2 };
  }

  addNaturalObjects() {
    const cx = Math.floor(this.width / 2), cy = Math.floor(this.height / 2);
    for (let y = 3; y < this.height - 3; y++) {
      for (let x = 3; x < this.width - 3; x++) {
        const tile = this.getTile(x, y);
        const fromBase = Math.hypot(x - cx, y - cy);
        if (fromBase < 10) continue;
        const p = this.tileCenter(x, y);
        if (tile === TILE.FOREST && this.rng.chance(0.20)) {
          this.objects.push(new WorldObject("tree", p.x + this.rng.range(-5, 5), p.y + this.rng.range(-5, 5), 30, 38, {
            hp: 3, gather: { item: "wood", amount: [2, 5], xp: 2 }, name: "Tre"
          }));
        } else if ((tile === TILE.GRASS || tile === TILE.GRASS_DARK || tile === TILE.DIRT) && this.rng.chance(0.018)) {
          this.objects.push(new WorldObject("rock", p.x, p.y, 30, 28, {
            hp: 3, gather: { item: "stone", amount: [1, 4], xp: 2 }, name: "Stein"
          }));
        } else if ((tile === TILE.GRASS || tile === TILE.GRASS_DARK) && this.rng.chance(0.016)) {
          this.objects.push(new WorldObject("bush", p.x, p.y, 30, 28, {
            hp: 2, collides: false, gather: { item: this.rng.chance(0.55) ? "herbs" : "food", amount: [1, 2], xp: 1 }, name: "Busk"
          }));
        }
      }
    }
  }

  addRoadsideRuins(roadX, roadY) {
    const possible = [];
    for (let y = 8; y < this.height - 8; y += 6) {
      for (let x = 8; x < this.width - 8; x += 6) {
        const nearRoad = Math.abs(y - roadY - Math.sin(x * 0.07) * 4) < 6 || Math.abs(x - roadX - Math.sin(y * 0.09) * 4) < 6;
        const fromBase = Math.hypot(x - this.width / 2, y - this.height / 2);
        if (nearRoad && fromBase > 14 && this.rng.chance(0.42)) possible.push([x, y]);
      }
    }
    for (const [tx, ty] of possible.slice(0, 55)) {
      this.placeRuinCluster(tx, ty);
    }
  }

  placeRuinCluster(tx, ty) {
    const w = this.rng.int(3, 6);
    const h = this.rng.int(3, 5);
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.inBounds(x, y)) continue;
        this.setTile(x, y, this.rng.chance(0.7) ? TILE.FLOOR : TILE.ASPHALT);
      }
    }
    const center = this.tileCenter(tx + w / 2, ty + h / 2);
    const table = this.rng.chance(0.2) ? "med" : this.rng.chance(0.35) ? "kitchen" : "crate";
    this.objects.push(new WorldObject(table, center.x, center.y, 34, 34, { hp: 2, lootTable: table, name: table === "med" ? "Medisinskuff" : table === "kitchen" ? "Kjøkkenskap" : "Kasse" }));

    const count = this.rng.int(2, 5);
    for (let i = 0; i < count; i++) {
      const type = choice(["crate", "barrel", "car"], this.rng);
      const p = this.tileCenter(tx + this.rng.int(-1, w + 1), ty + this.rng.int(-1, h + 1));
      const size = type === "car" ? [62, 34] : [32, 32];
      this.objects.push(new WorldObject(type, p.x, p.y, size[0], size[1], {
        hp: type === "car" ? 5 : 2,
        lootTable: type,
        name: type === "car" ? "Bilvrak" : type === "barrel" ? "Tønne" : "Kasse",
        angle: this.rng.range(-0.5, 0.5)
      }));
    }
  }

  addBaseStart() {
    const c = this.baseCenter;
    this.objects.push(new WorldObject("crate", c.x + 82, c.y - 18, 34, 34, { hp: 1, lootTable: "crate", name: "Startkasse" }));
    this.objects.push(new WorldObject("barrel", c.x - 78, c.y + 42, 32, 32, { hp: 1, lootTable: "barrel", name: "Vanntønne" }));
    this.loot.push(new LootDrop("wood", 6, c.x + 38, c.y + 62));
    this.loot.push(new LootDrop("stone", 4, c.x + 12, c.y + 68));
    this.loot.push(new LootDrop("food", 2, c.x - 32, c.y + 54));
    this.loot.push(new LootDrop("water", 2, c.x - 56, c.y + 52));
    this.loot.push(new LootDrop("cloth", 3, c.x - 16, c.y + 82));
  }

  damageObject(obj, amount) {
    obj.hp -= amount;
    return obj.hp <= 0;
  }

  removeObject(obj) {
    const i = this.objects.indexOf(obj);
    if (i >= 0) this.objects.splice(i, 1);
  }

  drop(item, amount, x, y) {
    if (amount <= 0) return;
    this.loot.push(new LootDrop(item, amount, x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 18));
  }

  nearestInteractable(x, y, maxDist = 64) {
    let best = null;
    let bestD = maxDist;
    for (const obj of this.objects) {
      const d = dist(x, y, obj.x, obj.y);
      if (d < bestD && (obj.gather || obj.lootTable || obj.building)) {
        best = obj;
        bestD = d;
      }
    }
    return best;
  }

  nearbyBuildable(type, x, y, maxDist = 110) {
    return this.objects.find(o => o.type === type && dist(x, y, o.x, o.y) < maxDist);
  }

  update(dt) {
    for (const drop of this.loot) drop.update(dt);
  }

  draw(ctx, camera, renderer) {
    const ts = this.tileSize;
    const startX = clamp(Math.floor(camera.x / ts) - 2, 0, this.width - 1);
    const startY = clamp(Math.floor(camera.y / ts) - 2, 0, this.height - 1);
    const endX = clamp(Math.ceil((camera.x + ctx.canvas.width) / ts) + 2, 0, this.width - 1);
    const endY = clamp(Math.ceil((camera.y + ctx.canvas.height) / ts) + 2, 0, this.height - 1);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = this.getTile(x, y);
        const s = SPRITES.tiles[tile] || SPRITES.tiles[TILE.GRASS];
        renderer.drawCell(ctx, s.col, s.row, x * ts + ts / 2, y * ts + ts / 2, ts, ts);
      }
    }

    for (const drop of this.loot) {
      if (drop.x > camera.x - 80 && drop.x < camera.x + ctx.canvas.width + 80 && drop.y > camera.y - 80 && drop.y < camera.y + ctx.canvas.height + 80) {
        drop.draw(ctx, renderer);
      }
    }

    const visible = this.objects.filter(o => o.x > camera.x - 100 && o.x < camera.x + ctx.canvas.width + 100 && o.y > camera.y - 100 && o.y < camera.y + ctx.canvas.height + 100);
    visible.sort((a, b) => a.y - b.y);
    for (const obj of visible) {
      let w = obj.w, h = obj.h;
      if (obj.type === "tree") { w = 52; h = 58; }
      if (obj.type === "bush") { w = 36; h = 34; }
      renderer.drawSpriteKey(ctx, "objects", obj.type, obj.x, obj.y, w, h, { angle: obj.angle });
      if (obj.maxHp > 10 && obj.hp < obj.maxHp) {
        const pct = clamp(obj.hp / obj.maxHp, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(obj.x - 22, obj.y - obj.h / 2 - 12, 44, 5);
        ctx.fillStyle = pct > 0.35 ? "#7cc98a" : "#ef6461";
        ctx.fillRect(obj.x - 22, obj.y - obj.h / 2 - 12, 44 * pct, 5);
      }
    }
  }
}

class Inventory {
  constructor() {
    this.items = new Map();
  }
  add(id, amount = 1) {
    if (!id || amount <= 0) return;
    this.items.set(id, (this.items.get(id) || 0) + amount);
  }
  remove(id, amount = 1) {
    const have = this.count(id);
    if (have < amount) return false;
    const left = have - amount;
    if (left <= 0) this.items.delete(id);
    else this.items.set(id, left);
    return true;
  }
  count(id) {
    return this.items.get(id) || 0;
  }
  has(cost = {}) {
    return Object.entries(cost).every(([id, amount]) => this.count(id) >= amount);
  }
  pay(cost = {}) {
    if (!this.has(cost)) return false;
    for (const [id, amount] of Object.entries(cost)) this.remove(id, amount);
    return true;
  }
  toJSON() {
    return Object.fromEntries(this.items.entries());
  }
  fromJSON(obj = {}) {
    this.items.clear();
    for (const [k, v] of Object.entries(obj)) this.add(k, v);
  }
}

class Player {
  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.r = 14;
    this.vx = 0;
    this.vy = 0;
    this.dir = "down";
    this.anim = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.hunger = 92;
    this.thirst = 86;
    this.bleeding = 0;
    this.speed = 142;
    this.inventory = new Inventory();
    this.weapons = ["knife"];
    this.currentWeapon = "knife";
    this.attackCooldown = 0;
    this.invuln = 0;
    this.dodgeCooldown = 0;
    this.xp = 0;
    this.level = 1;
    this.skills = { survival: 1, engineering: 1, combat: 1 };
    this.milestones = new Set();
    this.config = config;
    this.noise = 0;
    this.facingAngle = 0;
  }

  get alive() {
    return this.health > 0;
  }

  addXP(amount, skill = "survival") {
    this.xp += amount;
    const old = this.skills[skill] || 1;
    const needed = old * 45;
    if (this.xp >= needed && old < 5) {
      this.xp -= needed;
      this.skills[skill] = old + 1;
      return `${this.skillName(skill)} økte til nivå ${old + 1}`;
    }
    return null;
  }

  skillName(skill) {
    return { survival: "Overlevelse", engineering: "Teknikk", combat: "Kamp" }[skill] || skill;
  }

  addItem(id, amount = 1) {
    this.inventory.add(id, amount);
  }

  hasWeapon(id) {
    return this.weapons.includes(id);
  }

  addWeapon(id) {
    if (!this.hasWeapon(id)) {
      this.weapons.push(id);
      this.currentWeapon = id;
      return true;
    }
    return false;
  }

  update(dt, input, world, game) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.noise = 0;

    const up = input.isDown("w", "arrowup");
    const down = input.isDown("s", "arrowdown");
    const left = input.isDown("a", "arrowleft");
    const right = input.isDown("d", "arrowright");
    let dx = (right ? 1 : 0) - (left ? 1 : 0);
    let dy = (down ? 1 : 0) - (up ? 1 : 0);
    const n = normalize(dx, dy);
    dx = n.x; dy = n.y;

    const sprinting = input.isDown("shift") && this.stamina > 2 && (dx || dy);
    let speed = this.speed * (sprinting ? 1.55 : 1);
    if (this.hunger < 12 || this.thirst < 12) speed *= 0.82;

    if (input.wasPressed(" ") && this.dodgeCooldown <= 0 && this.stamina > 18 && (dx || dy)) {
      speed *= 4.2;
      this.stamina -= 18;
      this.dodgeCooldown = 0.85;
      this.invuln = 0.22;
      game.addParticles(this.x, this.y, 10, "#ddd6bd", 60);
    }

    if (dx || dy) {
      const nx = this.x + dx * speed * dt;
      const ny = this.y + dy * speed * dt;
      this.moveWithCollision(nx, ny, world);
      this.anim += dt * (sprinting ? 13 : 8);
      this.noise += sprinting ? 115 : 42;
      if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? "right" : "left";
      else this.dir = dy > 0 ? "down" : "up";
    } else {
      this.anim += dt * 2;
    }

    if (sprinting) this.stamina = Math.max(0, this.stamina - 21 * dt);
    else this.stamina = Math.min(100, this.stamina + 14 * dt);

    this.hunger = Math.max(0, this.hunger - dt * 0.25);
    this.thirst = Math.max(0, this.thirst - dt * 0.38);
    if (this.hunger <= 0 || this.thirst <= 0) {
      this.damage(dt * (this.thirst <= 0 ? 2.8 : 1.7), game);
    }
    if (this.bleeding > 0) {
      this.bleeding -= dt;
      this.damage(dt * 0.9, game, false);
    }

    const aim = normalize(input.mouse.worldX - this.x, input.mouse.worldY - this.y);
    this.facingAngle = Math.atan2(aim.y, aim.x);

    for (let i = 1; i <= 5; i++) {
      if (input.wasPressed(String(i)) && this.weapons[i - 1]) this.currentWeapon = this.weapons[i - 1];
    }
  }

  moveWithCollision(nx, ny, world) {
    if (!world.isBlockedCircle(nx, this.y, this.r)) this.x = nx;
    if (!world.isBlockedCircle(this.x, ny, this.r)) this.y = ny;
  }

  damage(amount, game, flash = true) {
    if (this.invuln > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invuln = 0.28;
    if (flash) game.flashDamage();
    if (amount > 2) game.assets.play("damage", 0.5, 0.85 + Math.random() * 0.25);
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  consume(item, game) {
    if (item === "food" && this.inventory.remove("food", 1)) {
      this.hunger = Math.min(100, this.hunger + 26);
      game.message("Du spiser hermetikk. Det smaker mistenkelig, men virker.");
      return true;
    }
    if (item === "water" && this.inventory.remove("water", 1)) {
      this.thirst = Math.min(100, this.thirst + 32);
      game.message("Du drikker vann og kjenner hodet klarne.");
      return true;
    }
    if (item === "bandage" && this.inventory.remove("bandage", 1)) {
      this.bleeding = 0;
      this.heal(15);
      game.message("Du legger en bandasje. Ikke pent, men det holder.");
      return true;
    }
    if (item === "medkit" && this.inventory.remove("medkit", 1)) {
      this.bleeding = 0;
      this.heal(48);
      game.message("Førstehjelpspakken får deg tilbake på beina.");
      return true;
    }
    return false;
  }

  draw(ctx, renderer) {
    const dirRow = { down: 0, up: 1, left: 2, right: 3 }[this.dir] || 0;
    const frame = Math.floor(this.anim) % 4;
    const alpha = this.invuln > 0 ? 0.65 + Math.sin(now() * 50) * 0.25 : 1;
    renderer.drawCell(ctx, frame, dirRow, this.x, this.y, 38, 42, { alpha });

    // Aim line, subtle.
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#fff3b5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(this.facingAngle) * 42, this.y + Math.sin(this.facingAngle) * 42);
    ctx.stroke();
    ctx.restore();
  }

  serialize() {
    return {
      x: this.x, y: this.y, health: this.health, stamina: this.stamina, hunger: this.hunger, thirst: this.thirst,
      inventory: this.inventory.toJSON(), weapons: this.weapons, currentWeapon: this.currentWeapon, xp: this.xp,
      skills: this.skills, milestones: [...this.milestones]
    };
  }

  restore(data) {
    Object.assign(this, {
      x: data.x ?? this.x, y: data.y ?? this.y, health: data.health ?? this.health, stamina: data.stamina ?? this.stamina,
      hunger: data.hunger ?? this.hunger, thirst: data.thirst ?? this.thirst, weapons: data.weapons || this.weapons,
      currentWeapon: data.currentWeapon || this.currentWeapon, xp: data.xp ?? this.xp, skills: data.skills || this.skills
    });
    this.inventory.fromJSON(data.inventory || {});
    this.milestones = new Set(data.milestones || []);
  }
}

class Zombie {
  constructor(type, x, y, config, day = 1) {
    this.type = type;
    this.def = config.enemies[type] || config.enemies.walker;
    this.x = x;
    this.y = y;
    this.r = type === "brute" ? 20 : 14;
    this.hp = this.def.hp + Math.floor(day * (type === "brute" ? 8 : 3));
    this.maxHp = this.hp;
    this.speed = this.def.speed * (1 + Math.min(0.55, day * 0.025));
    this.attackCooldown = 0;
    this.anim = Math.random() * 10;
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = Math.random() * 2;
    this.targetNoise = null;
    this.spitCooldown = 1 + Math.random() * 3;
  }

  get alive() { return this.hp > 0; }

  update(dt, game) {
    const player = game.player;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.spitCooldown = Math.max(0, this.spitCooldown - dt);
    this.anim += dt * 8;

    const dPlayer = dist(this.x, this.y, player.x, player.y);
    const senseMultiplier = game.isHordeNight ? 1.55 : (game.isNight ? 1.25 : 1);
    const senseRadius = (this.def.sense || 180) * senseMultiplier;
    const heard = game.noiseEvents.find(n => dist(this.x, this.y, n.x, n.y) < n.radius);
    let targetX = heard ? heard.x : player.x;
    let targetY = heard ? heard.y : player.y;
    let chasing = dPlayer < senseRadius || Boolean(heard);

    if (!chasing) {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1.5 + Math.random() * 4;
        this.wanderAngle += (Math.random() - 0.5) * Math.PI;
      }
      targetX = this.x + Math.cos(this.wanderAngle) * 80;
      targetY = this.y + Math.sin(this.wanderAngle) * 80;
    }

    const vec = normalize(targetX - this.x, targetY - this.y);
    let moveSpeed = this.speed * (chasing ? 1 : 0.38);
    let nx = this.x + vec.x * moveSpeed * dt;
    let ny = this.y + vec.y * moveSpeed * dt;

    // If a barricade blocks direct movement, attack it.
    let blockingObj = null;
    for (const obj of game.world.objects) {
      if (!obj.building || !obj.collides) continue;
      if (rectCircleCollides(obj.rect, nx, ny, this.r + 1)) {
        blockingObj = obj;
        break;
      }
    }

    if (blockingObj) {
      if (this.attackCooldown <= 0) {
        blockingObj.hp -= this.def.damage * 1.7;
        this.attackCooldown = this.def.attackCooldown;
        game.addParticles(blockingObj.x, blockingObj.y, 7, "#d6a949", 80);
        if (blockingObj.hp <= 0) {
          game.message(`${blockingObj.name} ble revet ned.`);
          game.world.removeObject(blockingObj);
          game.assets.play("damage", 0.45, 0.55);
        }
      }
    } else {
      if (!game.world.isBlockedCircle(nx, this.y, this.r)) this.x = nx;
      if (!game.world.isBlockedCircle(this.x, ny, this.r)) this.y = ny;
    }

    if (this.type === "spitter" && dPlayer < 260 && this.spitCooldown <= 0) {
      this.spitCooldown = 2.7 + Math.random();
      const aim = normalize(player.x - this.x, player.y - this.y);
      game.projectiles.push(new Projectile(this.x, this.y, aim.x, aim.y, 320, 8, 240, "acid", true));
      game.assets.play("zombie", 0.35, 1.25);
    }

    if (dPlayer < this.r + player.r + 8 && this.attackCooldown <= 0) {
      player.damage(this.def.damage, game);
      if (Math.random() < 0.08) player.bleeding = Math.max(player.bleeding, 18);
      this.attackCooldown = this.def.attackCooldown;
    }

    for (const obj of game.world.objects) {
      if (obj.type === "spikes" && obj.hp > 0 && rectCircleCollides(obj.rect, this.x, this.y, this.r)) {
        this.takeDamage(16 * dt, game);
        obj.hp -= 10 * dt;
        if (obj.hp <= 0) game.world.removeObject(obj);
      }
    }
  }

  takeDamage(amount, game) {
    this.hp -= amount;
    game.addParticles(this.x, this.y, 6, "#631e1e", 80);
    if (this.hp <= 0) {
      game.onZombieKilled(this);
    }
  }

  draw(ctx, renderer) {
    const row = this.def.spriteRow ?? 4;
    const frame = Math.floor(this.anim) % 4;
    const size = this.type === "brute" ? 52 : 38;
    renderer.drawCell(ctx, frame, row, this.x, this.y, size, size);
    if (this.hp < this.maxHp) {
      const pct = clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.fillRect(this.x - 18, this.y - size / 2 - 8, 36, 4);
      ctx.fillStyle = pct > 0.45 ? "#d6a949" : "#ef6461";
      ctx.fillRect(this.x - 18, this.y - size / 2 - 8, 36 * pct, 4);
    }
  }
}

class Projectile {
  constructor(x, y, dx, dy, speed, damage, range, kind = "bullet", hostile = false) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.dx = dx;
    this.dy = dy;
    this.speed = speed;
    this.damage = damage;
    this.range = range;
    this.kind = kind;
    this.hostile = hostile;
    this.dead = false;
    this.r = hostile ? 7 : 4;
  }
  update(dt, game) {
    this.x += this.dx * this.speed * dt;
    this.y += this.dy * this.speed * dt;
    if (dist(this.x, this.y, this.startX, this.startY) > this.range || game.world.isTileBlockedAt(this.x, this.y)) {
      this.dead = true;
      return;
    }

    if (this.hostile) {
      if (dist(this.x, this.y, game.player.x, game.player.y) < game.player.r + this.r) {
        game.player.damage(this.damage, game);
        game.addParticles(this.x, this.y, 14, "#8bd35f", 95);
        this.dead = true;
      }
      return;
    }

    for (const obj of game.world.objects) {
      if (obj.collides && rectCircleCollides(obj.rect, this.x, this.y, this.r)) {
        if (!obj.building) obj.hp -= this.damage * 0.05;
        game.addParticles(this.x, this.y, 6, "#d6a949", 90);
        this.dead = true;
        return;
      }
    }

    for (const z of game.zombies) {
      if (!z.alive) continue;
      if (dist(this.x, this.y, z.x, z.y) < z.r + this.r) {
        z.takeDamage(this.damage, game);
        game.addFloatingText(`-${Math.round(this.damage)}`, z.x, z.y - 20, "#ffd0d0");
        this.dead = true;
        return;
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.dy, this.dx));
    ctx.fillStyle = this.hostile ? "#9ee66c" : (this.kind === "arrow" ? "#d8c28a" : "#fff3b5");
    ctx.beginPath();
    if (this.kind === "arrow") {
      ctx.rect(-9, -1.5, 18, 3);
    } else {
      ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color, speed = 80) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.life = 0.25 + Math.random() * 0.45;
    this.maxLife = this.life;
    this.color = color;
    this.size = 2 + Math.random() * 4;
  }
  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= Math.pow(0.02, dt);
    this.vy *= Math.pow(0.02, dt);
  }
  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

class FloatingText {
  constructor(text, x, y, color = "#fff5d3") {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 1;
  }
  update(dt) {
    this.life -= dt;
    this.y -= 28 * dt;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = clamp(this.life, 0, 1);
    ctx.fillStyle = this.color;
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(0,0,0,.65)";
    ctx.lineWidth = 3;
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.input = new Input(this.canvas);
    this.assets = new Assets();
    this.renderer = new SpriteRenderer(this.assets);
    this.camera = new Camera(this.canvas);

    this.config = FALLBACK_CONFIG;
    this.world = null;
    this.player = null;
    this.zombies = [];
    this.projectiles = [];
    this.particles = [];
    this.floaters = [];
    this.noiseEvents = [];
    this.state = "title";
    this.sideMode = null;
    this.buildSelection = null;
    this.gameTime = 0;
    this.day = 1;
    this.lastFrame = now();
    this.spawnTimer = 0;
    this.autosaveTimer = 0;
    this.storyFlags = new Set();
    this.hordeAnnouncedForDay = new Set();
    this.rng = new RNG(33);
    this.panelDirty = false;

    this.bindUI();
  }

  async init() {
    await this.loadConfig();
    await this.assets.load();
    this.showTitle();
    this.loop();
  }

  async loadConfig() {
    try {
      const response = await fetch("data/levels.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load config");
      this.config = await response.json();
    } catch (err) {
      console.warn("Using fallback config", err);
      this.config = FALLBACK_CONFIG;
    }
  }

  bindUI() {
    const $ = id => document.getElementById(id);
    $("startBtn").addEventListener("click", () => this.startNewGame());
    $("continueBtn").addEventListener("click", () => this.continueGame());
    $("howToBtn").addEventListener("click", () => this.openScreen("helpScreen"));
    $("closeHelpBtn").addEventListener("click", () => this.openScreen("titleScreen"));
    $("resumeBtn").addEventListener("click", () => this.resume());
    $("saveBtn").addEventListener("click", () => { this.save(); this.toast("Lagret."); });
    $("newGameBtn").addEventListener("click", () => this.startNewGame());
    $("restartBtn").addEventListener("click", () => this.startNewGame());
    $("backToTitleBtn").addEventListener("click", () => this.showTitle());
    $("closePanelBtn").addEventListener("click", () => this.closeSidePanel());
  }

  resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  openScreen(id) {
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("screen--active"));
    document.getElementById(id).classList.add("screen--active");
  }

  hideScreens() {
    document.querySelectorAll(".screen").forEach(el => el.classList.remove("screen--active"));
  }

  showTitle() {
    this.state = "title";
    this.openScreen("titleScreen");
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("sidePanel").classList.add("hidden");
    document.getElementById("continueBtn").disabled = !localStorage.getItem(STORAGE_KEY);
  }

  startNewGame() {
    localStorage.removeItem(STORAGE_KEY);
    this.setupWorld();
    this.assets.startMusic();
    this.hideScreens();
    document.getElementById("hud").classList.remove("hidden");
    this.state = "playing";
    this.toast("Finn ressurser før mørket faller.");
    this.message("Du våkner ved veikrysset. Noe beveger seg mellom trærne.");
  }

  continueGame() {
    this.setupWorld();
    const ok = this.load();
    this.assets.startMusic();
    this.hideScreens();
    document.getElementById("hud").classList.remove("hidden");
    this.state = "playing";
    this.toast(ok ? "Lagring lastet." : "Fant ingen lagring.");
  }

  setupWorld() {
    this.world = new World(this.config);
    this.player = new Player(this.world.spawn.x, this.world.spawn.y, this.config);
    this.zombies = [];
    this.projectiles = [];
    this.particles = [];
    this.floaters = [];
    this.noiseEvents = [];
    this.gameTime = (this.config.world.startHour / 24) * this.config.world.dayLengthSeconds;
    this.day = 1;
    this.spawnTimer = 1.2;
    this.autosaveTimer = 0;
    this.storyFlags = new Set();
    this.hordeAnnouncedForDay = new Set();
    this.buildSelection = null;
    this.sideMode = null;
    this.closeSidePanel();
    this.player.inventory.add("wood", 2);
    this.player.inventory.add("stone", 1);
    this.player.inventory.add("food", 1);
    this.updateHUD();
  }

  loop() {
    const t = now();
    const dt = Math.min(0.05, t - this.lastFrame);
    this.lastFrame = t;

    if (this.state === "playing") this.update(dt);
    this.draw();
    this.input.endFrame();
    requestAnimationFrame(() => this.loop());
  }

  get dayFraction() {
    return (this.gameTime % this.config.world.dayLengthSeconds) / this.config.world.dayLengthSeconds;
  }

  get isNight() {
    const f = this.dayFraction;
    return f >= this.config.world.nightStart && f <= this.config.world.nightEnd;
  }

  get isHordeNight() {
    return this.day >= 3 && this.day % 3 === 0 && this.isNight;
  }

  update(dt) {
    const mouseWorld = this.camera.screenToWorld(this.input.mouse.x, this.input.mouse.y);
    this.input.mouse.worldX = mouseWorld.x;
    this.input.mouse.worldY = mouseWorld.y;

    this.handleGlobalInput();

    this.gameTime += dt;
    const newDay = Math.floor(this.gameTime / this.config.world.dayLengthSeconds) + 1;
    if (newDay !== this.day) this.onNewDay(newDay);

    this.player.update(dt, this.input, this.world, this);
    this.camera.update(this.player, this.world, dt);
    this.world.update(dt);

    if (this.player.noise > 0) this.addNoise(this.player.x, this.player.y, this.player.noise * dt);

    this.handleAttack();
    this.handleInteract();
    this.handleLootPickup(dt);
    this.handleBuildingPlacement();

    for (const z of this.zombies) z.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);
    for (const p of this.particles) p.update(dt);
    for (const f of this.floaters) f.update(dt);

    this.zombies = this.zombies.filter(z => z.alive);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.particles = this.particles.filter(p => p.life > 0);
    this.floaters = this.floaters.filter(f => f.life > 0);
    this.noiseEvents = this.noiseEvents.map(n => ({ ...n, ttl: n.ttl - dt })).filter(n => n.ttl > 0);

    this.spawnZombies(dt);
    this.updateStory();
    this.updateHUD();

    this.autosaveTimer += dt;
    if (this.autosaveTimer > 28) {
      this.autosaveTimer = 0;
      this.save();
    }

    if (!this.player.alive) this.gameOver();
  }

  handleGlobalInput() {
    if (this.input.wasPressed("escape")) {
      if (this.buildSelection) {
        this.buildSelection = null;
        this.toast("Bygging avbrutt.");
      } else if (this.sideMode) this.closeSidePanel();
      else this.pause();
    }
    if (this.input.wasPressed("c")) this.toggleSidePanel("craft");
    if (this.input.wasPressed("b")) this.toggleSidePanel("build");
    if (this.input.wasPressed("i")) this.toggleSidePanel("inventory");

    if (this.input.wasPressed("f")) {
      if (!this.player.consume("food", this)) this.toast("Ingen mat i inventory.");
      else this.markPanelDirty();
    }
    if (this.input.wasPressed("v")) {
      if (!this.player.consume("water", this)) this.toast("Ikke noe vann i inventory.");
      else this.markPanelDirty();
    }
    if (this.input.wasPressed("h")) {
      if (!this.player.consume("bandage", this) && !this.player.consume("medkit", this)) this.toast("Ingen bandasje eller førstehjelpspakke.");
      else this.markPanelDirty();
    }
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.save();
    this.openScreen("pauseScreen");
  }

  resume() {
    this.hideScreens();
    this.state = "playing";
  }

  toggleSidePanel(mode) {
    if (this.sideMode === mode) {
      this.closeSidePanel();
      return;
    }
    this.sideMode = mode;
    const panel = document.getElementById("sidePanel");
    panel.classList.remove("hidden");
    this.renderSidePanel();
  }

  closeSidePanel() {
    this.sideMode = null;
    this.panelDirty = false;
    document.getElementById("sidePanel").classList.add("hidden");
  }

  markPanelDirty() {
    this.panelDirty = true;
  }

  refreshSidePanelIfNeeded() {
    if (this.sideMode && this.panelDirty) {
      this.renderSidePanel();
    }
  }

  renderSidePanel() {
    if (!this.sideMode) return;
    this.panelDirty = false;
    const title = document.getElementById("sidePanelTitle");
    const content = document.getElementById("sidePanelContent");
    if (this.sideMode === "craft") {
      title.textContent = "Crafting";
      content.innerHTML = this.renderCraftingHTML();
      content.querySelectorAll("[data-craft]").forEach(btn => {
        btn.addEventListener("click", () => this.craft(btn.dataset.craft));
      });
    } else if (this.sideMode === "build") {
      title.textContent = "Bygging";
      content.innerHTML = this.renderBuildHTML();
      content.querySelectorAll("[data-build]").forEach(btn => {
        btn.addEventListener("click", () => {
          this.buildSelection = btn.dataset.build;
          this.toast(`${this.config.buildables[this.buildSelection].name}: klikk i verden for å plassere.`);
          this.closeSidePanel();
        });
      });
    } else if (this.sideMode === "inventory") {
      title.textContent = "Inventory og status";
      content.innerHTML = this.renderInventoryHTML();
      content.querySelectorAll("[data-use]").forEach(btn => {
        btn.addEventListener("click", () => {
          const used = this.player.consume(btn.dataset.use, this);
          if (!used) this.toast("Kan ikke bruke denne nå.");
          this.renderSidePanel();
        });
      });
    }
  }

  renderCraftingHTML() {
    const recipes = this.config.recipes || [];
    const grouped = recipes.reduce((acc, r) => {
      acc[r.category] ||= [];
      acc[r.category].push(r);
      return acc;
    }, {});
    return Object.entries(grouped).map(([category, list]) => `
      <section class="panelSection">
        <h3>${this.categoryName(category)}</h3>
        ${list.map(r => this.recipeHTML(r)).join("")}
      </section>
    `).join("");
  }

  recipeHTML(r) {
    const can = this.canCraft(r).ok;
    const reason = this.canCraft(r).reason;
    const costs = Object.entries(r.cost || {}).map(([id, n]) => `${formatItemName(this.config, id)} ${this.player.inventory.count(id)}/${n}`).join(" • ");
    const req = r.requires ? `<div class="unlockLine">Krever: ${r.requires === "workbench" ? "arbeidsbenk i nærheten" : r.requires}</div>` : "";
    const skill = r.skill ? `<div class="unlockLine">${this.player.skillName(r.skill)} nivå ${this.player.skills[r.skill] || 1}/${r.level || 1}</div>` : "";
    return `
      <article class="recipe">
        <div class="recipeTop">
          <span class="recipeName">${r.name}</span>
          <button data-craft="${r.id}" ${can ? "" : "disabled"}>${can ? "Lag" : reason}</button>
        </div>
        <div class="recipeDesc">${r.description || ""}</div>
        <div class="costLine">${costs}</div>
        ${skill}${req}
      </article>
    `;
  }

  renderBuildHTML() {
    return `
      <section class="panelSection">
        <h3>Velg bygg</h3>
        <p class="recipeDesc">Bygging er fysisk i verden. Velg en konstruksjon, gå dit du vil ha den, og venstreklikk.</p>
        ${Object.entries(this.config.buildables || {}).map(([id, b]) => {
          const can = this.player.inventory.has(b.cost);
          const cost = Object.entries(b.cost).map(([item, n]) => `${formatItemName(this.config, item)} ${this.player.inventory.count(item)}/${n}`).join(" • ");
          return `<article class="recipe">
            <div class="recipeTop">
              <span class="recipeName">${b.name}</span>
              <button data-build="${id}" ${can ? "" : "disabled"}>${can ? "Velg" : "Mangler"}</button>
            </div>
            <div class="recipeDesc">${b.description}</div>
            <div class="costLine">${cost}</div>
          </article>`;
        }).join("")}
      </section>
    `;
  }

  renderInventoryHTML() {
    const items = [...this.player.inventory.items.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const usable = ["food", "water", "bandage", "medkit"];
    return `
      <section class="panelSection">
        <h3>Status</h3>
        ${Object.entries(this.player.skills).map(([k, v]) => `<div class="statusRow"><span>${this.player.skillName(k)}</span><strong>Nivå ${v}</strong></div>`).join("")}
        <div class="statusRow"><span>XP-pott</span><strong>${Math.floor(this.player.xp)}</strong></div>
      </section>
      <section class="panelSection">
        <h3>Ressurser</h3>
        <p class="recipeDesc">Hurtigbruk: F = mat, V = vann, H = bandasje/førstehjelp.</p>
        ${items.length ? items.map(([id, amount]) => `
          <div class="inventoryRow">
            <span>${formatItemName(this.config, id)}</span>
            <strong>${amount}</strong>
            ${usable.includes(id) ? `<button data-use="${id}" class="secondary">Bruk</button>` : ""}
          </div>
        `).join("") : `<p class="recipeDesc">Tom sekk. Det bør du gjøre noe med.</p>`}
      </section>
      <section class="panelSection">
        <h3>Våpen</h3>
        ${this.player.weapons.map((id, idx) => `<div class="inventoryRow"><span>${idx + 1}. ${this.config.weapons[id]?.name || id}</span><strong>${id === this.player.currentWeapon ? "Valgt" : ""}</strong></div>`).join("")}
      </section>
    `;
  }

  categoryName(id) {
    return { weapon: "Våpen", ammo: "Ammunisjon", medical: "Medisin", story: "Historie" }[id] || id;
  }

  canCraft(recipe) {
    if (recipe.skill && (this.player.skills[recipe.skill] || 1) < (recipe.level || 1)) return { ok: false, reason: "Låst" };
    if (recipe.requires === "workbench" && !this.world.nearbyBuildable("workbench", this.player.x, this.player.y, 120)) return { ok: false, reason: "Benk" };
    if (!this.player.inventory.has(recipe.cost || {})) return { ok: false, reason: "Mangler" };
    if (recipe.result?.weapon && this.player.hasWeapon(recipe.result.weapon)) return { ok: false, reason: "Har" };
    return { ok: true, reason: "" };
  }

  craft(id) {
    const recipe = this.config.recipes.find(r => r.id === id);
    if (!recipe) return;
    const can = this.canCraft(recipe);
    if (!can.ok) {
      this.toast(`Kan ikke lage: ${can.reason}`);
      return;
    }
    this.player.inventory.pay(recipe.cost || {});
    if (recipe.result.weapon) {
      this.player.addWeapon(recipe.result.weapon);
      this.message(`Du laget ${this.config.weapons[recipe.result.weapon].name}. Tyngden i hånden gjør deg litt roligere.`);
      this.player.milestones.add("firstWeapon");
    }
    if (recipe.result.item) {
      this.player.addItem(recipe.result.item, recipe.result.amount || 1);
      this.message(`Du laget ${recipe.result.amount || 1} × ${formatItemName(this.config, recipe.result.item)}.`);
    }
    if (recipe.result.story === "radio") {
      this.storyFlags.add("radio");
      this.player.milestones.add("radio");
      this.message("Nødradioen knitrer til live: «...hold ut... signalet er svakt... nordover...»");
    }
    const skillUp = this.player.addXP(8, recipe.skill || "survival");
    if (skillUp) this.toast(skillUp);
    this.assets.play("craft", 0.6);
    this.renderSidePanel();
  }

  handleAttack() {
    if (!this.input.mouse.down || this.sideMode) return;
    if (this.buildSelection) return;
    const w = this.config.weapons[this.player.currentWeapon];
    if (!w || this.player.attackCooldown > 0) return;

    if (w.stamina && this.player.stamina < w.stamina) {
      this.toast("For lite stamina.");
      return;
    }
    if (w.stamina) this.player.stamina -= w.stamina;

    const aim = normalize(this.input.mouse.worldX - this.player.x, this.input.mouse.worldY - this.player.y);
    this.player.attackCooldown = w.cooldown;
    this.addNoise(this.player.x, this.player.y, w.noise || 50);

    if (w.type === "melee") {
      this.assets.play("melee", 0.5, 0.9 + Math.random() * 0.3);
      const hitX = this.player.x + aim.x * w.range;
      const hitY = this.player.y + aim.y * w.range;
      let hit = false;
      for (const z of this.zombies) {
        if (dist(hitX, hitY, z.x, z.y) < z.r + 28) {
          z.takeDamage(w.damage, this);
          this.addFloatingText(`-${w.damage}`, z.x, z.y - 18, "#ffd0d0");
          hit = true;
        }
      }
      const obj = this.world.nearestInteractable(hitX, hitY, 42);
      if (obj && obj.gather) {
        this.gatherObject(obj, w.gatherBonus || 1);
        hit = true;
      }
      this.addParticles(hitX, hitY, hit ? 14 : 5, hit ? "#631e1e" : "#d6a949", 110);
    } else if (w.type === "projectile") {
      if (!this.player.inventory.remove(w.ammo, 1)) {
        this.toast(`Tom for ${formatItemName(this.config, w.ammo).toLowerCase()}.`);
        return;
      }
      this.assets.play(w.ammo === "ammo" ? "shot" : "melee", w.ammo === "ammo" ? 0.55 : 0.35);
      this.projectiles.push(new Projectile(this.player.x + aim.x * 20, this.player.y + aim.y * 20, aim.x, aim.y, w.speed, w.damage, w.range, w.ammo === "arrows" ? "arrow" : "bullet"));
      this.camera.shake = w.ammo === "ammo" ? 4 : 1;
    } else if (w.type === "spread") {
      if (!this.player.inventory.remove(w.ammo, 1)) {
        this.toast(`Tom for ${formatItemName(this.config, w.ammo).toLowerCase()}.`);
        return;
      }
      this.assets.play("shot", 0.7, 0.7);
      for (let i = 0; i < w.pellets; i++) {
        const angle = Math.atan2(aim.y, aim.x) + (Math.random() - 0.5) * 0.36;
        this.projectiles.push(new Projectile(this.player.x + Math.cos(angle) * 20, this.player.y + Math.sin(angle) * 20, Math.cos(angle), Math.sin(angle), w.speed, w.damage, w.range, "bullet"));
      }
      this.camera.shake = 8;
    }
  }

  handleInteract() {
    const obj = this.world.nearestInteractable(this.player.x, this.player.y, 68);
    const hint = document.getElementById("interactionHint");
    if (obj) {
      hint.classList.remove("hidden");
      hint.textContent = `E: ${obj.gather ? "samle fra" : obj.lootTable ? "loot" : "undersøk"} ${obj.name}`;
    } else {
      hint.classList.add("hidden");
    }

    if (!this.input.wasPressed("e") || !obj) return;
    if (obj.gather) this.gatherObject(obj, 1);
    else if (obj.lootTable) this.lootObject(obj);
    else if (obj.building) this.message(`${obj.name} holder fortsatt. HP: ${Math.ceil(obj.hp)}/${obj.maxHp}`);
  }

  gatherObject(obj, bonus = 1) {
    if (!obj.gather) return;
    obj.hp -= bonus;
    this.assets.play("pickup", 0.35, 0.7 + Math.random() * 0.25);
    this.addParticles(obj.x, obj.y, 10, obj.type === "tree" ? "#587c44" : "#a9a084", 70);
    if (obj.hp <= 0) {
      const [min, max] = obj.gather.amount;
      const amount = Math.max(1, Math.round(this.rng.int(min, max) * bonus));
      this.world.drop(obj.gather.item, amount, obj.x, obj.y);
      const skillUp = this.player.addXP(obj.gather.xp || 1, "survival");
      if (skillUp) this.toast(skillUp);
      this.player.milestones.add("firstResource");
      this.world.removeObject(obj);
      this.message(`Du samlet ${amount} × ${formatItemName(this.config, obj.gather.item)}.`);
    }
  }

  lootObject(obj) {
    if (obj.looted) {
      this.message(`${obj.name} er tom.`);
      return;
    }
    obj.looted = true;
    const table = this.config.lootTables[obj.lootTable] || this.config.lootTables.crate || {};
    const gained = [];
    for (const [item, range] of Object.entries(table)) {
      const amount = this.rng.int(range[0], range[1]);
      if (amount > 0) {
        this.player.addItem(item, amount);
        gained.push(`${amount} ${formatItemName(this.config, item)}`);
      }
    }
    const skillUp = this.player.addXP(4, "survival");
    if (skillUp) this.toast(skillUp);
    this.assets.play("pickup", 0.5);
    this.message(gained.length ? `Du fant ${gained.join(", ")}.` : `${obj.name} var nesten tom.`);
    this.markPanelDirty();
  }

  handleLootPickup(dt) {
    for (const drop of [...this.world.loot]) {
      const d = dist(drop.x, drop.y, this.player.x, this.player.y);
      if (d < 34) {
        this.player.addItem(drop.item, drop.amount);
        this.world.loot.splice(this.world.loot.indexOf(drop), 1);
        this.addFloatingText(`+${drop.amount} ${formatItemName(this.config, drop.item)}`, this.player.x, this.player.y - 28, "#fff5d3");
        this.assets.play("pickup", 0.25, 1.1 + Math.random() * 0.4);
        this.player.milestones.add("firstResource");
        this.markPanelDirty();
      } else if (d < 120) {
        const n = normalize(this.player.x - drop.x, this.player.y - drop.y);
        drop.x += n.x * 70 * dt;
        drop.y += n.y * 70 * dt;
      }
    }
  }

  handleBuildingPlacement() {
    if (!this.buildSelection) return;
    const def = this.config.buildables[this.buildSelection];
    if (!def) {
      this.buildSelection = null;
      return;
    }
    if (this.input.wasPressed("escape")) {
      this.buildSelection = null;
      return;
    }
    if (!this.input.mouse.clicked || this.sideMode) return;

    const grid = 16;
    const x = Math.round(this.input.mouse.worldX / grid) * grid;
    const y = Math.round(this.input.mouse.worldY / grid) * grid;
    if (dist(x, y, this.player.x, this.player.y) > 180) {
      this.toast("For langt unna.");
      return;
    }
    if (!this.world.canPlaceBuildable(x, y, def.w, def.h)) {
      this.toast("Kan ikke bygges her.");
      return;
    }
    if (!this.player.inventory.pay(def.cost)) {
      this.toast("Mangler ressurser.");
      this.buildSelection = null;
      return;
    }
    this.world.objects.push(new WorldObject(this.buildSelection, x, y, def.w, def.h, {
      hp: def.hp,
      name: def.name,
      building: true,
      collides: this.buildSelection !== "spikes",
      produces: this.buildSelection === "rainCollector" ? { item: "water", perDay: 1 } : null
    }));
    this.assets.play("build", 0.65);
    this.message(`Du bygget ${def.name}.`);
    this.markPanelDirty();
    if (this.buildSelection === "campfire" || this.buildSelection === "workbench") this.player.milestones.add("firstBase");
    this.player.addXP(7, "engineering");
    this.buildSelection = null;
  }

  spawnZombies(dt) {
    this.spawnTimer -= dt;
    const baseRate = this.isNight ? 2.8 : 5.8;
    const hordeBonus = this.isHordeNight ? 0.55 : 1;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = Math.max(0.45, baseRate * hordeBonus - Math.min(2.2, this.day * 0.11));

    const maxZ = this.isNight ? 22 + this.day * 2 : 10 + this.day;
    if (this.zombies.length >= maxZ) return;

    const count = this.isHordeNight ? this.rng.int(2, 4) : 1;
    for (let i = 0; i < count; i++) {
      this.spawnOneZombie();
    }
  }

  spawnOneZombie() {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = this.rng.range(Math.max(this.canvas.width, this.canvas.height) * 0.55, Math.max(this.canvas.width, this.canvas.height) * 0.85);
    let x = clamp(this.player.x + Math.cos(angle) * radius, 80, this.world.pixelWidth - 80);
    let y = clamp(this.player.y + Math.sin(angle) * radius, 80, this.world.pixelHeight - 80);

    let attempts = 0;
    while (this.world.isBlockedCircle(x, y, 18) && attempts++ < 30) {
      x = this.rng.range(80, this.world.pixelWidth - 80);
      y = this.rng.range(80, this.world.pixelHeight - 80);
    }

    let pool = ["walker", "walker", "walker"];
    if (this.day >= 2 || this.isNight) pool.push("runner");
    if (this.day >= 4) pool.push("spitter");
    if (this.day >= 5 || this.isHordeNight) pool.push("brute");
    this.zombies.push(new Zombie(choice(pool, this.rng), x, y, this.config, this.day));
  }

  onZombieKilled(z) {
    this.player.addXP(z.def.xp, "combat");
    this.addFloatingText(`+${z.def.xp} XP`, z.x, z.y - 34, "#fff5d3");
    this.assets.play("zombie", 0.28, 0.6 + Math.random() * 0.2);
    for (const [item, range] of Object.entries(z.def.loot || {})) {
      const amount = this.rng.int(range[0], range[1]);
      if (amount > 0) this.world.drop(item, amount, z.x, z.y);
    }
    if (Math.random() < 0.05) this.world.drop("parts", 1, z.x, z.y);
  }

  onNewDay(day) {
    this.day = day;
    this.message(`Dag ${day}. Lyset kommer tilbake, men byen virker mer våken.`);
    this.player.hunger = Math.max(0, this.player.hunger - 4);
    this.player.thirst = Math.max(0, this.player.thirst - 5);
    for (const obj of this.world.objects) {
      if (obj.produces?.item) {
        this.world.drop(obj.produces.item, obj.produces.perDay || 1, obj.x, obj.y);
      }
    }
    if (day >= 7) this.player.milestones.add("day7");
    this.save();
  }

  updateStory() {
    if (this.isNight && !this.player.milestones.has("firstNightStarted")) {
      this.player.milestones.add("firstNightStarted");
      this.message("Mørket legger seg. Lyder bærer lenger nå. Ikke løp uten grunn.");
      this.toast("Natt: flere zombier, kortere sikt.");
    }
    if (!this.isNight && this.player.milestones.has("firstNightStarted") && !this.player.milestones.has("firstNight")) {
      this.player.milestones.add("firstNight");
      this.message("Du overlevde første natt. Det føles ikke som seier, men som utsettelse.");
    }
    if (this.isHordeNight && !this.hordeAnnouncedForDay.has(this.day)) {
      this.hordeAnnouncedForDay.add(this.day);
      this.message(`Hordenatt. Noe langt borte svarer på hvert eneste skudd.`);
      this.toast("HORDE!");
      this.addNoise(this.player.x, this.player.y, 900);
    }
  }

  currentObjective() {
    const p = this.player;
    if (!p.milestones.has("firstResource")) return "Samle tre, stein, mat eller vann. Se etter startkassen ved veikrysset.";
    if (!p.hasWeapon("axe") && !p.hasWeapon("bow")) return "Lag øks eller bue i crafting-menyen.";
    if (!this.world.nearbyBuildable("campfire", p.x, p.y, 999999)) return "Bygg et bål før natten blir for tett.";
    if (!this.world.nearbyBuildable("workbench", p.x, p.y, 999999)) return "Bygg en arbeidsbenk for avanserte våpen.";
    if (!this.storyFlags.has("radio")) return "Utforsk ruiner, finn deler og drivstoff, og reparer nødradioen.";
    if (!p.milestones.has("day7")) return "Hold basen i live til dag 7.";
    return "Du har etablert et håp. Fortsett å utvide basen og jakte bedre loot.";
  }

  addNoise(x, y, radius) {
    if (radius <= 0) return;
    this.noiseEvents.push({ x, y, radius, ttl: 1.2 });
  }

  addParticles(x, y, count, color, speed = 80) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color, speed));
  }

  addFloatingText(text, x, y, color) {
    this.floaters.push(new FloatingText(text, x, y, color));
  }

  message(text) {
    const log = document.getElementById("messageLog");
    const p = document.createElement("p");
    p.textContent = text;
    log.prepend(p);
    while (log.children.length > 7) log.lastChild.remove();
  }

  toast(text) {
    const layer = document.getElementById("toastLayer");
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = text;
    layer.append(div);
    window.setTimeout(() => div.remove(), 3000);
  }

  flashDamage() {
    const el = document.getElementById("damageVignette");
    el.classList.add("show");
    window.setTimeout(() => el.classList.remove("show"), 120);
  }

  updateHUD() {
    if (!this.player) return;
    document.getElementById("healthMeter").value = this.player.health;
    document.getElementById("staminaMeter").value = this.player.stamina;
    document.getElementById("hungerMeter").value = this.player.hunger;
    document.getElementById("thirstMeter").value = this.player.thirst;

    const hours = Math.floor(this.dayFraction * 24);
    const minutes = Math.floor((this.dayFraction * 24 - hours) * 60);
    document.getElementById("dayLabel").textContent = `Dag ${this.day} • ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    const pill = document.getElementById("threatPill");
    if (this.isHordeNight) {
      pill.textContent = "Hordenatt";
      pill.classList.add("danger");
    } else if (this.isNight) {
      pill.textContent = "Natt: høy risiko";
      pill.classList.add("danger");
    } else {
      pill.textContent = "Dagslys";
      pill.classList.remove("danger");
    }

    document.getElementById("objectiveBox").innerHTML = `<strong>Neste mål</strong>${this.currentObjective()}`;
    this.renderHotbar();

    // Sidepanelet må ikke tegnes på nytt hvert frame; da mister knappene klikk-eventer.
    this.refreshSidePanelIfNeeded();
  }

  renderHotbar() {
    const hotbar = document.getElementById("hotbar");
    hotbar.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const id = this.player.weapons[i];
      const div = document.createElement("div");
      div.className = `hotSlot ${id === this.player.currentWeapon ? "active" : ""}`;
      if (id) {
        const w = this.config.weapons[id];
        const ammoText = w.ammo ? `${this.player.inventory.count(w.ammo)}` : "∞";
        div.innerHTML = `<span class="key">${i + 1}</span><span class="name">${w.name}</span><span class="key">${ammoText}</span>`;
      } else {
        div.innerHTML = `<span class="key">${i + 1}</span><span class="name">—</span>`;
      }
      hotbar.append(div);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#10170f";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.world || !this.player) {
      ctx.restore();
      return;
    }

    ctx.save();
    this.camera.apply(ctx);

    this.world.draw(ctx, this.camera, this.renderer);

    const drawables = [
      ...this.zombies.map(z => ({ y: z.y, draw: () => z.draw(ctx, this.renderer) })),
      { y: this.player.y, draw: () => this.player.draw(ctx, this.renderer) }
    ].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    for (const p of this.projectiles) p.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const f of this.floaters) f.draw(ctx);

    this.drawBuildGhost(ctx);
    ctx.restore();

    this.drawLighting(ctx);
    this.drawMinimap(ctx);
    ctx.restore();
  }

  drawBuildGhost(ctx) {
    if (!this.buildSelection) return;
    const def = this.config.buildables[this.buildSelection];
    const grid = 16;
    const x = Math.round(this.input.mouse.worldX / grid) * grid;
    const y = Math.round(this.input.mouse.worldY / grid) * grid;
    const ok = this.world.canPlaceBuildable(x, y, def.w, def.h) && dist(x, y, this.player.x, this.player.y) <= 180 && this.player.inventory.has(def.cost);
    ctx.save();
    ctx.globalAlpha = 0.64;
    this.renderer.drawSpriteKey(ctx, "objects", this.buildSelection, x, y, def.w, def.h);
    ctx.strokeStyle = ok ? "#7cc98a" : "#ef6461";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - def.w / 2, y - def.h / 2, def.w, def.h);
    ctx.restore();
  }

  drawLighting(ctx) {
    const f = this.dayFraction;
    let darkness = 0;
    if (f > 0.46 && f < this.config.world.nightStart) darkness = (f - 0.46) / (this.config.world.nightStart - 0.46) * 0.38;
    if (this.isNight) darkness = this.isHordeNight ? 0.68 : 0.58;
    if (f > this.config.world.nightEnd) darkness = Math.max(0, 0.58 * (1 - (f - this.config.world.nightEnd) / (1 - this.config.world.nightEnd)));
    if (darkness <= 0.01) return;

    const gradient = ctx.createRadialGradient(this.canvas.width / 2, this.canvas.height / 2, 80, this.canvas.width / 2, this.canvas.height / 2, Math.max(this.canvas.width, this.canvas.height) * 0.68);
    gradient.addColorStop(0, `rgba(0,0,0,${darkness * 0.12})`);
    gradient.addColorStop(0.46, `rgba(0,0,0,${darkness * 0.42})`);
    gradient.addColorStop(1, `rgba(0,0,0,${darkness})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMinimap(ctx) {
    const size = 150;
    const pad = 16;
    const x = this.canvas.width - size - pad;
    const y = this.canvas.height - size - pad;
    ctx.save();
    ctx.globalAlpha = 0.84;
    ctx.fillStyle = "rgba(8,12,10,.74)";
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 16);
    ctx.fill();
    ctx.stroke();
    ctx.clip();

    const scaleX = size / this.world.pixelWidth;
    const scaleY = size / this.world.pixelHeight;
    ctx.fillStyle = "#7cc98a";
    ctx.fillRect(x + this.player.x * scaleX - 2, y + this.player.y * scaleY - 2, 4, 4);
    ctx.fillStyle = "#ef6461";
    for (const z of this.zombies) {
      if (dist(z.x, z.y, this.player.x, this.player.y) < 900) ctx.fillRect(x + z.x * scaleX - 1.5, y + z.y * scaleY - 1.5, 3, 3);
    }
    ctx.fillStyle = "#d6a949";
    for (const obj of this.world.objects) {
      if (obj.building) ctx.fillRect(x + obj.x * scaleX - 1.5, y + obj.y * scaleY - 1.5, 3, 3);
    }
    ctx.restore();
  }

  gameOver() {
    this.state = "gameover";
    this.save();
    const stats = `Du holdt ut til dag ${this.day}, med ${this.zombies.length} levende zombier i nærheten.`;
    document.getElementById("gameOverStats").textContent = stats;
    this.openScreen("gameOverScreen");
  }

  save() {
    if (!this.player || !this.world) return false;
    const buildables = this.world.objects
      .filter(o => o.building || o.looted)
      .map(o => ({
        type: o.type, x: o.x, y: o.y, w: o.w, h: o.h, hp: o.hp, maxHp: o.maxHp, building: o.building, collides: o.collides,
        lootTable: o.lootTable, looted: o.looted, name: o.name, produces: o.produces
      }));
    const data = {
      version: 1,
      gameTime: this.gameTime,
      day: this.day,
      player: this.player.serialize(),
      storyFlags: [...this.storyFlags],
      buildables
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  }

  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      this.gameTime = data.gameTime ?? this.gameTime;
      this.day = data.day ?? this.day;
      this.player.restore(data.player || {});
      this.storyFlags = new Set(data.storyFlags || []);
      // Re-apply saved buildings and looted containers. The generated world remains deterministic.
      for (const saved of data.buildables || []) {
        if (saved.building) {
          this.world.objects.push(new WorldObject(saved.type, saved.x, saved.y, saved.w, saved.h, {
            hp: saved.hp, name: saved.name, building: true, collides: saved.collides, produces: saved.produces
          }));
        } else if (saved.looted) {
          const match = this.world.objects.find(o => o.type === saved.type && Math.abs(o.x - saved.x) < 1 && Math.abs(o.y - saved.y) < 1);
          if (match) match.looted = true;
        }
      }
      return true;
    } catch (err) {
      console.warn("Could not load save", err);
      return false;
    }
  }
}

CanvasRenderingContext2D.prototype.roundRect ||= function(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  this.beginPath();
  this.moveTo(x + radius, y);
  this.arcTo(x + w, y, x + w, y + h, radius);
  this.arcTo(x + w, y + h, x, y + h, radius);
  this.arcTo(x, y + h, x, y, radius);
  this.arcTo(x, y, x + w, y, radius);
  this.closePath();
  return this;
};

const game = new Game();
game.init();
