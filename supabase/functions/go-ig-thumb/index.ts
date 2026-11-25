// go-ig-thumb — Vorschaubild für Instagram-Links unter Plus → Videos (go-exercise-link-thumb.sql).
// POST { id } (go_exercise_links.id). Holt das Startbild aus der öffentlichen Embed-Seite des Beitrags,
// legt es dauerhaft in den Bucket go-covers (exlinks/<id>.jpg) und schreibt thumb_url an den Link.
// Instagram-Bild-URLs laufen nach ein paar Tagen ab, deshalb die Kopie im eigenen Speicher.
// Ohne JWT-Prüfung (App nutzt Publishable Key), aber nur für eingeloggte Nutzer: Header x-go-account-id muss ein Konto sein.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-go-account-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function igEmbed(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[^\/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  const kind = m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase();
  return `https://www.instagram.com/${kind}/${m[2]}/embed/`;
}

function coverFrom(html: string): string | null {
  const tag = html.match(/<img[^>]*class="EmbeddedMediaImage"[^>]*>/i);
  const src = tag && tag[0].match(/\ssrc="([^"]+)"/i);
  if (src) return src[1].replace(/&amp;/g, "&");
  const og = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  return og ? og[1].replace(/&amp;/g, "&") : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let id = "";
  try { id = String((await req.json()).id || ""); } catch { /* leer */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "id" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const me = String(req.headers.get("x-go-account-id") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(me)) return json({ error: "login" }, 401);
  const { data: acc } = await db.from("go_accounts").select("id").eq("id", me).maybeSingle();
  if (!acc) return json({ error: "login" }, 401);
  const { data: link, error } = await db.from("go_exercise_links").select("id,url,thumb_url").eq("id", id).maybeSingle();
  if (error || !link) return json({ error: "not_found" }, 404);
  if (link.thumb_url) return json({ thumb_url: link.thumb_url });
  const embed = igEmbed(String(link.url || ""));
  if (!embed) return json({ error: "not_instagram" }, 422);

  const page = await fetch(embed, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Accept-Language": "de-DE,de;q=0.9" } });
  if (!page.ok) return json({ error: "embed_" + page.status }, 502);
  const cover = coverFrom(await page.text());
  if (!cover) return json({ error: "no_cover" }, 502);

  const img = await fetch(cover);
  if (!img.ok) return json({ error: "img_" + img.status }, 502);
  const bytes = new Uint8Array(await img.arrayBuffer());
  const path = `exlinks/${id}.jpg`;
  const up = await db.storage.from("go-covers").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (up.error) return json({ error: "upload", detail: up.error.message }, 500);
  const pub = db.storage.from("go-covers").getPublicUrl(path).data.publicUrl;
  await db.from("go_exercise_links").update({ thumb_url: pub }).eq("id", id);
  return json({ thumb_url: pub });
});
