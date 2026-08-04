document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.target);
    if (!target) return;
    const reveal = target.hidden;
    target.hidden = !reveal;
    button.textContent = reveal ? "Hide interpretation" : "Reveal current interpretation";
  });
});
