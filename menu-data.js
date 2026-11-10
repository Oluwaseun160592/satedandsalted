/* ==========================================================================
   SATED & SALTED - Shared Store Data (menu-data.js)
   Used by both index.html (Public Website) and admin.html (Admin Portal).
   ========================================================================== */

window.SS_DEFAULT_STORE = {
  updatedAt: 1731240000000,
  settings: {
    whatsapp: "2348164475960",
    whatsappDisplay: "+234 816 447 5960",
    address: "78b, Green Street, Isolo Housing Estate, Lagos",
    promoText: "Free Chilled Drink on orders above ₦15,000!",
    kitchenStatusMode: "auto", // "auto" | "open" | "closed"
    heroDishId: "gizdodo",
    heroPillText: "#1 Gizdodo in Town"
  },
  jumboPrice: 1500,
  addons: [
    { id: "extra-dodo", name: "Extra Fried Sweet Plantain (Dodo)", price: 800, available: true },
    { id: "extra-egg", name: "Hard Boiled Egg", price: 300, available: true },
    { id: "extra-pepper", name: "Signature Extra Pepper Relish", price: 400, available: true },
    { id: "extra-chicken", name: "Shredded Peppered Chicken", price: 1000, available: true }
  ],
  deliveryZones: [
    { id: "island-near", name: "Lekki Phase 1 / Ikoyi / Victoria Island", price: 1500 },
    { id: "island-far", name: "Chevron / Ajah / Sangotedo", price: 2500 },
    { id: "mainland-near", name: "Isolo / Yaba / Surulere / Ikeja", price: 2000 },
    { id: "mainland-far", name: "Magodo / Festac / Ikorodu", price: 3000 },
    { id: "pickup", name: "Self-Pickup at Kitchen (Free)", price: 0 }
  ],
  combos: [
    {
      id: "combo-solo",
      name: "The Solo Feast Box",
      sub: "The quintessential comfort food indulgence for one.",
      ribbon: "Save ₦1,000",
      price: 7500,
      originalPrice: 8500,
      img: "jollofspagh.jpg",
      featured: false,
      available: true,
      items: [
        "1x Smoky Party Jollof Spaghetti",
        "1x Portion of Signature Spicy Gizdodo",
        "1x Chilled House Zobo Elixir",
        "Free Cutlery & Pepper Dip"
      ]
    },
    {
      id: "combo-crunch",
      name: "The Crunch & Chew Box",
      sub: "Crispy, sweet, and protein-packed satisfaction.",
      ribbon: "Most Popular 🔥",
      price: 6200,
      originalPrice: 6800,
      img: "fried yam.jpg",
      featured: true,
      available: true,
      items: [
        "1x Golden Special Yamarita",
        "1x Crispy Sweet Potato Chips",
        "1x Flame-Grilled Peppered Chicken",
        "Dual Dipping Sauces (Sweet & Spicy)"
      ]
    },
    {
      id: "combo-duo",
      name: "The Duo Spagh Deluxe",
      sub: "Designed for dates, friends, and serious spaghetti lovers.",
      ribbon: "Save ₦2,000",
      price: 13500,
      originalPrice: 15500,
      img: "stirfryspagh.jpg",
      featured: false,
      available: true,
      items: [
        "1x Sizzling Stir-fry Spaghetti",
        "1x Smoky Party Jollof Spaghetti",
        "2x Flame-Grilled Peppered Chicken",
        "2x Chilled House Zobo Elixirs"
      ]
    }
  ],
  menu: [
    {
      id: "jollof-spagh",
      name: "Smoky Party Jollof Spaghetti",
      category: "spaghetti",
      price: 3500,
      img: "jollofspagh.jpg",
      badge: "Chef's Pick 🔥",
      spice: "Spicy",
      rating: "4.9",
      reviews: 184,
      time: "25-35 mins",
      desc: "Rich tomato-pepper base simmered with aromatic herbs, smoked spices, and slow-braised to party perfection.",
      available: true
    },
    {
      id: "stirfry-spagh",
      name: "Sizzling Stir-fry Spaghetti",
      category: "spaghetti",
      price: 4000,
      img: "stirfryspagh.jpg",
      badge: "Bestseller 🔥",
      spice: "Medium Spice",
      rating: "5.0",
      reviews: 212,
      time: "20-30 mins",
      desc: "Wok-tossed spaghetti loaded with sweet bell peppers, sweetcorn, shredded chicken, and savory Asian-Nigerian spices.",
      available: true
    },
    {
      id: "gizdodo",
      name: "Signature Spicy Gizdodo",
      category: "sides",
      price: 3800,
      img: "gizdodo.jpg",
      badge: "Crowd Favorite 🌶️",
      spice: "Fiery Hot",
      rating: "5.0",
      reviews: 305,
      time: "15-25 mins",
      desc: "Crispy fried sweet plantains and tender gizzard chunks drenched in rich caramelized habanero and pepper stew.",
      available: true
    },
    {
      id: "yamarita",
      name: "Special Yamarita Delight",
      category: "fries",
      price: 2800,
      img: "fried yam.jpg",
      badge: "Crispy Gold ✨",
      spice: "Mild Dip",
      rating: "4.8",
      reviews: 95,
      time: "20-25 mins",
      desc: "Thick African yam wedges dipped in seasoned whisked egg batter, fried golden crisp, and served with spicy tomato relish.",
      available: true
    },
    {
      id: "yam-fries",
      name: "Classic Fried Yam Fries",
      category: "fries",
      price: 2200,
      img: "Yam fries.jpg",
      badge: "Street Classic",
      spice: "Mild Dip",
      rating: "4.8",
      reviews: 110,
      time: "15-20 mins",
      desc: "Crisp exterior with a melt-in-your-mouth fluffy center, lightly salted and paired with our house fiery pepper sauce.",
      available: true
    },
    {
      id: "potato-chips",
      name: "Crispy Sweet Potato Chips",
      category: "fries",
      price: 2000,
      img: "Sweet Potato chips.jpg",
      badge: "Sweet & Crispy 🍠",
      spice: "Mild Dip",
      rating: "4.9",
      reviews: 88,
      time: "15-20 mins",
      desc: "Thinly-sliced organic sweet potatoes fried till crunchy perfection, dusted with paprika sea salt, and served with dip.",
      available: true
    },
    {
      id: "zobo-elixir",
      name: "Chilled House Zobo Elixir",
      category: "drinks",
      price: 1200,
      img: "SATED & SALTED.png",
      badge: "Fresh Brew 🌺",
      spice: "Refreshing",
      rating: "4.9",
      reviews: 140,
      time: "Instant",
      desc: "Pure hibiscus leaves brewed with crushed fresh ginger, cloves, citrus zest, and pineapple nectar. Served chilled.",
      available: true
    },
    {
      id: "grilled-chicken",
      name: "Peppered Flame Grilled Chicken",
      category: "sides",
      price: 2000,
      img: "SATED & SALTED.png",
      badge: "Protein Add-on 🍗",
      spice: "Hot Pepper",
      rating: "5.0",
      reviews: 175,
      time: "10-15 mins",
      desc: "Succulent, herb-marinated chicken drumstick flame-grilled and glazed with our signature spicy pepper relish.",
      available: true
    }
  ]
};

window.SS_DEFAULT_MENU = window.SS_DEFAULT_STORE.menu;
