// src/js/analytics.js

export function initAnalytics() {
  const GA_MEASUREMENT_ID = "G-WCRTQLKDC6";

  // 1. Check if already initialized to prevent duplicates
  if (document.getElementById("ga-script")) return;

  // 2. Create the async script tag
  const script = document.createElement("script");
  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // 3. Initialize the dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag; // Make it available globally

  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);

  console.log(`Analytics initialized: ${GA_MEASUREMENT_ID}`);
}
