import { createClient } from "@supabase/supabase-js";
import { initNav } from "./nav.js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
initNav(supabase);

const statusMessage = document.getElementById("statusMessage");
const accountContent = document.getElementById("accountContent");

function ageLabel(months) {
  if (!months) return "";
  if (months < 12) return `${months} mo`;
  return `${Math.floor(months / 12)} yr`;
}

const appStatusClass = {
  submitted: "tag-accent",
  reviewing: "tag-accent",
  approved: "tag-sage",
  rejected: "tag-alert",
  withdrawn: "tag-neutral",
};

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    statusMessage.textContent = "Please log in to view your account.";
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .single();

  document.getElementById("greeting").textContent = `Hi, ${profile?.full_name || session.user.email}`;
  statusMessage.textContent = "";
  accountContent.classList.remove("hidden");

  await Promise.all([loadApplications(session.user.id), loadSaved(session.user.id)]);
}

async function loadApplications(userId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, created_at, dogs(id, name, shelters(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const list = document.getElementById("applicationsList");

  if (error) {
    list.innerHTML = `<p>Error loading applications: ${error.message}</p>`;
    return;
  }

  const inProgress = data.filter((a) => a.status === "submitted" || a.status === "reviewing").length;
  updateSummary({ applications: inProgress });

  if (data.length === 0) {
    list.innerHTML = '<p style="font-size: 0.85rem; color: rgba(32,30,29,.55);">No applications yet.</p>';
    return;
  }

  list.innerHTML = data
    .map(
      (app) => `
    <div class="panel" style="display: flex; align-items: center; gap: 1rem;">
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 0.9rem;">
          <a href="dog-detail?id=${app.dogs.id}" style="color: inherit;">${app.dogs.name}</a>
          · ${app.dogs.shelters.name}
        </div>
        <div style="font-size: 0.75rem; color: rgba(32,30,29,.55);">Submitted ${new Date(app.created_at).toLocaleDateString()}</div>
      </div>
      <span class="tag ${appStatusClass[app.status] ?? "tag-neutral"}">${app.status}</span>
    </div>
  `,
    )
    .join("");
}

async function loadSaved(userId) {
  const { data, error } = await supabase
    .from("saved_dogs")
    .select("id, dogs(id, name, breed, age_months, status, hidden_at, shelters(name), dog_photos(url))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const grid = document.getElementById("savedGrid");

  if (error) {
    grid.innerHTML = `<p>Error loading saved dogs: ${error.message}</p>`;
    return;
  }

  updateSummary({ saved: data.length });

  if (data.length === 0) {
    grid.innerHTML = '<p style="font-size: 0.85rem; color: rgba(32,30,29,.55);">No saved dogs yet.</p>';
    return;
  }

  grid.innerHTML = data
    .map(({ dogs: dog }) => {
      const photoUrl = dog.dog_photos[0]?.url ?? "";
      const unavailable = dog.hidden_at || dog.status !== "available";
      return `
      <a href="dog-detail?id=${dog.id}" class="dog-card" style="text-decoration: none; display: block;">
        ${photoUrl ? `<img src="${photoUrl}" alt="${dog.name}" loading="lazy">` : `<div class="dog-card-noimg">🐶</div>`}
        <div class="dog-card-body">
          <h3>${dog.name}</h3>
          <p>${[dog.breed, ageLabel(dog.age_months)].filter(Boolean).join(" · ")}</p>
          <p class="dog-card-shelter">${unavailable ? '<span class="tag tag-neutral">No longer available</span>' : dog.shelters.name}</p>
        </div>
      </a>
    `;
    })
    .join("");
}

const summary = { saved: 0, applications: 0 };
function updateSummary(partial) {
  Object.assign(summary, partial);
  document.getElementById("summaryLine").textContent =
    `${summary.saved} saved dog${summary.saved === 1 ? "" : "s"} · ${summary.applications} application${summary.applications === 1 ? "" : "s"} in progress`;
}

init();
