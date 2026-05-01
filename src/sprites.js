(() => {
  "use strict";

  const EM = window.EM;

  const fallback = {
    drawPlayer: EM.drawPlayer,
    drawZombie: EM.drawZombie,
    drawNode: EM.drawNode,
    drawBuilding: EM.drawBuilding,
    drawDrop: EM.drawDrop,
  };

  EM.SPRITE_SHEET_EXPECTED_WIDTH = 2048;
  EM.SPRITE_SHEET_EXPECTED_HEIGHT = 2048;

  EM.SPRITE_SHEET_PATH = "assets/images/survival_spritesheet.png?v=2048-20260501";

  EM.spriteSheet = new Image();
  EM.spriteSheetReady = false;
  EM.spriteSheetError = null;

  EM.spriteSheet.onload = () => {
    const width = EM.spriteSheet.naturalWidth;
    const height = EM.spriteSheet.naturalHeight;

    if (
      width !== EM.SPRITE_SHEET_EXPECTED_WIDTH ||
      height !== EM.SPRITE_SHEET_EXPECTED_HEIGHT
    ) {
      EM.spriteSheetReady = false;
      EM.spriteSheetError = `Feil sprite sheet-dimensjon: ${width}×${height}. Forventet 2048×2048.`;

      console.warn(EM.spriteSheetError);
      console.warn("Loaded sprite sheet URL:", EM.spriteSheet.currentSrc);

      if (EM.toast) {
        EM.toast("Feil sprite sheet-fil lastet. Forventet 2048×2048 PNG.");
      }

      return;
    }

    EM.spriteSheetReady = true;
    EM.spriteSheetError = null;

    console.log("Sprite sheet loaded correctly:", EM.spriteSheet.currentSrc);
    console.log("Sprite sheet size:", width, height);

    if (EM.toast) {
      EM.toast("Sprite sheet lastet riktig.");
    }
  };

  EM.spriteSheet.onerror = () => {
    EM.spriteSheetReady = false;
    EM.spriteSheetError = "Kunne ikke laste sprite sheet.";

    console.warn("Could not load sprite sheet:", EM.SPRITE_SHEET_PATH);

    if (EM.toast) {
      EM.toast("Kunne ikke laste sprite sheet.");
    }
  };

  EM.spriteSheet.src = EM.SPRITE_SHEET_PATH;

  EM.debugSpritesheet = function debugSpritesheet() {
    console.log({
      path: EM.SPRITE_SHEET_PATH,
      currentSrc: EM.spriteSheet.currentSrc,
      complete: EM.spriteSheet.complete,
      ready: EM.spriteSheetReady,
      naturalWidth: EM.spriteSheet.naturalWidth,
      naturalHeight: EM.spriteSheet.naturalHeight,
      error: EM.spriteSheetError,
    });
  };

  function s(x, y, w, h, dw, dh) {
    return { x, y, w, h, dw, dh };
  }

  EM.SPRITES = {
    survivor: {
      idle: s(1909, 70, 102, 193, 54, 92),
      down: [
        s(38, 57, 124, 209, 56, 94),
        s(225, 56, 118, 213, 56, 96),
        s(393, 57, 119, 206, 56, 93),
      ],
      up: [
        s(559, 55, 110, 201, 52, 91),
        s(702, 56, 110, 203, 52, 92),
        s(852, 56, 109, 203, 52, 92),
      ],
      right: [
        s(1009, 63, 94, 199, 48, 90),
        s(1164, 68, 101, 193, 50, 88),
        s(1316, 68, 106, 192, 51, 88),
      ],
    },

    zombie: {
      idle: s(1915, 333, 110, 196, 54, 90),
      down: [
        s(45, 323, 119, 215, 56, 98),
        s(227, 323, 118, 220, 56, 100),
        s(391, 324, 122, 209, 56, 96),
      ],
      up: [
        s(564, 326, 105, 204, 52, 94),
        s(709, 323, 105, 203, 52, 93),
        s(862, 324, 102, 207, 52, 95),
      ],
      right: [
        s(1017, 324, 97, 208, 50, 96),
        s(1178, 325, 101, 204, 50, 94),
        s(1325, 325, 111, 206, 52, 95),
      ],
    },

    weapons: {
      knife: s(65, 590, 174, 193, 42, 46),
      axe: s(344, 576, 204, 213, 48, 50),
      pickaxe: s(654, 589, 189, 203, 48, 50),
      spear: s(937, 579, 166, 215, 44, 54),
      bow: s(1213, 589, 171, 208, 44, 54),
      pistol: s(1471, 624, 196, 143, 52, 38),
      shotgun: s(1732, 604, 278, 166, 66, 40),
    },

    nodes: {
      tree: s(42, 826, 261, 271, 140, 146),
      bush: s(411, 856, 253, 221, 116, 102),
      rock: s(743, 852, 258, 232, 106, 96),
      oreRock: s(1067, 844, 256, 234, 108, 98),
      puddle: s(1384, 861, 268, 214, 116, 82),
      scrapPile: s(1719, 845, 286, 240, 118, 98),
    },

    buildings: {
      campfire: s(33, 1154, 210, 209, 74, 74),
      torch: s(355, 1131, 57, 248, 34, 92),
      workbench: s(533, 1161, 254, 208, 92, 76),
      smelter: s(847, 1136, 208, 232, 84, 94),
      woodWallH: s(1108, 1210, 223, 129, 72, 42),
      woodWallV: s(1396, 1149, 167, 227, 46, 76),
      stoneWallH: s(1622, 1208, 218, 130, 76, 44),
      stoneWallV: s(1913, 1139, 81, 240, 38, 82),
      spikes: s(39, 1432, 295, 194, 86, 62),
      rainCollector: s(423, 1423, 287, 218, 86, 66),
      bedroll: s(823, 1436, 330, 196, 86, 54),
      metalIngotLarge: s(1277, 1459, 228, 163, 70, 50),
      storage: s(1691, 1435, 238, 179, 78, 58),
    },

    items: {
      wood: s(39, 1680, 148, 135, 34, 31),
      stone: s(253, 1680, 146, 138, 34, 32),
      ore: s(463, 1675, 152, 147, 35, 34),
      metal: s(673, 1690, 148, 123, 36, 30),
      coal: s(870, 1670, 160, 158, 34, 34),
      scrap: s(1073, 1673, 170, 152, 36, 32),
      cloth: s(1288, 1681, 173, 141, 36, 30),
      food: s(1519, 1675, 134, 147, 32, 34),
      dirtyWater: s(1721, 1672, 83, 149, 24, 38),
      water: s(1915, 1672, 76, 150, 24, 38),
      herbs: s(61, 1868, 191, 145, 38, 30),
      ammo: s(349, 1868, 193, 146, 38, 30),
      arrows: s(633, 1869, 233, 143, 42, 28),
      parts: s(971, 1874, 182, 130, 36, 28),
      bandage: s(1275, 1871, 150, 139, 34, 30),
      medkit: s(1520, 1868, 195, 149, 38, 30),
      canteen: s(1832, 1864, 143, 152, 32, 34),
    },
  };

  function canUseSprites() {
    return EM.spriteSheetReady && EM.spriteSheet.complete && !EM.spriteSheetError;
  }

  function drawShadow(x, y, w, h, alpha = 0.28) {
    const ctx = EM.ctx;

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.32, w * 0.35, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSprite(sprite, x, y, options = {}) {
    if (!sprite ||
