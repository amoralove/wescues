import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

const authCard = document.getElementById("authCard");
const profileCard = document.getElementById("profileCard");
const profileDetails = document.getElementById("profileDetails");
const sessionStatus = document.getElementById("sessionStatus");
const authMessage = document.getElementById("authMessage");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    loginForm.classList.toggle("hidden", tab !== "login");
    signupForm.classList.toggle("hidden", tab !== "signup");
    authMessage.textContent = "";
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { email, password } = Object.fromEntries(new FormData(loginForm));
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  authMessage.textContent = error ? error.message : "";
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { email, password, full_name } = Object.fromEntries(new FormData(signupForm));
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  });
  authMessage.textContent = error
    ? error.message
    : "Check your email to confirm your account, then log in.";
});

document.getElementById("forgotPasswordBtn").addEventListener("click", async () => {
  const email = loginForm.email.value.trim();
  if (!email) {
    authMessage.textContent = "Enter your email above first, then click “Forgot password?”";
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/reset-password.html`,
  });
  authMessage.textContent = error ? error.message : "Check your email for a password reset link.";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

async function renderSession(session) {
  if (!session) {
    sessionStatus.textContent = "Not signed in";
    authCard.classList.remove("hidden");
    profileCard.classList.add("hidden");
    document.getElementById("adminLink")?.classList.add("hidden");
    return;
  }

  sessionStatus.textContent = session.user.email;
  authCard.classList.add("hidden");
  profileCard.classList.remove("hidden");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, shelter_id")
    .eq("id", session.user.id)
    .single();

  profileDetails.innerHTML = "";
  const rows = error
    ? [["error", error.message]]
    : [
        ["Email", session.user.email],
        ["User ID", session.user.id],
        ["Full name", profile.full_name ?? "—"],
        ["Role", profile.role],
        ["Shelter ID", profile.shelter_id ?? "—"],
      ];
  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    profileDetails.append(dt, dd);
  }

  document.getElementById("adminLink")?.classList.toggle("hidden", profile?.role !== "platform_admin");
}

supabase.auth.onAuthStateChange((_event, session) => {
  renderSession(session);
});

const { data: { session } } = await supabase.auth.getSession();
renderSession(session);
