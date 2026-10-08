(function () {
  const el = document.currentScript;
  const to = (el && el.getAttribute("data-to")) || "app/";
  const dest = new URL(to, location.href);
  dest.hash = location.hash;
  location.replace(dest.pathname + dest.search + dest.hash);
})();
