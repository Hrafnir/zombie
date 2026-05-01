(() => {
  "use strict";

  const EM = window.EM;

  /*
    combat.js
    Overstyrer kampdelen fra game.js uten å røre resten.

    Fikser:
    - større hitboxes for zombier basert på sprite-plassering
    - prosjektiler starter fra helten sin overkropp
    - nærkamp starter fra samme punkt
    - sikteindikator
    - grafisk angrepsindikator
  */

  const COMBAT = {
    playerAimOffsetY: -42,
    playerHitbox: {
      w: 42,
      h: 76,
      topOffset: -74,
    },
    zombieBaseHitbox: {
      w: 54,
      h: 86,
      topOffset: -82,
    },
    meleeArc: 0.88,
    projectileHitPadding: 4,
    aimLineAlpha: 0.34,
  };

  function now() {
    return performance.now() / 1000;
  }

  function ensureAttackEffects() {
    if (!Array.isArray(EM.state.attackEffects)) {
      EM.state.attackEffects = [];
    }

    return EM.state.attackEffects;
  }

  function addAttackEffect(effect) {
    ensureAttackEffects().push({
      created: now(),
      ttl: effect.ttl || 0.18,
      ...effect,
    });
  }

  function worldToScreen(x, y) {
    return {
      x: x - EM.state.camera.x,
      y: y - EM.state.camera.y,
    };
  }

  EM.getPlayerAimOrigin = function getPlayerAimOrigin() {
    const player = EM.state.player;

    return {
      x: player.x,
      y: player.y + COMBAT.playerAimOffsetY,
    };
  };

  EM.getPlayerHitbox = function getPlayerHitbox() {
    const player = EM.state.player;
    const w = COMBAT.playerHitbox.w;
    const h = COMBAT.playerHitbox.h;

    return {
      x: player.x - w / 2,
      y: player.y + COMBAT.playerHitbox.topOffset,
      w,
      h,
      cx: player.x,
      cy: player.y + COMBAT.playerHitbox.topOffset + h / 2,
    };
  };

  function zombieScale(zombie) {
    if (zombie.type === "brute") return 1.22;
    if (zombie.type === "runner") return 0.92;
    if (zombie.type === "spitter") return 1.04;
    return 1;
  }

  EM.getZombieHitbox = function getZombieHitbox(zombie) {
    const scale = zombieScale(zombie);
    const w = COMBAT.zombieBaseHitbox.w * scale;
    const h = COMBAT.zombieBaseHitbox.h * scale;

    return {
      x: zombie.x - w / 2,
      y: zombie.y + COMBAT.zombieBaseHitbox.topOffset * scale,
      w,
      h,
      cx: zombie.x,
      cy: zombie.y + COMBAT.zombieBaseHitbox.topOffset * scale + h / 2,
    };
  };

  function expandRect(rect, amount) {
    return {
      x: rect.x - amount,
      y: rect.y - amount,
      w: rect.w + amount * 2,
      h: rect.h + amount * 2,
    };
  }

  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function closestPointOnRect(px, py, rect) {
    return {
      x: EM.clamp(px, rect.x, rect.x + rect.w),
      y: EM.clamp(py, rect.y, rect.y + rect.h),
    };
  }

  function angleDiff(a, b) {
    return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  }

  function lineSegmentsIntersect(a, b, c, d) {
    const denominator =
      (d.y - c.y) * (b.x - a.x) -
      (d.x - c.x) * (b.y - a.y);

    if (denominator === 0) return false;

    const ua =
      ((d.x - c.x) * (a.y - c.y) -
        (d.y - c.y) * (a.x - c.x)) /
      denominator;

    const ub =
      ((b.x - a.x) * (a.y - c.y) -
        (b.y - a.y) * (a.x - c.x)) /
      denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  function lineIntersectsRect(a, b, rect) {
    if (pointInRect(a.x, a.y, rect) || pointInRect(b.x, b.y, rect)) {
      return true;
    }

    const topLeft = { x: rect.x, y: rect.y };
    const topRight = { x: rect.x + rect.w, y: rect.y };
    const bottomLeft = { x: rect.x, y: rect.y + rect.h };
    const bottomRight = { x: rect.x + rect.w, y: rect.y + rect.h };

    return (
      lineSegmentsIntersect(a, b, topLeft, topRight) ||
      lineSegmentsIntersect(a, b, topRight, bottomRight) ||
      lineSegmentsIntersect(a, b, bottomRight, bottomLeft) ||
      lineSegmentsIntersect(a, b, bottomLeft, topLeft)
    );
  }

  function meleeHitsRect(origin, angle, range, rect) {
    const end = {
      x: origin.x + Math.cos(angle) * range,
      y: origin.y + Math.sin(angle) * range,
    };

    const expanded = expandRect(rect, 8);

    if (lineIntersectsRect(origin, end, expanded)) {
      return true;
    }

    const closestToOrigin = closestPointOnRect(origin.x, origin.y, expanded);
    const distance = EM.dist(origin.x, origin.y, closestToOrigin.x, closestToOrigin.y);

    if (distance > range + 8) {
      return false;
    }

    const targetAngle = Math.atan2(closestToOrigin.y - origin.y, closestToOrigin.x - origin.x);
    return angleDiff(targetAngle, angle) < COMBAT.meleeArc;
  }

  function drawDebugHitboxes() {
    if (!EM.debugHitboxes) return;

    const ctx = EM.ctx;

    ctx.save();
    ctx.lineWidth = 2;

    for (const zombie of EM.state.zombies) {
      const rect = EM.getZombieHitbox(zombie);
      const p = worldToScreen(rect.x, rect.y);

      ctx.strokeStyle = "rgba(255,80,80,0.85)";
      ctx.strokeRect(p.x, p.y, rect.w, rect.h);
    }

    const playerRect = EM.getPlayerHitbox();
    const playerP = worldToScreen(playerRect.x, playerRect.y);

    ctx.strokeStyle = "rgba(90,180,255,0.85)";
    ctx.strokeRect(playerP.x, playerP.y, playerRect.w, playerRect.h);

    ctx.restore();
  }

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

    const origin = EM.getPlayerAimOrigin();
    const angle = Math.atan2(EM.mouse.wy - origin.y, EM.mouse.wx - origin.x);

    if (weapon.type === "projectile") {
      EM.state.projectiles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        damage: weapon.damage,
        life: weapon.range / weapon.speed,
        enemy: false,
        kind: "arrow",
      });

      addAttackEffect({
        type: "shotLine",
        x: origin.x,
        y: origin.y,
        angle,
        range: 110,
        color: "rgba(255,232,160,0.9)",
        ttl: 0.12,
      });

      EM.sfx?.("shootLight");
      return;
    }

    if (weapon.type === "spread") {
      for (let i = 0; i < weapon.pellets; i++) {
        const spreadAngle = angle + EM.rand(-0.26, 0.26);

        EM.state.projectiles.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(spreadAngle) * weapon.speed,
          vy: Math.sin(spreadAngle) * weapon.speed,
          damage: weapon.damage,
          life: weapon.range / weapon.speed,
          enemy: false,
          kind: "shot",
        });
      }

      addAttackEffect({
        type: "shotCone",
        x: origin.x,
        y: origin.y,
        angle,
        range: 150,
        spread: 0.36,
        color: "rgba(255,218,120,0.9)",
        ttl: 0.16,
      });

      EM.sfx?.("shootHeavy");
      return;
    }

    let hit = false;
    let bestZombie = null;
    let bestDistance = Infinity;

    for (const zombie of EM.state.zombies) {
      const rect = EM.getZombieHitbox(zombie);

      if (!meleeHitsRect(origin, angle, weapon.range + 18, rect)) {
        continue;
      }

      const distance = EM.dist(origin.x, origin.y, rect.cx, rect.cy);

      if (distance < bestDistance) {
        bestZombie = zombie;
        bestDistance = distance;
      }
    }

    addAttackEffect({
      type: "meleeArc",
      x: origin.x,
      y: origin.y,
      angle,
      range: weapon.range + 22,
      color: bestZombie ? "rgba(255,95,75,0.95)" : "rgba(255,230,150,0.72)",
      ttl: 0.16,
    });

    if (bestZombie) {
      EM.damageZombie(
        bestZombie,
        weapon.damage,
        Math.cos(angle) * 45,
        Math.sin(angle) * 45
      );

      EM.sfx?.("hitZombie");
      hit = true;
    } else {
      EM.sfx?.("melee");
    }

    if (!hit) {
      EM.hitNodeInArc(angle);
    }
  };

  EM.hitNodeInArc = function hitNodeInArc(angle) {
    const player = EM.state.player;
    const origin = EM.getPlayerAimOrigin();
    const weapon = EM.WEAPONS[player.weapon] || EM.WEAPONS.knife;
    const range = (weapon.range || 48) + 22;

    for (const node of EM.state.nodes) {
      if (node.depleted) continue;

      const nodeRadius = node.radius || 54;
      const nodeRect = {
        x: node.x - nodeRadius / 2,
        y: node.y - nodeRadius / 2,
        w: nodeRadius,
        h: nodeRadius,
        cx: node.x,
        cy: node.y,
      };

      if (meleeHitsRect(origin, angle, range, nodeRect)) {
        EM.harvest(node, true);

        if (node.type === "tree") EM.sfx?.("wood");
        else if (node.type === "rock" || node.type === "oreRock") EM.sfx?.("stone");
        else EM.sfx?.("pickup");

        addAttackEffect({
          type: "impact",
          x: node.x,
          y: node.y,
          color: "rgba(255,255,210,0.9)",
          ttl: 0.14,
        });

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
        const playerHitbox = expandRect(EM.getPlayerHitbox(), 5);

        if (pointInRect(projectile.x, projectile.y, playerHitbox)) {
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
        const hitbox = expandRect(EM.getZombieHitbox(zombie), COMBAT.projectileHitPadding);

        if (pointInRect(projectile.x, projectile.y, hitbox)) {
          EM.damageZombie(
            zombie,
            projectile.damage,
            projectile.vx * 0.035,
            projectile.vy * 0.035
          );

          addAttackEffect({
            type: "impact",
            x: projectile.x,
            y: projectile.y,
            color: "rgba(255,80,65,0.95)",
            ttl: 0.12,
          });

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

  function drawAimIndicator() {
    if (!EM.running || EM.paused || EM.selectedBuild) return;

    const ctx = EM.ctx;
    const player = EM.state.player;
    const weapon = EM.WEAPONS[player.weapon] || EM.WEAPONS.knife;
    const origin = EM.getPlayerAimOrigin();

    const angle = Math.atan2(EM.mouse.wy - origin.y, EM.mouse.wx - origin.x);
    const maxRange =
      weapon.type === "melee"
        ? weapon.range + 24
        : Math.min(weapon.range || 420, 520);

    const endWorld = {
      x: origin.x + Math.cos(angle) * maxRange,
      y: origin.y + Math.sin(angle) * maxRange,
    };

    const o = worldToScreen(origin.x, origin.y);
    const e = worldToScreen(endWorld.x, endWorld.y);

    ctx.save();

    ctx.lineWidth = weapon.type === "melee" ? 3 : 2;
    ctx.strokeStyle =
      weapon.type === "melee"
        ? `rgba(255,210,120,${COMBAT.aimLineAlpha})`
        : `rgba(180,230,255,${COMBAT.aimLineAlpha})`;

    ctx.setLineDash(weapon.type === "melee" ? [8, 7] : [12, 8]);

    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle =
      weapon.type === "melee"
        ? "rgba(255,210,120,0.55)"
        : "rgba(180,230,255,0.55)";

    ctx.beginPath();
    ctx.arc(e.x, e.y, weapon.type === "melee" ? 5 : 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(EM.mouse.x, EM.mouse.y, 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(EM.mouse.x - 13, EM.mouse.y);
    ctx.lineTo(EM.mouse.x - 5, EM.mouse.y);
    ctx.moveTo(EM.mouse.x + 5, EM.mouse.y);
    ctx.lineTo(EM.mouse.x + 13, EM.mouse.y);
    ctx.moveTo(EM.mouse.x, EM.mouse.y - 13);
    ctx.lineTo(EM.mouse.x, EM.mouse.y - 5);
    ctx.moveTo(EM.mouse.x, EM.mouse.y + 5);
    ctx.lineTo(EM.mouse.x, EM.mouse.y + 13);
    ctx.stroke();

    ctx.restore();
  }

  function drawAttackEffects() {
    const effects = ensureAttackEffects();
    const current = now();
    const ctx = EM.ctx;

    EM.state.attackEffects = effects.filter((effect) => current - effect.created < effect.ttl);

    for (const effect of EM.state.attackEffects) {
      const age = current - effect.created;
      const t = EM.clamp(age / effect.ttl, 0, 1);
      const alpha = 1 - t;

      if (effect.type === "meleeArc") {
        const o = worldToScreen(effect.x, effect.y);
        const radius = effect.range;
        const start = effect.angle - 0.62;
        const end = effect.angle + 0.62;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.color;
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.arc(o.x, o.y, radius, start, end);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = alpha * 0.9;
        ctx.beginPath();
        ctx.arc(o.x, o.y, radius, start, end);
        ctx.stroke();

        ctx.restore();
      }

      if (effect.type === "shotLine") {
        const o = worldToScreen(effect.x, effect.y);
        const e = {
          x: o.x + Math.cos(effect.angle) * effect.range,
          y: o.y + Math.sin(effect.angle) * effect.range,
        };

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();

        ctx.restore();
      }

      if (effect.type === "shotCone") {
        const o = worldToScreen(effect.x, effect.y);
        const left = effect.angle - effect.spread;
        const right = effect.angle + effect.spread;

        const l = {
          x: o.x + Math.cos(left) * effect.range,
          y: o.y + Math.sin(left) * effect.range,
        };

        const r = {
          x: o.x + Math.cos(right) * effect.range,
          y: o.y + Math.sin(right) * effect.range,
        };

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.color;

        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(l.x, l.y);
        ctx.lineTo(r.x, r.y);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }

      if (effect.type === "impact") {
        const p = worldToScreen(effect.x, effect.y);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 + t * 18, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  const baseDraw = EM.draw;

  EM.draw = function drawWithCombatOverlay() {
    baseDraw();

    drawAimIndicator();
    drawAttackEffects();
    drawDebugHitboxes();
  };

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "k") {
      EM.debugHitboxes = !EM.debugHitboxes;
      EM.toast?.(EM.debugHitboxes ? "Hitboxes på." : "Hitboxes av.");
    }
  });
})();
