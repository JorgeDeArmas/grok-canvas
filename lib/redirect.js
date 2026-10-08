(function () {
  const to = document.currentScript && document.currentScript.dataset.to;
  if (!to) return;
  const dest = new URL(to, location.href);
  location.replace(dest.pathname + location.hash);
})();
