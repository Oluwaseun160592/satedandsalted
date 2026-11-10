/**
 * SATED & SALTED - Admin portal logic
 * Menu data lives in localStorage (key "ss_menu") and is read by the public site (app.js).
 * NOTE: the password check is client-side only. It keeps casual visitors out,
 * but it is NOT real security. Real protection needs a server (see README note).
 */
(function () {
  "use strict";

  const MENU_KEY = "ss_menu";
  const PW_KEY = "ss_admin_pw";
  const SESSION_KEY = "ss_admin_session";
  const DEFAULT_PASSWORD = "admin123";
  const CATEGORY_LABELS = { spaghetti: "Spaghetti Specials", fries: "Crispy Roots & Fries", sides: "Sides & Delicacies", drinks: "Refreshments" };

  const $ = (id) => document.getElementById(id);
  let items = [];
  let pendingImage = ""; // data URL or filename for the dish currently being edited

  /* ---------- storage ---------- */
  function loadItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(MENU_KEY));
      if (Array.isArray(saved)) return saved;
    } catch (e) { /* fall through */ }
    return (window.SS_DEFAULT_MENU || []).map((i) => ({ ...i }));
  }

  function saveItems() {
    try {
      localStorage.setItem(MENU_KEY, JSON.stringify(items));
      return true;
    } catch (e) {
      alert("Could not save: browser storage is full. Try removing some photos or use smaller images.");
      return false;
    }
  }

  const getPassword = () => localStorage.getItem(PW_KEY) || DEFAULT_PASSWORD;

  /* ---------- helpers ---------- */
  function esc(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const naira = (n) => "₦" + Number(n || 0).toLocaleString();

  let toastTimer;
  function toast(msg) {
    const t = $("adminToast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  /* Resize an uploaded photo so it stays small enough for browser storage */
  function resizeImage(file, maxSize = 800, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That file is not a valid image"));
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

  /* ---------- auth ---------- */
  function showDashboard() {
    $("loginScreen").hidden = true;
    $("dashboard").hidden = false;
    items = loadItems();
    render();
  }

  function showLogin() {
    $("dashboard").hidden = true;
    $("loginScreen").hidden = false;
    $("loginPassword").value = "";
  }

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("loginPassword").value === getPassword()) {
      sessionStorage.setItem(SESSION_KEY, "1");
      $("loginError").hidden = true;
      showDashboard();
    } else {
      $("loginError").hidden = false;
    }
  });

  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  /* ---------- rendering ---------- */
  function render() {
    const q = $("adminSearch").value.toLowerCase().trim();
    const cat = $("adminCategoryFilter").value;

    const filtered = items.filter((i) =>
      (cat === "all" || i.category === cat) &&
      (!q || i.name.toLowerCase().includes(q) || (i.desc || "").toLowerCase().includes(q))
    );

    $("itemsGrid").innerHTML = filtered.length
      ? filtered.map((i) => `
        <article class="item-card ${i.available === false ? "is-hidden" : ""}">
          <div class="item-img">
            <img src="${esc(i.img)}" alt="${esc(i.name)}" onerror="this.src='SATED & SALTED.png'">
            <span class="item-status">${i.available === false ? "Hidden" : "Live"}</span>
          </div>
          <div class="item-body">
            <span class="item-cat">${esc(CATEGORY_LABELS[i.category] || i.category)}</span>
            <h3 class="item-name">${esc(i.name)}</h3>
            <div class="item-price">${naira(i.price)}</div>
            <div class="item-actions">
              <button data-act="edit" data-id="${esc(i.id)}"><i class="fas fa-pen"></i> Edit</button>
              <button data-act="toggle" data-id="${esc(i.id)}"><i class="fas ${i.available === false ? "fa-eye" : "fa-eye-slash"}"></i> ${i.available === false ? "Show" : "Hide"}</button>
              <button class="del" data-act="delete" data-id="${esc(i.id)}"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </article>`).join("")
      : `<div class="empty-state"><i class="fas fa-utensils" style="font-size:2rem;display:block;margin-bottom:8px"></i>No dishes found. Click "Add New Dish" to create one.</div>`;

    const live = items.filter((i) => i.available !== false).length;
    $("statTotal").textContent = items.length;
    $("statLive").textContent = live;
    $("statHidden").textContent = items.length - live;
    $("statAvg").textContent = naira(items.length ? Math.round(items.reduce((s, i) => s + Number(i.price || 0), 0) / items.length) : 0);
  }

  $("adminSearch").addEventListener("input", render);
  $("adminCategoryFilter").addEventListener("change", render);

  $("itemsGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (btn.dataset.act === "edit") openModal(item);
    if (btn.dataset.act === "toggle") {
      item.available = item.available === false ? true : false;
      if (saveItems()) { render(); toast(item.available ? "Dish is now live" : "Dish hidden from website"); }
    }
    if (btn.dataset.act === "delete") {
      if (confirm(`Delete "${item.name}"? This cannot be undone.`)) {
        items = items.filter((i) => i.id !== id);
        if (saveItems()) { render(); toast("Dish deleted"); }
      }
    }
  });

  /* ---------- add / edit modal ---------- */
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

  function openModal(item) {
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

  function closeModal() {
    $("itemModal").hidden = true;
    document.body.style.overflow = "";
  }

  $("addItemBtn").addEventListener("click", () => openModal(null));
  $("closeModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("itemModal").addEventListener("mousedown", (e) => { if (e.target === $("itemModal")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("itemModal").hidden) closeModal(); });

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

  $("itemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("itemName").value.trim();
    const price = Number($("itemPrice").value);
    if (!name) return alert("Please enter the dish name.");
    if (!(price >= 0) || $("itemPrice").value === "") return alert("Please enter a valid price.");

    const id = $("itemId").value;
    const existing = id ? items.find((i) => i.id === id) : null;

    const data = {
      id: existing ? existing.id : "item-" + Date.now(),
      name,
      category: $("itemCategory").value,
      price,
      img: pendingImage || "SATED & SALTED.png",
      badge: $("itemBadge").value.trim() || "Fresh Today",
      spice: $("itemSpice").value.trim() || "Delicious",
      rating: existing ? existing.rating : "5.0",
      reviews: existing ? existing.reviews : 0,
      time: $("itemTime").value.trim() || "20-30 mins",
      desc: $("itemDesc").value.trim(),
      available: $("itemAvailable").checked
    };

    if (existing) items[items.indexOf(existing)] = data;
    else items.unshift(data);

    if (saveItems()) {
      closeModal();
      render();
      toast(existing ? "Dish updated" : "Dish added to the menu");
    }
  });

  /* ---------- settings / backup ---------- */
  $("savePasswordBtn").addEventListener("click", () => {
    const pw = $("newPassword").value;
    if (pw.length < 6) return alert("Password must be at least 6 characters.");
    localStorage.setItem(PW_KEY, pw);
    $("newPassword").value = "";
    toast("Password updated");
  });

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sated-and-salted-menu.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Menu exported");
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data) || !data.every((i) => i && i.id && i.name && typeof i.price !== "undefined")) throw new Error("bad format");
        if (!confirm(`Replace the current menu with ${data.length} imported items?`)) return;
        items = data;
        if (saveItems()) { render(); toast("Menu imported"); }
      } catch (err) {
        alert("That file is not a valid menu export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Remove all your changes and restore the original sample menu?")) return;
    localStorage.removeItem(MENU_KEY);
    items = loadItems();
    render();
    toast("Menu reset to defaults");
  });

  /* ---------- init ---------- */
  if (sessionStorage.getItem(SESSION_KEY) === "1") showDashboard();
  else showLogin();
})();
