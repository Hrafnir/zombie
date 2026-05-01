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

  EM.SPRITE_SHEET_PATH = "assets/images/survival_spritesheet.png";
  EM.SPRITE_ATLAS_BASE_W = 2048;
  EM.SPRITE_ATLAS_BASE_H = 2048;

  EM.spriteSheet = new Image();
  EM.spriteSheetReady = false;

  EM.spriteSheet.onload = () => {
    EM.spriteSheetReady = true;
    console.log(
      "Sprite sheet loaded:",
      EM.SPRITE_SHEET_PATH,
      EM.spriteSheet.naturalWidth,
      "x",
      EM.spriteSheet.naturalHeight
    );
  };

  EM.spriteSheet.onerror = () => {
    EM.spriteSheetReady = false;
    console.warn("Could not load sprite sheet:", EM.SPRITE_SHEET_PATH);
  };

  EM.spriteSheet.src = EM.SPRITE_SHEET_PATH + "?v=grounding_fix_2";

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
    return EM.spriteSheetReady && EM.spriteSheet.complete && EM.spriteSheet.naturalWidth > 0;
  }

  function scaledSourceRect(sprite) {
    const scaleX = EM.spriteSheet.naturalWidth / EM.SPRITE_ATLAS_BASE_W;
    const scaleY = EM.spriteSheet.naturalHeight / EM.SPRITE_ATLAS_BASE_H;

    return {
      sx: Math.round(sprite.x * scaleX),
      sy: Math.round(sprite.y * scaleY),
      sw: Math.round(sprite.w * scaleX),
      sh: Math.round(sprite.h * scaleY),
    };
  }

  function drawShadow(x, y, w, h, options = {}) {
    const ctx = EM.ctx;
    const alpha = options.alpha ?? 0.22;
    const yOffset = options.yOffset ?? 6;
    const rx = options.rx ?? w * 0.24;
    const ry = options.ry ?? h * 0.055;

    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y + yOffset, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGroundContact(x, y, w = 24) {
    const ctx = EM.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSprite(sprite, x, y, options = {}) {
    if (!sprite || !canUseSprites()) return false;

    const ctx = EM.ctx;
    const dw = options.dw || sprite.dw || sprite.w;
    const dh = options.dh || sprite.dh || sprite.h;
    const alpha = options.alpha ?? 1;
    const rotation = options.rotation || 0;
    const flipX = Boolean(options.flipX);
    const anchor = options.anchor || "center";
    const footLift = options.footLift ?? 0;
    const source = scaledSourceRect(sprite);

    if (source.sw <= 0 || source.sh <= 0) return false;

    let dx = -dw / 2;
    let dy = -dh / 2;

    if (anchor === "feet") {
      dx = -dw / 2;
      dy = -dh + footLift;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    if (flipX) ctx.scale(-1, 1);

    ctx.globalAlpha = alpha;
    ctx.drawImage(
      EM.spriteSheet,
      source.sx,
      source.sy,
      source.sw,
      source.sh,
      dx,
      dy,
      dw,
      dh
    );

    ctx.restore();
    return true;
  }

  function directionFromAngle(angle) {
    if (angle > -Math.PI / 4 && angle <= Math.PI / 4) return "right";
    if (angle > Math.PI / 4 && angle <= (3 * Math.PI) / 4) return "down";
    if (angle < -Math.PI / 4 && angle >= (-3 * Math.PI) / 4) return "up";
    return "left";
  }

  function animationFrame(frameValue, max = 3) {
    return Math.abs(Math.floor(frameValue || 0)) % max;
  }

  function movementDirection() {
    const x =
      (EM.isDown("d", "arrowright") ? 1 : 0) -
      (EM.isDown("a", "arrowleft") ? 1 : 0);

    const y =
      (EM.isDown("s", "arrowdown") ? 1 : 0) -
      (EM.isDown("w", "arrowup") ? 1 : 0);

    if (x === 0 && y === 0) return null;
    return directionFromAngle(Math.atan2(y, x));
  }

  EM.drawPlayer = function drawPlayerSprite() {
    if (!canUseSprites()) {
      fallback.drawPlayer();
      return;
    }

    const player = EM.state.player;
    const moveDir = movementDirection();
    const aimDir = directionFromAngle(
      Math.atan2(EM.mouse.wy - player.y, EM.mouse.wx - player.x)
    );

    const dir = moveDir || aimDir || "down";

    let sprite;
    let flipX = false;

    if (!moveDir) {
      if (dir === "left") {
        sprite = EM.SPRITES.survivor.right[1];
        flipX = true;
      } else if (dir === "right") {
        sprite = EM.SPRITES.survivor.right[1];
      } else if (dir === "up") {
        sprite = EM.SPRITES.survivor.up[1];
      } else {
        sprite = EM.SPRITES.survivor.down[1];
      }
    } else if (dir === "left") {
      sprite = EM.SPRITES.survivor.right[animationFrame(player.frame, 3)];
      flipX = true;
    } else if (dir === "right") {
      sprite = EM.SPRITES.survivor.right[animationFrame(player.frame, 3)];
    } else {
      const list = EM.SPRITES.survivor[dir] || EM.SPRITES.survivor.down;
      sprite = list[animationFrame(player.frame, list.length)];
    }

    drawShadow(player.x, player.y, sprite.dw, sprite.dh, {
      alpha: 0.18,
      yOffset: 7,
      rx: sprite.dw * 0.22,
      ry: 4.5,
    });

    drawGroundContact(player.x, player.y + 2, 22);

    drawSprite(sprite, player.x, player.y, {
      anchor: "feet",
      footLift: 6,
      flipX,
      alpha: player.iframe > 0 ? 0.6 : 1,
    });
  };

  EM.drawZombie = function drawZombieSprite(zombie) {
    if (!canUseSprites()) {
      fallback.drawZombie(zombie);
      return;
    }

    const angle = Math.atan2(
      (zombie.targetY || zombie.y) - zombie.y,
      (zombie.targetX || zombie.x) - zombie.x
    );

    const dir = directionFromAngle(angle);

    let sprite;
    let flipX = false;

    if (dir === "left") {
      sprite = EM.SPRITES.zombie.right[animationFrame(zombie.frame, 3)];
      flipX = true;
    } else if (dir === "right") {
      sprite = EM.SPRITES.zombie.right[animationFrame(zombie.frame, 3)];
    } else {
      const list = EM.SPRITES.zombie[dir] || EM.SPRITES.zombie.down;
      sprite = list[animationFrame(zombie.frame, list.length)] || EM.SPRITES.zombie.idle;
    }

    const scale =
      zombie.type === "brute" ? 1.22 :
      zombie.type === "runner" ? 0.92 :
      zombie.type === "spitter" ? 1.04 :
      1;

    drawShadow(zombie.x, zombie.y, sprite.dw * scale, sprite.dh * scale, {
      alpha: 0.2,
      yOffset: 7,
      rx: sprite.dw * scale * 0.24,
      ry: 4.5,
    });

    drawGroundContact(zombie.x, zombie.y + 2, 20 * scale);

    drawSprite(sprite, zombie.x, zombie.y, {
      anchor: "feet",
      footLift: 6,
      flipX,
      dw: sprite.dw * scale,
      dh: sprite.dh * scale,
    });

    if (zombie.hp < zombie.maxHp) {
      const ctx = EM.ctx;
      ctx.fillStyle = "#351";
      ctx.fillRect(zombie.x - 20, zombie.y - 70 * scale, 40, 5);

      ctx.fillStyle = "#d35d5d";
      ctx.fillRect(zombie.x - 20, zombie.y - 70 * scale, 40 * (zombie.hp / zombie.maxHp), 5);
    }
  };

  EM.drawNode = function drawNodeSprite(node) {
    if (!canUseSprites()) {
      fallback.drawNode(node);
      return;
    }

    const sprite = EM.SPRITES.nodes[node.type];

    if (!sprite) {
      fallback.drawNode(node);
      return;
    }

    const isFlat = node.type === "puddle";
    const footLift =
      node.type === "tree" ? 4 :
      node.type === "bush" ? 4 :
      node.type === "rock" ? 4 :
      node.type === "oreRock" ? 4 :
      node.type === "scrapPile" ? 4 :
      0;

    if (isFlat) {
      drawShadow(node.x, node.y, sprite.dw, sprite.dh, {
        alpha: 0.08,
        yOffset: 0,
        rx: sprite.dw * 0.38,
        ry: 6,
      });

      drawSprite(sprite, node.x, node.y + 2, {
        anchor: "center",
      });
    } else {
      drawShadow(node.x, node.y, sprite.dw, sprite.dh, {
        alpha: 0.16,
        yOffset: 7,
        rx: sprite.dw * 0.26,
        ry: 5,
      });

      drawGroundContact(node.x, node.y + 2, 26);

      drawSprite(sprite, node.x, node.y, {
        anchor: "feet",
        footLift,
        rotation: node.rotation || 0,
      });
    }
  };

  function buildingSpriteKey(building) {
    if (building.type === "woodWall") {
      const quarterTurn = Math.abs(Math.round((building.rotation || 0) / (Math.PI / 2))) % 2 === 1;
      return quarterTurn ? "woodWallV" : "woodWallH";
    }

    if (building.type === "stoneWall") {
      const quarterTurn = Math.abs(Math.round((building.rotation || 0) / (Math.PI / 2))) % 2 === 1;
      return quarterTurn ? "stoneWallV" : "stoneWallH";
    }

    return building.type;
  }

  EM.drawBuilding = function drawBuildingSprite(building) {
    if (!canUseSprites()) {
      fallback.drawBuilding(building);
      return;
    }

    const key = buildingSpriteKey(building);
    const sprite = EM.SPRITES.buildings[key];

    if (!sprite) {
      fallback.drawBuilding(building);
      return;
    }

    const footLift =
      building.type === "torch" ? 4 :
      building.type === "campfire" ? 2 :
      building.type === "spikes" ? 4 :
      building.type === "woodWall" ? 4 :
      building.type === "stoneWall" ? 4 :
      building.type === "bedroll" ? 0 :
      4;

    const isFlat = building.type === "bedroll";

    drawShadow(building.x, building.y, sprite.dw, sprite.dh, {
      alpha: isFlat ? 0.08 : 0.18,
      yOffset: isFlat ? 2 : 7,
      rx: isFlat ? sprite.dw * 0.36 : sprite.dw * 0.26,
      ry: isFlat ? 6 : 5,
    });

    if (!isFlat) drawGroundContact(building.x, building.y + 2, 24);

    drawSprite(sprite, building.x, building.y, {
      anchor: isFlat ? "center" : "feet",
      footLift,
    });

    const ctx = EM.ctx;
    const size = EM.buildingSize(building.type, building.rotation || 0);

    if (building.job) {
      ctx.fillStyle = "#2a1a16";
      ctx.fillRect(building.x - size.w / 2, building.y - size.h / 2 - 16, size.w, 5);

      ctx.fillStyle = "#ffd166";
      ctx.fillRect(
        building.x - size.w / 2,
        building.y - size.h / 2 - 16,
        size.w * (building.job.t / building.job.total),
        5
      );
    }

    if (building.type === "rainCollector") {
      ctx.fillStyle = "#bdefff";
      ctx.fillRect(building.x - 14, building.y + 18, (28 * (building.waterStore || 0)) / 8, 5);
    }

    if (building.hp < building.maxHp) {
      ctx.fillStyle = "#2a1a16";
      ctx.fillRect(building.x - size.w / 2, building.y - size.h / 2 - 24, size.w, 5);

      ctx.fillStyle = "#8fd46e";
      ctx.fillRect(
        building.x - size.w / 2,
        building.y - size.h / 2 - 24,
        size.w * (building.hp / building.maxHp),
        5
      );
    }
  };

  EM.drawDrop = function drawDropSprite(drop) {
    if (!canUseSprites()) {
      fallback.drawDrop(drop);
      return;
    }

    const sprite = EM.SPRITES.items[drop.id];

    if (!sprite) {
      fallback.drawDrop(drop);
      return;
    }

    drawShadow(drop.x, drop.y, sprite.dw, sprite.dh, {
      alpha: 0.12,
      yOffset: 5,
      rx: sprite.dw * 0.22,
      ry: 3.5,
    });

    drawSprite(sprite, drop.x, drop.y, {
      anchor: "feet",
      footLift: 2,
    });

    if (drop.amount > 1) {
      const ctx = EM.ctx;

      ctx.save();
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.fillStyle = "#ffffff";

      const text = String(drop.amount);
      ctx.strokeText(text, drop.x + sprite.dw * 0.35, drop.y + sprite.dh * 0.15);
      ctx.fillText(text, drop.x + sprite.dw * 0.35, drop.y + sprite.dh * 0.15);

      ctx.restore();
    }
  };
})();
