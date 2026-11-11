/* Zirkeltraining aus der FFC-App (Friday Fitness Circle), eingebettet in gogogo. */
(function(){
  // ---------- Supabase ----------
  const SUPABASE_URL = 'https://uxijbecqklzwxbpvsglh.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aWpiZWNxa2x6d3hicHZzZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NTY0ODksImV4cCI6MjA5OTMzMjQ4OX0.v-wxlru3EUJcFimaFD37rquZtcIJsIu0rO7gmJR2GBc';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  function host(fn){
    const h = window.FFC_HOST;
    if(!h || typeof h[fn] !== 'function') return;
    try{ return h[fn].apply(h, Array.prototype.slice.call(arguments, 1)); }catch(e){ console.error(e); }
  }

  // ---------- exercise list (offizielle Hyrox-Stationen + Laufen) ----------
  const exercises = [
    {id:'run',      name:'Laufen',              unit:'Meter'},
    {id:'skierg',   name:'SkiErg',              unit:'Meter'},
    {id:'sledpush', name:'Sled Push',           unit:'Meter'},
    {id:'sledpull', name:'Sled Pull',           unit:'Meter'},
    {id:'sledhybrid', name:'Sled Hybrid',       unit:'Meter'},
    {id:'burpee',   name:'Burpee Broad Jumps',  unit:'Meter'},
    {id:'row',      name:'Rudern',              unit:'Meter'},
    {id:'assaultbike', name:'Assault Bike',     unit:'Kalorien'},
    {id:'farmers',  name:'Farmers Carry',       unit:'Meter'},
    {id:'lunges',   name:'Sandbag Lunges',      unit:'Meter'},
    {id:'wallballs',name:'Wall Balls',          unit:'Wiederholungen'}
  ];

  // ---------- Punktesystem (gleiche Formel wie supabase/punkte.sql!) ----------
  // 100 Punkte = Tempo der Hyrox-Elite (Median der 15 besten Pro-Leistungen, Wettkampf-Splits).
  // dist = Stationslänge (bzw. Wiederholungen), m/f = Elite-Zeit in Sekunden für Männer/Frauen.
  const POINT_REFS = {
    run:       {dist:1000, m:231, f:258},
    skierg:    {dist:1000, m:227, f:252},
    sledpush:  {dist:50,   m:165, f:180},
    sledpull:  {dist:50,   m:194, f:234},
    sledhybrid:{dist:50,   m:180, f:207},   // Schätzung: Mittel aus Sled Push & Sled Pull
    burpee:    {dist:80,   m:141, f:191},
    row:       {dist:1000, m:238, f:269},
    assaultbike:{dist:50,  m:110, f:140},   // Schätzung: 50 Kalorien in ca. 1:50 / 2:20 (Elite)
    farmers:   {dist:200,  m:97,  f:117},
    lunges:    {dist:100,  m:183, f:215},
    wallballs: {dist:100,  m:265, f:230}
  };
  const POINTS_MAX = 150;      // Deckel gegen Tippfehler
  const POINTS_EXP = 0.943;    // Riegel-Exponent (1/1,06): kürzere Runden = etwas höheres Tempo möglich
  let myGender = null;         // aus dem Profil, für die Frauen-/Männer-Referenz

  function roundPoints(exId, amount, workSecs, gender){
    const ref = POINT_REFS[exId];
    const a = parseFloat(amount), t = Number(workSecs);
    if(!ref || !(a > 0) || !(t > 0)) return 0;
    const eliteSec = gender === 'female' ? ref.f : ref.m;
    const refAmount = ref.dist * Math.pow(t / eliteSec, POINTS_EXP);
    return Math.min(POINTS_MAX, Math.round(100 * a / refAmount));
  }
  function sessionPoints(entries, workSecs, gender){
    return (entries||[]).reduce((sum, e)=> sum + (e && e.exercise ? roundPoints(e.exercise, e.amount, workSecs, gender) : 0), 0);
  }
  // Lädt Geschlecht (für Punkte), Nickname (Begrüßung) und Profilbild (Tab-Leiste)
  async function loadMyGender(){
    if(!currentUser) return;
    const { data, error } = await sb.from('profiles').select('*').eq('user_id', currentUser.id).maybeSingle();
    if(!error){
      myGender = data ? (data.gender || null) : null;
      setHomeName(data && data.nickname);
      setTabAvatar(data && data.avatar_url);
    }
    host('onProfile', error ? null : (data || {}), currentUser);
  }
  function setHomeName(nick){
    const fallback = currentUser && currentUser.email ? currentUser.email.split('@')[0] : 'Athlet';
    document.getElementById('homeName').textContent = nick || fallback;
  }
  const TAB_AVATAR_DEFAULT = document.getElementById('tabAvatar').innerHTML;
  let myStoryAvatar = null;
  function setTabAvatar(url){
    myStoryAvatar = url || null;
    const el = document.getElementById('tabAvatar');
    if(url){
      el.innerHTML = '<img src="'+esc(url)+'" alt="">';
      el.querySelector('img').onerror = ()=>{ el.innerHTML = TAB_AVATAR_DEFAULT; };
    } else {
      el.innerHTML = TAB_AVATAR_DEFAULT;
    }
  }

  const exerciseSelect = document.getElementById('exerciseSelect');
  exercises.forEach(ex=>{
    const o = document.createElement('option');
    o.value = ex.id;
    o.textContent = ex.name;
    exerciseSelect.appendChild(o);
  });

  // ---------- Übungs-Icons: fetter Piktogramm-Stil, an Referenzbild angelehnt, eigenständig gezeichnet ----------
  const exerciseIcons = {
    run:
      '<path d="M2 9 L7 9 M2 13 L6 13" stroke-width="2"/>' +
      '<circle cx="16" cy="5" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M16 8 L18 13 M18 13 L14 14 L16 19 M18 13 L23 19 M16 9 L12 8 L10 10 M16 9 L20 11"/>',
    skierg:
      '<line x1="20" y1="2" x2="20" y2="16"/>' +
      '<rect x="17" y="15" width="6" height="2" rx="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="10" cy="5" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M10 8 L13 14 M13 14 L11 20 M13 14 L16 19 M10 9 L15 6 M10 9 L15 11"/>',
    sledpush:
      '<circle cx="6" cy="9" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M8 12 L12 18 M12 18 L9 22 M12 18 L14 21 M8 12 L17 11"/>' +
      '<line x1="18" y1="6" x2="18" y2="14"/>' +
      '<rect x="15" y="14" width="8" height="4" rx="1" fill="currentColor" stroke="none"/>' +
      '<rect x="17" y="11" width="4" height="2" rx="0.6" fill="currentColor" stroke="none"/>',
    sledpull:
      '<circle cx="6" cy="9" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M8 12 L11 18 M11 18 L8 22 M11 18 L13 21 M8 12 L4 10"/>' +
      '<path d="M4 10 L19 13"/>' +
      '<line x1="19" y1="6" x2="19" y2="13"/>' +
      '<rect x="17" y="13" width="6" height="3" rx="1" fill="currentColor" stroke="none"/>' +
      '<rect x="18" y="11" width="4" height="2" rx="0.6" fill="currentColor" stroke="none"/>',
    sledhybrid:
      '<circle cx="7" cy="7" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M8.5 10 L11 16 M11 16 L8 21 M11 16 L13.5 20 M8.5 10 L16 10"/>' +
      '<rect x="15" y="12" width="8" height="4" rx="1" fill="currentColor" stroke="none"/>' +
      '<path d="M15 4 L21 4 M19 2 L21 4 L19 6 M21 8 L15 8 M17 6 L15 8 L17 10" stroke-width="1.6"/>',
    burpee:
      '<circle cx="17" cy="10" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M15 12 L7 15 M15 12 L19 15 L21 17 M7 15 L2 13 M7 15 L4 17"/>',
    row:
      '<line x1="2" y1="20" x2="21" y2="20"/>' +
      '<rect x="5" y="17" width="4" height="2" rx="0.6" fill="currentColor" stroke="none"/>' +
      '<circle cx="20" cy="15" r="2.6"/><circle cx="20" cy="15" r="1" fill="currentColor" stroke="none"/>' +
      '<circle cx="13" cy="7" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M13 10 L9 14 M9 14 L12 17 M12 17 L16 16 M13 10 L18 12"/>',
    assaultbike:
      '<circle cx="5.5" cy="17" r="3.5"/>' +
      '<circle cx="18.5" cy="17" r="3.5"/>' +
      '<path d="M5.5 17 L10 10 L15 10 L18.5 17 M10 10 L12 17 L15 10 M8.5 7 L11.5 7 M10 7 L10 10 M15 10 L16.5 5 L19 5"/>',
    farmers:
      '<circle cx="12" cy="4" r="3" fill="currentColor" stroke="none"/>' +
      '<path d="M12 7 L12 15 M12 15 L9 22 M12 15 L15 22 M12 9 L7 15 M12 9 L17 15"/>' +
      '<circle cx="7" cy="17" r="2.2" fill="currentColor" stroke="none"/>' +
      '<rect x="5.5" y="14" width="3" height="1.8" rx="0.6" fill="currentColor" stroke="none"/>' +
      '<circle cx="17" cy="17" r="2.2" fill="currentColor" stroke="none"/>' +
      '<rect x="15.5" y="14" width="3" height="1.8" rx="0.6" fill="currentColor" stroke="none"/>',
    lunges:
      '<circle cx="9" cy="7" r="2.6" fill="currentColor" stroke="none"/>' +
      '<ellipse cx="12" cy="5" rx="3.2" ry="2.4" fill="currentColor" stroke="none"/>' +
      '<path d="M9 9.5 L9 15 M9 15 L12 18 L12 21 M9 15 L6 19 L8 22 M9 10 L12 8"/>',
    wallballs:
      '<line x1="19" y1="2" x2="19" y2="22"/>' +
      '<circle cx="11" cy="3" r="2.4" fill="currentColor" stroke="none"/>' +
      '<circle cx="9" cy="8" r="2.6" fill="currentColor" stroke="none"/>' +
      '<path d="M9 10.5 L9 15 M9 15 L6 18 L6 21 M9 15 L12 18 L12 21 M9 11 L11 6 M9 11 L6 10"/>'
  };
  function iconSvg(exId, size){
    const inner = exerciseIcons[exId];
    if(!inner) return '';
    return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';
  }
  const trashIconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6M14 11v6"/></svg>';

  // ---------- screens ----------
  const screens = {
    auth: document.getElementById('auth'),
    home: document.getElementById('home'),
    setup: document.getElementById('setup'),
    run: document.getElementById('run'),
    finish: document.getElementById('finish'),
    connect: document.getElementById('connect'),
    records: document.getElementById('records'),
    profile: document.getElementById('profile'),
    leaderboard: document.getElementById('leaderboard'),
    newpass: document.getElementById('newpass'),
    knowledge: document.getElementById('knowledge')
  };
  // Welcher Bildschirm gehört zu welchem Punkt in der unteren Leiste (ohne Eintrag = Leiste ausgeblendet)
  const TAB_OF = { home:'home', connect:'connect', leaderboard:'training', records:'training', knowledge:'training', profile:'profile' };
  const tabbarEl = document.getElementById('tabbar');
  let lastTrainingSub = 'leaderboard';

  function showScreen(name){
    Object.values(screens).forEach(el=> el.classList.remove('active'));
    screens[name].classList.add('active');
    const tab = TAB_OF[name];
    document.body.classList.toggle('has-tabbar', !!tab);
    document.body.classList.toggle('on-run', name === 'run');
    tabbarEl.querySelectorAll('[data-tab]').forEach(b=> b.classList.toggle('active', b.dataset.tab === tab));
    if(tab === 'training') lastTrainingSub = name;
    document.getElementById('appScroll').scrollTop = 0;
    if(name === 'home' && typeof loadHomeEvents === 'function') loadHomeEvents();
    host('onScreen', name);
  }

  // ---------- Auth ----------
  let currentUser = null;
  let authMode = 'login'; // 'login', 'register' oder 'reset' (Passwort vergessen)
  // Kommt man über den Link aus der "Passwort zurücksetzen"-Mail, steht type=recovery in der Adresse
  let recoveryMode = /type=recovery/.test(location.hash);

  const authEmailEl = document.getElementById('authEmail');
  const authPasswordEl = document.getElementById('authPassword');
  const authErrorEl = document.getElementById('authError');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const authForgotBtn = document.getElementById('authForgotBtn');
  const authTaglineEl = document.getElementById('authTagline');

  function setAuthMode(mode){
    authMode = mode;
    authErrorEl.style.color = '';
    authErrorEl.textContent = '';
    authPasswordEl.style.display = mode === 'reset' ? 'none' : '';
    authForgotBtn.style.display = mode === 'login' ? '' : 'none';
    if(mode === 'login'){
      authSubmitBtn.textContent = 'Anmelden';
      authToggleBtn.textContent = 'Noch keinen Account? Registrieren';
      authTaglineEl.textContent = 'Anmelden, um dein Training zu speichern';
    } else if(mode === 'register'){
      authSubmitBtn.textContent = 'Registrieren';
      authToggleBtn.textContent = 'Schon einen Account? Anmelden';
      authTaglineEl.textContent = 'Account erstellen, um dein Training zu speichern';
    } else {
      authSubmitBtn.textContent = 'Link zum Zurücksetzen senden';
      authToggleBtn.textContent = '← Zurück zur Anmeldung';
      authTaglineEl.textContent = 'Gib deine E-Mail ein – wir schicken dir einen Link für ein neues Passwort';
    }
  }
  authForgotBtn.addEventListener('click', ()=>{
    setAuthMode('reset');
    authEmailEl.focus();
  });

  async function sendResetMail(email){
    // Der Link in der Mail führt zurück auf genau diese Seite (Netlify/Vercel-Adresse)
    const redirectTo = location.origin + location.pathname;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if(error){
      authErrorEl.textContent = /rate limit|too many|security purposes/i.test(error.message)
        ? 'Zu viele Anfragen – bitte warte ein paar Minuten und versuch es dann nochmal.'
        : 'Senden fehlgeschlagen: ' + friendlyAuthError(error);
      return;
    }
    authErrorEl.style.color = 'var(--chalk)';
    authErrorEl.textContent = 'Wenn es zu dieser E-Mail einen Account gibt, ist jetzt ein Link zum Zurücksetzen unterwegs. Schau auch im Spam-Ordner nach.';
  }

  // ---------- Neues Passwort setzen ----------
  const newPass1El = document.getElementById('newPass1');
  const newPass2El = document.getElementById('newPass2');
  const newPassBtn = document.getElementById('newPassBtn');
  const newPassStatus = document.getElementById('newPassStatus');

  function showNewPassScreen(){
    newPass1El.value = '';
    newPass2El.value = '';
    newPassStatus.textContent = '';
    showScreen('newpass');
  }

  newPassBtn.addEventListener('click', async ()=>{
    const p1 = newPass1El.value, p2 = newPass2El.value;
    newPassStatus.style.color = '';
    if(p1.length < 6){ newPassStatus.textContent = 'Das Passwort muss mindestens 6 Zeichen haben.'; return; }
    if(p1 !== p2){ newPassStatus.textContent = 'Die beiden Passwörter stimmen nicht überein.'; return; }
    newPassBtn.disabled = true;
    const { error } = await sb.auth.updateUser({ password: p1 });
    newPassBtn.disabled = false;
    if(error){
      newPassStatus.textContent = /same|different from the old/i.test(error.message)
        ? 'Das neue Passwort muss sich vom alten unterscheiden.'
        : /expired|invalid|session/i.test(error.message)
          ? 'Der Link ist abgelaufen. Bitte fordere auf der Anmeldeseite einen neuen an.'
          : 'Nicht gespeichert: ' + friendlyAuthError(error);
      return;
    }
    recoveryMode = false;
    history.replaceState(null, '', location.pathname);   // Token aus der Adresszeile entfernen
    newPassStatus.style.color = 'var(--chalk)';
    newPassStatus.textContent = 'Passwort geändert – du bist angemeldet.';
    setTimeout(()=> showScreen('home'), 1200);
  });

  function friendlyAuthError(err){
    const msg = (err && err.message) || String(err);
    if(/failed to fetch|networkerror|load failed/i.test(msg)){
      return 'Verbindung zu Supabase fehlgeschlagen. Öffne die Datei in einem echten Browser-Tab (nicht in der Chat-Vorschau) und prüfe deine Internetverbindung.';
    }
    if(/invalid login credentials/i.test(msg)){
      return 'E-Mail oder Passwort ist falsch.';
    }
    if(/user already registered|already registered/i.test(msg)){
      return 'Für diese E-Mail existiert bereits ein Account. Bitte anmelden.';
    }
    if(/password should be at least/i.test(msg)){
      return 'Das Passwort ist zu kurz (mind. 6 Zeichen).';
    }
    return msg;
  }

  authToggleBtn.addEventListener('click', ()=>{
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });

  authSubmitBtn.addEventListener('click', async ()=>{
    const email = authEmailEl.value.trim();
    const password = authPasswordEl.value;
    authErrorEl.style.color = '';
    authErrorEl.textContent = '';

    if(authMode === 'reset'){
      if(!email){ authErrorEl.textContent = 'Bitte gib deine E-Mail-Adresse ein.'; return; }
      authSubmitBtn.disabled = true;
      try{ await sendResetMail(email); }
      catch(err){ authErrorEl.textContent = 'Senden fehlgeschlagen: ' + friendlyAuthError(err); }
      finally{ authSubmitBtn.disabled = false; }
      return;
    }

    if(!email || !password){
      authErrorEl.textContent = 'Bitte E-Mail und Passwort eingeben.';
      return;
    }

    authSubmitBtn.disabled = true;
    try{
      if(authMode === 'login'){
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if(error){ authErrorEl.textContent = 'Anmeldung fehlgeschlagen: ' + friendlyAuthError(error); }
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if(error){
          authErrorEl.textContent = 'Registrierung fehlgeschlagen: ' + friendlyAuthError(error);
        } else if(data && data.user && !data.session){
          authErrorEl.style.color = 'var(--chalk)';
          authErrorEl.textContent = 'Fast geschafft! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.';
        }
      }
    } catch(err){
      authErrorEl.textContent = 'Registrierung fehlgeschlagen: ' + friendlyAuthError(err);
    } finally {
      authSubmitBtn.disabled = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    await sb.auth.signOut();
    currentUser = null;
    cachedHistory = [];
    setAuthMode('login');
    showScreen('auth');
  });

  sb.auth.onAuthStateChange((event, session)=>{
    if(event === 'PASSWORD_RECOVERY'){
      // Nutzer kommt über den Link aus der Mail → neues Passwort abfragen
      recoveryMode = true;
      if(session && session.user) currentUser = session.user;
      showNewPassScreen();
      return;
    }
    if(session && session.user){
      currentUser = session.user;
      if(recoveryMode){ showNewPassScreen(); return; }
      // Nur vom Login-Bildschirm aus zur Startseite springen – sonst würde z. B. ein
      // automatisches Token-Refresh mitten im Workout zur Startseite zurückwerfen.
      if(screens.auth.classList.contains('active')){
        authEmailEl.value = '';
        authPasswordEl.value = '';
        setAuthMode('login');
        showScreen('home');
      }
      loadMyGender();
      handleEventDeepLink();
      host('onAuth', currentUser);
    } else {
      currentUser = null;
      cachedHistory = [];
      showScreen('auth');
      host('onAuth', null);
    }
  });

  (async function initAuth(){
    // Abgelaufener oder schon benutzter Link aus der Mail
    const hashParams = new URLSearchParams(location.hash.slice(1));
    if(hashParams.get('error_code') || hashParams.get('error_description')){
      history.replaceState(null, '', location.pathname);
      setAuthMode('reset');
      authErrorEl.textContent = hashParams.get('error_code') === 'otp_expired'
        ? 'Der Link ist abgelaufen oder wurde schon benutzt. Fordere hier einfach einen neuen an.'
        : 'Der Link funktioniert nicht mehr. Fordere hier einfach einen neuen an.';
    }
    const { data } = await sb.auth.getSession();
    if(recoveryMode){
      if(data && data.session && data.session.user){
        currentUser = data.session.user;
        showNewPassScreen();
      }
      return;
    }
    if(data && data.session && data.session.user){
      currentUser = data.session.user;
      if(screens.auth.classList.contains('active')) showScreen('home');
      loadMyGender();
      handleEventDeepLink();
      host('onAuth', currentUser);
    } else {
      showScreen('auth');
      host('onAuth', null);
    }
  })();

  // ---------- Profil ----------
  const profileNicknameEl = document.getElementById('profileNickname');
  const NICKNAME_RE = /^[A-Za-z0-9._-]{3,20}$/;
  const profileBirthdateEl = document.getElementById('profileBirthdate');
  const profileWeightEl = document.getElementById('profileWeight');
  const profileGenderEl = document.getElementById('profileGender');
  const profileAgeValEl = document.getElementById('profileAgeVal');
  const profileStatusEl = document.getElementById('profileStatus');
  const saveProfileBtn = document.getElementById('saveProfileBtn');

  function calcAge(birthDateStr){
    if(!birthDateStr) return null;
    const b = new Date(birthDateStr+'T00:00:00');
    if(isNaN(b.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if(m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age >= 0 ? age : null;
  }

  function updateAgeDisplay(){
    const age = calcAge(profileBirthdateEl.value);
    profileAgeValEl.textContent = age !== null ? age+' Jahre' : '';
  }
  profileBirthdateEl.addEventListener('change', updateAgeDisplay);

  // ---------- Profilbild (Supabase Storage, Bucket "avatars", siehe supabase/profilbild.sql) ----------
  const AVATAR_SIZE = 320;   // Pixel – wird quadratisch zugeschnitten
  const profileAvatarEl = document.getElementById('profileAvatar');
  const avatarInputEl = document.getElementById('avatarInput');
  const avatarRemoveBtn = document.getElementById('avatarRemoveBtn');
  const avatarStatusEl = document.getElementById('avatarStatus');
  let myAvatarUrl = null;

  function avatarHtml(url, name){
    if(url) return '<img src="'+esc(url)+'" alt="" loading="lazy" onerror="this.remove()">';
    const initial = (String(name||'').trim()[0] || '?');
    return esc(initial);
  }
  function renderMyAvatar(){
    profileAvatarEl.innerHTML = avatarHtml(myAvatarUrl, profileNicknameEl.value || (currentUser && currentUser.email));
    avatarRemoveBtn.style.display = myAvatarUrl ? '' : 'none';
  }
  function setAvatarStatus(text, kind){
    avatarStatusEl.style.color = kind==='ok' ? 'var(--chalk)' : kind==='err' ? 'var(--danger)' : 'var(--text-dim)';
    avatarStatusEl.textContent = text;
  }

  // Bild laden, mittig quadratisch zuschneiden und als JPEG verkleinern
  function resizeImage(file){
    return new Promise((resolve, reject)=>{
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = AVATAR_SIZE;
        canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        URL.revokeObjectURL(url);
        canvas.toBlob(b=> b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.')), 'image/jpeg', 0.85);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('Dieses Bildformat wird nicht unterstützt. Bitte ein JPG oder PNG wählen.')); };
      img.src = url;
    });
  }

  function avatarErrorText(err){
    const m = (err && err.message) || String(err);
    if(/bucket not found|not found/i.test(m)) return 'Profilbilder sind noch nicht eingerichtet – bitte supabase/profilbild.sql in Supabase ausführen.';
    if(/row-level security|unauthorized|policy/i.test(m)) return 'Keine Berechtigung – bitte supabase/profilbild.sql in Supabase ausführen.';
    if(/avatar_url/i.test(m)) return 'Profilbilder sind noch nicht eingerichtet – bitte supabase/profilbild.sql in Supabase ausführen.';
    return friendlyAuthError(err);
  }

  profileAvatarEl.addEventListener('click', ()=> avatarInputEl.click());
  document.getElementById('avatarPickBtn').addEventListener('click', ()=> avatarInputEl.click());

  avatarInputEl.addEventListener('change', async ()=>{
    const file = avatarInputEl.files && avatarInputEl.files[0];
    avatarInputEl.value = '';
    if(!file || !currentUser) return;
    try{
      setAvatarStatus('Wird hochgeladen …');
      const blob = await resizeImage(file);
      const path = currentUser.id + '/avatar.jpg';
      const up = await sb.storage.from('avatars').upload(path, blob, { upsert:true, contentType:'image/jpeg', cacheControl:'3600' });
      if(up.error) throw up.error;
      // ?v=… sorgt dafür, dass Handys nicht das alte Bild aus dem Zwischenspeicher zeigen
      const publicUrl = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
      const { error } = await sb.from('profiles').upsert({ user_id: currentUser.id, avatar_url: publicUrl }, { onConflict:'user_id' });
      if(error) throw error;
      myAvatarUrl = publicUrl;
      renderMyAvatar();
      setTabAvatar(publicUrl);
      setAvatarStatus('Profilbild gespeichert.', 'ok');
    } catch(err){
      setAvatarStatus(avatarErrorText(err), 'err');
    }
  });

  avatarRemoveBtn.addEventListener('click', async ()=>{
    if(!currentUser) return;
    if(avatarRemoveBtn.dataset.armed !== '1'){
      avatarRemoveBtn.dataset.armed = '1';
      avatarRemoveBtn.textContent = 'Sicher?';
      setTimeout(()=>{ avatarRemoveBtn.dataset.armed=''; avatarRemoveBtn.textContent='Entfernen'; }, 3000);
      return;
    }
    avatarRemoveBtn.dataset.armed = '';
    avatarRemoveBtn.textContent = 'Entfernen';
    setAvatarStatus('Wird entfernt …');
    await sb.storage.from('avatars').remove([currentUser.id + '/avatar.jpg']);
    const { error } = await sb.from('profiles').upsert({ user_id: currentUser.id, avatar_url: null }, { onConflict:'user_id' });
    if(error){ setAvatarStatus(avatarErrorText(error), 'err'); return; }
    myAvatarUrl = null;
    renderMyAvatar();
    setTabAvatar(null);
    setAvatarStatus('Profilbild entfernt.', 'ok');
  });

  // ---------- Instagram im Profil (Spalte profiles.instagram, siehe supabase/instagram.sql) ----------
  const instaBoxEl = document.getElementById('instaBox');
  let myInstagram = null;
  let instaEditing = false;
  const INSTA_RE = /^[A-Za-z0-9._]{1,30}$/;
  const pencilSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const linkSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>';

  // akzeptiert "name", "@name" oder einen kompletten Instagram-Link
  function parseInstagram(input){
    let v = String(input || '').trim();
    const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
    if(m) v = m[1];
    v = v.replace(/^@/, '').trim();
    return v;
  }

  function renderInsta(){
    if(instaEditing){
      instaBoxEl.className = 'insta-box editing';
      instaBoxEl.innerHTML =
        '<input type="text" id="instaInput" placeholder="@deinname" autocomplete="off" autocapitalize="off" spellcheck="false" value="'+esc(myInstagram ? '@'+myInstagram : '')+'">' +
        '<button class="insta-save" id="instaSave">OK</button>';
      const inp = document.getElementById('instaInput');
      inp.focus();
      inp.addEventListener('keydown', e=>{ if(e.key==='Enter') saveInstagram(); if(e.key==='Escape'){ instaEditing=false; renderInsta(); } });
      document.getElementById('instaSave').addEventListener('click', saveInstagram);
      return;
    }
    if(myInstagram){
      instaBoxEl.className = 'insta-box linked';
      instaBoxEl.innerHTML =
        '<a class="insta-link" href="https://www.instagram.com/'+encodeURIComponent(myInstagram)+'/" target="_blank" rel="noopener">' +
          '<span class="insta-label">Instagram</span><span class="insta-handle">@'+esc(myInstagram)+'</span></a>' +
        '<button class="insta-edit" id="instaEdit" aria-label="Instagram ändern">'+pencilSvg+'</button>';
      document.getElementById('instaEdit').addEventListener('click', ()=>{ instaEditing = true; renderInsta(); });
    } else {
      instaBoxEl.className = 'insta-box empty';
      instaBoxEl.innerHTML = '<button class="insta-connect" id="instaConnect">'+linkSvg+' Instagram verknüpfen</button>';
      document.getElementById('instaConnect').addEventListener('click', ()=>{ instaEditing = true; renderInsta(); });
    }
  }

  async function saveInstagram(){
    if(!currentUser) return;
    const handle = parseInstagram(document.getElementById('instaInput').value);
    if(handle && !INSTA_RE.test(handle)){
      setAvatarStatus('Ungültiger Instagram-Name (nur Buchstaben, Zahlen, Punkt und _).', 'err');
      return;
    }
    const { error } = await sb.from('profiles').upsert({ user_id: currentUser.id, instagram: handle || null }, { onConflict:'user_id' });
    if(error){
      setAvatarStatus(/instagram/i.test(error.message)
        ? 'Instagram ist noch nicht eingerichtet – bitte supabase/instagram.sql in Supabase ausführen.'
        : 'Nicht gespeichert: ' + friendlyAuthError(error), 'err');
      return;
    }
    myInstagram = handle || null;
    instaEditing = false;
    renderInsta();
    setAvatarStatus(myInstagram ? 'Instagram verknüpft.' : 'Instagram entfernt.', 'ok');
  }

  async function loadProfile(){
    instaEditing = false;
    myInstagram = null;
    profileStatusEl.style.color = '';
    profileStatusEl.textContent = '';
    setAvatarStatus('');
    myAvatarUrl = null;
    profileNicknameEl.value = '';
    profileBirthdateEl.value = '';
    profileWeightEl.value = '';
    profileGenderEl.value = '';
    updateAgeDisplay();
    if(!currentUser) return;

    const { data, error } = await sb.from('profiles').select('*').eq('user_id', currentUser.id).maybeSingle();
    if(error){
      profileStatusEl.style.color = 'var(--danger)';
      profileStatusEl.textContent = 'Fehler beim Laden: ' + error.message;
      return;
    }
    if(data){
      profileNicknameEl.value = data.nickname || '';
      profileBirthdateEl.value = data.birth_date || '';
      profileWeightEl.value = (data.weight_kg !== null && data.weight_kg !== undefined) ? data.weight_kg : '';
      profileGenderEl.value = data.gender || '';
      myAvatarUrl = data.avatar_url || null;
      myInstagram = data.instagram || null;
    }
    updateAgeDisplay();
    renderMyAvatar();
    renderInsta();
  }

  saveProfileBtn.addEventListener('click', async ()=>{
    if(!currentUser) return;
    const birthDate = profileBirthdateEl.value || null;
    const weightVal = profileWeightEl.value;
    const weight = weightVal === '' ? null : parseFloat(weightVal);
    const gender = profileGenderEl.value || null;
    const nickname = profileNicknameEl.value.trim();

    if(nickname && !NICKNAME_RE.test(nickname)){
      profileStatusEl.style.color = 'var(--danger)';
      profileStatusEl.textContent = 'Nickname: 3–20 Zeichen, nur Buchstaben, Zahlen, Punkt, _ und -.';
      return;
    }

    saveProfileBtn.disabled = true;
    profileStatusEl.style.color = 'var(--text-dim)';
    profileStatusEl.textContent = 'Wird gespeichert …';

    const row = {
      user_id: currentUser.id,
      birth_date: birthDate,
      weight_kg: weight,
      gender: gender
    };
    // Nickname nur mitschicken, wenn einer eingetragen ist – so funktioniert das Profil
    // auch noch, bevor leaderboard.sql in Supabase ausgeführt wurde.
    if(nickname) row.nickname = nickname;

    const { error } = await sb.from('profiles').upsert(row, { onConflict:'user_id' });

    saveProfileBtn.disabled = false;
    if(!error){ myGender = gender; if(nickname) setHomeName(nickname); }
    if(error){
      profileStatusEl.style.color = 'var(--danger)';
      if(error.code === '23505'){
        profileStatusEl.textContent = 'Dieser Nickname ist schon vergeben.';
      } else if(/nickname/i.test(error.message)){
        profileStatusEl.textContent = 'Nickname kann noch nicht gespeichert werden – bitte zuerst supabase/leaderboard.sql in Supabase ausführen.';
      } else {
        profileStatusEl.textContent = 'Nicht gespeichert: ' + error.message;
      }
    } else {
      profileStatusEl.style.color = 'var(--chalk)';
      profileStatusEl.textContent = 'Profil gespeichert.';
    }
  });

  document.getElementById('goSetupBtn').addEventListener('click', async ()=>{
    await refreshCachedHistory();
    buildExercisePlan();
    showScreen('setup');
  });
  document.getElementById('backFromSetup').addEventListener('click', ()=> showScreen('home'));
  document.getElementById('finishToHome').addEventListener('click', ()=> showScreen('home'));

  // ---------- Navigation: untere Leiste + Training-Reiter ----------
  async function openTab(tab){
    closeLbMenu();
    if(tab === 'home'){
      showScreen('home');
    } else if(tab === 'connect'){
      showScreen('connect');
      await openConnect();
    } else if(tab === 'training'){
      await openTraining(lastTrainingSub);
    } else if(tab === 'profile'){
      showScreen('profile');
      await loadProfile();
      await refreshCachedHistory();
      renderBests();
    }
  }
  async function openTraining(sub){
    showScreen(sub);
    if(sub === 'leaderboard'){
      await openLeaderboard();
    } else if(sub === 'records'){
      refreshBackfillButton();
      await refreshCachedHistory();
      renderRecords();
    } else if(sub === 'knowledge'){
      await openKnowledge();
    }
  }
  tabbarEl.addEventListener('click', e=>{
    const btn = e.target.closest('[data-tab]');
    if(btn) openTab(btn.dataset.tab);
  });
  document.addEventListener('click', e=>{
    const btn = e.target.closest('.seg-ctrl button[data-sub]');
    if(btn) openTraining(btn.dataset.sub);
  });

  // ---------- Knowledge: Kurz-Zusammenfassungen & Fitness-Mythen ----------
  // Neue Einträge einfach unten in die Liste schreiben.
  // type 'info': title, text, take (Merksatz) · type 'myth': title (der Mythos), fact (die Auflösung), take
  const KNOWLEDGE_CATS = ['Alle','Mythen','Training','Hyrox','Regeneration','Ernährung'];
  const KNOWLEDGE = [
    // --- Training ---
    {cat:'Training', type:'info', title:'Richtig aufwärmen',
      text:'5–10 Minuten locker in Bewegung kommen (Laufen, Rudern, SkiErg), dann dynamische Mobilität wie Beinschwingen, Ausfallschritte und Armkreisen. Zum Schluss die Übungen des Tages ein paar Mal leicht anspielen.',
      take:'Erst warm, dann dynamisch, dann spezifisch. Langes statisches Dehnen lieber nach dem Training.'},
    {cat:'Training', type:'info', title:'Progressive Überlastung',
      text:'Der Körper passt sich nur an, wenn der Reiz mit der Zeit größer wird – mehr Gewicht, mehr Wiederholungen, mehr Distanz oder höheres Tempo. Wer immer exakt dasselbe macht, bleibt irgendwann stehen.',
      take:'Steigere immer nur eine Stellschraube auf einmal und in kleinen Schritten.'},
    {cat:'Training', type:'info', title:'Intervalltraining (HIIT)',
      text:'Kurze, harte Belastungen wechseln sich mit Pausen ab – genau wie beim Timer in dieser App. Das verbessert Ausdauer und Tempohärte sehr effizient, ist aber auch anstrengend für den Körper.',
      take:'2–3 harte Einheiten pro Woche reichen. Der Rest darf locker sein.'},
    {cat:'Training', type:'info', title:'Lockeres Ausdauertraining („Zone 2“)',
      text:'Ein Tempo, bei dem du dich noch in ganzen Sätzen unterhalten kannst. Fühlt sich fast zu leicht an, baut aber die Grundlagenausdauer auf, auf der alle harten Einheiten aufbauen.',
      take:'Ein Großteil des Ausdauertrainings darf locker sein – das macht dich auf Dauer schneller.'},
    // --- Hyrox ---
    {cat:'Hyrox', type:'info', title:'Was ist Hyrox?',
      text:'8 × 1 km Laufen, nach jedem Kilometer eine Station: SkiErg 1000 m, Sled Push 50 m, Sled Pull 50 m, Burpee Broad Jumps 80 m, Rudern 1000 m, Farmers Carry 200 m, Sandbag Lunges 100 m und 100 Wall Balls. Für alle gleich, egal wo auf der Welt.',
      take:'Hyrox ist vor allem ein Ausdauer-Wettkampf. Wer gut läuft, hat einen großen Vorteil.'},
    {cat:'Hyrox', type:'info', title:'Pacing: nicht zu schnell starten',
      text:'Der häufigste Fehler ist ein zu schneller erster Kilometer. Die Stationen danach ermüden die Beine stärker als gedacht, und die Zeit, die man vorne gewinnt, verliert man hinten doppelt.',
      take:'Die ersten Läufe kontrolliert angehen. Am Ende darf es weh tun, nicht am Anfang.'},
    {cat:'Hyrox', type:'info', title:'Wall Balls – Technik',
      text:'Ball nah vor der Brust, tief in die Kniebeuge, dann explosiv aus den Beinen hochdrücken und den Ball in einer Bewegung Richtung Ziel werfen. Beim Fangen direkt wieder in die Hocke gehen.',
      take:'Die Kraft kommt aus den Beinen, nicht aus den Armen. Lieber feste Sätze (z. B. 10er) als bis zum Versagen.'},
    {cat:'Hyrox', type:'info', title:'Sled Push – Technik',
      text:'Oberkörper tief und nach vorn geneigt, Arme fast gestreckt an den Stangen. Kurze, kräftige Schritte und vom Ballen abdrücken. Nicht stoppen – ein stehender Schlitten ist schwer wieder anzuschieben.',
      take:'Tief bleiben, kurze Schritte, durchziehen.'},
    // --- Regeneration ---
    {cat:'Regeneration', type:'info', title:'Schlaf',
      text:'Im Schlaf repariert der Körper Muskeln und verarbeitet den Trainingsreiz. Erwachsenen werden meist 7–9 Stunden empfohlen. Zu wenig Schlaf drückt Leistung, Motivation und Erholung spürbar.',
      take:'Der billigste und wirksamste Leistungsbooster ist eine gute Nacht.'},
    {cat:'Regeneration', type:'info', title:'Muskelkater',
      text:'Muskelkater entsteht durch kleine Verletzungen in der Muskulatur nach ungewohnter oder harter Belastung – vor allem bei bremsenden Bewegungen wie Bergablaufen oder Lunges. Er ist meist nach 24–72 Stunden am stärksten und vergeht von selbst.',
      take:'Lockere Bewegung hilft, harte Belastung auf den betroffenen Muskel lieber ein paar Tage meiden.'},
    {cat:'Regeneration', type:'info', title:'Ruhetage',
      text:'Stärker wirst du nicht während des Trainings, sondern in der Erholung danach. Ohne Pausen sammelt sich Müdigkeit an, und das Verletzungsrisiko steigt.',
      take:'Plane mindestens einen echten Ruhetag pro Woche ein.'},
    // --- Ernährung ---
    {cat:'Ernährung', type:'info', title:'Protein – wie viel brauchst du?', personal:'protein',
      text:'Eiweiß liefert die Bausteine für Muskelreparatur und -aufbau. Für Menschen, die regelmäßig Kraft trainieren, nennen Studien rund 1,6 g pro kg Körpergewicht am Tag als Menge, ab der zusätzliches Protein kaum noch etwas bringt. Bis etwa 2,2 g pro kg kann es für manche noch einen kleinen Vorteil geben, darüber praktisch nicht mehr.',
      take:'Lieber über mehrere Mahlzeiten verteilen als alles auf einmal.'},
    {cat:'Ernährung', type:'info', title:'Trinken beim Sport',
      text:'Schon leichter Flüssigkeitsmangel kann die Leistung senken. Bei normalen Einheiten reicht es, über den Tag genug zu trinken und sich am Durst zu orientieren. Bei langen, schweißtreibenden Einheiten können Elektrolyte (v. a. Salz) sinnvoll sein.',
      take:'Durst ernst nehmen – und vor dem Training nicht literweise auf einmal trinken.'},
    // --- Mythen ---
    {cat:'Mythen', type:'myth', title:'„Muskelkater kommt von Milchsäure (Laktat).“',
      fact:'Laktat ist innerhalb von etwa einer Stunde nach dem Training wieder abgebaut. Muskelkater kommt erst nach ein bis zwei Tagen und entsteht durch kleine Verletzungen in den Muskelfasern.',
      take:'Laktat ist sogar ein Energielieferant und kein „Abfallprodukt“.'},
    {cat:'Mythen', type:'myth', title:'„Krafttraining macht Frauen massig.“',
      fact:'Muskelaufbau ist ein langsamer Prozess und braucht Jahre gezielten Trainings und passender Ernährung. Frauen haben deutlich weniger Testosteron, „aus Versehen“ massig wird niemand.',
      take:'Krafttraining stärkt Knochen, Gelenke und Haltung – für alle.'},
    {cat:'Mythen', type:'myth', title:'„Mit Bauchübungen verbrennst du Bauchfett.“',
      fact:'Gezielter Fettabbau an einer Körperstelle („Spot Reduction“) funktioniert nicht. Der Körper holt sich Energie aus den Fettreserven im ganzen Körper – wo zuerst abgenommen wird, ist weitgehend genetisch.',
      take:'Bauchübungen stärken die Rumpfmuskulatur. Für den Fettabbau zählen Gesamtbewegung und Ernährung.'},
    {cat:'Mythen', type:'myth', title:'„Dehnen vor dem Sport verhindert Verletzungen.“',
      fact:'Langes statisches Dehnen direkt vor dem Training schützt laut Studien kaum vor Verletzungen und kann kurzfristig sogar Kraft und Schnelligkeit etwas senken.',
      take:'Vor dem Training lieber dynamisch aufwärmen, statisches Dehnen danach oder separat.'},
    {cat:'Mythen', type:'myth', title:'„No pain, no gain.“',
      fact:'Anstrengung und brennende Muskeln gehören dazu. Stechender, ziehender oder einseitiger Schmerz – besonders in Gelenken – ist dagegen ein Warnsignal und kein Zeichen für gutes Training.',
      take:'Anstrengend ja, Schmerz nein. Bei echtem Schmerz: abbrechen.'},
    {cat:'Mythen', type:'myth', title:'„Wenn man aufhört zu trainieren, werden Muskeln zu Fett.“',
      fact:'Muskel- und Fettgewebe sind völlig verschiedene Gewebearten – das eine kann sich nicht in das andere umwandeln. Was passiert: Muskeln bauen ab, und wenn man gleich viel isst wie vorher, kann Fett dazukommen.',
      take:'Muskeln schrumpfen, Fett wächst – aber getrennt voneinander.'},
    {cat:'Mythen', type:'myth', title:'„Protein muss in den ersten 30 Minuten nach dem Training rein.“',
      fact:'Das „anabole Fenster“ ist deutlich größer als lange gedacht und reicht über Stunden. Entscheidend ist vor allem, wie viel Protein du über den ganzen Tag isst.',
      take:'Kein Stress mit dem Shake in der Umkleide – die Tagesmenge zählt.'},
    {cat:'Mythen', type:'myth', title:'„Viel schwitzen heißt viel Fett verbrennen.“',
      fact:'Schweiß ist Wasser zur Kühlung, kein geschmolzenes Fett. Wie stark jemand schwitzt, hängt von Temperatur, Genetik und Fitness ab. Das Gewicht, das man dabei verliert, ist Wasser und schnell wieder drauf.',
      take:'Schweiß ist kein Maßstab für ein gutes Workout.'},
    {cat:'Mythen', type:'myth', title:'„Ausdauertraining killt deine Muskeln.“',
      fact:'Bei sehr großen Umfängen kann Ausdauertraining den Kraftzuwachs etwas bremsen. Für Freizeitsportler ist der Effekt aber klein, und die Kombination aus Kraft und Ausdauer – wie bei Hyrox – funktioniert sehr gut.',
      take:'Ausdauer und Kraft vertragen sich – Hauptsache, die Erholung stimmt.'}
  ];

  const knSearchEl = document.getElementById('knSearch');
  const knCatsEl = document.getElementById('knCats');
  const knListEl = document.getElementById('knList');
  let knCat = 'Alle';
  let knWeight = null;   // Körpergewicht aus dem Profil (kg), für persönliche Werte

  async function loadKnowledgeWeight(){
    if(!currentUser) return;
    const { data, error } = await sb.from('profiles').select('weight_kg').eq('user_id', currentUser.id).maybeSingle();
    if(!error){
      const w = data ? parseFloat(data.weight_kg) : NaN;
      knWeight = (w > 0) ? w : null;
    }
  }

  function fmtNum(n){ return Math.round(n).toLocaleString('de-DE'); }

  function personalBlock(kind){
    if(kind !== 'protein') return '';
    if(!knWeight){
      return '<div class="kn-personal"><span class="kn-label">Für dich</span>' +
        'Trag dein Gewicht im <button data-goto-profile="1">Profil</button> ein, dann rechnet die App hier deinen persönlichen Wert aus.</div>';
    }
    const w = knWeight;
    const daily = w * 1.6, upper = w * 2.2;
    return '<div class="kn-personal"><span class="kn-label">Für dich · '+esc(w.toLocaleString('de-DE'))+' kg</span>' +
      '<div class="kn-big">ca. '+fmtNum(daily)+' g<small>Protein pro Tag</small></div>' +
      '<div class="kn-rows">' +
        'Auf 4 Mahlzeiten verteilt: <b>ca. '+fmtNum(daily/4)+' g</b> pro Mahlzeit<br>' +
        'Sinnvoller Bereich: <b>'+fmtNum(daily)+'–'+fmtNum(upper)+' g</b> (1,6–2,2 g pro kg)<br>' +
        'Beispiel: 100 g Hähnchenbrust ≈ 23 g · 250 g Magerquark ≈ 30 g · 3 Eier ≈ 20 g' +
      '</div></div>';
  }
  const chevSvg = '<svg class="kn-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  function renderKnowledgeCats(){
    knCatsEl.innerHTML = KNOWLEDGE_CATS.map(c=>
      '<button class="lb-scope'+(c===knCat?' active':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>'
    ).join('');
  }
  function renderKnowledge(){
    const q = knSearchEl.value.trim().toLowerCase();
    const items = KNOWLEDGE.filter(k=>{
      if(knCat !== 'Alle' && k.cat !== knCat) return false;
      if(!q) return true;
      return [k.title, k.text, k.fact, k.take, k.cat].join(' ').toLowerCase().includes(q);
    });
    // Persönliche Einträge (z. B. Protein-Rechner) in der Übersicht nach oben holen
    if(!q && knCat === 'Alle') items.sort((a,b)=> (b.personal?1:0) - (a.personal?1:0));
    if(!items.length){
      knListEl.innerHTML = '<div class="history-empty">Nichts gefunden. Probier einen anderen Begriff.</div>';
      return;
    }
    knListEl.innerHTML = items.map(k=>{
      const myth = k.type === 'myth';
      const body = myth
        ? '<p><span class="kn-label fact">Fakt</span>'+esc(k.fact)+'</p>'
        : '<p>'+esc(k.text)+'</p>' + (k.personal ? personalBlock(k.personal) : '');
      const startOpen = k.personal && !q && knCat === 'Alle';
      return '<div class="kn-item'+(myth?' myth':'')+(startOpen?' open':'')+'">' +
        '<button class="kn-head"><span class="kn-cat">'+(myth?'Mythos':esc(k.cat))+'</span>' +
        '<span class="kn-title">'+esc(k.title)+'</span>'+chevSvg+'</button>' +
        '<div class="kn-body">'+body+'<div class="kn-take"><b>Merke:</b> '+esc(k.take)+'</div></div>' +
      '</div>';
    }).join('');
    // Bei einer Suche den ersten Treffer direkt aufklappen
    if(q){ const first = knListEl.querySelector('.kn-item'); if(first) first.classList.add('open'); }
  }
  knCatsEl.addEventListener('click', e=>{
    const btn = e.target.closest('.lb-scope');
    if(!btn) return;
    knCat = btn.dataset.cat;
    renderKnowledgeCats();
    renderKnowledge();
  });
  knListEl.addEventListener('click', async e=>{
    if(e.target.closest('[data-goto-profile]')){
      await openTab('profile');
      return;
    }
    const head = e.target.closest('.kn-head');
    if(head) head.parentElement.classList.toggle('open');
  });
  knSearchEl.addEventListener('input', renderKnowledge);

  async function openKnowledge(){
    renderKnowledgeCats();
    renderKnowledge();
    await loadKnowledgeWeight();
    // Aufgeklappte Einträge merken und nach dem Laden des Gewichts wiederherstellen
    const openTitles = Array.from(knListEl.querySelectorAll('.kn-item.open .kn-title')).map(t=>t.textContent);
    renderKnowledge();
    knListEl.querySelectorAll('.kn-item').forEach(it=>{
      if(openTitles.includes(it.querySelector('.kn-title').textContent)) it.classList.add('open');
    });
  }

  // ---------- Leaderboard, Freunde & Gruppen (Supabase-Funktionen aus supabase/leaderboard.sql) ----------
  function esc(s){
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function isSetupMissing(err){
    const m = (err && (err.message || '')) + ' ' + (err && err.code || '');
    return /PGRST202|could not find the function|does not exist/i.test(m);
  }
  function lbErrorText(err){
    if(isSetupMissing(err)){
      return 'Die Datenbank ist für das Leaderboard noch nicht eingerichtet. Führe einmal die Datei <b>supabase/leaderboard.sql</b> im Supabase SQL Editor aus.';
    }
    return esc(friendlyAuthError(err));
  }
  function fmtMeters(m){
    const n = Number(m) || 0;
    return n >= 1000 ? (n/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+' km' : Math.round(n)+' m';
  }

  const lbPlusBtn = document.getElementById('lbPlusBtn');
  const lbMenu = document.getElementById('lbMenu');
  const lbFriendForm = document.getElementById('lbFriendForm');
  const lbGroupForm = document.getElementById('lbGroupForm');
  const lbOptFriend = document.getElementById('lbOptFriend');
  const lbOptGroup = document.getElementById('lbOptGroup');
  const lbFriendQuery = document.getElementById('lbFriendQuery');
  const lbFriendStatus = document.getElementById('lbFriendStatus');
  const lbGroupName = document.getElementById('lbGroupName');
  const lbGroupPick = document.getElementById('lbGroupPick');
  const lbGroupStatus = document.getElementById('lbGroupStatus');
  const lbNotice = document.getElementById('lbNotice');
  const lbScopes = document.getElementById('lbScopes');
  const lbTable = document.getElementById('lbTable');
  const lbGroupActions = document.getElementById('lbGroupActions');
  const lbRequestsWrap = document.getElementById('lbRequestsWrap');
  const lbRequests = document.getElementById('lbRequests');
  const lbFriends = document.getElementById('lbFriends');

  let lbScope = null;      // null = Freunde, sonst group_id
  let lbFriendList = [];
  let lbGroupList = [];

  function setStatus(el, text, kind){
    el.style.color = kind==='ok' ? 'var(--chalk)' : kind==='err' ? 'var(--danger)' : 'var(--text-dim)';
    el.innerHTML = text;
  }

  function closeLbMenu(){
    lbMenu.classList.remove('open');
    lbPlusBtn.classList.remove('open');
    lbFriendForm.classList.remove('open');
    lbGroupForm.classList.remove('open');
    lbOptFriend.classList.remove('active');
    lbOptGroup.classList.remove('active');
  }
  function showLbForm(which){
    const friend = which === 'friend';
    lbFriendForm.classList.toggle('open', friend);
    lbGroupForm.classList.toggle('open', !friend);
    lbOptFriend.classList.toggle('active', friend);
    lbOptGroup.classList.toggle('active', !friend);
    setStatus(lbFriendStatus, '');
    setStatus(lbGroupStatus, '');
    if(friend){ lbFriendQuery.focus(); } else { renderGroupPick(); lbGroupName.focus(); }
  }
  lbPlusBtn.addEventListener('click', ()=>{
    if(lbMenu.classList.contains('open')){ closeLbMenu(); return; }
    lbMenu.classList.add('open');
    lbPlusBtn.classList.add('open');
  });
  lbOptFriend.addEventListener('click', ()=> showLbForm('friend'));
  lbOptGroup.addEventListener('click', ()=> showLbForm('group'));

  function renderWeekLabel(){
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    monday.setDate(monday.getDate() - ((monday.getDay()+6)%7));
    document.getElementById('lbWeek').textContent =
      'Diese Woche · seit Mo ' + monday.toLocaleDateString('de-DE',{day:'2-digit', month:'2-digit'}) +
      ' · Rang nach Punkten';
  }
  document.getElementById('lbPointsInfoBtn').addEventListener('click', ()=>{
    document.getElementById('lbPointsInfo').classList.toggle('open');
  });

  async function openLeaderboard(){
    renderWeekLabel();
    lbNotice.innerHTML = '';
    lbTable.innerHTML = '<div class="history-empty">Lädt …</div>';
    lbScopes.innerHTML = '';
    lbGroupActions.innerHTML = '';

    // Hinweis, falls noch kein Nickname gesetzt ist
    const prof = await sb.from('profiles').select('nickname').eq('user_id', currentUser.id).maybeSingle();
    if(prof.error && /nickname/i.test(prof.error.message)){
      lbNotice.innerHTML = '<div class="lb-hint error">'+lbErrorText({message:'does not exist'})+'</div>';
    } else if(!prof.data || !prof.data.nickname){
      lbNotice.innerHTML = '<div class="lb-hint">Leg in deinem <button id="lbToProfile">Profil</button> einen Nickname fest, damit Freunde dich finden und du im Leaderboard mit Namen erscheinst.</div>';
      document.getElementById('lbToProfile').addEventListener('click', ()=>{ host('onNicknameWanted'); });
    }

    await Promise.all([loadFriends(), loadGroups()]);
    if(lbScope !== null && !lbGroupList.some(g=>String(g.group_id)===String(lbScope))) lbScope = null;
    renderScopes();
    await loadBoard();
  }

  async function loadFriends(){
    const { data, error } = await sb.rpc('my_friends');
    if(error){
      lbFriendList = [];
      lbFriends.innerHTML = '<div class="lb-hint error" style="margin:0; border:none;">'+lbErrorText(error)+'</div>';
      return;
    }
    lbFriendList = data || [];
    renderFriends();
    host('onFriends');
  }

  function renderFriends(){
    const incoming = lbFriendList.filter(f=>f.status==='pending' && f.incoming);
    const others = lbFriendList.filter(f=>!(f.status==='pending' && f.incoming));

    lbRequestsWrap.style.display = incoming.length ? 'block' : 'none';
    lbRequests.innerHTML = incoming.map(f=>
      '<div class="lb-person"><span class="who">'+esc(f.nickname)+'</span>' +
      '<button class="lb-mini go" data-act="accept" data-id="'+f.friendship_id+'">Annehmen</button>' +
      '<button class="lb-mini" data-act="decline" data-id="'+f.friendship_id+'">Ablehnen</button></div>'
    ).join('');

    lbFriends.innerHTML = others.length ? others.map(f=>
      '<div class="lb-person"><span class="who"'+(f.status==='accepted' ? ' data-uid="'+esc(f.friend_id)+'"' : '')+'>'+esc(f.nickname)+
      (f.status==='pending' ? ' <span class="tag">· Anfrage gesendet</span>' : '')+'</span>' +
      '<button class="lb-mini warn" data-act="remove" data-id="'+f.friendship_id+'">'+(f.status==='pending'?'Zurückziehen':'Entfernen')+'</button></div>'
    ).join('') : '<div class="history-empty">Noch keine Freunde. Tippe oben auf + um jemanden hinzuzufügen.</div>';
  }

  async function friendAction(act, id, btn){
    if(act==='remove' && btn.dataset.armed!=='1'){
      const original = btn.textContent;
      btn.dataset.armed='1'; btn.textContent='Sicher?';
      setTimeout(()=>{ if(btn.isConnected){ btn.dataset.armed=''; btn.textContent=original; } }, 3000);
      return;
    }
    btn.disabled = true;
    const res = act==='remove'
      ? await sb.rpc('remove_friend', { p_id: Number(id) })
      : await sb.rpc('respond_friend_request', { p_id: Number(id), p_accept: act==='accept' });
    if(res.error){ btn.disabled=false; alertInline(res.error); return; }
    await loadFriends();
    await loadBoard();
  }
  function alertInline(err){
    document.getElementById('connNotice').innerHTML = '<div class="lb-hint error">'+lbErrorText(err)+'</div>';
  }

  // ---------- Connect: Freunde & Gruppen ----------
  const connGroupsEl = document.getElementById('connGroups');
  async function openConnect(){
    document.getElementById('connNotice').innerHTML = '';
    if(!feedPosts.length) postStripEl.innerHTML = '<div class="story"><span class="story-skeleton"></span></div>';
    cleanupOwnPosts();
    await Promise.all([loadFriends(), loadGroups(), loadFeed(), loadEvents()]);
    renderGroupList();
  }

  // ---------- Connect: Events (Supabase-Funktionen aus supabase/events.sql) ----------
  const connSegEl = document.getElementById('connSeg');
  const evForm = document.getElementById('evForm');
  const evStep1 = document.getElementById('evStep1');
  const evStep2 = document.getElementById('evStep2');
  const evTitle = document.getElementById('evTitle');
  const evWhen = document.getElementById('evWhen');
  const evWhere = document.getElementById('evWhere');
  const evAll = document.getElementById('evAll');
  const evPick = document.getElementById('evPick');
  const evStatus = document.getElementById('evStatus');
  const evListEl = document.getElementById('evList');
  let evList = [];

  function showConnPane(which){
    connSegEl.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b.dataset.csub === which));
    document.getElementById('connPaneFriends').style.display = which === 'friends' ? '' : 'none';
    document.getElementById('connPaneEvents').style.display = which === 'events' ? '' : 'none';
  }
  connSegEl.addEventListener('click', e=>{
    const b = e.target.closest('button[data-csub]');
    if(b) showConnPane(b.dataset.csub);
  });

  function pad2(n){ return String(n).padStart(2,'0'); }
  function toLocalInput(d){
    return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())+'T'+pad2(d.getHours())+':'+pad2(d.getMinutes());
  }
  function nextFridayDefault(){
    // Vorschlag: nächster Freitag 13:30 (unser Friday Circle)
    const d = new Date(); d.setSeconds(0,0);
    const add = (5 - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + add); d.setHours(13,30,0,0);
    if(d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
    return d;
  }
  function fmtEventWhen(iso){
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit'}) + ' · ' +
           d.toLocaleTimeString('de-DE',{hour:'2-digit', minute:'2-digit'}) + ' Uhr';
  }

  function openEventForm(){
    evForm.classList.add('open');
    host('onEventOpen');
    document.getElementById('evNewBtn').style.display = 'none';
    evStep1.style.display = ''; evStep2.style.display = 'none';
    if(!evWhen.value) evWhen.value = toLocalInput(nextFridayDefault());
    setStatus(evStatus, '');
  }
  function closeEventForm(){
    evForm.classList.remove('open');
    document.getElementById('evNewBtn').style.display = '';
    evTitle.value = ''; evWhere.value = ''; evWhen.value = '';
    evAll.checked = true; evPick.style.display = 'none';
    clearEvImage();
    setStatus(evStatus, '');
    host('onEventClose');
  }
  // ---------- Hintergrundbild fürs Event ----------
  let evImageBlob = null, evImagePreviewUrl = null;
  const evImgPickEl = document.getElementById('evImgPick');
  const evImgInput = document.getElementById('evImgInput');
  function renderEvImgPick(){
    if(evImagePreviewUrl){
      evImgPickEl.innerHTML = '<div class="ev-img-preview" style="background-image:url(\''+evImagePreviewUrl+'\')"><button type="button" id="evImgRemove">Entfernen</button></div>';
    } else {
      evImgPickEl.innerHTML = '<button type="button" class="ev-img-btn" id="evImgBtn"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5.2-5.2a1.5 1.5 0 0 0-2.1 0L5 19.5"/></svg> Bild wählen</button>';
    }
  }
  function clearEvImage(){
    if(evImagePreviewUrl) URL.revokeObjectURL(evImagePreviewUrl);
    evImageBlob = null; evImagePreviewUrl = null; evImgInput.value = '';
    renderEvImgPick();
  }
  evImgPickEl.addEventListener('click', e=>{
    if(e.target.closest('#evImgRemove')){ clearEvImage(); return; }
    if(e.target.closest('#evImgBtn')) evImgInput.click();
  });
  // Bild verkleinern (max. 1400 px breit, JPEG) – spart Speicher und lädt schnell
  function shrinkImage(file){
    return new Promise((resolve, reject)=>{
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = ()=>{
        const scale = Math.min(1, 1400 / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b=> b ? resolve(b) : reject(new Error('Bild konnte nicht gelesen werden.')), 'image/jpeg', 0.82);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')); };
      img.src = url;
    });
  }
  evImgInput.addEventListener('change', async ()=>{
    const f = evImgInput.files && evImgInput.files[0];
    if(!f) return;
    try{
      const blob = await shrinkImage(f);
      if(evImagePreviewUrl) URL.revokeObjectURL(evImagePreviewUrl);
      evImageBlob = blob; evImagePreviewUrl = URL.createObjectURL(blob);
      renderEvImgPick();
    }catch(err){ setStatus(evStatus, esc(err.message), 'err'); }
  });
  async function uploadEventImage(){
    if(!evImageBlob) return null;
    const path = currentUser.id + '/' + Date.now() + '.jpg';
    const up = await sb.storage.from('event-images').upload(path, evImageBlob, { contentType:'image/jpeg', upsert:false });
    if(up.error) throw up.error;
    return sb.storage.from('event-images').getPublicUrl(path).data.publicUrl;
  }

  document.getElementById('evNewBtn').addEventListener('click', openEventForm);
  document.getElementById('lbOptEvent').addEventListener('click', ()=>{ closeLbMenu(); openEventForm(); });

  function renderEventPick(){
    const accepted = lbFriendList.filter(f=>f.status==='accepted');
    evPick.innerHTML = accepted.length ? accepted.map(f=>
      '<label class="lb-pick"><input type="checkbox" value="'+esc(f.friend_id)+'"> '+esc(f.nickname)+'</label>'
    ).join('') : '<div class="history-empty" style="padding:12px 4px;">Du hast noch keine Freunde – füge zuerst welche hinzu.</div>';
  }
  document.getElementById('evNext').addEventListener('click', ()=>{
    const title = evTitle.value.trim();
    if(!title){ setStatus(evStatus, 'Bitte angeben, was ihr macht.', 'err'); evTitle.focus(); return; }
    if(!evWhen.value){ setStatus(evStatus, 'Bitte angeben, wann das Event ist.', 'err'); return; }
    const when = new Date(evWhen.value);
    if(isNaN(when) || when.getTime() < Date.now() - 3600e3){ setStatus(evStatus, 'Der Zeitpunkt liegt in der Vergangenheit.', 'err'); return; }
    if(!evWhere.value.trim()){ setStatus(evStatus, 'Bitte angeben, wo ihr euch trefft.', 'err'); evWhere.focus(); return; }
    setStatus(evStatus, '');
    const sumEl = document.getElementById('evSummary');
    sumEl.classList.toggle('has-img', !!evImagePreviewUrl);
    sumEl.style.backgroundImage = evImagePreviewUrl ? 'linear-gradient(rgba(0,0,0,.15), rgba(0,0,0,.7)), url(\''+evImagePreviewUrl+'\')' : '';
    sumEl.innerHTML =
      '<b>'+esc(title)+'</b><br><span>'+esc(fmtEventWhen(when.toISOString()))+'</span><br><span>'+esc(evWhere.value.trim())+'</span>';
    renderEventPick();
    evPick.style.display = evAll.checked ? 'none' : '';
    evStep1.style.display = 'none'; evStep2.style.display = '';
  });
  document.getElementById('evBack').addEventListener('click', ()=>{
    evStep2.style.display = 'none'; evStep1.style.display = ''; setStatus(evStatus, '');
  });
  document.getElementById('evCancel').addEventListener('click', closeEventForm);
  [evTitle, evWhen, evWhere].forEach(i=> i.addEventListener('input', ()=> setStatus(evStatus, '')));
  evAll.addEventListener('change', ()=>{ evPick.style.display = evAll.checked ? 'none' : ''; });

  document.getElementById('evCreate').addEventListener('click', async ()=>{
    const ids = evAll.checked ? [] : Array.from(evPick.querySelectorAll('input:checked')).map(i=>i.value);
    if(!evAll.checked && !ids.length){ setStatus(evStatus, 'Wähle mindestens einen Freund aus – oder „An alle Freunde senden“.', 'err'); return; }
    const btn = document.getElementById('evCreate');
    btn.disabled = true;
    setStatus(evStatus, evImageBlob ? 'Bild wird hochgeladen …' : 'Wird angelegt …');
    let imageUrl = null;
    try{ imageUrl = await uploadEventImage(); }
    catch(err){
      btn.disabled = false;
      setStatus(evStatus, /bucket|not found|policy|row-level/i.test(err.message||'')
        ? 'Bilder sind noch nicht eingerichtet – <b>supabase/event_bilder.sql</b> in Supabase ausführen.'
        : 'Bild nicht hochgeladen: ' + esc(friendlyAuthError(err)), 'err');
      return;
    }
    setStatus(evStatus, 'Wird angelegt …');
    const params = {
      p_title: evTitle.value.trim(),
      p_starts_at: new Date(evWhen.value).toISOString(),
      p_location: evWhere.value.trim(),
      p_all_friends: evAll.checked,
      p_invitee_ids: ids
    };
    if(imageUrl) params.p_image_url = imageUrl;
    const { error } = await sb.rpc('create_event', params);
    btn.disabled = false;
    if(error){
      if(imageUrl && isSetupMissing(error)){
        setStatus(evStatus, 'Bilder sind noch nicht eingerichtet – <b>supabase/event_bilder.sql</b> in Supabase ausführen.', 'err');
      } else {
        setStatus(evStatus, isSetupMissing(error) ? eventsSetupText() : esc(friendlyAuthError(error)), 'err');
      }
      return;
    }
    closeEventForm();
    await loadEvents();
  });

  function eventsSetupText(){
    return 'Events sind noch nicht eingerichtet – <b>supabase/events.sql</b> in Supabase ausführen.';
  }

  async function loadEvents(){
    const { data, error } = await sb.rpc('my_events');
    if(error){
      evList = [];
      evListEl.innerHTML = '<div class="lb-hint'+(isSetupMissing(error)?'':' error')+'">'+
        (isSetupMissing(error) ? eventsSetupText() : 'Events konnten nicht geladen werden.')+'</div>';
      updateEventsTabLabel();
      return;
    }
    evList = data || [];
    renderEvents();
  }
  // ---------- Startseite: zugesagte Events als eigene Boxen unter „Workout starten“ ----------
  async function loadHomeEvents(){
    const el = document.getElementById('homeEvents');
    if(!el || !currentUser) return;
    const { data, error } = await sb.rpc('my_events');
    if(error){ el.innerHTML = ''; return; }
    const mine = (data || []).filter(e=> e.my_going === true);
    el.innerHTML = mine.map(e=>{
      const d = new Date(e.starts_at);
      const day = d.toLocaleDateString('de-DE',{weekday:'short'}).replace('.','').toUpperCase();
      const mon = d.toLocaleDateString('de-DE',{month:'short'}).replace('.','').toUpperCase();
      const dateLong = d.toLocaleDateString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit'});
      const time = d.toLocaleTimeString('de-DE',{hour:'2-digit', minute:'2-digit'}) + ' Uhr';
      return '<button class="home-ev'+(e.image_url?' has-img':'')+'"'+(e.image_url?' style="background-image:url(\''+esc(e.image_url)+'\')"':'')+'>' +
        '<span class="ev-date"><span class="d1">'+day+'</span><span class="d2">'+d.getDate()+'</span><span class="d3">'+mon+'</span></span>' +
        '<span class="home-ev-body">' +
          '<span class="home-ev-title">'+esc(e.title)+'</span>' +
          '<span class="home-ev-line"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>'+esc(dateLong)+' · '+time+'</span></span>' +
          (e.location ? '<span class="home-ev-line"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><span>'+esc(e.location)+'</span></span>' : '') +
        '</span>' +
        '<svg class="home-ev-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>' +
      '</button>';
    }).join('');
  }
  document.getElementById('homeEvents').addEventListener('click', async e=>{
    if(!e.target.closest('.home-ev')) return;
    await openTab('connect');
    showConnPane('events');
  });

  // ---------- Event auf WhatsApp teilen (Link führt direkt zum Event in der App) ----------
  const APP_URL = 'https://zirkeltraining-indol.vercel.app/';
  const SHARE_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
  function shareEventWhatsApp(ev){
    if(!ev) return;
    const d = new Date(ev.starts_at);
    const when = d.toLocaleDateString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit'}) + ' · ' +
                 d.toLocaleTimeString('de-DE',{hour:'2-digit', minute:'2-digit'}) + ' Uhr';
    const text =
      '🏋️ ' + ev.title + '\n' +
      '📅 ' + when + '\n' +
      (ev.location ? '📍 ' + ev.location + '\n' : '') +
      (ev.going_count ? '✅ Dabei: ' + (ev.going_names || []).join(', ') + '\n' : '') +
      '\nBist du dabei? Hier zu- oder absagen:\n' + APP_URL + '#event=' + ev.id;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  // Link aus WhatsApp (…#event=123): direkt Connect › Events öffnen und das Event hervorheben
  async function handleEventDeepLink(){
    const m = location.hash.match(/event=(\d+)/);
    if(!m || !currentUser) return;
    history.replaceState(null, '', location.pathname + location.search);
    await openTab('connect');
    showConnPane('events');
    const card = evListEl.querySelector('.ev-card[data-ev="'+m[1]+'"]');
    if(card){
      card.classList.add('ev-highlight');
      card.scrollIntoView({ block:'center', behavior:'smooth' });
      setTimeout(()=> card.classList.remove('ev-highlight'), 2500);
    } else {
      evListEl.insertAdjacentHTML('afterbegin', '<div class="lb-hint">Dieses Event kannst du nicht sehen – vielleicht seid ihr noch keine Freunde in der App, oder es ist schon vorbei.</div>');
    }
  }

  function updateEventsTabLabel(){
    const open = evList.filter(e=> !e.is_mine && e.my_going === null).length;
    connSegEl.querySelector('[data-csub=events]').textContent = 'Events' + (open ? ' ('+open+' neu)' : '');
  }
  function renderEvents(){
    updateEventsTabLabel();
    if(!evList.length){
      evListEl.innerHTML = '';
      return;
    }
    evListEl.innerHTML = evList.map(e=>{
      const d = new Date(e.starts_at);
      const day = d.toLocaleDateString('de-DE',{weekday:'short'}).replace('.','').toUpperCase();
      const mon = d.toLocaleDateString('de-DE',{month:'short'}).replace('.','').toUpperCase();
      const time = d.toLocaleTimeString('de-DE',{hour:'2-digit', minute:'2-digit'}) + ' Uhr';
      const who = e.is_mine ? 'von dir' : 'von '+esc(e.creator_nickname);
      const audience = e.all_friends ? 'für alle Freunde' : ('für '+e.invite_count+' '+(e.invite_count===1?'Freund':'Freunde'));
      const names = (e.going_names || []).map(esc).join(', ');
      const maps = e.location ? '<a href="https://maps.google.com/?q='+encodeURIComponent(e.location)+'" target="_blank" rel="noopener">'+esc(e.location)+'</a>' : '';
      return '<div class="ev-card'+(e.is_mine?' mine':'')+(e.image_url?' has-img':'')+'" data-ev="'+e.id+'">' +
        (e.image_url ? '<div class="ev-banner" style="background-image:url(\''+esc(e.image_url)+'\')"></div>' : '') +
        '<div class="ev-date"><span class="d1">'+day+'</span><span class="d2">'+d.getDate()+'</span><span class="d3">'+mon+'</span></div>' +
        '<div class="ev-body"><b>'+esc(e.title)+'</b>' +
          '<span class="ev-line">'+time+(maps?' · '+maps:'')+'</span>' +
          '<span class="ev-line">'+who+' · '+(e.is_mine ? audience : (e.all_friends ? 'für alle Freunde' : 'du bist eingeladen'))+'</span>' +
          '<span class="ev-going">'+(e.going_count ? '✓ '+e.going_count+' dabei: '+names : 'Noch keine Zusagen')+'</span>' +
          '<div class="ev-actions">' +
            '<button class="lb-mini'+(e.my_going===true?' go':'')+'" data-evact="yes" data-id="'+e.id+'">'+(e.my_going===true?'✓ Dabei':'Dabei')+'</button>' +
            '<button class="lb-mini'+(e.my_going===false?' on-no':'')+'" data-evact="no" data-id="'+e.id+'">Nicht dabei</button>' +
            '<button class="lb-mini ev-share" data-evact="share" data-id="'+e.id+'" aria-label="Auf WhatsApp teilen">'+SHARE_SVG+' WhatsApp</button>' +
            (e.is_mine ? '<button class="lb-mini warn" data-evact="del" data-id="'+e.id+'">Löschen</button>' : '') +
          '</div>' +
        '</div></div>';
    }).join('');
  }
  evListEl.addEventListener('click', async e=>{
    const btn = e.target.closest('button[data-evact]');
    if(!btn) return;
    const id = Number(btn.dataset.id);
    if(btn.dataset.evact === 'share'){ shareEventWhatsApp(evList.find(x=>x.id===id)); return; }
    if(btn.dataset.evact === 'del'){
      if(btn.dataset.armed !== '1'){
        btn.dataset.armed = '1'; btn.textContent = 'Sicher?';
        setTimeout(()=>{ if(btn.isConnected){ btn.dataset.armed=''; btn.textContent='Löschen'; } }, 3000);
        return;
      }
      btn.disabled = true;
      const evObj = evList.find(x=>x.id===id);
      const res = await sb.rpc('delete_event', { p_event_id: id });
      const mImg = evObj && evObj.image_url && evObj.image_url.match(/\/event-images\/(.+)$/);
      if(!res.error && mImg){ try{ await sb.storage.from('event-images').remove([decodeURIComponent(mImg[1])]); }catch(e){} }
      if(res.error){ btn.disabled = false; alertInline(res.error); return; }
      await loadEvents();
      return;
    }
    btn.disabled = true;
    const res = await sb.rpc('respond_event', { p_event_id: id, p_going: btn.dataset.evact === 'yes' });
    if(res.error){ btn.disabled = false; alertInline(res.error); return; }
    await loadEvents();
  });
  function renderGroupList(){
    connGroupsEl.innerHTML = lbGroupList.length ? lbGroupList.map(g=>
      '<div class="lb-person"><span class="who">'+esc(g.name)+
      ' <span class="tag">· '+g.member_count+' '+(g.member_count===1?'Mitglied':'Mitglieder')+'</span></span>' +
      '<button class="lb-mini" data-gact="board" data-id="'+g.group_id+'">Ranking</button>' +
      '<button class="lb-mini warn" data-gact="leave" data-id="'+g.group_id+'">'+(g.is_owner?'Löschen':'Verlassen')+'</button></div>'
    ).join('') : '<div class="history-empty">Noch keine Gruppen. Tippe oben auf + um eine zu erstellen.</div>';
  }
  connGroupsEl.addEventListener('click', async e=>{
    const btn = e.target.closest('button[data-gact]');
    if(!btn) return;
    const id = Number(btn.dataset.id);
    if(btn.dataset.gact === 'board'){
      lbScope = id;
      await openTraining('leaderboard');
      return;
    }
    if(btn.dataset.armed !== '1'){
      const original = btn.textContent;
      btn.dataset.armed = '1'; btn.textContent = 'Sicher?';
      setTimeout(()=>{ if(btn.isConnected){ btn.dataset.armed=''; btn.textContent = original; } }, 3000);
      return;
    }
    btn.disabled = true;
    const res = await sb.rpc('leave_group', { p_group_id: id });
    if(res.error){ btn.disabled = false; alertInline(res.error); return; }
    if(String(lbScope) === String(id)) lbScope = null;
    await loadGroups();
    renderGroupList();
  });
  lbTable.addEventListener('click', e=>{
    const row = e.target.closest('.lb-row[data-uid]');
    if(row) openFriendProfile(row.dataset.uid);
  });
  lbFriends.addEventListener('click', e=>{
    const who = e.target.closest('.who[data-uid]');
    if(who) openFriendProfile(who.dataset.uid);
  });
  [lbRequests, lbFriends].forEach(container=>{
    container.addEventListener('click', e=>{
      const btn = e.target.closest('button[data-act]');
      if(btn) friendAction(btn.dataset.act, btn.dataset.id, btn);
    });
  });

  async function sendFriendRequest(){
    const q = lbFriendQuery.value.trim();
    if(!q){ setStatus(lbFriendStatus, 'Bitte Nickname oder E-Mail eingeben.', 'err'); return; }
    const btn = document.getElementById('lbFriendSend');
    btn.disabled = true;
    setStatus(lbFriendStatus, 'Wird gesendet …');
    const { data, error } = await sb.rpc('send_friend_request', { p_query: q });
    btn.disabled = false;
    if(error){ setStatus(lbFriendStatus, lbErrorText(error), 'err'); return; }
    lbFriendQuery.value = '';
    setStatus(lbFriendStatus, data==='accepted'
      ? 'Ihr seid jetzt befreundet – die Person hatte dir schon eine Anfrage geschickt.'
      : 'Anfrage gesendet. Sobald sie angenommen wird, erscheint ihr gemeinsam im Leaderboard.', 'ok');
    await loadFriends();
    await loadBoard();
  }
  document.getElementById('lbFriendSend').addEventListener('click', sendFriendRequest);
  lbFriendQuery.addEventListener('keydown', e=>{ if(e.key==='Enter') sendFriendRequest(); });

  function renderGroupPick(){
    const accepted = lbFriendList.filter(f=>f.status==='accepted');
    lbGroupPick.innerHTML = accepted.length ? accepted.map(f=>
      '<label class="lb-pick"><input type="checkbox" value="'+esc(f.friend_id)+'"> '+esc(f.nickname)+'</label>'
    ).join('') : '<div class="history-empty" style="padding:12px 4px;">Du brauchst zuerst Freunde, um eine Gruppe zu erstellen.</div>';
  }

  async function createGroup(){
    const name = lbGroupName.value.trim();
    const ids = Array.from(lbGroupPick.querySelectorAll('input:checked')).map(i=>i.value);
    if(!name){ setStatus(lbGroupStatus, 'Bitte einen Gruppennamen eingeben.', 'err'); return; }
    if(!ids.length){ setStatus(lbGroupStatus, 'Wähle mindestens einen Freund aus.', 'err'); return; }
    const btn = document.getElementById('lbGroupCreate');
    btn.disabled = true;
    setStatus(lbGroupStatus, 'Wird erstellt …');
    const { data, error } = await sb.rpc('create_group', { p_name: name, p_member_ids: ids });
    btn.disabled = false;
    if(error){ setStatus(lbGroupStatus, lbErrorText(error), 'err'); return; }
    lbGroupName.value = '';
    closeLbMenu();
    lbScope = data;
    await loadGroups();
    renderGroupList();
    renderScopes();
  }
  document.getElementById('lbGroupCreate').addEventListener('click', createGroup);

  async function loadGroups(){
    const { data, error } = await sb.rpc('my_groups');
    lbGroupList = error ? [] : (data || []);
  }

  function renderScopes(){
    const chips = [{id:null, label:'Freunde'}].concat(
      lbGroupList.map(g=>({id:g.group_id, label:g.name}))
    );
    lbScopes.innerHTML = chips.map(c=>
      '<button class="lb-scope'+(String(c.id)===String(lbScope)?' active':'')+'" data-id="'+(c.id===null?'':c.id)+'">'+esc(c.label)+'</button>'
    ).join('');
  }
  lbScopes.addEventListener('click', async e=>{
    const btn = e.target.closest('.lb-scope');
    if(!btn) return;
    lbScope = btn.dataset.id === '' ? null : Number(btn.dataset.id);
    renderScopes();
    await loadBoard();
  });

  async function loadBoard(){
    lbGroupActions.innerHTML = '';
    const { data, error } = await sb.rpc('weekly_leaderboard', { p_group_id: lbScope });
    if(error){
      lbTable.innerHTML = '<div class="lb-hint error" style="margin:0; border:none;">'+lbErrorText(error)+'</div>';
      return;
    }
    const rows = data || [];
    lbTable.innerHTML = rows.map((r,i)=>
      '<div class="lb-row'+(r.is_me?' me':'')+'" data-uid="'+esc(r.user_id)+'">' +
        '<span class="lb-rank">'+(i+1)+'</span>' +
        '<span class="avatar">'+avatarHtml(r.avatar_url, r.nickname)+'</span>' +
        '<span class="lb-name">'+esc(r.nickname)+(r.is_me?'<small>Du</small>':'')+'</span>' +
        (r.points !== undefined
          ? '<span class="lb-stat"><span class="big">'+Number(r.points).toLocaleString('de-DE')+'</span> <span class="dim">P</span><br>' +
            '<span class="dim">'+r.workouts+' '+(r.workouts===1?'Workout':'Workouts')+' · '+fmtMeters(r.meters)+'</span></span>'
          // Fallback, solange punkte.sql noch nicht in Supabase ausgeführt wurde
          : '<span class="lb-stat"><span class="big">'+r.workouts+'</span> <span class="dim">'+(r.workouts===1?'Workout':'Workouts')+'</span><br>' +
            '<span class="dim">'+fmtMeters(r.meters)+'</span></span>') +
      '</div>'
    ).join('');
    if(lbScope === null && rows.length <= 1){
      lbTable.insertAdjacentHTML('beforeend',
        '<div class="history-empty" style="padding:14px 10px;">Füge Freunde hinzu, um dich mit ihnen zu messen.</div>');
    }
    if(lbScope !== null){
      const g = lbGroupList.find(x=>String(x.group_id)===String(lbScope));
      if(g){
        lbGroupActions.innerHTML = '<button class="clear-history" id="lbLeaveGroup" style="margin-top:12px;">'+
          (g.is_owner ? 'Gruppe löschen' : 'Gruppe verlassen')+'</button>';
        const leaveBtn = document.getElementById('lbLeaveGroup');
        leaveBtn.addEventListener('click', async ()=>{
          if(leaveBtn.dataset.armed!=='1'){
            leaveBtn.dataset.armed='1';
            leaveBtn.textContent = 'Nochmal tippen zum Bestätigen';
            return;
          }
          const res = await sb.rpc('leave_group', { p_group_id: lbScope });
          if(res.error){ alertInline(res.error); return; }
          lbScope = null;
          await loadGroups();
          renderScopes();
          await loadBoard();
        });
      }
    }
  }

  // ---------- setup state ----------
  // Bewusst simpel: feste Arbeitszeit & Pause, Runden ergeben sich aus den gewählten Stationen
  // (vor jeder Station eine Laufrunde → 3 Stationen = 6 Runden).
  const WORK_DEFAULT = 240;   // 4:00 min
  const REST_DEFAULT = 30;    // 30 s
  let rounds = 0;
  let workSec = WORK_DEFAULT;
  let restSec = REST_DEFAULT;

  let roundExercises = []; // Übung je Runde, ergibt sich aus der Auswahl

  function fmt(sec){
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec/60), s = sec%60;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  }
  function fmtMin(sec){
    const m = Math.floor(sec/60), s = sec%60;
    return m+':'+String(s).padStart(2,'0');
  }

  function refreshSetup(){
    document.getElementById('sumRounds').textContent = rounds;
    document.getElementById('sumWork').textContent = fmtMin(workSec);
    document.getElementById('sumRest').textContent = restSec+'s';
    const total = rounds > 0 ? rounds*workSec + (rounds-1)*restSec : 0;
    document.getElementById('sumTotal').textContent = fmtMin(total);
    const startBtn = document.getElementById('startBtn');
    startBtn.disabled = rounds === 0;
    startBtn.textContent = rounds === 0 ? 'Wähle mindestens eine Station' : 'Workout starten';
  }
  refreshSetup();

  let cachedHistory = [];

  function getRecord(exId){
    if(!exId) return null;
    let max = null;
    cachedHistory.forEach(session=>{
      (session.log||[]).forEach(entry=>{
        if(entry.exercise !== exId) return;
        const amt = parseFloat(entry.amount);
        if(!amt || isNaN(amt)) return;
        if(max===null || amt>max) max = amt;
      });
    });
    return max;
  }
  function recordText(exId){
    if(!exId) return '';
    const rec = getRecord(exId);
    return rec===null ? 'Noch kein Rekord' : 'Rekord: '+rec+' '+unitFor(exId);
  }

  // ---------- Übungsauswahl per Antippen (Kacheln) ----------
  // selectedExercises = gewählte Übungen in der Reihenfolge, in der sie angetippt wurden.
  // Die Runden gehen diese Liste der Reihe nach durch (bei mehr Runden wieder von vorn).
  let selectedExercises = [];
  const exPlanEl = document.getElementById('exercisePlan');

  function shortUnit(exId){ const u = unitFor(exId); return u === 'Wiederholungen' ? 'Wdh.' : u === 'Kalorien' ? 'kcal' : 'm'; }

  const RUN_ID = 'run';

  // Gewicht für Übungen mit Ball/Gewicht (aktuell nur Wall Balls). Tippen auf "6 kg" wechselt 4 → 6 → 9 kg.
  // Gewichte wie bei HYROX-Wettkämpfen (Sled-Gewichte inkl. Schlitten). Sled Hybrid: wie Sled Pull.
  const WEIGHT_OPTIONS = {
    sledpush:   [102, 152, 202],
    sledpull:   [78, 103, 153],
    sledhybrid: [78, 103, 153],
    farmers:    [16, 24, 32],
    lunges:     [10, 20, 30],
    wallballs:  [4, 6, 9]
  };
  const WEIGHT_LABELS = {
    sledpush:   ['Open Damen', 'Open Herren · Pro Damen', 'Pro Herren'],
    sledpull:   ['Open Damen', 'Open Herren · Pro Damen', 'Pro Herren'],
    sledhybrid: ['Open Damen', 'Open Herren · Pro Damen', 'Pro Herren'],
    farmers:    ['Open Damen', 'Open Herren · Pro Damen', 'Pro Herren'],
    lunges:     ['Open Damen', 'Open Herren · Pro Damen', 'Pro Herren'],
    wallballs:  ['Open Damen', 'Open Herren · Pro Damen', 'Pro Herren']
  };
  function fmtWeight(exId, kg){ return exId === 'farmers' ? '2×' + kg + ' kg' : kg + ' kg'; }
  const exWeights = { wallballs: 6 };
  try{
    const saved = JSON.parse(localStorage.getItem('ffc_weights') || '{}');
    Object.keys(saved).forEach(k=>{ if(WEIGHT_OPTIONS[k] && WEIGHT_OPTIONS[k].includes(saved[k])) exWeights[k] = saved[k]; });
  }catch(e){}
  function saveWeights(){ try{ localStorage.setItem('ffc_weights', JSON.stringify(exWeights)); }catch(e){} }
  function weightSuffix(entry){
    return entry && entry.weight ? ' · '+fmtWeight(entry.exercise, entry.weight) : '';
  }

  // Laufen vor oder nach jeder Station (Auswahl wird gemerkt)
  let runFirst = true;
  try{ runFirst = localStorage.getItem('ffc_runfirst') !== '0'; }catch(e){}
  const runOrderSegEl = document.getElementById('runOrderSeg');
  function renderRunOrder(){
    runOrderSegEl.querySelectorAll('button').forEach(b=> b.classList.toggle('active', (b.dataset.run === 'first') === runFirst));
    document.getElementById('exHint').textContent = setupMode === 'custom'
      ? 'Tippe eine Übung an und wähle, wie oft. ' + (runFirst ? 'Vor' : 'Nach') + ' jeder Wiederholung kommt eine Laufrunde · 4 min Arbeit · 30 s Pause.'
      : 'Tippe deine Stationen an. ' + (runFirst ? 'Vor' : 'Nach') + ' jeder Station kommt automatisch eine Laufrunde · 4 min Arbeit · 30 s Pause.';
  }
  runOrderSegEl.addEventListener('click', e=>{
    const b = e.target.closest('button[data-run]');
    if(!b) return;
    runFirst = b.dataset.run === 'first';
    try{ localStorage.setItem('ffc_runfirst', runFirst ? '1' : '0'); }catch(e){}
    buildExercisePlan();
  });

  // ---------- Modus: Standard (jede Station 1×) oder Benutzerdefiniert (Station mehrfach, z. B. 6× Wall Balls) ----------
  let setupMode = 'standard';
  const customCounts = {};
  try{
    if(localStorage.getItem('ffc_mode') === 'custom') setupMode = 'custom';
    const c = JSON.parse(localStorage.getItem('ffc_counts') || '{}');
    Object.keys(c).forEach(k=>{ const n = Number(c[k]); if(n >= 1 && n <= 10) customCounts[k] = n; });
  }catch(e){}
  function saveCounts(){ try{ localStorage.setItem('ffc_counts', JSON.stringify(customCounts)); }catch(e){} }
  const setupModeSegEl = document.getElementById('setupModeSeg');
  function renderSetupMode(){
    setupModeSegEl.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b.dataset.mode === setupMode));
  }
  setupModeSegEl.addEventListener('click', e=>{
    const b = e.target.closest('button[data-mode]');
    if(!b || b.dataset.mode === setupMode) return;
    setupMode = b.dataset.mode;
    try{ localStorage.setItem('ffc_mode', setupMode); }catch(e){}
    buildExercisePlan();
  });
  function repsOf(id){ return setupMode === 'custom' ? (customCounts[id] || 1) : 1; }

  function computeRoundExercises(){
    // Pro gewählter Station (bzw. pro Wiederholung) ein Zweierblock: Laufen + Station (oder Station + Laufen)
    roundExercises = [];
    selectedExercises.forEach(st=>{
      for(let k = 0; k < repsOf(st); k++){
        if(runFirst) roundExercises.push(RUN_ID, st); else roundExercises.push(st, RUN_ID);
      }
    });
    rounds = roundExercises.length;
  }

  function buildExercisePlan(){
    renderSetupMode();
    renderRunOrder();
    computeRoundExercises();
    exPlanEl.innerHTML = exercises.filter(ex=> ex.id !== RUN_ID).map(ex=>{
      const idx = selectedExercises.indexOf(ex.id);
      return '<button class="ex-tile'+(idx>=0?' on':'')+'" data-ex="'+ex.id+'" aria-pressed="'+(idx>=0)+'">' +
        (idx>=0 ? '<span class="ex-num">'+(idx+1)+'</span>' : '') +
        '<span class="ex-name">'+ex.name+'</span>' +
        (idx>=0 && WEIGHT_OPTIONS[ex.id] && exWeights[ex.id] ? '<span class="ex-weight" data-weight="'+ex.id+'">'+fmtWeight(ex.id, exWeights[ex.id])+'</span>' : '') +
        (idx>=0 && setupMode === 'custom' ? '<span class="ex-count-chip" data-count="'+ex.id+'">'+repsOf(ex.id)+'×</span>' : '') +
      '</button>';
    }).join('');

    document.getElementById('exCount').textContent = !selectedExercises.length ? '' :
      setupMode === 'custom' ? (rounds/2)+((rounds/2)===1?' Station':' Stationen')
      : selectedExercises.length+(selectedExercises.length===1?' Station':' Stationen');

    const nameOf = id=> (exercises.find(e=>e.id===id)||{}).name || id;
    document.getElementById('exPreview').innerHTML = selectedExercises.length
      ? roundExercises.map((id,i)=>'<span class="ex-chip'+(id===RUN_ID?' run':'')+'"><b>R'+(i+1)+'</b> '+nameOf(id)+(exWeights[id]?' '+fmtWeight(id, exWeights[id]):'')+'</span>').join('')
      : '';
    refreshSetup();
  }

  // ---------- Gewicht wählen (Pop-up mit Gewichts-Boxen) ----------
  const wtOverlayEl = document.getElementById('wtOverlay');
  let wtFor = null, wtAddOnPick = false;
  let wtCallback = null;
  function openWeightPicker(exId, addOnPick, onPicked){
    wtFor = exId; wtAddOnPick = addOnPick; wtCallback = onPicked || null;
    const ex = exercises.find(e=>e.id===exId);
    document.getElementById('wtTitle').textContent = (ex ? ex.name : exId) + ' – Gewicht';
    document.getElementById('wtSub').textContent = exId === 'farmers' ? 'Pro Hand, wie bei HYROX' : exId.startsWith('sled') ? 'Inkl. Schlitten, wie bei HYROX' : 'Wie bei HYROX';
    const opts = WEIGHT_OPTIONS[exId], labels = WEIGHT_LABELS[exId] || [];
    document.getElementById('wtOptions').innerHTML = opts.map((kg,i)=>
      '<button class="wt-opt'+(exWeights[exId]===kg?' on':'')+'" data-kg="'+kg+'">' +
        '<span class="wt-kg">'+fmtWeight(exId, kg)+'</span></button>'
    ).join('');
    wtOverlayEl.classList.add('open'); wtOverlayEl.setAttribute('aria-hidden','false');
  }
  function closeWeightPicker(){ wtOverlayEl.classList.remove('open'); wtOverlayEl.setAttribute('aria-hidden','true'); wtFor = null; }
  document.getElementById('wtOptions').addEventListener('click', e=>{
    const b = e.target.closest('.wt-opt');
    if(!b || !wtFor) return;
    exWeights[wtFor] = Number(b.dataset.kg);
    saveWeights();
    if(wtCallback){ const cb = wtCallback, id = wtFor; wtCallback = null; closeWeightPicker(); cb(id, exWeights[id]); return; }
    const picked = wtFor, adding = wtAddOnPick && !selectedExercises.includes(wtFor);
    closeWeightPicker();
    if(adding && setupMode === 'custom'){ buildExercisePlan(); openCountPicker(picked); return; }
    if(adding) selectedExercises.push(picked);
    buildExercisePlan();
  });
  document.getElementById('wtCancel').addEventListener('click', closeWeightPicker);
  wtOverlayEl.addEventListener('click', e=>{ if(e.target === wtOverlayEl) closeWeightPicker(); });

  // ---------- Wie oft? (nur Benutzerdefiniert) ----------
  const cntOverlayEl = document.getElementById('cntOverlay');
  let cntFor = null;
  function openCountPicker(exId){
    cntFor = exId;
    const ex = exercises.find(e=>e.id===exId);
    document.getElementById('cntTitle').textContent = (ex ? ex.name : exId) + ' – wie oft?';
    document.getElementById('cntSub').textContent = 'Jede Wiederholung mit einer Laufrunde ' + (runFirst ? 'davor' : 'danach') + '.';
    const cur = selectedExercises.includes(exId) ? repsOf(exId) : (customCounts[exId] || 0);
    let html = '';
    for(let n = 1; n <= 10; n++) html += '<button class="wt-opt'+(cur===n?' on':'')+'" data-n="'+n+'"><span class="wt-kg">'+n+'×</span></button>';
    document.getElementById('cntOptions').innerHTML = html;
    cntOverlayEl.classList.add('open'); cntOverlayEl.setAttribute('aria-hidden','false');
  }
  function closeCountPicker(){ cntOverlayEl.classList.remove('open'); cntOverlayEl.setAttribute('aria-hidden','true'); cntFor = null; }
  document.getElementById('cntOptions').addEventListener('click', e=>{
    const b = e.target.closest('.wt-opt');
    if(!b || !cntFor) return;
    customCounts[cntFor] = Number(b.dataset.n);
    saveCounts();
    if(!selectedExercises.includes(cntFor)) selectedExercises.push(cntFor);
    closeCountPicker();
    buildExercisePlan();
  });
  document.getElementById('cntCancel').addEventListener('click', closeCountPicker);
  cntOverlayEl.addEventListener('click', e=>{ if(e.target === cntOverlayEl) closeCountPicker(); });

  exPlanEl.addEventListener('click', e=>{
    // Tipp auf „6×“ → Anzahl ändern
    const c = e.target.closest('.ex-count-chip');
    if(c){ openCountPicker(c.dataset.count); return; }
    // Tipp auf das Gewicht → Gewicht ändern, Kachel bleibt ausgewählt
    const w = e.target.closest('.ex-weight');
    if(w){ openWeightPicker(w.dataset.weight, false); return; }
    const tile = e.target.closest('.ex-tile');
    if(!tile) return;
    const id = tile.dataset.ex;
    const idx = selectedExercises.indexOf(id);
    if(idx >= 0){ selectedExercises.splice(idx, 1); buildExercisePlan(); return; }
    // Übung mit Gewicht: erst Gewicht wählen, dann (bei Benutzerdefiniert) wie oft
    if(WEIGHT_OPTIONS[id]){ openWeightPicker(id, true); return; }
    if(setupMode === 'custom'){ openCountPicker(id); return; }
    selectedExercises.push(id);
    buildExercisePlan();
  });
  buildExercisePlan();

  // ---------- audio ----------
  let actx;
  function beep(freq, dur, vol){
    try{
      actx = actx || new (window.AudioContext||window.webkitAudioContext)();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = vol!==undefined?vol:0.15;
      o.connect(g); g.connect(actx.destination);
      o.start();
      o.stop(actx.currentTime + dur);
    }catch(e){}
  }
  function vibrate(ms){ if(navigator.vibrate) navigator.vibrate(ms); }

  // ---------- run engine ----------
  const laneEl = document.getElementById('lane');
  const phaseLabelEl = document.getElementById('phaseLabel');
  const roundOfEl = document.getElementById('roundOf');
  const clockEl = document.getElementById('clock');
  const subClockEl = document.getElementById('subClock');
  const pauseBtn = document.getElementById('pauseBtn');
  const logCardEl = document.getElementById('logCard');
  const logRoundNumEl = document.getElementById('logRoundNum');
  const amountInput = document.getElementById('amountInput');
  const unitLabelEl = document.getElementById('unitLabel');
  const controlsNormal = document.getElementById('controlsNormal');
  const controlsFinal = document.getElementById('controlsFinal');
  const exerciseDisplayEl = document.getElementById('exerciseDisplay');

  let currentRound, phase, phaseRemaining, elapsedTotal, timerId, paused, wakeLock, log;

  function buildLane(){
    laneEl.innerHTML = '';
    for(let i=0;i<rounds;i++){
      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.innerHTML = '<div class="fill"></div>';
      laneEl.appendChild(seg);
    }
  }

  function updateLane(){
    const segs = laneEl.children;
    for(let i=0;i<segs.length;i++){
      const seg = segs[i];
      const fill = seg.querySelector('.fill');
      if(i !== currentRound-1){
        seg.classList.remove('current');
        const num = seg.querySelector('.seg-num'); if(num) num.remove();
      }
      if(i < currentRound-1){
        seg.classList.add('done');
      } else if(i === currentRound-1){
        seg.classList.remove('done');
        seg.classList.add('current');
        if(!seg.querySelector('.seg-num')) seg.insertAdjacentHTML('beforeend', '<span class="seg-num">'+(i+1)+'</span>');
        if(phase==='work'){
          fill.style.width = ((workSec-phaseRemaining)/workSec*100) + '%';
        } else {
          fill.style.width = '100%';
        }
      } else {
        seg.classList.remove('done');
        fill.style.width='0%';
      }
    }
  }

  async function requestWakeLock(){
    try{ wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
  }
  function releaseWakeLock(){
    try{ wakeLock && wakeLock.release(); wakeLock=null; }catch(e){}
  }

  function unitFor(exId){
    const ex = exercises.find(e=>e.id===exId);
    return ex ? ex.unit : 'Meter';
  }

  function saveLogEntry(){
    const idx = currentRound-1;
    if(!log[idx]) log[idx] = {exercise:'', amount:''};
    log[idx].exercise = exerciseSelect.value;
    log[idx].amount = amountInput.value;
    // Gewicht nur bei Übungen mit Gewichtsauswahl behalten
    if(exWeights[log[idx].exercise]){ if(!log[idx].weight) log[idx].weight = exWeights[log[idx].exercise]; }
    else delete log[idx].weight;
  }
  function updateLogPoints(){
    const el = document.getElementById('logPoints');
    const p = roundPoints(exerciseSelect.value, amountInput.value, workSec, myGender);
    el.innerHTML = p > 0 ? '<b>'+p+'</b> Punkte für diese Runde' : '';
  }
  exerciseSelect.addEventListener('change', ()=>{
    unitLabelEl.textContent = unitFor(exerciseSelect.value) || 'Meter';
    saveLogEntry();
    document.getElementById('logRecord').textContent = recordText(exerciseSelect.value);
    updateLogPoints();
  });
  amountInput.addEventListener('input', ()=>{ saveLogEntry(); updateLogPoints(); });

  function startRun(){
    showScreen('run');
    buildLane();
    currentRound = 1;
    phase = 'work';
    phaseRemaining = workSec;
    elapsedTotal = 0;
    paused = false;
    log = roundExercises.map(exId => {
      const entry = {exercise: exId || '', amount: ''};
      if(exWeights[exId]) entry.weight = exWeights[exId];
      return entry;
    });
    pauseBtn.textContent = 'Pause';
    controlsNormal.style.display = 'none';
    controlsFinal.style.display = 'none';
    requestWakeLock();
    beep(880,0.15); vibrate(120);
    render();
    tick();
  }

  // Übungsname immer einzeilig: Schrift so lange verkleinern, bis er in die Breite passt
  function fitExerciseName(){
    const el = exerciseDisplayEl.querySelector('.ex-name');
    if(!el) return;
    const max = window.innerHeight < 600 ? 30 : window.innerHeight < 720 ? 36 : 44, min = 18;
    const avail = exerciseDisplayEl.clientWidth;
    if(!avail) return;
    if(el.dataset.fitFor === avail + '|' + el.textContent) return;
    let size = max;
    el.style.fontSize = size + 'px';
    while(el.scrollWidth > avail && size > min){ size -= 2; el.style.fontSize = size + 'px'; }
    el.dataset.fitFor = avail + '|' + el.textContent;
  }
  function refitExerciseName(){ const el = exerciseDisplayEl.querySelector('.ex-name'); if(el){ el.dataset.fitFor=''; fitExerciseName(); } }
  window.addEventListener('resize', refitExerciseName);
  // erst messen, wenn die Schrift (Oswald) geladen ist – sonst stimmt die Breite nicht
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(refitExerciseName);

  function render(){
    document.getElementById('runSkipBtn').style.visibility = (phase === 'work' || phase === 'rest') ? '' : 'hidden';
    updateLane();
    exerciseDisplayEl.style.display = 'none';

    if(phase==='log-final'){
      phaseLabelEl.style.display = '';
      phaseLabelEl.textContent = 'LETZTE RUNDE';
      phaseLabelEl.className = 'phase-label log';
      clockEl.textContent = 'FERTIG';
      clockEl.className = 'clock log';
      roundOfEl.style.display = 'none';   // Rundennummer steht jetzt im Balken
      subClockEl.textContent = 'Total: '+fmt(elapsedTotal);
      controlsNormal.style.display = 'none';
      controlsFinal.style.display = 'flex';
    } else {
      phaseLabelEl.textContent = 'PAUSE';
      phaseLabelEl.className = 'phase-label rest';
      phaseLabelEl.style.display = phase==='rest' ? '' : 'none';   // während der Arbeit keine Überschrift
      clockEl.textContent = fmt(phaseRemaining);
      clockEl.className = 'clock' + (phase==='rest' ? ' rest' : '') + (phase==='work' && phaseRemaining<=3 ? ' warn' : '');
      roundOfEl.style.display = 'none';   // Rundennummer steht jetzt im Balken
      subClockEl.textContent = 'Total: '+fmt(elapsedTotal);
      controlsNormal.style.display = 'none';
      controlsFinal.style.display = 'none';

      if(phase==='work'){
        const currentEx = (log[currentRound-1]||{}).exercise || '';
        const exObj = exercises.find(e=>e.id===currentEx);
        if(exObj){
          exerciseDisplayEl.style.display = 'flex';
          const label = exObj.name+weightSuffix(log[currentRound-1]);
          if(exerciseDisplayEl.dataset.label !== label){
            exerciseDisplayEl.dataset.label = label;
            exerciseDisplayEl.innerHTML = '<div class="ex-name">'+esc(label)+'</div>';
          }
          fitExerciseName();
        }
      }
    }

    const showLog = (phase==='rest' || phase==='log-final');
    logCardEl.classList.toggle('active', showLog);
    if(showLog){
      logRoundNumEl.textContent = currentRound;
      const entry = log[currentRound-1] || {exercise:'', amount:''};
      exerciseSelect.value = entry.exercise;
      amountInput.value = entry.amount;
      unitLabelEl.textContent = unitFor(entry.exercise) || 'Meter';
      document.getElementById('logRecord').textContent = recordText(entry.exercise);
      updateLogPoints();
    }

    refreshRunPlan();
  }

  function tick(){
    clearInterval(timerId);
    timerId = setInterval(()=>{
      if(paused || phase==='log-final') return;
      phaseRemaining -= 1;
      elapsedTotal += 1;

      if(phaseRemaining <= 3 && phaseRemaining > 0 && phase==='work'){
        beep(660,0.08,0.12);
      }

      if(phaseRemaining <= 0){
        advancePhase();
        return;
      }
      render();
    }, 1000);
  }

  function advancePhase(){
    if(phase==='work'){
      if(currentRound >= rounds){
        phase = 'log-final';
        beep(988,0.15); vibrate(200);
        render();
        return;
      }
      phase = 'rest';
      phaseRemaining = restSec;
      beep(520,0.2); vibrate([80,60,80]);
      render();
      return;
    }
    if(phase==='rest'){
      currentRound += 1;
      phase = 'work';
      phaseRemaining = workSec;
      beep(880,0.2); vibrate(150);
      render();
      return;
    }
  }

  // Endübersicht: jeder Wert lässt sich antippen und nachtragen/korrigieren
  let lastSavedSessionId = null;
  let finishSavePromise = null;
  let finishEditing = -1;
  const PENCIL_SM = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  function hasAmount(entry){ const n = parseFloat(entry && entry.amount); return !isNaN(n) && n > 0; }

  function buildFinishLog(){
    const container = document.getElementById('finishLog');
    container.innerHTML = '';
    let any = false, total = 0, missing = 0;
    log.forEach((entry, i)=>{
      if(!entry || !entry.exercise) return;
      any = true;
      const ex = exercises.find(e=>e.id===entry.exercise);
      const pts = roundPoints(entry.exercise, entry.amount, workSec, myGender);
      total += pts;
      if(!hasAmount(entry)) missing++;
      const row = document.createElement('div');
      row.className = 'finish-log-row';
      let amtHtml;
      if(i === finishEditing){
        amtHtml = '<span class="r-amt-edit"><input type="number" inputmode="decimal" min="0" step="any" id="finishAmtInput" value="'+esc(entry.amount||'')+'" placeholder="0">' +
                  '<button data-save="'+i+'">OK</button></span>';
      } else if(hasAmount(entry)){
        amtHtml = '<button class="r-amt-btn" data-edit="'+i+'">'+esc(entry.amount)+' '+(ex?shortUnit(entry.exercise):'')+' '+PENCIL_SM+'</button>';
      } else {
        amtHtml = '<button class="r-amt-btn missing" data-edit="'+i+'">+ nachtragen</button>';
      }
      row.innerHTML =
        '<span class="r-num">R'+(i+1)+'</span>' +
        '<span class="r-ex">'+(ex?ex.name:entry.exercise)+weightSuffix(entry)+'</span>' +
        amtHtml +
        '<span class="r-pts">'+pts+' P</span>';
      container.appendChild(row);
    });
    if(!any){
      container.innerHTML = '<div class="finish-log-empty">Keine Übungen protokolliert.</div>';
    }
    document.getElementById('finishEditHint').textContent = !any ? '' :
      (missing ? missing+(missing===1?' Runde ohne Wert':' Runden ohne Wert')+' – tippe auf „nachtragen“.' : 'Tippe auf einen Wert, um ihn zu korrigieren.');
    document.getElementById('finishPoints').innerHTML = any
      ? '<span class="fp-num">'+total+'</span><span class="fp-lbl">Punkte fürs Leaderboard</span>' : '';
    const inp = document.getElementById('finishAmtInput');
    if(inp){
      inp.focus();
      inp.addEventListener('keydown', e=>{
        if(e.key==='Enter') saveFinishAmount(finishEditing);
        if(e.key==='Escape'){ finishEditing = -1; buildFinishLog(); }
      });
    }
  }

  function setFinishEditStatus(text, kind){
    const el = document.getElementById('finishEditStatus');
    el.style.color = kind==='ok' ? 'var(--chalk)' : kind==='err' ? 'var(--danger)' : 'var(--text-dim)';
    el.textContent = text;
  }

  document.getElementById('finishLog').addEventListener('click', e=>{
    const ed = e.target.closest('[data-edit]');
    if(ed){ finishEditing = Number(ed.dataset.edit); setFinishEditStatus(''); buildFinishLog(); return; }
    const sv = e.target.closest('[data-save]');
    if(sv) saveFinishAmount(Number(sv.dataset.save));
  });

  async function saveFinishAmount(i){
    const inp = document.getElementById('finishAmtInput');
    if(!inp || !log[i]) return;
    const raw = String(inp.value).trim().replace(',', '.');
    const n = raw === '' ? 0 : parseFloat(raw);
    if(isNaN(n) || n < 0){ setFinishEditStatus('Bitte eine Zahl eingeben.', 'err'); return; }
    log[i].amount = n > 0 ? String(n) : '';
    finishEditing = -1;
    buildFinishLog();

    // Story-Daten & lokale Aufzeichnung mitziehen
    if(lastWorkout){
      lastWorkout.log = JSON.parse(JSON.stringify(log));
      lastWorkout.points = sessionPoints(log, workSec, myGender);
    }
    const cached = cachedHistory.find(h=> h.id === lastSavedSessionId);
    if(cached) cached.log = JSON.parse(JSON.stringify(log));

    if(finishSavePromise){ try{ await finishSavePromise; }catch(e){} }
    if(!lastSavedSessionId){ setFinishEditStatus('Geändert (Workout selbst wurde nicht gespeichert).', 'err'); return; }
    setFinishEditStatus('Wird gespeichert …');
    const { data, error } = await sb.from('training_sessions')
      .update({ log: log }).eq('id', lastSavedSessionId).eq('user_id', currentUser.id).select('id');
    if(error || !data || !data.length){
      setFinishEditStatus(error && !/policy|permission|row-level/i.test(error.message)
        ? 'Nicht gespeichert: ' + friendlyAuthError(error)
        : 'Nicht gespeichert – bitte einmal supabase/nachtragen.sql in Supabase ausführen.', 'err');
      return;
    }
    setFinishEditStatus('Gespeichert ✓', 'ok');
  }

  // ---------- Training nachpflegen ----------
  // Training nachpflegen: für alle angemeldeten Nutzer
  let canBackfill = true;
  function refreshBackfillButton(){
    document.getElementById('bfOpenBtn').style.display = currentUser ? '' : 'none';
  }
  const bfSheetEl = document.getElementById('bfSheet');
  const bfPlanEl = document.getElementById('bfPlan');
  const bfLogEl = document.getElementById('bfLog');
  const bfStatusEl = document.getElementById('bfStatus');
  let bfSelected = [], bfWeights = {}, bfRunFirst = true, bfLogData = [];
  function todayStr(){ const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function openBackfill(){
    bfSelected = []; bfWeights = {}; bfRunFirst = runFirst; bfLogData = [];
    const dateEl = document.getElementById('bfDate');
    dateEl.value = todayStr(); dateEl.max = todayStr();
    document.getElementById('bfStep1').style.display = '';
    document.getElementById('bfStep2').style.display = 'none';
    setStatus(bfStatusEl, '');
    renderBfPlan();
    bfSheetEl.scrollTop = 0;
    bfSheetEl.classList.add('open'); bfSheetEl.setAttribute('aria-hidden','false');
  }
  function closeBackfill(){ bfSheetEl.classList.remove('open'); bfSheetEl.setAttribute('aria-hidden','true'); }
  function renderBfPlan(){
    bfPlanEl.innerHTML = exercises.filter(ex=> ex.id !== RUN_ID).map(ex=>{
      const idx = bfSelected.indexOf(ex.id);
      return '<button class="ex-tile'+(idx>=0?' on':'')+'" data-ex="'+ex.id+'">' +
        (idx>=0 ? '<span class="ex-num">'+(idx+1)+'</span>' : '') +
        '<span class="ex-name">'+ex.name+'</span>' +
        (idx>=0 && bfWeights[ex.id] ? '<span class="ex-weight" data-weight="'+ex.id+'">'+fmtWeight(ex.id, bfWeights[ex.id])+'</span>' : '') +
      '</button>';
    }).join('');
    document.getElementById('bfCount').textContent = bfSelected.length ? bfSelected.length+(bfSelected.length===1?' Station':' Stationen') : '';
    document.querySelectorAll('#bfRunSeg button').forEach(b=> b.classList.toggle('active', (b.dataset.run === 'first') === bfRunFirst));
  }
  bfPlanEl.addEventListener('click', e=>{
    const w = e.target.closest('.ex-weight');
    if(w){ openWeightPicker(w.dataset.weight, false, (id, kg)=>{ bfWeights[id] = kg; renderBfPlan(); }); return; }
    const tile = e.target.closest('.ex-tile');
    if(!tile) return;
    const id = tile.dataset.ex, idx = bfSelected.indexOf(id);
    if(idx >= 0){ bfSelected.splice(idx, 1); renderBfPlan(); return; }
    if(WEIGHT_OPTIONS[id]){ openWeightPicker(id, false, (pid, kg)=>{ bfWeights[pid] = kg; bfSelected.push(pid); renderBfPlan(); }); return; }
    bfSelected.push(id); renderBfPlan();
  });
  document.getElementById('bfRunSeg').addEventListener('click', e=>{
    const b = e.target.closest('button[data-run]');
    if(!b) return;
    bfRunFirst = b.dataset.run === 'first'; renderBfPlan();
  });
  document.getElementById('bfNext').addEventListener('click', ()=>{
    const date = document.getElementById('bfDate').value;
    if(!date){ setStatus(bfStatusEl, 'Bitte ein Datum wählen.', 'err'); return; }
    if(date > todayStr()){ setStatus(bfStatusEl, 'Das Datum liegt in der Zukunft.', 'err'); return; }
    if(!bfSelected.length){ setStatus(bfStatusEl, 'Bitte mindestens eine Station wählen.', 'err'); return; }
    setStatus(bfStatusEl, '');
    bfLogData = [];
    bfSelected.forEach(st=>{
      const station = { exercise: st, amount: '' };
      if(bfWeights[st]) station.weight = bfWeights[st];
      const run = { exercise: RUN_ID, amount: '' };
      if(bfRunFirst) bfLogData.push(run, station); else bfLogData.push(station, run);
    });
    const d = new Date(date + 'T12:00:00');
    document.getElementById('bfSum').textContent =
      d.toLocaleDateString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'}) + ' · ' + bfLogData.length + ' Runden · ' + fmtMin(WORK_DEFAULT) + ' Arbeit';
    renderBfLog();
    document.getElementById('bfStep1').style.display = 'none';
    document.getElementById('bfStep2').style.display = '';
    bfSheetEl.scrollTop = 0;
  });
  function renderBfLog(){
    bfLogEl.innerHTML = bfLogData.map((entry, i)=>{
      const ex = exercises.find(e=>e.id===entry.exercise);
      const pts = roundPoints(entry.exercise, entry.amount, WORK_DEFAULT, myGender);
      return '<div class="finish-log-row">' +
        '<span class="r-num">R'+(i+1)+'</span>' +
        '<span class="r-ex">'+(ex?ex.name:entry.exercise)+weightSuffix(entry)+'</span>' +
        '<input type="number" inputmode="decimal" min="0" step="any" placeholder="0" data-i="'+i+'" value="'+esc(entry.amount)+'">' +
        '<span class="bf-unit">'+shortUnit(entry.exercise)+'</span>' +
        '<span class="r-pts" data-pts="'+i+'">'+pts+' P</span>' +
      '</div>';
    }).join('');
    updateBfPoints();
  }
  function updateBfPoints(){
    const total = sessionPoints(bfLogData, WORK_DEFAULT, myGender);
    document.getElementById('bfPoints').innerHTML = '<span class="fp-num">'+total+'</span><span class="fp-lbl">Punkte fürs Leaderboard</span>';
  }
  bfLogEl.addEventListener('input', e=>{
    const inp = e.target.closest('input[data-i]');
    if(!inp) return;
    const i = Number(inp.dataset.i);
    const n = parseFloat(String(inp.value).replace(',', '.'));
    bfLogData[i].amount = (!isNaN(n) && n > 0) ? String(n) : '';
    const ptsEl = bfLogEl.querySelector('[data-pts="'+i+'"]');
    if(ptsEl) ptsEl.textContent = roundPoints(bfLogData[i].exercise, bfLogData[i].amount, WORK_DEFAULT, myGender) + ' P';
    updateBfPoints();
  });
  document.getElementById('bfToStep1').addEventListener('click', ()=>{
    document.getElementById('bfStep2').style.display = 'none';
    document.getElementById('bfStep1').style.display = '';
    setStatus(bfStatusEl, '');
  });
  document.getElementById('bfSave').addEventListener('click', async ()=>{
    if(!currentUser) return;
    if(!bfLogData.some(e=> parseFloat(e.amount) > 0)){ setStatus(bfStatusEl, 'Bitte mindestens einen Wert eintragen.', 'err'); return; }
    const btn = document.getElementById('bfSave');
    btn.disabled = true;
    setStatus(bfStatusEl, 'Wird gespeichert …');
    const date = document.getElementById('bfDate').value;
    const n = bfLogData.length;
    const payload = {
      user_id: currentUser.id,
      date: new Date(date + 'T12:00:00').toISOString(),
      rounds: n, work_sec: WORK_DEFAULT, rest_sec: REST_DEFAULT,
      total_sec: n * WORK_DEFAULT + Math.max(0, n - 1) * REST_DEFAULT,
      log: bfLogData
    };
    const { error } = await sb.from('training_sessions').insert(payload).select().single();
    btn.disabled = false;
    if(error){ setStatus(bfStatusEl, 'Nicht gespeichert: ' + esc(friendlyAuthError(error)), 'err'); return; }
    closeBackfill();
    await refreshCachedHistory();
    renderRecords();
  });
  document.getElementById('bfOpenBtn').addEventListener('click', openBackfill);
  document.getElementById('bfBack').addEventListener('click', closeBackfill);

  // ---------- Trainingsaufzeichnungen (Supabase) ----------
  function loadHistory(){
    return cachedHistory;
  }

  let lastHistoryError = null;

  async function refreshCachedHistory(){
    lastHistoryError = null;
    if(!currentUser){ cachedHistory = []; return; }
    const { data, error } = await sb
      .from('training_sessions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date', { ascending:false });
    if(error){
      console.error('Fehler beim Laden des Trainingsverlaufs:', error);
      lastHistoryError = error.message;
      return;
    }
    cachedHistory = (data||[]).map(row=>({
      id: row.id,
      date: row.date,
      rounds: row.rounds,
      workSec: row.work_sec,
      restSec: row.rest_sec,
      totalSec: row.total_sec,
      log: row.log || []
    }));
  }

  async function saveHistory(){
    if(!currentUser){
      return { ok:false, message:'Nicht angemeldet – Workout kann nicht gespeichert werden.' };
    }
    const payload = {
      user_id: currentUser.id,
      date: new Date().toISOString(),
      rounds: rounds,
      work_sec: workSec,
      rest_sec: restSec,
      total_sec: elapsedTotal,
      log: log
    };
    const { data, error } = await sb.from('training_sessions').insert(payload).select().single();
    if(error){
      console.error('Fehler beim Speichern des Workouts:', error);
      return { ok:false, message: error.message };
    }
    lastSavedSessionId = data.id;
    cachedHistory.unshift({
      id: data.id,
      date: data.date,
      rounds: data.rounds,
      workSec: data.work_sec,
      restSec: data.rest_sec,
      totalSec: data.total_sec,
      log: data.log || []
    });
    return { ok:true };
  }

  function renderBests(){
    const hist = loadHistory();
    const pbMap = {};
    hist.forEach(session=>{
      (session.log||[]).forEach(entry=>{
        if(!entry.exercise) return;
        const amt = parseFloat(entry.amount);
        if(!amt || isNaN(amt)) return;
        if(!pbMap[entry.exercise] || amt > pbMap[entry.exercise]) pbMap[entry.exercise] = amt;
      });
    });
    const pbGrid = document.getElementById('pbGrid');
    const used = exercises.filter(ex=> pbMap[ex.id]);
    if(!used.length){
      pbGrid.innerHTML = lastHistoryError
        ? '<div class="history-empty" style="color:var(--danger);">Fehler beim Laden: '+esc(lastHistoryError)+'</div>'
        : '<div class="history-empty">Noch keine Bestleistungen erfasst.</div>';
      return;
    }
    pbGrid.innerHTML = used.map(ex=>
      '<div class="pb-row"><span>'+esc(ex.name)+'</span><b>'+
        pbMap[ex.id].toLocaleString('de-DE',{maximumFractionDigits:1})+' '+esc(ex.unit)+'</b></div>'
    ).join('');
  }

  function renderRecords(){
    const hist = loadHistory();
    const list = document.getElementById('historyList');
    list.innerHTML = '';
    if(hist.length === 0){
      list.innerHTML = lastHistoryError
        ? '<div class="history-empty" style="color:var(--danger);">Fehler beim Laden: '+lastHistoryError+'</div>'
        : '<div class="history-empty">Noch keine Workouts gespeichert.</div>';
      return;
    }
    hist.forEach(session=>{
      const card = document.createElement('div');
      card.className = 'session-card';
      const d = new Date(session.date);
      const dateStr = d.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}) +
        ' · ' + d.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});

      let rows = '';
      (session.log||[]).forEach((entry,i)=>{
        if(!entry.exercise) return;
        const ex = exercises.find(e=>e.id===entry.exercise);
        const pts = roundPoints(entry.exercise, entry.amount, session.workSec, myGender);
        rows += '<div class="session-log-row"><span>R'+(i+1)+' · '+(ex?ex.name:entry.exercise)+weightSuffix(entry)+'</span><span>'+
          (entry.amount||'0')+' '+(ex?ex.unit:'')+' <span class="sl-pts">· '+pts+' P</span></span></div>';
      });
      const sessPts = sessionPoints(session.log, session.workSec, myGender);
      if(!rows) rows = '<div class="session-empty">Keine Übungen protokolliert.</div>';

      card.innerHTML =
        '<div class="session-top">' +
          '<div class="session-head">' +
            '<span class="session-date">'+dateStr+(sessPts>0?' · <span class="sess-pts">'+sessPts+' Punkte</span>':'')+'</span>' +
            '<span class="session-meta">'+session.rounds+' Runden · '+fmtMin(session.workSec)+' Arbeit · '+session.restSec+'s Pause · Gesamt '+fmt(session.totalSec)+'</span>' +
          '</div>' +
          '<button class="session-delete" data-id="'+session.id+'" title="Dieses Training löschen">'+trashIconSvg+'</button>' +
        '</div>' + rows;
      list.appendChild(card);
    });

    list.querySelectorAll('.session-delete').forEach(btn=>{
      btn.addEventListener('click', ()=> deleteSession(btn.getAttribute('data-id'), btn));
    });
  }

  async function deleteSession(sessionId, btn){
    if(btn.dataset.armed === '1'){
      const { error } = await sb.from('training_sessions').delete().eq('id', sessionId);
      if(error){ console.error('Fehler beim Löschen des Workouts:', error.message); return; }
      cachedHistory = cachedHistory.filter(s => String(s.id) !== String(sessionId));
      renderRecords();
      return;
    }
    btn.dataset.armed = '1';
    btn.classList.add('confirm');
    btn.title = 'Nochmal tippen zum endgültigen Löschen';
    if(btn._armTimeout) clearTimeout(btn._armTimeout);
    btn._armTimeout = setTimeout(()=>{
      btn.dataset.armed = '';
      btn.classList.remove('confirm');
      btn.title = 'Dieses Training löschen';
    }, 3000);
  }

  document.getElementById('clearHistoryBtn').addEventListener('click', async ()=>{
    if(!currentUser) return;
    if(confirm('Gesamte Trainingsaufzeichnungen und Bestleistungen wirklich löschen?')){
      const { error } = await sb.from('training_sessions').delete().eq('user_id', currentUser.id);
      if(error){ console.error('Fehler beim Löschen des Verlaufs:', error.message); return; }
      cachedHistory = [];
      renderRecords();
    }
  });

  async function finishRun(){
    saveLogEntry();
    clearInterval(timerId);
    releaseWakeLock();
    beep(988,0.12); setTimeout(()=>beep(1318,0.25),140);
    vibrate([120,80,120,80,200]);
    showScreen('finish');
    lastWorkout = {
      rounds, workSec, restSec, elapsed: elapsedTotal, date: new Date(),
      log: JSON.parse(JSON.stringify(log || [])),
      points: sessionPoints(log, workSec, myGender)
    };
    resetPostCta();
    finishEditing = -1;
    lastSavedSessionId = null;
    setFinishEditStatus('');
    document.getElementById('finishSummary').textContent =
      rounds+' Runden · '+fmtMin(workSec)+' Arbeit · '+restSec+'s Pause · Gesamt '+fmt(elapsedTotal);
    buildFinishLog();

    const statusEl = document.getElementById('finishSaveStatus');
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--text-dim)';
    statusEl.textContent = 'Wird gespeichert …';

    finishSavePromise = saveHistory();
    const result = await finishSavePromise;
    if(result.ok){
      statusEl.style.color = 'var(--chalk)';
      statusEl.textContent = 'In deinen Trainingsaufzeichnungen gespeichert.';
      host('onSaved', lastWorkout);
    } else {
      statusEl.style.color = 'var(--danger)';
      statusEl.textContent = 'Nicht gespeichert: ' + result.message;
    }
  }

  document.getElementById('startBtn').addEventListener('click', startRun);

  // =================================================================
  // 24-STUNDEN-POSTS (Supabase: Tabelle posts + privater Speicher "posts", siehe supabase/posts.sql)
  // =================================================================
  let lastWorkout = null;
  let postPhoto = null;           // geladenes Foto (Image)
  const POST_W = 1080, POST_H = 1350;   // 4:5 wie bei Instagram
  const postSheetEl = document.getElementById('postSheet');
  const postCanvas = document.getElementById('postCanvas');
  const postCamInput = document.getElementById('postCamInput');
  const postStatsToggle = document.getElementById('postStatsToggle');
  const postStatusEl = document.getElementById('postStatus');
  const postCta = document.getElementById('postCreateBtn');

  function resetPostCta(){
    postCta.disabled = false;
    postCta.classList.remove('done');
    postCta.querySelector('span').innerHTML = 'Story posten <small>· 24 h sichtbar</small>';
  }
  function setPostStatus(t, kind){
    postStatusEl.style.color = kind==='ok' ? 'var(--chalk)' : kind==='err' ? 'var(--danger)' : 'var(--text-dim)';
    postStatusEl.textContent = t;
  }

  postCta.addEventListener('click', ()=>{ postCamInput.value=''; postCamInput.click(); });
  document.getElementById('postRetake').addEventListener('click', ()=>{ postCamInput.value=''; postCamInput.click(); });
  document.getElementById('postClose').addEventListener('click', closePostSheet);
  function closePostSheet(){ postSheetEl.classList.remove('open'); postSheetEl.setAttribute('aria-hidden','true'); }

  postCamInput.addEventListener('change', ()=>{
    const file = postCamInput.files && postCamInput.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async ()=>{
      postPhoto = img;
      try{ await document.fonts.ready; }catch(e){}
      drawPost();
      setPostStatus('');
      postSheetEl.classList.add('open');
      postSheetEl.setAttribute('aria-hidden','false');
    };
    img.onerror = ()=> alert('Dieses Bild kann nicht geöffnet werden. Bitte ein anderes Foto wählen.');
    img.src = url;
  });
  postStatsToggle.addEventListener('change', drawPost);

  // Text auf eine Breite kürzen
  function fitText(ctx, text, maxW){
    if(ctx.measureText(text).width <= maxW) return text;
    while(text.length > 1 && ctx.measureText(text+'…').width > maxW) text = text.slice(0,-1);
    return text+'…';
  }

  function drawPost(){
    const ctx = postCanvas.getContext('2d');
    ctx.clearRect(0,0,POST_W,POST_H);
    ctx.fillStyle = '#1a1d21'; ctx.fillRect(0,0,POST_W,POST_H);
    if(postPhoto){
      // Foto füllt das Bild (mittig zugeschnitten)
      const s = Math.max(POST_W/postPhoto.naturalWidth, POST_H/postPhoto.naturalHeight);
      const w = postPhoto.naturalWidth*s, h = postPhoto.naturalHeight*s;
      ctx.drawImage(postPhoto, (POST_W-w)/2, (POST_H-h)/2, w, h);
    }
    if(!postStatsToggle.checked || !lastWorkout) return;

    const W = lastWorkout, pad = 64;
    // Verläufe für Lesbarkeit
    let g = ctx.createLinearGradient(0, POST_H*0.42, 0, POST_H);
    g.addColorStop(0, 'rgba(10,11,13,0)'); g.addColorStop(0.45, 'rgba(10,11,13,0.55)'); g.addColorStop(1, 'rgba(10,11,13,0.85)');
    ctx.fillStyle = g; ctx.fillRect(0, POST_H*0.42, POST_W, POST_H*0.58);
    g = ctx.createLinearGradient(0, 0, 0, 220);
    g.addColorStop(0, 'rgba(10,11,13,0.6)'); g.addColorStop(1, 'rgba(10,11,13,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, POST_W, 220);

    // oben: Name + Datum
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px Inter, sans-serif';
    ctx.fillText('FRIDAY ', pad, 100);
    let x = pad + ctx.measureText('FRIDAY ').width;
    ctx.fillStyle = '#ff5a1f'; ctx.fillText('FITNESS ', x, 100);
    x += ctx.measureText('FITNESS ').width;
    ctx.fillStyle = '#ffffff'; ctx.fillText('CIRCLE', x, 100);
    ctx.font = '600 28px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(W.date.toLocaleDateString('de-DE',{weekday:'long', day:'2-digit', month:'2-digit', year:'numeric'}), pad, 142);

    // unten: Stationen (ohne Laufen) + Laufdistanz
    const stations = (W.log||[]).filter(e=> e && e.exercise && e.exercise !== 'run');
    const runMeters = (W.log||[]).filter(e=> e && e.exercise === 'run').reduce((sum,e)=> sum + (parseFloat(e.amount)||0), 0);
    const lines = stations.map(e=>{
      const ex = exercises.find(x=>x.id===e.exercise);
      const amt = parseFloat(e.amount);
      return [(ex?ex.name:e.exercise) + weightSuffix(e), amt>0 ? amt.toLocaleString('de-DE')+' '+shortUnit(e.exercise) : '–'];
    });
    if(runMeters > 0) lines.unshift(['Laufen', (runMeters/1000).toLocaleString('de-DE',{maximumFractionDigits:2})+' km']);
    const shown = lines.slice(0, 5);
    const more = lines.length - shown.length;

    let y = POST_H - pad;
    ctx.font = '600 30px Inter, sans-serif';
    if(more > 0){ ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('+ '+more+' weitere', pad, y); y -= 48; }
    for(let i = shown.length-1; i >= 0; i--){
      const [name, val] = shown[i];
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.font = '600 32px Inter, sans-serif';
      ctx.fillText(fitText(ctx, name, POST_W - pad*2 - 260), pad, y);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 32px Inter, sans-serif';
      const vw = ctx.measureText(val).width; ctx.fillText(val, POST_W - pad - vw, y);
      y -= 50;
    }
    // Trennlinie
    y -= 6;
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(pad, y, POST_W - pad*2, 2);
    y -= 40;

    // Runden · Zeit
    ctx.font = '600 34px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(W.rounds+' Runden  ·  '+fmtMin(W.workSec)+' Arbeit  ·  Gesamt '+fmt(W.elapsed), pad, y);
    y -= 30;

    // Punkte groß
    ctx.font = '900 168px Inter, sans-serif'; ctx.fillStyle = '#ff5a1f';
    const pts = String(W.points);
    ctx.fillText(pts, pad - 6, y);
    const pw = ctx.measureText(pts).width;
    ctx.font = '800 40px Inter, sans-serif'; ctx.fillStyle = '#ffffff';
    ctx.fillText('PUNKTE', pad + pw + 18, y - 16);
  }

  document.getElementById('postPublish').addEventListener('click', async ()=>{
    if(!currentUser || !postPhoto) return;
    const btn = document.getElementById('postPublish');
    btn.disabled = true;
    setPostStatus('Wird hochgeladen …');
    try{
      const blob = await new Promise((res, rej)=> postCanvas.toBlob(b=> b ? res(b) : rej(new Error('Bild konnte nicht erstellt werden.')), 'image/jpeg', 0.85));
      const path = currentUser.id + '/' + Date.now() + '.jpg';
      const up = await sb.storage.from('posts').upload(path, blob, { contentType:'image/jpeg', upsert:false });
      if(up.error) throw up.error;
      const ins = await sb.from('posts').insert({ path });
      if(ins.error){ await sb.storage.from('posts').remove([path]); throw ins.error; }
      closePostSheet();
      postCta.disabled = true;
      postCta.classList.add('done');
      postCta.querySelector('span').textContent = 'Story gepostet ✓ – 24 h sichtbar';
    } catch(err){
      const m = (err && err.message) || String(err);
      setPostStatus(/bucket|not found|relation|posts|policy|row-level/i.test(m)
        ? 'Posts sind noch nicht eingerichtet – bitte supabase/posts.sql in Supabase ausführen.'
        : 'Nicht gepostet: ' + friendlyAuthError(err), 'err');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Feed in Connect ----------
  const postStripEl = document.getElementById('postStrip');
  let feedPosts = [];
  function timeAgo(iso){
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime())/60000));
    if(min < 1) return 'gerade eben';
    if(min < 60) return 'vor '+min+' Min.';
    return 'vor '+Math.floor(min/60)+' Std.';
  }
  function timeLeft(iso){
    const h = Math.max(0, 24 - (Date.now() - new Date(iso).getTime())/3600000);
    return h >= 1 ? 'noch '+Math.floor(h)+' Std.' : 'noch '+Math.max(1,Math.round(h*60))+' Min.';
  }

  const EYE_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  let storyUsers = [];   // [{uid, nickname, avatar_url, is_me, posts:[alt → neu]}]
  const storyHintEl = document.getElementById('storyHint');
  let storyHintTimer = null;
  function showStoryHint(text){
    storyHintEl.textContent = text;
    clearTimeout(storyHintTimer);
    storyHintTimer = setTimeout(()=>{ storyHintEl.textContent = ''; }, 4000);
  }

  async function loadFeed(){
    const { data, error } = await sb.rpc('feed_posts');
    if(error){
      feedPosts = [];
      buildStories();
      showStoryHint(isSetupMissing(error)
        ? 'Stories sind noch nicht eingerichtet – supabase/posts.sql in Supabase ausführen.'
        : 'Stories konnten nicht geladen werden.');
      return;
    }
    feedPosts = data || [];
    if(feedPosts.length){
      // private Bilder: zeitlich begrenzte Links holen
      const signed = await sb.storage.from('posts').createSignedUrls(feedPosts.map(p=>p.path), 3600);
      const urlOf = {};
      ((signed && signed.data) || []).forEach(s=>{ if(s && s.signedUrl) urlOf[s.path] = s.signedUrl; });
      feedPosts.forEach(p=>{ p.url = urlOf[p.path] || null; });
    }
    buildStories();
  }

  // Posts pro Person bündeln: du zuerst, dann ungesehene, dann gesehene (jeweils neueste zuerst)
  function buildStories(){
    const byUser = new Map();
    feedPosts.filter(p=>p.url).forEach(p=>{
      if(!byUser.has(p.user_id)) byUser.set(p.user_id, { uid:p.user_id, nickname:p.nickname, avatar_url:p.avatar_url, is_me:!!p.is_me, posts:[] });
      byUser.get(p.user_id).posts.push(p);
    });
    storyUsers = Array.from(byUser.values());
    storyUsers.forEach(u=> u.posts.sort((a,b)=> new Date(a.created_at) - new Date(b.created_at)));
    const newest = u => new Date(u.posts[u.posts.length-1].created_at).getTime();
    const allSeen = u => u.is_me || u.posts.every(p=>p.seen);
    storyUsers.sort((a,b)=>
      (b.is_me - a.is_me) || (allSeen(a) - allSeen(b)) || (newest(b) - newest(a)));
    renderStoryBar();
  }

  function renderStoryBar(){
    const me = storyUsers.find(u=>u.is_me);
    const myName = (profileNicknameEl.value || '').trim();
    let html = '';
    if(me){
      html += '<button class="story" data-u="'+storyUsers.indexOf(me)+'">' +
        '<span class="story-ring"><span class="avatar">'+avatarHtml(myAvatarUrl || myStoryAvatar || me.avatar_url, myName || me.nickname)+'</span></span>' +
        '<span class="story-name">Deine Story</span></button>';
    } else {
      html += '<button class="story" data-u="add">' +
        '<span class="story-ring none"><span class="avatar">'+avatarHtml(myAvatarUrl || myStoryAvatar, myName || (currentUser && currentUser.email))+'</span></span>' +
        '<span class="story-add">+</span>' +
        '<span class="story-name dim">Deine Story</span></button>';
    }
    storyUsers.forEach((u,i)=>{
      if(u.is_me) return;
      const seen = u.posts.every(p=>p.seen);
      html += '<button class="story" data-u="'+i+'">' +
        '<span class="story-ring'+(seen?' seen':'')+'"><span class="avatar">'+avatarHtml(u.avatar_url, u.nickname)+'</span></span>' +
        '<span class="story-name'+(seen?' dim':'')+'">'+esc(u.nickname)+'</span></button>';
    });
    postStripEl.innerHTML = html;
    host('onStories');
  }

  // eigene abgelaufene Bilder aus dem Speicher löschen (falls kein Aufräum-Job läuft)
  async function cleanupOwnPosts(){
    if(!currentUser) return;
    try{
      const cutoff = Date.now() - 24*3600*1000;
      const { data } = await sb.storage.from('posts').list(currentUser.id, { limit: 100 });
      const old = (data || []).filter(f=> f.created_at && new Date(f.created_at).getTime() < cutoff).map(f=> currentUser.id+'/'+f.name);
      if(old.length) await sb.storage.from('posts').remove(old);
      await sb.from('posts').delete().eq('user_id', currentUser.id).lt('created_at', new Date(cutoff).toISOString());
    }catch(e){}
  }

  // ---------- Story-Ansicht (wie Instagram: antippen = weiter, links = zurück) ----------
  const postViewerEl = document.getElementById('postViewer');
  const pvProgressEl = document.getElementById('pvProgress');
  const STORY_MS = 6000;
  let viewing = null;
  let storyU = -1, storyP = 0;
  let storyElapsed = 0, storyLast = 0, storyRaf = 0;

  postStripEl.addEventListener('click', e=>{
    const btn = e.target.closest('.story');
    if(!btn || btn.dataset.u === undefined) return;
    if(btn.dataset.u === 'add'){
      showStoryHint('Deine Story postest du am Ende eines Workouts – mit Foto und deinen Trainingsstats.');
      return;
    }
    const u = storyUsers[Number(btn.dataset.u)];
    if(!u) return;
    const firstUnseen = u.is_me ? 0 : u.posts.findIndex(p=>!p.seen);
    openStory(Number(btn.dataset.u), firstUnseen < 0 ? 0 : firstUnseen);
  });

  function openStory(ui, pi){
    storyU = ui; storyP = pi;
    postViewerEl.classList.add('open');
    postViewerEl.setAttribute('aria-hidden','false');
    showStoryPost();
  }

  function showStoryPost(){
    const u = storyUsers[storyU];
    const p = u.posts[storyP];
    viewing = p;
    pvProgressEl.innerHTML = u.posts.map((_,i)=> '<span><i style="width:'+(i<storyP?100:0)+'%"></i></span>').join('');
    document.getElementById('pvImg').src = p.url;
    document.getElementById('pvAvatar').innerHTML = avatarHtml(p.avatar_url, p.nickname);
    document.getElementById('pvName').textContent = p.is_me ? 'Du' : p.nickname;
    document.getElementById('pvAvatar').classList.add('tap');
    document.getElementById('pvName').classList.add('tap');
    document.getElementById('pvTime').textContent = timeAgo(p.created_at) + ' · ' + timeLeft(p.created_at);
    const del = document.getElementById('pvDelete');
    del.style.display = p.is_me ? '' : 'none';
    del.textContent = 'Löschen'; del.dataset.armed = '';
    pvSheetEl.classList.remove('open');
    const vb = document.getElementById('pvViewsBtn');
    vb.style.visibility = p.is_me ? 'visible' : 'hidden';
    if(p.is_me){
      setViewsLabel(p.view_count);
      refreshViewers(p);
    } else if(!p.seen){
      p.seen = true;   // sofort als gesehen markieren (Ring wird grau)
      sb.rpc('mark_post_viewed', { p_post_id: p.id }).then(()=>{}, ()=>{});
    }
    startStoryTimer();
  }

  let storySwipe = null;   // Nach-unten-Wischen zum Schließen
  function storyPaused(){
    return !!storySwipe || pvSheetEl.classList.contains('open') || fpSheetEl.classList.contains('open') ||
           document.getElementById('pvDelete').dataset.armed === '1';
  }
  function startStoryTimer(){
    cancelAnimationFrame(storyRaf);
    storyElapsed = 0; storyLast = performance.now();
    const tick = now=>{
      if(!postViewerEl.classList.contains('open')) return;
      if(!storyPaused()) storyElapsed += now - storyLast;
      storyLast = now;
      const bar = pvProgressEl.children[storyP];
      if(bar) bar.firstChild.style.width = Math.min(100, storyElapsed / STORY_MS * 100) + '%';
      if(storyElapsed >= STORY_MS){ nextStory(); return; }
      storyRaf = requestAnimationFrame(tick);
    };
    storyRaf = requestAnimationFrame(tick);
  }
  function nextStory(){
    const u = storyUsers[storyU];
    if(u && storyP + 1 < u.posts.length){ storyP++; showStoryPost(); return; }
    // nächste Person mit ungesehenen Posts (wie bei Instagram)
    for(let i = storyU + 1; i < storyUsers.length; i++){
      const n = storyUsers[i];
      if(n.is_me) continue;
      const first = n.posts.findIndex(p=>!p.seen);
      if(first >= 0){ storyU = i; storyP = first; showStoryPost(); return; }
    }
    closeViewer();
  }
  function prevStory(){
    if(storyP > 0){ storyP--; showStoryPost(); return; }
    if(storyU > 0 && !storyUsers[storyU-1].is_me){ storyU--; storyP = storyUsers[storyU].posts.length - 1; showStoryPost(); return; }
    showStoryPost();   // ersten Post neu starten
  }
  document.getElementById('pvStage').addEventListener('click', e=>{
    if(storySwipeJustEnded){ storySwipeJustEnded = false; return; }   // war ein Wischen, kein Tippen
    if(!viewing || storyPaused()) return;
    const r = e.currentTarget.getBoundingClientRect();
    if(e.clientX - r.left < r.width / 3) prevStory(); else nextStory();
  });

  // ---------- "Gesehen von" (nur eigene Posts) ----------
  const pvSheetEl = document.getElementById('pvSheet');
  const pvListEl = document.getElementById('pvList');
  let viewersOf = null;
  function setViewsLabel(n){
    document.getElementById('pvViewsLabel').textContent = (n == null) ? 'Gesehen von …' : 'Gesehen von ' + n;
  }
  async function refreshViewers(p){
    viewersOf = null;
    const { data, error } = await sb.rpc('post_viewers', { p_post_id: p.id });
    if(viewing !== p) return;
    if(error){
      pvListEl.innerHTML = isSetupMissing(error)
        ? '<div class="pv-none">Noch nicht eingerichtet – <b>supabase/posts_views.sql</b> in Supabase ausführen.</div>'
        : '<div class="pv-none">Konnte nicht geladen werden.</div>';
      setViewsLabel(p.view_count);
      return;
    }
    viewersOf = data || [];
    p.view_count = viewersOf.length;
    setViewsLabel(viewersOf.length);
    pvListEl.innerHTML = viewersOf.length
      ? viewersOf.map(v=>
          '<div class="pv-row"><span class="avatar">'+avatarHtml(v.avatar_url, v.nickname)+'</span>' +
          '<b>'+esc(v.nickname)+'</b><small>'+timeAgo(v.viewed_at)+'</small></div>'
        ).join('')
      : '<div class="pv-none">Noch hat keiner deiner Freunde den Post gesehen.</div>';
  }
  document.getElementById('pvViewsBtn').addEventListener('click', ()=>{
    if(!viewing || !viewing.is_me) return;
    document.getElementById('pvSheetTitle').textContent = 'Gesehen von' + (viewersOf ? ' (' + viewersOf.length + ')' : '');
    pvSheetEl.classList.add('open');
  });
  document.getElementById('pvSheetClose').addEventListener('click', ()=> pvSheetEl.classList.remove('open'));

  ['pvAvatar','pvName'].forEach(id=> document.getElementById(id).addEventListener('click', ()=>{
    if(viewing && viewing.user_id) openFriendProfile(viewing.user_id);
  }));

  // ---------- Profil von Freunden (Supabase-Funktion aus supabase/freundesprofil.sql) ----------
  const fpSheetEl = document.getElementById('fpSheet');
  const fpBodyEl = document.getElementById('fpBody');
  let fpOpenFor = null;
  function fmtBest(exId, amount){
    const ex = exercises.find(e=>e.id===exId);
    const n = Number(amount);
    const val = n.toLocaleString('de-DE',{maximumFractionDigits:1});
    return '<div class="pb-card"><div class="pb-ex">'+esc(ex?ex.name:exId)+'</div><div class="pb-val">'+val+' '+esc(ex?ex.unit:'')+'</div></div>';
  }
  async function openFriendProfile(uid){
    if(!uid) return;
    fpOpenFor = uid;
    fpBodyEl.innerHTML = '<div class="history-empty">Lädt …</div>';
    fpSheetEl.scrollTop = 0;
    fpSheetEl.classList.add('open');
    fpSheetEl.setAttribute('aria-hidden','false');
    const { data, error } = await sb.rpc('friend_profile', { p_user_id: uid });
    if(fpOpenFor !== uid) return;
    if(error){
      fpBodyEl.innerHTML = '<div class="lb-hint'+(isSetupMissing(error)?'':' error')+'">'+
        (isSetupMissing(error)
          ? 'Freundesprofile sind noch nicht eingerichtet – <b>supabase/freundesprofil.sql</b> in Supabase ausführen.'
          : esc(friendlyAuthError(error)))+'</div>';
      return;
    }
    const d = data || {};
    const order = exercises.map(e=>e.id);
    const bests = (d.bests || []).slice().sort((a,b)=>{
      const ia = order.indexOf(a.exercise), ib = order.indexOf(b.exercise);
      return (ia<0?99:ia) - (ib<0?99:ib);
    });
    const insta = d.instagram
      ? '<div class="insta-box linked"><a class="insta-link" href="https://www.instagram.com/'+encodeURIComponent(d.instagram)+'/" target="_blank" rel="noopener">' +
          '<span class="insta-label">Instagram</span><span class="insta-handle">@'+esc(d.instagram)+'</span></a></div>'
      : '<div class="fp-noinsta">Kein Instagram verknüpft</div>';
    fpBodyEl.innerHTML =
      '<div class="fp-head">' +
        '<span class="avatar">'+avatarHtml(d.avatar_url, d.nickname)+'</span>' +
        '<div class="fp-name">'+esc(d.nickname)+(d.is_me?' <span class="fp-sub">(Du)</span>':'')+'</div>' +
        '<div class="fp-sub">'+(d.workouts||0)+' '+(d.workouts===1?'Workout':'Workouts')+' gesamt</div>' +
        insta +
      '</div>' +
      '<div class="history-section-title">Persönliche Bestleistungen</div>' +
      '<div class="pb-grid">'+(bests.length
        ? bests.map(b=>fmtBest(b.exercise, b.amount)).join('')
        : '<div class="history-empty" style="grid-column:1/-1;">Noch keine Bestleistungen erfasst.</div>')+'</div>';
  }
  function closeFriendProfile(){
    fpOpenFor = null;
    fpSheetEl.classList.remove('open');
    fpSheetEl.setAttribute('aria-hidden','true');
  }
  document.getElementById('fpClose').addEventListener('click', closeFriendProfile);

  // ---------- Story nach unten wegwischen (wie bei Instagram) ----------
  let storySwipeJustEnded = false;
  function swipeTarget(e){
    // nicht auf Buttons oder im „Gesehen von“-Fenster starten
    return !e.target.closest('button, a, .pv-sheet') && postViewerEl.classList.contains('open') && !pvSheetEl.classList.contains('open');
  }
  postViewerEl.addEventListener('pointerdown', e=>{
    if(!swipeTarget(e)) return;
    storySwipe = { id:e.pointerId, x:e.clientX, y:e.clientY, dy:0, t:performance.now(), active:false };
  });
  postViewerEl.addEventListener('pointermove', e=>{
    if(!storySwipe || e.pointerId !== storySwipe.id) return;
    const dx = e.clientX - storySwipe.x, dy = e.clientY - storySwipe.y;
    if(!storySwipe.active){
      if(dy > 10 && dy > Math.abs(dx)){ storySwipe.active = true; postViewerEl.style.transition = 'none'; }
      else if(Math.abs(dx) > 10 || dy < -10){ storySwipe = null; return; }   // seitlich/hoch: kein Schließen
      else return;
    }
    e.preventDefault();
    storySwipe.dy = Math.max(0, dy);
    const k = Math.min(1, storySwipe.dy / 400);
    postViewerEl.style.transform = 'translateY(' + storySwipe.dy + 'px) scale(' + (1 - k * 0.12) + ')';
    postViewerEl.style.borderRadius = Math.round(k * 28) + 'px';
    postViewerEl.style.opacity = String(1 - k * 0.5);
  }, { passive:false });
  function endStorySwipe(){
    if(!storySwipe) return;
    const sw = storySwipe; storySwipe = null;
    if(!sw.active) return;
    storySwipeJustEnded = true;
    setTimeout(()=>{ storySwipeJustEnded = false; }, 350);
    const fast = sw.dy / Math.max(1, performance.now() - sw.t) > 0.6;
    postViewerEl.style.transition = 'transform .22s ease, opacity .22s ease, border-radius .22s ease';
    if(sw.dy > 130 || (fast && sw.dy > 50)){
      postViewerEl.style.transform = 'translateY(100%) scale(0.85)';
      postViewerEl.style.opacity = '0';
      setTimeout(()=>{ closeViewer(); resetSwipeStyle(); }, 220);
    } else {
      postViewerEl.style.transform = ''; postViewerEl.style.opacity = ''; postViewerEl.style.borderRadius = '';
      storyLast = performance.now();   // Timer läuft ab hier weiter
      setTimeout(resetSwipeStyle, 230);
    }
  }
  function resetSwipeStyle(){
    postViewerEl.style.transition = ''; postViewerEl.style.transform = '';
    postViewerEl.style.opacity = ''; postViewerEl.style.borderRadius = '';
  }
  postViewerEl.addEventListener('pointerup', endStorySwipe);
  postViewerEl.addEventListener('pointercancel', endStorySwipe);
  // iOS: Seite soll beim Wischen nicht mitscrollen
  postViewerEl.addEventListener('touchmove', e=>{ if(storySwipe && storySwipe.active) e.preventDefault(); }, { passive:false });

  function closeViewer(){
    cancelAnimationFrame(storyRaf);
    pvSheetEl.classList.remove('open');
    postViewerEl.classList.remove('open');
    postViewerEl.setAttribute('aria-hidden','true');
    viewing = null;
    buildStories();   // gesehene Ringe grau, Reihenfolge aktualisieren
  }
  document.getElementById('pvClose').addEventListener('click', closeViewer);
  document.getElementById('pvDelete').addEventListener('click', async e=>{
    const btn = e.currentTarget;
    if(!viewing || !viewing.is_me) return;
    if(btn.dataset.armed !== '1'){ btn.dataset.armed = '1'; btn.textContent = 'Sicher?'; return; }
    await sb.storage.from('posts').remove([viewing.path]);
    await sb.from('posts').delete().eq('id', viewing.id);
    closeViewer();
    await loadFeed();
  });

  // ---------- Reihenfolge während des Workouts ändern (Zweierblöcke: z. B. Laufen + Station) ----------
  // Block b = Runden 2b+1 und 2b+2. Verschieben lässt sich alles, was noch nicht erledigt ist –
  // auch der Block, der gerade läuft. Ist die erste Runde eines Blocks schon erledigt,
  // bleibt sie stehen und nur die zweite Runde (z. B. die besetzte Station) wird verschoben.
  const planListEl = document.getElementById('planList');

  function blockCount(){ return Math.floor(log.length / 2); }
  // Anzahl Runden, die schon feststehen (erledigt bzw. gerade protokolliert)
  function fixedRounds(){
    if(phase === 'log-final') return log.length;
    return phase === 'rest' ? currentRound : currentRound - 1;
  }
  function firstMovableBlock(){ return Math.floor(fixedRounds() / 2); }
  function partialFirst(){ return fixedRounds() % 2 === 1; }   // erste Runde des Blocks schon erledigt

  // ---------- Reihenfolge direkt im Workout-Screen ----------
  // wird nur neu gezeichnet, wenn sich Runde oder Phase ändert (nicht jede Sekunde)
  let runPlanKey = '';
  function refreshRunPlan(force){
    const box = document.getElementById('runPlan');
    if(!box) return;
    if(phase === 'log-final' || !log || log.length < 2){ box.style.display = 'none'; runPlanKey = ''; clockEl.style.marginTop = ''; return; }
    box.style.display = '';
    const key = currentRound + '|' + phase + '|' + log.map(e=>e.exercise).join(',');
    if(!force && key === runPlanKey) return;
    if(drag) return;   // nicht mitten im Ziehen neu zeichnen
    runPlanKey = key;
    renderPlan();
    sizeRunPlan();
  }

  // Fenster reicht bis zum unteren Bildschirmrand; die Zeilenhöhe wird so gewählt,
  // dass genau 3 Übungsblöcke (= 6 Runden) hineinpassen – ab dem laufenden bzw. in der Pause ab dem nächsten.
  function safeBottom(){
    const probe = document.getElementById('safeProbe');
    return probe ? parseFloat(getComputedStyle(probe).paddingBottom) || 0 : 0;
  }
  function updatePlanScrollbar(){
    const bar = document.getElementById('planScrollbar'), thumb = document.getElementById('planScrollThumb');
    if(!bar) return;
    const sh = planListEl.scrollHeight, ch = planListEl.clientHeight;
    if(!ch || sh <= ch + 2){ bar.classList.add('off'); return; }
    bar.classList.remove('off');
    const h = Math.max(18, ch * ch / sh);
    const top = (ch - h) * (planListEl.scrollTop / (sh - ch));
    thumb.style.height = h + 'px';
    thumb.style.transform = 'translateY(' + top + 'px)';
  }
  planListEl.addEventListener('scroll', updatePlanScrollbar, { passive:true });

  // Feste, schlanke Zeilen; die Liste sitzt unten am Bildschirmrand und der freie Platz
  // wandert in den Abstand zwischen „Total“ und den Übungen (luftiger Look).
  const RUN_ROW_H = 38, RUN_PLAN_GAP = 22;
  function sizeRunPlan(){
    const box = document.getElementById('runPlan');
    const rows = planListEl.querySelectorAll('.plan-row');
    const blocks = Array.from(planListEl.querySelectorAll('.plan-block'));
    if(!rows.length || !blocks.length || !box) return;
    const startRow = rows[Math.min(rows.length - 1, phase === 'rest' ? currentRound : currentRound - 1)];
    const si = Math.max(0, blocks.indexOf(startRow.closest('.plan-block')));
    const ei = Math.min(blocks.length - 1, si + 2);

    box.style.setProperty('--row-h', RUN_ROW_H + 'px');
    box.style.marginTop = RUN_PLAN_GAP + 'px';
    clockEl.style.marginTop = '';
    planListEl.style.height = '';
    const a0 = blocks[si].getBoundingClientRect(), b0 = blocks[ei].getBoundingClientRect();
    const need = Math.ceil(b0.bottom - a0.top + 2);

    const sc = document.getElementById('appScroll');
    const pageTop = sc ? sc.scrollTop : 0;
    const listTopOnPage = planListEl.getBoundingClientRect().top + pageTop;
    const avail = Math.floor(window.innerHeight - listTopOnPage - 16 - safeBottom());

    if(avail >= need){
      planListEl.style.height = need + 'px';
      const slack = avail - need;
      const nameEl = exerciseDisplayEl;
      const subRow = document.querySelector('#run .sub-clock-row');
      if(phase === 'work' && nameEl.offsetParent && subRow){
        // Zeit (Uhr + Total) genau mittig zwischen Übungsname und Boxen
        const above = clockEl.getBoundingClientRect().top - nameEl.getBoundingClientRect().bottom;
        const below = planListEl.getBoundingClientRect().top - subRow.getBoundingClientRect().bottom;
        const half = (above + below + slack) / 2;
        clockEl.style.marginTop = Math.max(0, half - above) + 'px';
        box.style.marginTop = (RUN_PLAN_GAP + Math.max(0, half - below)) + 'px';
      } else {
        box.style.marginTop = (RUN_PLAN_GAP + slack) + 'px';   // in der Pause: Rest über der Liste
      }
    } else {
      planListEl.style.height = Math.max(110, avail) + 'px';          // kleines Display: Liste scrollt
    }
    const listTop = planListEl.getBoundingClientRect().top - planListEl.scrollTop;
    planListEl.scrollTop = Math.max(0, blocks[si].getBoundingClientRect().top - listTop - 1);
    updatePlanScrollbar();
  }
  window.addEventListener('resize', ()=>{ if(log && phase !== 'log-final') { runPlanKey = ''; refreshRunPlan(); } });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ if(log){ runPlanKey = ''; refreshRunPlan(); } });

  function exName(entry){
    const ex = exercises.find(e=>e.id===entry.exercise);
    return (ex ? ex.name : (entry.exercise || '–')) + weightSuffix(entry);
  }

  const HANDLE_SVG = '<span class="plan-handle" aria-label="Halten und ziehen zum Verschieben"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg></span>';
  function planRowHtml(r){
    const isCur = phase === 'work' && r === currentRound - 1;
    const isNext = r === currentRound;
    return '<div class="plan-row'+(isCur?' current':'')+(isNext?' next':'')+'"><span class="plan-rnd">R'+(r+1)+'</span><span class="plan-name">'+esc(exName(log[r]))+'</span>' +
      (isCur ? '<span class="plan-next-tag">Läuft</span>' : isNext ? '<span class="plan-next-tag">Als Nächstes</span>' : '') + '</div>';
  }
  function renderPlan(){
    const first = firstMovableBlock();
    const partial = partialFirst();
    let html = '';
    for(let b=0; b<blockCount(); b++){
      const r1 = 2*b, r2 = 2*b+1;
      if(b < first){
        html += '<div class="plan-block locked" data-b="'+b+'"><div class="plan-rows">'+planRowHtml(r1)+planRowHtml(r2)+'</div><span class="plan-tag">erledigt</span></div>';
      } else if(b === first && partial){
        // erledigte erste Runde bleibt fest stehen, die zweite Runde ist verschiebbar
        html += '<div class="plan-block locked"><div class="plan-rows">'+planRowHtml(r1)+'</div><span class="plan-tag">erledigt</span></div>';
        html += '<div class="plan-block movable'+(phase==='work'?' running':'')+'" data-b="'+b+'"><div class="plan-rows">'+planRowHtml(r2)+'</div>'+HANDLE_SVG+'</div>';
      } else {
        const running = phase === 'work' && b === first;
        html += '<div class="plan-block movable'+(running?' running':'')+'" data-b="'+b+'"><div class="plan-rows">'+planRowHtml(r1)+planRowHtml(r2)+'</div>'+HANDLE_SVG+'</div>';
      }
    }
    planListEl.innerHTML = html;
    document.getElementById('planHint').textContent =
      'Griff ⠿ gedrückt halten und nach oben oder unten ziehen – auch die laufende Übung.';
  }

  // neue Reihenfolge übernehmen (order = alte Blocknummern in neuer Reihenfolge, ab dem ersten verschiebbaren Block)
  function applyPlanOrder(order){
    if(phase === 'rest') saveLogEntry();   // gerade eingetippten Wert nicht verlieren
    const first = firstMovableBlock();
    const partial = partialFirst();
    const newLog = log.slice(0, first*2);
    order.forEach((b, pos)=>{
      if(partial && pos === 0){
        // erledigte erste Runde bleibt, dahinter kommt die zweite Runde des nachgerückten Blocks
        newLog.push(log[2*first], log[2*b+1]);
      } else if(partial && b === first){
        // der verschobene (angefangene) Block bekommt die erste Runde des nachgerückten Blocks
        newLog.push(log[2*order[0]], log[2*first+1]);
      } else {
        newLog.push(log[2*b], log[2*b+1]);
      }
    });
    log = newLog;
    render();
    refreshRunPlan(true);
  }

  // ---------- Drag & Drop per Finger (Pointer Events, funktioniert mit Touch und Maus) ----------
  let drag = null;
  function movableOrder(){
    return Array.from(planListEl.querySelectorAll('.plan-block.movable')).map(el=> Number(el.dataset.b));
  }
  planListEl.addEventListener('pointerdown', e=>{
    const handle = e.target.closest('.plan-handle');
    const block = handle && handle.closest('.plan-block.movable');
    if(!block) return;
    e.preventDefault();
    const rect = block.getBoundingClientRect();
    const ph = document.createElement('div');
    ph.className = 'plan-placeholder';
    ph.style.height = rect.height + 'px';
    planListEl.insertBefore(ph, block);
    block.classList.add('dragging');
    block.style.width = rect.width + 'px';
    block.style.left = rect.left + 'px';
    block.style.top = rect.top + 'px';
    drag = { block, ph, offsetY: e.clientY - rect.top, startOrder: movableOrder().join(',') };
    const sc = document.getElementById('appScroll');
    if(sc){ drag.pageScroll = sc.scrollTop; sc.style.overflowY = 'hidden'; }   // Screen bleibt stehen
    if(navigator.vibrate) navigator.vibrate(12);
  });
  window.addEventListener('pointermove', e=>{
    if(!drag) return;
    e.preventDefault();
    drag.block.style.top = (e.clientY - drag.offsetY) + 'px';
    // Lücke vor den ersten Block setzen, dessen Mitte unter dem Finger liegt
    const others = Array.from(planListEl.querySelectorAll('.plan-block.movable:not(.dragging)'));
    let before = null;
    for(const it of others){
      const r = it.getBoundingClientRect();
      if(e.clientY < r.top + r.height/2){ before = it; break; }
    }
    if(before){ if(drag.ph.nextSibling !== before) planListEl.insertBefore(drag.ph, before); }
    else if(planListEl.lastElementChild !== drag.ph) planListEl.appendChild(drag.ph);
    // nur die Liste scrollt mit, wenn der Finger an ihren oberen/unteren Rand kommt
    const lr = planListEl.getBoundingClientRect();
    if(e.clientY < lr.top + 28) planListEl.scrollTop -= 8;
    else if(e.clientY > lr.bottom - 28) planListEl.scrollTop += 8;
  }, { passive:false });
  function endDrag(){
    if(!drag) return;
    const { block, ph, startOrder, pageScroll } = drag;
    drag = null;
    const sc = document.getElementById('appScroll');
    if(sc){ sc.style.overflowY = ''; if(pageScroll !== undefined) sc.scrollTop = pageScroll; }
    planListEl.insertBefore(block, ph);
    ph.remove();
    block.classList.remove('dragging');
    block.style.width = block.style.left = block.style.top = '';
    const order = movableOrder();
    if(order.join(',') !== startOrder) applyPlanOrder(order);
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  // iOS: verhindert, dass die Liste beim Ziehen am Griff mitscrollt
  planListEl.addEventListener('touchmove', e=>{ if(drag) e.preventDefault(); }, { passive:false });

  pauseBtn.addEventListener('click', ()=>{
    paused = !paused;
    pauseBtn.textContent = paused ? 'Weiter' : 'Pause';
  });

  document.getElementById('skipBtn').addEventListener('click', ()=>{
    advancePhase();
  });

  document.getElementById('finishNowBtn').addEventListener('click', finishRun);

  function resetToSetup(){
    clearInterval(timerId);
    releaseWakeLock();
    showScreen('setup');
    refreshSetup();
  }
  document.getElementById('resetBtn').addEventListener('click', resetToSetup);

  // Home-Button oben links: erst nachfragen, dann Workout abbrechen und zur Startseite
  const quitOverlayEl = document.getElementById('quitOverlay');
  function openQuit(){ quitOverlayEl.classList.add('open'); quitOverlayEl.setAttribute('aria-hidden','false'); }
  function closeQuit(){ quitOverlayEl.classList.remove('open'); quitOverlayEl.setAttribute('aria-hidden','true'); }
  document.getElementById('runHomeBtn').addEventListener('click', openQuit);
  // Skip (Play-Symbol neben der Zeit): Arbeit → Pause bzw. Pause → nächste Übung
  document.getElementById('runSkipBtn').addEventListener('click', ()=>{
    if(phase === 'work' || phase === 'rest') advancePhase();
  });
  document.getElementById('quitNo').addEventListener('click', closeQuit);
  quitOverlayEl.addEventListener('click', e=>{ if(e.target === quitOverlayEl) closeQuit(); });
  document.getElementById('quitYes').addEventListener('click', async ()=>{
    closeQuit();
    resetToSetup();   // zurück zu „Workout einstellen“
  });
  document.getElementById('resetBtn2').addEventListener('click', resetToSetup);

  document.getElementById('restartBtn').addEventListener('click', ()=>{
    showScreen('setup');
    refreshSetup();
  });


  // ---------- Schnittstelle für gogogo ----------
  function localNextHour(){
    const d = new Date(); d.setSeconds(0,0);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    return d;
  }
  window.FFC = {
    user: ()=> currentUser,
    showAuth(mode, opts){
      opts = opts || {};
      setAuthMode(mode || 'login');
      const brand = document.querySelector('#auth .brand');
      if(brand) brand.textContent = opts.title || 'Zirkeltraining';
      if(opts.tagline && (mode || 'login') === 'login') authTaglineEl.textContent = opts.tagline;
      if(opts.email && !authEmailEl.value) authEmailEl.value = opts.email;
      showScreen('auth');
    },
    async signIn(email, password){
      try{
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if(!error && data && data.user) currentUser = data.user;
        return { error };
      }catch(err){ return { error: err }; }
    },
    async openSetup(){
      await refreshCachedHistory();
      buildExercisePlan();
      showScreen('setup');
    },
    async openEvent(pre){
      pre = pre || {};
      closeEventForm();
      evTitle.value = pre.title || '';
      evWhere.value = pre.where || '';
      evWhen.value = toLocalInput(pre.when || localNextHour());
      openEventForm();
      await loadFriends();
    },
    closeEvent(){ closeEventForm(); },
    async refreshHeute(){
      if(!currentUser) return;
      cleanupOwnPosts();
      await Promise.all([loadFeed(), loadEvents()]);
    },
    async refreshTraining(){
      if(!currentUser) return;
      refreshBackfillButton();
      await Promise.all([
        openLeaderboard(),
        refreshCachedHistory().then(()=>{ renderRecords(); renderBests(); })
      ]);
    },
    async openProfile(){ await openTab('profile'); },
    stories(){
      return storyUsers.map((u,i)=>({ index:i, uid:u.uid, nickname:u.nickname, avatar_url:u.avatar_url, is_me:!!u.is_me, seen:u.posts.every(p=>p.seen) }));
    },
    openStory(index){
      const u = storyUsers[index];
      if(!u) return false;
      const firstUnseen = u.is_me ? 0 : u.posts.findIndex(p=>!p.seen);
      openStory(index, firstUnseen < 0 ? 0 : firstUnseen);
      return true;
    },
    async weeklyPoints(){
      if(!currentUser) return null;
      const { data, error } = await sb.rpc('weekly_leaderboard', { p_group_id: null });
      if(error) return null;
      return (data || []).map(r=>({ user_id:r.user_id, nickname:r.nickname, points:r.points, workouts:r.workouts, is_me:!!r.is_me }));
    },
    async signUp(email, password){
      try{
        const { data, error } = await sb.auth.signUp({ email, password });
        if(!error && data && data.session && data.user) currentUser = data.user;
        return { data, error };
      }catch(err){ return { data:null, error: err }; }
    },
    async nicknameTaken(nickname){
      const nick = String(nickname || '').trim();
      if(!nick) return { taken:false, error:null };
      try{
        const { data, error } = await sb.from('profiles').select('user_id,nickname').ilike('nickname', nick).limit(5);
        if(error) return { taken:false, error };
        const me = currentUser && currentUser.id;
        const taken = (data || []).some(row => row && String(row.user_id) !== String(me || ''));
        return { taken, error:null };
      }catch(err){ return { taken:false, error: err }; }
    },
    async setNickname(nickname){
      if(!currentUser) return { error:null };
      return sb.from('profiles').upsert({ user_id: currentUser.id, nickname: nickname }, { onConflict:'user_id' });
    },
    friends(){
      return (lbFriendList || []).map(f=>({
        friendship_id: f.friendship_id,
        friend_id: f.friend_id,
        nickname: f.nickname,
        avatar_url: f.avatar_url || '',
        status: f.status,
        incoming: !!f.incoming
      }));
    },
    async refreshFriends(){
      if(!currentUser) return [];
      await loadFriends();
      host('onFriends');
      return this.friends();
    },
    async friendRequest(query){
      if(!currentUser) return { error:null };
      const res = await sb.rpc('send_friend_request', { p_query: query });
      if(!res.error){ await loadFriends(); host('onFriends'); }
      return res;
    },
    async respondFriend(id, accept){
      if(!currentUser) return { error:null };
      const res = await sb.rpc('respond_friend_request', { p_id: Number(id), p_accept: !!accept });
      if(!res.error){ await loadFriends(); host('onFriends'); }
      return res;
    },
    async removeFriend(id){
      if(!currentUser) return { error:null };
      const res = await sb.rpc('remove_friend', { p_id: Number(id) });
      if(!res.error){ await loadFriends(); host('onFriends'); }
      return res;
    },
    async logout(){
      await sb.auth.signOut();
      currentUser = null;
      cachedHistory = [];
      setAuthMode('login');
      showScreen('auth');
      host('onAuth', null);
    }
  };
  host('onReady');
})();
