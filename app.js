const STORAGE_KEY = "quaderno-ricette-v1";
const DIARY_STORAGE_KEY = "quaderno-diario-v1";
let recipes = loadRecipes();
let notebooks = loadNotebooks();
let photoDraft = [];
let photoDraftGeneration = 0;
let pendingPhotoCount = 0;
let activePhotoRecipeId = null;
let activePhotoIndex = 0;
let currentPage = "home";
let isPageTransitioning = false;
let queuedPage = null;
let activeNotebookId = null;
let activeDiaryPageId = null;
let drawingMode = "pen";
let isDrawing = false;
let canvasHasDrawing = false;
let drawingLoadPending = false;
let drawingLoadId = 0;
let lastDrawingPoint = null;
const MOTIVATION_KEY = "quaderno-motivational-quote-index";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const recipeCategoryOptions = [
  {
    name: "Antipasti",
    description: "Piccoli assaggi per cominciare",
    background: "#eeeade",
    illustration: `<g fill="#9aa98b"><circle cx="385" cy="275" r="44"/><circle cx="485" cy="315" r="39"/><circle cx="425" cy="365" r="35"/></g><g fill="#60745a"><path d="M376 223q18-35 42-11-18 25-42 11"/><path d="M477 269q18-35 42-11-18 25-42 11"/><path d="M416 324q18-35 42-11-18 25-42 11"/></g>`
  },
  {
    name: "Primi",
    description: "Pasta, riso e zuppe",
    background: "#f0ecdf",
    illustration: `<g fill="none" stroke="#c8aa70" stroke-width="15" stroke-linecap="round"><path d="M330 260c45-55 180-45 220 10s-165 95-195 40 125-90 190-35-100 100-165 70 60-110 145-75"/><path d="M350 350c40-42 120-55 175-20s-75 70-125 50"/></g><g fill="#8e9f80"><circle cx="376" cy="245" r="8"/><circle cx="521" cy="325" r="8"/><circle cx="438" cy="370" r="7"/></g>`
  },
  {
    name: "Secondi",
    description: "Carne, pesce e piatti forti",
    background: "#e9ebe3",
    illustration: `<path d="M340 270c28-70 180-78 220-10 42 71-45 132-123 122-72-9-124-42-97-112" fill="#8e9f80"/><g stroke="#f0f2e9" stroke-width="10" stroke-linecap="round"><path d="m385 265 100 100"/><path d="m422 244 100 100"/><path d="m360 303 85 85"/></g><g fill="#62765c"><ellipse cx="350" cy="235" rx="14" ry="31" transform="rotate(-35 350 235)"/><ellipse cx="540" cy="382" rx="13" ry="28" transform="rotate(32 540 382)"/></g>`
  },
  {
    name: "Contorni",
    description: "Verdure e idee di stagione",
    background: "#e9eee5",
    illustration: `<g fill="#75896f"><ellipse cx="380" cy="300" rx="34" ry="65" transform="rotate(-38 380 300)"/><ellipse cx="445" cy="275" rx="34" ry="67" transform="rotate(22 445 275)"/><ellipse cx="500" cy="320" rx="34" ry="62" transform="rotate(45 500 320)"/><ellipse cx="420" cy="365" rx="31" ry="55" transform="rotate(-15 420 365)"/></g><g fill="#9aab87"><circle cx="385" cy="300" r="12"/><circle cx="485" cy="345" r="11"/><circle cx="445" cy="265" r="10"/></g>`
  },
  {
    name: "Dolci",
    description: "Torte, biscotti e dessert",
    background: "#f0ecdf",
    illustration: `<path d="M350 325h205l-23 82H373z" fill="#d9ddcf"/><path d="M370 275h165v52H370z" fill="#f3f2e9"/><path d="M382 252q8-46 36 0 25-52 45 0 27-44 42 0v25H382z" fill="#8a9b79"/><g fill="#687c5d"><circle cx="420" cy="284" r="9"/><circle cx="473" cy="297" r="8"/><circle cx="505" cy="269" r="8"/></g>`
  },
  {
    name: "Altro",
    description: "Bevande, conserve e tutto il resto",
    background: "#e9ebe3",
    illustration: `<path d="M365 285h170l-18 108q-3 20-25 20h-84q-22 0-25-20z" fill="#687c5d"/><rect x="350" y="270" width="200" height="24" rx="12" fill="#8a9b79"/><path d="M405 250q-20-35 5-57m48 57q-20-35 5-57m35 57q-20-35 5-57" fill="none" stroke="#b8c8ad" stroke-width="11" stroke-linecap="round"/>`
  }
];
const scrollRevealObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.classList.toggle("is-visible", entry.isIntersecting);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" })
  : null;

function prepareScrollReveal() {
  $$(".welcome, .shortcut-section, .section-heading, .recipe-card, .toolbar, .empty-state, .notebook-card, .notebook-page-button, #page-recipes > h1, #page-favorites > h1, #page-diary > h1")
    .forEach(element => {
      if (element.classList.contains("scroll-reveal")) return;
      element.classList.add("scroll-reveal");
      if (scrollRevealObserver) scrollRevealObserver.observe(element);
      else element.classList.add("is-visible");
    });
}

function loadRecipes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {
      const sample = createSampleRecipe();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([sample]));
      return [sample];
    }

    const stored = JSON.parse(saved);
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function loadNotebooks() {
  try {
    const stored = JSON.parse(localStorage.getItem(DIARY_STORAGE_KEY) || "[]");
    if (Array.isArray(stored)) {
      if (stored.length && stored.every(item => Array.isArray(item.pages))) return stored;
      return notebooksFromLegacyEntries(stored);
    }
    return Array.isArray(stored.notebooks) ? stored.notebooks : [];
  } catch {
    return [];
  }
}

function notebooksFromLegacyEntries(entries) {
  if (!entries.length) return [];
  const now = new Date().toISOString();
  return [{
    id: crypto.randomUUID(),
    title: "Il mio quaderno",
    createdAt: now,
    pages: entries.map((entry, index) => ({
      id: entry.id || crypto.randomUUID(),
      title: entry.title || `Pagina ${index + 1}`,
      date: entry.date || "",
      content: entry.content || "",
      drawing: entry.drawing || "",
      createdAt: entry.createdAt || now,
      updatedAt: entry.updatedAt || now
    }))
  }];
}

function createSampleRecipe() {
  const illustration = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600">
      <defs>
        <linearGradient id="background" x2="1" y2="1">
          <stop stop-color="#f2eee3"/>
          <stop offset="1" stop-color="#e5e8dc"/>
        </linearGradient>
        <radialGradient id="plate">
          <stop stop-color="#fffefb"/>
          <stop offset="1" stop-color="#edf1e9"/>
        </radialGradient>
      </defs>
      <rect width="900" height="600" fill="url(#background)"/>
      <circle cx="450" cy="315" r="220" fill="#748064" opacity=".14"/>
      <circle cx="450" cy="295" r="202" fill="url(#plate)"/>
      <circle cx="450" cy="295" r="165" fill="#d6b66f" opacity=".45"/>
      <g fill="none" stroke="#d6a94f" stroke-width="14" stroke-linecap="round">
        <path d="M330 245c48-55 172-58 220 0s-147 111-184 43 118-94 188-28-104 117-167 66 66-116 144-83"/>
        <path d="M340 315c55-47 151-47 205-4s-123 91-172 43 72-85 143-57 37 78-19 88"/>
        <path d="M360 370c46-39 121-32 157 2s-70 66-117 40"/>
      </g>
      <g fill="#75885b">
        <ellipse cx="371" cy="235" rx="12" ry="25" transform="rotate(-38 371 235)"/>
        <ellipse cx="541" cy="276" rx="12" ry="25" transform="rotate(42 541 276)"/>
        <ellipse cx="414" cy="354" rx="11" ry="24" transform="rotate(28 414 354)"/>
        <ellipse cx="512" cy="347" rx="11" ry="23" transform="rotate(-35 512 347)"/>
      </g>
      <g fill="#f3d37c">
        <circle cx="418" cy="258" r="8"/><circle cx="489" cy="322" r="7"/>
        <circle cx="460" cy="211" r="6"/><circle cx="375" cy="316" r="7"/>
        <circle cx="527" cy="365" r="6"/>
      </g>
      <text x="450" y="555" text-anchor="middle" fill="#62765c" font-family="Georgia,serif" font-size="24" letter-spacing="5">FATTO IN CASA</text>
    </svg>`;

  return {
    id: "demo-pasta-limone",
    name: "Pasta al limone e basilico",
    category: "Primi",
    date: new Date().toISOString().slice(0, 10),
    ingredients: "320 g di spaghetti\n2 limoni non trattati\n40 g di burro\n60 g di Parmigiano Reggiano grattugiato\nUn mazzetto di basilico fresco\nSale e pepe nero",
    steps: "1. Porta a ebollizione una pentola d'acqua, sala e cuoci gli spaghetti al dente.\n2. Nel frattempo sciogli il burro in una padella ampia con la scorza grattugiata dei limoni.\n3. Aggiungi un mestolo di acqua di cottura e il succo di mezzo limone.\n4. Trasferisci la pasta nella padella e manteca con il Parmigiano, aggiungendo poca acqua alla volta.\n5. Completa con basilico spezzettato, pepe nero e altra scorza di limone. Servi subito.",
    memory: "La preparava la nonna nelle domeniche d'estate, con i limoni del giardino. Il segreto è mantecare con calma e aggiungere il basilico solo alla fine.",
    photos: [`data:image/svg+xml,${encodeURIComponent(illustration)}`],
    favorite: true,
    createdAt: new Date().toISOString()
  };
}

function saveRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  render();
}

function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function recipePhotos(recipe) {
  return Array.isArray(recipe.photos)
    ? recipe.photos.filter(photo => typeof photo === "string" && photo.startsWith("data:image/"))
    : [];
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function showPage(page) {
  const nextSection = $(`#page-${page}`);
  const currentSection = $(".page.active");
  if (!nextSection) return;
  if (isPageTransitioning) {
    queuedPage = page;
    return;
  }
  if (currentSection === nextSection) return;

  $$(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  $$(".mobile-nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  if (currentPage === "diary" && activeDiaryPageId) saveDiaryPage(false);
  isPageTransitioning = true;
  currentSection.classList.add("is-leaving");
  const finishTransition = event => {
    if (event.target !== currentSection || event.animationName !== "page-exit") return;
    currentSection.removeEventListener("animationend", finishTransition);
    currentSection.classList.remove("active", "is-leaving");
    nextSection.classList.add("active");
    currentPage = page;
    document.body.classList.toggle("notebook-mode", page === "diary" && !$("#diaryNotebookView").hidden);
    if (page === "home") updateKitchenQuote();
    isPageTransitioning = false;

    const nextPage = queuedPage;
    queuedPage = null;
    if (nextPage && nextPage !== currentPage) showPage(nextPage);
  };
  currentSection.addEventListener("animationend", finishTransition);

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function persistNotebooks() {
  localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(notebooks));
}

function getNotebookCoverColor(notebook) {
  return /^#[\da-f]{6}$/i.test(notebook.coverColor || "") ? notebook.coverColor : "#e5e3d1";
}

function renderDiary() {
  $("#diaryCount").textContent = notebooks.length;
  $("#notebookGrid").innerHTML = notebooks.map(notebook => `
    <article class="notebook-card" style="--notebook-cover-color: ${getNotebookCoverColor(notebook)}">
      <button type="button" class="notebook-card-open" data-open-notebook="${escapeHtml(notebook.id)}">
        <span class="notebook-cover-label">
          <small>IL MIO QUADERNO</small>
          <strong>${escapeHtml(notebook.title)}</strong>
          <small>${notebook.pages.length} ${notebook.pages.length === 1 ? "pagina" : "pagine"}</small>
        </span>
        <span class="notebook-card-arrow" aria-hidden="true">↗</span>
      </button>
      <button type="button" class="notebook-delete" data-delete-notebook="${escapeHtml(notebook.id)}" aria-label="Elimina il quaderno ${escapeHtml(notebook.title)}">Elimina</button>
    </article>`).join("");
  $("#diaryShelfEmpty").style.display = notebooks.length ? "none" : "block";
  if (activeNotebookId) renderNotebook();
  prepareScrollReveal();
}

function renderNotebook() {
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  if (!notebook) return;
  $("#diaryNotebookView").setAttribute("aria-label", notebook.title);
  $("#notebookPageCount").textContent = `${notebook.pages.length} ${notebook.pages.length === 1 ? "pagina" : "pagine"}`;
  $("#notebookPageList").innerHTML = notebook.pages.map((page, index) => `
    <button type="button" class="notebook-page-button${page.id === activeDiaryPageId ? " active" : ""}" data-open-notebook-page="${escapeHtml(page.id)}">
      <span class="notebook-page-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="notebook-page-copy">
        <strong>${escapeHtml(page.title)}</strong>
        <small>${escapeHtml((page.content || "").replace(/\s+/g, " ").slice(0, 42) || (page.drawing ? "Scrittura a mano" : "Pagina vuota"))}</small>
      </span>
    </button>`).join("");
  const hasPages = notebook.pages.length > 0;
  const activeIndex = notebook.pages.findIndex(page => page.id === activeDiaryPageId);
  const position = activeIndex < 0 ? `0 / ${notebook.pages.length}` : `${activeIndex + 1} / ${notebook.pages.length}`;
  $("#notebookPagePosition").textContent = position;
  $("#previousNotebookPage").disabled = activeIndex <= 0;
  $("#nextNotebookPage").disabled = activeIndex < 0 || activeIndex >= notebook.pages.length - 1;
  $("#notebookPageForm").hidden = !hasPages;
  $("#notebookNoPages").hidden = hasPages;
  prepareScrollReveal();
}

function openNotebook(notebookId) {
  activeNotebookId = notebookId;
  activeDiaryPageId = null;
  document.body.classList.add("notebook-mode");
  $("#diaryShelfView").hidden = true;
  $("#diaryNotebookView").hidden = false;
  $("#diaryNotebookView").classList.remove("pages-index-open");
  $("#togglePageIndex").setAttribute("aria-pressed", "false");
  setWritingMode("pen");
  const notebook = notebooks.find(item => item.id === notebookId);
  renderNotebook();
  if (notebook?.pages.length) openNotebookPage(notebook.pages[0].id);
  else $("#notebookPageForm").hidden = true;
}

function openNotebookPage(pageId) {
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  const page = notebook?.pages.find(item => item.id === pageId);
  if (!page) return;
  if (activeDiaryPageId && activeDiaryPageId !== pageId) saveDiaryPage(false);
  activeDiaryPageId = pageId;
  $("#notebookPageId").value = page.id;
  $("#notebookPageTitle").value = page.title;
  $("#notebookPageDate").value = page.date || "";
  $("#notebookPageText").value = page.content || "";
  $("#diaryPaperStyle").value = page.paperStyle || "ruled";
  $(".notebook-writing-area").dataset.paperStyle = page.paperStyle || "ruled";
  updatePaperStyleButton();
  $("#diaryNotebookView").classList.remove("pages-index-open");
  $("#togglePageIndex").setAttribute("aria-pressed", "false");
  renderNotebook();
  loadPageDrawing(page.drawing);
}

function createNotebookPage() {
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  if (!notebook) return;
  if (activeDiaryPageId) saveDiaryPage(false);
  const pageNumbers = notebook.pages.map(page => /^Pagina (\d+)$/.exec(page.title || ""))
    .filter(Boolean)
    .map(match => Number(match[1]));
  const now = new Date().toISOString();
  const page = {
    id: crypto.randomUUID(),
    title: `Pagina ${Math.max(0, ...pageNumbers) + 1}`,
    date: new Date().toISOString().slice(0, 10),
    content: "",
    drawing: "",
    paperStyle: notebook.paperStyle || notebook.pages[notebook.pages.length - 1]?.paperStyle || "ruled",
    createdAt: now,
    updatedAt: now
  };
  notebook.pages.push(page);
  persistNotebooks();
  renderNotebook();
  openNotebookPage(page.id);
  $("#notebookPageTitle").focus();
}

function saveDiaryPage(showNotification = false) {
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  const page = notebook?.pages.find(item => item.id === activeDiaryPageId);
  if (!page) return;
  page.title = $("#notebookPageTitle").value.trim() || page.title;
  page.date = $("#notebookPageDate").value;
  page.content = $("#notebookPageText").value.trim();
  page.paperStyle = $("#diaryPaperStyle").value;
  if (!drawingLoadPending) {
    page.drawing = canvasHasDrawing ? $("#diaryCanvas").toDataURL("image/png") : "";
  }
  page.updatedAt = new Date().toISOString();
  persistNotebooks();
  renderNotebook();
  if (showNotification) toast("Pagina salvata");
}

function loadPageDrawing(source) {
  const canvas = $("#diaryCanvas");
  const context = canvas.getContext("2d");
  const pageId = activeDiaryPageId;
  const loadId = ++drawingLoadId;
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvasHasDrawing = Boolean(source);
  drawingLoadPending = Boolean(source);
  if (!source) return;
  const image = new Image();
  image.onload = () => {
    if (activeDiaryPageId !== pageId || drawingLoadId !== loadId) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvasHasDrawing = true;
    drawingLoadPending = false;
  };
  image.onerror = () => {
    if (drawingLoadId === loadId) drawingLoadPending = false;
  };
  image.src = source;
}

function updatePaperStyleButton() {
  const labels = { ruled: "Foglio a righe", grid: "Foglio a quadretti", blank: "Foglio bianco" };
  const style = $("#diaryPaperStyle").value;
  $("#togglePaperStyle").title = labels[style];
  $("#togglePaperStyle").setAttribute("aria-label", labels[style]);
  $("#togglePaperStyle use").setAttribute("href", style === "grid" ? "#icon-grid" : "#icon-paper");
}

function setWritingMode(mode) {
  drawingMode = mode;
  const isTextMode = mode === "text";
  const textArea = $("#notebookPageText");
  const view = $("#diaryNotebookView");
  view.dataset.writingMode = mode;
  textArea.tabIndex = isTextMode ? 0 : -1;
  textArea.setAttribute("aria-hidden", String(!isTextMode));
  $("#diaryCanvas").setAttribute("aria-hidden", String(isTextMode));
  $$("[data-drawing-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.drawingMode === mode);
  });
  if (isTextMode) textArea.focus();
  else if (document.activeElement === textArea) textArea.blur();
}

function drawAtPointer(event) {
  const canvas = $("#diaryCanvas");
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * canvas.width / bounds.width,
    y: (event.clientY - bounds.top) * canvas.height / bounds.height
  };
}

function drawStrokeSegment(from, to, pressure) {
  const context = $("#diaryCanvas").getContext("2d");
  const isHighlighter = drawingMode === "highlighter";
  context.save();
  context.globalCompositeOperation = drawingMode === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = $("#diaryPenColor").value;
  context.globalAlpha = isHighlighter ? .28 : 1;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = drawingMode === "eraser" ? 36 : isHighlighter ? 24 : 2 + Math.max(.15, pressure) * 7;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

function recipeCard(recipe) {
  const photos = recipePhotos(recipe);
  const image = photos[0];
  const recipeId = escapeHtml(recipe.id);
  return `
    <article class="recipe-card" data-id="${recipeId}">
      <button class="recipe-image" type="button" data-view-photos="${recipeId}" aria-label="Visualizza ${photos.length || "nessuna"} foto di ${escapeHtml(recipe.name)}"${photos.length ? "" : " disabled"}>
        ${image ? `<img src="${escapeHtml(image)}" alt="">` : `<span class="recipe-no-image">Nessuna foto</span>`}
        ${photos.length ? `<span class="recipe-photo-count">${photos.length} foto <span aria-hidden="true">↗</span></span>` : ""}
      </button>
      <div class="recipe-info">
        <button class="heart" type="button" data-favorite="${recipeId}" aria-label="${recipe.favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}">${recipe.favorite ? "♥" : "♡"}</button>
        <span class="recipe-meta">${escapeHtml(recipe.category)}</span>
        <h3><button class="recipe-title-button" type="button" data-open-recipe="${recipeId}">${escapeHtml(recipe.name)}</button></h3>
        <p>${escapeHtml(formatDate(recipe.date) || "Nel quaderno di casa")}</p>
      </div>
    </article>`;
}

function render() {
  const sorted = [...recipes].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  $("#recipeCount").textContent = recipes.length;
  $("#favoriteCount").textContent = recipes.filter(recipe => recipe.favorite).length;
  const recent = sorted.slice(0, 6);
  $("#recentGrid").innerHTML = recent.map(recipeCard).join("");
  $("#homeEmpty").style.display = recipes.length ? "none" : "block";

  const query = ($("#searchInput").value || "").trim().toLowerCase();
  const category = $("#categoryFilter").value;
  const filtered = sorted.filter(recipe => {
    const matchesQuery = !query || `${recipe.name} ${recipe.ingredients} ${recipe.category}`.toLowerCase().includes(query);
    return matchesQuery && (!category || recipe.category === category);
  });
  $("#allGrid").innerHTML = filtered.map(recipeCard).join("");
  $("#recipesEmpty").style.display = filtered.length ? "none" : "block";

  const favorites = sorted.filter(recipe => recipe.favorite);
  $("#favoritesGrid").innerHTML = favorites.map(recipeCard).join("");
  $("#favoritesEmpty").style.display = favorites.length ? "none" : "block";
  prepareScrollReveal();
  renderDiary();
}

function openForm(recipe = null, category = null) {
  $("#recipeForm").reset();
  photoDraftGeneration += 1;
  pendingPhotoCount = 0;
  photoDraft = recipe?.photos ? [...recipe.photos] : [];
  $("#recipeId").value = recipe?.id || "";
  $("#recipeName").value = recipe?.name || "";
  $("#recipeCategory").value = recipe?.category || category || "Primi";
  $("#recipeDate").value = recipe?.date || new Date().toISOString().slice(0, 10);
  $("#recipeIngredients").value = recipe?.ingredients || "";
  $("#recipeSteps").value = recipe?.steps || "";
  $("#recipeMemory").value = recipe?.memory || "";
  renderPhotoPreview();
  $("#recipeDialog").querySelector("h2").textContent = recipe ? "Modifica ricetta" : "Aggiungi una ricetta";
  $("#recipeDialog").showModal();
  $("#recipeName").focus();
}

function categoryImage(category) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 480">
      <rect width="800" height="480" rx="28" fill="${category.background}"/>
      <circle cx="445" cy="278" r="158" fill="#303a31" opacity=".08"/>
      <circle cx="400" cy="240" r="154" fill="#fff" opacity=".78"/>
      <circle cx="400" cy="240" r="124" fill="#f5f2e9"/>
      ${category.illustration}
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderCategoryPicker() {
  $("#categoryGrid").innerHTML = recipeCategoryOptions.map(category => `
    <button class="category-option" type="button" data-recipe-category="${category.name}">
      <img src="${categoryImage(category)}" alt="" loading="lazy">
      <span class="category-option-copy">
        <strong>${category.name}</strong>
        <small>${category.description}</small>
      </span>
      <span class="category-option-arrow" aria-hidden="true">↗</span>
    </button>`).join("");
}

function openCategoryPicker() {
  $("#categoryDialog").showModal();
}

function updateKitchenQuote() {
  const quotes = [
    "Ogni grande piatto nasce da un piccolo gesto.",
    "Cucina con curiosità: il sapore ti guiderà.",
    "Un ingrediente alla volta, un'idea prende forma.",
    "La pazienza è il segreto di ogni buona ricetta.",
    "Condividere un piatto è un modo di voler bene.",
    "Anche gli avanzi possono diventare una bella idea.",
    "Assaggia, aggiusta, sorridi: stai creando.",
    "La cucina è il posto dove la creatività si mette a tavola.",
    "Un pizzico di coraggio rende speciale ogni ricetta.",
    "Fai spazio ai profumi, il resto verrà da sé."
  ];
  const previous = sessionStorage.getItem(MOTIVATION_KEY);
  const options = quotes.map((quote, index) => ({ quote, index }))
    .filter(option => String(option.index) !== previous);
  const chosen = options[Math.floor(Math.random() * options.length)];
  const quoteElement = $("#sidebarQuote");
  quoteElement.textContent = chosen.quote;
  quoteElement.classList.remove("quote-changing");
  void quoteElement.offsetWidth;
  quoteElement.classList.add("quote-changing");
  sessionStorage.setItem(MOTIVATION_KEY, String(chosen.index));
}

function selectRecipeCategory(category) {
  $("#categoryDialog").close();
  openForm(null, category);
}

function closeForm() {
  $("#recipeDialog").close();
  photoDraftGeneration += 1;
  pendingPhotoCount = 0;
  photoDraft = [];
  renderPhotoPreview();
}

function renderPhotoPreview() {
  $("#photoPreview").innerHTML = photoDraft.map((photo, index) => `
    <button class="photo-preview-item" type="button" data-remove-photo="${index}" aria-label="Rimuovi foto ${index + 1}">
      <img src="${escapeHtml(photo)}" alt="">
      <span aria-hidden="true">×</span>
    </button>`).join("");
}

function openDetail(recipe) {
  const photos = recipePhotos(recipe);
  const hero = photos[0] ? `
    <button class="detail-hero-button" type="button" data-open-detail-photo="0" data-photo-recipe="${escapeHtml(recipe.id)}" aria-label="Apri la foto a schermo intero">
      <img class="detail-hero" src="${escapeHtml(photos[0])}" alt="${escapeHtml(recipe.name)}">
    </button>` : "";
  const photoStrip = photos.length > 1 ? `
    <div class="detail-photo-strip" aria-label="Altre foto della ricetta">
      ${photos.map((photo, index) => `
        <button class="detail-photo-thumb" type="button" data-open-detail-photo="${index}" data-photo-recipe="${escapeHtml(recipe.id)}" aria-label="Apri foto ${index + 1} di ${photos.length}">
          <img src="${escapeHtml(photo)}" alt="">
        </button>`).join("")}
    </div>` : "";
  $("#detailContent").innerHTML = `
    ${hero}
    ${photoStrip}
    <span class="detail-meta">${escapeHtml(recipe.category)} · ${escapeHtml(formatDate(recipe.date) || "Nel quaderno")}</span>
    <h2>${escapeHtml(recipe.name)}</h2>
    ${recipe.ingredients ? `<h3>Ingredienti</h3><div class="detail-content-section">${escapeHtml(recipe.ingredients)}</div>` : ""}
    ${recipe.steps ? `<h3>Preparazione</h3><div class="detail-content-section">${escapeHtml(recipe.steps)}</div>` : ""}
    ${recipe.memory ? `<h3>Un ricordo</h3><div class="detail-content-section">${escapeHtml(recipe.memory)}</div>` : ""}
    <div class="detail-actions">
      <button class="outline-button" type="button" id="deleteRecipe">Elimina</button>
      <button class="primary-button" type="button" id="editRecipe">Modifica</button>
    </div>`;
  $("#detailDialog").showModal();
  $("#editRecipe").onclick = () => {
    $("#detailDialog").close();
    openForm(recipe);
  };
  $("#deleteRecipe").onclick = () => {
    if (confirm("Vuoi eliminare questa ricetta?")) {
      recipes = recipes.filter(item => item.id !== recipe.id);
      saveRecipes();
      $("#detailDialog").close();
      toast("Ricetta eliminata");
    }
  };
}

function openPhotoViewer(recipe, index = 0) {
  if (!recipePhotos(recipe).length) return;
  activePhotoRecipeId = recipe.id;
  activePhotoIndex = index;
  renderPhotoViewer();
  const dialog = $("#photoViewerDialog");
  if (!dialog.open) dialog.showModal();
}

function renderPhotoViewer() {
  const recipe = recipes.find(item => item.id === activePhotoRecipeId);
  const photos = recipe ? recipePhotos(recipe) : [];
  if (!photos.length) {
    $("#photoViewerDialog").close();
    return;
  }
  activePhotoIndex = Math.max(0, Math.min(activePhotoIndex, photos.length - 1));
  $("#photoViewerImage").src = photos[activePhotoIndex];
  $("#photoViewerImage").alt = `${recipe.name}, foto ${activePhotoIndex + 1}`;
  $("#photoViewerCount").textContent = `${activePhotoIndex + 1} / ${photos.length}`;
  $("#previousPhoto").hidden = photos.length < 2;
  $("#nextPhoto").hidden = photos.length < 2;
}

function movePhoto(direction) {
  const recipe = recipes.find(item => item.id === activePhotoRecipeId);
  const photos = recipe ? recipePhotos(recipe) : [];
  if (photos.length < 2) return;
  activePhotoIndex = (activePhotoIndex + direction + photos.length) % photos.length;
  renderPhotoViewer();
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.style.display = "none", 2600);
}

function readPhotos(files) {
  const remaining = Math.max(0, 8 - photoDraft.length - pendingPhotoCount);
  const selected = [...files].slice(0, remaining);
  if (files.length > remaining) toast("Puoi salvare fino a 8 foto per ricetta.");
  if (!selected.length) return;
  const generation = photoDraftGeneration;
  pendingPhotoCount += selected.length;
  const reads = selected.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Immagine non valida"));
    reader.onerror = () => reject(new Error("Lettura immagine non riuscita"));
    reader.readAsDataURL(file);
  }));
  Promise.all(reads).then(photos => {
    if (generation !== photoDraftGeneration) return;
    pendingPhotoCount -= selected.length;
    photoDraft.push(...photos);
    renderPhotoPreview();
  }).catch(() => {
    if (generation !== photoDraftGeneration) return;
    pendingPhotoCount -= selected.length;
    toast("Non è stato possibile leggere una delle foto.");
  });
}

$$("[data-page]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
["#topAdd", "#welcomeAdd", "#emptyAdd", "#shortcutAdd"].forEach(selector => $(selector).addEventListener("click", openCategoryPicker));
["#closeForm", "#cancelForm"].forEach(selector => $(selector).addEventListener("click", closeForm));
["#closeCategoryPicker", "#cancelCategoryPicker"].forEach(selector => {
  $(selector).addEventListener("click", () => $("#categoryDialog").close());
});
renderCategoryPicker();
updateKitchenQuote();
$("#categoryGrid").addEventListener("click", event => {
  const option = event.target.closest("[data-recipe-category]");
  if (option) selectRecipeCategory(option.dataset.recipeCategory);
});

$("#recipePhotos").addEventListener("change", event => {
  readPhotos(event.target.files);
  event.target.value = "";
});

$("#photoPreview").addEventListener("click", event => {
  const removeButton = event.target.closest("[data-remove-photo]");
  if (!removeButton) return;
  photoDraft.splice(Number(removeButton.dataset.removePhoto), 1);
  renderPhotoPreview();
});

$("#closeDetail").addEventListener("click", () => $("#detailDialog").close());
$("#closePhotoViewer").addEventListener("click", () => $("#photoViewerDialog").close());
$("#previousPhoto").addEventListener("click", () => movePhoto(-1));
$("#nextPhoto").addEventListener("click", () => movePhoto(1));
$("#photoViewerDialog").addEventListener("click", event => {
  if (event.target === $("#photoViewerDialog")) $("#photoViewerDialog").close();
});
$("#photoViewerDialog").addEventListener("close", () => {
  activePhotoRecipeId = null;
});
$("#photoViewerDialog").addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") movePhoto(-1);
  if (event.key === "ArrowRight") movePhoto(1);
});

$("#recipeForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#recipeId").value;
  const data = {
    id: id || crypto.randomUUID(),
    name: $("#recipeName").value.trim(),
    category: $("#recipeCategory").value,
    date: $("#recipeDate").value,
    ingredients: $("#recipeIngredients").value.trim(),
    steps: $("#recipeSteps").value.trim(),
    memory: $("#recipeMemory").value.trim(),
    photos: [...photoDraft],
    favorite: id ? recipes.find(recipe => recipe.id === id)?.favorite || false : false,
    createdAt: id ? recipes.find(recipe => recipe.id === id)?.createdAt || new Date().toISOString() : new Date().toISOString()
  };
  if (!data.name) return;
  if (id) recipes = recipes.map(recipe => recipe.id === id ? data : recipe);
  else recipes.unshift(data);
  saveRecipes();
  closeForm();
  toast(id ? "Ricetta aggiornata" : "Ricetta aggiunta");
});

document.addEventListener("click", event => {
  const photoButton = event.target.closest("[data-view-photos], [data-open-detail-photo]");
  if (photoButton) {
    const recipeId = photoButton.dataset.viewPhotos || photoButton.dataset.photoRecipe;
    const recipe = recipes.find(item => item.id === recipeId);
    if (recipe) openPhotoViewer(recipe, Number(photoButton.dataset.openDetailPhoto) || 0);
    return;
  }
  const detailButton = event.target.closest("[data-open-recipe]");
  if (detailButton) {
    const recipe = recipes.find(item => item.id === detailButton.dataset.openRecipe);
    if (recipe) openDetail(recipe);
    return;
  }
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    recipes = recipes.map(recipe => recipe.id === id ? { ...recipe, favorite: !recipe.favorite } : recipe);
    saveRecipes();
    return;
  }
  const card = event.target.closest(".recipe-card");
  if (card) {
    const recipe = recipes.find(item => item.id === card.dataset.id);
    if (recipe) openDetail(recipe);
  }
});

$("#searchInput").addEventListener("input", render);
$("#categoryFilter").addEventListener("change", render);

$("#showNotebookForm").addEventListener("click", () => {
  $("#notebookForm").hidden = false;
  $("#newNotebookName").focus();
});

$("#cancelNotebookForm").addEventListener("click", () => {
  $("#notebookForm").reset();
  $("#notebookForm").hidden = true;
});

$("#notebookForm").addEventListener("submit", event => {
  event.preventDefault();
  const now = new Date().toISOString();
  const notebook = {
    id: crypto.randomUUID(),
    title: $("#newNotebookName").value.trim(),
    paperStyle: $("#notebookPaperStyle").value,
    coverColor: $("#notebookCoverColor").value,
    createdAt: now,
    pages: []
  };
  if (!notebook.title) return;
  notebooks.unshift(notebook);
  persistNotebooks();
  $("#notebookForm").reset();
  $("#notebookForm").hidden = true;
  renderDiary();
  openNotebook(notebook.id);
  createNotebookPage();
});

$("#notebookGrid").addEventListener("click", event => {
  const openButton = event.target.closest("[data-open-notebook]");
  const deleteButton = event.target.closest("[data-delete-notebook]");
  if (openButton) {
    openNotebook(openButton.dataset.openNotebook);
  }
  if (deleteButton) {
    const notebook = notebooks.find(item => item.id === deleteButton.dataset.deleteNotebook);
    if (notebook && confirm(`Vuoi eliminare il quaderno "${notebook.title}" e tutte le sue pagine?`)) {
      notebooks = notebooks.filter(item => item.id !== notebook.id);
      persistNotebooks();
      renderDiary();
      toast("Quaderno eliminato");
    }
  }
});

$("#backToNotebooks").addEventListener("click", () => {
  if (activeDiaryPageId) saveDiaryPage(false);
  activeNotebookId = null;
  activeDiaryPageId = null;
  document.body.classList.remove("notebook-mode");
  $("#diaryNotebookView").hidden = true;
  $("#diaryShelfView").hidden = false;
  $("#togglePageIndex").setAttribute("aria-pressed", "false");
  renderDiary();
});

$("#togglePageIndex").addEventListener("click", () => {
  const view = $("#diaryNotebookView");
  const isOpen = view.classList.toggle("pages-index-open");
  $("#togglePageIndex").setAttribute("aria-pressed", String(isOpen));
});

$("#addNotebookPage").addEventListener("click", createNotebookPage);

$("#notebookPageList").addEventListener("click", event => {
  const button = event.target.closest("[data-open-notebook-page]");
  if (button) openNotebookPage(button.dataset.openNotebookPage);
});

function moveNotebookPage(offset) {
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  const currentIndex = notebook?.pages.findIndex(page => page.id === activeDiaryPageId) ?? -1;
  const nextPage = notebook?.pages[currentIndex + offset];
  if (nextPage) openNotebookPage(nextPage.id);
}

$("#previousNotebookPage").addEventListener("click", () => moveNotebookPage(-1));
$("#nextNotebookPage").addEventListener("click", () => moveNotebookPage(1));

$("#notebookPageForm").addEventListener("submit", event => {
  event.preventDefault();
  saveDiaryPage(true);
});

$("#deleteNotebookPage").addEventListener("click", () => {
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  if (!notebook || !activeDiaryPageId) return;
  const page = notebook.pages.find(item => item.id === activeDiaryPageId);
  if (!page || !confirm(`Vuoi eliminare "${page.title}"?`)) return;
  notebook.pages = notebook.pages.filter(item => item.id !== page.id);
  activeDiaryPageId = null;
  persistNotebooks();
  renderNotebook();
  if (notebook.pages.length) openNotebookPage(notebook.pages[0].id);
  toast("Pagina eliminata");
});

$("#notebookPageForm").addEventListener("input", event => {
  if (event.target.matches("#notebookPageTitle, #notebookPageText, #notebookPageDate")) {
    const page = notebooks.find(item => item.id === activeNotebookId)?.pages.find(item => item.id === activeDiaryPageId);
    if (page) {
      page.title = $("#notebookPageTitle").value.trim() || page.title;
      page.date = $("#notebookPageDate").value;
      page.content = $("#notebookPageText").value;
      page.updatedAt = new Date().toISOString();
      persistNotebooks();
      if (event.target.id === "notebookPageTitle") renderNotebook();
    }
  }
});

$$("[data-drawing-mode]").forEach(button => button.addEventListener("click", () => {
  setWritingMode(button.dataset.drawingMode);
}));

$("#diaryPaperStyle").addEventListener("change", event => {
  const page = notebooks.find(item => item.id === activeNotebookId)?.pages.find(item => item.id === activeDiaryPageId);
  if (!page) return;
  page.paperStyle = event.target.value;
  const notebook = notebooks.find(item => item.id === activeNotebookId);
  if (notebook) notebook.paperStyle = page.paperStyle;
  $(".notebook-writing-area").dataset.paperStyle = page.paperStyle;
  updatePaperStyleButton();
  persistNotebooks();
});

$("#togglePaperStyle").addEventListener("click", () => {
  const styles = ["ruled", "grid", "blank"];
  const currentIndex = styles.indexOf($("#diaryPaperStyle").value);
  $("#diaryPaperStyle").value = styles[(currentIndex + 1) % styles.length];
  $("#diaryPaperStyle").dispatchEvent(new Event("change", { bubbles: true }));
});

$("#diaryCanvas").addEventListener("pointerdown", event => {
  if (!activeDiaryPageId || drawingMode === "text" || drawingLoadPending || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  const canvas = $("#diaryCanvas");
  canvas.setPointerCapture(event.pointerId);
  lastDrawingPoint = drawAtPointer(event);
  isDrawing = true;
  drawStrokeSegment(lastDrawingPoint, lastDrawingPoint, event.pressure || .5);
  canvasHasDrawing = true;
});

$("#diaryCanvas").addEventListener("pointermove", event => {
  if (!isDrawing) return;
  event.preventDefault();
  const point = drawAtPointer(event);
  drawStrokeSegment(lastDrawingPoint, point, event.pressure || .5);
  lastDrawingPoint = point;
});

["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
  $("#diaryCanvas").addEventListener(eventName, () => {
    if (!isDrawing) return;
    isDrawing = false;
    lastDrawingPoint = null;
    saveDiaryPage(false);
  });
});

$("#clearDiaryCanvas").addEventListener("click", () => {
  drawingLoadId += 1;
  drawingLoadPending = false;
  const canvas = $("#diaryCanvas");
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  canvasHasDrawing = false;
  saveDiaryPage(false);
});

$("#exportBtn").addEventListener("click", () => {
  if (currentPage === "diary" && activeDiaryPageId) saveDiaryPage(false);
  const backup = { version: 3, recipes, notebooks };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "quaderno-di-cucina.json";
  link.click();
  URL.revokeObjectURL(url);
  toast("Backup esportato");
});

$("#importBtn").addEventListener("click", () => $("#importFile").click());
$("#importFile").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = readEvent => {
    try {
      const imported = JSON.parse(readEvent.target.result);
      const importedRecipes = Array.isArray(imported) ? imported : imported?.recipes;
      if (!Array.isArray(importedRecipes)) throw new Error("Formato non valido");
      let importedNotebooks = null;
      if (!Array.isArray(imported) && imported.notebooks !== undefined) {
        if (!Array.isArray(imported.notebooks) || imported.notebooks.some(notebook =>
          !notebook || typeof notebook.id !== "string" || typeof notebook.title !== "string" ||
          !Array.isArray(notebook.pages) || notebook.pages.some(page =>
            !page || typeof page.id !== "string" || typeof page.title !== "string"
          )
        )) throw new Error("Formato quaderni non valido");
        importedNotebooks = imported.notebooks;
      } else if (!Array.isArray(imported) && imported.diary !== undefined) {
        if (!Array.isArray(imported.diary)) throw new Error("Formato diario non valido");
        importedNotebooks = notebooksFromLegacyEntries(imported.diary);
      }
      recipes = importedRecipes;
      if (importedNotebooks) {
        notebooks = importedNotebooks;
        persistNotebooks();
        activeNotebookId = null;
        activeDiaryPageId = null;
        document.body.classList.remove("notebook-mode");
        $("#diaryNotebookView").hidden = true;
        $("#diaryShelfView").hidden = false;
      }
      saveRecipes();
      toast("Backup importato");
    } catch {
      toast("Backup non valido");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});

$("#todayLabel").textContent = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long"
}).format(new Date());

render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js")
    .catch(error => console.error("Registrazione dell'app offline non riuscita:", error));
}
