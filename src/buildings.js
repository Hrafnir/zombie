(() => {
  "use strict";

  const EM = window.EM;

  /*
    buildings.js
    Ansvar:
    - plassering av bygg
    - rotasjon/footprint
    - reparasjon
    - riving/refund
    - stasjoner
    - regnsamler
    - lysregistrering
    - byggevalidering

    Denne fila er kompatibel med resten av refaktoreringen:
    core.js, data.js, state.js, world.js, crafting.js, enemies.js, ui.js, render.js, input.js, game.js
  */

  EM.buildingSize = function buildingSize(type, rotation = 0) {
    const def = EM.BUILDINGS[type];
    if (!def) return { w: 0, h: 0 };

    const quarterTurn = Math.abs(Math.round(rotation / (Math.PI / 2))) % 2 === 1;

    if (quarterTurn) {
      return { w: def.h, h: def.w };
    }

    return { w: def.w, h: def.h };
  };

  EM.getBuildRecipe = function getBuildRecipe(type) {
    if (EM.selectedBuildRecipe) {
      const selectedRecipe = EM.RECIPES.find((recipe) => {
        return recipe.id === EM.selectedBuildRecipe && recipe.build === type;
      });

      if (selectedRecipe) return selectedRecipe;
    }

    return EM.RECIPES.find((recipe) => recipe.build === type);
  };

  EM.getBuildPlacementPoint = function getBuildPlacementPoint() {
    return {
      x: EM.snap(EM.mouse.wx, 16),
      y: EM.snap(EM.mouse.wy, 16),
    };
  };

  EM.nearestBuilding = function nearestBuilding(x, y, radius, predicate = () => true) {
    let best = null;
    let bestDistance = radius;

    for (const building of EM.state.buildings) {
      if (!predicate(building)) continue;

      const distance = EM.dist(x, y, building.x, building.y);

      if (distance < bestDistance) {
        best = building;
        bestDistance = distance;
      }
    }

    return best;
  };

  EM.stationNear = function stationNear(station) {
    if (!station) return true;

    return Boolean(
      EM.nearestBuilding(EM.state.player.x, EM.state.player.y, 120, (building) => {
        return building.type === station;
      })
    );
  };

  function placementPadding(type, otherType) {
    const isWall = type.includes("Wall");
    const otherIsWall = otherType.includes("Wall");

    if (isWall && otherIsWall) return 0;
    if (isWall || otherIsWall) return 4;
    return 10;
  }

  function isTooCloseToPlayer(type, x, y) {
    const size = EM.buildingSize(type, EM.selectedBuildRotation);
    const p = EM.state.player;

    return EM.rectCircleCollision(x, y, size.w, size.h, p.x, p.y, p.r + 10);
  }

  function isTooCloseToZombie(type, x, y) {
    const size = EM.buildingSize(type, EM.selectedBuildRotation);

    return EM.state.zombies.some((zombie) => {
      return EM.rectCircleCollision(x, y, size.w, size.h, zombie.x, zombie.y, zombie.radius + 4);
    });
  }

  function nodeBlockingRadius(type) {
    if (type.includes("Wall")) return 34;
    if (type === "torch") return 24;
    if (type === "spikes") return 36;
    return 54;
  }

  EM.canPlaceBuildingAt = function canPlaceBuildingAt(type, x, y) {
    const def = EM.BUILDINGS[type];
    const size = EM.buildingSize(type, EM.selectedBuildRotation);

    if (!def) {
      return {
        ok: false,
        reason: "Ukjent bygg.",
      };
    }

    if (x < 30 || y < 30 || x > EM.state.worldW - 30 || y > EM.state.worldH - 30) {
      return {
        ok: false,
        reason: "Kan ikke bygge utenfor kartet.",
      };
    }

    if (isTooCloseToPlayer(type, x, y)) {
      return {
        ok: false,
        reason: "Du står i veien.",
      };
    }

    if (isTooCloseToZombie(type, x, y)) {
      return {
        ok: false,
        reason: "For nær en zombie.",
      };
    }

    for (const building of EM.state.buildings) {
      const other = EM.buildingSize(building.type, building.rotation || 0);
      const pad = placementPadding(type, building.type);

      if (
        EM.rectRectOverlap(
          x,
          y,
          size.w,
          size.h,
          building.x,
          building.y,
          other.w,
          other.h,
          pad
        )
      ) {
        return {
          ok: false,
          reason: `For nær ${EM.BUILDINGS[building.type].name.toLowerCase()}.`,
        };
      }
    }

    const radius = nodeBlockingRadius(type);

    for (const node of EM.state.nodes) {
      if (!node.depleted && EM.dist(x, y, node.x, node.y) < radius) {
        return {
          ok: false,
          reason: "Rydd området først.",
        };
      }
    }

    return {
      ok: true,
      reason: "Kan bygges her.",
    };
  };

  EM.placeBuilding = function placeBuilding(type, x, y) {
    const def = EM.BUILDINGS[type];
    const recipe = EM.getBuildRecipe(type);
    const size = EM.buildingSize(type, EM.selectedBuildRotation);

    if (!def || !recipe) return;

    if (!EM.stationNear(recipe.station)) {
      EM.toast(`Du må stå ved ${EM.stationName(recipe.station)}.`);
      return;
    }

    if (!EM.canPay(recipe.cost)) {
      EM.toast(`Mangler: ${EM.missingText(recipe.cost)}`);
      return;
    }

    const placement = EM.canPlaceBuildingAt(type, x, y);

    if (!placement.ok) {
      EM.toast(placement.reason);
      return;
    }

    if (!EM.pay(recipe.cost)) {
      EM.toast(`Mangler: ${EM.missingText(recipe.cost)}`);
      return;
    }

    const building = {
      id: EM.uid(),
      type,
      x,
      y,
      w: size.w,
      h: size.h,
      hp: def.hp,
      maxHp: def.hp,
      waterStore: 0,
      job: null,
      rotation: EM.selectedBuildRotation,
      builtDay: EM.state.day,
      builtTime: EM.state.time,
      lastHitAt: 0,
    };

    EM.state.buildings.push(building);

    if (type === "bedroll") {
      EM.state.player.spawnX = x;
      EM.state.player.spawnY = y;
      EM.toast("Sovepose bygget. Respawnpunkt satt.");
    } else if (type === "campfire") {
      EM.toast("Bål bygget. Det gir lys og kan rense vann.");
    } else if (type === "torch") {
      EM.toast("Fakkel bygget. Den lyser godt i mørket.");
    } else if (type === "spikes") {
      EM.toast("Piggfelle bygget. Zombier som går over den tar skade.");
    } else {
      EM.toast(`${def.name} bygget.`);
    }

    EM.particle(x, y, def.color || "#d6b47a", 10);

    EM.selectedBuild = null;
    EM.selectedBuildRecipe = null;
    EM.selectedBuildRotation = 0;

    EM.refreshPanel();
  };

  EM.useBuilding = function useBuilding(building) {
    const def = EM.BUILDINGS[building.type];

    if (!def) return;

    if (building.hp < building.maxHp && !def.station) {
      EM.repairBuilding(building);
      return;
    }

    if (
      building.type === "workbench" ||
      building.type === "campfire" ||
      building.type === "smelter"
    ) {
      EM.showStation(building);
      return;
    }

    if (building.type === "rainCollector") {
      EM.useRainCollector(building);
      return;
    }

    if (building.type === "bedroll") {
      EM.state.player.spawnX = building.x;
      EM.state.player.spawnY = building.y;
      EM.toast("Respawnpunkt satt her.");
      return;
    }

    if (building.hp < building.maxHp) {
      EM.repairBuilding(building);
      return;
    }

    const extra = def.light ? " Den gir lys om natten." : "";
    EM.toast(`${def.name} står her.${extra} Trykk X for å rive.`);
  };

  EM.useRainCollector = function useRainCollector(building) {
    const amount = Math.floor(building.waterStore || 0);

    if (amount > 0) {
      EM.addItem("water", amount);
      building.waterStore = 0;
      EM.toast(`Tømte regnsamler: rent vann ×${amount}`);
    } else {
      EM.toast("Regnsamleren er tom.");
    }

    EM.refreshPanel();
  };

  EM.repairBuilding = function repairBuilding(building) {
    const def = EM.BUILDINGS[building.type];

    if (!def?.repair) {
      EM.toast("Dette bygget kan ikke repareres.");
      return;
    }

    if (building.hp >= building.maxHp) {
      EM.toast(`${def.name} trenger ikke reparasjon.`);
      return;
    }

    if (!EM.pay(def.repair)) {
      EM.toast(`Mangler for reparasjon: ${EM.missingText(def.repair)}`);
      return;
    }

    const before = building.hp;
    const repairAmount = Math.ceil(building.maxHp * 0.35);

    building.hp = EM.clamp(building.hp + repairAmount, 0, building.maxHp);

    const repaired = Math.round(building.hp - before);

    EM.particle(building.x, building.y, "#8fd46e", 8);
    EM.toast(`${def.name} reparert +${repaired} HP.`);

    EM.refreshPanel();
  };

  EM.demolishNearestBuilding = function demolishNearestBuilding() {
    const building = EM.nearestBuilding(EM.state.player.x, EM.state.player.y, 72);

    if (!building) {
      EM.toast("Ingen bygg nær nok til å rive.");
      return;
    }

    const def = EM.BUILDINGS[building.type];
    const recipe = EM.RECIPES.find((r) => r.build === building.type);

    if (recipe?.cost) {
      const hpRatio = EM.clamp(building.hp / building.maxHp, 0.1, 1);
      const refundRatio = 0.25 + hpRatio * 0.25;

      for (const [id, amount] of Object.entries(recipe.cost)) {
        const refund = Math.max(1, Math.floor(amount * refundRatio));
        EM.addItem(id, refund);
      }
    }

    EM.state.buildings = EM.state.buildings.filter((b) => b !== building);

    EM.particle(building.x, building.y, def.color || "#d6b47a", 12);
    EM.toast(`${def.name} revet. Noen ressurser returnert.`);

    EM.refreshPanel();
  };

  EM.updateBuildings = function updateBuildings(dt) {
    for (const building of EM.state.buildings) {
      updateStationJob(building, dt);
      updatePassiveBuilding(building, dt);
    }

    const destroyed = EM.state.buildings.filter((building) => building.hp <= 0);

    for (const building of destroyed) {
      const def = EM.BUILDINGS[building.type];
      EM.particle(building.x, building.y, def?.color || "#d6b47a", 16);
      EM.toast(`${def?.name || "Bygg"} ble ødelagt.`);
    }

    EM.state.buildings = EM.state.buildings.filter((building) => building.hp > 0);
  };

  function updateStationJob(building, dt) {
    if (!building.job) return;

    const recipe = EM.REFINING.find((r) => r.id === building.job.id);

    if (!recipe) {
      building.job = null;
      return;
    }

    building.job.t += dt;

    if (building.job.t >= building.job.total) {
      for (const [id, amount] of Object.entries(recipe.output)) {
        EM.addItem(id, amount);
      }

      EM.toast(`Ferdig: ${EM.costText(recipe.output)}`);
      building.job = null;
      EM.refreshPanel();
    }
  }

  function updatePassiveBuilding(building, dt) {
    if (building.type === "rainCollector") {
      building.waterStore = EM.clamp((building.waterStore || 0) + dt * 0.025, 0, 8);
    }

    if (building.type === "torch") {
      building.flicker = 0.85 + Math.sin(performance.now() * 0.012 + building.x) * 0.15;
    }

    if (building.type === "campfire") {
      building.flicker = 0.88 + Math.sin(performance.now() * 0.01 + building.y) * 0.12;
    }

    if (building.type === "smelter" && building.job) {
      building.flicker = 0.9 + Math.sin(performance.now() * 0.014) * 0.1;
    }
  }

  EM.nearestLight = function nearestLight(x, y) {
    let best = null;
    let bestDistance = Infinity;

    for (const building of EM.state.buildings) {
      const def = EM.BUILDINGS[building.type];
      let light = def.light || 0;

      if (!light) continue;

      if ((building.type === "campfire" || building.type === "torch" || building.type === "smelter") && building.flicker) {
        light *= building.flicker;
      }

      const d = EM.dist(x, y, building.x, building.y);

      if (d < light && d < bestDistance) {
        best = {
          x: building.x,
          y: building.y,
          radius: light,
          distance: d,
          insideCore: d < light * 0.45,
          building,
        };

        bestDistance = d;
      }
    }

    return best;
  };

  EM.damageBuilding = function damageBuilding(building, amount, source = "unknown") {
    if (!building) return;

    const def = EM.BUILDINGS[building.type];

    building.hp = EM.clamp(building.hp - amount, 0, building.maxHp);
    building.lastHitAt = performance.now();
    building.lastHitSource = source;

    EM.particle(building.x, building.y, def?.color || "#d6b47a", 5);
  };

  EM.getBaseValue = function getBaseValue() {
    const value = {
      buildings: EM.state.buildings.length,
      walls: 0,
      lights: 0,
      traps: 0,
      stations: 0,
      beds: 0,
      water: 0,
    };

    for (const building of EM.state.buildings) {
      const def = EM.BUILDINGS[building.type];

      if (def.solid) value.walls++;
      if (def.trap) value.traps++;
      if (def.station) value.stations++;
      if (def.light) value.lights++;
      if (building.type === "bedroll") value.beds++;
      if (building.type === "rainCollector") value.water += Math.floor(building.waterStore || 0);
    }

    return value;
  };
})();
