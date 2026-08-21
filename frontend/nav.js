// Shared top-right account display: profile name (falling back to email),
// linking to the Account page, when signed in, "Log in / Sign up" when
// not, plus role-aware links. Pages include the matching markup
// (#navLoginLink, #navEmail, and any of #navAdminLink / #navShelterLink)
// and call initNav(supabase). Logging out happens from the Account page,
// not the header.

export function initNav(supabase) {
  const loginLink = document.getElementById("navLoginLink");
  const emailEl = document.getElementById("navEmail");
  const adminLink = document.getElementById("navAdminLink");
  const shelterLink = document.getElementById("navShelterLink");

  async function render(session) {
    if (!session) {
      loginLink?.classList.remove("hidden");
      emailEl?.classList.add("hidden");
      adminLink?.classList.add("hidden");
      shelterLink?.classList.add("hidden");
      return;
    }

    loginLink?.classList.add("hidden");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", session.user.id)
      .single();

    if (emailEl) {
      emailEl.textContent = profile?.full_name || session.user.email;
      emailEl.classList.remove("hidden");
    }
    adminLink?.classList.toggle("hidden", profile?.role !== "platform_admin");
    shelterLink?.classList.toggle("hidden", profile?.role !== "shelter_staff");
  }

  supabase.auth.onAuthStateChange((_event, session) => render(session));
  supabase.auth.getSession().then(({ data: { session } }) => render(session));
}
