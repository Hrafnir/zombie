(() => {
  "use strict";

  const EM = window.EM;

  EM.zombieDef = function zombieDef(type) {
    return EM.ZOMBIE_DEFS[type];
  };

  EM.spawnZombie = function spawnZombie(farFromPlayer = false) {
    let x;
    let y;
    let tries = 0;

    do {
      x = EM.rand(80, EM.state.worldW - 80);
      y = EM.rand(80, EM.state.worldH - 80);
      tries++;
    } while (
      farFromPlayer &&
      EM.dist(x, y, EM.state.player.x, EM.state.player.y) < 720 &&
      tries < 60
    );

    const roll = Math.random();
    const type =
      roll < 0.72 ? "walker" :
      roll < 0.90 ? "runner" :
      roll < 0.97 ? "spitter" :
      "brute";

    const def = EM.zombieDef(type);

    EM.state.zombies.push({
      id: EM.uid(),
      type,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      state: "wander",
      targetX: x + EM.rand(-220, 220),
      targetY: y + EM.rand(-220, 220),
      attackTimer: EM.rand(0, 1),
      spitTimer: EM.rand(1, 4),
      frame: 0,
    });
  };

  EM.damageZombie = function damageZombie(zombie, amount, knockX = 0, knockY = 0) {
    zombie.hp -= amount;
    zombie.x += knockX;
    zombie.y += knockY;
    zombie.state = "chase";

    EM.particle(zombie.x, zombie.y, EM.zombieDef(zombie.type).color, 8);

    if (zombie.hp <= 0) {
      EM.state.zombies = EM.state.zombies.filter((z) => z !== zombie);

      const loot =
        zombie.type === "brute"
          ? { scrap: [1, 4], parts: [0, 2] }
          : { cloth: [0, 2], food: [0, 1], scrap: [0, 1] };

      EM.giveLoot(loot, zombie.x, zombie.y);
      setTimeout(() => EM.spawnZombie(true), EM.randi(1200, 5000));
    }
  };

  EM.nearestBlockingBuildingBetween = function nearestBlockingBuildingBetween(zombie, player) {
    let best = null;
    let bestScore = Infinity;

    for (const building of EM.state.buildings) {
      const def = EM.BUILDINGS[building.type];
      if (!def.solid && !def.trap) continue;

      const dToZombie = EM.dist(zombie.x, zombie.y, building.x, building.y);
      const dToPlayer = EM.dist(player.x, player.y, building.x, building.y);

      if (dToZombie > 140) continue;
      if (dToPlayer > EM.dist(zombie.x, zombie.y, player.x, player.y)) continue;

      const score = dToZombie + dToPlayer * 0.25;

      if (score < bestScore) {
        best = building;
        bestScore = score;
      }
    }

    return best;
  };

  EM.updateZombies = function updateZombies(dt) {
    const player = EM.state.player;

    for (const zombie of [...EM.state.zombies]) {
      const def = EM.zombieDef(zombie.type);
      const distanceToPlayer = EM.dist(player.x, player.y, zombie.x, zombie.y);

      const lightEffect = EM.nearestLight(zombie.x, zombie.y);
      let speed = def.speed;

      if (lightEffect && zombie.type !== "brute" && zombie.type !== "spitter") {
        speed *= lightEffect.insideCore ? 0.45 : 0.72;
      }

      const aggro =
        def.sense +
        (EM.isNight() ? 95 : 0) +
        Math.min(180, player.noise);

      if (distanceToPlayer < aggro) {
        zombie.state = "chase";
      } else if (distanceToPlayer > aggro * 1.75 && zombie.state === "chase") {
        zombie.state = "wander";
      }

      let targetX = zombie.targetX;
      let targetY = zombie.targetY;

      if (zombie.state === "chase") {
        targetX = player.x;
        targetY = player.y;

        const blocking = EM.nearestBlockingBuildingBetween(zombie, player);
        if (blocking) {
          targetX = blocking.x;
          targetY = blocking.y;
        }

        if (EM.isNight()) speed *= 1.1;
      } else if (
        EM.dist(zombie.x, zombie.y, zombie.targetX, zombie.targetY) < 25 ||
        Math.random() < dt * 0.04
      ) {
        zombie.targetX = EM.clamp(zombie.x + EM.rand(-260, 260), 40, EM.state.worldW - 40);
        zombie.targetY = EM.clamp(zombie.y + EM.rand(-260, 260), 40, EM.state.worldH - 40);
      }

      if (lightEffect && zombie.state !== "chase" && zombie.type === "walker") {
        targetX = zombie.x + (zombie.x - lightEffect.x);
        targetY = zombie.y + (zombie.y - lightEffect.y);
      }

      const angle = Math.atan2(targetY - zombie.y, targetX - zombie.x);

      zombie.x += Math.cos(angle) * speed * dt;
      zombie.y += Math.sin(angle) * speed * dt;
      zombie.frame += dt * 7;
      zombie.attackTimer -= dt;
      zombie.spitTimer -= dt;

      const blockingBuilding = EM.nearestBuilding(
        zombie.x,
        zombie.y,
        48,
        (b) => EM.BUILDINGS[b.type].solid || EM.BUILDINGS[b.type].trap || EM.BUILDINGS[b.type].station
      );

      if (blockingBuilding && zombie.attackTimer <= 0) {
        blockingBuilding.hp -= def.damage * (zombie.type === "brute" ? 1.35 : 0.8);
        zombie.attackTimer = 0.8;

        EM.particle(blockingBuilding.x, blockingBuilding.y, "#d6b47a", 4);

        if (EM.BUILDINGS[blockingBuilding.type].trap) {
          EM.damageZombie(zombie, 26);
          blockingBuilding.hp -= 18;
        }
      }

      if (
        zombie.type === "spitter" &&
        zombie.state === "chase" &&
        distanceToPlayer < 320 &&
        zombie.spitTimer <= 0
      ) {
        const spitAngle = Math.atan2(player.y - zombie.y, player.x - zombie.x);

        EM.state.projectiles.push({
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

      if (distanceToPlayer < zombie.radius + player.r + 7 && zombie.attackTimer <= 0) {
        if (player.iframe <= 0) {
          player.hp = EM.clamp(player.hp - def.damage, 0, 100);
          player.iframe = 0.45;
          EM.hitEffect();
        }

        zombie.attackTimer = def.attackCooldown;
      }
    }
  };
})();
