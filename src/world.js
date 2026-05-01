(() => {
  "use strict";

  const EM = window.EM;

  EM.nodeDef = function nodeDef(type) {
    return EM.NODE_DEFS[type];
  };

  function nodeSpacing(type) {
    switch (type) {
      case "tree":
        return 150;
      case "rock":
        return 125;
      case "oreRock":
        return 145;
      case "puddle":
        return 170;
      case "bush":
        return 120;
      case "scrapPile":
        return 145;
      default:
        return 120;
    }
  }

  function nodePlayerDistance(type) {
    switch (type) {
      case "tree":
        return 260;
      case "rock":
        return 240;
      case "oreRock":
        return 300;
      case "puddle":
        return 250;
      case "bush":
        return 220;
      case "scrapPile":
        return 260;
      default:
        return 240;
    }
  }

  function nodeRadius(type) {
    switch (type) {
      case "tree":
        return 72;
      case "rock":
        return 56;
      case "oreRock":
        return 60;
      case "puddle":
        return 58;
      case "bush":
        return 52;
      case "scrapPile":
        return 60;
      default:
        return 56;
    }
  }

  function canPlaceNode(type, x, y) {
    const player = EM.state.player;

    if (x < 120 || y < 120 || x > EM.state.worldW - 120 || y > EM.state.worldH - 120) {
      return false;
    }

    if (EM.dist(x, y, player.x, player.y) < nodePlayerDistance(type)) {
      return false;
    }

    for (const node of EM.state.nodes) {
      const minDistance = Math.max(nodeSpacing(type), nodeSpacing(node.type));

      if (EM.dist(x, y, node.x, node.y) < minDistance) {
        return false;
      }
    }

    return true;
  }

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
        rotation: EM.rand(-0.08, 0.08),
        radius: nodeRadius(type),
      });
    }

    function scatter(type, count, triesPerNode = 40) {
      let placed = 0;
      let tries = 0;
      const maxTries = count * triesPerNode;

      while (placed < count && tries < maxTries) {
        const x = EM.rand(120, EM.state.worldW - 120);
        const y = EM.rand(120, EM.state.worldH - 120);

        if (canPlaceNode(type, x, y)) {
          addNode(type, x, y);
          placed++;
        }

        tries++;
      }
    }

    // Litt færre noder enn før, men mye bedre fordelt
    scatter("tree", 165);
    scatter("rock", 62);
    scatter("oreRock", 42);
    scatter("puddle", 24);
    scatter("bush", 42);
    scatter("scrapPile", 34);

    // Litt ryddig startområde rundt spilleren
    const starterRing = [
      ["tree", -300, -120],
      ["tree", 280, -170],
      ["tree", -250, 190],
      ["rock", 220, 140],
      ["rock", -180, -240],
      ["bush", 60, -260],
      ["puddle", 300, 40],
      ["scrapPile", -320, 80],
      ["oreRock", 360, 240],
    ];

    for (const [type, dx, dy] of starterRing) {
      const x = EM.clamp(EM.state.player.x + dx, 140, EM.state.worldW - 140);
      const y = EM.clamp(EM.state.player.y + dy, 140, EM.state.worldH - 140);

      let ok = true;

      for (const node of EM.state.nodes) {
        const minDistance = Math.max(nodeSpacing(type), nodeSpacing(node.type)) * 0.9;
        if (EM.dist(x, y, node.x, node.y) < minDistance) {
          ok = false;
          break;
        }
      }

      if (ok) addNode(type, x, y);
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
    let bestDistance = 82;

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
          x: x + EM.rand(-16, 16),
          y: y + EM.rand(-16, 16),
          vx: EM.rand(-28, 28),
          vy: EM.rand(-28, 28),
        });
      }
    }
  };

  EM.nearestDrop = function nearestDrop() {
    let best = null;
    let bestDistance = 46;

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
      if (EM.dist(EM.state.player.x, EM.state.player.y, drop.x, drop.y) < 26) {
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
