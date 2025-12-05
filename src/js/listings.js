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
const searchInput = document.getElementById("search-input"); // NEW
const locationInput = document.getElementById("location-input"); // NEW
const loadMoreBtn = document.getElementById("load-more-btn");
const breadcrumbContainer = document.getElementById("breadcrumb-container");

// --- State Variables ---
let currentPage = 0;
const ITEMS_PER_PAGE = 8;
let currentSearchQuery = "";
let currentLocationQuery = "";
let hasMoreListings = true;

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
  console.log("Fetching listings...");

  loadLocationDropdown();

  if (featuredGrid) {
    loadFeaturedListings();
  }

  // ★★★ NEW: Real-Time Search Listener ★★★
  const performSearch = debounce(() => {
    const productQuery = searchInput.value.trim();
    const locationQuery = locationInput.value;

    // Only search if changed
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
  }, 350); // Wait 350ms after user stops typing

  if (searchInput) searchInput.addEventListener("input", performSearch);
  if (locationInput) locationInput.addEventListener("change", performSearch);

  // Keep form submit just in case (prevent reload)
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      performSearch();
    });
  }

  // Attach Load More Listener
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => {
      currentPage++;
      fetchPeerListings();
    });
  }

  fetchPeerListings();
}

async function loadLocationDropdown() {
  const locationSelect = document.getElementById("location-input");
  if (!locationSelect) return;

  const { data: locations, error } = await sb.rpc("get_distinct_locations");

  if (error) {
    console.error("Error fetching locations:", error);
    return;
  }

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
 * Fetch Peer Listings with Pagination & Search & Skeletons
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

  let query = sb
    .from("listings")
    .select(`*, profiles ( full_name )`)
    .neq("farmer_id", CONFIG.COMPANY_USER_ID)
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

  // ★★★ NEW: Handle Visual Empty State ★★★
  if (data.length === 0 && currentPage === 0) {
    if (loadingMessage) loadingMessage.style.display = "none";

    renderEmptyState(
      listingsGrid,
      "No produce found",
      "We couldn't find exactly what you're looking for. Try a different search term or location.",
      "Clear Filters",
      () => {
        searchInput.value = "";
        locationInput.value = "";
        // Manually trigger the input event to reset search
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

  displayListings(data, listingsGrid, null, "");
}

async function loadFeaturedListings() {
  let query = sb
    .from("listings")
    .select(`*, profiles ( full_name )`)
    .eq("farmer_id", CONFIG.COMPANY_USER_ID)
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
    // ★★★ NEW: Handle Featured Empty State ★★★
    if (data.length === 0) {
      if (featuredLoading) featuredLoading.style.display = "none";
      renderEmptyState(
        featuredGrid,
        "No bulk supply",
        "Our core company has no bulk contracts available matching your criteria."
      );
    } else {
      displayListings(data, featuredGrid, featuredLoading, "");
    }
  }
}

function displayListings(listings, gridElement, loadingElement, emptyMessage) {
  if (loadingElement) loadingElement.style.display = "none";

  listings.forEach((listing) => {
    // Semantic HTML
    const card = document.createElement("article");
    card.className = "listing-card fade-in-section is-visible";

    const link = document.createElement("a");
    link.href = `listing.html?id=${listing.id}`;
    link.className = "listing-card-link";

    const img = document.createElement("img");

    // Meta Optimization: Lazy Loading
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
        img.src = "/images/logo.webp"; // Fallback to logo if error
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
    price.textContent = `$${listing.price} / crate`;

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
    if (breadcrumbContainer) {
      breadcrumbContainer.innerHTML = `<a href="index.html">Home</a> &gt; <a href="index.html#marketplace-container">Marketplace</a> &gt; <span class="current">${data.product_name}</span>`;
    }
    const currentUserId = getCurrentUserId();
    const isOwner = currentUserId && currentUserId === data.farmer_id;
    listingDetailContainer.innerHTML = "";

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "listing-detail-image-wrapper";
    const img = document.createElement("img");
    img.id = "listing-image";

    // Image Handling with Transform
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
    price.textContent = `$${data.price} / crate`;

    const metaGroup = document.createElement("div");
    metaGroup.className = "listing-meta-group";
    metaGroup.innerHTML = `
      <p class="listing-meta-item"><i class="fa-solid fa-cubes"></i> <span><strong>Available:</strong> ${
        data.quantity_available || "Not specified"
      } crates</span></p>
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
    farmerCard.innerHTML = `<h3>Farmer Details</h3><p class="listing-meta-item"><i class="fa-solid fa-user"></i> <span><strong>Contact:</strong> ${
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
      chatBtn.textContent = "Chat with Farmer";
      chatBtn.onclick = () => {
        const user = getUserProfile();
        if (!user) return alert("Please log in as a Buyer to chat.");
        if (user.user_role === "farmer")
          return alert("Farmers cannot chat with other farmers.");
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
