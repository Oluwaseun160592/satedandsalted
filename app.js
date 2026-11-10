/**
 * SATED & SALTED - Modern Food Vendor JavaScript
 * Real-time Menu, Cart State, Audio Micro-interactions, Modal Customizer & WhatsApp Checkout Integration
 */

// Vendor WhatsApp Phone Number (International format without +)
const VENDOR_WHATSAPP_NUMBER = "2348164475960"; 

// Menu Items Database
// Menu: the admin-edited menu (localStorage) overrides the defaults in menu-data.js
function loadMenuItems() {
  try {
    const saved = JSON.parse(localStorage.getItem("ss_menu"));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return (window.SS_DEFAULT_MENU || []).map(i => ({ ...i }));
}
const MENU_ITEMS = loadMenuItems();

// Delivery fee matrix by zone
const DELIVERY_RATES = {
  "pickup": 0,
  "island-near": 1500, // Lekki Phase 1, Ikoyi, Victoria Island
  "island-far": 2500,  // Chevron, Ajah, Sangotedo
  "mainland-near": 2000, // Yaba, Surulere, Ikeja
  "mainland-far": 3000   // Magodo, Festac, Ikorodu
};

// Available Add-ons for customization
const AVAILABLE_ADDONS = [
  { id: "extra-dodo", name: "Extra Fried Sweet Plantain (Dodo)", price: 800 },
  { id: "extra-egg", name: "Hard Boiled Egg", price: 300 },
  { id: "extra-pepper", name: "Signature Extra Pepper Dip", price: 400 },
  { id: "extra-chicken", name: "Shredded Peppered Chicken", price: 1000 }
];

// Cart State
let cart = [];
let currentCustomizingItem = null;

// Sound synthesizer using Web Audio API for rewarding micro-interaction
function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Ignore audio failures if browser blocks autoplay
  }
}

// Initialize Cart from localStorage
function initCart() {
  try {
    const saved = localStorage.getItem("sated_salted_cart");
    if (saved) {
      cart = JSON.parse(saved);
    }
  } catch (e) {
    cart = [];
  }
  updateCartUI();
  updateKitchenStatus();
}

// Live Kitchen Status (10:00 AM - 9:00 PM)
function updateKitchenStatus() {
  const statusEl = document.getElementById("kitchenStatusIndicator");
  if (!statusEl) return;

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 is Sunday

  const isOpen = (day !== 0) && (hour >= 10 && hour < 21);

  if (isOpen) {
    statusEl.className = "kitchen-status-pill";
    statusEl.innerHTML = `<span class="status-dot"></span> Kitchen Open & Cooking (30-45m delivery)`;
  } else {
    statusEl.className = "kitchen-status-pill closed";
    statusEl.innerHTML = `<span class="status-dot"></span> Kitchen Closed (Pre-orders accepted for 10 AM)`;
  }
}

// Save Cart to localStorage
function saveCart() {
  try { localStorage.setItem("sated_salted_cart", JSON.stringify(cart)); } catch (e) { /* storage full: keep cart in memory */ }
  updateCartUI();
}

// Quick Add Item to Cart (Default Standard Portion)
function addToCart(itemId, customQty = 1) {
  const item = MENU_ITEMS.find(m => m.id === itemId);
  if (!item) return;

  const existing = cart.find(ci => ci.id === itemId && !ci.customized);
  if (existing) {
    existing.qty += customQty;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      img: item.img,
      qty: customQty,
      customized: false
    });
  }

  saveCart();
  playOrderChime();
  showToast(`Added ${item.name} to your tray!`);
}

// Add Combo to Cart
function addComboToCart(comboId, name, price, img) {
  const existing = cart.find(ci => ci.id === comboId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: comboId,
      name: name,
      price: price,
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

// Open Customization Modal for a Dish
function openCustomizeModal(itemId) {
  const item = MENU_ITEMS.find(m => m.id === itemId);
  if (!item) return;

  currentCustomizingItem = item;

  const modalOverlay = document.getElementById("dishModalOverlay");
  const modalImg = document.getElementById("modalDishImg");
  const modalTitle = document.getElementById("modalDishTitle");
  const modalDesc = document.getElementById("modalDishDesc");
  const modalPrice = document.getElementById("modalPriceDisplay");

  if (modalImg) modalImg.src = item.img;
  if (modalTitle) modalTitle.textContent = item.name;
  if (modalDesc) modalDesc.textContent = item.desc;
  if (modalPrice) modalPrice.textContent = formatNaira(item.price);

  // Reset modal inputs
  const regRadio = document.getElementById("portionRegular");
  if (regRadio) regRadio.checked = true;

  const checkboxes = document.querySelectorAll(".modal-addon-checkbox");
  checkboxes.forEach(cb => cb.checked = false);

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

// Recalculate Modal Total based on Portion and Add-ons
function recalcModalPrice() {
  if (!currentCustomizingItem) return 0;

  let total = currentCustomizingItem.price;

  const isJumbo = document.getElementById("portionJumbo") && document.getElementById("portionJumbo").checked;
  if (isJumbo) total += 1500;

  const checkboxes = document.querySelectorAll(".modal-addon-checkbox:checked");
  checkboxes.forEach(cb => {
    total += Number(cb.getAttribute("data-price") || 0);
  });

  const displayEl = document.getElementById("modalPriceDisplay");
  if (displayEl) displayEl.textContent = formatNaira(total);

  return total;
}

// Confirm Modal Customization and add to Cart
function confirmModalCustomization() {
  if (!currentCustomizingItem) return;

  const isJumbo = document.getElementById("portionJumbo") && document.getElementById("portionJumbo").checked;
  const portionName = isJumbo ? "Jumbo Feast Bowl" : "Standard Bowl";

  const selectedAddons = [];
  document.querySelectorAll(".modal-addon-checkbox:checked").forEach(cb => {
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

  // Create unique id for customized variations
  const customId = currentCustomizingItem.id + "-custom-" + Date.now();
  const customLabel = `${currentCustomizingItem.name} (${portionName}${selectedAddons.length > 0 ? " + " + selectedAddons.map(a => a.name).join(", ") : ""})`;

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

// Update Quantity
function updateCartItemQty(itemId, delta) {
  const index = cart.findIndex(ci => ci.id === itemId);
  if (index === -1) return;

  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  saveCart();
}

// Remove from Cart
function removeCartItem(itemId) {
  cart = cart.filter(ci => ci.id !== itemId);
  saveCart();
  showToast("Item removed from tray");
}

// Clear Entire Cart
function clearCart() {
  if (cart.length === 0) return;
  if (confirm("Are you sure you want to clear your food tray?")) {
    cart = [];
    saveCart();
    showToast("Food tray cleared");
  }
}

// Format Price in Naira
function formatNaira(amount) {
  return "₦" + Number(amount).toLocaleString();
}

// Update Cart UI everywhere
function updateCartUI() {
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // Update header and mobile badges
  const countBadges = document.querySelectorAll(".cart-count-badge");
  countBadges.forEach(b => b.textContent = totalItems);

  const totalBadges = document.querySelectorAll(".cart-total-badge");
  totalBadges.forEach(b => b.textContent = formatNaira(subtotal));

  // Render Drawer list
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

    cartList.innerHTML = cart.map(item => `
      <div class="cart-item-card">
        <img src="${item.img}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatNaira(item.price)} each</div>
          <div class="cart-item-stepper">
            <button class="stepper-btn" onclick="updateCartItemQty('${item.id}', -1)" title="Decrease">
              <i class="fas fa-minus"></i>
            </button>
            <span class="stepper-qty">${item.qty}</span>
            <button class="stepper-btn" onclick="updateCartItemQty('${item.id}', 1)" title="Increase">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
        <button class="cart-item-delete" onclick="removeCartItem('${item.id}')" title="Remove">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `).join("");

    // Calculate delivery fee
    const zoneSelect = document.getElementById("deliveryZoneSelect");
    const zone = zoneSelect ? zoneSelect.value : "island-near";
    const deliveryFee = DELIVERY_RATES[zone] !== undefined ? DELIVERY_RATES[zone] : 1500;
    const grandTotal = subtotal + deliveryFee;

    if (subtotalEl) subtotalEl.textContent = formatNaira(subtotal);
    if (deliveryFeeEl) deliveryFeeEl.textContent = deliveryFee === 0 ? "Free (Pickup)" : formatNaira(deliveryFee);
    if (grandTotalEl) grandTotalEl.textContent = formatNaira(grandTotal);
  }
}

// Render Menu Cards
function renderMenu(itemsToRender = MENU_ITEMS) {
  const container = document.getElementById("menuGrid");
  if (!container) return;
  itemsToRender = itemsToRender.filter(i => i.available !== false);

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

  container.innerHTML = itemsToRender.map(item => `
    <div class="food-card" data-category="${item.category}">
      <div class="food-img-wrap" onclick="openCustomizeModal('${item.id}')" style="cursor: pointer;" title="Click to customize">
        <img src="${item.img}" alt="${item.name}" loading="lazy">
        <span class="food-badge">${item.badge}</span>
        <span class="food-spice-tag">${item.spice}</span>
      </div>
      <div class="food-content">
        <div class="food-meta">
          <div class="food-rating">
            <i class="fas fa-star"></i>
            <span>${item.rating} (${item.reviews})</span>
          </div>
          <div class="food-prep-time">
            <i class="far fa-clock"></i>
            <span>${item.time}</span>
          </div>
        </div>
        <h3 class="food-title" onclick="openCustomizeModal('${item.id}')" style="cursor: pointer;">${item.name}</h3>
        <p class="food-desc">${item.desc}</p>
        <div class="food-footer">
          <div class="food-price-box">
            <span class="food-price-label">Price</span>
            <span class="food-price">${formatNaira(item.price)}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="food-add-btn" onclick="openCustomizeModal('${item.id}')" title="Customize portion & add-ons" style="background: rgba(255, 179, 0, 0.15); border-color: rgba(255, 179, 0, 0.35); color: var(--accent);">
              <i class="fas fa-sliders"></i>
            </button>
            <button class="food-add-btn" onclick="addToCart('${item.id}')" title="Quick Add">
              <i class="fas fa-plus"></i> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

// Setup Menu Filters
function setupFilters() {
  const catButtons = document.querySelectorAll(".cat-btn");
  const searchInput = document.getElementById("menuSearchInput");

  let activeCategory = "all";

  function filterItems() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const filtered = MENU_ITEMS.filter(item => {
      const matchCat = activeCategory === "all" || item.category === activeCategory;
      const matchSearch = query === "" || 
        item.name.toLowerCase().includes(query) || 
        item.desc.toLowerCase().includes(query) ||
        item.spice.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });

    renderMenu(filtered);
  }

  catButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      catButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.getAttribute("data-cat");
      filterItems();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", filterItems);
  }
}

// Drawer Controls
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

// Toast Notifications
function showToast(message) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<i class="fas fa-check-circle"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "all 0.3s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// WhatsApp Order Message Builder & Sender
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
  const zoneText = zoneSelect ? zoneSelect.options[zoneSelect.selectedIndex].text : "Island";
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

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const deliveryFee = DELIVERY_RATES[zoneVal] !== undefined ? DELIVERY_RATES[zoneVal] : 1500;
  const grandTotal = subtotal + deliveryFee;

  // Format Items List
  const itemsText = cart.map(item => `  • ${item.qty}x ${item.name} (${formatNaira(item.price * item.qty)})`).join("\n");

  // Construct WhatsApp Message
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
  const whatsappUrl = `https://wa.me/${VENDOR_WHATSAPP_NUMBER}?text=${encodedMsg}`;

  // Open WhatsApp in a new tab
  window.open(whatsappUrl, "_blank");
}

// Setup Event Listeners on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  renderMenu();
  setupFilters();
  initCart();

  // Cart Drawer triggers
  const cartButtons = document.querySelectorAll(".btn-cart-toggle, .btn-mobile-cart");
  cartButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  });

  const closeCartBtn = document.getElementById("closeCartBtn");
  if (closeCartBtn) {
    closeCartBtn.addEventListener("click", closeCartDrawer);
  }

  const overlay = document.getElementById("cartOverlay");
  if (overlay) {
    overlay.addEventListener("click", closeCartDrawer);
  }

  // Delivery Zone Change triggers total recalculation
  const zoneSelect = document.getElementById("deliveryZoneSelect");
  if (zoneSelect) {
    zoneSelect.addEventListener("change", updateCartUI);
  }

  // Mobile Hamburger Menu
  const mobileToggle = document.getElementById("mobileMenuToggle");
  const navbar = document.getElementById("navbar");
  if (mobileToggle && navbar) {
    mobileToggle.addEventListener("click", () => {
      navbar.classList.toggle("active");
    });

    // Close mobile menu when clicking any nav link
    navbar.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navbar.classList.remove("active");
      });
    });
  }

  // Modal Customization Event Listeners
  const portionRadios = document.querySelectorAll("input[name='modalPortion']");
  portionRadios.forEach(r => r.addEventListener("change", recalcModalPrice));

  const addonCheckboxes = document.querySelectorAll(".modal-addon-checkbox");
  addonCheckboxes.forEach(cb => cb.addEventListener("change", recalcModalPrice));

  const modalCloseBtn = document.getElementById("closeDishModalBtn");
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeCustomizeModal);
  }

  const modalOverlay = document.getElementById("dishModalOverlay");
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeCustomizeModal();
    });
  }

  // FAQ Accordion
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    const questionBtn = item.querySelector(".faq-question");
    if (questionBtn) {
      questionBtn.addEventListener("click", () => {
        const isActive = item.classList.contains("active");
        faqItems.forEach(f => f.classList.remove("active"));
        if (!isActive) {
          item.classList.add("active");
        }
      });
    }
  });

  // Smooth scroll highlighting for nav
  window.addEventListener("scroll", () => {
    const sections = document.querySelectorAll("section[id]");
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 120;
      const sectionId = current.getAttribute("id");
      const navLink = document.querySelector(`#navbar a[href*="#${sectionId}"]`);

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        if (navLink) {
          document.querySelectorAll("#navbar a").forEach(l => l.classList.remove("active"));
          navLink.classList.add("active");
        }
      }
    });
  });
});


/* ==========================================================================
   Search dropdown (suggestions under the menu search box)
   ========================================================================== */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

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

  const CATEGORY_LABELS = { spaghetti: "Spaghetti", fries: "Roots & Fries", sides: "Sides", drinks: "Drinks" };
  let activeIndex = -1;
  let currentResults = [];

  function getResults(query) {
    const q = query.toLowerCase().trim();
    const available = MENU_ITEMS.filter(i => i.available !== false);
    if (!q) return available.slice(0, 6);
    return available.filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.desc || "").toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q) ||
      (i.spice || "").toLowerCase().includes(q)
    ).slice(0, 8);
  }

  function render() {
    const query = input.value.trim();
    currentResults = getResults(query);
    activeIndex = -1;

    if (currentResults.length === 0) {
      dropdown.innerHTML = `<div class="search-empty"><i class="fas fa-face-frown"></i> No dishes match "${escapeHtml(query)}"</div>`;
    } else {
      const heading = query ? `${currentResults.length} result${currentResults.length > 1 ? "s" : ""}` : "Popular dishes";
      dropdown.innerHTML = `<div class="search-dd-heading">${heading}</div>` + currentResults.map((item, idx) => `
        <div class="search-dd-item" role="option" data-index="${idx}" data-id="${escapeHtml(item.id)}">
          <img src="${escapeHtml(item.img)}" alt="">
          <div class="search-dd-info">
            <div class="search-dd-name">${highlightMatch(item.name, query)}</div>
            <div class="search-dd-meta">${escapeHtml(CATEGORY_LABELS[item.category] || item.category || "")} &bull; ${formatNaira(item.price)}</div>
          </div>
          <button type="button" class="search-dd-add" data-add="${escapeHtml(item.id)}" title="Add to tray"><i class="fas fa-plus"></i></button>
        </div>
      `).join("");
    }
    open();
  }

  function open() { dropdown.classList.add("open"); input.setAttribute("aria-expanded", "true"); }
  function close() { dropdown.classList.remove("open"); input.setAttribute("aria-expanded", "false"); activeIndex = -1; }

  function highlightRow(idx) {
    const rows = dropdown.querySelectorAll(".search-dd-item");
    rows.forEach(r => r.classList.remove("active"));
    if (idx >= 0 && rows[idx]) {
      rows[idx].classList.add("active");
      rows[idx].scrollIntoView({ block: "nearest" });
    }
  }

  function choose(itemId) {
    const item = MENU_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    input.value = item.name;
    input.dispatchEvent(new Event("input", { bubbles: true })); // filters the grid below
    close();
    const grid = document.getElementById("menuGrid");
    if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
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

  dropdown.addEventListener("mousedown", (e) => e.preventDefault()); // keep input focused
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

document.addEventListener("DOMContentLoaded", setupSearchDropdown);
