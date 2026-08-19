(function (global) {
  var ACCOUNT_KEY = "gogogo_go_account";
  var COOKIE_NAME = "gogogo_go_account";
  var MAX_AGE = 60 * 60 * 24 * 400;

  function slimAccount(account) {
    if (!account || !account.name) return null;
    var slim = {
      id: account.id || null,
      name: account.name,
      phone: account.phone || null,
      invite_code: account.invite_code || null,
      serial_number: account.serial_number || null,
      created_at: account.created_at || null
    };
    if (account.is_trainer) slim.is_trainer = true;
    if (account.trainer_id) slim.trainer_id = account.trainer_id;
    if (account.training_date) slim.training_date = account.training_date;
    return slim;
  }

  function writeCookie(account) {
    var slim = slimAccount(account);
    if (!slim) return;
    var raw = encodeURIComponent(JSON.stringify(slim));
    if (raw.length > 3500) {
      delete slim.photo_url;
      raw = encodeURIComponent(JSON.stringify(slim));
    }
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      COOKIE_NAME + "=" + raw + "; Path=/; Max-Age=" + MAX_AGE + "; SameSite=Lax" + secure;
  }

  function readCookie() {
    var parts = String(document.cookie || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(COOKIE_NAME + "=") !== 0) continue;
      try {
        return JSON.parse(decodeURIComponent(p.slice(COOKIE_NAME.length + 1)));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function loadAccount() {
    var local = null;
    try {
      local = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null");
    } catch (e) {
      local = null;
    }
    if (local && local.name) {
      writeCookie(local);
      return local;
    }
    var fromCookie = readCookie();
    if (fromCookie && fromCookie.name) {
      try {
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(fromCookie));
      } catch (e2) {}
      return fromCookie;
    }
    return null;
  }

  function saveAccount(account) {
    if (!account || !account.name) return;
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    } catch (e) {}
    writeCookie(account);
  }

  function clearAccount() {
    try {
      localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) {}
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = COOKIE_NAME + "=; Path=/; Max-Age=0; SameSite=Lax" + secure;
  }

  function requestPersist() {
    try {
      if (navigator.storage && typeof navigator.storage.persist === "function") {
        navigator.storage.persist().catch(function () {});
      }
    } catch (e) {}
  }

  global.GoAccountSession = {
    KEY: ACCOUNT_KEY,
    load: loadAccount,
    save: saveAccount,
    clear: clearAccount,
    persist: requestPersist
  };
})(window);
