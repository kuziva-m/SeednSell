// public/js/mobile-nav.js

export function initMobileNav() {
  const navToggle = document.querySelector(".mobile-nav-toggle");
  const primaryNav = document.getElementById("primary-navigation");

  if (!navToggle || !primaryNav) {
    // Elements not found, do nothing
    return;
  }

  // Toggle menu on button click
  navToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.contains("is-open");

    navToggle.setAttribute("aria-expanded", !isOpen);
    primaryNav.classList.toggle("is-open");
    document.body.classList.toggle("nav-open");
  });

  // Close menu when a nav link is clicked
  const navLinks = primaryNav.querySelectorAll("a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      // Only close if the nav is actually open (on mobile)
      if (primaryNav.classList.contains("is-open")) {
        navToggle.setAttribute("aria-expanded", false);
        primaryNav.classList.remove("is-open");
        document.body.classList.remove("nav-open");
      }
    });
  });

  // ★★★ MISSION 2: "Magic Line" Logic ★★★
  const magicLine = primaryNav.querySelector(".magic-line");
  const activeLink = primaryNav.querySelector("a.active");

  // Don't run this logic if there's no magic line or links
  if (!magicLine || !navLinks.length) return;

  // Function to move the line
  function setLineToLink(linkEl) {
    if (!linkEl) {
      // If no link is active/hovered, hide the line
      magicLine.style.width = "0px";
      return;
    }
    magicLine.style.left = `${linkEl.offsetLeft}px`;
    magicLine.style.width = `${linkEl.offsetWidth}px`;
  }

  // 1. Set initial position to the active link
  setLineToLink(activeLink);

  // 2. Add hover listeners to all links
  navLinks.forEach((link) => {
    link.addEventListener("mouseover", () => setLineToLink(link));
  });

  // 3. On mouse leave, snap back to the active link
  primaryNav.addEventListener("mouseleave", () => setLineToLink(activeLink));
}
