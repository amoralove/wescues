import { createClient } from "@supabase/supabase-js";
import { initNav } from "./nav.js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
initNav(supabase);

const dogGrid = document.getElementById("dogGrid");
const resultCount = document.getElementById("resultCount");
const breedFilter = document.getElementById("breedFilter");
const sizeGroup = document.getElementById("sizeGroup");
const ageGroup = document.getElementById("ageGroup");
const shelterCount = document.getElementById("shelterCount");

let allDogs = [];
let savedDogIds = new Set();
let currentUserId = null;
let selectedSize = "";
let selectedAge = "";

function initPillGroup(group, onChange) {
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill-toggle");
    if (!btn) return;
    const wasActive = btn.classList.contains("active");
    group.querySelectorAll(".pill-toggle").forEach((b) => b.classList.remove("active"));
    if (!wasActive) btn.classList.add("active");
    onChange(wasActive ? "" : btn.dataset.value);
  });
}

initPillGroup(sizeGroup, (value) => {
  selectedSize = value;
  render();
});

initPillGroup(ageGroup, (value) => {
  selectedAge = value;
  render();
});

async function loadDogs() {
  const { data, error } = await supabase
    .from("dogs")
    .select("id, name, breed, age_months, sex, size, status, description, shelter_id, shelters(name, city, state), dog_photos(url)")
    .in("status", ["available", "pending"])
    .is("hidden_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    dogGrid.innerHTML = `<p>Error loading dogs: ${error.message}</p>`;
    return;
  }

  allDogs = data;
  updateShelterCount();
  render();
}

function updateShelterCount() {
  const shelterIds = new Set(allDogs.map((dog) => dog.shelter_id));
  shelterCount.textContent = `${shelterIds.size} participating shelter${shelterIds.size === 1 ? "" : "s"}`;
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

function ageBucket(months) {
  if (!months) return null;
  if (months < 12) return "puppy";
  if (months < 84) return "adult";
  return "senior";
}

function render() {
  const breedQuery = breedFilter.value.trim().toLowerCase();

  const filtered = allDogs.filter((dog) => {
    if (breedQuery && !dog.breed?.toLowerCase().includes(breedQuery) && !dog.name.toLowerCase().includes(breedQuery)) return false;
    if (selectedSize && dog.size !== selectedSize) return false;
    if (selectedAge && ageBucket(dog.age_months) !== selectedAge) return false;
    return true;
  });

  resultCount.textContent = `${filtered.length} dog${filtered.length === 1 ? "" : "s"}`;

  dogGrid.innerHTML = "";
  for (const dog of filtered) {
    const photoUrl = dog.dog_photos[0]?.url ?? "";
    const isSaved = savedDogIds.has(dog.id);
    const badge = dog.status === "pending"
      ? `<span class="tag tag-gold">Pending adoption</span>`
      : `<span class="tag tag-sage">${dog.shelters.name}${dog.shelters.city ? ` · ${dog.shelters.city}` : ""}</span>`;
    const card = document.createElement("div");
    card.className = "dog-card";
    card.innerHTML = `
      ${currentUserId ? `<button class="save-btn ${isSaved ? "saved" : ""}" data-dog-id="${dog.id}" title="${isSaved ? "Unsave" : "Save"}" aria-label="${isSaved ? "Unsave" : "Save"}">♥</button>` : ""}
      <div class="dog-card-photo-frame">
        ${photoUrl ? `<img src="${photoUrl}" alt="${dog.name}" loading="lazy">` : `<div class="dog-card-noimg">🐶</div>`}
      </div>
      <div class="dog-card-body">
        <h3>${dog.name}</h3>
        <p>${[dog.breed, ageLabel(dog.age_months)].filter(Boolean).join(" · ")}</p>
        ${badge}
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

refreshAll();
