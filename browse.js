import { createClient } from "@supabase/supabase-js";
import { initNav } from "./nav.js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
initNav(supabase);

const dogGrid = document.getElementById("dogGrid");
const resultCount = document.getElementById("resultCount");
const breedFilter = document.getElementById("breedFilter");
const sizeFilter = document.getElementById("sizeFilter");
const ageFilter = document.getElementById("ageFilter");
const shelterFilter = document.getElementById("shelterFilter");

let allDogs = [];
let savedDogIds = new Set();
let currentUserId = null;

async function loadDogs() {
  const { data, error } = await supabase
    .from("dogs")
    .select("id, name, breed, age_months, sex, size, description, shelter_id, shelters(name, city, state), dog_photos(url)")
    .eq("status", "available")
    .is("hidden_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    dogGrid.innerHTML = `<p>Error loading dogs: ${error.message}</p>`;
    return;
  }

  allDogs = data;
  populateShelterFilter();
  render();
}

function populateShelterFilter() {
  const current = shelterFilter.value;
  const shelters = new Map();
  for (const dog of allDogs) shelters.set(dog.shelter_id, dog.shelters.name);

  shelterFilter.innerHTML = '<option value="">All shelters</option>';
  for (const [id, name] of [...shelters.entries()].sort((a, b) => a[1].localeCompare(b[1]))) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = name;
    shelterFilter.append(opt);
  }
  shelterFilter.value = current;
}

async function loadSaved() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUserId = session?.user.id ?? null;
  if (!currentUserId) {
    savedDogIds = new Set();
    return;
  }
  const { data } = await supabase.from("saved_dogs").select("dog_id").eq("user_id", currentUserId);
  savedDogIds = new Set((data ?? []).map((row) => row.dog_id));
}

// Listings can change (hidden/unhidden, adopted, etc.) while this tab
// sits open in the background, so refetch whenever it regains focus.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshAll();
});

async function refreshAll() {
  await loadSaved();
  await loadDogs();
}

document.getElementById("refreshBtn").addEventListener("click", refreshAll);

function ageBucket(months) {
  if (!months) return null;
  if (months < 12) return "puppy";
  if (months < 84) return "adult";
  return "senior";
}

function render() {
  const breedQuery = breedFilter.value.trim().toLowerCase();
  const size = sizeFilter.value;
  const age = ageFilter.value;
  const shelterId = shelterFilter.value;

  const filtered = allDogs.filter((dog) => {
    if (breedQuery && !dog.breed?.toLowerCase().includes(breedQuery) && !dog.name.toLowerCase().includes(breedQuery)) return false;
    if (size && dog.size !== size) return false;
    if (age && ageBucket(dog.age_months) !== age) return false;
    if (shelterId && dog.shelter_id !== shelterId) return false;
    return true;
  });

  resultCount.textContent = `${filtered.length} dog${filtered.length === 1 ? "" : "s"}`;

  dogGrid.innerHTML = "";
  for (const dog of filtered) {
    const photoUrl = dog.dog_photos[0]?.url ?? "";
    const isSaved = savedDogIds.has(dog.id);
    const card = document.createElement("div");
    card.className = "dog-card";
    card.innerHTML = `
      ${currentUserId ? `<button class="save-btn ${isSaved ? "saved" : ""}" data-dog-id="${dog.id}" title="${isSaved ? "Unsave" : "Save"}" aria-label="${isSaved ? "Unsave" : "Save"}">♥</button>` : ""}
      ${photoUrl ? `<img src="${photoUrl}" alt="${dog.name}" loading="lazy">` : `<div class="dog-card-noimg">🐶</div>`}
      <div class="dog-card-body">
        <h3>${dog.name}</h3>
        <p>${[dog.breed, ageLabel(dog.age_months)].filter(Boolean).join(" · ")}</p>
        <p class="dog-card-shelter">${dog.shelters.name}${dog.shelters.city ? ` · ${dog.shelters.city}` : ""}</p>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".save-btn")) return;
      location.href = `dog-detail?id=${dog.id}`;
    });
    const saveBtn = card.querySelector(".save-btn");
    saveBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSave(dog.id, saveBtn);
    });
    dogGrid.append(card);
  }
}

async function toggleSave(dogId, btn) {
  btn.disabled = true;
  if (savedDogIds.has(dogId)) {
    await supabase.from("saved_dogs").delete().eq("user_id", currentUserId).eq("dog_id", dogId);
    savedDogIds.delete(dogId);
  } else {
    await supabase.from("saved_dogs").insert({ user_id: currentUserId, dog_id: dogId });
    savedDogIds.add(dogId);
  }
  btn.disabled = false;
  render();
}

function ageLabel(months) {
  if (!months) return "";
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years} yr${years === 1 ? "" : "s"}`;
}

breedFilter.addEventListener("input", render);
sizeFilter.addEventListener("change", render);
ageFilter.addEventListener("change", render);
shelterFilter.addEventListener("change", render);

refreshAll();
