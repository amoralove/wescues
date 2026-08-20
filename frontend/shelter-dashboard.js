import { createClient } from "@supabase/supabase-js";
import { initNav } from "./nav.js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
initNav(supabase);

const statusMessage = document.getElementById("statusMessage");
const dashboardContent = document.getElementById("dashboardContent");
const dogsTableBody = document.getElementById("dogsTableBody");

let shelterId = null;
let allDogs = [];

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 61;

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    statusMessage.textContent = "Please log in as a shelter to view this page.";
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, shelter_id")
    .eq("id", session.user.id)
    .single();

  if (error || profile.role !== "shelter_staff" || !profile.shelter_id) {
    statusMessage.textContent = "This page is for shelter accounts. Create a shelter first via the create_shelter flow.";
    return;
  }

  shelterId = profile.shelter_id;
  statusMessage.textContent = "";
  dashboardContent.classList.remove("hidden");
  loadDogs();
}

async function loadDogs() {
  const { data, error } = await supabase
    .from("dogs")
    .select("id, name, breed, age_months, sex, size, description, status, hidden_at, last_confirmed_at, dog_photos(url)")
    .eq("shelter_id", shelterId)
    .order("created_at", { ascending: false });

  if (error) {
    dogsTableBody.innerHTML = `<tr><td colspan="6">Error loading dogs: ${error.message}</td></tr>`;
    return;
  }

  allDogs = data;
  await renderStats();
  renderTable();
}

async function renderStats() {
  const active = allDogs.filter((d) => d.status === "available" && !d.hidden_at).length;
  const needsCheckin = allDogs.filter(
    (d) => d.status === "available" && !d.hidden_at && Date.now() - new Date(d.last_confirmed_at).getTime() > TWO_MONTHS_MS,
  ).length;

  const weekAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
  const { count } = await supabase
    .from("applications")
    .select("id, dogs!inner(shelter_id)", { count: "exact", head: true })
    .eq("dogs.shelter_id", shelterId)
    .gte("created_at", weekAgo);

  document.getElementById("statActive").textContent = active;
  document.getElementById("statApplications").textContent = count ?? 0;
  document.getElementById("statCheckins").textContent = needsCheckin;
}

function daysAgoLabel(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function ageLabel(months) {
  if (!months) return "—";
  if (months < 12) return `${months}mo`;
  return `${Math.floor(months / 12)}y`;
}

const statusTagClass = { available: "tag-sage", pending: "tag-accent", adopted: "tag-neutral", hold: "tag-neutral" };

function renderTable() {
  dogsTableBody.innerHTML = "";
  for (const dog of allDogs) {
    const photoUrl = dog.dog_photos[0]?.url ?? "";
    const needsCheckin = dog.status === "available" && !dog.hidden_at && Date.now() - new Date(dog.last_confirmed_at).getTime() > TWO_MONTHS_MS;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="table-dog-cell">${photoUrl ? `<img class="table-thumb" src="${photoUrl}" alt="">` : `<span class="table-thumb" style="display:inline-flex;align-items:center;justify-content:center;">🐶</span>`}${dog.name}</td>
      <td>${dog.breed ?? "—"}</td>
      <td>${ageLabel(dog.age_months)}</td>
      <td>${dog.hidden_at ? '<span class="tag tag-alert">Hidden</span>' : `<span class="tag ${statusTagClass[dog.status] ?? "tag-neutral"}">${dog.status}</span>`}${needsCheckin ? ' <span class="tag tag-alert">Needs check-in</span>' : ""}</td>
      <td>${daysAgoLabel(dog.last_confirmed_at)}</td>
      <td>
        <button class="secondary-btn edit-btn" style="margin-top:0; padding: 0.3rem 0.8rem; font-size: 0.8rem;">Edit</button>
        ${needsCheckin ? '<button class="primary-btn confirm-btn" style="margin-top:0; padding: 0.3rem 0.8rem; font-size: 0.8rem;">Confirm</button>' : ""}
      </td>
    `;
    row.querySelector(".edit-btn").addEventListener("click", () => openDogForm(dog));
    row.querySelector(".confirm-btn")?.addEventListener("click", () => openCheckinModal(dog));
    dogsTableBody.append(row);
  }
}

// Add/edit dog modal

const dogFormOverlay = document.getElementById("dogFormOverlay");
const dogForm = document.getElementById("dogForm");
const dogFormMessage = document.getElementById("dogFormMessage");

function openDogForm(dog) {
  document.getElementById("dogFormTitle").textContent = dog ? `Edit ${dog.name}` : "Add a dog";
  document.getElementById("dogFormId").value = dog?.id ?? "";
  document.getElementById("dogFormName").value = dog?.name ?? "";
  document.getElementById("dogFormBreed").value = dog?.breed ?? "";
  document.getElementById("dogFormAge").value = dog?.age_months ?? "";
  document.getElementById("dogFormSex").value = dog?.sex ?? "unknown";
  document.getElementById("dogFormSize").value = dog?.size ?? "";
  document.getElementById("dogFormStatus").value = dog?.status ?? "available";
  document.getElementById("dogFormDescription").value = dog?.description ?? "";
  dogFormMessage.textContent = "";
  dogFormOverlay.classList.add("open");
}

document.getElementById("addDogBtn").addEventListener("click", () => openDogForm(null));
document.getElementById("closeDogFormBtn").addEventListener("click", () => dogFormOverlay.classList.remove("open"));
dogFormOverlay.addEventListener("click", (e) => {
  if (e.target === dogFormOverlay) dogFormOverlay.classList.remove("open");
});

dogForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("dogFormId").value;
  const payload = {
    name: document.getElementById("dogFormName").value.trim(),
    breed: document.getElementById("dogFormBreed").value.trim() || null,
    age_months: document.getElementById("dogFormAge").value ? Number(document.getElementById("dogFormAge").value) : null,
    sex: document.getElementById("dogFormSex").value,
    size: document.getElementById("dogFormSize").value || null,
    status: document.getElementById("dogFormStatus").value,
    description: document.getElementById("dogFormDescription").value.trim() || null,
  };

  const { error } = id
    ? await supabase.from("dogs").update(payload).eq("id", id)
    : await supabase.from("dogs").insert({ ...payload, shelter_id: shelterId });

  if (error) {
    dogFormMessage.textContent = error.message;
    return;
  }

  dogFormOverlay.classList.remove("open");
  loadDogs();
});

// Check-in confirm modal

const checkinOverlay = document.getElementById("checkinOverlay");
let checkinDog = null;

function openCheckinModal(dog) {
  checkinDog = dog;
  document.getElementById("checkinTitle").textContent = `Still have ${dog.name}?`;
  checkinOverlay.classList.add("open");
}

document.getElementById("closeCheckinBtn").addEventListener("click", () => checkinOverlay.classList.remove("open"));
document.getElementById("checkinLater").addEventListener("click", () => checkinOverlay.classList.remove("open"));
checkinOverlay.addEventListener("click", (e) => {
  if (e.target === checkinOverlay) checkinOverlay.classList.remove("open");
});

async function respondCheckin(response) {
  const { error } = await supabase.rpc("confirm_dog_checkin_as_shelter", {
    p_dog_id: checkinDog.id,
    p_response: response,
  });
  if (error) {
    statusMessage.textContent = `Couldn't update ${checkinDog.name}: ${error.message}`;
    checkinOverlay.classList.remove("open");
    return;
  }
  checkinOverlay.classList.remove("open");
  loadDogs();
}

document.getElementById("checkinStillHere").addEventListener("click", () => respondCheckin("still_available"));
document.getElementById("checkinAdopted").addEventListener("click", () => respondCheckin("adopted"));

init();
