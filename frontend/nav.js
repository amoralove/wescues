// Shared top-right account display: email + log out when signed in,
// "Log in / Sign up" when not, plus role-aware links. Pages include the
// matching markup (#navLoginLink, #navEmail, #navLogoutBtn, and any of
// #navAdminLink / #navShelterLink / #navAccountLink) and call initNav(supabase).

export function initNav(supabase) {
  const loginLink = document.getElementById("navLoginLink");
  const emailEl = document.getElementById("navEmail");
  const logoutBtn = document.getElementById("navLogoutBtn");
  const adminLink = document.getElementById("navAdminLink");
  const shelterLink = document.getElementById("navShelterLink");
  const accountLink = document.getElementById("navAccountLink");

  async function render(session) {
    if (!session) {
      loginLink?.classList.remove("hidden");
      emailEl?.classList.add("hidden");
      logoutBtn?.classList.add("hidden");
      adminLink?.classList.add("hidden");
      shelterLink?.classList.add("hidden");
      accountLink?.classList.add("hidden");
      return;
    }

    loginLink?.classList.add("hidden");
    if (emailEl) {
      emailEl.textContent = session.user.email;
      emailEl.classList.remove("hidden");
    }
    logoutBtn?.classList.remove("hidden");
    accountLink?.classList.remove("hidden");

    if (adminLink || shelterLink) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      adminLink?.classList.toggle("hidden", profile?.role !== "platform_admin");
      shelterLink?.classList.toggle("hidden", profile?.role !== "shelter_staff");
    }
  }

  logoutBtn?.addEventListener("click", () => supabase.auth.signOut());
  supabase.auth.onAuthStateChange((_event, session) => render(session));
  supabase.auth.getSession().then(({ data: { session } }) => render(session));
}
