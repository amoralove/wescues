import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lgpgrxhswhcfliroklio.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxncGdyeGhzd2hjZmxpcm9rbGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTA2MTQsImV4cCI6MjEwMjU2NjYxNH0.IRzWzb7rTm_D-IVSwQlVqh1-4HvKBVKyzUYhCBx_CXk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const resetForm = document.getElementById("resetForm");
const resetMessage = document.getElementById("resetMessage");

// The recovery link puts a token in the URL; supabase-js picks it up
// automatically and fires this event once the recovery session is ready.
let recoveryReady = false;
supabase.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") recoveryReady = true;
});

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!recoveryReady) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      resetMessage.textContent = "This reset link is invalid or expired. Request a new one from the login page.";
      return;
    }
  }

  const password = resetForm.password.value;
  const { error } = await supabase.auth.updateUser({ password });
  resetMessage.textContent = error
    ? error.message
    : "Password updated! You can log in with it now.";
  if (!error) resetForm.reset();
});
