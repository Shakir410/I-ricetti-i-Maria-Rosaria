

const DB_NAME = "QuadernoDiCucina";
const STORE_NAME = "ricette";

let recipes = [];
let selectedPhotos = [];
let currentPage = "home";

const $ = (id) => document.getElementById(id);

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, {
        keyPath: "id"
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllRecipes() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveRecipe(recipe) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(recipe);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecipe(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date + "T12:00:00").toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function photoURL(photo) {
  return URL.createObjectURL(photo);
}

function recipeCard(recipe) {
  const image = recipe.photos?.[0];

  return `
    <article class="recipe-card" data-id="${recipe.id}">
      <button class="recipe-card-open" data-open="${recipe.id}">
        <div class="recipe-card-image">
          ${
            image
              ? `<img src="${photoURL(image)}" alt="${escapeHTML(recipe.name)}">`
              : `<div class="recipe-placeholder">♡</div>`
          }
        </div>
        <div class="recipe-card-info">
          <span class="recipe-category">${escapeHTML(recipe.category || "Ricetta")}</span>
          <h3>${escapeHTML(recipe.name)}</h3>
          <p>${formatDate(recipe.date)}</p>
        </div>
      </button>
      <button class="favorite-button ${recipe.favorite ? "active" : ""}"
        data-favorite="${recipe.id}" aria-label="Aggiungi ai preferiti">
        ${recipe.favorite ? "♥" : "♡"}
      </button>
    </article>
  `;
}

function renderGrid(elementId, list, emptyId) {
  const element = $(elementId);
  const empty = $(emptyId);

  if (!element || !empty) return;

  element.innerHTML = list.map(recipeCard).join("");
  empty.hidden = list.length > 0;
}

function render() {
  const search = ($("searchInput")?.value || "").toLowerCase();
  const category = $("categoryFilter")?.value || "";

  const filtered = recipes.filter(recipe => {
    const matchesSearch =
      recipe.name.toLowerCase().includes(search) ||
      (recipe.memory || "").toLowerCase().includes(search) ||
      (recipe.ingredients || "").toLowerCase().includes(search);

    const matchesCategory = !category || recipe.category === category;

    return matchesSearch && matchesCategory;
  });

  const recent = [...recipes]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 3);

  renderGrid("recentGrid", recent, "homeEmpty");
  renderGrid("allGrid", filtered, "recipesEmpty");

  renderGrid(
    "favoritesGrid",
    recipes.filter(recipe => recipe.favorite),
    "favoritesEmpty"
  );
}

function showPage(page) {
  currentPage = page;

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach(section => {
    section.hidden = section.id !== `page-${page}`;
  });
}

function openForm(recipe = null) {
  $("recipeForm").reset();
  selectedPhotos = [];
  $("recipeId").value = recipe?.id || "";
  $("recipeName").value = recipe?.name || "";
  $("recipeCategory").value = recipe?.category || "";
  $("recipeDate").value = recipe?.date || new Date().toISOString().slice(0, 10);
  $("recipeIngredients").value = recipe?.ingredients || "";
  $("recipeSteps").value = recipe?.steps || "";
  $("recipeMemory").value = recipe?.memory || "";

  if (recipe?.photos) selectedPhotos = [...recipe.photos];

  updatePhotoPreview();

  $("recipeDialog").showModal();
}

function updatePhotoPreview() {
  const preview = $("photoPreview");
  if (!preview) return;

  preview.innerHTML = selectedPhotos.map((photo, index) => `
    <div class="photo-preview-item">
      <img src="${photoURL(photo)}" alt="Foto ${index + 1}">
      <button type="button" data-remove-photo="${index}">×</button>
    </div>
  `).join("");
}

function openDetails(id) {
  const recipe = recipes.find(item => item.id === id);
  if (!recipe) return;

  const photos = (recipe.photos || []).map(photo => `
    <img src="${photoURL(photo)}" alt="${escapeHTML(recipe.name)}">
  `).join("");

  $("detailContent").innerHTML = `
    <div class="recipe-detail">
      <span class="recipe-category">${escapeHTML(recipe.category || "Ricetta")}</span>
      <h2>${escapeHTML(recipe.name)}</h2>
      <p class="recipe-date">${formatDate(recipe.date)}</p>

      <div class="detail-photos">${photos}</div>

      <h3>Ingredienti</h3>
      <p>${escapeHTML(recipe.ingredients || "Nessun ingrediente inserito.")}</p>

      <h3>Preparazione</h3>
      <p>${escapeHTML(recipe.steps || "Nessuna preparazione inserita.")}</p>

      <h3>Un ricordo</h3>
      <p>${escapeHTML(recipe.memory || "Nessun ricordo aggiunto.")}</p>

      <div class="detail-actions">
        <button type="button" id="editRecipe">Modifica ricetta</button>
        <button type="button" id="deleteRecipe">Elimina</button>
      </div>
    </div>
  `;

  $("detailDialog").showModal();

  $("editRecipe").addEventListener("click", () => {
    $("detailDialog").close();
    openForm(recipe);
  });

  $("deleteRecipe").addEventListener("click", async () => {
    if (!confirm("Vuoi davvero eliminare questa ricetta?")) return;

    await deleteRecipe(id);
    $("detailDialog").close();
    await refresh();
    showToast("Ricetta eliminata");
  });
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 2500);
}

async function refresh() {
  recipes = await getAllRecipes();
  render();
}

function downloadBackup() {
  const backup = recipes.map(recipe => ({
    ...recipe,
    photos: (recipe.photos || []).map(photo => ({
      name: photo.name,
      type: photo.type,
      data: null
    }))
  }));

  const readerPromises = recipes.map(async (recipe, index) => {
    backup[index].photos = await Promise.all(
      (recipe.photos || []).map(photo => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: photo.name,
          type: photo.type,
          data: reader.result
        });
        reader.readAsDataURL(photo);
      }))
    );
  });

  Promise.all(readerPromises).then(() => {
    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "il-mio-quaderno-di-cucina-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}

async function importBackup(file) {
  const text = await file.text();
  const backup = JSON.parse(text);

  for (const item of backup) {
    const photos = await Promise.all(
      (item.photos || []).map(async photo => {
        const response = await fetch(photo.data);
        const blob = await response.blob();
        return new File([blob], photo.name || "foto", {
          type: photo.type || blob.type
        });
      })
    );

    await saveRecipe({ ...item, photos });
  }

  await refresh();
  showToast("Ricette importate!");
}

document.addEventListener("click", async event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) showPage(pageButton.dataset.page);

  const openButton = event.target.closest("[data-open]");
  if (openButton) openDetails(openButton.dataset.open);

  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const recipe = recipes.find(item => item.id === favoriteButton.dataset.favorite);
    if (!recipe) return;

    recipe.favorite = !recipe.favorite;
    await saveRecipe(recipe);
    await refresh();
  }

  const removeButton = event.target.closest("[data-remove-photo]");
  if (removeButton) {
    selectedPhotos.splice(Number(removeButton.dataset.removePhoto), 1);
    updatePhotoPreview();
  }
});

["topAdd", "welcomeAdd", "emptyAdd"].forEach(id => {
  $(id)?.addEventListener("click", () => openForm());
});

$("closeForm")?.addEventListener("click", () => $("recipeDialog").close());
$("cancelForm")?.addEventListener("click", () => $("recipeDialog").close());

$("recipePhotos")?.addEventListener("change", event => {
  const files = Array.from(event.target.files || []);
  selectedPhotos.push(...files);
  updatePhotoPreview();
  event.target.value = "";
});

$("recipeForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("recipeId").value || crypto.randomUUID();
  const oldRecipe = recipes.find(recipe => recipe.id === id);

  const recipe = {
    id,
    name: $("recipeName").value.trim(),
    category: $("recipeCategory").value,
    date: $("recipeDate").value,
    ingredients: $("recipeIngredients").value.trim(),
    steps: $("recipeSteps").value.trim(),
    memory: $("recipeMemory").value.trim(),
    photos: selectedPhotos,
    favorite: oldRecipe?.favorite || false,
    createdAt: oldRecipe?.createdAt || Date.now()
  };

  if (!recipe.name) return;

  await saveRecipe(recipe);
  $("recipeDialog").close();
  await refresh();
  showToast("Ricetta salvata!");
});

$("searchInput")?.addEventListener("input", render);
$("categoryFilter")?.addEventListener("change", render);

$("exportBtn")?.addEventListener("click", downloadBackup);

$("importBtn")?.addEventListener("click", () => {
  $("importFile").click();
});

$("importFile")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await importBackup(file);
  } catch {
    showToast("Impossibile importare il file");
  }

  event.target.value = "";
});

$("todayLabel").textContent = new Date().toLocaleDateString("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long"
});

refresh().catch(error => {
  console.error(error);
  showToast("Errore nel caricamento delle ricette");
});
