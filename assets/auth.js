/* Shared Supabase auth helpers for gogogo.social */
(function (global) {
  var SUPABASE_URL = "https://agpysewcsakdpmpftndp.supabase.co";
  var SUPABASE_KEY = "sb_publishable_xd3b3JYejCTc4zXaDmT6Qw_jYaLWCTQ";
  /* WhatsApp-Nummer ersetzen, sobald live */
  var WHATSAPP_NUMBER = "490000000000";
  var APP_URL = "/app/";

  var client = null;

  function getClient() {
    if (!client) {
      if (!global.supabase || !global.supabase.createClient) {
        throw new Error("Supabase SDK fehlt");
      }
      client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return client;
  }

  function waLink(text) {
    var n = String(WHATSAPP_NUMBER).replace(/\D/g, "");
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(text || "");
  }

  async function getSession() {
    var res = await getClient().auth.getSession();
    return res.data && res.data.session ? res.data.session : null;
  }

  async function requireSession(redirectTo) {
    var session = await getSession();
    if (!session) {
      window.location.replace(redirectTo || "/?auth=1");
      return null;
    }
    return session;
  }

  async function signUp(payload) {
    var sb = getClient();
    var email = payload.email.trim();
    var password = payload.password;
    var first = payload.firstName.trim();
    var last = payload.lastName.trim();
    var phone = payload.phone.trim();
    var contactPref = (payload.contactPref || "").trim();
    var origin = window.location.origin;

    var authRes = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: origin + "/members/",
        data: {
          first_name: first,
          last_name: last,
          phone: phone,
          contact_pref: contactPref,
        },
      },
    });
    if (authRes.error) throw authRes.error;

    var user = authRes.data && authRes.data.user;
    /* Profil legt der DB-Trigger handle_new_member an.
       Falls Session schon da ist, profil nachziehen. */
    if (user && user.id && authRes.data.session) {
      await sb.from("member_profiles").upsert({
        id: user.id,
        first_name: first,
        last_name: last,
        email: email,
        phone: phone,
        contact_pref: contactPref || null,
        privacy_accepted_at: new Date().toISOString(),
      });
    }

    return authRes.data;
  }

  async function signIn(email, password) {
    var res = await getClient().auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });
    if (res.error) throw res.error;
    return res.data;
  }

  async function signOut() {
    await getClient().auth.signOut();
  }

  function openWhatsAppAfterSignup(firstName, contactPref) {
    var name = firstName || "";
    var pref = contactPref || "noch offen";
    var msg =
      "Hi Joscha, ich habe mich bei gogogo.social angemeldet. Ich bin " +
      name +
      ". Kontaktwunsch: " +
      pref +
      ".";
    window.open(waLink(msg), "_blank", "noopener");
  }

  global.GogogoAuth = {
    SUPABASE_URL: SUPABASE_URL,
    APP_URL: APP_URL,
    WHATSAPP_NUMBER: WHATSAPP_NUMBER,
    getClient: getClient,
    getSession: getSession,
    requireSession: requireSession,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    waLink: waLink,
    openWhatsAppAfterSignup: openWhatsAppAfterSignup,
  };
})(window);
