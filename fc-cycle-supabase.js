(function () {
  "use strict";

  /**
   * Friday Cycle Table → Supabase REST
   * Tables: cycle_sessions, cycle_users (see docs/cycle-table-supabase.md)
   *
   * Set real values in fc-cycle-supabase-config.js (gitignored) or inline below.
   */
  var SUPABASE_URL = window.FC_CYCLE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
  var SUPABASE_ANON_KEY = window.FC_CYCLE_SUPABASE_ANON_KEY || "YOUR_PUBLIC_ANON_KEY";

  function baseUrl() {
    return SUPABASE_URL.replace(/\/$/, "");
  }

  function isConfigured() {
    return (
      !/YOUR_PROJECT|YOUR_PUBLIC|REPLACE/i.test(SUPABASE_URL + SUPABASE_ANON_KEY) &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL.trim()) &&
      SUPABASE_ANON_KEY.trim().length > 30
    );
  }

  function headers(extra) {
    var h = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) {
        h[k] = extra[k];
      });
    }
    return h;
  }

  function rest(path, opts) {
    return fetch(baseUrl() + "/rest/v1/" + path, opts).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (txt) {
          var err = new Error(res.status + " " + (txt || res.statusText));
          err.status = res.status;
          throw err;
        });
      }
      if (res.status === 204) return null;
      return res.json();
    });
  }

  function rowToSession(row) {
    return {
      id: row.id,
      date: row.date,
      workoutName: row.workout_name,
      roundCount: row.round_count || null,
      exercises: row.exercises || [],
      participants: row.participants || {},
    };
  }

  function sessionToRow(session) {
    return {
      id: session.id,
      date: session.date,
      workout_name: session.workoutName,
      round_count: session.roundCount || null,
      exercises: session.exercises || [],
      participants: session.participants || {},
      updated_at: new Date().toISOString(),
    };
  }

  function fetchAll() {
    if (!isConfigured()) {
      return Promise.resolve(null);
    }
    return Promise.all([
      rest("cycle_sessions?select=*&order=date.desc", { headers: headers() }),
      rest("cycle_users?select=*", { headers: headers() }),
    ]).then(function (parts) {
      var sessions = (parts[0] || []).map(rowToSession);
      var users = (parts[1] || []).map(function (row) {
        return { slug: row.slug, name: row.name, pin: row.pin };
      });
      return { sessions: sessions, users: users };
    });
  }

  function upsertSession(session) {
    if (!isConfigured()) return Promise.resolve(session);
    return rest("cycle_sessions?on_conflict=id", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(sessionToRow(session)),
    }).then(function (rows) {
      return rows && rows[0] ? rowToSession(rows[0]) : session;
    });
  }

  function deleteSessionByDate(date) {
    if (!isConfigured()) return Promise.resolve();
    return rest("cycle_sessions?date=eq." + encodeURIComponent(date), {
      method: "DELETE",
      headers: headers({ Prefer: "return=minimal" }),
    });
  }

  function upsertUser(user) {
    if (!isConfigured()) return Promise.resolve(user);
    return rest("cycle_users?on_conflict=slug", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({
        slug: user.slug,
        name: user.name,
        pin: user.pin,
      }),
    }).then(function () {
      return user;
    });
  }

  window.fcCycleSupabase = {
    isConfigured: isConfigured,
    fetchAll: fetchAll,
    upsertSession: upsertSession,
    deleteSessionByDate: deleteSessionByDate,
    upsertUser: upsertUser,
  };
})();
