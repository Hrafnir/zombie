(() => {
  "use strict";

  const EM = window.EM;

  EM.nodeDef = function nodeDef(type) {
    return EM.NODE_DEFS[type];
  };

  EM.generateWorld = function generateWorld() {
    function addNode(type, x, y) {
      const def = EM.nodeDef(type);

      EM.state.nodes.push({
        id: EM.uid(),
        type,
        x,
        y,
        hp: def.hp,
        maxHp: def.hp,
        depleted: false,
        cooldown: 0,
        rotation: EM.rand(-0.2, 0.2),
      });
    }

    function place(type, count, minSpawnDistance = 360) {
      for (let i = 0; i < count; i++) {
        let x;
        let y;
        let tries = 0;

        do {
          x = EM.rand(80, EM.state.worldW - 80);
          y = EM.rand(80, EM.state.worldH - 80);
          tries++;
        } while (
          EM.dist(x, y, EM.state.player.x, EM.state.player.y) < minSpawnDistance &&
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
      addNode(type, EM.state.player.x + dx, EM.state.player.y + dy);
    }
  };

  EM.updateNodes = function updateNodes(dt) {
    for (const node of EM.state.nodes) {
      if (!node.depleted) continue;

      node.cooldown -= dt;

      if (node.cooldown <= 0) {
        node.depleted = false;
        node.hp = node.maxHp;
      }
    }
  };

  EM.nearestNode = function nearestNode() {
    let best = null;
    let bestDistance = 68;

    for (const node of EM.state.nodes) {
      if (node.depleted) continue;

      const distance = EM.dist(EM.state.player.x, EM.state.player.y, node.x, node.y);
      if (distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }

    return best;
  };

  EM.bestToolFor = function bestToolFor(nodeType) {
    if (nodeType === "tree" && EM.state.weapons.has("axe")) return "axe";
    if ((nodeType === "rock" || nodeType === "oreRock") && EM.state.weapons.has("pickaxe")) {
      return "pickaxe";
    }

    return EM.state.player.weapon;
  };

  EM.harvest = function harvest(node, fromAttack = false) {
    const def = EM.nodeDef(node.type);

    if (def.needs && !EM.state.weapons.has(def.needs)) {
      EM.toast(`${def.name} krever ${EM.itemName(def.needs)}.`);
      return;
    }

    if (node.type === "puddle") {
      const amount = EM.state.inv.canteen ? EM.randi(3, 5) : EM.randi(1, 2);
      EM.addItem("dirtyWater", amount);
      node.depleted = true;
      node.cooldown = 55;
      EM.toast(`Samlet skittent vann ×${amount}.`);
      EM.refreshPanel();
      return;
    }

    const tool = EM.bestToolFor(node.type);
    const goodTool =
      (node.type === "tree" && tool === "axe") ||
      ((node.type === "rock" || node.type === "oreRock") && tool === "pickaxe");

    node.hp -= goodTool ? 2 : 1;
    EM.state.player.noise = Math.max(
      EM.state.player.noise,
      def.noise + (goodTool ? -30 : 20)
    );

    if (!fromAttack) {
      EM.state.player.stamina = EM.clamp(EM.state.player.stamina - 6, 0, 100);
    }

    EM.particle(node.x, node.y, def.color, 6);

    if (node.hp <= 0) {
      node.depleted = true;
      node.cooldown = node.type === "tree" ? 95 : 140;
      node.hp = node.maxHp;

      const loot = EM.nodeLoot(node.type, goodTool);
      EM.giveLoot(loot, node.x, node.y);

      EM.toast(`${def.name} samlet.`);
      EM.refreshPanel();
    }
  };

  EM.nodeLoot = function nodeLoot(type, goodTool) {
    if (type === "tree") return { wood: goodTool ? [5, 9] : [2, 5] };

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
  };

  EM.giveLoot = function giveLoot(table, x, y) {
    for (const [id, range] of Object.entries(table)) {
      const amount = Array.isArray(range) ? EM.randi(range[0], range[1]) : range;

      if (amount > 0) {
        EM.state.drops.push({
          id,
          amount,
          x: x + EM.rand(-14, 14),
          y: y + EM.rand(-14, 14),
          vx: EM.rand(-30, 30),
          vy: EM.rand(-30, 30),
        });
      }
    }
  };

  EM.nearestDrop = function nearestDrop() {
    let best = null;
    let bestDistance = 42;

    for (const drop of EM.state.drops) {
      const distance = EM.dist(EM.state.player.x, EM.state.player.y, drop.x, drop.y);
      if (distance < bestDistance) {
        best = drop;
        bestDistance = distance;
      }
    }

    return best;
  };

  EM.collectDrop = function collectDrop(drop) {
    EM.addItem(drop.id, drop.amount);
    EM.state.drops = EM.state.drops.filter((d) => d !== drop);
    EM.toast(`Plukket opp ${EM.itemName(drop.id)} ×${drop.amount}`);
    EM.refreshPanel();
  };

  EM.autoPickup = function autoPickup() {
    for (const drop of [...EM.state.drops]) {
      if (EM.dist(EM.state.player.x, EM.state.player.y, drop.x, drop.y) < 22) {
        EM.collectDrop(drop);
      }
    }
  };

  EM.updateDrops = function updateDrops(dt) {
    for (const drop of EM.state.drops) {
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vx *= Math.pow(0.05, dt);
      drop.vy *= Math.pow(0.05, dt);
    }
  };

  EM.particle = function particle(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      EM.state.particles.push({
        x,
        y,
        vx: EM.rand(-60, 60),
        vy: EM.rand(-60, 60),
        life: EM.rand(0.2, 0.65),
        color,
      });
    }
  };

  EM.updateParticles = function updateParticles(dt) {
    for (const p of EM.state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }

    EM.state.particles = EM.state.particles.filter((p) => p.life > 0);
  };
})();
