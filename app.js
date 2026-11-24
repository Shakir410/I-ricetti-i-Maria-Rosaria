function showPage(page) {
  currentPage = page;

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach(section => {
    const active = section.id === `page-${page}`;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });
}
