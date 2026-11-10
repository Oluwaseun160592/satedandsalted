/**
 * SATED & SALTED - Full Storefront Admin Portal Logic
 * Speaks directly to index.html via:
 *   1. localStorage ("ss_store_v2" and "ss_menu")
 *   2. BroadcastChannel ("ss_live_channel") for instant cross-tab updates
 *   3. POST /api/store (writes changes & uploaded photos directly to menu-data.js / uploads/ on disk)
 */
(function () {
  "use strict";

  const STORE_KEY = "ss_store_v2";
  const LEGACY_MENU_KEY = "ss_menu";
  const PW_KEY = "ss_admin_pw";
  const SESSION_KEY = "ss_admin_session";
  const DEFAULT_PASSWORD = "admin123";
  const CATEGORY_LABELS = {
    spaghetti: "Spaghetti Specials",
    fries: "Crispy Roots & Fries",
    sides: "Sides & Delicacies",
    drinks: "Refreshments"
  };

  const $ = (id) => document.getElementById(id);

  // Live broadcast channel to notify open website tabs immediately
  let liveChannel = null;
  try {
    if ("BroadcastChannel" in window) {
      liveChannel = new BroadcastChannel("ss_live_channel");
    }
  } catch (e) { /* ignore */ }

  let store = null;
  let pendingImage = "";
  let quickPhotoTargetId = null;

  /* ---------- Deep clone & Store loading ---------- */
  function cloneDefaultStore() {
    const def = window.SS_DEFAULT_STORE || {
      updatedAt: 0,
      settings: {
        brandName: "Sated & Salted",
        whatsapp: "2348164475960",
        whatsappNumber: "2348164475960",
        whatsappDisplay: "+234 816 447 5960",
        address: "78b, Green Street, Isolo Housing Estate, Lagos",
        promoText: "Free Chilled Drink on orders above ₦15,000!",
        heroDishId: "gizdodo",
        heroPillText: "#1 Gizdodo in Town",
        kitchenStatusMode: "auto"
      },
      jumboPrice: 1500,
      addons: [],
      deliveryZones: [],
      combos: [],
      menu: window.SS_DEFAULT_MENU || []
    };
    return JSON.parse(JSON.stringify(def));
  }

  function normalizeStore(raw) {
    const base = cloneDefaultStore();
    if (!raw || typeof raw !== "object") return base;
    return {
      updatedAt: Number(raw.updatedAt || Date.now()),
      settings: { ...base.settings, ...(raw.settings || {}) },
      jumboPrice: typeof raw.jumboPrice === "number" ? raw.jumboPrice : base.jumboPrice,
      addons: Array.isArray(raw.addons) ? raw.addons : base.addons,
      deliveryZones: Array.isArray(raw.deliveryZones) ? raw.deliveryZones : base.deliveryZones,
      combos: Array.isArray(raw.combos) ? raw.combos : base.combos,
      menu: Array.isArray(raw.menu) ? raw.menu : base.menu
    };
  }

  function loadStore() {
    const base = cloneDefaultStore();
    try {
      const savedV2 = JSON.parse(localStorage.getItem(STORE_KEY));
      if (savedV2 && Array.isArray(savedV2.menu)) {
        if (!base.updatedAt || (savedV2.updatedAt || 0) >= (base.updatedAt || 0)) {
          return normalizeStore(savedV2);
        }
      }
      const legacyMenu = JSON.parse(localStorage.getItem(LEGACY_MENU_KEY));
      if (Array.isArray(legacyMenu) && legacyMenu.length) {
        base.menu = legacyMenu;
        return base;
      }
    } catch (e) { /* fall through */ }
    return base;
  }

  async function fetchServerStoreIfNewer() {
    try {
      const res = await fetch("/api/store?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const serverStore = payload && payload.store ? payload.store : payload;
      if (serverStore && Array.isArray(serverStore.menu)) {
        if ((serverStore.updatedAt || 0) > (store.updatedAt || 0)) {
          store = normalizeStore(serverStore);
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(store));
            localStorage.setItem(LEGACY_MENU_KEY, JSON.stringify(store.menu));
          } catch (e) { /* ignore */ }
          renderAll();
        }
      }
    } catch (e) {
      // Static hosting without /api/store endpoint - localStorage + BroadcastChannel handles sync
    }
  }

  function setSyncBadge(stateText, isSynced = true) {
    const badge = $("syncBadge");
    if (!badge) return;
    badge.innerHTML = `<span class="sync-dot" style="background:${isSynced ? "#19C75A" : "#FFB000"}"></span> ${esc(stateText)}`;
  }

  async function saveStore(toastMessage) {
    store.updatedAt = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      localStorage.setItem(LEGACY_MENU_KEY, JSON.stringify(store.menu));
    } catch (e) {
      alert("Browser storage is full. Try using a smaller photo or removing unused photos.");
      return false;
    }

    // Broadcast immediately to any open index.html tab
    if (liveChannel) {
      try {
        liveChannel.postMessage({ type: "STORE_UPDATED", store });
      } catch (e) { /* ignore */ }
    }

    setSyncBadge("Saving & syncing to website...", false);

    // Persist to disk via Node server (/api/store) so menu-data.js and uploads/ stay updated
    try {
      const res = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(store)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.store) {
          store = normalizeStore(data.store);
          try {
            localStorage.setItem(STORE_KEY, JSON.stringify(store));
            localStorage.setItem(LEGACY_MENU_KEY, JSON.stringify(store.menu));
          } catch (e) { /* ignore */ }
          if (liveChannel) {
            try { liveChannel.postMessage({ type: "STORE_UPDATED", store }); } catch (e) {}
          }
        }
        setSyncBadge("Saved & Live on Website!", true);
      } else {
        setSyncBadge("Saved to Browser • Live Sync Active", true);
      }
    } catch (e) {
      setSyncBadge("Saved to Browser • Live Sync Active", true);
    }

    if (toastMessage) toast(toastMessage);
    return true;
  }

  const getPassword = () => localStorage.getItem(PW_KEY) || DEFAULT_PASSWORD;

  /* ---------- Helpers ---------- */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  const naira = (n) => "₦" + Number(n || 0).toLocaleString();

  let toastTimer;
  function toast(msg) {
    const t = $("adminToast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }

  /* Resize an uploaded photo so it stays crisp and fast */
  function resizeImage(file, maxSize = 850, quality = 0.84) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Selected file is not a valid image"));
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Authentication ---------- */
  function updateDefaultPwHint() {
    const hint = $("defaultPwHint");
    if (!hint) return;
    const isDefault = getPassword() === DEFAULT_PASSWORD;
    hint.hidden = !isDefault;
  }

  function showDashboard() {
    $("loginScreen").hidden = true;
    $("dashboard").hidden = false;
    store = loadStore();
    renderAll();
    fetchServerStoreIfNewer();
  }

  function showLogin() {
    $("dashboard").hidden = true;
    $("loginScreen").hidden = false;
    $("loginPassword").value = "";
    updateDefaultPwHint();
  }

  if ($("togglePwBtn")) {
    $("togglePwBtn").addEventListener("click", () => {
      const inp = $("loginPassword");
      const icon = $("togglePwBtn").querySelector("i");
      if (inp.type === "password") {
        inp.type = "text";
        if (icon) icon.className = "fas fa-eye-slash";
      } else {
        inp.type = "password";
        if (icon) icon.className = "fas fa-eye";
      }
    });
  }

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const enteredPw = $("loginPassword").value;
    if (enteredPw === getPassword()) {
      sessionStorage.setItem(SESSION_KEY, "1");
      $("loginError").hidden = true;
      showDashboard();
      toast("Welcome to the Sated & Salted Admin Portal!");
    } else {
      $("loginError").hidden = false;
    }
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  /* ---------- Tab Navigation ---------- */
  document.querySelectorAll(".admin-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
      tabBtn.classList.add("active");
      const targetId = tabBtn.dataset.tab;
      ["tabMenu", "tabCombos", "tabAddons", "tabSettings"].forEach((id) => {
        const panel = $(id);
        if (panel) panel.hidden = id !== targetId;
      });
    });
  });

  /* ---------- Master Render ---------- */
  function renderAll() {
    renderStats();
    renderMenuTab();
    renderCombosTab();
    renderAddonsTab();
    renderSettingsTab();
  }

  function renderStats() {
    const items = store.menu || [];
    const live = items.filter((i) => i.available !== false).length;
    $("statTotal").textContent = items.length;
    $("statLive").textContent = live;
    $("statHidden").textContent = items.length - live;
    const avg = items.length
      ? Math.round(items.reduce((s, i) => s + Number(i.price || 0), 0) / items.length)
      : 0;
    $("statAvg").textContent = naira(avg);
  }

  /* ---------- TAB 1: MENU & DISH PHOTOS ---------- */
  function renderMenuTab() {
    const q = ($("adminSearch").value || "").toLowerCase().trim();
    const cat = $("adminCategoryFilter").value || "all";
    const items = store.menu || [];
    const heroId = store.settings && store.settings.heroDishId;

    const filtered = items.filter((i) =>
      (cat === "all" || i.category === cat) &&
      (!q ||
        (i.name || "").toLowerCase().includes(q) ||
        (i.desc || "").toLowerCase().includes(q) ||
        (i.badge || "").toLowerCase().includes(q))
    );

    $("itemsGrid").innerHTML = filtered.length
      ? filtered.map((i) => {
          const isHero = i.id === heroId;
          return `
          <article class="item-card ${i.available === false ? "is-hidden" : ""}" data-card-id="${esc(i.id)}">
            <div class="item-img">
              <img src="${esc(i.img)}" alt="${esc(i.name)}" onerror="this.src='SATED & SALTED.png'">
              <span class="item-status">${i.available === false ? "Hidden" : "Live"}</span>
              <button type="button" class="item-hero-btn ${isHero ? "is-hero" : ""}" data-act="hero" data-id="${esc(i.id)}" title="Feature this dish in the Hero banner">
                <i class="fas fa-star"></i> ${isHero ? "Hero Dish" : "Set Hero"}
              </button>
              <button type="button" class="item-quick-photo-btn" data-act="quick-photo" data-id="${esc(i.id)}">
                <i class="fas fa-camera"></i> Change Photo
              </button>
            </div>
            <div class="item-body">
              <span class="item-cat">${esc(CATEGORY_LABELS[i.category] || i.category)} &bull; ${esc(i.badge || "Fresh")}</span>
              <h3 class="item-name">${esc(i.name)}</h3>
              <p class="item-desc-short">${esc(i.desc || "")}</p>

              <div class="quick-price-row">
                <span>₦</span>
                <input type="number" class="quick-price-input" data-price-id="${esc(i.id)}" value="${Number(i.price || 0)}" min="0" step="50" aria-label="Price for ${esc(i.name)}">
                <button type="button" class="quick-price-save" data-act="quick-price" data-id="${esc(i.id)}">Update Price</button>
              </div>

              <div class="item-actions">
                <button type="button" data-act="edit" data-id="${esc(i.id)}"><i class="fas fa-pen"></i> Full Edit</button>
                <button type="button" data-act="toggle" data-id="${esc(i.id)}"><i class="fas ${i.available === false ? "fa-eye" : "fa-eye-slash"}"></i> ${i.available === false ? "Show" : "Hide"}</button>
                <button type="button" class="del" data-act="delete" data-id="${esc(i.id)}" title="Delete Dish"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          </article>`;
        }).join("")
      : `<div class="empty-state"><i class="fas fa-utensils" style="font-size:2rem;display:block;margin-bottom:8px"></i>No dishes match your filter. Click "Add New Dish" to create one.</div>`;
  }

  $("adminSearch").addEventListener("input", renderMenuTab);
  $("adminCategoryFilter").addEventListener("change", renderMenuTab);

  $("itemsGrid").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const item = (store.menu || []).find((i) => i.id === id);
    if (!item) return;

    const act = btn.dataset.act;

    if (act === "edit") {
      openDishModal(item);
    } else if (act === "quick-price") {
      const input = $("itemsGrid").querySelector(`input[data-price-id="${CSS.escape ? CSS.escape(id) : id}"]`) ||
                    btn.parentElement.querySelector(".quick-price-input");
      const newPrice = Number(input ? input.value : item.price);
      if (!(newPrice >= 0) || input.value === "") return alert("Please enter a valid price.");
      item.price = newPrice;
      await saveStore(`Updated "${item.name}" price to ${naira(newPrice)}`);
      renderStats();
      renderMenuTab();
    } else if (act === "quick-photo") {
      quickPhotoTargetId = id;
      $("quickPhotoInput").value = "";
      $("quickPhotoInput").click();
    } else if (act === "hero") {
      store.settings.heroDishId = item.id;
      await saveStore(`"${item.name}" is now featured in the website Hero banner!`);
      renderMenuTab();
    } else if (act === "toggle") {
      item.available = item.available === false ? true : false;
      await saveStore(item.available ? `"${item.name}" is now live on website` : `"${item.name}" hidden from website`);
      renderStats();
      renderMenuTab();
    } else if (act === "delete") {
      if (confirm(`Delete "${item.name}" from the menu?`)) {
        store.menu = store.menu.filter((i) => i.id !== id);
        await saveStore(`Deleted "${item.name}"`);
        renderStats();
        renderMenuTab();
      }
    }
  });

  // Allow pressing Enter inside a quick-price input to save immediately
  $("itemsGrid").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.classList.contains("quick-price-input")) {
      e.preventDefault();
      const saveBtn = e.target.parentElement.querySelector(".quick-price-save");
      if (saveBtn) saveBtn.click();
    }
  });

  // 1-Click Quick Photo Upload handler
  $("quickPhotoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file || !quickPhotoTargetId) return;
    const item = (store.menu || []).find((i) => i.id === quickPhotoTargetId);
    if (!item) return;
    try {
      toast("Optimizing & uploading photo...");
      const dataUrl = await resizeImage(file);
      item.img = dataUrl;
      await saveStore(`Updated photo for "${item.name}"`);
      renderMenuTab();
    } catch (err) {
      alert(err.message);
    } finally {
      quickPhotoTargetId = null;
      e.target.value = "";
    }
  });

  /* ---------- Add / Edit Dish Modal ---------- */
  function setPreview(src) {
    const box = $("imagePreview");
    if (src) {
      box.classList.add("has-image");
      box.innerHTML = `<img src="${esc(src)}" alt="Preview">`;
    } else {
      box.classList.remove("has-image");
      box.innerHTML = `<i class="fas fa-image"></i><span>No photo yet</span>`;
    }
  }

  function openDishModal(item) {
    $("modalTitle").textContent = item ? "Edit Dish" : "Add New Dish";
    $("itemId").value = item ? item.id : "";
    $("itemName").value = item ? item.name : "";
    $("itemCategory").value = item ? item.category : "spaghetti";
    $("itemPrice").value = item ? item.price : "";
    $("itemDesc").value = item ? item.desc || "" : "";
    $("itemBadge").value = item ? item.badge || "" : "";
    $("itemSpice").value = item ? item.spice || "" : "";
    $("itemTime").value = item ? item.time || "" : "";
    $("itemAvailable").checked = item ? item.available !== false : true;
    $("imageFile").value = "";
    pendingImage = item ? item.img || "" : "";
    setPreview(pendingImage);
    $("itemModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("itemName").focus();
  }

  function closeDishModal() {
    $("itemModal").hidden = true;
    document.body.style.overflow = "";
  }

  $("addItemBtn").addEventListener("click", () => openDishModal(null));
  $("closeModalBtn").addEventListener("click", closeDishModal);
  $("cancelModalBtn").addEventListener("click", closeDishModal);
  $("itemModal").addEventListener("mousedown", (e) => {
    if (e.target === $("itemModal")) closeDishModal();
  });

  $("imageFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingImage = await resizeImage(file);
      setPreview(pendingImage);
    } catch (err) {
      alert(err.message);
    }
  });

  $("removeImageBtn").addEventListener("click", () => {
    pendingImage = "";
    $("imageFile").value = "";
    setPreview("");
  });

  $("itemForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("itemName").value.trim();
    const price = Number($("itemPrice").value);
    if (!name) return alert("Please enter the dish name.");
    if (!(price >= 0) || $("itemPrice").value === "") return alert("Please enter a valid price.");

    const id = $("itemId").value;
    const existing = id ? store.menu.find((i) => i.id === id) : null;

    const data = {
      id: existing ? existing.id : "item-" + Date.now(),
      name,
      category: $("itemCategory").value,
      price,
      img: pendingImage || "SATED & SALTED.png",
      badge: $("itemBadge").value.trim() || "Fresh Today",
      spice: $("itemSpice").value.trim() || "Delicious",
      rating: existing ? existing.rating : "5.0",
      reviews: existing ? existing.reviews : 12,
      time: $("itemTime").value.trim() || "20-30 mins",
      desc: $("itemDesc").value.trim(),
      available: $("itemAvailable").checked
    };

    if (existing) {
      store.menu[store.menu.indexOf(existing)] = data;
    } else {
      store.menu.unshift(data);
    }

    if (await saveStore(existing ? `Saved changes to "${data.name}"` : `Added "${data.name}" to live menu`)) {
      closeDishModal();
      renderStats();
      renderMenuTab();
    }
  });

  /* ---------- TAB 2: COMBOS & DEALS ---------- */
  function renderCombosTab() {
    const combos = store.combos || [];
    $("combosAdminGrid").innerHTML = combos.length
      ? combos.map((c) => `
        <article class="item-card ${c.available === false ? "is-hidden" : ""}">
          <div class="item-body">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span class="item-cat">${esc(c.ribbon || "Value Combo")}</span>
              ${c.featured ? `<span style="background:#FFB000;border:2px solid #2B1208;border-radius:999px;padding:2px 10px;font-size:.72rem;font-weight:800;">★ Featured</span>` : ""}
            </div>
            <h3 class="item-name">${esc(c.name)}</h3>
            <p class="item-desc-short">${esc(c.sub || "")}</p>
            <ul style="margin:6px 0 8px 18px;font-size:.82rem;color:#2B1208;font-weight:600;">
              ${(c.items || []).map((line) => `<li>${esc(line)}</li>`).join("")}
            </ul>
            <div style="display:flex;align-items:baseline;gap:8px;margin-top:auto;">
              ${c.originalPrice ? `<span style="text-decoration:line-through;color:#6F5547;font-size:.85rem;font-weight:700;">${naira(c.originalPrice)}</span>` : ""}
              <strong style="font-family:var(--font-h);font-size:1.35rem;font-weight:900;color:var(--primary);">${naira(c.price)}</strong>
            </div>
            <div class="item-actions">
              <button type="button" data-combo-act="edit" data-id="${esc(c.id)}"><i class="fas fa-pen"></i> Edit Combo</button>
              <button type="button" data-combo-act="toggle" data-id="${esc(c.id)}"><i class="fas ${c.available === false ? "fa-eye" : "fa-eye-slash"}"></i> ${c.available === false ? "Show" : "Hide"}</button>
              <button type="button" class="del" data-combo-act="delete" data-id="${esc(c.id)}"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </article>
      `).join("")
      : `<div class="empty-state">No combo deals yet. Click "Add New Combo" to create one.</div>`;
  }

  function openComboModal(combo) {
    $("comboModalTitle").textContent = combo ? "Edit Combo Deal" : "Add New Combo Deal";
    $("comboId").value = combo ? combo.id : "";
    $("comboName").value = combo ? combo.name : "";
    $("comboSub").value = combo ? combo.sub || "" : "";
    $("comboPrice").value = combo ? combo.price : "";
    $("comboOriginalPrice").value = combo && combo.originalPrice ? combo.originalPrice : "";
    $("comboRibbon").value = combo ? combo.ribbon || "" : "";
    $("comboFeatured").checked = combo ? Boolean(combo.featured) : false;
    $("comboItems").value = combo && Array.isArray(combo.items) ? combo.items.join("\n") : "";
    $("comboModal").hidden = false;
    document.body.style.overflow = "hidden";
    $("comboName").focus();
  }

  function closeComboModal() {
    $("comboModal").hidden = true;
    document.body.style.overflow = "";
  }

  $("addComboBtn").addEventListener("click", () => openComboModal(null));
  $("closeComboModalBtn").addEventListener("click", closeComboModal);
  $("cancelComboModalBtn").addEventListener("click", closeComboModal);
  $("comboModal").addEventListener("mousedown", (e) => {
    if (e.target === $("comboModal")) closeComboModal();
  });

  $("combosAdminGrid").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-combo-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const combo = (store.combos || []).find((c) => c.id === id);
    if (!combo) return;

    const act = btn.dataset.comboAct;
    if (act === "edit") {
      openComboModal(combo);
    } else if (act === "toggle") {
      combo.available = combo.available === false ? true : false;
      await saveStore(combo.available ? `"${combo.name}" shown on website` : `"${combo.name}" hidden`);
      renderCombosTab();
    } else if (act === "delete") {
      if (confirm(`Delete combo "${combo.name}"?`)) {
        store.combos = store.combos.filter((c) => c.id !== id);
        await saveStore(`Deleted combo "${combo.name}"`);
        renderCombosTab();
      }
    }
  });

  $("comboForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("comboName").value.trim();
    const price = Number($("comboPrice").value);
    if (!name || !(price >= 0)) return alert("Please enter a valid combo name and price.");

    const id = $("comboId").value;
    const existing = id ? (store.combos || []).find((c) => c.id === id) : null;
    const lines = $("comboItems").value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const data = {
      id: existing ? existing.id : "combo-" + Date.now(),
      name,
      sub: $("comboSub").value.trim(),
      price,
      originalPrice: Number($("comboOriginalPrice").value) || 0,
      ribbon: $("comboRibbon").value.trim() || "Combo Deal",
      featured: $("comboFeatured").checked,
      items: lines,
      available: existing ? existing.available !== false : true
    };

    if (existing) {
      store.combos[store.combos.indexOf(existing)] = data;
    } else {
      store.combos.push(data);
    }

    await saveStore(existing ? `Updated combo "${data.name}"` : `Added combo "${data.name}"`);
    closeComboModal();
    renderCombosTab();
  });

  /* ---------- TAB 3: ADD-ONS & DELIVERY FEES ---------- */
  function renderAddonsTab() {
    $("jumboPriceInput").value = Number(store.jumboPrice || 0);

    // Add-ons list
    const addons = store.addons || [];
    $("addonsAdminList").innerHTML = addons.map((a, idx) => `
      <div class="stack-row" data-addon-idx="${idx}">
        <input type="text" class="addon-name-inp" value="${esc(a.name)}" placeholder="Add-on name">
        <input type="number" class="addon-price-inp" value="${Number(a.price || 0)}" min="0" step="50" placeholder="Price">
        <button type="button" class="save-row" data-addon-act="save" data-idx="${idx}"><i class="fas fa-check"></i> Save</button>
        <button type="button" class="del-row" data-addon-act="delete" data-idx="${idx}" title="Remove"><i class="fas fa-trash"></i></button>
      </div>
    `).join("");

    // Delivery zones list
    const zones = store.deliveryZones || [];
    $("zonesAdminList").innerHTML = zones.map((z, idx) => `
      <div class="stack-row" data-zone-idx="${idx}">
        <input type="text" class="zone-label-inp" value="${esc(z.name || z.label || "")}" placeholder="Zone description">
        <input type="number" class="zone-fee-inp" value="${Number(z.price != null ? z.price : z.fee || 0)}" min="0" step="100" placeholder="Fee (₦)">
        <button type="button" class="save-row" data-zone-act="save" data-idx="${idx}"><i class="fas fa-check"></i> Save</button>
        <button type="button" class="del-row" data-zone-act="delete" data-idx="${idx}" title="Remove"><i class="fas fa-trash"></i></button>
      </div>
    `).join("");
  }

  $("saveJumboPriceBtn").addEventListener("click", async () => {
    const val = Number($("jumboPriceInput").value);
    if (!(val >= 0)) return alert("Enter a valid Jumbo upgrade price.");
    store.jumboPrice = val;
    await saveStore(`Jumbo Feast Bowl upgrade set to +${naira(val)}`);
  });

  $("addAddonBtn").addEventListener("click", async () => {
    store.addons = store.addons || [];
    store.addons.push({
      id: "addon-" + Date.now(),
      name: "New Extra Portion",
      price: 1000,
      available: true
    });
    await saveStore("Added new add-on extra");
    renderAddonsTab();
  });

  $("addonsAdminList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-addon-act]");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const row = btn.closest(".stack-row");
    if (!store.addons[idx]) return;

    if (btn.dataset.addonAct === "save") {
      const name = row.querySelector(".addon-name-inp").value.trim();
      const price = Number(row.querySelector(".addon-price-inp").value);
      if (!name) return alert("Enter an add-on name.");
      store.addons[idx].name = name;
      store.addons[idx].price = price >= 0 ? price : 0;
      await saveStore(`Saved add-on "${name}" (${naira(store.addons[idx].price)})`);
      renderAddonsTab();
    } else if (btn.dataset.addonAct === "delete") {
      const removed = store.addons.splice(idx, 1)[0];
      await saveStore(`Removed add-on "${removed.name}"`);
      renderAddonsTab();
    }
  });

  $("addZoneBtn").addEventListener("click", async () => {
    store.deliveryZones = store.deliveryZones || [];
    store.deliveryZones.push({
      id: "zone-" + Date.now(),
      name: "New Delivery Area",
      label: "New Delivery Area",
      price: 2000,
      fee: 2000
    });
    await saveStore("Added new delivery zone");
    renderAddonsTab();
  });

  $("zonesAdminList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-zone-act]");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const row = btn.closest(".stack-row");
    if (!store.deliveryZones[idx]) return;

    if (btn.dataset.zoneAct === "save") {
      const label = row.querySelector(".zone-label-inp").value.trim();
      const fee = Number(row.querySelector(".zone-fee-inp").value);
      if (!label) return alert("Enter a delivery zone label.");
      store.deliveryZones[idx].name = label;
      store.deliveryZones[idx].label = label;
      store.deliveryZones[idx].price = fee >= 0 ? fee : 0;
      store.deliveryZones[idx].fee = fee >= 0 ? fee : 0;
      await saveStore(`Saved delivery zone "${label}" (${naira(store.deliveryZones[idx].price)})`);
      renderAddonsTab();
    } else if (btn.dataset.zoneAct === "delete") {
      const removed = store.deliveryZones.splice(idx, 1)[0];
      await saveStore(`Removed delivery zone "${removed.name || removed.label}"`);
      renderAddonsTab();
    }
  });

  /* ---------- TAB 4: STORE SETTINGS & SECURITY ---------- */
  function renderSettingsTab() {
    const s = store.settings || {};
    $("setWhatsapp").value = s.whatsapp || s.whatsappNumber || "2348164475960";
    $("setWhatsappDisplay").value = s.whatsappDisplay || "+234 816 447 5960";
    $("setAddress").value = s.address || "78b, Green Street, Isolo Housing Estate, Lagos";
    $("setPromoText").value = s.promoText || "";
    $("setHeroPill").value = s.heroPillText || "";
    $("setKitchenStatus").value = s.kitchenStatusMode || "auto";
  }

  $("storeSettingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cleanWa = $("setWhatsapp").value.replace(/[^\d]/g, "") || "2348164475960";
    store.settings = {
      ...store.settings,
      whatsapp: cleanWa,
      whatsappNumber: cleanWa,
      whatsappDisplay: $("setWhatsappDisplay").value.trim() || "+234 816 447 5960",
      address: $("setAddress").value.trim() || "78b, Green Street, Isolo Housing Estate, Lagos",
      promoText: $("setPromoText").value.trim(),
      heroPillText: $("setHeroPill").value.trim(),
      kitchenStatusMode: $("setKitchenStatus").value
    };
    await saveStore("Storefront settings saved & updated on website!");
  });

  $("savePasswordBtn").addEventListener("click", () => {
    const pw = $("newPassword").value;
    if (pw.length < 6) return alert("Password must be at least 6 characters.");
    localStorage.setItem(PW_KEY, pw);
    $("newPassword").value = "";
    updateDefaultPwHint();
    toast("Admin password updated!");
  });

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sated-and-salted-store-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Full store backup exported");
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          // Legacy menu-only array export
          store.menu = data;
        } else if (data && Array.isArray(data.menu)) {
          store = normalizeStore(data);
        } else {
          throw new Error("Invalid backup file");
        }
        await saveStore("Backup imported & synced to website!");
        renderAll();
      } catch (err) {
        alert("That file is not a valid Sated & Salted backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("resetBtn").addEventListener("click", async () => {
    if (!confirm("Restore all menu items, prices, combos, and settings to factory defaults?")) return;
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(LEGACY_MENU_KEY);
    store = cloneDefaultStore();
    await saveStore("Store reset to factory defaults");
    renderAll();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("itemModal").hidden) closeDishModal();
      if (!$("comboModal").hidden) closeComboModal();
    }
  });

  /* ---------- Init ---------- */
  updateDefaultPwHint();
  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    showDashboard();
  } else {
    showLogin();
  }
})();
