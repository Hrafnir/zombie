(() => {
  "use strict";

  const EM = window.EM;

  EM.toast = function toast(message) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;

    EM.dom.toastLayer.appendChild(el);
    setTimeout(() => el.remove(), 3200);

    EM.state.messages.unshift(message);
    EM.state.messages = EM.state.messages.slice(0, 5);
    EM.renderLog();
  };

  EM.renderLog = function renderLog() {
    EM.dom.messageLog.innerHTML = EM.state.messages
      .map((message) => `<div>${message}</div>`)
      .join("");
  };

  EM.showHint = function showHint(text) {
    EM.dom.interactionHint.textContent = text;
    EM.dom.interactionHint.classList.remove("hidden");
  };

  EM.hideHint = function hideHint() {
    EM.dom.interactionHint.classList.add("hidden");
  };

  EM.showPanel = function showPanel(title, html) {
    EM.dom.sidePanelTitle.textContent = title;
    EM.dom.sidePanelContent.innerHTML = html;
    EM.dom.sidePanel.classList.remove("hidden");
  };

  EM.closePanel = function closePanel() {
    EM.dom.sidePanel.classList.add("hidden");
    EM.panelMode = null;
    EM.selectedStationBuilding = null;
  };

  EM.tabs = function tabs(active) {
    return `
      <div class="panelTabs">
        <button data-tab="inventory" class="${active === "inventory" ? "active" : ""}">Inventory</button>
        <button data-tab="craft" class="${active === "craft" ? "active" : ""}">Crafting</button>
        <button data-tab="build" class="${active === "build" ? "active" : ""}">Bygg</button>
      </div>
    `;
  };

  EM.itemHint = function itemHint(id) {
    if (id === "dirtyWater") return "Kan renses på bål.";
    if (id === "ore") return "Smeltes i smelter.";
    if (id === "coal") return "Brensel til smelter.";
    if (id === "metal") return "Brukes til avansert utstyr.";
    if (id === "canteen") return "Gir mer vann fra pytter.";
    return "";
  };

  EM.showInventory = function showInventory() {
    EM.panelMode = "inventory";

    const weaponRows = [...EM.state.weapons].map((weaponId) => {
      return `
        <div class="craftRow">
          <div>
            <strong>${EM.WEAPONS[weaponId].name}</strong>
            <p>Våpen/verktøy</p>
          </div>
        </div>
      `;
    });

    const itemRows = Object.entries(EM.state.inv).map(([id, amount]) => {
      const usable = ["food", "water", "dirtyWater", "bandage", "medkit"].includes(id);

      return `
        <div class="craftRow">
          <div>
            <strong>${EM.itemName(id)} ×${amount}</strong>
            <p>${EM.itemHint(id)}</p>
          </div>
          ${usable ? `<button data-use="${id}">Bruk</button>` : ""}
        </div>
      `;
    });

    EM.showPanel("Inventory", EM.tabs("inventory") + weaponRows.join("") + itemRows.join(""));
  };

  EM.showCrafting = function showCrafting(station = null) {
    EM.panelMode = "craft";
    EM.selectedStationBuilding = station;

    const rows = EM.RECIPES
      .filter((recipe) => {
        if (recipe.build) return false;
        if (!station) return true;
        return recipe.station === station.type || !recipe.station;
      })
      .map(EM.recipeRow)
      .join("");

    EM.showPanel(
      "Crafting",
      EM.tabs("craft") +
        `<p class="panelHint">Stasjoner: arbeidsbenk, bål og smelter åpner flere valg.</p>` +
        rows
    );
  };

  EM.showBuildMenu = function showBuildMenu() {
    EM.panelMode = "build";

    const rows = EM.RECIPES
      .filter((recipe) => recipe.build)
      .map(EM.recipeRow)
      .join("");

    EM.showPanel(
      "Bygging",
      EM.tabs("build") +
        `<p class="panelHint">Velg bygg, klikk i verden. R roterer. Esc avbryter. Ressurser trekkes først når plassering er gyldig.</p>` +
        rows
    );
  };

  EM.recipeRow = function recipeRow(recipe) {
    const ok = EM.canPay(recipe.cost) && EM.stationNear(recipe.station);

    return `
      <div class="craftRow">
        <div>
          <strong>${recipe.name}</strong>
          <p>${recipe.desc || ""}</p>
          <small>Koster: ${EM.costText(recipe.cost)} • Stasjon: ${EM.stationName(recipe.station)}</small>
        </div>
        <button ${ok ? "" : "disabled"} data-craft="${recipe.id}">
          ${ok ? "Lag/velg" : "Mangler"}
        </button>
      </div>
    `;
  };

  EM.showStation = function showStation(building) {
    EM.panelMode = "station";
    EM.selectedStationBuilding = building;

    const relevant = EM.REFINING.filter((recipe) => recipe.station === building.type);
    const job = building.job ? EM.REFINING.find((recipe) => recipe.id === building.job.id) : null;

    const rows = relevant
      .map((recipe) => {
        const ok = EM.canPay(recipe.cost) && !building.job;

        return `
          <div class="craftRow">
            <div>
              <strong>${recipe.name}</strong>
              <p>Koster: ${EM.costText(recipe.cost)} → Gir: ${EM.costText(recipe.output)}</p>
            </div>
            <button ${ok ? "" : "disabled"} data-refine="${recipe.id}">
              ${building.job ? "Opptatt" : "Start"}
            </button>
          </div>
        `;
      })
      .join("");

    const repairText =
      building.hp < building.maxHp
        ? `<p class="panelHint">Skadet: ${Math.round(building.hp)} / ${building.maxHp}. Trykk E nær bygget for reparasjon hvis du har ressurser.</p>`
        : "";

    EM.showPanel(
      EM.BUILDINGS[building.type].name,
      EM.tabs("craft") +
        repairText +
        (job
          ? `<p class="panelHint">Pågår: ${job.name} (${Math.round(
              (building.job.t / building.job.total) * 100
            )}%)</p>`
          : "") +
        rows
    );
  };

  EM.refreshPanel = function refreshPanel() {
    if (EM.dom.sidePanel.classList.contains("hidden")) return;

    if (EM.panelMode === "inventory") EM.showInventory();
    if (EM.panelMode === "craft") EM.showCrafting(EM.selectedStationBuilding);
    if (EM.panelMode === "build") EM.showBuildMenu();
    if (EM.panelMode === "station" && EM.selectedStationBuilding) {
      EM.showStation(EM.selectedStationBuilding);
    }
  };

  EM.renderHotbar = function renderHotbar() {
    const list = [...EM.state.weapons];

    EM.dom.hotbar.innerHTML = list
      .map((weaponId, index) => {
        return `
          <button class="slot ${EM.state.player.weapon === weaponId ? "active" : ""}" data-weapon="${weaponId}">
            <b>${index + 1}</b>${EM.WEAPONS[weaponId].name}
          </button>
        `;
      })
      .join("");

    EM.dom.hotbar.querySelectorAll("button").forEach((button, index) => {
      button.addEventListener("click", () => EM.selectWeapon(index));
    });
  };

  EM.renderObjectives = function renderObjectives() {
    EM.dom.objectiveBox.innerHTML = `
      <strong>Mål</strong>
      <ul>
        <li>Lag hakke og finn malm</li>
        <li>Bygg arbeidsbenk og smelter</li>
        <li>Bygg bål/fakler for lys om natten</li>
        <li>Rens vann eller bygg regnsamler</li>
        <li>Forsterk basen før natten</li>
      </ul>
    `;
  };

  EM.updateHud = function updateHud() {
    EM.dom.meters.health.value = EM.state.player.hp;
    EM.dom.meters.stamina.value = EM.state.player.stamina;
    EM.dom.meters.hunger.value = EM.state.player.hunger;
    EM.dom.meters.thirst.value = EM.state.player.thirst;

    const hour = Math.floor(EM.state.time / 60) % 24;
    const minute = Math.floor(EM.state.time % 60);

    EM.dom.dayLabel.textContent = `Dag ${EM.state.day} • ${String(hour).padStart(2, "0")}:${String(
      minute
    ).padStart(2, "0")}`;

    EM.dom.threatPill.textContent = EM.isNight() ? "Natt: høy fare" : "Dagslys";
    EM.dom.threatPill.classList.toggle("danger", EM.isNight());

    const node = EM.nearestNode();
    const building = EM.nearestBuilding(EM.state.player.x, EM.state.player.y, 72);

    if (EM.selectedBuild) {
      const p = EM.getBuildPlacementPoint();
      const placement = EM.canPlaceBuildingAt(EM.selectedBuild, p.x, p.y);
      EM.showHint(`${placement.reason} • R roterer`);
    } else if (node) {
      EM.showHint(`E: ${EM.nodeDef(node.type).name}`);
    } else if (building) {
      const def = EM.BUILDINGS[building.type];
      if (building.hp < building.maxHp) {
        EM.showHint(`E: reparer ${def.name} • X: riv`);
      } else {
        EM.showHint(`E: ${def.name} • X: riv`);
      }
    } else {
      EM.hideHint();
    }
  };

  EM.dom.sidePanelContent.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.tab === "inventory") EM.showInventory();
    if (button.dataset.tab === "craft") EM.showCrafting();
    if (button.dataset.tab === "build") EM.showBuildMenu();
    if (button.dataset.craft) EM.craft(button.dataset.craft);

    if (button.dataset.refine) {
      EM.refine(button.dataset.refine, EM.selectedStationBuilding);
    }

    if (button.dataset.use) {
      if (button.dataset.use === "food") EM.useFood();
      else if (button.dataset.use === "water" || button.dataset.use === "dirtyWater") EM.drink();
      else EM.heal();
    }
  });
})();
