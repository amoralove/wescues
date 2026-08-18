// Shared top-right account display: email + log out when signed in,
// "Log in / Sign up" when not, and a Moderation link for platform_admins.
// Pages include the matching markup (#navLoginLink, #navEmail,
// #navLogoutBtn, #navAdminLink) and call initNav(supabase).

export function initNav(supabase) {
  const loginLink = document.getElementById("navLoginLink");
  const emailEl = document.getElementById("navEmail");
  const logoutBtn = document.getElementById("navLogoutBtn");
  const adminLink = document.getElementById("navAdminLink");

  async function render(session) {
    if (!session) {
      loginLink?.classList.remove("hidden");
      emailEl?.classList.add("hidden");
      logoutBtn?.classList.add("hidden");
      adminLink?.classList.add("hidden");
      return;
    }

    loginLink?.classList.add("hidden");
    if (emailEl) {
      emailEl.textContent = session.user.email;
      emailEl.classList.remove("hidden");
    }
    logoutBtn?.classList.remove("hidden");

    if (adminLink) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      adminLink.classList.toggle("hidden", profile?.role !== "platform_admin");
    }
  }

  logoutBtn?.addEventListener("click", () => supabase.auth.signOut());
  supabase.auth.onAuthStateChange((_event, session) => render(session));
  supabase.auth.getSession().then(({ data: { session } }) => render(session));
}
