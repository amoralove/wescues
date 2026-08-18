import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const statusMessage = document.getElementById("statusMessage");
const flagsSection = document.getElementById("flagsSection");
const flagList = document.getElementById("flagList");
const resultCount = document.getElementById("resultCount");
const statusFilter = document.getElementById("statusFilter");

async function init() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    statusMessage.textContent = "Please log in as a platform admin to view this page.";
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (error || profile.role !== "platform_admin") {
    statusMessage.textContent = "This page is restricted to platform admins.";
    return;
  }

  statusMessage.textContent = "";
  flagsSection.classList.remove("hidden");
  loadFlags();
}

async function loadFlags() {
  let query = supabase
    .from("flagged_listings_detail")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter.value) {
    query = query.eq("status", statusFilter.value);
  }

  const { data, error } = await query;

  if (error) {
    flagList.innerHTML = `<p>Error loading flags: ${error.message}</p>`;
    return;
  }

  resultCount.textContent = `${data.length} flag${data.length === 1 ? "" : "s"}`;
  renderFlags(data);
}

function renderFlags(flags) {
  flagList.innerHTML = "";

  if (flags.length === 0) {
    flagList.innerHTML = "<p>Nothing here.</p>";
    return;
  }

  for (const flag of flags) {
    const row = document.createElement("div");
    row.className = "flag-row";
    row.innerHTML = `
      <div class="flag-side">
        <img src="${flag.photo_url}" alt="${flag.dog_name}">
        <p><strong>${flag.dog_name}</strong>${flag.dog_hidden_at ? ' <span class="hidden-tag">hidden</span>' : ""}</p>
        <p class="dog-card-shelter">${flag.shelter_name}</p>
        <button class="secondary-btn hide-btn" data-dog-id="${flag.dog_id}" data-dog-name="${flag.dog_name}" data-other-name="${flag.matched_dog_name}" data-hidden="${!!flag.dog_hidden_at}">
          ${flag.dog_hidden_at ? `Unhide ${flag.dog_name}'s listing` : `Hide ${flag.dog_name}'s listing`}
        </button>
      </div>
      <div class="flag-meta">
        <p>Hamming distance: ${flag.hamming_distance}</p>
        <p>Status: ${flag.status}</p>
        ${flag.status === "pending" ? `<button class="secondary-btn dismiss-btn">Dismiss (not a duplicate)</button>` : ""}
        <p class="flag-action-message"></p>
      </div>
      <div class="flag-side">
        <img src="${flag.matched_photo_url}" alt="${flag.matched_dog_name}">
        <p><strong>${flag.matched_dog_name}</strong>${flag.matched_dog_hidden_at ? ' <span class="hidden-tag">hidden</span>' : ""}</p>
        <p class="dog-card-shelter">${flag.matched_shelter_name}</p>
        <button class="secondary-btn hide-btn" data-dog-id="${flag.matched_dog_id}" data-dog-name="${flag.matched_dog_name}" data-other-name="${flag.dog_name}" data-hidden="${!!flag.matched_dog_hidden_at}">
          ${flag.matched_dog_hidden_at ? `Unhide ${flag.matched_dog_name}'s listing` : `Hide ${flag.matched_dog_name}'s listing`}
        </button>
      </div>
    `;

    const actionMessage = row.querySelector(".flag-action-message");

    row.querySelectorAll(".hide-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        toggleHidden(
          flag.id,
          btn.dataset.dogId,
          btn.dataset.dogName,
          btn.dataset.otherName,
          btn.dataset.hidden === "true",
          actionMessage,
        ),
      );
    });

    const dismissBtn = row.querySelector(".dismiss-btn");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => dismissFlag(flag.id, actionMessage));
    }

    flagList.append(row);
  }
}

async function toggleHidden(flagId, dogId, dogName, otherName, currentlyHidden, actionMessage) {
  const nextHidden = !currentlyHidden;
  const { error: hideError } = await supabase.rpc("set_dog_hidden", {
    p_dog_id: dogId,
    p_hidden: nextHidden,
    p_reason: nextHidden ? `Confirmed duplicate of ${otherName}` : null,
  });

  if (hideError) {
    actionMessage.textContent = `Couldn't update ${dogName}: ${hideError.message}`;
    return;
  }

  if (nextHidden) {
    await supabase.from("flagged_listings").update({ status: "confirmed_duplicate" }).eq("id", flagId);
  }

  loadFlags();
}

async function dismissFlag(flagId, actionMessage) {
  const { error } = await supabase.from("flagged_listings").update({ status: "dismissed" }).eq("id", flagId);
  if (error) {
    actionMessage.textContent = `Couldn't dismiss: ${error.message}`;
    return;
  }
  loadFlags();
}

statusFilter.addEventListener("change", loadFlags);

init();
