/**
 * Mass Token Drop - Foundry VTT v14 Module
 * Drop multiple tokens into a scene in one go.
 */

const MODULE_ID = "mass-token-drop";

// ─────────────────────────────────────────────
//  Application (v14 ApplicationV2)
// ─────────────────────────────────────────────

class MassTokenDropApp extends foundry.applications.api.ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this._selectedActors = new Map(); // actorId → { actor, quantity }
    this._filter = "all";
    this._search = "";
  }

  static DEFAULT_OPTIONS = {
    id: "mass-token-drop-dialog",
    classes: ["mass-token-drop"],
    tag: "div",
    window: {
      title: "Mass Token Drop",
      icon: "fas fa-dragon",
      resizable: true,
    },
    position: {
      width: 460,
      height: 580,
    },
    actions: {},
  };

  static PARTS = {
    main: {
      template: null, // We build HTML manually
    },
  };

  // ── Render ──────────────────────────────────

  async _renderHTML(context, options) {
    const actors = this._getFilteredActors();
    return this._buildHTML(actors);
  }

  _buildHTML(actors) {
    const types = this._getActorTypes();
    const totalTokens = this._getTotalTokenCount();

    const filterBtns = [
      { key: "all", label: "All" },
      ...types.map((t) => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    ]
      .map(
        (f) =>
          `<button class="mtd-filter-btn ${this._filter === f.key ? "active" : ""}" data-filter="${f.key}">${f.label}</button>`
      )
      .join("");

    const actorRows = actors
      .map((actor) => {
        const sel = this._selectedActors.get(actor.id);
        const qty = sel ? sel.quantity : 0;
        const isSelected = !!sel;
        const img = actor.img || "icons/svg/mystery-man.svg";
        return `
        <div class="mtd-actor-row ${isSelected ? "selected" : ""}" data-actor-id="${actor.id}">
          <img class="mtd-actor-img" src="${img}" alt="${actor.name}" />
          <div class="mtd-actor-info">
            <div class="mtd-actor-name">${actor.name}</div>
            <div class="mtd-actor-type">${actor.type}</div>
          </div>
          <div class="mtd-actor-controls">
            <button class="mtd-qty-btn mtd-minus" data-actor-id="${actor.id}" ${qty <= 0 ? "disabled" : ""}>−</button>
            <input class="mtd-qty-input" type="number" min="0" max="99" value="${qty}" data-actor-id="${actor.id}" />
            <button class="mtd-qty-btn mtd-plus" data-actor-id="${actor.id}">+</button>
            ${isSelected ? `<button class="mtd-remove-btn" data-actor-id="${actor.id}" title="Remove">✕</button>` : ""}
          </div>
        </div>`;
      })
      .join("") || `<div class="mtd-empty">No actors found</div>`;

    const html = `
      <div class="mtd-container">
        <div class="mtd-search">
          <input type="text" id="mtd-search-input" placeholder="Search actors…" value="${this._search}" />
        </div>
        <div class="mtd-filters">${filterBtns}</div>
        <div class="mtd-actor-list">${actorRows}</div>
        <div class="mtd-summary">
          <span>Selected: <span class="mtd-summary-count">${this._selectedActors.size} actor type(s)</span></span>
          <span>Total tokens: <span class="mtd-summary-count">${totalTokens}</span></span>
        </div>
        <div class="mtd-options">
          <div class="mtd-option-group">
            <label>Placement</label>
            <select id="mtd-placement-mode">
              <option value="click">Click to Place</option>
              <option value="grid">Grid Formation</option>
              <option value="scatter">Scatter</option>
            </select>
          </div>
          <div class="mtd-option-group">
            <label>Spacing</label>
            <input type="number" id="mtd-spacing" value="1" min="1" max="10" title="Grid spacing in squares" />
            <span style="font-size:11px;color:#6a5a4a;">sq</span>
          </div>
          <div class="mtd-option-group">
            <label>Hidden</label>
            <input type="checkbox" id="mtd-hidden" title="Place tokens as hidden" />
          </div>
        </div>
        <div class="mtd-placement-hint" id="mtd-hint">
          Click on the canvas to place tokens, then press <strong>Escape</strong> or close this dialog to finish.
        </div>
        <div class="mtd-footer">
          <button class="mtd-btn mtd-btn-secondary" id="mtd-clear-btn">Clear All</button>
          <button class="mtd-btn mtd-btn-primary" id="mtd-drop-btn" ${totalTokens === 0 ? "disabled" : ""}>
            Drop ${totalTokens > 0 ? totalTokens : ""} Token${totalTokens !== 1 ? "s" : ""}
          </button>
        </div>
      </div>`;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    return wrapper.firstElementChild;
  }

  _replaceHTML(result, content, options) {
    content.replaceChildren(result);
    this._attachListeners(content);
  }

  // ── Event Listeners ──────────────────────────

  _attachListeners(content) {
    // Search
    const searchInput = content.querySelector("#mtd-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this._search = e.target.value;
        this.render();
      });
      // Keep focus after re-render
      searchInput.focus();
    }

    // Filter buttons
    content.querySelectorAll(".mtd-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._filter = btn.dataset.filter;
        this.render();
      });
    });

    // Actor row click (toggle select)
    content.querySelectorAll(".mtd-actor-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".mtd-actor-controls")) return;
        const id = row.dataset.actorId;
        this._toggleActor(id);
      });
    });

    // Quantity minus buttons
    content.querySelectorAll(".mtd-minus").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._adjustQuantity(btn.dataset.actorId, -1);
      });
    });

    // Quantity plus buttons
    content.querySelectorAll(".mtd-plus").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._adjustQuantity(btn.dataset.actorId, 1);
      });
    });

    // Quantity input direct edit
    content.querySelectorAll(".mtd-qty-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        e.stopPropagation();
        const id = input.dataset.actorId;
        const qty = Math.max(0, Math.min(99, parseInt(input.value) || 0));
        this._setQuantity(id, qty);
      });
      input.addEventListener("click", (e) => e.stopPropagation());
    });

    // Remove buttons
    content.querySelectorAll(".mtd-remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._selectedActors.delete(btn.dataset.actorId);
        this.render();
      });
    });

    // Clear all
    const clearBtn = content.querySelector("#mtd-clear-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this._selectedActors.clear();
        this.render();
      });
    }

    // Drop button
    const dropBtn = content.querySelector("#mtd-drop-btn");
    if (dropBtn) {
      dropBtn.addEventListener("click", () => this._beginPlacement());
    }
  }

  // ── Actor Selection Logic ────────────────────

  _toggleActor(actorId) {
    if (this._selectedActors.has(actorId)) {
      this._selectedActors.delete(actorId);
    } else {
      const actor = game.actors.get(actorId);
      if (actor) {
        this._selectedActors.set(actorId, { actor, quantity: 1 });
      }
    }
    this.render();
  }

  _adjustQuantity(actorId, delta) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const current = this._selectedActors.get(actorId);
    const newQty = Math.max(0, Math.min(99, (current ? current.quantity : 0) + delta));
    this._setQuantity(actorId, newQty, actor);
  }

  _setQuantity(actorId, qty, actor = null) {
    if (qty <= 0) {
      this._selectedActors.delete(actorId);
    } else {
      if (!actor) actor = game.actors.get(actorId);
      if (!actor) return;
      this._selectedActors.set(actorId, { actor, quantity: qty });
    }
    this.render();
  }

  _getTotalTokenCount() {
    let total = 0;
    for (const { quantity } of this._selectedActors.values()) total += quantity;
    return total;
  }

  // ── Filtering ────────────────────────────────

  _getActorTypes() {
    return [...new Set(game.actors.map((a) => a.type))].sort();
  }

  _getFilteredActors() {
    let actors = game.actors.contents;
    if (this._filter !== "all") actors = actors.filter((a) => a.type === this._filter);
    if (this._search) {
      const q = this._search.toLowerCase();
      actors = actors.filter((a) => a.name.toLowerCase().includes(q));
    }
    return actors.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── Placement ────────────────────────────────

  async _beginPlacement() {
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.warn("No active scene!");
      return;
    }

    const totalTokens = this._getTotalTokenCount();
    if (totalTokens === 0) return;

    // Build the flat list of actors to place (respecting quantities)
    const actorList = [];
    for (const { actor, quantity } of this._selectedActors.values()) {
      for (let i = 0; i < quantity; i++) actorList.push(actor);
    }

    const placementMode = this.element.querySelector("#mtd-placement-mode")?.value ?? "click";
    const spacing = parseInt(this.element.querySelector("#mtd-spacing")?.value ?? 1) || 1;
    const hidden = this.element.querySelector("#mtd-hidden")?.checked ?? false;

    // Show hint
    const hint = this.element.querySelector("#mtd-hint");
    if (hint) hint.classList.add("visible");

    if (placementMode === "click") {
      await this._placementClickMode(actorList, hidden);
    } else if (placementMode === "grid") {
      await this._placementGridMode(actorList, spacing, hidden);
    } else {
      await this._placementScatterMode(actorList, spacing, hidden);
    }

    if (hint) hint.classList.remove("visible");
  }

  // Click-to-place: each click places the next token
  async _placementClickMode(actorList, hidden) {
    ui.notifications.info(`Click the canvas to place ${actorList.length} token(s). Press Escape to cancel.`);

    let index = 0;
    const layer = canvas.tokens;

    const cleanup = () => {
      canvas.app.renderer.view.removeEventListener("pointerdown", onCanvasClick);
      window.removeEventListener("keydown", onEsc);
      ui.notifications.info(`Placed ${index} of ${actorList.length} token(s).`);
    };

    const onEsc = (e) => {
      if (e.key === "Escape") cleanup();
    };

    const onCanvasClick = async (e) => {
      if (index >= actorList.length) {
        cleanup();
        return;
      }

      const actor = actorList[index];
      const pos = canvas.app.renderer.events.pointer.getLocalPosition(canvas.stage);
      const snapped = canvas.grid.getSnappedPoint(pos, { mode: CONST.GRID_SNAPPING_MODES.CENTER });

      await this._createToken(actor, snapped.x, snapped.y, hidden);
      index++;

      if (index >= actorList.length) {
        cleanup();
      } else {
        ui.notifications.info(`Click to place token ${index + 1}/${actorList.length} (${actorList[index].name})`);
      }
    };

    canvas.app.renderer.view.addEventListener("pointerdown", onCanvasClick);
    window.addEventListener("keydown", onEsc);
  }

  // Grid-mode: first click sets the anchor, then all tokens are placed in a grid
  async _placementGridMode(actorList, spacing, hidden) {
    ui.notifications.info(`Click on the canvas to place ${actorList.length} tokens in a grid formation.`);

    const onCanvasClick = async (e) => {
      canvas.app.renderer.view.removeEventListener("pointerdown", onCanvasClick);
      window.removeEventListener("keydown", onEsc);

      const pos = canvas.app.renderer.events.pointer.getLocalPosition(canvas.stage);
      const snapped = canvas.grid.getSnappedPoint(pos, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
      const gridSize = canvas.grid.size * spacing;

      // How many columns? Approx sqrt for a squarish grid
      const cols = Math.ceil(Math.sqrt(actorList.length));
      const positions = actorList.map((_, i) => ({
        x: snapped.x + (i % cols) * gridSize,
        y: snapped.y + Math.floor(i / cols) * gridSize,
      }));

      await this._createTokensBatch(actorList, positions, hidden);
      ui.notifications.info(`Placed ${actorList.length} tokens.`);
    };

    const onEsc = (e) => {
      if (e.key === "Escape") {
        canvas.app.renderer.view.removeEventListener("pointerdown", onCanvasClick);
        window.removeEventListener("keydown", onEsc);
      }
    };

    canvas.app.renderer.view.addEventListener("pointerdown", onCanvasClick);
    window.addEventListener("keydown", onEsc);
  }

  // Scatter mode: click sets center, tokens placed randomly around it
  async _placementScatterMode(actorList, spacing, hidden) {
    ui.notifications.info(`Click on the canvas to scatter ${actorList.length} tokens around that point.`);

    const onCanvasClick = async (e) => {
      canvas.app.renderer.view.removeEventListener("pointerdown", onCanvasClick);
      window.removeEventListener("keydown", onEsc);

      const pos = canvas.app.renderer.events.pointer.getLocalPosition(canvas.stage);
      const snapped = canvas.grid.getSnappedPoint(pos, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
      const gridSize = canvas.grid.size * spacing;
      const radius = Math.max(gridSize * 2, gridSize * Math.ceil(Math.sqrt(actorList.length)));

      const positions = actorList.map(() => {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const rawX = snapped.x + Math.cos(angle) * dist;
        const rawY = snapped.y + Math.sin(angle) * dist;
        return canvas.grid.getSnappedPoint({ x: rawX, y: rawY }, { mode: CONST.GRID_SNAPPING_MODES.CENTER });
      });

      await this._createTokensBatch(actorList, positions, hidden);
      ui.notifications.info(`Scattered ${actorList.length} tokens.`);
    };

    const onEsc = (e) => {
      if (e.key === "Escape") {
        canvas.app.renderer.view.removeEventListener("pointerdown", onCanvasClick);
        window.removeEventListener("keydown", onEsc);
      }
    };

    canvas.app.renderer.view.addEventListener("pointerdown", onCanvasClick);
    window.addEventListener("keydown", onEsc);
  }

  // ── Token Creation ───────────────────────────

  async _createToken(actor, x, y, hidden) {
    const tokenDoc = await actor.getTokenDocument({ x, y, hidden });
    await canvas.scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
  }

  async _createTokensBatch(actors, positions, hidden) {
    const tokenData = await Promise.all(
      actors.map(async (actor, i) => {
        const { x, y } = positions[i];
        const tokenDoc = await actor.getTokenDocument({ x, y, hidden });
        return tokenDoc.toObject();
      })
    );
    await canvas.scene.createEmbeddedDocuments("Token", tokenData);
  }
}

// ─────────────────────────────────────────────
//  Hook Registration
// ─────────────────────────────────────────────

let _appInstance = null;

function openMassTokenDrop() {
  if (_appInstance?.rendered) {
    _appInstance.bringToFront();
    return;
  }
  _appInstance = new MassTokenDropApp();
  _appInstance.render(true);
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Mass Token Drop`);
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);
});

// Add button to Token Controls (Scene Layer toolbar)
Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.find((c) => c.name === "token");
  if (!tokenControls) return;

  tokenControls.tools.push({
    name: "mass-token-drop",
    title: "Mass Token Drop",
    icon: "fas fa-layer-group",
    button: true,
    onClick: () => openMassTokenDrop(),
    visible: game.user.isGM,
  });
});

// Register keybinding (GM only)
Hooks.once("init", () => {
  game.keybindings.register(MODULE_ID, "openDialog", {
    name: "Open Mass Token Drop",
    hint: "Opens the Mass Token Drop dialog",
    editable: [{ key: "KeyM", modifiers: ["Shift"] }],
    onDown: () => {
      if (!game.user.isGM) return;
      openMassTokenDrop();
    },
    restricted: true,
  });
});
