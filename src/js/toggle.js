// public/js/toggle.js

export function initToggleSlider() {
  const toggleWrapper = document.querySelector(".marketplace-toggle-wrapper");
  const options = document.querySelectorAll(".toggle-option");

  if (!toggleWrapper || !options.length) {
    return; // Don't run if the elements aren't on the page
  }

  const slider = document.querySelector(".toggle-slider");

  options.forEach((option) => {
    option.addEventListener("click", (e) => {
      // 1. Remove 'active' from all options
      options.forEach((opt) => opt.classList.remove("active"));

      // 2. Add 'active' to the clicked option
      const clickedOption = e.currentTarget;
      clickedOption.classList.add("active");

      const target = clickedOption.dataset.target;

      // 3. Slide the content
      // ★★★ THIS IS THE FIX ★★★
      // We now check for 'featured-listings' to add the class
      if (target === "featured-listings") {
        toggleWrapper.classList.add("featured-active");
      } else {
        // Otherwise, we remove it (making Peer-to-Peer the default)
        toggleWrapper.classList.remove("featured-active");
      }
    });
  });

  // Set initial slider width (accounts for padding)
  const firstOption = options[0];
  if (firstOption) {
    slider.style.width = `${firstOption.offsetWidth}px`;
  }
}
