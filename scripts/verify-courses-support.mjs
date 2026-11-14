#!/usr/bin/env node
/** Verifiziert Schritt-2-Tabellen gegen die gogogo-Supabase (Publishable Key). */
const URL = process.env.SUPABASE_URL || "https://agpysewcsakdpmpftndp.supabase.co";
const KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_xd3b3JYejCTc4zXaDmT6Qw_jYaLWCTQ";
const NATALYA = "94a49c08-0818-4491-86a5-714885b6b73c";

async function rest(path, opts = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "return=representation",
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const courses = await rest("courses?select=slug,source,level&order=slug");
  if (!courses.ok) {
    console.error("FAIL courses:", courses.status, courses.data);
    console.error("→ Bitte go-courses-support.sql im Supabase SQL Editor ausführen.");
    process.exit(1);
  }
  console.log(
    "courses:",
    courses.data.map((c) => c.slug).join(", ")
  );

  const products = await rest("support_products?select=title,type&order=title");
  console.log(
    "support_products:",
    (products.data || []).map((p) => p.title).join(", ")
  );

  const bad = await rest("events", {
    method: "POST",
    body: {
      user_id: NATALYA,
      category: "kraft",
      starts_at: new Date().toISOString(),
      visibility: "privat",
      status: "geplant",
      title: "constraint-test"
    }
  });
  if (bad.ok) {
    console.error("FAIL: Event ohne course_id wurde angenommen");
    process.exit(1);
  }
  console.log("constraint reject ok:", bad.status);

  const streak = await rest(`rpc/go_streak_days`, {
    method: "POST",
    body: { p_user_id: NATALYA }
  });
  if (!streak.ok) {
    console.error("FAIL streak:", streak.status, streak.data);
    process.exit(1);
  }
  console.log("streak Natalya:", streak.data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
