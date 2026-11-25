// go-place-photo — Fotos für Plus → Orte (go-orte-plus.sql).
// POST { action: "search", q }  → Kandidaten von Wikimedia Commons, nur gemeinfrei (CC0 / Public Domain)
// POST { action: "store", id, url, credit } → Bild in go-covers/places/<id>.jpg, setzt photo_url/photo_credit,
//   nur solange der Ort noch kein Foto hat (sonst ändert der Admin es in der Admin-Liste).
// Nur für Admins (Header x-go-account-id, go_accounts.is_admin).
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-go-account-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const UA = { "User-Agent": "gogogo-places/1.0 (https://gogogo.social; j@biig.works)" };
const FREE = /^(cc0|public domain|pd\b|pd-|no restrictions)/i;

async function search(q: string) {
  const u = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
    action: "query", generator: "search", gsrsearch: q, gsrnamespace: "6", gsrlimit: "30",
    prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "900", format: "json",
  });
  const r = await fetch(u, { headers: UA });
  if (!r.ok) return { error: "commons_" + r.status };
  const d = await r.json();
  const pages = Object.values((d.query && d.query.pages) || {}) as any[];
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = pages.map((p) => {
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii) return null;
    const m = ii.extmetadata || {};
    const lic = String((m.LicenseShortName && m.LicenseShortName.value) || "");
    const artist = String((m.Artist && m.Artist.value) || "").replace(/<[^>]+>/g, "").trim();
    return { title: String(p.title || "").replace(/^File:/, ""), license: lic, artist, w: ii.width, h: ii.height,
      mime: ii.mime, thumb: ii.thumburl, page: ii.descriptionurl };
  }).filter((x) => x && FREE.test(x.license) && /jpeg|png|webp/.test(x.mime || ""));
  return { items: out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { /* leer */ }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const me = String(req.headers.get("x-go-account-id") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(me)) return json({ error: "admin" }, 403);
  const { data: acc } = await db.from("go_accounts").select("is_admin").eq("id", me).maybeSingle();
  if (!acc || !acc.is_admin) return json({ error: "admin" }, 403);
  if (b.action === "search") {
    const q = String(b.q || "").trim().slice(0, 120);
    if (q.length < 2) return json({ error: "q" }, 400);
    return json(await search(q));
  }
  if (b.action === "store") {
    const id = String(b.id || "");
    const url = String(b.url || "");
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url)) return json({ error: "args" }, 400);
    const { data: place } = await db.from("go_workout_places").select("id,photo_url").eq("id", id).maybeSingle();
    if (!place) return json({ error: "not_found" }, 404);
    if (place.photo_url) return json({ photo_url: place.photo_url, kept: true });
    const img = await fetch(url, { headers: UA });
    if (!img.ok) return json({ error: "img_" + img.status }, 502);
    const bytes = new Uint8Array(await img.arrayBuffer());
    const path = `places/${id}.jpg`;
    const up = await db.storage.from("go-covers").upload(path, bytes, { contentType: img.headers.get("content-type") || "image/jpeg", upsert: true });
    if (up.error) return json({ error: "upload", detail: up.error.message }, 500);
    const pub = db.storage.from("go-covers").getPublicUrl(path).data.publicUrl;
    await db.from("go_workout_places").update({ photo_url: pub, photo_credit: String(b.credit || "").slice(0, 200) || null }).eq("id", id);
    return json({ photo_url: pub });
  }
  return json({ error: "action" }, 400);
});
