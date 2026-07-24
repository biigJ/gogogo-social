/* Shared Supabase auth helpers for gogogo.social */
(function (global) {
  var SUPABASE_URL = "https://agpysewcsakdpmpftndp.supabase.co";
  var SUPABASE_KEY = "sb_publishable_xd3b3JYejCTc4zXaDmT6Qw_jYaLWCTQ";
  /* Immer Produktion — nie localhost in Auth-Mails */
  var SITE_URL = "https://gogogo.social";
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

    var authRes = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: SITE_URL + "/members/",
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

    /* Keine Identitäten / leere user-Liste: Email existiert schon (Confirm an) */
    if (
      user &&
      Array.isArray(user.identities) &&
      user.identities.length === 0
    ) {
      var dup = new Error("user already registered");
      dup.code = "user_already_registered";
      throw dup;
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

  async function resetPassword(email) {
    var res = await getClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: SITE_URL + "/?auth=1",
    });
    if (res.error) throw res.error;
    return true;
  }

  async function resendConfirmation(email) {
    var res = await getClient().auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: SITE_URL + "/members/" },
    });
    if (res.error) throw res.error;
    return true;
  }

  function authErrorMessage(err) {
    var raw = (err && (err.message || err.error_description || err.msg)) || "";
    var code = (err && (err.code || err.error)) || "";
    var status = err && err.status;
    var text = String(raw).toLowerCase();

    if (
      text.indexOf("already been confirmed") !== -1 ||
      text.indexOf("already confirmed") !== -1 ||
      text.indexOf("email address already confirmed") !== -1
    ) {
      return "Diese Email ist schon bestätigt. Bitte einfach einloggen — keine neue Mail nötig.";
    }
    if (
      text.indexOf("email not confirmed") !== -1 ||
      code === "email_not_confirmed"
    ) {
      return "Email noch nicht bestätigt. Inbox und Spam prüfen, oder in Supabase unter Authentication → Users manuell bestätigen.";
    }
    if (
      text.indexOf("rate limit") !== -1 ||
      text.indexOf("over_email_send_rate_limit") !== -1 ||
      code === "over_email_send_rate_limit" ||
      status === 429
    ) {
      return "Zu viele Emails in kurzer Zeit. Bitte 1–2 Minuten warten, Spam prüfen — oder in Supabase den User manuell bestätigen.";
    }
    if (
      text.indexOf("invalid login credentials") !== -1 ||
      text.indexOf("invalid_credentials") !== -1 ||
      code === "invalid_credentials"
    ) {
      return "Email oder Passwort stimmen nicht. Neu über „Mitglied“ registriert und Email bestätigt? Sonst Passwort zurücksetzen.";
    }
    if (
      text.indexOf("user already registered") !== -1 ||
      code === "user_already_registered"
    ) {
      return "Diese Email ist schon registriert. Bitte einloggen — oder Passwort zurücksetzen, falls Du Dich nicht erinnerst.";
    }
    if (text.indexOf("password") !== -1 && text.indexOf("least") !== -1) {
      return "Passwort zu kurz (mindestens 6–8 Zeichen).";
    }
    return raw || "Etwas ist schiefgelaufen. Bitte noch einmal versuchen.";
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
    SITE_URL: SITE_URL,
    APP_URL: APP_URL,
    WHATSAPP_NUMBER: WHATSAPP_NUMBER,
    getClient: getClient,
    getSession: getSession,
    requireSession: requireSession,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resetPassword: resetPassword,
    resendConfirmation: resendConfirmation,
    authErrorMessage: authErrorMessage,
    waLink: waLink,
    openWhatsAppAfterSignup: openWhatsAppAfterSignup,
  };
})(window);
