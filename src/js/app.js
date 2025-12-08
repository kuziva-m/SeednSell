import {
  handleAuthStateChange,
  initAuthPage,
  getCurrentUserId,
  getUserProfile,
} from "./auth.js";
import { initScrollAnimations, initHeaderScroll } from "./animations.js";
import { initMobileNav } from "./mobile-nav.js";
import { loadComponents } from "./components.js";
import { initAnalytics } from "./analytics.js";

// --- MAIN INIT FUNCTION ---
// We use an async function to ensure components load BEFORE we attach listeners
async function initApp() {
  // 1. Initialize Analytics
  initAnalytics();

  // 2. Load HTML Templates (Header, Footer, Mobile Nav)
  await loadComponents();

  // 3. Now that HTML is in the DOM, initialize logic that depends on it
  handleAuthStateChange();
  initScrollAnimations();
  initMobileNav();
  initHeaderScroll();

  // 4. Load Page Specific Logic (Dashboard, Listings, etc.)
  loadPageLogic();
}

// Start the application
initApp();

// --- ROBUST SMART NAVIGATION (Event Delegation) ---
// Handles Mobile Menu Toggles and Protected Links globally
document.addEventListener("click", (e) => {
  const target = e.target.closest("#mobile-menu-btn");
  const closeBtn = e.target.closest("#close-menu-btn");
  const overlay = document.getElementById("mobile-menu-overlay");

  // 1. Open Menu
  if (target && overlay) {
    updateMenuState();
    overlay.classList.add("is-visible");
  }

  // 2. Close Menu (X button)
  if (closeBtn && overlay) {
    overlay.classList.remove("is-visible");
  }

  // 3. Close Menu (Clicking Background)
  if (e.target === overlay) {
    overlay.classList.remove("is-visible");
  }

  // 4. Protected Links Guard
  const protectedLink = e.target.closest(".protected-link");
  if (protectedLink) {
    const userId = getCurrentUserId();
    if (!userId) {
      e.preventDefault();
      window.location.href = "/auth.html";
    }
  }
});

// Updates the Mobile Menu with the user's name/state
function updateMenuState() {
  const userId = getCurrentUserId();
  const profile = getUserProfile();
  const nameEl = document.getElementById("menu-user-name");
  const authLink = document.getElementById("menu-auth-link");

  if (userId) {
    nameEl.textContent = `Hi, ${profile?.full_name || "Farmer"}`;
    if (authLink) {
      authLink.href = "/dashboard.html";
      authLink.innerHTML = `<i class="fa-solid fa-user"></i> My Dashboard`;
    }
    // Add Logout if missing
    if (!document.getElementById("menu-logout")) {
      const container = document.querySelector(".mobile-menu-links");
      if (container) {
        const logoutBtn = document.createElement("a");
        logoutBtn.id = "menu-logout";
        logoutBtn.href = "#";
        logoutBtn.className = "menu-link";
        logoutBtn.style.color = "var(--danger-color)";
        logoutBtn.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Log Out`;
        logoutBtn.onclick = (e) => {
          e.preventDefault();
          const modal = document.getElementById("logout-modal");
          if (modal) modal.classList.add("is-visible");
          document
            .getElementById("mobile-menu-overlay")
            .classList.remove("is-visible");
        };
        container.appendChild(logoutBtn);
      }
    }
  } else {
    nameEl.textContent = "Welcome, Guest";
    if (authLink) {
      authLink.href = "/auth.html";
      authLink.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Login / Sign Up`;
    }
    const logoutBtn = document.getElementById("menu-logout");
    if (logoutBtn) logoutBtn.remove();
  }
}

// --- SERVICE WORKER AUTO-RELOAD ---
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// --- DYNAMIC ROUTER ---
// Loads specific JS modules based on the current URL
async function loadPageLogic() {
  const currentPath = window.location.pathname;
  try {
    if (currentPath.endsWith("/") || currentPath.endsWith("/index.html")) {
      const { initListingsPage } = await import("./listings.js");
      const { initToggleSlider } = await import("./toggle.js");
      initListingsPage();
      initToggleSlider();
    } else if (currentPath.endsWith("/listing.html")) {
      const { initListingDetailPage } = await import("./listings.js");
      initListingDetailPage();
    } else if (currentPath.endsWith("/dashboard.html")) {
      const { initDashboardPage } = await import("./dashboard.js");
      initDashboardPage();
    } else if (currentPath.endsWith("/messages.html")) {
      const { initChatPage } = await import("./chat.js");
      initChatPage();
    } else if (currentPath.endsWith("/auth.html")) {
      initAuthPage();
    }
  } catch (err) {
    console.error("Page logic error:", err);
  }
}

// Global Toast Notification Helper
window.showToast = function (message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let icon =
    type === "success"
      ? "fa-circle-check"
      : type === "error"
      ? "fa-triangle-exclamation"
      : "fa-circle-info";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "fadeOutToast 0.3s forwards";
    toast.addEventListener("animationend", () => toast.remove());
  }, 4000);
};
