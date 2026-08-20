import { createClient } from "@supabase/supabase-js";
import { initNav } from "./nav.js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
initNav(supabase);

const dogId = new URLSearchParams(location.search).get("id");
const statusMessage = document.getElementById("statusMessage");
const detailContent = document.getElementById("detailContent");

function ageLabel(months) {
  if (!months) return null;
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years} yr${years === 1 ? "" : "s"}`;
}

async function init() {
  if (!dogId) {
    statusMessage.textContent = "No dog specified.";
    return;
  }

  const { data: dog, error } = await supabase
    .from("dogs")
    .select("id, name, breed, age_months, sex, size, description, status, shelter_id, shelters(name, city, state), dog_photos(url)")
    .eq("id", dogId)
    .single();

  if (error || !dog) {
    statusMessage.textContent = "Couldn't find that dog — it may have been removed.";
    return;
  }

  renderDog(dog);
  detailContent.classList.remove("hidden");

  const { data: { session } } = await supabase.auth.getSession();
  await renderSaveButton(dog, session);
  await renderApplySection(dog, session);
}

function renderDog(dog) {
  document.title = `Wescues — ${dog.name}`;
  const photos = dog.dog_photos.map((p) => p.url);
  const mainPhoto = document.getElementById("mainPhoto");
  mainPhoto.src = photos[0] ?? "";

  const thumbRow = document.getElementById("thumbRow");
  thumbRow.innerHTML = "";
  photos.forEach((url, i) => {
    const thumb = document.createElement("img");
    thumb.src = url;
    thumb.style.cssText = "width: 70px; height: 56px; object-fit: cover; border-radius: 12px; cursor: pointer;" + (i === 0 ? " outline: 2px solid #c67139;" : "");
    thumb.addEventListener("click", () => {
      mainPhoto.src = url;
      thumbRow.querySelectorAll("img").forEach((t) => (t.style.outline = ""));
      thumb.style.outline = "2px solid #c67139";
    });
    thumbRow.append(thumb);
  });

  document.getElementById("dogName").textContent = dog.name;
  document.getElementById("dogMeta").textContent = [dog.breed, ageLabel(dog.age_months), dog.sex]
    .filter(Boolean)
    .join(" · ");

  const tags = document.getElementById("dogTags");
  const tagList = [
    { text: dog.shelters.name, cls: "tag-sage" },
    dog.size ? { text: dog.size, cls: "tag-neutral" } : null,
    dog.status !== "available" ? { text: dog.status, cls: "tag-accent" } : null,
  ].filter(Boolean);
  tags.innerHTML = tagList.map((t) => `<span class="tag ${t.cls}">${t.text}</span>`).join("");

  document.getElementById("dogDescription").textContent = dog.description ?? "";
  document.getElementById("shelterInfo").textContent = [dog.shelters.name, dog.shelters.city, dog.shelters.state]
    .filter(Boolean)
    .join(", ");
}

async function renderSaveButton(dog, session) {
  const saveBtn = document.getElementById("saveBtn");
  if (!session) return;
  saveBtn.classList.remove("hidden");

  const { data } = await supabase
    .from("saved_dogs")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("dog_id", dog.id)
    .maybeSingle();

  let saved = !!data;
  saveBtn.classList.toggle("saved", saved);

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    if (saved) {
      await supabase.from("saved_dogs").delete().eq("user_id", session.user.id).eq("dog_id", dog.id);
    } else {
      await supabase.from("saved_dogs").insert({ user_id: session.user.id, dog_id: dog.id });
    }
    saved = !saved;
    saveBtn.classList.toggle("saved", saved);
    saveBtn.disabled = false;
  });
}

async function renderApplySection(dog, session) {
  const section = document.getElementById("applySection");

  if (!session) {
    section.innerHTML = `
      <div class="panel" style="text-align: center;">
        <p style="margin: 0 0 0.6rem; font-size: 0.9rem;">Log in to apply to adopt ${dog.name}.</p>
        <a href="index.html" class="primary-btn" style="text-decoration: none;">Log in / Sign up</a>
      </div>
    `;
    return;
  }

  const { data: existing } = await supabase
    .from("applications")
    .select("id, status, created_at")
    .eq("dog_id", dog.id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (existing) {
    section.innerHTML = `
      <div class="panel">
        <div style="font-weight: 700; margin-bottom: 0.3rem;">Application submitted</div>
        <div style="font-size: 0.85rem; color: rgba(32,30,29,.65);">Status: <span class="tag tag-accent">${existing.status}</span></div>
        ${existing.status !== "withdrawn" ? '<button id="withdrawBtn" class="secondary-btn" style="margin-top: 0.8rem;">Withdraw application</button>' : ""}
      </div>
    `;
    document.getElementById("withdrawBtn")?.addEventListener("click", async (e) => {
      e.target.disabled = true;
      await supabase.from("applications").update({ status: "withdrawn" }).eq("id", existing.id);
      renderApplySection(dog, session);
    });
    return;
  }

  section.innerHTML = `
    <h4 style="margin-bottom: 0.7rem;">Start your application</h4>
    <form id="applyForm" style="display: flex; flex-direction: column; gap: 0.6rem;">
      <textarea id="applyMessage" placeholder="Tell the shelter about your home" style="border: 1px solid rgba(32,30,29,.18); border-radius: 18px; padding: 0.6rem 1rem; font-size: 0.85rem; background: #f9f4ed; resize: none; min-height: 80px; font-family: inherit;"></textarea>
      <button type="submit" class="primary-btn" style="width: 100%;">Submit application to ${dog.shelters.name}</button>
      <p id="applyMessageStatus" style="font-size: 0.8rem; color: #b5432c; min-height: 1.2em; margin: 0;"></p>
    </form>
  `;

  document.getElementById("applyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = document.getElementById("applyMessage").value.trim();
    const statusEl = document.getElementById("applyMessageStatus");
    const { error } = await supabase.from("applications").insert({
      dog_id: dog.id,
      user_id: session.user.id,
      message: message || null,
    });
    if (error) {
      statusEl.textContent = error.message;
      return;
    }
    renderApplySection(dog, session);
  });
}

init();
