import { createClient } from "@supabase/supabase-js";
import { initNav } from "./nav.js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
initNav(supabase);

const statusMessage = document.getElementById("statusMessage");
const flagsSection = document.getElementById("flagsSection");
const flagList = document.getElementById("flagList");
const queueCount = document.getElementById("queueCount");
const statusFilter = document.getElementById("statusFilter");
const prevFlagBtn = document.getElementById("prevFlagBtn");
const nextFlagBtn = document.getElementById("nextFlagBtn");

let flags = [];
let currentIndex = 0;

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

async function loadFlags(keepIndex) {
  const previousId = keepIndex ? flags[currentIndex]?.id : null;

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

  flags = data;
  currentIndex = previousId ? Math.max(0, flags.findIndex((f) => f.id === previousId)) : 0;
  if (currentIndex === -1) currentIndex = 0;

  renderQueue();
}

function renderQueue() {
  const label = statusFilter.value || "all";
  queueCount.textContent = `${flags.length} ${label}`;
  prevFlagBtn.disabled = currentIndex <= 0;
  nextFlagBtn.disabled = currentIndex >= flags.length - 1;

  flagList.innerHTML = "";
  if (flags.length === 0) {
    flagList.innerHTML = "<p>Nothing here.</p>";
    return;
  }

  flagList.append(renderFlag(flags[currentIndex]));
}

function renderFlag(flag) {
  const row = document.createElement("div");
  row.className = "flag-row";
  row.innerHTML = `
    <div class="flag-side ${flag.dog_hidden_at ? "is-hidden" : ""}">
      <img src="${flag.photo_url}" alt="${flag.dog_name}">
      <p><strong>${flag.dog_name}</strong>${flag.dog_hidden_at ? ' <span class="hidden-tag">HIDDEN from public site</span>' : ""}</p>
      <p class="dog-card-shelter">${flag.shelter_name}</p>
      <button class="${flag.dog_hidden_at ? "primary-btn" : "secondary-btn"} hide-btn" data-dog-id="${flag.dog_id}" data-dog-name="${flag.dog_name}" data-other-name="${flag.matched_dog_name}" data-hidden="${!!flag.dog_hidden_at}">
        ${flag.dog_hidden_at ? `↺ Restore ${flag.dog_name}'s listing` : `Hide ${flag.dog_name}'s listing`}
      </button>
      <button class="secondary-btn merge-btn" data-primary-id="${flag.dog_id}" data-duplicate-id="${flag.matched_dog_id}" data-duplicate-name="${flag.matched_dog_name}" style="margin-top: 0.4rem; padding: 0.3rem 0.7rem; font-size: 0.75rem;">Merge ${flag.matched_dog_name} into this</button>
      <button class="danger-btn delete-btn" data-dog-id="${flag.dog_id}" data-dog-name="${flag.dog_name}">Delete ${flag.dog_name} permanently</button>
    </div>
    <div class="flag-meta">
      <p>Hamming distance: ${flag.hamming_distance}</p>
      <p>Status: ${flag.status}</p>
      <button class="secondary-btn dismiss-btn" data-dismissed="${flag.status === "dismissed"}">
        ${flag.status === "dismissed" ? "↺ Undismiss (reopen as pending)" : "Not a duplicate"}
      </button>
      <p class="flag-action-message"></p>
    </div>
    <div class="flag-side ${flag.matched_dog_hidden_at ? "is-hidden" : ""}">
      <img src="${flag.matched_photo_url}" alt="${flag.matched_dog_name}">
      <p><strong>${flag.matched_dog_name}</strong>${flag.matched_dog_hidden_at ? ' <span class="hidden-tag">HIDDEN from public site</span>' : ""}</p>
      <p class="dog-card-shelter">${flag.matched_shelter_name}</p>
      <button class="${flag.matched_dog_hidden_at ? "primary-btn" : "secondary-btn"} hide-btn" data-dog-id="${flag.matched_dog_id}" data-dog-name="${flag.matched_dog_name}" data-other-name="${flag.dog_name}" data-hidden="${!!flag.matched_dog_hidden_at}">
        ${flag.matched_dog_hidden_at ? `↺ Restore ${flag.matched_dog_name}'s listing` : `Hide ${flag.matched_dog_name}'s listing`}
      </button>
      <button class="secondary-btn merge-btn" data-primary-id="${flag.matched_dog_id}" data-duplicate-id="${flag.dog_id}" data-duplicate-name="${flag.dog_name}" style="margin-top: 0.4rem; padding: 0.3rem 0.7rem; font-size: 0.75rem;">Merge ${flag.dog_name} into this</button>
      <button class="danger-btn delete-btn" data-dog-id="${flag.matched_dog_id}" data-dog-name="${flag.matched_dog_name}">Delete ${flag.matched_dog_name} permanently</button>
    </div>
  `;

  const actionMessage = row.querySelector(".flag-action-message");

  row.querySelectorAll(".hide-btn").forEach((btn) => {
    const currentlyHidden = btn.dataset.hidden === "true";
    const confirmText = currentlyHidden
      ? `Are you sure? Click to confirm restoring ${btn.dataset.dogName}`
      : `Are you sure? Click to confirm hiding ${btn.dataset.dogName}`;
    attachConfirmHandler(btn, confirmText, (resetBtn) =>
      toggleHidden(
        flag.id,
        btn.dataset.dogId,
        btn.dataset.dogName,
        btn.dataset.otherName,
        currentlyHidden,
        actionMessage,
        resetBtn,
      ),
    );
  });

  row.querySelectorAll(".delete-btn").forEach((btn) => {
    attachConfirmHandler(
      btn,
      `Are you sure? Click to confirm deleting ${btn.dataset.dogName}`,
      (resetBtn) => deleteDog(btn.dataset.dogId, btn.dataset.dogName, actionMessage, resetBtn),
    );
  });

  row.querySelectorAll(".merge-btn").forEach((btn) => {
    attachConfirmHandler(
      btn,
      `Are you sure? This merges ${btn.dataset.duplicateName}'s applications here, then deletes ${btn.dataset.duplicateName}`,
      (resetBtn) => mergeDogs(btn.dataset.primaryId, btn.dataset.duplicateId, btn.dataset.duplicateName, actionMessage, resetBtn),
    );
  });

  const dismissBtn = row.querySelector(".dismiss-btn");
  dismissBtn.addEventListener("click", () =>
    setDismissed(flag.id, dismissBtn.dataset.dismissed === "true", actionMessage),
  );

  return row;
}

async function toggleHidden(flagId, dogId, dogName, otherName, currentlyHidden, actionMessage, btn) {
  const nextHidden = !currentlyHidden;
  btn.disabled = true;

  const { error: hideError } = await supabase.rpc("set_dog_hidden", {
    p_dog_id: dogId,
    p_hidden: nextHidden,
    p_reason: nextHidden ? `Confirmed duplicate of ${otherName}` : null,
  });

  if (hideError) {
    actionMessage.textContent = `Couldn't update ${dogName}: ${hideError.message}`;
    resetConfirmButton(btn);
    return;
  }

  await supabase
    .from("flagged_listings")
    .update({ status: nextHidden ? "confirmed_duplicate" : "pending" })
    .eq("id", flagId);

  loadFlags(true);
}

// Two-step in-page confirm instead of a native confirm() dialog -- not
// every embedding context allows native dialogs, and this is easier to
// style/test consistently anyway. First click arms it and shows
// confirmText; second click runs onConfirm(btn).
function attachConfirmHandler(btn, confirmText, onConfirm) {
  btn.dataset.originalText = btn.textContent;

  btn.addEventListener("click", () => {
    if (btn.dataset.confirming !== "true") {
      btn.dataset.confirming = "true";
      btn.textContent = confirmText;
      return;
    }
    onConfirm(btn);
  });
}

function resetConfirmButton(btn) {
  btn.disabled = false;
  btn.dataset.confirming = "false";
  btn.textContent = btn.dataset.originalText;
}

async function deleteDog(dogId, dogName, actionMessage, btn) {
  btn.disabled = true;
  const { error } = await supabase.from("dogs").delete().eq("id", dogId);

  if (error) {
    actionMessage.textContent = `Couldn't delete ${dogName}: ${error.message}`;
    resetConfirmButton(btn);
    return;
  }

  loadFlags();
}

async function mergeDogs(primaryId, duplicateId, duplicateName, actionMessage, btn) {
  btn.disabled = true;
  const { error } = await supabase.rpc("merge_duplicate_dog", {
    p_primary_dog_id: primaryId,
    p_duplicate_dog_id: duplicateId,
  });

  if (error) {
    actionMessage.textContent = `Couldn't merge ${duplicateName}: ${error.message}`;
    resetConfirmButton(btn);
    return;
  }

  loadFlags();
}

async function setDismissed(flagId, currentlyDismissed, actionMessage) {
  const nextStatus = currentlyDismissed ? "pending" : "dismissed";
  const { error } = await supabase.from("flagged_listings").update({ status: nextStatus }).eq("id", flagId);
  if (error) {
    actionMessage.textContent = `Couldn't update: ${error.message}`;
    return;
  }
  loadFlags();
}

prevFlagBtn.addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex -= 1;
    renderQueue();
  }
});

nextFlagBtn.addEventListener("click", () => {
  if (currentIndex < flags.length - 1) {
    currentIndex += 1;
    renderQueue();
  }
});

statusFilter.addEventListener("change", () => loadFlags());

init();
