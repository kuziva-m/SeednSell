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

  initDashboardTabs();
  loadProfileData(currentUserId);
  fetchMyListings(currentUserId);

  // ★★★ NEW: Dashboard Logout Listener ★★★
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
      option.value = type; // We store the string directly for simplicity
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
    document.getElementById("profile-phone").value = data.phone_number;
    document.getElementById("profile-location").value = data.location;
  }
}

async function handleProfileUpdate(e, currentUserId) {
  e.preventDefault();
  profileSubmitBtn.disabled = true;
  profileSubmitBtn.innerHTML = `<span class="spinner"></span>Updating...`;

  const name = document.getElementById("profile-name").value;
  const phone = sanitizePhoneNumber(
    document.getElementById("profile-phone").value
  );
  const location = document.getElementById("profile-location").value;

  const { error } = await sb
    .from("profiles")
    .update({ full_name: name, phone_number: phone, location: location })
    .eq("id", currentUserId);

  if (error) setProfileMessage(`Error: ${error.message}`, "error");
  else {
    setProfileMessage("Profile updated!", "success");
    document.getElementById("profile-phone").value = phone;
  }
  profileSubmitBtn.disabled = false;
  profileSubmitBtn.innerHTML = "Update Profile";
}

// --- Listing CRUD ---

/**
 * Loads a listing and intelligently selects the correct category/subcategory
 */
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

  // Populate basic fields
  document.getElementById("listing-id").value = data.id;
  document.getElementById("product-name").value = data.product_name;
  document.getElementById("product-price").value = data.price;
  document.getElementById("product-quantity").value = data.quantity_available;
  document.getElementById("product-location").value = data.location;
  document.getElementById("product-description").value = data.description;

  // --- NEW: Populate Categories ---
  // 1. Set Category
  if (data.category && ZIM_CATEGORIES[data.category]) {
    categorySelect.value = data.category;
    // 2. Trigger change to populate sub-categories
    handleCategoryChange();
    // 3. Set Sub-Category (if it matches one of our types, otherwise it might be legacy data)
    if (data.sub_category) {
      subCategorySelect.value = data.sub_category;
    }
  } else {
    // Legacy support for items created before Categories existed
    categorySelect.value = "produce";
    handleCategoryChange();
  }

  document.getElementById(
    "form-title"
  ).innerHTML = `<i class="fa-solid fa-pen-to-square icon"></i> Edit Listing`;
  submitListingBtn.textContent = "Update Listing";

  // Image Preview
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

// --- INSERT ---
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
  formData.farmer_id = currentUserId; // Add FK

  const { error } = await sb.from("listings").insert(formData);

  if (error) setListingMessage(error.message, "error");
  else {
    setListingMessage("Listing posted successfully!", "success");
    listingForm.reset();
    document.getElementById("image-preview-wrapper").innerHTML = "";
    // Reset category dropdowns
    handleCategoryChange();
    switchTab("listings-panel");
  }
  submitListingBtn.disabled = false;
  submitListingBtn.textContent = "Post Listing";
}

// --- UPDATE ---
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

// --- Helpers ---

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
        const div = document.createElement("div");
        div.className = "listing-card";
        div.innerHTML = `
          <div class="listing-card-content" style="padding:1rem;">
            <h4 style="margin:0 0 0.5rem 0; font-size:1rem; color:#666; text-transform:uppercase; font-size:0.8rem; font-weight:700;">
              ${item.category || "Produce"} - ${item.sub_category || "General"}
            </h4>
            <h3 style="margin:0 0 0.5rem 0;">${item.product_name}</h3>
            <p style="color:var(--primary-color); font-weight:700;">$${
              item.price
            }</p>
          </div>
          <div class="listing-card-actions" style="padding:0 1rem 1rem 1rem; display:flex; gap:0.5rem;">
            <a href="/dashboard.html?edit_id=${
              item.id
            }" class="btn edit-btn" style="flex:1; text-align:center;">Edit</a>
            <button class="btn delete-btn" data-id="${
              item.id
            }" style="flex:1;">Delete</button>
          </div>
        `;
        // Handle Delete Logic (Simple attach)
        div
          .querySelector(".delete-btn")
          .addEventListener("click", () =>
            handleDelete(item.id, currentUserId)
          );
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

function sanitizePhoneNumber(phone) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (!digits.startsWith("263")) digits = "263" + digits;
  return "+" + digits;
}
