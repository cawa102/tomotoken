import { createPetViewer } from "./viewer-core.js";

let activeViewer = null;

async function loadCollection() {
  const res = await fetch("/api/collection");
  if (!res.ok) throw new Error(`Failed to load collection: ${res.status}`);
  return res.json();
}

function createCard(pet) {
  const card = document.createElement("div");
  card.className = "pet-card";
  card.dataset.petId = pet.petId;

  if (pet.hasSnapshot) {
    const img = document.createElement("img");
    img.src = `/api/snapshot/${encodeURIComponent(pet.petId)}`;
    img.alt = pet.archetype;
    img.className = "card-thumb";
    img.loading = "lazy";
    card.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "card-placeholder";
    placeholder.textContent = "?";
    card.appendChild(placeholder);
  }

  const archetype = document.createElement("div");
  archetype.className = "card-archetype";
  archetype.textContent = pet.archetype;
  card.appendChild(archetype);

  const subtype = document.createElement("div");
  subtype.className = "card-subtype";
  subtype.textContent = pet.subtype;
  card.appendChild(subtype);

  const date = document.createElement("div");
  date.className = "card-date";
  date.textContent = new Date(pet.completedAt).toLocaleDateString();
  card.appendChild(date);

  const tokens = document.createElement("div");
  tokens.className = "card-tokens";
  tokens.textContent = `${pet.consumedTokens.toLocaleString()} tokens`;
  card.appendChild(tokens);

  card.addEventListener("click", () => openModal(pet.petId));
  return card;
}

function renderGrid(data) {
  const grid = document.getElementById("grid");
  const emptyState = document.getElementById("empty-state");
  const petCount = document.getElementById("pet-count");

  grid.innerHTML = "";

  if (data.pets.length === 0) {
    emptyState.classList.remove("hidden");
    grid.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  grid.classList.remove("hidden");
  petCount.textContent = `${data.pets.length} pet${data.pets.length === 1 ? "" : "s"} collected`;

  for (const pet of data.pets) {
    grid.appendChild(createCard(pet));
  }
}

async function openModal(petId) {
  const res = await fetch(`/api/collection/${encodeURIComponent(petId)}`);
  if (!res.ok) return;
  const pet = await res.json();
  document.getElementById("modal").classList.remove("hidden");
  renderModalContent(pet);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  if (activeViewer) {
    activeViewer.dispose();
    activeViewer = null;
  }
  document.getElementById("modal-info").innerHTML = "";
}

function renderModalContent(pet) {
  const info = document.getElementById("modal-info");
  const archetype = deriveArchetype(pet.personality.traits);

  const traitEntries = Object.entries(pet.personality.traits)
    .sort((a, b) => b[1] - a[1]);

  const traitBadges = traitEntries
    .map(([name, score], i) => {
      const cls = i === 0 ? "trait-badge primary" : "trait-badge";
      return `<span class="${cls}">${name} ${score}</span>`;
    })
    .join("");

  info.innerHTML = `
    <h2>${archetype}</h2>
    <div class="modal-dates">${new Date(pet.spawnedAt).toLocaleDateString()} &mdash; ${new Date(pet.completedAt).toLocaleDateString()}</div>
    <div class="modal-tokens">${pet.consumedTokens.toLocaleString()} tokens</div>
    <div class="modal-traits">${traitBadges}</div>
  `;

  // Initialize Three.js viewer in modal
  initModalViewer(pet.petId);
}

async function initModalViewer(petId) {
  const container = document.getElementById("modal-viewer");
  container.innerHTML = "";

  try {
    const res = await fetch(`/api/collection/${encodeURIComponent(petId)}/render`);
    if (!res.ok) return;
    const renderData = await res.json();
    activeViewer = await createPetViewer(container, renderData);
  } catch (_err) {
    // 3D viewer is best-effort; info panel still shows data
  }
}

function deriveArchetype(traits) {
  return Object.entries(traits).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

// Event listeners
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
document.querySelector(".modal-close").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// Init
loadCollection().then(renderGrid).catch(() => {
  document.getElementById("empty-state").classList.remove("hidden");
  document.getElementById("grid").classList.add("hidden");
});
