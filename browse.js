import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const dogGrid = document.getElementById("dogGrid");
const resultCount = document.getElementById("resultCount");
const breedFilter = document.getElementById("breedFilter");
const sizeFilter = document.getElementById("sizeFilter");

let allDogs = [];

async function loadDogs() {
  const { data, error } = await supabase
    .from("dogs")
    .select("id, name, breed, age_months, sex, size, description, shelters(name, city, state), dog_photos(url)")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (error) {
    dogGrid.innerHTML = `<p>Error loading dogs: ${error.message}</p>`;
    return;
  }

  allDogs = data;
  render();
}

function render() {
  const breedQuery = breedFilter.value.trim().toLowerCase();
  const size = sizeFilter.value;

  const filtered = allDogs.filter((dog) => {
    if (breedQuery && !dog.breed?.toLowerCase().includes(breedQuery)) return false;
    if (size && dog.size !== size) return false;
    return true;
  });

  resultCount.textContent = `${filtered.length} dog${filtered.length === 1 ? "" : "s"}`;

  dogGrid.innerHTML = "";
  for (const dog of filtered) {
    const photoUrl = dog.dog_photos[0]?.url ?? "";
    const card = document.createElement("button");
    card.className = "dog-card";
    card.innerHTML = `
      ${photoUrl ? `<img src="${photoUrl}" alt="${dog.name}" loading="lazy">` : `<div class="dog-card-noimg">🐶</div>`}
      <div class="dog-card-body">
        <h3>${dog.name}</h3>
        <p>${[dog.breed, ageLabel(dog.age_months)].filter(Boolean).join(" · ")}</p>
        <p class="dog-card-shelter">${dog.shelters.name}${dog.shelters.city ? ` · ${dog.shelters.city}` : ""}</p>
      </div>
    `;
    card.addEventListener("click", () => openModal(dog, photoUrl));
    dogGrid.append(card);
  }
}

function ageLabel(months) {
  if (!months) return "";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years} yr${years === 1 ? "" : "s"}`;
}

const overlay = document.getElementById("dogModalOverlay");
function openModal(dog, photoUrl) {
  document.getElementById("modalPhoto").src = photoUrl;
  document.getElementById("modalPhoto").style.display = photoUrl ? "block" : "none";
  document.getElementById("modalName").textContent = dog.name;
  document.getElementById("modalMeta").textContent = [dog.breed, ageLabel(dog.age_months), dog.sex, dog.size]
    .filter(Boolean)
    .join(" · ");
  document.getElementById("modalShelter").textContent = `${dog.shelters.name}${dog.shelters.city ? `, ${dog.shelters.city}, ${dog.shelters.state ?? ""}` : ""}`;
  document.getElementById("modalDescription").textContent = dog.description ?? "";
  overlay.classList.add("open");
}

document.getElementById("closeModalBtn").addEventListener("click", () => overlay.classList.remove("open"));
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) overlay.classList.remove("open");
});

breedFilter.addEventListener("input", render);
sizeFilter.addEventListener("change", render);

loadDogs();
