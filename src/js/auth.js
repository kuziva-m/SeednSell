import { sb } from "./supabase.js";

// --- Global State ---
let userProfile = null;
let currentUserId = null;
let notificationSubscription = null;
let signupPhoneIti = null;

// --- Auth State Change (The "Guard") ---
export function handleAuthStateChange() {
  sb.auth.onAuthStateChange((event, session) => {
    console.log("Auth event:", event);

    if (session) {
      // ============================
      //      USER IS LOGGED IN
      // ============================
      currentUserId = session.user.id;

      // Dispatch event to notify page logic immediately
      document.dispatchEvent(
        new CustomEvent("auth:resolved", { detail: { userId: currentUserId } })
      );

      // 1. Update Desktop Header: Show USER AVATAR + LOGOUT BUTTON
      const authSection = document.getElementById("header-auth-section");
      if (authSection) {
        authSection.innerHTML = `
          <div style="display: flex; align-items: center; gap: 15px;">
            <a href="/dashboard.html" class="user-avatar-btn" title="Go to Dashboard">
              <div class="avatar-circle">
                <i class="fa-solid fa-user"></i>
              </div>
              <span class="user-name-text" id="header-username">My Account</span>
            </a>
            <button id="header-logout-btn" class="action-icon" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; padding: 5px;" title="Log Out">
              <i class="fa-solid fa-right-from-bracket" style="color: var(--danger-color);"></i>
            </button>
          </div>
        `;

        // Attach Logout Listener immediately
        const logoutBtn = document.getElementById("header-logout-btn");
        if (logoutBtn) {
          logoutBtn.addEventListener("click", () => {
            const modal = document.getElementById("logout-modal");
            if (modal) modal.classList.add("is-visible");
          });
        }
      }

      // 2. Redirect if on Auth Page
      if (window.location.pathname.includes("auth.html")) {
        window.location.href = "/index.html";
      }

      // 3. Fetch Profile
      fetchUserProfile(currentUserId).then((profile) => {
        userProfile = profile;
      });

      // 4. Start Services
      checkForUnreadMessages();
      subscribeToNotifications();
    } else {
      // ============================
      //      USER IS LOGGED OUT
      // ============================
      userProfile = null;
      currentUserId = null;

      if (window.location.pathname.includes("dashboard.html")) {
        window.location.href = "/auth.html";
      }

      const authSection = document.getElementById("header-auth-section");
      if (authSection) {
        authSection.innerHTML = `<a href="/auth.html" class="login-link">Login</a>`;
      }

      if (notificationSubscription) notificationSubscription.unsubscribe();
    }
  });
}

// --- Auth Page Logic (Login & Signup Forms) ---
export function initAuthPage() {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const signupPassword = document.getElementById("signup-password");
  const phoneInput = document.getElementById("signup-phone");

  // ★ Initialize Phone Plugin
  if (phoneInput && window.intlTelInput) {
    signupPhoneIti = window.intlTelInput(phoneInput, {
      initialCountry: "zw", // Default to Zimbabwe
      preferredCountries: ["zw", "za", "zm", "mz"], // Common neighbors
      separateDialCode: true, // Shows flag + code separate from input
      utilsScript:
        "https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js", // Enables formatting/validation
    });
  }

  if (signupPassword) {
    signupPassword.addEventListener("input", (e) => {
      const val = e.target.value;
      const btn = signupForm ? signupForm.querySelector("button") : null;
      if (val.length > 0 && val.length < 6) {
        e.target.style.borderColor = "var(--danger-color)";
        setMessage("Password is too short (min 6 chars)", "error");
        if (btn) btn.disabled = true;
      } else {
        e.target.style.borderColor = "#ccc";
        setMessage("", "");
        if (btn) btn.disabled = false;
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = signupForm.querySelector("button[type='submit']");

      // ★ Validate Phone Number
      if (signupPhoneIti) {
        if (!signupPhoneIti.isValidNumber()) {
          setMessage("Please enter a valid phone number.", "error");
          phoneInput.style.borderColor = "var(--danger-color)";
          return;
        }
        // Get the full number (e.g., +26377...)
        const rawPhone = signupPhoneIti.getNumber();
        // Overwrite the input value so the rest of the script uses the correct format
        phoneInput.value = rawPhone;
      }

      // ★ Validate Email Format Strictly
      const emailInput = document.getElementById("signup-email");
      if (!validateEmail(emailInput.value)) {
        setMessage("Please enter a valid email address.", "error");
        emailInput.style.borderColor = "var(--danger-color)";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span>Creating Account...`;

      const email = emailInput.value;
      const password = document.getElementById("signup-password").value;
      const name = document.getElementById("signup-name").value;

      // Use the value extracted from plugin or raw input
      const phone = phoneInput.value;

      // NEW FIELDS
      const city = document.getElementById("signup-city").value;
      const neighborhood = document.getElementById("signup-area").value;
      const entityType = document.getElementById("signup-entity-type").value;
      const role = document.getElementById("signup-role").value;

      // Combine Location
      const fullLocation = `${city}, ${neighborhood}`;

      const { data, error } = await sb.auth.signUp({
        email: email,
        password: password,
      });

      if (error) {
        setMessage(error.message, "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Sign Up`;
        return;
      }

      if (data.user) {
        const { error: profileError } = await sb.from("profiles").insert({
          id: data.user.id,
          full_name: name,
          phone_number: phone,
          location: fullLocation, // Saving Combined Location
          user_role: role,
        });

        if (profileError) {
          console.error("Profile save error:", profileError);
          setMessage("Sign up successful, but profile saving failed.", "error");
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Sign Up`;
        } else {
          setMessage("Sign up successful! Redirecting...", "success");
          window.location.href = "/index.html";
        }
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span>Logging In...`;

      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;

      const { error } = await sb.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        setMessage(error.message, "error");
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Log In`;
      } else {
        setMessage("Login successful! Redirecting...", "success");
        window.location.href = "/index.html";
      }
    });
  }
}

// --- Helpers & Exports ---

async function fetchUserProfile(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (!error) return data;
}

export async function checkForUnreadMessages() {
  const user = await sb.auth.getUser();
  if (!user.data.user) return;

  const { data } = await sb.rpc("get_room_unread_counts", {
    p_user_id: user.data.user.id,
  });
  if (data && data.length > 0) {
    const bubble = document.getElementById("notification-bubble");
    const bottomBubble = document.getElementById("bottom-nav-bubble");
    if (bubble) bubble.classList.add("active");
    if (bottomBubble) bottomBubble.classList.add("active");
  }
}

export function subscribeToNotifications() {
  const userId = getCurrentUserId();
  if (!userId || notificationSubscription) return;

  notificationSubscription = sb
    .channel("public:chat_messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `receiver_id=eq.${userId}`,
      },
      () => {
        const bubble = document.getElementById("notification-bubble");
        const bottomBubble = document.getElementById("bottom-nav-bubble");
        if (bubble) bubble.classList.add("active");
        if (bottomBubble) bottomBubble.classList.add("active");
      }
    )
    .subscribe();
}

function setMessage(msg, type) {
  const el = document.getElementById("auth-message");
  if (el) {
    el.textContent = msg;
    el.className = type;
  }
}

// Helper: Strict Email Validator
function validateEmail(email) {
  // Checks for format: text @ text . text (at least 2 chars)
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
}

// Global Modal Logic (Logout)
document.addEventListener("DOMContentLoaded", () => {
  const logoutModal = document.getElementById("logout-modal");
  const cancelBtn = document.getElementById("logout-cancel-btn");
  const confirmBtn = document.getElementById("logout-confirm-btn");

  if (logoutModal && cancelBtn && confirmBtn) {
    cancelBtn.addEventListener("click", () =>
      logoutModal.classList.remove("is-visible")
    );

    logoutModal.addEventListener("click", (e) => {
      if (e.target === logoutModal) logoutModal.classList.remove("is-visible");
    });

    confirmBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      window.location.href = "/index.html";
    });
  }
});

export const getCurrentUserId = () => currentUserId;
export const getUserProfile = () => userProfile;
