import { sb } from "./supabase.js";
import { getCurrentUserId, getUserProfile } from "./auth.js";

// --- DOM Elements ---
const listingForm = document.getElementById("listing-form");
const listingMessage = document.getElementById("listing-message");
const submitListingBtn = document.getElementById("submit-listing-btn");
const myListingsGrid = document.getElementById("my-listings-grid");
const myListingsLoading = document.getElementById("my-listings-loading");

// New DOM Elements for Phase 2
const categorySelect = document.getElementById("product-category");
const subCategorySelect = document.getElementById("product-subcategory");
const quantityLabel = document.getElementById("quantity-label");

// Dashboard Navigation Elements
const dashboardNavLinks = document.querySelectorAll(".dashboard-nav-link");
const dashboardPanels = document.querySelectorAll(".dashboard-panel");
const profileForm = document.getElementById("profile-form");
const profileMessage = document.getElementById("profile-message");
const profileSubmitBtn = document.getElementById("profile-submit-btn");

// Global variable for dashboard phone
let profilePhoneIti = null;

// --- CONFIGURATION: Zimbabwe Agriculture Taxonomy ---
const ZIM_CATEGORIES = {
  produce: {
    label: "Farm Produce",
    unit: "Quantity (Crates, Buckets, Tons)",
    types: [
      "Maize",
      "Tomatoes",
      "Onions",
      "Leafy Vegetables (Covo/Rape)",
      "Potatoes",
      "Poultry (Road Runners/Broilers)",
      "Beef/Livestock",
      "Goats",
      "Eggs",
      "Mushrooms",
      "Soya Beans",
      "Tobacco",
    ],
  },
  inputs: {
    label: "Farm Inputs",
    unit: "Quantity (Bags, Litres, KGs)",
    types: [
      "Maize Seed (Short Season)",
      "Maize Seed (Long Season)",
      "Fertilizer (Compound D)",
      "Fertilizer (AN)",
      "Fertilizer (Super D)",
      "Lime",
      "Herbicides",
      "Pesticides",
      "Stockfeed",
      "Veterinary Medicine",
    ],
  },
  services: {
    label: "Services",
    unit: "Availability (Hours, Hectares, Trips)",
    types: [
      "Tractor Ploughing",
      "Crop Spraying",
      "Transport/Logistics",
      "Borehole Drilling",
      "Harvesting",
      "Veterinary Services",
      "Farm Fencing",
      "Consultancy/Agronomy",
    ],
  },
};

// --- INIT ---
export function initDashboardPage() {
  const currentUserId = getCurrentUserId();

  // Guard: Wait for Auth
  if (!currentUserId) {
    setTimeout(() => {
      if (getCurrentUserId()) initDashboardPage();
    }, 500);
    return;
  }

  // Show Dashboard
  const layout = document.querySelector(".dashboard-layout");
  if (layout) layout.classList.add("is-ready");

  // ★ SHOW VERIFICATION BANNER ★
  const banner = document.getElementById("verification-banner");
  if (banner) banner.style.display = "block";

  initDashboardTabs();
  loadProfileData(currentUserId);
  fetchMyListings(currentUserId);

  // ★ NEW: Initialize Phone Plugin on Profile Page
  const phoneInput = document.getElementById("profile-phone");
  if (phoneInput && window.intlTelInput && !profilePhoneIti) {
    profilePhoneIti = window.intlTelInput(phoneInput, {
      initialCountry: "zw",
      preferredCountries: ["zw", "za"],
      separateDialCode: true,
      utilsScript:
        "https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js",
    });
  }

  // ★ NEW: Dashboard Logout Listener ★
  const dashLogoutBtn = document.getElementById("dashboard-logout-btn");
  if (dashLogoutBtn) {
    dashLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Open the global logout modal
      const modal = document.getElementById("logout-modal");
      if (modal) modal.classList.add("is-visible");
    });
  }

  // Setup Form Listeners
  if (categorySelect) {
    categorySelect.addEventListener("change", handleCategoryChange);
  }

  if (profileForm) {
    profileForm.addEventListener("submit", (e) =>
      handleProfileUpdate(e, currentUserId)
    );
  }
  if (listingForm) {
    listingForm.addEventListener("submit", (e) =>
      handleListingSubmit(e, currentUserId)
    );
  }

  const imgInput = document.getElementById("product-image");
  if (imgInput) imgInput.addEventListener("change", handleImagePreview);

  // Check for Edit Mode
  const editId = new URLSearchParams(window.location.search).get("edit_id");
  if (editId) {
    loadListingForEdit(editId, currentUserId);
    switchTab("form-panel");
  } else {
    switchTab("profile-panel");
  }
}

// --- NEW: Category Logic ---
function handleCategoryChange() {
  const cat = categorySelect.value;
  const config = ZIM_CATEGORIES[cat];

  // 1. Update Unit Label
  if (config && quantityLabel) {
    quantityLabel.textContent = config.unit;
  }

  // 2. Populate Sub-Category Dropdown
  subCategorySelect.innerHTML =
    '<option value="" disabled selected>-- Select Type --</option>';

  if (config) {
    subCategorySelect.disabled = false;
    config.types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      subCategorySelect.appendChild(option);
    });
  } else {
    subCategorySelect.disabled = true;
  }
}

// --- Dashboard Tabs Logic ---
function initDashboardTabs() {
  dashboardNavLinks.forEach((link) => {
    // Skip the logout button so it doesn't try to switch tabs
    if (link.id === "dashboard-logout-btn") return;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      const panelId = link.dataset.panel;
      switchTab(panelId);
    });
  });
}

function switchTab(panelId) {
  dashboardPanels.forEach((panel) => panel.classList.remove("active"));
  dashboardNavLinks.forEach((link) => link.classList.remove("active"));

  const targetPanel = document.getElementById(panelId);
  if (targetPanel) targetPanel.classList.add("active");

  const targetLink = document.querySelector(
    `.dashboard-nav-link[data-panel="${panelId}"]`
  );
  if (targetLink) {
    targetLink.classList.add("active");
    window.location.hash = targetLink.hash;
  }
}

// --- Profile Functions ---
async function loadProfileData(currentUserId) {
  const { data } = await sb
    .from("profiles")
    .select("full_name, phone_number, location")
    .eq("id", currentUserId)
    .single();
  if (data) {
    document.getElementById("profile-name").value = data.full_name;
    // For phone, if plugin exists, use setNumber to ensure flag updates
    if (profilePhoneIti) {
      profilePhoneIti.setNumber(data.phone_number);
    } else {
      document.getElementById("profile-phone").value = data.phone_number;
    }
    document.getElementById("profile-location").value = data.location;
  }
}

async function handleProfileUpdate(e, currentUserId) {
  e.preventDefault();

  // Validate Phone
  if (profilePhoneIti && !profilePhoneIti.isValidNumber()) {
    setProfileMessage("Invalid phone number.", "error");
    return;
  }

  profileSubmitBtn.disabled = true;
  profileSubmitBtn.innerHTML = `<span class="spinner"></span>Updating...`;

  const name = document.getElementById("profile-name").value;
  // Get formatted number from plugin
  const phone = profilePhoneIti
    ? profilePhoneIti.getNumber()
    : document.getElementById("profile-phone").value;
  const location = document.getElementById("profile-location").value;

  const { error } = await sb
    .from("profiles")
    .update({ full_name: name, phone_number: phone, location: location })
    .eq("id", currentUserId);

  if (error) setProfileMessage(`Error: ${error.message}`, "error");
  else {
    setProfileMessage("Profile updated!", "success");
    // Update the input with the clean formatted number
    if (profilePhoneIti) profilePhoneIti.setNumber(phone);
  }
  profileSubmitBtn.disabled = false;
  profileSubmitBtn.innerHTML = "Update Profile";
}

// --- Listing CRUD ---

async function loadListingForEdit(listingId, currentUserId) {
  setListingMessage("Loading listing...", "success");
  const { data, error } = await sb
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("farmer_id", currentUserId)
    .single();

  if (error || !data) {
    setListingMessage("Error loading listing.", "error");
    return;
  }

  document.getElementById("listing-id").value = data.id;
  document.getElementById("product-name").value = data.product_name;
  document.getElementById("product-price").value = data.price;
  document.getElementById("product-quantity").value = data.quantity_available;
  document.getElementById("product-location").value = data.location;
  document.getElementById("product-description").value = data.description;

  // Set Category & Sub-category
  if (data.category && ZIM_CATEGORIES[data.category]) {
    categorySelect.value = data.category;
    handleCategoryChange();
    if (data.sub_category) {
      subCategorySelect.value = data.sub_category;
    }
  } else {
    categorySelect.value = "produce";
    handleCategoryChange();
  }

  document.getElementById(
    "form-title"
  ).innerHTML = `<i class="fa-solid fa-pen-to-square icon"></i> Edit Listing`;
  submitListingBtn.textContent = "Update Listing";

  let previewWrapper = document.getElementById("image-preview-wrapper");
  if (!previewWrapper) {
    previewWrapper = document.createElement("div");
    previewWrapper.id = "image-preview-wrapper";
    listingForm.insertBefore(previewWrapper, submitListingBtn);
  }
  previewWrapper.innerHTML = `<img src="${data.main_image_url}" alt="Current image">`;
  setListingMessage("Loaded. Make changes and Update.", "success");
}

function handleImagePreview(e) {
  const file = e.target.files[0];
  let wrapper = document.getElementById("image-preview-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = "image-preview-wrapper";
    listingForm.insertBefore(wrapper, submitListingBtn);
  }
  wrapper.innerHTML = "";
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.createElement("img");
      img.src = ev.target.result;
      wrapper.appendChild(img);
    };
    reader.readAsDataURL(file);
  }
}

async function handleListingSubmit(e, currentUserId) {
  e.preventDefault();
  const id = document.getElementById("listing-id").value;
  if (id) await handleListingUpdate(e, currentUserId, id);
  else await handleListingInsert(e, currentUserId);
  fetchMyListings(currentUserId);
}

async function handleListingInsert(e, currentUserId) {
  if (!validateForm()) return;

  submitListingBtn.disabled = true;
  submitListingBtn.innerHTML = `<span class="spinner"></span>Uploading...`;

  const formData = getFormData();
  const imageFile = document.getElementById("product-image").files[0];

  if (!imageFile) {
    setListingMessage("Image required.", "error");
    submitListingBtn.disabled = false;
    return;
  }

  const imageUrl = await uploadImage(imageFile, currentUserId);
  if (!imageUrl) {
    submitListingBtn.disabled = false;
    return;
  }

  formData.main_image_url = imageUrl;
  formData.farmer_id = currentUserId;

  const { error } = await sb.from("listings").insert(formData);

  if (error) setListingMessage(error.message, "error");
  else {
    setListingMessage("Listing posted successfully!", "success");
    listingForm.reset();
    document.getElementById("image-preview-wrapper").innerHTML = "";
    handleCategoryChange();
    switchTab("listings-panel");
  }
  submitListingBtn.disabled = false;
  submitListingBtn.textContent = "Post Listing";
}

async function handleListingUpdate(e, currentUserId, listingId) {
  if (!validateForm()) return;

  submitListingBtn.disabled = true;
  submitListingBtn.innerHTML = `<span class="spinner"></span>Updating...`;

  const formData = getFormData();
  const imageFile = document.getElementById("product-image").files[0];

  if (imageFile) {
    const imageUrl = await uploadImage(imageFile, currentUserId);
    if (imageUrl) formData.main_image_url = imageUrl;
  }

  const { error } = await sb
    .from("listings")
    .update(formData)
    .eq("id", listingId);

  if (error) setListingMessage(error.message, "error");
  else {
    setListingMessage("Listing updated!", "success");
    setTimeout(() => setListingMessage(""), 3000);
  }
  submitListingBtn.disabled = false;
  submitListingBtn.textContent = "Update Listing";
}

function getFormData() {
  return {
    category: document.getElementById("product-category").value,
    sub_category: document.getElementById("product-subcategory").value,
    product_name: document.getElementById("product-name").value,
    price: document.getElementById("product-price").value,
    quantity_available: document.getElementById("product-quantity").value,
    location: document.getElementById("product-location").value,
    description: document.getElementById("product-description").value,
  };
}

function validateForm() {
  const cat = document.getElementById("product-category").value;
  const sub = document.getElementById("product-subcategory").value;
  const price = parseFloat(document.getElementById("product-price").value);

  if (!cat) {
    setListingMessage("Please select a Category.", "error");
    return false;
  }
  if (!sub) {
    setListingMessage("Please select a Sub-Category.", "error");
    return false;
  }
  if (isNaN(price) || price <= 0) {
    setListingMessage("Price must be valid.", "error");
    return false;
  }
  return true;
}

async function uploadImage(file, userId) {
  setListingMessage("Uploading image...", "success");
  const path = `public/${userId}_${Date.now()}_${file.name.replace(
    /[^a-zA-Z0-9.]/g,
    ""
  )}`;
  const { error } = await sb.storage.from("product_images").upload(path, file);
  if (error) {
    setListingMessage(`Upload failed: ${error.message}`, "error");
    return null;
  }
  const { data } = sb.storage.from("product_images").getPublicUrl(path);
  return data.publicUrl;
}

async function fetchMyListings(currentUserId) {
  if (!myListingsGrid) return;
  myListingsLoading.textContent = "Loading listings...";

  // ★ CRITICAL SECURITY NOTE: ★
  // This function MUST be guarded by Supabase RLS (Row Level Security) policies
  // in the database. Relying on `eq('farmer_id', currentUserId)` in the client
  // is NOT secure, as a malicious user could spoof the JS context.
  // Ensure the policy "Users can only view/delete their own listings" is active.

  const { data, error } = await sb
    .from("listings")
    .select("*")
    .eq("farmer_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) myListingsLoading.textContent = "Error loading.";
  else {
    myListingsGrid.innerHTML = "";
    if (data.length === 0) {
      myListingsLoading.textContent = "No listings yet.";
      myListingsLoading.style.display = "block";
    } else {
      myListingsLoading.style.display = "none";
      data.forEach((item) => {
        // ★ SECURITY FIX: Using DOM creation instead of innerHTML to prevent XSS
        const div = document.createElement("div");
        div.className = "listing-card";

        // Content Wrapper
        const contentDiv = document.createElement("div");
        contentDiv.className = "listing-card-content";
        contentDiv.style.padding = "1rem";

        const h4 = document.createElement("h4");
        h4.style.cssText =
          "margin:0 0 0.5rem 0; font-size:1rem; color:#666; text-transform:uppercase; font-size:0.8rem; font-weight:700;";
        h4.textContent = `${item.category || "Produce"} - ${
          item.sub_category || "General"
        }`;

        const h3 = document.createElement("h3");
        h3.style.margin = "0 0 0.5rem 0";
        h3.textContent = item.product_name; // Safe from XSS

        const p = document.createElement("p");
        p.style.cssText = "color:var(--primary-color); font-weight:700;";
        p.textContent = `$${item.price}`;

        contentDiv.appendChild(h4);
        contentDiv.appendChild(h3);
        contentDiv.appendChild(p);

        // Actions Wrapper
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "listing-card-actions";
        actionsDiv.style.cssText =
          "padding:0 1rem 1rem 1rem; display:flex; gap:0.5rem;";

        const editLink = document.createElement("a");
        editLink.href = `/dashboard.html?edit_id=${item.id}`;
        editLink.className = "btn edit-btn";
        editLink.style.cssText = "flex:1; text-align:center;";
        editLink.textContent = "Edit";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn delete-btn";
        deleteBtn.dataset.id = item.id;
        deleteBtn.style.flex = "1";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () =>
          handleDelete(item.id, currentUserId)
        );

        actionsDiv.appendChild(editLink);
        actionsDiv.appendChild(deleteBtn);

        div.appendChild(contentDiv);
        div.appendChild(actionsDiv);
        myListingsGrid.appendChild(div);
      });
    }
  }
}

async function handleDelete(id, userId) {
  if (!confirm("Delete this listing?")) return;
  await sb.from("listings").delete().eq("id", id).eq("farmer_id", userId);
  fetchMyListings(userId);
}

function setListingMessage(msg, type) {
  if (listingMessage) {
    listingMessage.textContent = msg;
    listingMessage.className = type;
  }
}

function setProfileMessage(msg, type) {
  if (profileMessage) {
    profileMessage.textContent = msg;
    profileMessage.className = type;
  }
}
