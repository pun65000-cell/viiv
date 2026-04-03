(function () {
  const dropdown = document.getElementById("profileDropdown");
  const profileBtn = document.getElementById("profileBtn");

  if (!dropdown || !profileBtn) return;

  profileBtn.addEventListener("click", () => {
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== profileBtn) {
      dropdown.style.display = "none";
    }
  });
})();

