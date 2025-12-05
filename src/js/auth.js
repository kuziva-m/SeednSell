import { sb } from "./supabase.js";

// --- Global State ---
let userProfile = null;
let currentUserId = null;
let notificationSubscription = null;

// --- Auth State Change (The "Guard") ---
export function handleAuthStateChange() {
  sb.auth.onAuthStateChange((event, session) => {
    console.log("Auth event:", event);

    if (session) {
      // ============================
      //      USER IS LOGGED IN
      // ============================
      currentUserId = session.user.id;

      // 1. Update Desktop Header: Show USER AVATAR
      const authSection = document.getElementById("header-auth-section");
      if (authSection) {
        authSection.innerHTML = `
          <a href="/dashboard.html" class="user-avatar-btn" title="Go to Dashboard">
            <div class="avatar-circle">
              <i class="fa-solid fa-user"></i>
            </div>
            <span class="user-name-text" id="header-username">My Account</span>
          </a>
        `;
      }

      // 2. Redirect if on Auth Page (Prevent double login)
      if (window.location.pathname.includes("auth.html")) {
        window.location.href = "/index.html";
      }

      // 3. Fetch Profile & Update UI
      fetchUserProfile(currentUserId).then((profile) => {
        userProfile = profile;

        // Update Header Name
        const nameEl = document.getElementById("header-username");
        if (nameEl && profile && profile.full_name) {
          // Show first name only
          const firstName = profile.full_name.split(" ")[0];
          nameEl.textContent = firstName;
        }
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

      // 1. Security Redirect: Kick user out of Dashboard
      if (window.location.pathname.includes("dashboard.html")) {
        window.location.href = "/auth.html";
      }

      // 2. Update Desktop Header: Show LOGIN LINK
      const authSection = document.getElementById("header-auth-section");
      if (authSection) {
        authSection.innerHTML = `<a href="/auth.html" class="login-link">Login</a>`;
      }

      // 3. Stop Services
      if (notificationSubscription) notificationSubscription.unsubscribe();
    }
  });
}

// --- Auth Page Logic (Login & Signup Forms) ---
export function initAuthPage() {
  // Select elements INSIDE the function to ensure they exist
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const signupPassword = document.getElementById("signup-password");

  // Real-time password validation
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

  // Handle Sign Up
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = signupForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span>Creating Account...`;

      const email = document.getElementById("signup-email").value;
      const password = document.getElementById("signup-password").value;
      const name = document.getElementById("signup-name").value;
      const rawPhone = document.getElementById("signup-phone").value;
      const location = document.getElementById("signup-location").value;
      const role = document.getElementById("signup-role").value;

      const phone = sanitizePhoneNumber(rawPhone);

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
          location: location,
          user_role: role,
        });
        if (profileError) {
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

  // Handle Login
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

function sanitizePhoneNumber(phone) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.substring(1);
  if (!digits.startsWith("263")) digits = "263" + digits;
  return "+" + digits;
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

    // Close if clicking background
    logoutModal.addEventListener("click", (e) => {
      if (e.target === logoutModal) logoutModal.classList.remove("is-visible");
    });

    confirmBtn.addEventListener("click", async () => {
      await sb.auth.signOut();
      window.location.href = "/index.html";
    });
  }
});

// Export these for use in other files (like app.js and dashboard.js)
export const getCurrentUserId = () => currentUserId;
export const getUserProfile = () => userProfile;
