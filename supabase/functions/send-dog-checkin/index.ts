// Sends a "is this dog still here?" check-in email via Resend, with two
// one-click response links (no login required).
//
// POST body: { "checkin_id": "<uuid>" }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESPOND_BASE_URL = `${SUPABASE_URL}/functions/v1/respond-dog-checkin`;

const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  let checkinId: string;
  try {
    ({ checkin_id: checkinId } = await req.json());
    if (!checkinId) throw new Error("checkin_id is required");
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  if (!RESEND_API_KEY) {
    return Response.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });
  }

  const { data: checkin, error: checkinError } = await supabase
    .from("dog_checkins")
    .select("id, token, dogs(name, shelters(name, email))")
    .eq("id", checkinId)
    .single();

  if (checkinError || !checkin) {
    return Response.json({ error: "check-in not found" }, { status: 404 });
  }

  const dog = checkin.dogs as unknown as { name: string; shelters: { name: string; email: string | null } };
  const shelterEmail = dog.shelters?.email;
  if (!shelterEmail) {
    return Response.json({ error: "shelter has no email on file" }, { status: 422 });
  }

  const stillAvailableUrl = `${RESPOND_BASE_URL}?token=${checkin.token}&response=still_available`;
  const adoptedUrl = `${RESPOND_BASE_URL}?token=${checkin.token}&response=adopted`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Wescues <onboarding@resend.dev>",
      to: shelterEmail,
      subject: `Quick check-in: is ${dog.name} still available?`,
      html: `
        <p>Hi ${dog.shelters.name},</p>
        <p>${dog.name}'s listing hasn't been confirmed in a couple of months. Is ${dog.name} still available for adoption?</p>
        <p>
          <a href="${stillAvailableUrl}">Still here / available</a><br>
          <a href="${adoptedUrl}">Adopted</a>
        </p>
        <p>If we don't hear back within two weeks, ${dog.name}'s listing will be hidden until you confirm it again.</p>
      `,
    }),
  });

  if (!emailRes.ok) {
    return Response.json({ error: `resend error: ${await emailRes.text()}` }, { status: 502 });
  }

  return Response.json({ sent: true, dog: dog.name });
});
