// src/js/components.js

export async function loadComponents() {
  const headerPlaceholder = document.getElementById("global-header");
  const footerPlaceholder = document.getElementById("global-footer");
  const mobileNavPlaceholder = document.getElementById("global-mobile-nav");

  const loads = [];

  // Load Header
  if (headerPlaceholder) {
    loads.push(
      fetch("/components/header.html")
        .then((res) => res.text())
        .then((html) => {
          headerPlaceholder.innerHTML = html;
          // Re-highlight active category pills
          const params = new URLSearchParams(window.location.search);
          const cat = params.get("cat") || "produce";
          const activePill = headerPlaceholder.querySelector(
            `.nav-pill[href*="cat=${cat}"]`
          );
          if (activePill) activePill.classList.add("active");
        })
    );
  }

  // Load Footer
  if (footerPlaceholder) {
    loads.push(
      fetch("/components/footer.html")
        .then((res) => res.text())
        .then((html) => {
          footerPlaceholder.innerHTML = html;
        })
    );
  }

  // Load Mobile Nav
  if (mobileNavPlaceholder) {
    loads.push(
      fetch("/components/mobile-nav.html")
        .then((res) => res.text())
        .then((html) => {
          mobileNavPlaceholder.innerHTML = html;
          // Highlight active mobile tab based on current page
          const currentPath = window.location.pathname;
          const activeLink = mobileNavPlaceholder.querySelector(
            `.nav-item[href="${currentPath}"]`
          );
          if (activeLink) activeLink.classList.add("active");
        })
    );
  }

  // Wait for all to finish
  await Promise.all(loads);
}
