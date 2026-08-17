// Public link handler for the check-in email -- no login. The token itself
// is the authorization.
//
// GET ?token=<token>&response=still_available|adopted

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function page(message: string, ok: boolean) {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family: system-ui; max-width: 480px; margin: 4rem auto; text-align: center;">
      <h1>${ok ? "Thanks!" : "Something went wrong"}</h1>
      <p>${message}</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" }, status: ok ? 200 : 400 },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const response = url.searchParams.get("response");

  if (!token || !response) {
    return page("Missing token or response.", false);
  }

  const { data, error } = await supabase.rpc("respond_to_checkin", {
    p_token: token,
    p_response: response,
  });

  if (error) {
    return page(error.message, false);
  }

  const message = data.status === "confirmed_adopted"
    ? "Congrats on the adoption! We've updated the listing."
    : "Got it — the listing is confirmed active for another couple of months.";
  return page(message, true);
});
