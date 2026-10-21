(() => {
  'use strict';

  const { CONFIG, STOPS, ROLES, EXTRAS, SNYT, SABOTAGE } = window.PQ;
  const app = document.getElementById('app');
  const tabbar = document.getElementById('tabbar');
  const darkMq = window.matchMedia('(prefers-color-scheme: dark)');

  // ---------- Helpers ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: progress just won't persist */ }
    },
    del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const timeStr = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const stopById = (id) => STOPS.find((s) => s.id === id);
  // Team messages go to the judge's number; the judge's own "share scores" picks a chat.
  const waLink = (text, phone = '') => `https://wa.me/${phone}?text=` + encodeURIComponent(text);
  const openWhatsApp = (text, phone = CONFIG.judgePhone) => window.open(waLink(text, phone), '_blank', 'noopener');
  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // A phone stays unlocked until accessHash changes in data.js.
  const unlocked = () => store.get('pq:access', null) === CONFIG.accessHash;

  const photoChat = () => (CONFIG.photoChatUrl
    ? `<a href="${esc(CONFIG.photoChatUrl)}" target="_blank" rel="noopener">${esc(CONFIG.photoChatName)}</a>`
    : esc(CONFIG.photoChatName));

  const ICON = {
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    gps: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  };

  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // Two-tap confirm for buttons with a cost (hint, sabotage, reset).
  function confirmTap(el, armedLabel) {
    if (el.dataset.armed) return true;
    el.dataset.armed = '1';
    el.dataset.label = el.innerHTML;
    el.textContent = armedLabel;
    setTimeout(() => { if (el.isConnected && el.dataset.armed) { delete el.dataset.armed; el.innerHTML = el.dataset.label; } }, 4000);
    return false;
  }

  // ---------- Team & progress ----------
  // A phone remembers its team until "Switch team".
  let team = store.get('pq:team', null);
  if (team && !CONFIG.teams[team]) team = null;
  let prog = loadProgress(team);

  function loadProgress(t) {
    const blank = { arrived: {}, hints: {}, drafts: {}, bonusDrafts: {}, sent: {}, extras: {}, extraDrafts: {}, sabotage: null };
    return t ? Object.assign(blank, store.get('pq:progress:' + t, {})) : blank;
  }
  function save() { if (team) store.set('pq:progress:' + team, prog); }
  function setTeam(t) { team = t; store.set('pq:team', t); prog = loadProgress(t); }
  const teamName = (t = team) => (t ? CONFIG.teams[t].name : '');
  const otherTeam = () => Object.keys(CONFIG.teams).find((t) => t !== team);

  function status(id) {
    if (prog.sent[id]) return 'done';
    if (prog.arrived[id]) return 'open';
    return 'locked';
  }
  const STATUS_LABEL = { locked: 'Not visited', open: 'Question open', done: 'Sent to judge' };
  const doneCount = () => STOPS.filter((s) => prog.sent[s.id]).length;

  // Roles rotate one step per stop, in the order the team arrives at stops.
  function rolesFor(id) {
    const names = CONFIG.teams[team].members || [];
    if (!names.length) return null;
    const order = Object.entries(prog.arrived).sort((a, b) => a[1] - b[1]).map(([k]) => +k);
    let shift = order.indexOf(id);
    if (shift === -1) shift = order.length;
    // With fewer players than roles, the first players also take the leftover roles.
    return ROLES.map((role, i) => ({ role, person: names[(i + shift) % names.length] }));
  }

  // ---------- Time ----------
  const latePenalty = (min) => (min <= CONFIG.graceMinutes ? 0 : 2 * Math.ceil((min - CONFIG.graceMinutes) / 5));

  function fmtDur(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }

  function countdown(now = Date.now()) {
    const start = Date.parse(CONFIG.startAt), end = Date.parse(CONFIG.finishAt);
    const grace = CONFIG.graceMinutes * 60000;
    if (now < start) {
      const day = new Date(start).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
      return { state: 'before', label: `Quest starts ${day}, ${timeStr(start)}`, value: fmtDur(start - now) };
    }
    if (now < end) return { state: 'running', label: `Meet at ${CONFIG.finishPlace} by ${timeStr(end)}`, value: fmtDur(end - now) };
    if (now < end + grace) return { state: 'grace', label: 'Time is up! Grace period ends in', value: fmtDur(end + grace - now) };
    const lateMin = Math.floor((now - end) / 60000);
    return { state: 'late', label: `Head to ${CONFIG.finishPlace}`, value: `${lateMin} min late (−${latePenalty(lateMin)})` };
  }

  function countdownHtml() {
    const c = countdown();
    return `<div class="countdown" data-countdown data-state="${c.state}">
      <div class="clock">${ICON.clock}</div>
      <div><div class="label">${esc(c.label)}</div><div class="value">${esc(c.value)}</div></div>
    </div>`;
  }

  setInterval(() => {
    document.querySelectorAll('[data-countdown]').forEach((el) => {
      const c = countdown();
      el.dataset.state = c.state;
      el.querySelector('.label').textContent = c.label;
      el.querySelector('.value').textContent = c.value;
    });
  }, 1000);

  // ---------- Map ----------
  let map = null;
  let tileLayer = null;

  function setTiles() {
    if (!map) return;
    if (tileLayer) map.removeLayer(tileLayer);
    const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    if (CONFIG.cartoKey) {
      const style = darkMq.matches ? 'dark_all' : 'rastertiles/voyager';
      tileLayer = L.tileLayer(`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CONFIG.cartoKey)}`, {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: `${osm} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
      });
    } else {
      // Fallback: standard OSM tiles, darkened with a CSS filter in dark mode (.tiles-osm).
      tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'tiles-osm',
        attribution: osm,
      });
    }
    tileLayer.addTo(map);
  }
  darkMq.addEventListener('change', setTiles);

  function mountMap(el) {
    if (typeof L === 'undefined') { el.innerHTML = '<p class="page muted">The map could not load. Check your connection.</p>'; return; }
    map = L.map(el, { zoomControl: false, scrollWheelZoom: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    setTiles();

    const pts = STOPS.map((s) => [s.lat, s.lng]);
    L.polyline(pts, { color: cssVar('--accent'), weight: 3, opacity: 0.6, dashArray: '1 9', lineCap: 'round' }).addTo(map);

    STOPS.forEach((s) => {
      const st = team ? status(s.id) : 'locked';
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<div class="pin pin-${st}"><span>${st === 'done' ? '✓' : s.id}</span></div>`,
        iconSize: [36, 42],
        iconAnchor: [18, 40],
        popupAnchor: [0, -38],
      });
      L.marker([s.lat, s.lng], { icon, title: `${s.id}. ${s.name}`, alt: `Stop ${s.id}: ${s.name}`, riseOnHover: true })
        .addTo(map)
        .bindPopup(`<div class="pop"><div class="pop-num">Stop ${s.id} · ${esc(s.area)}</div><strong>${esc(s.name)}</strong><p>${esc(s.intro)}</p><a href="#stop-${s.id}">Open stop →</a></div>`, { maxWidth: 260, autoPanPadding: [20, 60] });
    });

    const fit = () => map.fitBounds(L.latLngBounds(pts), { padding: [36, 36] });
    fit();
    // The container can change size after fonts/layout settle.
    setTimeout(() => { map.invalidateSize(); fit(); }, 150);
  }

  function mountHomeMap(el) {
    if (typeof L === 'undefined') { el.innerHTML = '<p class="page muted">The map could not load. Check your connection.</p>'; return; }
    const h = CONFIG.home;
    map = L.map(el, { zoomControl: false, scrollWheelZoom: false }).setView([h.lat, h.lng], 16);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    setTiles();
    const icon = L.divIcon({ className: 'pin-wrap', html: '<div class="pin pin-home"><span>⌂</span></div>', iconSize: [36, 42], iconAnchor: [18, 40], popupAnchor: [0, -38] });
    L.marker([h.lat, h.lng], { icon, title: h.name, alt: 'Home' }).addTo(map)
      .bindPopup(`<div class="pop"><div class="pop-num">Home</div><strong>${esc(h.name)}</strong><p>${esc(h.address)}</p></div>`);
    setTimeout(() => map && map.invalidateSize(), 150);
  }

  function unmountMap() {
    if (map) { map.remove(); map = null; tileLayer = null; }
  }

  // ---------- Views ----------
  function viewHome() {
    const pickOrStart = `<a class="btn primary block big" href="#stops">Start the quest ${ICON.chev.replace('class="chev"', '')}</a>
      <p class="small muted" style="text-align:center;margin:10px 0 0">Playing as <span class="chip team">${esc(teamName())}</span>: ${esc(CONFIG.teams[team].members.join(', '))}<br><a href="#switch-team">Not your team? Switch</a></p>`;

    return `<div class="home">
      <div class="home-map">
        <div id="map" class="map" role="region" aria-label="Map of the six checkpoints"></div>
        <a class="brand-chip" href="#home"><img src="icon.svg" alt="">City Quest</a>
      </div>
      <div class="home-body">
        <div class="page stack">
          <header class="hero">
            <div class="eyebrow">Two teams · Six spots · One afternoon</div>
            <h1>Prague City Quest</h1>
            <p class="lede">Walk from Old Town over the river to the Castle and Petřín. At each spot, answer a question you can only solve standing there, and take a team selfie. No points for speed, so take your time.</p>
          </header>
          ${countdownHtml()}
          ${pickOrStart}
          <section class="card">
            <h2>How it works</h2>
            <ul class="facts">
              <li><b>6</b><span>stops, any order</span></li>
              <li><b>3 h</b><span>from ${esc(CONFIG.startPlace.split(',')[0])}</span></li>
              <li><b>3</b><span>points per stop</span></li>
              <li><b>0</b><span>points for speed</span></li>
            </ul>
            <ul class="rules-list" style="margin-top:14px">
              <li>Tap <b>We're here</b> at a spot to unlock its question.</li>
              <li>Send your answer to the judge on WhatsApp. All photos go in ${photoChat()}.</li>
              <li>Hints cost 1 point. Arriving late costs 2 points per 5 minutes after a 5-minute grace.</li>
              <li>No googling (except to find a Vodníkovo sperma). Stay together. Cross roads safely.</li>
            </ul>
            <a class="btn ghost block" href="#rules" style="margin-top:12px">Full rules</a>
          </section>
          <p class="small muted" style="text-align:center">Tap a pin on the map to see each stop.</p>
        </div>
      </div>
    </div>`;
  }

  // ---------- Landing ----------
  function viewLocked(message) {
    return `<div class="page stack landing">
      <header class="hero">
        <img class="landing-logo" src="icon.svg" alt="">
        <div class="eyebrow">Invite only</div>
        <h1>Prague City Quest</h1>
        <p class="lede">This is a private game. Open the invite link you got from the organiser to get in.</p>
      </header>
      ${message ? `<p class="gate-msg" role="alert">${esc(message)}</p>` : ''}
    </div>`;
  }

  function viewLanding() {
    const teams = Object.entries(CONFIG.teams).map(([k, t]) => `
      <section class="card team-card">
        <div class="team-card-top"><h2>${esc(t.name)}</h2><span class="chip">${t.members.length} players</span></div>
        <ul class="members">${t.members.map((m) => `<li><span class="avatar" aria-hidden="true">${esc(m[0])}</span>${esc(m)}</li>`).join('')}</ul>
        <a class="btn primary block" href="#team-${k}">We're ${esc(t.name)}</a>
      </section>`).join('');

    return `<div class="page stack landing">
      <header class="hero">
        <img class="landing-logo" src="icon.svg" alt="">
        <div class="eyebrow">Two teams · Six spots · One afternoon</div>
        <h1>Prague City Quest</h1>
        <p class="lede">Six spots between Old Town, the Castle and Petřín. At each one, answer a question you can only solve standing there, and take a team selfie. Find your name and tap your team.</p>
      </header>
      ${countdownHtml()}
      ${teams}
    </div>`;
  }

  function viewStops() {
    const done = doneCount();
    const pct = Math.round((done / STOPS.length) * 100);
    const other = otherTeam();

    const cards = STOPS.map((s) => {
      const st = status(s.id);
      return `<a class="stop-card ${st}" href="#stop-${s.id}">
        <div class="num">${st === 'done' ? ICON.check.replace('<svg', '<svg style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"') : s.id}</div>
        <div class="body">
          <div class="title">${esc(s.name)}</div>
          <div class="area">${esc(s.area)}</div>
          <span class="chip ${st}" style="margin-top:6px">${STATUS_LABEL[st]}</span>
        </div>
        ${ICON.chev}
      </a>`;
    }).join('');

    const extras = EXTRAS.map((x) => {
      const sent = prog.extras[x.id];
      return `<div class="card">
        <div class="j-top" style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <h3>${esc(x.name)}</h3><span class="chip ${sent ? 'done' : ''}">${sent ? 'Sent ' + timeStr(sent) : (x.points ? `+${x.points} pt${x.points === 1 ? '' : 's'}` : 'Just for fun')}</span>
        </div>
        <p class="muted">${esc(x.text)}</p>
        ${x.note ? `<p class="hint-box">${esc(x.note)}</p>` : ''}
        ${x.link ? `<p><a class="small" href="${esc(x.link.url)}" target="_blank" rel="noopener">${esc(x.link.label)}</a></p>` : ''}
        <div class="field"><input type="text" data-extra-draft="${x.id}" value="${esc(prog.extraDrafts[x.id] || '')}" placeholder="${x.id === 'cafe' ? 'Where, and how many Hladinkas?' : 'What happened?'}" aria-label="${esc(x.name)} note"></div>
        <button class="btn ${sent ? 'ghost' : ''} block" data-action="extra" data-id="${x.id}" style="margin-top:10px">${ICON.send} ${sent ? 'Send again' : 'Send to judge'}</button>
      </div>`;
    }).join('');

    const sab = prog.sabotage
      ? `<p class="sent-note">${ICON.check} Played at ${timeStr(prog.sabotage)}</p>`
      : `<button class="btn warn block" data-action="sabotage">${ICON.flag} Play sabotage card</button>`;

    return `<div class="page">
      <div class="page-head">
        <div><div class="eyebrow">${esc(teamName())}</div><h1>Your stops</h1></div>
      </div>
      <div class="progress">
        <div class="progress-top"><span><b>${done}</b> of ${STOPS.length} sent to judge</span><span>${pct}%</span></div>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${STOPS.length}" aria-valuenow="${done}"><i style="width:${pct}%"></i></div>
      </div>
      ${countdownHtml()}
      <div class="stop-list" style="margin-top:14px">${cards}</div>
      ${done === STOPS.length ? `<div class="card soft" style="margin-top:14px"><h3>All six done!</h3><p class="muted" style="margin:0">Head to ${esc(CONFIG.finishPlace)}. The judge has one last mystery question for you there.</p></div>` : ''}

      <h2 class="section-title">Extra points</h2>
      <div class="stack">${extras}
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <h3>Šnyt challenge 🍺</h3><span class="chip">+${SNYT.points} pts</span>
          </div>
          <p class="muted">${esc(SNYT.text).replace('the Facebook chat', photoChat())}</p>
          <a class="small" href="${esc(SNYT.url)}" target="_blank" rel="noopener">What's a šnyt? Pilsner Urquell's three pours →</a>
        </div>
        <div class="card">
          <h3>Sabotage card</h3>
          <p class="muted">Once per game. ${esc(SABOTAGE.text).replace('The other team', esc(teamName(other)))}</p>
          <div class="phrase"><span class="q-label">If you get sabotaged, say</span><p lang="cs">${esc(CONFIG.teams[team].shotPhrase)}</p></div>
          ${sab}
        </div>
      </div>
    </div>`;
  }

  function viewStop(id) {
    const s = stopById(id);
    if (!s) return `<div class="page"><h1>Stop not found</h1><p><a href="#stops">Back to stops</a></p></div>`;
    const st = status(id);
    const maps = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;
    const roles = rolesFor(id);

    const question = st === 'locked'
      ? `<div class="locked-q">
          <div class="lock-ic">${ICON.lock}</div>
          <h3>Question locked</h3>
          <p class="muted">You can only answer it on the spot. Tap the button when your team is there together.</p>
          <button class="btn primary block big" data-action="arrive" data-id="${id}">${ICON.pin} We're here</button>
        </div>`
      : `<section class="card stack">
          <div><div class="q-label">Question</div><p class="question">${esc(s.question)}</p></div>
          ${prog.hints[id]
            ? `<div class="hint-box"><b>Hint (−1):</b> ${esc(s.hint)}</div>`
            : `<button class="btn warn block" data-action="hint" data-id="${id}">Show a hint (−1 point)</button>`}
          <div class="field">
            <label for="answer">Your answer</label>
            <textarea id="answer" data-draft="${id}" placeholder="Type your team's answer">${esc(prog.drafts[id] || '')}</textarea>
          </div>
          <div class="field">
            <label for="bonus">Detail question <span class="muted small">(+0, gold star ⭐)</span></label>
            <p class="help">${esc(s.bonus)}</p>
            <input type="text" id="bonus" data-bonus-draft="${id}" value="${esc(prog.bonusDrafts[id] || '')}" placeholder="Your detail answer, or 'in the photo'">
          </div>
          ${prog.sent[id] ? `<div class="sent-note">${ICON.check} Sent to the judge at ${timeStr(prog.sent[id])}</div>` : ''}
          <button class="btn ${prog.sent[id] ? '' : 'primary'} block big" data-action="send" data-id="${id}">${ICON.send} ${prog.sent[id] ? 'Send again' : 'Send to judge'}</button>
          <p class="small muted" style="margin:0;text-align:center">Opens a WhatsApp chat with the judge, answer filled in. Just hit send.</p>
        </section>`;

    return `<div class="page">
      <a class="back" href="#stops">${ICON.back} All stops</a>
      <div class="stop-hero ${st}">
        <div class="num">${s.id}</div>
        <div><h1>${esc(s.name)}</h1><div class="area">${esc(s.area)}</div></div>
      </div>
      <div class="stack">
        <p>${esc(s.intro)}</p>
        <div class="btn-row">
          <a class="btn" href="${maps}" target="_blank" rel="noopener">${ICON.pin} Google Maps</a>
          <button class="btn" data-action="gps" data-id="${id}">${ICON.gps} How far?</button>
        </div>
        <div class="gps-out" id="gps-out" aria-live="polite"></div>
        ${question}
        <section class="card selfie-card">
          <div class="ic">${ICON.camera}</div>
          <div><h3>Team selfie (no points)</h3><p class="muted">Get the team and the landmark in the shot, and post it in ${photoChat()}. Whoever takes the selfie with the most likes by the end of the night wins a shot 🥃</p></div>
        </section>
        ${roles ? `<section class="card"><h3>Roles at this stop</h3><ul class="roles">${roles.map((r) => `<li><b>${esc(r.role.name)}</b><span>${esc(r.person)}</span></li>`).join('')}</ul></section>` : ''}
      </div>
    </div>`;
  }

  function viewTakeMeHome() {
    const h = CONFIG.home;
    const walk = `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=walking`;
    return `<div class="page stack">
      <div class="page-head"><div><div class="eyebrow">After the pub</div><h1>Take me home</h1></div></div>
      <section class="card stack">
        <div>
          <div class="q-label">We live at</div>
          <p class="address">${esc(h.address)}</p>
          <p class="small muted" style="margin:0">${esc(h.name)}</p>
        </div>
        <div class="btn-row">
          <a class="btn primary" href="${esc(walk)}" target="_blank" rel="noopener">${ICON.pin} Walk home</a>
          <a class="btn" href="${esc(h.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>
        </div>
        <button class="btn ghost block" data-action="gps" data-id="home">${ICON.gps} How far is home?</button>
        <div class="gps-out" id="gps-out" aria-live="polite"></div>
      </section>
      <div class="map-mini" id="home-map" role="region" aria-label="Map showing home"></div>
      <section class="card">
        <h3>Taking a taxi?</h3>
        <p class="muted">Show the driver this screen, or say:</p>
        <div class="phrase"><span class="q-label">Say</span><p lang="cs">${esc(h.taxiPhrase)}</p></div>
        <p class="small muted" style="margin:0">Bolt or Uber gives you a fixed price. Taxis hailed on the street can overcharge.</p>
      </section>
    </div>`;
  }

  function viewRules() {
    return `<div class="page stack">
      <div class="page-head"><div><div class="eyebrow">Read once, then go</div><h1>Rules</h1></div></div>
      <section class="card">
        <h2>The game</h2>
        <ul class="rules-list">
          <li>Two teams of five. You have 3 hours from the start at ${esc(CONFIG.startPlace)}.</li>
          <li>Visit the six stops in any order you like, then finish at ${esc(CONFIG.finishPlace)}.</li>
          <li>At each stop, tap <b>We're here</b>, answer the question and send it to the judge. Post your team selfie in ${photoChat()}. All photos go there, not to the judge on WhatsApp.</li>
          <li>GPS in the app is just a helper. You only need to be there.</li>
        </ul>
      </section>
      <section class="card">
        <h2>Scoring</h2>
        <table class="score-table">
          <tr><td>Correct answer</td><td>3</td></tr>
          <tr><td>Detail question: no points, but a gold star ⭐</td><td>0</td></tr>
          <tr><td>Team selfie: no points. Whoever takes the selfie with the most likes by the end of the night wins a shot.</td><td>🥃</td></tr>
          <tr><td>Hint used</td><td>−1</td></tr>
          <tr class="total"><td>Per stop / all six stops</td><td>3 / 18</td></tr>
        </table>
      </section>
      <section class="card">
        <h2>Extras</h2>
        <table class="score-table">
          <tr><td>Rest stop: 15 minutes sitting down, with a photo of your table. The team that drinks the most Hladinkas there wins (a tie gives both teams the points).</td><td>+2</td></tr>
          <tr><td>Local challenge, just for fun: order in Czech, or ask a local for their favourite spot</td><td>+0</td></tr>
          <tr><td>Vodníkovo sperma: drink one at any point during the quest, with a photo in ${photoChat()}. Googling is allowed for this one, since we're not sure it's real.</td><td>+1</td></tr>
          <tr><td>Mystery question at the finish, combining details from two stops</td><td>+5</td></tr>
          <tr><td>Šnyt challenge: the team with the most šnyts by the finish (a photo of each in ${photoChat()}; a tie gives both teams the points). <a href="${esc(SNYT.url)}" target="_blank" rel="noopener">What's a šnyt?</a></td><td>+${SNYT.points}</td></tr>
        </table>
      </section>
      <section class="card">
        <h2>Timing</h2>
        <p>There is no bonus for finishing early, so don't rush. After a ${CONFIG.graceMinutes}-minute grace period, you lose 2 points for every further 5 minutes late.</p>
        ${countdownHtml()}
      </section>
      <section class="card">
        <h2>Sabotage card</h2>
        <p>Each team can play it once. ${esc(SABOTAGE.text)}</p>
        ${Object.values(CONFIG.teams).map((t) => `<div class="phrase"><span class="q-label">${esc(t.name)} (${t.members.length} shots) says</span><p lang="cs">${esc(t.shotPhrase)}</p></div>`).join('')}
      </section>
      <section class="card">
        <h2>Roles rotate every stop</h2>
        <ul class="roles">${ROLES.map((r) => `<li><b>${esc(r.name)}</b><span>${esc(r.does)}</span></li>`).join('')}</ul>
      </section>
      <section class="card">
        <h2>Fair play</h2>
        <ul class="rules-list">
          <li>No googling the answers. Googling is fine for the Vodníkovo sperma bonus.</li>
          <li>No buying tickets to get an answer.</li>
          <li>Stay together as a team, and cross roads safely.</li>
          <li>The judge's decision is final. Tiebreaker: best selfie, by vote.</li>
        </ul>
      </section>
    </div>`;
  }

  // ---------- Judge ----------
  const J_KEY = 'pq:judge';
  const blankJudgeTeam = () => ({ stops: {}, rest: 0, mystery: 0, late: 0, snyt: 0, vodnik: false });
  const VODNIK_POINTS = EXTRAS.find((x) => x.id === 'vodnik').points;
  let judge = loadJudge();

  function loadJudge() {
    const j = store.get(J_KEY, {});
    j.teams = j.teams || {};
    Object.keys(CONFIG.teams).forEach((t) => { j.teams[t] = Object.assign(blankJudgeTeam(), j.teams[t] || {}); });
    j.key = j.key || {};
    j.tab = CONFIG.teams[j.tab] ? j.tab : Object.keys(CONFIG.teams)[0];
    return j;
  }
  const saveJudge = () => store.set(J_KEY, judge);
  const jStop = (t, id) => Object.assign({ answer: 0, star: false, hint: false }, judge.teams[t].stops[id] || {});
  // Selfies and detail questions score nothing; a detail answer earns a gold star instead.
  const stopScore = (t, id) => { const s = jStop(t, id); return s.answer - (s.hint ? 1 : 0); };
  const starCount = (t) => STOPS.filter((s) => jStop(t, s.id).star).length;

  // Drinking contests (šnyts, rest-stop Hladinkas): the highest count wins the bonus, a tie
  // gives it to every team on top, and nobody gets it while all counts are 0.
  const REST_POINTS = EXTRAS.find((x) => x.id === 'cafe').points;
  const CONTESTS = { snyt: SNYT.points, rest: REST_POINTS };
  function mostBonus(t, field) {
    const counts = Object.values(judge.teams).map((jt) => +jt[field] || 0);
    const mine = +judge.teams[t][field] || 0;
    return mine > 0 && mine === Math.max(...counts) ? CONTESTS[field] : 0;
  }

  function teamTotal(t) {
    const jt = judge.teams[t];
    const stops = STOPS.reduce((sum, s) => sum + stopScore(t, s.id), 0);
    return stops + mostBonus(t, 'rest') + mostBonus(t, 'snyt') + (jt.vodnik ? VODNIK_POINTS : 0) + (+jt.mystery || 0) - latePenalty(+jt.late || 0);
  }

  const stepper = (t, field, value, label) => `<div class="stepper">
      <button type="button" data-action="jstep" data-team="${t}" data-field="${field}" data-delta="-1" aria-label="${label} minus one">−</button>
      <input type="number" inputmode="numeric" min="0" data-jstep="${field}" data-team="${t}" value="${value}" aria-label="${label}">
      <button type="button" data-action="jstep" data-team="${t}" data-field="${field}" data-delta="1" aria-label="${label} plus one">+</button>
    </div>`;
  const leadNote = (t, field) => (mostBonus(t, field) ? `In the lead: +${CONTESTS[field]}` : 'Not in the lead');

  const seg = (t, id, field, max, value) => `<div class="seg" role="group" aria-label="${field}">${
    Array.from({ length: max + 1 }, (_, v) => `<button type="button" data-action="jset" data-team="${t}" data-stop="${id}" data-field="${field}" data-val="${v}" aria-pressed="${value === v}">${v}</button>`).join('')
  }</div>`;

  function scoreboardHtml() {
    const totals = Object.keys(CONFIG.teams).map((t) => [t, teamTotal(t)]);
    const max = Math.max(...totals.map(([, n]) => n));
    const tie = totals.every(([, n]) => n === max);
    return totals.map(([t, n]) => `<div class="score-tile ${!tie && n === max ? 'lead' : ''}"><div class="t">${esc(teamName(t))}</div><div class="n" data-total="${t}">${n}</div><div class="stars">${starCount(t) ? `⭐ × ${starCount(t)}` : 'No gold stars yet'}</div></div>`).join('');
  }

  function viewJudge() {
    const t = judge.tab;
    const jt = judge.teams[t];

    const stops = STOPS.map((s) => {
      const sc = jStop(t, s.id);
      return `<section class="card j-stop">
        <div class="j-top"><h3>${s.id}. ${esc(s.name)}</h3><span class="j-sum" data-stopsum="${s.id}">${stopScore(t, s.id)}</span></div>
        <div class="j-sub">${esc(s.question)}</div>
        <div class="j-row"><span>Answer</span>${seg(t, s.id, 'answer', 3, sc.answer)}</div>
        <div class="j-row"><span>Hint used (−1)</span><button type="button" class="toggle" data-action="jtoggle" data-team="${t}" data-stop="${s.id}" data-field="hint" aria-pressed="${sc.hint}">${sc.hint ? 'Yes' : 'No'}</button></div>
        <div class="j-row"><span>Detail: gold star (0 pts)</span><button type="button" class="toggle star" data-action="jtoggle" data-team="${t}" data-stop="${s.id}" data-field="star" aria-pressed="${sc.star}">${sc.star ? '⭐ Yes' : 'No'}</button></div>
        <details class="j-key"><summary>My answer key (saved only on this phone)</summary>
          <input type="text" data-jkey="${s.id}" value="${esc(judge.key[s.id] || '')}" placeholder="Answer + detail question notes" autocomplete="off">
        </details>
      </section>`;
    }).join('');

    const late = +jt.late || 0;
    return `<div class="page">
      <div class="judge-head">
        <div><div class="eyebrow">Judge only</div><h1>Scoring</h1></div>
        <a class="btn ghost" href="#home">Exit</a>
      </div>
      <div class="scoreboard" id="scoreboard">${scoreboardHtml()}</div>
      <div class="tabs" role="tablist">
        ${Object.entries(CONFIG.teams).map(([k, v]) => `<button role="tab" aria-selected="${k === t}" data-action="jtab" data-team="${k}">${esc(v.name)}</button>`).join('')}
      </div>
      <div class="stack">
        ${stops}
        <section class="card">
          <h3>Extras</h3>
          <div class="j-row">
            <span>Rest-stop Hladinkas<br><span class="small muted" data-lead="rest">${leadNote(t, 'rest')}</span></span>
            ${stepper(t, 'rest', +jt.rest || 0, 'Rest-stop Hladinkas')}
          </div>
          <div class="j-row">
            <span>Šnyts (photos in chat)<br><span class="small muted" data-lead="snyt">${leadNote(t, 'snyt')}</span></span>
            ${stepper(t, 'snyt', +jt.snyt || 0, 'Šnyts')}
          </div>
          <div class="j-row"><span>Vodníkovo sperma (+${VODNIK_POINTS})</span><button type="button" class="toggle" data-action="jflag" data-team="${t}" data-field="vodnik" aria-pressed="${!!jt.vodnik}">${jt.vodnik ? 'Yes' : 'No'}</button></div>
          <div class="j-row"><span>Mystery question</span>${seg(t, 'x', 'mystery', 5, +jt.mystery || 0)}</div>
          <div class="j-row">
            <span>Minutes late<br><span class="small muted" id="late-pen">Penalty −${latePenalty(late)}</span></span>
            ${stepper(t, 'late', late, 'Minutes late')}
          </div>
        </section>
        <div class="btn-row">
          <button class="btn primary" data-action="jshare">${ICON.send} Share scores</button>
          <button class="btn danger" data-action="jreset">Reset scores</button>
        </div>
        <p class="small muted">Scores and your answer key are stored only in this browser. Nothing is uploaded.</p>
      </div>
    </div>`;
  }

  function refreshJudgeTotals() {
    const sb = document.getElementById('scoreboard');
    if (sb) sb.innerHTML = scoreboardHtml();
    document.querySelectorAll('[data-lead]').forEach((el) => { el.textContent = leadNote(judge.tab, el.dataset.lead); });
    const pen = document.getElementById('late-pen');
    if (pen) pen.textContent = `Penalty −${latePenalty(+judge.teams[judge.tab].late || 0)}`;
  }

  // ---------- Router ----------
  function render(html, { keepScroll = false } = {}) {
    const y = window.scrollY;
    unmountMap();
    app.innerHTML = html;
    window.scrollTo(0, keepScroll ? y : 0);
  }

  function showLocked(message) {
    render(viewLocked(message));
    document.body.classList.add('no-tabbar');
    document.title = 'Prague City Quest';
  }

  async function unlock(key) {
    // Drop the key from the address bar right away so it doesn't end up in screenshots.
    history.replaceState(null, '', '#home');
    if (!window.crypto?.subtle) return showLocked('Open the https:// link to get in.');
    if ((await sha256('pq:' + key.trim().toLowerCase())) !== CONFIG.accessHash) {
      return showLocked('That invite link isn\'t valid. Ask the organiser for the current one.');
    }
    store.set('pq:access', CONFIG.accessHash);
    route();
  }

  function route(opts) {
    const h = decodeURIComponent(location.hash.slice(1)) || 'home';
    const keyMatch = h.match(/^key=([\w-]+)$/);
    if (keyMatch) { unlock(keyMatch[1]); return; }
    if (!unlocked()) { showLocked(); return; }
    const teamMatch = h.match(/^team-(\w+)$/);
    if (teamMatch && CONFIG.teams[teamMatch[1]]) {
      if (team !== teamMatch[1]) { setTeam(teamMatch[1]); toast(`Welcome, ${teamName()}!`); }
      history.replaceState(null, '', '#home');
      return route();
    }
    if (h === 'switch-team') {
      // Back to the landing page. Each team's progress stays saved on this phone.
      team = null;
      store.del('pq:team');
      prog = loadProgress(null);
      history.replaceState(null, '', '#home');
      return route();
    }

    const stopMatch = h.match(/^stop-(\d+)$/);
    let tab = h;
    // The judge page and "Take me home" work without picking a team.
    const landing = !team && h !== 'judge' && h !== 'take-me-home';
    if (h === 'judge') render(viewJudge(), opts);
    else if (h === 'take-me-home') { render(viewTakeMeHome(), opts); mountHomeMap(document.getElementById('home-map')); }
    else if (landing) render(viewLanding(), opts);
    else if (h === 'stops') render(viewStops(), opts);
    else if (stopMatch) { render(viewStop(+stopMatch[1]), opts); tab = 'stops'; }
    else if (h === 'rules') render(viewRules(), opts);
    else { render(viewHome(), opts); tab = 'home'; mountMap(document.getElementById('map')); }

    document.body.classList.toggle('no-tabbar', h === 'judge' || landing);
    tabbar.querySelectorAll('a').forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = h === 'judge' ? 'Judge · Prague City Quest' : 'Prague City Quest';
  }
  const rerender = () => route({ keepScroll: true });

  // ---------- Actions ----------
  function haversine(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  const actions = {
    arrive(el, id) {
      prog.arrived[id] = prog.arrived[id] || Date.now();
      save();
      rerender();
      toast('Question unlocked');
    },
    hint(el, id) {
      if (!confirmTap(el, 'Tap again to reveal (−1 point)')) return;
      prog.hints[id] = Date.now();
      save();
      rerender();
    },
    send(el, id) {
      const s = stopById(id);
      const answer = (prog.drafts[id] || '').trim();
      if (!answer) { toast('Type an answer first'); document.getElementById('answer')?.focus(); return; }
      const bonus = (prog.bonusDrafts[id] || '').trim();
      const lines = [
        `🏰 Prague Quest · ${teamName()}`,
        `Stop ${id}: ${s.name}`,
        `Answer: ${answer}`,
        bonus ? `Detail (⭐): ${bonus}` : null,
        `Hint used: ${prog.hints[id] ? 'yes (−1)' : 'no'}`,
        `Sent ${timeStr(Date.now())}`,
      ].filter(Boolean);
      prog.sent[id] = Date.now();
      save();
      openWhatsApp(lines.join('\n'));
      rerender();
    },
    gps(el, id) {
      const out = document.getElementById('gps-out');
      const s = id === 'home' ? CONFIG.home : stopById(id);
      if (!('geolocation' in navigator)) { out.textContent = 'GPS isn\'t available on this device. No problem, it\'s only a hint.'; return; }
      out.className = 'gps-out';
      out.textContent = 'Finding you…';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const d = haversine({ lat: pos.coords.latitude, lng: pos.coords.longitude }, s);
          const acc = Math.round(pos.coords.accuracy);
          if (d < 60) { out.className = 'gps-out near'; out.textContent = `Looks like you're here (about ${Math.round(d)} m, ±${acc} m).`; }
          else out.textContent = d < 1000 ? `About ${Math.round(d / 10) * 10} m away (±${acc} m).` : `About ${(d / 1000).toFixed(1)} km away.`;
        },
        () => { out.textContent = 'Couldn\'t get your location. That\'s fine: GPS is only a hint.'; },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
      );
    },
    extra(el, id) {
      const x = EXTRAS.find((e) => e.id === id);
      const note = (prog.extraDrafts[id] || '').trim();
      const lines = [`🏰 Prague Quest · ${teamName()}`, `Extra: ${x.name}${x.points ? ` (+${x.points})` : ''}`, note ? `Note: ${note}` : null, id === 'cafe' ? `Table photo is in ${CONFIG.photoChatName}.` : id === 'vodnik' ? `Photo is in ${CONFIG.photoChatName}.` : null, `Sent ${timeStr(Date.now())}`].filter(Boolean);
      prog.extras[id] = Date.now();
      save();
      openWhatsApp(lines.join('\n'));
      rerender();
    },
    sabotage(el) {
      if (!confirmTap(el, 'Tap again to play it (once per game)')) return;
      prog.sabotage = Date.now();
      save();
      openWhatsApp(`🃏 ${teamName()} plays the SABOTAGE CARD on ${teamName(otherTeam())}! (${timeStr(Date.now())})\nJudge: please tell them to drink ${CONFIG.teams[otherTeam()].members.length} shots of "something local", with a photo in ${CONFIG.photoChatName} 🥃`);
      rerender();
    },

    // Judge
    jtab(el) { judge.tab = el.dataset.team; saveJudge(); rerender(); },
    jset(el) {
      const { team: t, stop, field } = el.dataset;
      const v = +el.dataset.val;
      if (field === 'mystery') judge.teams[t].mystery = v;
      else judge.teams[t].stops[stop] = Object.assign(jStop(t, stop), { [field]: v });
      saveJudge();
      rerender();
    },
    jtoggle(el) {
      const { team: t, stop, field } = el.dataset;
      judge.teams[t].stops[stop] = Object.assign(jStop(t, stop), { [field]: !jStop(t, stop)[field] });
      saveJudge();
      rerender();
    },
    jflag(el) {
      const { team: t, field } = el.dataset;
      judge.teams[t][field] = !judge.teams[t][field];
      saveJudge();
      rerender();
    },
    jstep(el) {
      const { team: t, field } = el.dataset;
      judge.teams[t][field] = Math.max(0, (+judge.teams[t][field] || 0) + +el.dataset.delta);
      saveJudge();
      const input = document.querySelector(`[data-jstep="${field}"][data-team="${t}"]`);
      if (input) input.value = judge.teams[t][field];
      refreshJudgeTotals();
    },
    jshare() {
      const lines = ['🏆 Prague Quest standings'];
      Object.keys(CONFIG.teams).map((t) => [t, teamTotal(t)]).sort((a, b) => b[1] - a[1])
        .forEach(([t, n]) => lines.push(`${teamName(t)}: ${n} pts`));
      openWhatsApp(lines.join('\n'), '');
    },
    jreset(el) {
      if (!confirmTap(el, 'Tap again to erase all scores')) return;
      const key = judge.key;
      store.del(J_KEY);
      judge = loadJudge();
      judge.key = key; // keep the private answer key
      saveJudge();
      rerender();
      toast('Scores reset');
    },
  };

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    actions[el.dataset.action](el, isNaN(+el.dataset.id) ? el.dataset.id : +el.dataset.id, e);
  });

  app.addEventListener('input', (e) => {
    const d = e.target.dataset;
    if (d.draft) { prog.drafts[d.draft] = e.target.value; save(); }
    else if (d.bonusDraft) { prog.bonusDrafts[d.bonusDraft] = e.target.value; save(); }
    else if (d.extraDraft) { prog.extraDrafts[d.extraDraft] = e.target.value; save(); }
    else if (d.jkey) { judge.key[d.jkey] = e.target.value; saveJudge(); }
    else if (d.jstep) { judge.teams[d.team][d.jstep] = Math.max(0, parseInt(e.target.value, 10) || 0); saveJudge(); refreshJudgeTotals(); }
  });

  window.addEventListener('hashchange', () => route());
  route();
})();
