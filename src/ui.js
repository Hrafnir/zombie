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

  EM.resourceSummary = function resourceSummary() {
    const important = [
      "wood",
      "stone",
      "ore",
      "coal",
      "metal",
      "scrap",
      "cloth",
      "food",
      "dirtyWater",
      "water",
      "herbs",
      "parts",
      "ammo",
      "arrows",
    ];

    const chips = important
      .filter((id) => (EM.state.inv[id] || 0) > 0)
      .map((id) => {
        return `<span class="resourceChip">${EM.itemName(id)} <b>${EM.state.inv[id]}</b></span>`;
      })
      .join("");

    return `
      <div class="resourceSummary">
        <strong>Ressurser du har</strong>
        <div class="resourceChips">
          ${chips || `<span class="resourceChip empty">Ingen ressurser</span>`}
        </div>
      </div>
    `;
  };

  EM.costWithInventory = function costWithInventory(cost) {
    return Object.entries(cost || {})
      .map(([id, amount]) => {
        const have = EM.state.inv[id] || 0;
        const ok = have >= amount;

        return `<span class="${ok ? "costOk" : "costMissing"}">${EM.itemName(id)} ${have}/${amount}</span>`;
      })
      .join(" ");
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

    EM.showPanel(
      "Inventory",
      EM.tabs("inventory") + EM.resourceSummary() + weaponRows.join("") + itemRows.join("")
    );
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
        EM.resourceSummary() +
        `<p class="panelHint">Stasjoner: arbeidsbenk, bål og smelter åpner flere valg. Ressurstall vises som du har / kreves.</p>` +
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
        EM.resourceSummary() +
        `<p class="panelHint">Velg bygg, klikk i verden. R roterer. Esc avbryter. Ressurser trekkes først når plassering er gyldig.</p>` +
        rows
    );
  };

  EM.recipeRow = function recipeRow(recipe) {
    const ok = EM.canPay(recipe.cost) && EM.stationNear(recipe.station);

    let stationInfo = `Stasjon: ${EM.stationName(recipe.station)}`;

    if (recipe.station && !EM.stationNear(recipe.station)) {
      stationInfo = `Krever nærhet til ${EM.stationName(recipe.station)}`;
    }

    return `
      <div class="craftRow">
        <div>
          <strong>${recipe.name}</strong>
          <p>${recipe.desc || ""}</p>
          <small>${stationInfo}</small>
          <div class="costLine">${EM.costWithInventory(recipe.cost)}</div>
        </div>
        <button ${ok ? "" : "disabled"} data-craft="${recipe.id}">
          ${ok ? "Lag/velg" : "Mangler"}
        </button>
      </div>
    `;
  };

  EM.stationQueueHtml = function stationQueueHtml(building) {
    if (!Array.isArray(building.queue)) building.queue = [];

    const activeRecipe = building.job
      ? EM.REFINING.find((recipe) => recipe.id === building.job.id)
      : null;

    const activeHtml = activeRecipe
      ? `
        <div class="stationJob activeJob">
          <strong>Pågår:</strong>
          <span>${activeRecipe.name}</span>
          <meter min="0" max="100" value="${Math.round((building.job.t / building.job.total) * 100)}"></meter>
          <small>${Math.round((building.job.t / building.job.total) * 100)}%</small>
        </div>
      `
      : `
        <div class="stationJob emptyJob">
          <strong>Pågår:</strong>
          <span>Ingen aktiv jobb</span>
        </div>
      `;

    const queueHtml = building.queue.length
      ? building.queue
          .map((job, index) => {
            const recipe = EM.REFINING.find((r) => r.id === job.id);
            return `
              <div class="queueItem">
                <b>${index + 1}</b>
                <span>${recipe ? recipe.name : job.id}</span>
              </div>
            `;
          })
          .join("")
      : `<div class="queueItem empty"><span>Køen er tom</span></div>`;

    return `
      <div class="stationQueue">
        ${activeHtml}
        <strong>Kø</strong>
        <div class="queueList">${queueHtml}</div>
      </div>
    `;
  };

  EM.showStation = function showStation(building) {
    EM.panelMode = "station";
    EM.selectedStationBuilding = building;

    if (!Array.isArray(building.queue)) building.queue = [];

    const relevant = EM.REFINING.filter((recipe) => recipe.station === building.type);

    const rows = relevant
      .map((recipe) => {
        const ok = EM.canPay(recipe.cost);

        return `
          <div class="craftRow">
            <div>
              <strong>${recipe.name}</strong>
              <p>Gir: ${EM.costText(recipe.output)}</p>
              <div class="costLine">${EM.costWithInventory(recipe.cost)}</div>
            </div>
            <button ${ok ? "" : "disabled"} data-refine="${recipe.id}">
              ${ok ? (building.job ? "Legg i kø" : "Start") : "Mangler"}
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
        EM.resourceSummary() +
        EM.stationQueueHtml(building) +
        repairText +
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
        <li>Kø opp arbeid på bål/smelter</li>
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
      const queueCount = Array.isArray(building.queue) ? building.queue.length : 0;
      const jobText = building.job || queueCount ? ` • jobb/kø: ${(building.job ? 1 : 0) + queueCount}` : "";

      if (building.hp < building.maxHp) {
        EM.showHint(`E: reparer ${def.name}${jobText} • X: riv`);
      } else {
        EM.showHint(`E: ${def.name}${jobText} • X: riv`);
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
