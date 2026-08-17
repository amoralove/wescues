// Computes a 64-bit perceptual hash for a dog_photos row and flags any
// other dog's photo within Hamming distance of it as a likely duplicate
// (the "same photo, different name" pattern).
//
// POST body: { "photo_id": "<uuid>" }
//
// JPEG only for now — see README "Known gaps" for PNG support.

import { createClient } from "npm:@supabase/supabase-js@2";
import jpeg from "npm:jpeg-js@0.4.4";
import { bmvbhash } from "npm:blockhash-core@0.1.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  let photoId: string;
  try {
    ({ photo_id: photoId } = await req.json());
    if (!photoId) throw new Error("photo_id is required");
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }

  const { data: photo, error: photoError } = await supabase
    .from("dog_photos")
    .select("id, url")
    .eq("id", photoId)
    .single();

  if (photoError || !photo) {
    return Response.json({ error: "photo not found" }, { status: 404 });
  }

  const imageRes = await fetch(photo.url);
  if (!imageRes.ok) {
    return Response.json({ error: `failed to fetch photo: ${imageRes.status}` }, { status: 502 });
  }
  const contentType = imageRes.headers.get("content-type") ?? "";
  if (!contentType.includes("jpeg") && !contentType.includes("jpg")) {
    return Response.json({ error: `unsupported image type: ${contentType || "unknown"}` }, { status: 415 });
  }

  const bytes = new Uint8Array(await imageRes.arrayBuffer());
  const decoded = jpeg.decode(bytes, { useTArray: true });
  const hashHex = bmvbhash(
    { data: decoded.data, width: decoded.width, height: decoded.height },
    8,
  );

  const { data: flags, error: flagError } = await supabase.rpc("hash_and_flag_photo", {
    p_photo_id: photoId,
    p_hash_hex: hashHex,
  });

  if (flagError) {
    return Response.json({ error: flagError.message }, { status: 500 });
  }

  return Response.json({ photo_id: photoId, hash: hashHex, flagged: flags });
});
