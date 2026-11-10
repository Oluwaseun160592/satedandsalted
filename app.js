/**
 * SATED & SALTED - Public Website JavaScript (app.js)
 * Real-time Live Sync with Admin Portal (menu-data.js, /api/store, localStorage & BroadcastChannel)
 * Drives Menu, Hero Dish, Combos, Add-ons, Delivery Fees, Store Settings, Search Dropdown & WhatsApp Checkout.
 */

const STORE_KEY = "ss_store_v2";
const LEGACY_MENU_KEY = "ss_menu";

function cloneDeep(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function buildInitialStore() {
  const base = cloneDeep(
    window.SS_DEFAULT_STORE || {
      updatedAt: 0,
      settings: {
        whatsapp: "2348164475960",
        whatsappDisplay: "+234 816 447 5960",
        address: "78b, Green Street, Isolo Housing Estate, Lagos",
        promoText: "Free Chilled Drink on orders above ₦15,000!",
        kitchenStatusMode: "auto",
        heroDishId: "gizdodo",
        heroPillText: "#1 Gizdodo in Town"
      },
      jumboPrice: 1500,
      addons: [],
      deliveryZones: [],
      combos: [],
      menu: window.SS_DEFAULT_MENU || []
    }
  );

  // Check localStorage for v2 store or legacy ss_menu
  try {
    const savedV2 = JSON.parse(localStorage.getItem(STORE_KEY));
    if (savedV2 && Array.isArray(savedV2.menu)) {
      if (!base.updatedAt || (savedV2.updatedAt || 0) >= (base.updatedAt || 0)) {
        return Object.assign({}, base, savedV2, {
          settings: Object.assign({}, base.settings, savedV2.settings || {})
        });
      }
    }
  } catch (e) {}

  try {
    const legacyMenu = JSON.parse(localStorage.getItem(LEGACY_MENU_KEY));
    if (Array.isArray(legacyMenu) && legacyMenu.length > 0) {
      base.menu = legacyMenu;
    }
  } catch (e) {}

  return base;
}

let SS_STORE = buildInitialStore();
let MENU_ITEMS = SS_STORE.menu;
let VENDOR_WHATSAPP_NUMBER = (SS_STORE.settings && SS_STORE.settings.whatsapp) || "2348164475960";
let DELIVERY_RATES = {};

function rebuildDeliveryRatesMap() {
  DELIVERY_RATES = {};
  (SS_STORE.deliveryZones || []).forEach((z) => {
    DELIVERY_RATES[z.id] = Number(z.price || 0);
  });
  if (Object.keys(DELIVERY_RATES).length === 0) {
    DELIVERY_RATES = {
      "pickup": 0,
      "island-near": 1500,
      "island-far": 2500,
      "mainland-near": 2000,
      "mainland-far": 3000
    };
  }
}
rebuildDeliveryRatesMap();

let cart = [];
let currentCustomizingItem = null;
let activeCategory = "all";

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function formatNaira(amount) {
  return "₦" + Number(amount || 0).toLocaleString();
}

// Sound synthesizer using Web Audio API
function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

/* ==========================================================================
   Store Application: Syncs Hero, Menu, Combos, Addons, Zones & Settings
   ========================================================================== */
function applyStoreToWebsite(newStore) {
  if (newStore && Array.isArray(newStore.menu)) {
    SS_STORE = newStore;
    // Mutate MENU_ITEMS in place so any external references stay valid
    MENU_ITEMS.splice(0, MENU_ITEMS.length, ...SS_STORE.menu);
  }

  VENDOR_WHATSAPP_NUMBER =
    (SS_STORE.settings && SS_STORE.settings.whatsapp) || "2348164475960";
  rebuildDeliveryRatesMap();

  renderStoreSettingsUI();
  renderHeroDishUI();
  renderMarqueeUI();
  filterAndRenderMenu();
  renderCombosUI();
  renderModalAddonsUI();
  renderDeliveryZonesUI();
  syncCartWithLatestPrices();
  updateCartUI();
}

function renderStoreSettingsUI() {
  const s = SS_STORE.settings || {};
  const waNum = (s.whatsapp || "2348164475960").replace(/\D/g, "");
  const waDisplay = s.whatsappDisplay || "+234 816 447 5960";
  const address = s.address || "78b, Green Street, Isolo Housing Estate, Lagos";
  const promoText = s.promoText || "Free Chilled Drink on orders above ₦15,000!";

  const topAddr = document.getElementById("topBarAddress");
  if (topAddr) {
    topAddr.innerHTML = `📍 <strong>Kitchen:</strong> ${escapeHtml(address)}`;
  }

  const topPromo = document.getElementById("topBarPromo");
  if (topPromo) {
    topPromo.innerHTML = `🔥 ${escapeHtml(promoText)}`;
  }

  const contactAddr = document.getElementById("contactAddressText");
  if (contactAddr) contactAddr.textContent = address;

  const footerAddr = document.getElementById("footerAddressText");
  if (footerAddr) footerAddr.textContent = address;

  const contactWaLink = document.getElementById("contactWhatsappLink");
  if (contactWaLink) {
    contactWaLink.href = `https://wa.me/${waNum}`;
    contactWaLink.textContent = waDisplay;
  }

  const contactWaBtn = document.getElementById("contactWhatsappBtn");
  if (contactWaBtn) {
    contactWaBtn.href = `https://wa.me/${waNum}?text=Hello%20Sated%20%26%20Salted!%20I%20want%20to%20order%20food.`;
    contactWaBtn.innerHTML = `<i class="fab fa-whatsapp"></i> Chat & Order on WhatsApp (${escapeHtml(waDisplay)})`;
  }

  const footerWaLink = document.getElementById("footerWhatsappLink");
  if (footerWaLink) {
    footerWaLink.href = `https://wa.me/${waNum}`;
    footerWaLink.textContent = waDisplay;
  }

  const headerWaBtn = document.getElementById("headerWhatsappBtn");
  if (headerWaBtn) {
    headerWaBtn.href = `https://wa.me/${waNum}?text=Hello%20Sated%20%26%20Salted!%20I%20would%20like%20to%20place%20an%20order.`;
  }

  const heroWaBtn = document.getElementById("heroWhatsappBtn");
  if (heroWaBtn) {
    heroWaBtn.href = `https://wa.me/${waNum}?text=Hi!%20I%20want%20to%20order%20food%20from%20Sated%20%26%20Salted`;
  }

  const floatingWa = document.querySelector(".floating-whatsapp-btn");
  if (floatingWa) {
    floatingWa.href = `https://wa.me/${waNum}?text=Hello%20Sated%20%26%20Salted!%20I%20would%20like%20to%20order%20food.`;
    floatingWa.title = `Order via WhatsApp (${waDisplay})`;
  }

  updateKitchenStatus();
}

function updateKitchenStatus() {
  const statusEl = document.getElementById("kitchenStatusIndicator");
  if (!statusEl) return;

  const mode = (SS_STORE.settings && SS_STORE.settings.kitchenStatusMode) || "auto";
  let isOpen = true;

  if (mode === "open") {
    isOpen = true;
  } else if (mode === "closed") {
    isOpen = false;
  } else {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    isOpen = day !== 0 && hour >= 10 && hour < 21;
  }

  if (isOpen) {
    statusEl.className = "kitchen-status-pill";
    statusEl.innerHTML = `<span class="status-dot"></span> Kitchen Open & Cooking (30-45m delivery)`;
  } else {
    statusEl.className = "kitchen-status-pill closed";
    statusEl.innerHTML = `<span class="status-dot"></span> Kitchen Closed (Pre-orders accepted for 10 AM)`;
  }
}

function renderHeroDishUI() {
  const available = MENU_ITEMS.filter((i) => i.available !== false);
  const heroId = SS_STORE.settings && SS_STORE.settings.heroDishId;
  const heroDish =
    available.find((i) => i.id === heroId) ||
    MENU_ITEMS.find((i) => i.id === heroId) ||
    available[0] ||
    MENU_ITEMS[0];

  if (!heroDish) return;

  const imgEl = document.getElementById("heroDishImg");
  const badgeEl = document.getElementById("heroDishBadge");
  const titleEl = document.getElementById("heroDishTitle");
  const descEl = document.getElementById("heroDishDesc");
  const priceEl = document.getElementById("heroDishPrice");
  const addBtn = document.getElementById("heroDishAddBtn");
  const pillEl = document.getElementById("heroPill1Text");

  if (imgEl) {
    imgEl.src = heroDish.img || "SATED & SALTED.png";
    imgEl.alt = heroDish.name;
  }
  if (badgeEl) badgeEl.textContent = heroDish.badge || "🔥 Chef's Signature";
  if (titleEl) titleEl.textContent = heroDish.name;
  if (descEl) {
    const shortDesc =
      heroDish.desc && heroDish.desc.length > 68
        ? heroDish.desc.slice(0, 65) + "..."
        : heroDish.desc || "Freshly prepared daily";
    descEl.textContent = shortDesc;
  }
  if (priceEl) priceEl.textContent = formatNaira(heroDish.price);
  if (addBtn) {
    addBtn.setAttribute("onclick", `addToCart('${escapeHtml(heroDish.id)}')`);
  }
  if (pillEl && SS_STORE.settings && SS_STORE.settings.heroPillText) {
    pillEl.textContent = SS_STORE.settings.heroPillText;
  }
}

function renderMarqueeUI() {
  const track = document.getElementById("marqueeTrack");
  if (!track) return;
  const liveNames = MENU_ITEMS.filter((i) => i.available !== false).map((i) => i.name);
  if (liveNames.length === 0) return;
  const list = [...liveNames, "Delicacy at its Best"];
  const spans = list.map((name) => `<span>${escapeHtml(name)} &#9733;</span>`).join("");
  track.innerHTML = spans + spans;
}

function renderCombosUI() {
  const grid = document.getElementById("specialsGrid");
  if (!grid || !Array.isArray(SS_STORE.combos)) return;

  const liveCombos = SS_STORE.combos.filter((c) => c.available !== false);
  if (liveCombos.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;">No combo deals currently active.</div>`;
    return;
  }

  grid.innerHTML = liveCombos
    .map((c) => {
      const bullets = Array.isArray(c.items)
        ? c.items.map((line) => `<li><i class="fas fa-check-circle"></i> ${escapeHtml(line)}</li>`).join("")
        : "";
      return `
        <div class="special-card ${c.featured ? "featured-combo" : ""}">
          ${c.ribbon ? `<span class="combo-ribbon">${escapeHtml(c.ribbon)}</span>` : ""}
          <h3>${escapeHtml(c.name)}</h3>
          <p class="special-sub">${escapeHtml(c.sub || "")}</p>
          <ul class="combo-items-list">${bullets}</ul>
          <div class="combo-pricing">
            <span class="combo-current-price">${formatNaira(c.price)}</span>
            ${c.originalPrice ? `<span class="combo-original-price">${formatNaira(c.originalPrice)}</span>` : ""}
          </div>
          <button class="btn-primary" data-combo-id="${escapeHtml(c.id)}">
            <i class="fas fa-plus"></i> Add Combo to Tray
          </button>
        </div>
      `;
    })
    .join("");

  grid.querySelectorAll("button[data-combo-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const combo = SS_STORE.combos.find((x) => x.id === btn.getAttribute("data-combo-id"));
      if (combo) {
        addComboToCart(combo.id, combo.name, Number(combo.price), combo.img);
      }
    });
  });
}

function renderModalAddonsUI() {
  const jumboLabel = document.getElementById("jumboPriceLabel");
  if (jumboLabel) {
    jumboLabel.textContent = "+" + formatNaira(SS_STORE.jumboPrice || 1500);
  }

  const listEl = document.getElementById("modalAddonsList");
  if (!listEl || !Array.isArray(SS_STORE.addons)) return;

  const liveAddons = SS_STORE.addons.filter((a) => a.available !== false);
  listEl.innerHTML = liveAddons
    .map(
      (a) => `
      <label class="addon-label">
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" class="modal-addon-checkbox" data-name="${escapeHtml(a.name)}" data-price="${Number(a.price || 0)}">
          <span class="addon-info">${escapeHtml(a.name)}</span>
        </div>
        <span style="font-size: 0.85rem; color: var(--primary); font-weight: 700;">+${formatNaira(a.price)}</span>
      </label>
    `
    )
    .join("");

  listEl.querySelectorAll(".modal-addon-checkbox").forEach((cb) => {
    cb.addEventListener("change", recalcModalPrice);
  });
}

function renderDeliveryZonesUI() {
  const select = document.getElementById("deliveryZoneSelect");
  if (!select || !Array.isArray(SS_STORE.deliveryZones) || SS_STORE.deliveryZones.length === 0) return;

  const currentVal = select.value;
  select.innerHTML = SS_STORE.deliveryZones
    .map((z) => {
      const priceTag = Number(z.price) === 0 ? "₦0 Free" : `+${formatNaira(z.price)}`;
      return `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name)} (${priceTag})</option>`;
    })
    .join("");

  if (currentVal && SS_STORE.deliveryZones.some((z) => z.id === currentVal)) {
    select.value = currentVal;
  }
}

function syncCartWithLatestPrices() {
  let changed = false;
  cart.forEach((ci) => {
    if (!ci.customized) {
      const dish = MENU_ITEMS.find((m) => m.id === ci.id);
      if (dish) {
        if (ci.price !== Number(dish.price) || ci.name !== dish.name || ci.img !== dish.img) {
          ci.price = Number(dish.price);
          ci.name = dish.name;
          ci.img = dish.img;
          changed = true;
        }
      } else if (Array.isArray(SS_STORE.combos)) {
        const combo = SS_STORE.combos.find((c) => c.id === ci.id);
        if (combo && (ci.price !== Number(combo.price) || ci.name !== combo.name)) {
          ci.price = Number(combo.price);
          ci.name = combo.name;
          changed = true;
        }
      }
    }
  });
  if (changed) saveCart();
}

/* ==========================================================================
   Cart State & Actions
   ========================================================================== */
function initCart() {
  try {
    const saved = localStorage.getItem("sated_salted_cart");
    if (saved) {
      cart = JSON.parse(saved);
    }
  } catch (e) {
    cart = [];
  }
  syncCartWithLatestPrices();
  updateCartUI();
  updateKitchenStatus();
}

function saveCart() {
  try {
    localStorage.setItem("sated_salted_cart", JSON.stringify(cart));
  } catch (e) {}
  updateCartUI();
}

function addToCart(itemId, customQty = 1) {
  const item = MENU_ITEMS.find((m) => m.id === itemId);
  if (!item) return;

  const existing = cart.find((ci) => ci.id === itemId && !ci.customized);
  if (existing) {
    existing.qty += customQty;
    existing.price = Number(item.price);
    existing.name = item.name;
    existing.img = item.img;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      img: item.img,
      qty: customQty,
      customized: false
    });
  }

  saveCart();
  playOrderChime();
  showToast(`Added ${item.name} to your tray!`);
}

function addComboToCart(comboId, name, price, img) {
  const existing = cart.find((ci) => ci.id === comboId);
  if (existing) {
    existing.qty += 1;
    existing.price = Number(price);
  } else {
    cart.push({
      id: comboId,
      name: name,
      price: Number(price),
      img: img || "SATED & SALTED.png",
      qty: 1,
      customized: false
    });
  }
  saveCart();
  playOrderChime();
  showToast(`Added ${name} to your tray!`);
  openCartDrawer();
}

function openCustomizeModal(itemId) {
  const item = MENU_ITEMS.find((m) => m.id === itemId);
  if (!item) return;

  currentCustomizingItem = item;

  const modalOverlay = document.getElementById("dishModalOverlay");
  const modalImg = document.getElementById("modalDishImg");
  const modalTitle = document.getElementById("modalDishTitle");
  const modalDesc = document.getElementById("modalDishDesc");
  const modalPrice = document.getElementById("modalPriceDisplay");

  if (modalImg) modalImg.src = item.img || "SATED & SALTED.png";
  if (modalTitle) modalTitle.textContent = item.name;
  if (modalDesc) modalDesc.textContent = item.desc;
  if (modalPrice) modalPrice.textContent = formatNaira(item.price);

  const regRadio = document.getElementById("portionRegular");
  if (regRadio) regRadio.checked = true;

  document.querySelectorAll(".modal-addon-checkbox").forEach((cb) => (cb.checked = false));

  const notes = document.getElementById("modalItemNotes");
  if (notes) notes.value = "";

  recalcModalPrice();

  if (modalOverlay) {
    modalOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeCustomizeModal() {
  const modalOverlay = document.getElementById("dishModalOverlay");
  if (modalOverlay) {
    modalOverlay.classList.remove("open");
    document.body.style.overflow = "auto";
  }
  currentCustomizingItem = null;
}

function recalcModalPrice() {
  if (!currentCustomizingItem) return 0;

  let total = Number(currentCustomizingItem.price || 0);
  const isJumbo = document.getElementById("portionJumbo") && document.getElementById("portionJumbo").checked;
  if (isJumbo) total += Number(SS_STORE.jumboPrice || 1500);

  document.querySelectorAll(".modal-addon-checkbox:checked").forEach((cb) => {
    total += Number(cb.getAttribute("data-price") || 0);
  });

  const displayEl = document.getElementById("modalPriceDisplay");
  if (displayEl) displayEl.textContent = formatNaira(total);

  return total;
}

function confirmModalCustomization() {
  if (!currentCustomizingItem) return;

  const isJumbo = document.getElementById("portionJumbo") && document.getElementById("portionJumbo").checked;
  const portionName = isJumbo ? "Jumbo Feast Bowl" : "Standard Bowl";

  const selectedAddons = [];
  document.querySelectorAll(".modal-addon-checkbox:checked").forEach((cb) => {
    selectedAddons.push({
      name: cb.getAttribute("data-name"),
      price: Number(cb.getAttribute("data-price"))
    });
  });

  const spiceEl = document.getElementById("modalSpiceSelect");
  const spice = spiceEl ? spiceEl.value : "Hot & Spicy";

  const notesEl = document.getElementById("modalItemNotes");
  const notes = notesEl ? notesEl.value.trim() : "";

  const finalUnitPrice = recalcModalPrice();
  const customId = currentCustomizingItem.id + "-custom-" + Date.now();
  const customLabel = `${currentCustomizingItem.name} (${portionName}${
    selectedAddons.length > 0 ? " + " + selectedAddons.map((a) => a.name).join(", ") : ""
  })`;

  cart.push({
    id: customId,
    name: customLabel,
    price: finalUnitPrice,
    img: currentCustomizingItem.img,
    qty: 1,
    customized: true,
    spice: spice,
    notes: notes
  });

  saveCart();
  playOrderChime();
  closeCustomizeModal();
  showToast(`Customized meal added to your tray!`);
  openCartDrawer();
}

function updateCartItemQty(itemId, delta) {
  const index = cart.findIndex((ci) => ci.id === itemId);
  if (index === -1) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  saveCart();
}

function removeCartItem(itemId) {
  cart = cart.filter((ci) => ci.id !== itemId);
  saveCart();
  showToast("Item removed from tray");
}

function clearCart() {
  if (cart.length === 0) return;
  if (confirm("Are you sure you want to clear your food tray?")) {
    cart = [];
    saveCart();
    showToast("Food tray cleared");
  }
}

function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  document.querySelectorAll(".cart-count-badge").forEach((b) => (b.textContent = totalItems));
  document.querySelectorAll(".cart-total-badge").forEach((b) => (b.textContent = formatNaira(subtotal)));

  const cartList = document.getElementById("cartItemsList");
  const emptyState = document.getElementById("cartEmptyState");
  const checkoutSection = document.getElementById("cartCheckoutSection");
  const subtotalEl = document.getElementById("cartSubtotal");
  const deliveryFeeEl = document.getElementById("cartDeliveryFee");
  const grandTotalEl = document.getElementById("cartGrandTotal");

  if (!cartList) return;

  if (cart.length === 0) {
    emptyState.style.display = "block";
    cartList.innerHTML = "";
    if (checkoutSection) checkoutSection.style.display = "none";
  } else {
    emptyState.style.display = "none";
    if (checkoutSection) checkoutSection.style.display = "block";

    cartList.innerHTML = cart
      .map(
        (item) => `
      <div class="cart-item-card">
        <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" class="cart-item-img" onerror="this.src='SATED & SALTED.png'">
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">${formatNaira(item.price)} each</div>
          <div class="cart-item-stepper">
            <button class="stepper-btn" onclick="updateCartItemQty('${escapeHtml(item.id)}', -1)" title="Decrease">
              <i class="fas fa-minus"></i>
            </button>
            <span class="stepper-qty">${item.qty}</span>
            <button class="stepper-btn" onclick="updateCartItemQty('${escapeHtml(item.id)}', 1)" title="Increase">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
        <button class="cart-item-delete" onclick="removeCartItem('${escapeHtml(item.id)}')" title="Remove">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `
      )
      .join("");

    const zoneSelect = document.getElementById("deliveryZoneSelect");
    const zone = zoneSelect ? zoneSelect.value : "island-near";
    const deliveryFee = DELIVERY_RATES[zone] !== undefined ? DELIVERY_RATES[zone] : 1500;
    const grandTotal = subtotal + deliveryFee;

    if (subtotalEl) subtotalEl.textContent = formatNaira(subtotal);
    if (deliveryFeeEl) deliveryFeeEl.textContent = deliveryFee === 0 ? "Free (Pickup)" : formatNaira(deliveryFee);
    if (grandTotalEl) grandTotalEl.textContent = formatNaira(grandTotal);
  }
}

/* ==========================================================================
   Menu Rendering & Filtering
   ========================================================================== */
function renderMenu(itemsToRender = MENU_ITEMS) {
  const container = document.getElementById("menuGrid");
  if (!container) return;
  itemsToRender = itemsToRender.filter((i) => i.available !== false);

  if (itemsToRender.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fas fa-utensils" style="font-size: 2.5rem; margin-bottom: 12px; color: var(--text-dim); display: block;"></i>
        <h3>No dishes found matching your search.</h3>
        <p>Try searching for Jollof, Stir-fry, Yam, or Gizdodo.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = itemsToRender
    .map(
      (item) => `
    <div class="food-card" data-category="${escapeHtml(item.category)}">
      <div class="food-img-wrap" onclick="openCustomizeModal('${escapeHtml(item.id)}')" style="cursor: pointer;" title="Click to customize">
        <img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='SATED & SALTED.png'">
        <span class="food-badge">${escapeHtml(item.badge || "Fresh Today")}</span>
        <span class="food-spice-tag">${escapeHtml(item.spice || "Tasty")}</span>
      </div>
      <div class="food-content">
        <div class="food-meta">
          <div class="food-rating">
            <i class="fas fa-star"></i>
            <span>${escapeHtml(item.rating || "5.0")} (${Number(item.reviews || 0)})</span>
          </div>
          <div class="food-prep-time">
            <i class="far fa-clock"></i>
            <span>${escapeHtml(item.time || "20-30 mins")}</span>
          </div>
        </div>
        <h3 class="food-title" onclick="openCustomizeModal('${escapeHtml(item.id)}')" style="cursor: pointer;">${escapeHtml(item.name)}</h3>
        <p class="food-desc">${escapeHtml(item.desc || "")}</p>
        <div class="food-footer">
          <div class="food-price-box">
            <span class="food-price-label">Price</span>
            <span class="food-price">${formatNaira(item.price)}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="food-add-btn" onclick="openCustomizeModal('${escapeHtml(item.id)}')" title="Customize portion & add-ons" style="background: rgba(255, 179, 0, 0.15); border-color: rgba(255, 179, 0, 0.35); color: var(--accent);">
              <i class="fas fa-sliders"></i>
            </button>
            <button class="food-add-btn" onclick="addToCart('${escapeHtml(item.id)}')" title="Quick Add">
              <i class="fas fa-plus"></i> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  `
    )
    .join("");
}

function filterAndRenderMenu() {
  const searchInput = document.getElementById("menuSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const filtered = MENU_ITEMS.filter((item) => {
    const matchCat = activeCategory === "all" || item.category === activeCategory;
    const matchSearch =
      query === "" ||
      (item.name || "").toLowerCase().includes(query) ||
      (item.desc || "").toLowerCase().includes(query) ||
      (item.spice || "").toLowerCase().includes(query) ||
      (item.category || "").toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  renderMenu(filtered);
}

function setupFilters() {
  const catButtons = document.querySelectorAll(".cat-btn");
  const searchInput = document.getElementById("menuSearchInput");

  catButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      catButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.getAttribute("data-cat") || "all";
      filterAndRenderMenu();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", filterAndRenderMenu);
  }
}

/* ==========================================================================
   Search Dropdown (Interactive Suggestions under the Search Box)
   ========================================================================== */
function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const q = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp("(" + q + ")", "ig"), "<mark>$1</mark>");
}

function setupSearchDropdown() {
  const input = document.getElementById("menuSearchInput");
  const dropdown = document.getElementById("searchDropdown");
  if (!input || !dropdown) return;

  const CATEGORY_LABELS = {
    spaghetti: "Spaghetti",
    fries: "Roots & Fries",
    sides: "Sides",
    drinks: "Drinks"
  };
  let activeIndex = -1;
  let currentResults = [];

  function getResults(query) {
    const q = query.toLowerCase().trim();
    const available = MENU_ITEMS.filter((i) => i.available !== false);
    if (!q) return available.slice(0, 6);
    return available
      .filter(
        (i) =>
          (i.name || "").toLowerCase().includes(q) ||
          (i.desc || "").toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q) ||
          (i.spice || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }

  function render() {
    const query = input.value.trim();
    currentResults = getResults(query);
    activeIndex = -1;

    if (currentResults.length === 0) {
      dropdown.innerHTML = `<div class="search-empty"><i class="fas fa-face-frown"></i> No dishes match "${escapeHtml(query)}"</div>`;
    } else {
      const heading = query
        ? `${currentResults.length} result${currentResults.length > 1 ? "s" : ""}`
        : "Popular dishes (Click to select or + to add)";
      dropdown.innerHTML =
        `<div class="search-dd-heading">${heading}</div>` +
        currentResults
          .map(
            (item, idx) => `
        <div class="search-dd-item" role="option" data-index="${idx}" data-id="${escapeHtml(item.id)}">
          <img src="${escapeHtml(item.img)}" alt="" onerror="this.src='SATED & SALTED.png'">
          <div class="search-dd-info">
            <div class="search-dd-name">${highlightMatch(item.name, query)}</div>
            <div class="search-dd-meta">${escapeHtml(CATEGORY_LABELS[item.category] || item.category || "")} &bull; ${formatNaira(item.price)}</div>
          </div>
          <button type="button" class="search-dd-add" data-add="${escapeHtml(item.id)}" title="Add to tray"><i class="fas fa-plus"></i></button>
        </div>
      `
          )
          .join("");
    }
    open();
  }

  function open() {
    dropdown.classList.add("open");
    input.setAttribute("aria-expanded", "true");
  }
  function close() {
    dropdown.classList.remove("open");
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function highlightRow(idx) {
    const rows = dropdown.querySelectorAll(".search-dd-item");
    rows.forEach((r) => r.classList.remove("active"));
    if (idx >= 0 && rows[idx]) {
      rows[idx].classList.add("active");
      if (typeof rows[idx].scrollIntoView === "function") {
        rows[idx].scrollIntoView({ block: "nearest" });
      }
    }
  }

  function choose(itemId) {
    const item = MENU_ITEMS.find((i) => i.id === itemId);
    if (!item) return;
    input.value = item.name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    close();
    const grid = document.getElementById("menuGrid");
    if (grid && typeof grid.scrollIntoView === "function") {
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-expanded", "false");
  input.addEventListener("focus", render);
  input.addEventListener("input", render);

  input.addEventListener("keydown", (e) => {
    if (!dropdown.classList.contains("open")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % Math.max(currentResults.length, 1);
      highlightRow(activeIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + currentResults.length) % Math.max(currentResults.length, 1);
      highlightRow(activeIndex);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        e.preventDefault();
        choose(currentResults[activeIndex].id);
      } else {
        close();
      }
    } else if (e.key === "Escape") {
      close();
    }
  });

  dropdown.addEventListener("mousedown", (e) => e.preventDefault());
  dropdown.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-add]");
    if (addBtn) {
      addToCart(addBtn.getAttribute("data-add"));
      return;
    }
    const row = e.target.closest(".search-dd-item");
    if (row) choose(row.getAttribute("data-id"));
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu-search-box")) close();
  });
}

/* ==========================================================================
   Drawer, Toast & WhatsApp Order Submission
   ========================================================================== */
function openCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (drawer && overlay) {
    drawer.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

function closeCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  const overlay = document.getElementById("cartOverlay");
  if (drawer && overlay) {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "auto";
  }
}

function showToast(message) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="fas fa-check-circle"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "all 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

function submitOrderViaWhatsApp() {
  if (cart.length === 0) {
    alert("Your food tray is empty! Add some delicious meals first.");
    return;
  }

  const nameInput = document.getElementById("custName");
  const phoneInput = document.getElementById("custPhone");
  const addressInput = document.getElementById("custAddress");
  const zoneSelect = document.getElementById("deliveryZoneSelect");
  const spiceSelect = document.getElementById("spicePreference");
  const notesInput = document.getElementById("orderNotes");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const address = addressInput ? addressInput.value.trim() : "";
  const zoneText = zoneSelect && zoneSelect.options[zoneSelect.selectedIndex] ? zoneSelect.options[zoneSelect.selectedIndex].text : "Island";
  const zoneVal = zoneSelect ? zoneSelect.value : "island-near";
  const spice = spiceSelect ? spiceSelect.value : "Hot & Spicy";
  const notes = notesInput ? notesInput.value.trim() : "";

  if (!name) {
    alert("Please enter your name so we know who the order is for.");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!phone) {
    alert("Please enter your phone number for order updates and delivery rider contact.");
    if (phoneInput) phoneInput.focus();
    return;
  }

  if (zoneVal !== "pickup" && !address) {
    alert("Please enter your delivery address.");
    if (addressInput) addressInput.focus();
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const deliveryFee = DELIVERY_RATES[zoneVal] !== undefined ? DELIVERY_RATES[zoneVal] : 1500;
  const grandTotal = subtotal + deliveryFee;

  const itemsText = cart
    .map((item) => `  • ${item.qty}x ${item.name} (${formatNaira(item.price * item.qty)})`)
    .join("\n");

  const waMessage =
`🍽️ *NEW ORDER - SATED & SALTED*
━━━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${name}
📞 *Phone:* ${phone}
🚚 *Fulfillment:* ${zoneVal === "pickup" ? "Self Pickup" : `Delivery (${zoneText})`}
${zoneVal !== "pickup" ? `📍 *Address:* ${address}\n` : ""}
🌶️ *Preferred Spice Level:* ${spice}
${notes ? `📝 *Special Notes:* ${notes}\n` : ""}
🍲 *ITEMS ORDERED:*
${itemsText}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* ${formatNaira(subtotal)}
🚚 *Delivery:* ${deliveryFee === 0 ? "Free (Pickup)" : formatNaira(deliveryFee)}
💰 *GRAND TOTAL:* ${formatNaira(grandTotal)}
━━━━━━━━━━━━━━━━━━━━
Please confirm my order and send payment details! Thank you!`;

  const encodedMsg = encodeURIComponent(waMessage);
  const cleanWa = String(VENDOR_WHATSAPP_NUMBER || "2348164475960").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanWa}?text=${encodedMsg}`;
  window.open(whatsappUrl, "_blank");
}

/* ==========================================================================
   Real-Time Sync with Admin Portal (Server API + localStorage + BroadcastChannel)
   ========================================================================== */
async function syncFromServerAndStorage() {
  let latestStore = null;

  // 1. Check localStorage first
  try {
    const localV2 = JSON.parse(localStorage.getItem(STORE_KEY));
    if (localV2 && Array.isArray(localV2.menu)) {
      latestStore = localV2;
    } else {
      const legacyMenu = JSON.parse(localStorage.getItem(LEGACY_MENU_KEY));
      if (Array.isArray(legacyMenu)) {
        latestStore = Object.assign({}, SS_STORE, { menu: legacyMenu });
      }
    }
  } catch (e) {}

  // 2. Also check /api/store when running on localhost server
  if (location.protocol.startsWith("http") && typeof fetch === "function") {
    try {
      const res = await fetch("/api/store?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.store && Array.isArray(data.store.menu)) {
          if (!latestStore || (data.store.updatedAt || 0) >= (latestStore.updatedAt || 0)) {
            latestStore = data.store;
            try {
              localStorage.setItem(STORE_KEY, JSON.stringify(latestStore));
              localStorage.setItem(LEGACY_MENU_KEY, JSON.stringify(latestStore.menu));
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
  }

  if (latestStore) {
    applyStoreToWebsite(latestStore);
  }
}

function setupLiveAdminSync() {
  // Listen for cross-tab localStorage changes
  window.addEventListener("storage", (e) => {
    if (e.key === STORE_KEY || e.key === LEGACY_MENU_KEY) {
      syncFromServerAndStorage();
      showToast("Menu updated from Admin Portal!");
    }
  });

  // Listen for BroadcastChannel messages from Admin tab
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel("ss_live_channel");
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === "STORE_UPDATED" && ev.data.store) {
          applyStoreToWebsite(ev.data.store);
          showToast("Live update applied from Admin Portal!");
        } else {
          syncFromServerAndStorage();
        }
      };
    } catch (e) {}
  }

  // Re-sync whenever user switches back to this tab
  window.addEventListener("focus", syncFromServerAndStorage);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncFromServerAndStorage();
  });
}

/* ==========================================================================
   DOM Initialization
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  applyStoreToWebsite(SS_STORE);
  setupFilters();
  setupSearchDropdown();
  initCart();
  setupLiveAdminSync();
  syncFromServerAndStorage();

  const cartButtons = document.querySelectorAll(".btn-cart-toggle, .btn-mobile-cart");
  cartButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  });

  const closeCartBtn = document.getElementById("closeCartBtn");
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCartDrawer);

  const overlay = document.getElementById("cartOverlay");
  if (overlay) overlay.addEventListener("click", closeCartDrawer);

  const zoneSelect = document.getElementById("deliveryZoneSelect");
  if (zoneSelect) zoneSelect.addEventListener("change", updateCartUI);

  const mobileToggle = document.getElementById("mobileMenuToggle");
  const navbar = document.getElementById("navbar");
  if (mobileToggle && navbar) {
    mobileToggle.addEventListener("click", () => {
      navbar.classList.toggle("active");
    });
    navbar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => navbar.classList.remove("active"));
    });
  }

  const portionRadios = document.querySelectorAll("input[name='modalPortion']");
  portionRadios.forEach((r) => r.addEventListener("change", recalcModalPrice));

  const modalCloseBtn = document.getElementById("closeDishModalBtn");
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeCustomizeModal);

  const modalOverlay = document.getElementById("dishModalOverlay");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeCustomizeModal();
    });
  }

  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach((item) => {
    const questionBtn = item.querySelector(".faq-question");
    if (questionBtn) {
      questionBtn.addEventListener("click", () => {
        const isActive = item.classList.contains("active");
        faqItems.forEach((f) => f.classList.remove("active"));
        if (!isActive) item.classList.add("active");
      });
    }
  });

  window.addEventListener("scroll", () => {
    const sections = document.querySelectorAll("section[id]");
    const scrollY = window.pageYOffset;
    sections.forEach((current) => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute("id");
      const navLink = document.querySelector(`#navbar a[href*="#${sectionId}"]`);
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        if (navLink) {
          document.querySelectorAll("#navbar a").forEach((l) => l.classList.remove("active"));
          navLink.classList.add("active");
        }
      }
    });
  });
});
