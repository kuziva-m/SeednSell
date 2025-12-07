import { sb } from "./supabase.js";
import { getCurrentUserId, getUserProfile } from "./auth.js";
import { handleStartChat } from "./chat.js";
import { CONFIG } from "./config.js";

// --- DOM Elements ---
const featuredGrid = document.getElementById("featured-listings-grid");
const featuredLoading = document.getElementById("featured-loading-message");
const listingsGrid = document.getElementById("listings-grid-content");
const loadingMessage = document.getElementById("loading-message");
const listingDetailContainer = document.getElementById(
  "listing-detail-container"
);

// Search & Pagination Elements
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const locationInput = document.getElementById("location-input");
const loadMoreBtn = document.getElementById("load-more-btn");
const breadcrumbContainer = document.getElementById("breadcrumb-container");

// --- State Variables ---
let currentPage = 0;
const ITEMS_PER_PAGE = 8;
let currentSearchQuery = "";
let currentLocationQuery = "";
let currentCategory = "produce"; // Default category
let hasMoreListings = true;

// --- CONFIG: Page Themes & Content (PHASE 1 RECRUITMENT) ---
const CATEGORY_CONFIG = {
  produce: {
    theme: "theme-produce",
    title: "Recruiting Producers!",
    desc: "We are verifying farmers now. Register to have your produce listed here when we launch.",
    btnText: "Register Now",
    unitDefault: "crate",
    promo: {
      bgImage: "/images/field.webp",
      left: {
        title:
          '<i class="fa-solid fa-truck-ramp-box icon"></i>Are You a Large-Scale Buyer?',
        desc: "Secure your supply chain early. Contract farmers before the harvest season begins.",
        btn: "+263 78 514 1781", // WhatsApp Number
      },
      right: {
        title: '<i class="fa-solid fa-tractor icon"></i>Are You a Farmer?',
        desc: "Don't get left behind. Join our Contract Program and get verified today.",
        btn: "Join Our Program",
      },
    },
  },
  inputs: {
    theme: "theme-inputs",
    title: "Recruiting Input Suppliers.",
    desc: "Do you sell fertilizer, seeds, or chemicals? Register now to reach thousands of farmers.",
    btnText: "Register as Supplier",
    unitDefault: "bag",
    promo: {
      bgImage: "/images/promo-inputs.jpg",
      left: {
        title: '<i class="fa-solid fa-shop icon"></i>Bulk Orders Coming Soon',
        desc: "We are aggregating orders from our farmers. Be the first supplier they call.",
        btn: "+263 78 514 1781", // WhatsApp Number
      },
      right: {
        title:
          '<i class="fa-solid fa-hand-holding-dollar icon"></i>Sell Your Inputs',
        desc: "Create your verified profile today so you are ready when the season starts.",
        btn: "Register Now",
      },
    },
  },
  services: {
    theme: "theme-services",
    title: "Recruiting Service Providers.",
    desc: "Tractor owners, transporters, and vets: Get verified now to receive job alerts.",
    btnText: "Register Service",
    unitDefault: "job",
    promo: {
      bgImage: "/images/promo-services.jpg",
      left: {
        title: '<i class="fa-solid fa-clipboard-list icon"></i>Need Work Done?',
        desc: "We are building a database of verified service providers. Check back soon.",
        btn: "+263 78 514 1781", // WhatsApp Number
      },
      right: {
        title: '<i class="fa-solid fa-wrench icon"></i>List Your Machinery',
        desc: "Turn your idle equipment into cash. Register your tractor or truck today.",
        btn: "Register Now",
      },
    },
  },
};

// --- MOCK DATA FOR PHASE 1 ---
const MOCK_LISTINGS = [
  {
    id: "mock-1",
    product_name: "Fresh Tomatoes (Example)",
    price: 15,
    location: "Harare",
    main_image_url: null, // Will fallback to logo
    category: "produce",
  },
  {
    id: "mock-2",
    product_name: "Choice Maize (Example)",
    price: 5,
    location: "Bindura",
    main_image_url: null,
    category: "produce",
  },
  {
    id: "mock-3",
    product_name: "Compound D Fertilizer (Example)",
    price: 38,
    location: "Msasa",
    main_image_url: null,
    category: "inputs",
  },
  {
    id: "mock-4",
    product_name: "Tractor Ploughing (Example)",
    price: 90,
    location: "Marondera",
    main_image_url: null,
    category: "services",
  },
  {
    id: "mock-5",
    product_name: "Road Runner Chickens (Example)",
    price: 6,
    location: "Gweru",
    main_image_url: null,
    category: "produce",
  },
  {
    id: "mock-6",
    product_name: "Veterinary Services (Example)",
    price: 50,
    location: "Bulawayo",
    main_image_url: null,
    category: "services",
  },
];

// --- Helper: Debounce Function (Real-Time Search) ---
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- Helper: Render Skeletons ---
function renderSkeletons(gridElement, count = 4) {
  gridElement.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "listing-card skeleton-card";
    card.innerHTML = `
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-content">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-text price"></div>
      </div>
    `;
    gridElement.appendChild(card);
  }
}

// --- Helper: Render Empty State ---
function renderEmptyState(
  gridElement,
  title,
  message,
  actionText = null,
  actionCallback = null
) {
  gridElement.innerHTML = "";

  const container = document.createElement("div");
  container.className = "empty-state fade-in-section is-visible";

  container.innerHTML = `
    <i class="fa-solid fa-basket-shopping"></i>
    <h3>${title}</h3>
    <p>${message}</p>
  `;

  if (actionText && actionCallback) {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = actionText;
    btn.onclick = actionCallback;
    container.appendChild(btn);
  }

  gridElement.appendChild(container);
}

// --- Initialization ---
export async function initListingsPage() {
  if (!listingsGrid) return;

  const params = new URLSearchParams(window.location.search);
  const catParam = params.get("cat");

  // Validate category, fallback to 'produce'
  if (catParam && CATEGORY_CONFIG[catParam]) {
    currentCategory = catParam;
  } else {
    currentCategory = "produce";
  }

  console.log(`Initializing listings for category: ${currentCategory}`);

  // 1. Apply Theme & Hero Content
  applyCategoryTheme();

  // 2. Load Filters (Dummy for now)
  loadLocationDropdown();

  // 3. Load Featured (Dummy for now)
  if (featuredGrid) {
    loadFeaturedListings();
  }

  // 4. Load Main Listings (MOCK DATA)
  renderMockListings();

  // Note: We disabled the real-time search listeners for Phase 1 because
  // we are only showing a static list of examples.
}

/**
 * Updates the visual theme, Hero text, AND Promo Section based on currentCategory
 */
function applyCategoryTheme() {
  const config = CATEGORY_CONFIG[currentCategory];

  // Apply Body Class
  document.body.classList.remove(
    "theme-produce",
    "theme-inputs",
    "theme-services"
  );
  if (config.theme) {
    document.body.classList.add(config.theme);
  }

  // Update Header Navigation
  document.querySelectorAll(".nav-pill").forEach((pill) => {
    pill.classList.remove("active");
    if (pill.href.includes(`cat=${currentCategory}`)) {
      pill.classList.add("active");
    }
  });

  // Update Hero Section
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const btnEl = document.getElementById("hero-browse-btn");

  if (titleEl) titleEl.textContent = config.title;
  if (descEl) descEl.textContent = config.desc;
  if (btnEl) btnEl.textContent = config.btnText;

  // Update Promo Section
  const promoSection = document.getElementById("promo-section");
  if (promoSection && config.promo) {
    promoSection.style.backgroundImage = `url('${config.promo.bgImage}')`;

    const leftTitle = document.getElementById("promo-left-title");
    const leftDesc = document.getElementById("promo-left-desc");
    const leftBtn = document.getElementById("promo-left-btn");

    if (leftTitle) leftTitle.innerHTML = config.promo.left.title;
    if (leftDesc) leftDesc.textContent = config.promo.left.desc;
    if (leftBtn) {
      leftBtn.textContent = config.promo.left.btn;
      // Check if the button text is the specific number to make it a link
      if (config.promo.left.btn.includes("+263")) {
        leftBtn.href = "https://wa.me/263785141781";
        leftBtn.target = "_blank";
      } else {
        // Fallback for other buttons if any
        leftBtn.href = "/contact.html";
        leftBtn.target = "";
      }
    }

    const rightTitle = document.getElementById("promo-right-title");
    const rightDesc = document.getElementById("promo-right-desc");
    const rightBtn = document.getElementById("promo-right-btn");

    if (rightTitle) rightTitle.innerHTML = config.promo.right.title;
    if (rightDesc) rightDesc.textContent = config.promo.right.desc;
    if (rightBtn) rightBtn.textContent = config.promo.right.btn;
  }
}

async function loadLocationDropdown() {
  const locationSelect = document.getElementById("location-input");
  if (!locationSelect) return;
  // Phase 1: Keep location dummy
  locationSelect.innerHTML = '<option value="">All Locations</option>';
}

/**
 * PHASE 1: Renders Hardcoded Examples
 */
function renderMockListings() {
  if (loadingMessage) loadingMessage.style.display = "none";
  if (loadMoreBtn) loadMoreBtn.style.display = "none";

  // Filter mocks by category
  const filteredMocks = MOCK_LISTINGS.filter(
    (item) => item.category === currentCategory
  );

  if (filteredMocks.length === 0) {
    renderEmptyState(
      listingsGrid,
      "No Examples Yet",
      "Check back soon as we verify our first partners."
    );
    return;
  }

  listingsGrid.innerHTML = "";

  filteredMocks.forEach((item) => {
    const card = document.createElement("article");
    card.className = "listing-card fade-in-section is-visible";

    // Clicking card goes to AUTH, not listing detail
    const link = document.createElement("a");
    link.href = "/auth.html";
    link.className = "listing-card-link";

    const img = document.createElement("img");
    img.src = "/images/logo.webp"; // Using logo as placeholder
    img.alt = item.product_name;
    img.style.objectFit = "contain";
    img.style.padding = "20px";
    img.style.backgroundColor = "#f9f9f9";

    const contentDiv = document.createElement("div");
    contentDiv.className = "listing-card-content";

    const title = document.createElement("h3");
    title.textContent = item.product_name;

    const price = document.createElement("p");
    price.className = "price";
    const config = CATEGORY_CONFIG[currentCategory];
    price.textContent = `$${item.price} / ${config.unitDefault}`;

    // ★ EXAMPLE BADGE ★
    const badge = document.createElement("div");
    badge.style.backgroundColor = "#ffc107";
    badge.style.color = "#333";
    badge.style.fontSize = "0.75rem";
    badge.style.fontWeight = "700";
    badge.style.padding = "4px 8px";
    badge.style.borderRadius = "4px";
    badge.style.display = "inline-block";
    badge.style.marginBottom = "8px";
    badge.textContent = "EXAMPLE: Register to Feature";

    contentDiv.appendChild(badge);
    contentDiv.appendChild(title);
    contentDiv.appendChild(price);

    link.appendChild(img);
    link.appendChild(contentDiv);
    card.appendChild(link);
    listingsGrid.appendChild(card);
  });
}

// Disable Featured Listings for Phase 1 or show dummy
async function loadFeaturedListings() {
  if (featuredLoading) featuredLoading.style.display = "none";
  renderEmptyState(
    featuredGrid,
    "Bulk Supply",
    "Recruiting verified bulk suppliers. Contact us to apply."
  );
}

// ... (Rest of Detail Page logic remains, though it won't be reached easily in Phase 1) ...
export async function initListingDetailPage() {
  if (!listingDetailContainer) return;
  const params = new URLSearchParams(window.location.search);
  const listingId = params.get("id");
  if (!listingId) {
    listingDetailContainer.innerHTML = `<p class="error">Listing not found. <a href="index.html">Go home</a>.</p>`;
    return;
  }
  const { data, error } = await sb
    .from("listings")
    .select(`*, profiles ( id, full_name )`)
    .eq("id", listingId)
    .single();
  if (error) {
    listingDetailContainer.innerHTML = `<p class="error">Error loading listing.</p>`;
    return;
  }

  if (data) {
    document.title = `${data.product_name} - Seed & Sell`;

    // Determine context for breadcrumbs & units
    const cat = data.category || "produce";
    const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG["produce"];
    const unit = config.unitDefault;

    if (breadcrumbContainer) {
      breadcrumbContainer.innerHTML = `<a href="index.html?cat=${cat}">Home</a> &gt; <a href="index.html?cat=${cat}#marketplace-container">${
        cat.charAt(0).toUpperCase() + cat.slice(1)
      }</a> &gt; <span class="current">${data.product_name}</span>`;
    }
    const currentUserId = getCurrentUserId();
    const isOwner = currentUserId && currentUserId === data.farmer_id;
    listingDetailContainer.innerHTML = "";

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "listing-detail-image-wrapper";
    const img = document.createElement("img");
    img.id = "listing-image";

    if (data.main_image_url) {
      try {
        const imagePath = data.main_image_url.split(
          `/${CONFIG.IMAGES.BUCKET}/`
        )[1];
        if (imagePath) {
          const { data: publicUrlData } = sb.storage
            .from(CONFIG.IMAGES.BUCKET)
            .getPublicUrl(imagePath, {
              transform: { width: 800, height: 600, resize: "cover" },
            });
          img.src = publicUrlData.publicUrl;
        } else {
          img.src = data.main_image_url;
        }
      } catch (e) {
        img.src = "/images/logo.webp";
      }
    } else {
      img.src = "/images/logo.webp";
    }

    img.alt = data.product_name;
    imageWrapper.appendChild(img);

    const listingInfo = document.createElement("div");
    listingInfo.className = "listing-detail-info";
    const title = document.createElement("h2");
    title.id = "listing-title";
    title.textContent = data.product_name;
    const price = document.createElement("p");
    price.id = "listing-price";
    price.textContent = `$${data.price} / ${unit}`;

    const metaGroup = document.createElement("div");
    metaGroup.className = "listing-meta-group";
    metaGroup.innerHTML = `
      <p class="listing-meta-item"><i class="fa-solid fa-cubes"></i> <span><strong>Available:</strong> ${
        data.quantity_available || "Not specified"
      } ${unit}s</span></p>
      <p class="listing-meta-item"><i class="fa-solid fa-location-dot"></i> <span><strong>Location:</strong> ${
        data.location
      }</span></p>
    `;

    const descriptionCard = document.createElement("div");
    descriptionCard.className = "listing-description-card";
    descriptionCard.innerHTML = `<h3>Description</h3><p>${
      data.description || "No description provided."
    }</p>`;

    listingInfo.appendChild(title);
    listingInfo.appendChild(price);
    listingInfo.appendChild(metaGroup);
    listingInfo.appendChild(descriptionCard);

    const listingSidebar = document.createElement("div");
    listingSidebar.className = "listing-detail-sidebar";
    const farmerCard = document.createElement("div");
    farmerCard.className = "farmer-details-card";
    farmerCard.innerHTML = `<h3>Seller Details</h3><p class="listing-meta-item"><i class="fa-solid fa-user"></i> <span><strong>Contact:</strong> ${
      data.profiles?.full_name || "Unknown"
    }</span></p>`;

    if (isOwner) {
      const editBtn = document.createElement("a");
      editBtn.href = `/dashboard.html?edit_id=${data.id}`;
      editBtn.className = "btn btn-primary btn-full-width";
      editBtn.textContent = "Edit Your Listing";
      farmerCard.appendChild(editBtn);
    } else {
      const chatBtn = document.createElement("button");
      chatBtn.className = "btn btn-primary btn-full-width";
      chatBtn.textContent = "Chat with Seller";
      chatBtn.onclick = () => {
        const user = getUserProfile();
        if (!user) return alert("Please log in as a Buyer to chat.");
        if (user.user_role === "farmer" && cat === "produce") {
          // Optional: Restrict farmers buying from farmers only for Produce
          // For Inputs/Services, farmers usually BUY, so we allow it.
          return alert("Farmers cannot chat with other farmers.");
        }
        handleStartChat(data.profiles.id, getCurrentUserId());
      };
      farmerCard.appendChild(chatBtn);
    }
    listingSidebar.appendChild(farmerCard);

    listingDetailContainer.appendChild(imageWrapper);
    listingDetailContainer.appendChild(listingInfo);
    listingDetailContainer.appendChild(listingSidebar);
  }
}
