(() => {
  "use strict";

  const EM = window.EM;

  const BALANCE = {
    hungerDrain: 0.075,
    thirstDrain: 0.105,
    starvationDamage: 0.85,
    healthyRegen: 0.22,
    staminaWalkRegen: 12,
    staminaIdleRegen: 18,
    staminaSprintDrain: 18,
    maxNewZombiesPerDay: 9,
  };

  EM.resetWorld = function resetWorld() {
    EM.state = EM.createDefaultState();

    EM.selectedBuild = null;
    EM.selectedBuildRecipe = null;
    EM.selectedBuildRotation = 0;
    EM.panelMode = null;
    EM.selectedStationBuilding = null;

    EM.generateWorld();

    for (let i = 0; i < 36; i++) {
      EM.spawnZombie(true);
    }

    EM.renderHotbar();
    EM.renderObjectives();
    EM.renderLog();
  };

  EM.start = function start(tryLoad) {
    if (!tryLoad || !EM.loadGame()) {
      EM.resetWorld();
    } else {
      EM.renderHotbar();
      EM.renderObjectives();
      EM.renderLog();
    }

    EM.dom.titleScreen.classList.remove("screen--active");
    EM.dom.helpScreen.classList.remove("screen--active");
    EM.dom.pauseScreen.classList.remove("screen--active");
    EM.dom.gameOverScreen.classList.remove("screen--active");
    EM.dom.hud.classList.remove("hidden");

    EM.running = true;
    EM.paused = false;
    EM.lastTime = performance.now();

    EM.toast("Finn vann, lag hakke og bygg før natten.");
    EM.sfx?.("start");

    requestAnimationFrame(EM.loop);
  };

  EM.togglePause = function togglePause(force) {
    EM.paused = typeof force === "boolean" ? force : !EM.paused;
    EM.dom.pauseScreen.classList.toggle("screen--active", EM.paused);

    EM.sfx?.(EM.paused ? "pause" : "resume");

    if (EM.paused) EM.saveGame();
  };

  EM.advanceDay = function advanceDay() {
    EM.state.day++;

    const targetZombieCount = Math.min(110, 36 + EM.state.day * 7);
    const needed = Math.max(0, targetZombieCount - EM.state.zombies.length);
    const spawnCount = Math.min(BALANCE.maxNewZombiesPerDay, needed);

    for (let i = 0; i < spawnCount; i++) {
      EM.spawnZombie(true);
    }

    EM.toast(`Dag ${EM.state.day}. Flere zombier samles.`);
    EM.sfx?.("newDay");
  };

  EM.update = function update(dt) {
    const player = EM.state.player;

    player.attackCd = Math.max(0, player.attackCd - dt);
    player.interactCd = Math.max(0, player.interactCd - dt);
    player.iframe = Math.max(0, player.iframe - dt);
    player.noise = Math.max(0, player.noise - dt * 240);

    EM.state.time += dt * (24 * 60 / EM.state.dayLength);

    while (EM.state.time >= 1440) {
      EM.state.time -= 1440;
      EM.advanceDay();
    }

    EM.updatePlayer(dt);
    EM.updateNodes(dt);
    EM.updateBuildings(dt);
    EM.updateProjectiles(dt);
    EM.updateZombies(dt);
    EM.updateDrops(dt);
    EM.updateParticles(dt);
    EM.autoPickup();
    EM.updateHud();

    if (player.hp <= 0) EM.gameOver();
  };

  EM.updatePlayer = function updatePlayer(dt) {
    const player = EM.state.player;

    const inputX =
      (EM.isDown("d", "arrowright") ? 1 : 0) -
      (EM.isDown("a", "arrowleft") ? 1 : 0);

    const inputY =
      (EM.isDown("s", "arrowdown") ? 1 : 0) -
      (EM.isDown("w", "arrowup") ? 1 : 0);

    const length = Math.hypot(inputX, inputY) || 1;
    const moving = Boolean(inputX || inputY);
    const sprinting = EM.isDown("shift") && player.stamina > 4 && moving;
    const speed = 148 * (sprinting ? 1.62 : 1);

    EM.movePlayer(
      player.x + (inputX / length) * speed * dt,
      player.y + (inputY / length) * speed * dt
    );

    if (moving) {
      player.frame += dt * (sprinting ? 12 : 7);
      player.noise = Math.max(player.noise, sprinting ? 155 : 72);

      player.stamina = EM.clamp(
        player.stamina + (sprinting ? -BALANCE.staminaSprintDrain : BALANCE.staminaWalkRegen) * dt,
        0,
        100
      );
    } else {
      player.stamina = EM.clamp(player.stamina + BALANCE.staminaIdleRegen * dt, 0, 100);
    }

    player.hunger = EM.clamp(player.hunger - dt * BALANCE.hungerDrain, 0, 100);
    player.thirst = EM.clamp(player.thirst - dt * BALANCE.thirstDrain, 0, 100);

    if (player.hunger <= 0 || player.thirst <= 0) {
      player.hp = EM.clamp(player.hp - dt * BALANCE.starvationDamage, 0, 100);
    }

    if (player.hunger > 72 && player.thirst > 72) {
      player.hp = EM.clamp(player.hp + dt * BALANCE.healthyRegen, 0, 100);
    }
  };

  EM.movePlayer = function movePlayer(nextX, nextY) {
    const player = EM.state.player;
    const oldX = player.x;
    const oldY = player.y;

    player.x = EM.clamp(nextX, 20, EM.state.worldW - 20);
    player.y = EM.clamp(nextY, 20, EM.state.worldH - 20);

    for (const building of EM.state.buildings) {
      const def = EM.BUILDINGS[building.type];
      if (!def?.solid) continue;

      const size = EM.buildingSize(building.type, building.rotation || 0);

      if (
        EM.rectCircleCollision(
          building.x,
          building.y,
          size.w,
          size.h,
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
  };

  EM.attack = function attack() {
    const player = EM.state.player;
    const weapon = EM.WEAPONS[player.weapon] || EM.WEAPONS.knife;

    if (player.attackCd > 0) return;

    if (weapon.ammo && !EM.removeItem(weapon.ammo, 1)) {
      EM.toast(`Mangler ${EM.itemName(weapon.ammo)}.`);
      EM.sfx?.("empty");
      return;
    }

    player.attackCd = weapon.cooldown;
    player.stamina = EM.clamp(player.stamina - (weapon.stamina || 0), 0, 100);
    player.noise = Math.max(player.noise, weapon.noise);

    EM.sfx?.(
      weapon.type === "projectile"
        ? "shootLight"
        : weapon.type === "spread"
          ? "shootHeavy"
          : "melee"
    );

    const angle = Math.atan2(EM.mouse.wy - player.y, EM.mouse.wx - player.x);

    if (weapon.type === "projectile") {
      EM.state.projectiles.push({
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
        const spreadAngle = angle + EM.rand(-0.26, 0.26);

        EM.state.projectiles.push({
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

    for (const zombie of EM.state.zombies) {
      const distance = EM.dist(player.x, player.y, zombie.x, zombie.y);
      const zombieAngle = Math.atan2(zombie.y - player.y, zombie.x - player.x);
      const deltaAngle = Math.abs(
        Math.atan2(Math.sin(zombieAngle - angle), Math.cos(zombieAngle - angle))
      );

      if (distance < weapon.range + zombie.radius && deltaAngle < 1.05) {
        EM.damageZombie(
          zombie,
          weapon.damage,
          Math.cos(angle) * 45,
          Math.sin(angle) * 45
        );

        EM.sfx?.("hitZombie");
        hit = true;
        break;
      }
    }

    if (!hit) EM.hitNodeInArc(angle);
  };

  EM.hitNodeInArc = function hitNodeInArc(angle) {
    const player = EM.state.player;

    for (const node of EM.state.nodes) {
      if (node.depleted) continue;

      const distance = EM.dist(player.x, player.y, node.x, node.y);
      const nodeAngle = Math.atan2(node.y - player.y, node.x - player.x);
      const deltaAngle = Math.abs(
        Math.atan2(Math.sin(nodeAngle - angle), Math.cos(nodeAngle - angle))
      );

      if (distance < 58 && deltaAngle < 0.9) {
        EM.harvest(node, true);

        if (node.type === "tree") EM.sfx?.("wood");
        else if (node.type === "rock" || node.type === "oreRock") EM.sfx?.("stone");
        else EM.sfx?.("pickup");

        return;
      }
    }
  };

  EM.updateProjectiles = function updateProjectiles(dt) {
    for (const projectile of EM.state.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;

      if (projectile.enemy) {
        if (
          EM.dist(projectile.x, projectile.y, EM.state.player.x, EM.state.player.y) <
          EM.state.player.r + 6
        ) {
          if (EM.state.player.iframe <= 0) {
            EM.state.player.hp -= projectile.damage;
            EM.state.player.iframe = 0.35;
            EM.hitEffect();
            EM.sfx?.("hurt");
          }

          projectile.life = -1;
        }

        continue;
      }

      for (const zombie of EM.state.zombies) {
        if (EM.dist(projectile.x, projectile.y, zombie.x, zombie.y) < zombie.radius + 5) {
          EM.damageZombie(zombie, projectile.damage, projectile.vx * 0.035, projectile.vy * 0.035);
          EM.sfx?.("hitZombie");
          projectile.life = -1;
          break;
        }
      }
    }

    EM.state.projectiles = EM.state.projectiles.filter((p) => {
      return (
        p.life > 0 &&
        p.x > 0 &&
        p.y > 0 &&
        p.x < EM.state.worldW &&
        p.y < EM.state.worldH
      );
    });
  };

  EM.interact = function interact() {
    const player = EM.state.player;

    if (player.interactCd > 0) return;
    player.interactCd = 0.25;

    const drop = EM.nearestDrop();

    if (drop) {
      EM.collectDrop(drop);
      EM.sfx?.("pickup");
      return;
    }

    const building = EM.nearestBuilding(player.x, player.y, 72);

    if (building) {
      EM.useBuilding(building);
      EM.sfx?.("click");
      return;
    }

    const node = EM.nearestNode();

    if (node) {
      EM.harvest(node, false);

      if (node.type === "tree") EM.sfx?.("wood");
      else if (node.type === "rock" || node.type === "oreRock") EM.sfx?.("stone");
      else if (node.type === "puddle") EM.sfx?.("water");
      else EM.sfx?.("pickup");

      return;
    }

    EM.toast("Ingenting å bruke her.");
    EM.sfx?.("empty");
  };

  EM.dodge = function dodge() {
    const player = EM.state.player;

    if (player.stamina < 20) {
      EM.sfx?.("empty");
      return;
    }

    const angle = Math.atan2(EM.mouse.wy - player.y, EM.mouse.wx - player.x);

    EM.movePlayer(
      player.x - Math.cos(angle) * 60,
      player.y - Math.sin(angle) * 60
    );

    player.stamina -= 20;
    player.iframe = 0.25;
    EM.sfx?.("dodge");
  };

  EM.selectWeapon = function selectWeapon(index) {
    const list = [...EM.state.weapons];

    if (list[index]) {
      EM.state.player.weapon = list[index];
      EM.renderHotbar();
      EM.toast(`Valgt: ${EM.WEAPONS[list[index]].name}`);
      EM.sfx?.("click");
    }
  };

  EM.gameOver = function gameOver() {
    EM.running = false;
    EM.dom.hud.classList.add("hidden");
    EM.$("gameOverStats").textContent = `Du overlevde til dag ${EM.state.day}.`;
    EM.dom.gameOverScreen.classList.add("screen--active");
    EM.sfx?.("gameOver");
  };

  EM.loop = function loop(time) {
    const dt = Math.min(0.05, (time - EM.lastTime) / 1000 || 0);
    EM.lastTime = time;

    try {
      if (EM.running && !EM.paused) {
        EM.update(dt);
      }

      EM.draw();
    } catch (error) {
      console.error("Spillet stoppet av en JavaScript-feil:", error);

      EM.running = false;
      EM.paused = true;

      EM.toast?.("Spillet stoppet av en feil. Åpne Console og send feilmeldingen.");
    }

    EM.pressed.clear();
    EM.mouse.clicked = false;

    if (EM.running) requestAnimationFrame(EM.loop);
  };

  function bindButtons() {
    EM.$("startBtn").addEventListener("click", () => EM.start(false));
    EM.$("continueBtn").addEventListener("click", () => EM.start(true));
    EM.$("howToBtn").addEventListener("click", () => {
      EM.dom.helpScreen.classList.add("screen--active");
      EM.sfx?.("click");
    });

    EM.$("closeHelpBtn").addEventListener("click", () => {
      EM.dom.helpScreen.classList.remove("screen--active");
      EM.sfx?.("click");
    });

    EM.$("resumeBtn").addEventListener("click", () => EM.togglePause(false));
    EM.$("saveBtn").addEventListener("click", EM.saveGame);

    EM.$("newGameBtn").addEventListener("click", () => {
      EM.clearSave();
      EM.resetWorld();
      EM.togglePause(false);
      EM.sfx?.("start");
    });

    EM.$("restartBtn").addEventListener("click", () => {
      EM.dom.gameOverScreen.classList.remove("screen--active");
      EM.resetWorld();
      EM.running = true;
      EM.paused = false;
      EM.dom.hud.classList.remove("hidden");
      EM.sfx?.("start");
      requestAnimationFrame(EM.loop);
    });

    EM.$("backToTitleBtn").addEventListener("click", () => {
      EM.dom.gameOverScreen.classList.remove("screen--active");
      EM.dom.titleScreen.classList.add("screen--active");
      EM.dom.hud.classList.add("hidden");
      EM.running = false;
      EM.sfx?.("click");
    });

    EM.$("closePanelBtn").addEventListener("click", () => {
      EM.closePanel();
      EM.sfx?.("click");
    });
  }

  EM.boot = function boot() {
    bindButtons();

    EM.ctx.fillStyle = "#10191d";
    EM.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  };

  EM.boot();
})();
