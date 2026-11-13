#!/usr/bin/env node
/** Prüft go-visibility-team.sql + Sichtbarkeit team für 2 Accounts (wenn Buddy). */
const URL = process.env.SUPABASE_URL || "https://agpysewcsakdpmpftndp.supabase.co";
const KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_xd3b3JYejCTc4zXaDmT6Qw_jYaLWCTQ";

async function rest(path, opts = {}) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    Prefer: opts.prefer || "return=representation"
  };
  if (opts.accountId) headers["x-go-account-id"] = String(opts.accountId);
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers,
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

function fail(msg, detail) {
  console.error("FAIL:", msg, detail || "");
  process.exit(1);
}

async function main() {
  const probe = await rest("events?select=id,visibility&limit=1");
  if (!probe.ok) fail("events nicht lesbar — go-courses-support.sql?", probe);

  const groups = await rest("groups?select=id&limit=1");
  if (!groups.ok) {
    fail("Tabelle groups fehlt — bitte go-visibility-team.sql ausführen.", groups);
  }
  console.log("groups table ok");

  const col = await rest("events?select=id,group_id&limit=1");
  if (!col.ok) fail("events.group_id fehlt — go-visibility-team.sql ausführen.", col);
  console.log("events.group_id ok");

  const members = await rest("group_members?select=group_id&limit=1");
  if (!members.ok) fail("group_members fehlt", members);
  console.log("group_members table ok");

  const accounts = await rest("go_accounts?select=id,name&limit=20");
  if (!accounts.ok || !accounts.data?.length) fail("keine go_accounts", accounts);

  let a = accounts.data[0];
  let b = null;
  for (const acc of accounts.data) {
    const links = await rest(
      `go_buddies?or=(and(account_id.eq.${acc.id},buddy_id.neq.${acc.id}),and(buddy_id.eq.${acc.id}))&select=account_id,buddy_id&limit=5`,
      { accountId: acc.id }
    );
    if (!links.ok || !links.data?.length) continue;
    const row = links.data[0];
    const other = String(row.account_id) === String(acc.id) ? row.buddy_id : row.account_id;
    const otherAcc = accounts.data.find((x) => String(x.id) === String(other));
    if (otherAcc) {
      a = acc;
      b = otherAcc;
      break;
    }
  }

  if (!b) {
    console.log("SKIP 2-Account-Test: kein Buddy-Paar gefunden.");
    console.log("Constraint-Probe: insert visibility=team …");
  }

  const course = await rest("courses?slug=eq.eigenes-training&select=id&limit=1");
  const courseId = course.data?.[0]?.id;
  if (!courseId) fail("Systemkurs eigenes-training fehlt — go-event-comments.sql?");

  const created = await rest("events", {
    method: "POST",
    accountId: a.id,
    body: {
      user_id: a.id,
      course_id: courseId,
      category: "kraft",
      starts_at: new Date(Date.now() + 3600000).toISOString(),
      visibility: "team",
      is_unplanned: true,
      status: "geplant",
      title: "visibility-team-test"
    }
  });
  if (!created.ok) {
    fail(
      "Event visibility=team abgelehnt — Migration/Constraint?",
      created
    );
  }
  const ev = Array.isArray(created.data) ? created.data[0] : created.data;
  console.log("A created team event", ev.id, "as", a.name || a.id);

  if (b) {
    const asB = await rest(`events?id=eq.${ev.id}&select=id,visibility,user_id`, {
      accountId: b.id
    });
    if (!asB.ok || !asB.data?.length) {
      fail("B sieht Event von A nicht (RLS team / Buddy?)", asB);
    }
    console.log("B sieht Event in REST (Team-Sicht) ok");

    const rsvp = await rest("event_rsvps?on_conflict=event_id,user_id", {
      method: "POST",
      accountId: b.id,
      prefer: "resolution=merge-duplicates,return=representation",
      body: { event_id: ev.id, user_id: b.id, status: "zugesagt" }
    });
    if (!rsvp.ok) fail("RSVP B fehlgeschlagen", rsvp);
    console.log("B zugesagt ok — UI: Event erscheint in Ich für B");
  }

  await rest(`events?id=eq.${ev.id}`, {
    method: "DELETE",
    accountId: a.id,
    prefer: "return=minimal"
  });
  console.log("cleanup ok");
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
