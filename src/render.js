(() => {
  "use strict";

  const EM = window.EM;

  function getDarknessAlpha() {
    if (EM.isNight()) return 0.7;
    return EM.twilightDarkness();
  }

  function ensureLightOverlay(width, height) {
    if (!EM.lightOverlayCanvas) {
      EM.lightOverlayCanvas = document.createElement("canvas");
      EM.lightOverlayCtx = EM.lightOverlayCanvas.getContext("2d");
    }

    if (EM.lightOverlayCanvas.width !== width || EM.lightOverlayCanvas.height !== height) {
      EM.lightOverlayCanvas.width = width;
      EM.lightOverlayCanvas.height = height;
    }

    return EM.lightOverlayCtx;
  }

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
    const camX = EM.state.camera.x;
    const camY = EM.state.camera.y;
    const width = window.innerWidth;
    const height = window.innerHeight;

    ctx.fillStyle = "#18311f";
    ctx.fillRect(camX, camY, width, height);

    const tile = 64;
    const startX = Math.floor(camX / tile) * tile;
    const startY = Math.floor(camY / tile) * tile;

    for (let y = startY; y < camY + height + tile; y += tile) {
      for (let x = startX; x < camX + width + tile; x += tile) {
        const n1 = Math.sin(x * 0.0123 + y * 0.0091);
        const n2 = Math.sin(x * 0.031 + y * 0.017);
        const n3 = Math.cos(x * 0.018 - y * 0.011);

        let fill = "#1c3822";
        if (n1 > 0.4) fill = "#214126";
        else if (n1 < -0.35) fill = "#15301c";

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, tile, tile);

        // myke jordfelt
        if (n2 > 0.72) {
          ctx.fillStyle = "rgba(94, 72, 38, 0.16)";
          ctx.beginPath();
          ctx.ellipse(x + 32, y + 34, 18, 10, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // lys gressvariasjon
        if (n3 > 0.62) {
          ctx.fillStyle = "rgba(88, 133, 77, 0.16)";
          ctx.beginPath();
          ctx.ellipse(x + 18, y + 18, 12, 8, -0.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(x + 46, y + 41, 10, 7, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // små stein/gress-prikker
        const d = Math.abs(Math.sin(x * 0.047 + y * 0.053));
        if (d > 0.78) {
          ctx.fillStyle = "rgba(219, 233, 199, 0.08)";
          ctx.fillRect(x + 11, y + 10, 2, 2);
          ctx.fillRect(x + 33, y + 26, 2, 2);
          ctx.fillRect(x + 47, y + 15, 1, 1);
          ctx.fillRect(x + 20, y + 45, 2, 2);
        }

        // litt gress-strå
        if (d < 0.12) {
          ctx.strokeStyle = "rgba(143, 187, 118, 0.12)";
          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.moveTo(x + 22, y + 48);
          ctx.lineTo(x + 24, y + 43);
          ctx.lineTo(x + 26, y + 48);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x + 40, y + 38);
          ctx.lineTo(x + 42, y + 32);
          ctx.lineTo(x + 44, y + 38);
          ctx.stroke();
        }
      }
    }

    // veldig svak stor-noise for å bryte opp mønsteret
    const patch = 160;
    const patchStartX = Math.floor(camX / patch) * patch;
    const patchStartY = Math.floor(camY / patch) * patch;

    for (let y = patchStartY; y < camY + height + patch; y += patch) {
      for (let x = patchStartX; x < camX + width + patch; x += patch) {
        const v = Math.sin(x * 0.006 + y * 0.004);

        if (v > 0.44) {
          ctx.fillStyle = "rgba(51, 84, 47, 0.10)";
          ctx.beginPath();
          ctx.ellipse(x + 80, y + 80, 58, 34, 0.25, 0, Math.PI * 2);
          ctx.fill();
        } else if (v < -0.46) {
          ctx.fillStyle = "rgba(82, 60, 36, 0.07)";
          ctx.beginPath();
          ctx.ellipse(x + 84, y + 78, 50, 28, -0.2, 0, Math.PI * 2);
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
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
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

  EM.drawLightGlowsInWorld = function drawLightGlowsInWorld() {
    const darkness = getDarknessAlpha();
    if (darkness <= 0) return;

    const ctx = EM.ctx;

    for (const building of EM.state.buildings) {
      const def = EM.BUILDINGS[building.type];
      let light = def.light || 0;
      if (!light) continue;

      if (building.flicker) light *= building.flicker;

      const radius = Math.min(light, 240);
      const gradient = ctx.createRadialGradient(building.x, building.y, 0, building.x, building.y, radius);

      gradient.addColorStop(0, "rgba(255, 170, 72, 0.24)");
      gradient.addColorStop(0.38, "rgba(255, 122, 35, 0.10)");
      gradient.addColorStop(1, "rgba(255, 122, 35, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(building.x, building.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
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

    ctx.fillText(
      text,
      p.x,
      p.y - EM.buildingSize(EM.selectedBuild, EM.selectedBuildRotation).h / 2 - 10
    );

    ctx.restore();
  };

  EM.drawNight = function drawNight(width, height) {
    const darkness = getDarknessAlpha();
    if (darkness <= 0) return;

    const overlayCtx = ensureLightOverlay(width, height);
    const overlay = EM.lightOverlayCanvas;

    overlayCtx.clearRect(0, 0, width, height);

    overlayCtx.globalCompositeOperation = "source-over";
    overlayCtx.fillStyle = `rgba(2,5,9,${darkness})`;
    overlayCtx.fillRect(0, 0, width, height);

    overlayCtx.globalCompositeOperation = "destination-out";

    const lights = [
      { x: EM.state.player.x, y: EM.state.player.y, r: 145 },
      ...EM.state.buildings
        .filter((building) => EM.BUILDINGS[building.type].light)
        .map((building) => {
          const def = EM.BUILDINGS[building.type];
          const flicker = building.flicker || 1;

          return {
            x: building.x,
            y: building.y,
            r: def.light * flicker,
          };
        }),
    ];

    for (const light of lights) {
      const x = light.x - EM.state.camera.x;
      const y = light.y - EM.state.camera.y;

      const gradient = overlayCtx.createRadialGradient(x, y, 0, x, y, light.r);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.42, "rgba(255,255,255,0.65)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      overlayCtx.fillStyle = gradient;
      overlayCtx.beginPath();
      overlayCtx.arc(x, y, light.r, 0, Math.PI * 2);
      overlayCtx.fill();
    }

    overlayCtx.globalCompositeOperation = "source-over";

    EM.ctx.drawImage(overlay, 0, 0, width, height);

    EM.drawWarmLightBloom(width, height, lights);
  };

  EM.drawWarmLightBloom = function drawWarmLightBloom(width, height, lights) {
    const ctx = EM.ctx;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const light of lights) {
      const x = light.x - EM.state.camera.x;
      const y = light.y - EM.state.camera.y;
      const r = Math.min(light.r, 260);

      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, "rgba(255, 178, 82, 0.16)");
      glow.addColorStop(0.35, "rgba(255, 121, 33, 0.07)");
      glow.addColorStop(1, "rgba(255, 121, 33, 0)");

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
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
