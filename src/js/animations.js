// public/js/animations.js

export function initScrollAnimations() {
  const elementsToAnimate = document.querySelectorAll(".fade-in-section");

  if (elementsToAnimate.length === 0) return;

  const observerOptions = {
    root: null, // Use the viewport as the root
    rootMargin: "0px",
    threshold: 0.1, // Trigger when 10% of the element is visible
  };

  const observerCallback = (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target); // Stop observing once it's visible
      }
    });
  };

  const scrollObserver = new IntersectionObserver(
    observerCallback,
    observerOptions
  );

  elementsToAnimate.forEach((el) => {
    scrollObserver.observe(el);
  });
}

/**
 * ★★★ MISSION 1: Adds a class to the header on scroll ★★★
 */
export function initHeaderScroll() {
  const header = document.querySelector("header");
  if (!header) return;

  window.addEventListener("scroll", () => {
    if (window.scrollY > 10) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  });
}
