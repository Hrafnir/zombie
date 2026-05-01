(() => {
  "use strict";

  const EM = window.EM;

  EM.draw = function draw() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ctx = EM.ctx;

    ctx.clearRect(0, 0, width, height);

    EM.state.camera.x = EM.clamp(
      EM.state.player.x - width / 2,
      0,
      Math.max(0, EM.state.worldW - width)
    );

    EM.state.camera.y = EM.clamp(
      EM.state.player.y - height / 2,
      0,
      Math.max(0, EM.state.worldH - height)
    );

    EM.updateMouseWorld();

    if (EM.state.camera.shake > 0) {
      EM.state.camera.shake = Math.max(0, EM.state.camera.shake - 0.8);
    }

    const shakeX = EM.state.camera.shake > 0 ? EM.rand(-EM.state.camera.shake, EM.state.camera.shake) : 0;
    const shakeY = EM.state.camera.shake > 0 ? EM.rand(-EM.state.camera.shake, EM.state.camera.shake) : 0;

    ctx.save();
    ctx.translate(-EM.state.camera.x + shakeX, -EM.state.camera.y + shakeY);

    EM.drawWorld();
    EM.drawLightGlowsInWorld();
    EM.drawEntities();

    ctx.restore();

    EM.drawNight(width, height);
    EM.drawMinimap(width, height);

    if (EM.paused) EM.drawPause(width, height);
  };

  EM.drawWorld = function drawWorld() {
    const ctx = EM.ctx;

    ctx.fillStyle = "#17281b";
    ctx.fillRect(EM.state.camera.x, EM.state.camera.y, window.innerWidth, window.innerHeight);

    const grid = 96;
    const startX = Math.floor(EM.state.camera.x / grid) * grid;
    const startY = Math.floor(EM.state.camera.y / grid) * grid;

    for (let y = startY; y < EM.state.camera.y + window.innerHeight + grid; y += grid) {
      for (let x = startX; x < EM.state.camera.x + window.innerWidth + grid; x += grid) {
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

    if (EM.selectedBuild) EM.drawBuildGrid();
  };

  EM.drawBuildGrid = function drawBuildGrid() {
    const ctx = EM.ctx;
    const grid = 16;
    const startX = Math.floor(EM.state.camera.x / grid) * grid;
    const startY = Math.floor(EM.state.camera.y / grid) * grid;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;

    for (let x = startX; x < EM.state.camera.x + window.innerWidth + grid; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, EM.state.camera.y);
      ctx.lineTo(x, EM.state.camera.y + window.innerHeight);
      ctx.stroke();
    }

    for (let y = startY; y < EM.state.camera.y + window.innerHeight + grid; y += grid) {
      ctx.beginPath();
      ctx.moveTo(EM.state.camera.x, y);
      ctx.lineTo(EM.state.camera.x + window.innerWidth, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  EM.drawEntities = function drawEntities() {
    const visible = [
      ...EM.state.nodes
        .filter((node) => !node.depleted)
        .map((node) => ({ ...node, kind: "node", sort: node.y })),
      ...EM.state.drops.map((drop) => ({ ...drop, kind: "drop", sort: drop.y })),
      ...EM.state.buildings.map((building) => ({ ...building, kind: "building", sort: building.y })),
      ...EM.state.zombies.map((zombie) => ({ ...zombie, kind: "zombie", sort: zombie.y })),
      { kind: "player", sort: EM.state.player.y },
    ];

    visible.sort((a, b) => a.sort - b.sort);

    for (const object of visible) {
      if (object.kind === "node") EM.drawNode(object);
      else if (object.kind === "drop") EM.drawDrop(object);
      else if (object.kind === "building") EM.drawBuilding(object);
      else if (object.kind === "zombie") EM.drawZombie(object);
      else if (object.kind === "player") EM.drawPlayer();
    }

    for (const projectile of EM.state.projectiles) EM.drawProjectile(projectile);
    for (const p of EM.state.particles) EM.drawParticle(p);

    if (EM.selectedBuild) EM.drawBuildGhost();
  };

  EM.drawNode = function drawNode(node) {
    const ctx = EM.ctx;
    const def = EM.nodeDef(node.type);

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

      for (const [x, y] of [[4, -4], [11, 3], [-7, 6]]) {
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

        for (const [x, y, r] of [[-8, -3, 3], [7, -8, 4], [12, 6, 3], [-1, 10, 3]]) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  };

  EM.drawLightGlowsInWorld = function drawLightGlowsInWorld() {
    const ctx = EM.ctx;

    for (const building of EM.state.buildings) {
      const def = EM.BUILDINGS[building.type];
      const light = def.light || 0;
      if (!light) continue;

      const radius = Math.min(light, 220);
      const gradient = ctx.createRadialGradient(building.x, building.y, 0, building.x, building.y, radius);

      gradient.addColorStop(0, "rgba(255, 170, 72, 0.32)");
      gradient.addColorStop(0.38, "rgba(255, 122, 35, 0.14)");
      gradient.addColorStop(1, "rgba(255, 122, 35, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(building.x, building.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  EM.drawBuilding = function drawBuilding(building) {
    const ctx = EM.ctx;
    const def = EM.BUILDINGS[building.type];
    const size = EM.buildingSize(building.type, building.rotation || 0);

    ctx.save();
    ctx.translate(building.x, building.y);
    ctx.rotate(building.rotation || 0);

    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath();
    ctx.ellipse(0, size.h * 0.35, size.w * 0.6, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = def.color;

    if (building.type.includes("Wall")) {
      ctx.fillRect(-def.w / 2, -def.h / 2, def.w, def.h);

      ctx.strokeStyle = "#24160d";
      for (let x = -def.w / 2 + 8; x < def.w / 2; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, -def.h / 2);
        ctx.lineTo(x, def.h / 2);
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
    } else if (building.type === "campfire") {
      ctx.fillStyle = "#57331f";
      ctx.fillRect(-18, 8, 36, 8);

      ctx.fillStyle = "#e76f28";
      ctx.beginPath();
      ctx.moveTo(-10, 12);
      ctx.lineTo(0, -24);
      ctx.lineTo(12, 12);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(-5, 10);
      ctx.lineTo(1, -12);
      ctx.lineTo(7, 10);
      ctx.closePath();
      ctx.fill();
    } else if (building.type === "torch") {
      ctx.fillStyle = "#6f4324";
      ctx.fillRect(-3, -2, 6, 22);

      ctx.fillStyle = "#ffb347";
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(0, -24);
      ctx.lineTo(8, -2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-def.w / 2, -def.h / 2, def.w, def.h);
      ctx.strokeStyle = "#111";
      ctx.strokeRect(-def.w / 2, -def.h / 2, def.w, def.h);
    }

    ctx.restore();

    if (building.job || building.hp < building.maxHp || building.type === "rainCollector") {
      ctx.save();
      ctx.translate(building.x, building.y);

      if (building.job) {
        ctx.fillStyle = "#2a1a16";
        ctx.fillRect(-size.w / 2, -size.h / 2 - 12, size.w, 4);
        ctx.fillStyle = "#ffd166";
        ctx.fillRect(-size.w / 2, -size.h / 2 - 12, size.w * (building.job.t / building.job.total), 4);
      }

      if (building.type === "rainCollector") {
        ctx.fillStyle = "#bdefff";
        ctx.fillRect(-12, 10, (24 * (building.waterStore || 0)) / 8, 5);
      }

      if (building.hp < building.maxHp) {
        ctx.fillStyle = "#2a1a16";
        ctx.fillRect(-size.w / 2, -size.h / 2 - 18, size.w, 4);
        ctx.fillStyle = "#8fd46e";
        ctx.fillRect(-size.w / 2, -size.h / 2 - 18, size.w * (building.hp / building.maxHp), 4);
      }

      ctx.restore();
    }
  };

  EM.drawDrop = function drawDrop(drop) {
    const ctx = EM.ctx;

    ctx.fillStyle = "#f4e7b0";
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(EM.itemName(drop.id)[0], drop.x, drop.y + 3);

    if (drop.amount > 1) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px system-ui";
      ctx.fillText(String(drop.amount), drop.x + 10, drop.y + 11);
    }
  };

  EM.drawZombie = function drawZombie(zombie) {
    const ctx = EM.ctx;
    const def = EM.zombieDef(zombie.type);

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
  };

  EM.drawPlayer = function drawPlayer() {
    const ctx = EM.ctx;
    const player = EM.state.player;
    const angle = Math.atan2(EM.mouse.wy - player.y, EM.mouse.wx - player.x);

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
  };

  EM.drawProjectile = function drawProjectile(projectile) {
    const ctx = EM.ctx;

    ctx.strokeStyle = projectile.enemy ? "#8eff78" : "#ead39a";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(projectile.x, projectile.y);
    ctx.lineTo(projectile.x - projectile.vx * 0.025, projectile.y - projectile.vy * 0.025);
    ctx.stroke();
  };

  EM.drawParticle = function drawParticle(particleObj) {
    const ctx = EM.ctx;

    ctx.globalAlpha = EM.clamp(particleObj.life * 2, 0, 1);
    ctx.fillStyle = particleObj.color;

    ctx.beginPath();
    ctx.arc(particleObj.x, particleObj.y, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  };

  EM.drawBuildGhost = function drawBuildGhost() {
    const ctx = EM.ctx;
    const def = EM.BUILDINGS[EM.selectedBuild];
    if (!def) return;

    const p = EM.getBuildPlacementPoint();
    const placement = EM.canPlaceBuildingAt(EM.selectedBuild, p.x, p.y);
    const recipe = EM.getBuildRecipe(EM.selectedBuild);

    const hasResources = recipe ? EM.canPay(recipe.cost) : false;
    const hasStation = recipe ? EM.stationNear(recipe.station) : false;
    const valid = placement.ok && hasResources && hasStation;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(EM.selectedBuildRotation);

    ctx.globalAlpha = 0.58;
    ctx.fillStyle = valid ? "rgba(108, 184, 106, 0.75)" : "rgba(217, 95, 95, 0.75)";
    ctx.fillRect(-def.w / 2, -def.h / 2, def.w, def.h);

    ctx.globalAlpha = 1;
    ctx.strokeStyle = valid ? "#9fff9c" : "#ff8b8b";
    ctx.lineWidth = 3;
    ctx.setLineDash(valid ? [] : [7, 5]);
    ctx.strokeRect(-def.w / 2, -def.h / 2, def.w, def.h);
    ctx.setLineDash([]);

    ctx.restore();

    ctx.save();
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = valid ? "#dfffd9" : "#ffd7d7";

    let text = placement.reason;
    if (!hasResources && recipe) text = `Mangler: ${EM.missingText(recipe.cost)}`;
    else if (!hasStation && recipe) text = `Må stå ved ${EM.stationName(recipe.station)}`;

    ctx.fillText(text, p.x, p.y - EM.buildingSize(EM.selectedBuild, EM.selectedBuildRotation).h / 2 - 10);
    ctx.restore();
  };

  EM.drawNight = function drawNight(width, height) {
    const ctx = EM.ctx;
    const darkness = EM.isNight() ? 0.7 : EM.twilightDarkness();

    if (darkness <= 0) return;

    ctx.save();
    ctx.fillStyle = `rgba(2,5,9,${darkness})`;
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "destination-out";

    const lights = [
      { x: EM.state.player.x, y: EM.state.player.y, r: 145 },
      ...EM.state.buildings
        .filter((building) => EM.BUILDINGS[building.type].light)
        .map((building) => ({
          x: building.x,
          y: building.y,
          r: EM.BUILDINGS[building.type].light,
        })),
    ];

    for (const light of lights) {
      const x = light.x - EM.state.camera.x;
      const y = light.y - EM.state.camera.y;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, light.r);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, light.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  EM.drawMinimap = function drawMinimap(width, height) {
    const ctx = EM.ctx;
    const mapW = 160;
    const mapH = 120;
    const x = width - mapW - 14;
    const y = height - mapH - 14;

    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x, y, mapW, mapH);

    ctx.strokeStyle = "#789";
    ctx.strokeRect(x, y, mapW, mapH);

    const sx = mapW / EM.state.worldW;
    const sy = mapH / EM.state.worldH;

    ctx.fillStyle = "#fff";
    ctx.fillRect(x + EM.state.player.x * sx - 2, y + EM.state.player.y * sy - 2, 4, 4);

    ctx.fillStyle = "#d35d5d";
    for (const zombie of EM.state.zombies) {
      if (EM.dist(zombie.x, zombie.y, EM.state.player.x, EM.state.player.y) < 600) {
        ctx.fillRect(x + zombie.x * sx - 1, y + zombie.y * sy - 1, 2, 2);
      }
    }

    ctx.fillStyle = "#d5b56c";
    for (const building of EM.state.buildings) {
      ctx.fillRect(x + building.x * sx - 1, y + building.y * sy - 1, 3, 3);
    }
  };

  EM.drawPause = function drawPause(width, height) {
    EM.ctx.fillStyle = "rgba(0,0,0,.4)";
    EM.ctx.fillRect(0, 0, width, height);
  };
})();
