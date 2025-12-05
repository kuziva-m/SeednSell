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

// --- CONFIG: Page Themes & Content ---
// ★ CHANGE IMAGE PATHS HERE IF YOU USE JPG/PNG ★
const CATEGORY_CONFIG = {
  produce: {
    theme: "theme-produce",
    title: "Connect Directly with Farmers.",
    desc: "Fresh produce from the farm, straight to you. No middle-man.",
    btnText: "Browse Produce",
    unitDefault: "crate",
    promo: {
      bgImage: "/images/field.webp",
      left: {
        title:
          '<i class="fa-solid fa-truck-ramp-box icon"></i>Are You a Large-Scale Buyer?',
        desc: "Need a reliable, large-volume supply of produce? Our core company offers bulk contracts for supermarkets and exporters.",
        btn: "Contact Sales",
      },
      right: {
        title: '<i class="fa-solid fa-tractor icon"></i>Are You a Farmer?',
        desc: "Tired of finding buyers? Join our Contract Program. We supply the seed and guarantee to buy 100% of your harvest.",
        btn: "Join Our Program",
      },
    },
  },
  inputs: {
    theme: "theme-inputs",
    title: "Quality Farm Inputs & Seeds.",
    desc: "Find fertilizer, seeds, and chemicals from trusted suppliers near you.",
    btnText: "Browse Inputs",
    unitDefault: "bag",
    promo: {
      bgImage: "/images/promo-inputs.webp", // <--- Change this to .jpg if needed
      left: {
        title: '<i class="fa-solid fa-shop icon"></i>Looking for Bulk Inputs?',
        desc: "We supply large-scale commercial farms with fertilizer, chemicals, and seed at wholesale prices.",
        btn: "Get a Quote",
      },
      right: {
        title:
          '<i class="fa-solid fa-hand-holding-dollar icon"></i>Are You a Supplier?',
        desc: "Expand your customer base. List your agro-chemicals and seeds directly to thousands of farmers.",
        btn: "Start Selling Inputs",
      },
    },
  },
  services: {
    theme: "theme-services",
    title: "Hire Reliable Farm Services.",
    desc: "Tractors, transport, and veterinary services on demand.",
    btnText: "Find Services",
    unitDefault: "job",
    promo: {
      bgImage: "/images/promo-services.webp", // <--- Change this to .jpg if needed
      left: {
        title:
          '<i class="fa-solid fa-clipboard-list icon"></i>Need Contract Work Done?',
        desc: "From ploughing to harvesting, find reliable service providers with verified ratings.",
        btn: "Post a Job",
      },
      right: {
        title: '<i class="fa-solid fa-wrench icon"></i>Own a Tractor or Truck?',
        desc: "Don't let your machinery sit idle. List your services and get hired by farmers in your area.",
        btn: "List Your Service",
      },
    },
  },
};

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

  // 1. Detect Category from URL (e.g., index.html?cat=inputs)
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get("cat");

  // Validate category, fallback to 'produce' if missing or invalid
  if (catParam && CATEGORY_CONFIG[catParam]) {
    currentCategory = catParam;
  } else {
    currentCategory = "produce";
  }

  console.log(`Initializing listings for category: ${currentCategory}`);

  // 2. Apply Theme & Hero Content
  applyCategoryTheme();

  // 3. Load Filters & Data
  loadLocationDropdown();

  if (featuredGrid) {
    loadFeaturedListings();
  }

  // Real-Time Search Listener
  const performSearch = debounce(() => {
    const productQuery = searchInput.value.trim();
    const locationQuery = locationInput.value;

    if (
      productQuery === currentSearchQuery &&
      locationQuery === currentLocationQuery
    )
      return;

    currentSearchQuery = productQuery;
    currentLocationQuery = locationQuery;

    currentPage = 0;
    hasMoreListings = true;
    if (loadMoreBtn) loadMoreBtn.style.display = "none";

    fetchPeerListings();

    if (featuredGrid) {
      featuredGrid.innerHTML = "";
      if (featuredLoading) {
        featuredLoading.style.display = "block";
        featuredLoading.textContent = "Searching bulk supply...";
      }
      loadFeaturedListings();
    }
  }, 350);

  if (searchInput) searchInput.addEventListener("input", performSearch);
  if (locationInput) locationInput.addEventListener("change", performSearch);

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      performSearch();
    });
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentPage++;
      fetchPeerListings();
    });
  }

  // Initial Fetch
  fetchPeerListings();
}

/**
 * Updates the visual theme, Hero text, AND Promo Section based on currentCategory
 */
function applyCategoryTheme() {
  const config = CATEGORY_CONFIG[currentCategory];

  // 1. Apply Body Class for Color Theme
  document.body.classList.remove(
    "theme-produce",
    "theme-inputs",
    "theme-services"
  );
  if (config.theme) {
    document.body.classList.add(config.theme);
  }

  // 2. Update Header Navigation Pills (Active State)
  document.querySelectorAll(".nav-pill").forEach((pill) => {
    pill.classList.remove("active");
    if (pill.href.includes(`cat=${currentCategory}`)) {
      pill.classList.add("active");
    }
  });

  // 3. Update Hero Section Text
  const titleEl = document.getElementById("hero-title");
  const descEl = document.getElementById("hero-desc");
  const btnEl = document.getElementById("hero-browse-btn");

  if (titleEl) titleEl.textContent = config.title;
  if (descEl) descEl.textContent = config.desc;
  if (btnEl) btnEl.textContent = config.btnText;

  // 4. Update Promo Section (Background & Text)
  const promoSection = document.getElementById("promo-section");

  if (promoSection && config.promo) {
    // Change Background Image
    promoSection.style.backgroundImage = `url('${config.promo.bgImage}')`;

    // Update Left Card
    const leftTitle = document.getElementById("promo-left-title");
    const leftDesc = document.getElementById("promo-left-desc");
    const leftBtn = document.getElementById("promo-left-btn");

    if (leftTitle) leftTitle.innerHTML = config.promo.left.title;
    if (leftDesc) leftDesc.textContent = config.promo.left.desc;
    if (leftBtn) leftBtn.textContent = config.promo.left.btn;

    // Update Right Card
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

  const { data: locations, error } = await sb.rpc("get_distinct_locations");

  if (error) {
    console.error("Error fetching locations:", error);
    return;
  }

  // Clear existing options except the first one
  locationSelect.innerHTML = '<option value="">All Locations</option>';

  locations.forEach((item) => {
    if (item.location && item.location.trim() !== "") {
      const option = document.createElement("option");
      option.value = item.location;
      option.textContent = item.location;
      locationSelect.appendChild(option);
    }
  });
}

/**
 * Fetch Peer Listings with Pagination, Search & Category Filter
 */
async function fetchPeerListings() {
  if (!hasMoreListings) return;

  if (loadMoreBtn) loadMoreBtn.disabled = true;

  if (currentPage === 0) {
    if (loadingMessage) loadingMessage.style.display = "none";
    renderSkeletons(listingsGrid, 4);
  } else {
    if (loadMoreBtn) loadMoreBtn.textContent = "Loading...";
  }

  const from = currentPage * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  // Build Query
  let query = sb
    .from("listings")
    .select(`*, profiles ( full_name )`)
    .neq("farmer_id", CONFIG.COMPANY_USER_ID)
    .eq("category", currentCategory) // ★ Filter by Category ★
    .order("created_at", { ascending: false })
    .range(from, to);

  if (currentSearchQuery) {
    query = query.ilike("product_name", `%${currentSearchQuery}%`);
  }
  if (currentLocationQuery) {
    query = query.eq("location", currentLocationQuery);
  }

  const { data, error } = await query;

  if (loadMoreBtn) {
    loadMoreBtn.textContent = "Load More";
    loadMoreBtn.disabled = false;
  }

  if (error) {
    if (currentPage === 0) listingsGrid.innerHTML = "";
    if (loadingMessage) {
      loadingMessage.textContent = `Error loading listings: ${error.message}`;
      loadingMessage.style.display = "block";
    }
    return;
  }

  if (currentPage === 0) {
    listingsGrid.innerHTML = "";
  }

  // Handle Empty State
  if (data.length === 0 && currentPage === 0) {
    if (loadingMessage) loadingMessage.style.display = "none";

    renderEmptyState(
      listingsGrid,
      `No ${currentCategory} found`,
      "We couldn't find exactly what you're looking for. Try a different search term or location.",
      "Clear Filters",
      () => {
        searchInput.value = "";
        locationInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
      }
    );

    if (loadMoreBtn) loadMoreBtn.style.display = "none";
    return;
  }

  if (data.length < ITEMS_PER_PAGE) {
    hasMoreListings = false;
    if (loadMoreBtn) loadMoreBtn.style.display = "none";
  } else {
    if (loadMoreBtn) loadMoreBtn.style.display = "block";
  }

  displayListings(data, listingsGrid, null);
}

/**
 * Fetch Featured Listings (B2B/Bulk) filtered by Category
 */
async function loadFeaturedListings() {
  let query = sb
    .from("listings")
    .select(`*, profiles ( full_name )`)
    .eq("farmer_id", CONFIG.COMPANY_USER_ID)
    .eq("category", currentCategory) // ★ Filter by Category ★
    .order("created_at", { ascending: false });

  if (currentSearchQuery) {
    query = query.ilike("product_name", `%${currentSearchQuery}%`);
  }
  if (currentLocationQuery) {
    query = query.eq("location", currentLocationQuery);
  }

  const { data, error } = await query;

  if (error) {
    featuredLoading.textContent = `Error loading featured listings.`;
  } else {
    if (data.length === 0) {
      if (featuredLoading) featuredLoading.style.display = "none";
      renderEmptyState(
        featuredGrid,
        "No featured items",
        `Our core company has no bulk ${currentCategory} contracts available right now.`
      );
    } else {
      displayListings(data, featuredGrid, featuredLoading);
    }
  }
}

function displayListings(listings, gridElement, loadingElement) {
  if (loadingElement) loadingElement.style.display = "none";

  listings.forEach((listing) => {
    const card = document.createElement("article");
    card.className = "listing-card fade-in-section is-visible";

    const link = document.createElement("a");
    link.href = `listing.html?id=${listing.id}`;
    link.className = "listing-card-link";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";

    if (listing.main_image_url) {
      try {
        const imagePath = listing.main_image_url.split(
          `/${CONFIG.IMAGES.BUCKET}/`
        )[1];
        if (imagePath) {
          const { data: publicUrlData } = sb.storage
            .from(CONFIG.IMAGES.BUCKET)
            .getPublicUrl(imagePath, {
              transform: {
                width: 400,
                height: 300,
                resize: "cover",
              },
            });
          img.src = publicUrlData.publicUrl;
        } else {
          img.src = listing.main_image_url;
        }
      } catch (e) {
        img.src = "/images/logo.webp";
      }
    } else {
      img.src = "/images/logo.webp";
    }

    img.alt = listing.product_name;

    const contentDiv = document.createElement("div");
    contentDiv.className = "listing-card-content";

    const title = document.createElement("h3");
    title.textContent = listing.product_name;

    const price = document.createElement("p");
    price.className = "price";

    // ★ Dynamic Unit Display ★
    const config =
      CATEGORY_CONFIG[currentCategory] || CATEGORY_CONFIG["produce"];
    const unit = config.unitDefault;
    price.textContent = `$${listing.price} / ${unit}`;

    const location = document.createElement("p");
    location.className = "location";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-location-dot";
    const locationText = document.createTextNode(` ${listing.location}`);
    location.appendChild(icon);
    location.appendChild(locationText);

    contentDiv.appendChild(title);
    contentDiv.appendChild(price);
    contentDiv.appendChild(location);
    link.appendChild(img);
    link.appendChild(contentDiv);
    card.appendChild(link);
    gridElement.appendChild(card);
  });
}

// --- Listing Detail Page Logic ---
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
