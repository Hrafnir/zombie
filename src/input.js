(() => {
  "use strict";

  const EM = window.EM;

  EM.handleKey = function handleKey(key) {
    if (key === "escape") {
      if (EM.selectedBuild) {
        EM.selectedBuild = null;
        EM.selectedBuildRecipe = null;
        EM.selectedBuildRotation = 0;
        EM.toast("Bygging avbrutt.");
        return;
      }

      if (!EM.dom.sidePanel.classList.contains("hidden")) {
        EM.closePanel();
        return;
      }

      if (EM.running) EM.togglePause();
      return;
    }

    if (!EM.running || EM.paused) return;

    if (key === "r" && EM.selectedBuild) {
      EM.selectedBuildRotation = (EM.selectedBuildRotation + Math.PI / 2) % (Math.PI * 2);
      EM.toast("Bygg rotert.");
      return;
    }

    if (key === "x") {
      EM.demolishNearestBuilding();
      return;
    }

    if (key === "i") EM.showInventory();
    if (key === "c") EM.showCrafting();
    if (key === "b") EM.showBuildMenu();
    if (key === "f") EM.useFood();
    if (key === "v") EM.drink();
    if (key === "h") EM.heal();
    if (key === "e") EM.interact();
    if (key === " ") EM.dodge();

    if (["1", "2", "3", "4", "5", "6"].includes(key)) {
      EM.selectWeapon(Number(key) - 1);
    }
  };

  EM.handleClick = function handleClick() {
    if (!EM.running || EM.paused) return;

    if (EM.selectedBuild) {
      const p = EM.getBuildPlacementPoint();
      EM.placeBuilding(EM.selectedBuild, p.x, p.y);
      return;
    }

    EM.attack();
  };

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (!EM.keys.has(key)) EM.pressed.add(key);
    EM.keys.add(key);

    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }

    EM.handleKey(key);
  });

  window.addEventListener("keyup", (event) => {
    EM.keys.delete(event.key.toLowerCase());
  });

  EM.dom.canvas.addEventListener("mousemove", EM.setMouse);

  EM.dom.canvas.addEventListener("mousedown", (event) => {
    EM.setMouse(event);

    if (event.button === 0) {
      EM.mouse.down = true;
      EM.mouse.clicked = true;
      EM.handleClick();
    }
  });

  window.addEventListener("mouseup", () => {
    EM.mouse.down = false;
  });

  EM.dom.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
})();
