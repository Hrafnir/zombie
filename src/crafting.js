(() => {
  "use strict";

  const EM = window.EM;

  function ensureQueue(station) {
    if (!Array.isArray(station.queue)) station.queue = [];
    return station.queue;
  }

  EM.startStationJob = function startStationJob(station, recipe) {
    station.job = {
      id: recipe.id,
      t: 0,
      total: recipe.time,
    };
  };

  EM.queueStationJob = function queueStationJob(station, recipe) {
    ensureQueue(station).push({
      id: recipe.id,
      t: 0,
      total: recipe.time,
    });
  };

  EM.craft = function craft(id) {
    const recipe = EM.RECIPES.find((r) => r.id === id);
    if (!recipe) return;

    if (recipe.build) {
      if (!EM.stationNear(recipe.station)) {
        EM.toast(`Du må stå ved ${EM.stationName(recipe.station)}.`);
        return;
      }

      if (!EM.canPay(recipe.cost)) {
        EM.toast(`Mangler: ${EM.missingText(recipe.cost)}`);
        return;
      }

      EM.selectedBuild = recipe.build;
      EM.selectedBuildRecipe = recipe.id;
      EM.selectedBuildRotation = 0;

      EM.toast(
        `Velg plassering for ${EM.BUILDINGS[recipe.build].name}. R roterer. Ressurser trekkes først når bygget plasseres.`
      );

      EM.refreshPanel();
      return;
    }

    if (!EM.stationNear(recipe.station)) {
      EM.toast(`Du må stå ved ${EM.stationName(recipe.station)}.`);
      return;
    }

    if (!EM.pay(recipe.cost)) {
      EM.toast(`Mangler: ${EM.missingText(recipe.cost)}`);
      return;
    }

    if (recipe.weapon) {
      EM.state.weapons.add(recipe.weapon);
      EM.state.player.weapon = recipe.weapon;
      EM.toast(`Laget ${EM.WEAPONS[recipe.weapon].name}.`);
      EM.renderHotbar();
    }

    if (recipe.item) {
      EM.addItem(recipe.item, recipe.amount || 1);
      EM.toast(`Laget ${EM.itemName(recipe.item)} ×${recipe.amount || 1}.`);
    }

    EM.refreshPanel();
  };

  EM.refine = function refine(id, building) {
    const recipe = EM.REFINING.find((r) => r.id === id);
    if (!recipe) return;

    const station =
      building ||
      EM.nearestBuilding(EM.state.player.x, EM.state.player.y, 120, (b) => {
        return b.type === recipe.station;
      });

    if (!station) {
      EM.toast(`Du må stå ved ${EM.stationName(recipe.station)}.`);
      return;
    }

    if (station.type !== recipe.station) {
      EM.toast(`Feil stasjon. Denne jobben krever ${EM.stationName(recipe.station)}.`);
      return;
    }

    if (!EM.pay(recipe.cost)) {
      EM.toast(`Mangler: ${EM.missingText(recipe.cost)}`);
      return;
    }

    ensureQueue(station);

    if (!station.job) {
      EM.startStationJob(station, recipe);
      EM.toast(`${recipe.name} startet.`);
    } else {
      EM.queueStationJob(station, recipe);
      EM.toast(`${recipe.name} lagt i kø. Kø: ${station.queue.length}`);
    }

    EM.refreshPanel();
  };

  EM.useFood = function useFood() {
    if (!EM.removeItem("food", 1)) {
      EM.toast("Du har ikke mat.");
      return;
    }

    EM.state.player.hunger = EM.clamp(EM.state.player.hunger + 28, 0, 100);
    EM.toast("Du spiste mat.");
    EM.refreshPanel();
  };

  EM.drink = function drink() {
    if (EM.removeItem("water", 1)) {
      EM.state.player.thirst = EM.clamp(EM.state.player.thirst + 35, 0, 100);
      EM.toast("Du drakk rent vann.");
    } else if (EM.removeItem("dirtyWater", 1)) {
      EM.state.player.thirst = EM.clamp(EM.state.player.thirst + 22, 0, 100);

      if (Math.random() < 0.35) {
        EM.state.player.hp -= 8;
        EM.toast("Skittent vann gjorde deg syk.");
      } else {
        EM.toast("Du drakk skittent vann.");
      }
    } else {
      EM.toast("Du har ikke vann.");
    }

    EM.refreshPanel();
  };

  EM.heal = function heal() {
    if (EM.removeItem("medkit", 1)) {
      EM.state.player.hp = EM.clamp(EM.state.player.hp + 65, 0, 100);
      EM.toast("Førstehjelpspakke brukt.");
    } else if (EM.removeItem("bandage", 1)) {
      EM.state.player.hp = EM.clamp(EM.state.player.hp + 28, 0, 100);
      EM.toast("Bandasje brukt.");
    } else {
      EM.toast("Du har ikke førstehjelp.");
    }

    EM.refreshPanel();
  };
})();
