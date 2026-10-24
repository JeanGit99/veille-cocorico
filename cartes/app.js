(() => {
  "use strict";

  // ---------- Règles du jeu ----------
  const RARITIES = {
    C: { label: "Commune", color: "#9aa3ad", gems: 1, sell: 5, power: [1, 3] },
    U: { label: "Peu commune", color: "#3fb27f", gems: 2, sell: 12, power: [3, 5] },
    R: { label: "Rare", color: "#3b82f6", gems: 3, sell: 30, power: [5, 7] },
    E: { label: "Épique", color: "#a855f7", gems: 4, sell: 80, power: [7, 9] },
    L: { label: "Légendaire", color: "#f5b301", gems: 5, sell: 200, power: [9, 10] },
  };
  const ORDER = ["C", "U", "R", "E", "L"];
  const SHINY_SELL_MULT = 4;
  const START_COINS = 500;
  const FREE_COOLDOWN = 15 * 60 * 1000;

  // Poids de tirage par type d'emplacement.
  const SLOT_WEIGHTS = {
    any: { C: 70, U: 23, R: 5.5, E: 1.2, L: 0.3 },
    uncommonPlus: { U: 65, R: 26, E: 7, L: 2 },
    rarePlus: { R: 75, E: 20, L: 5 },
  };

  const PACKS = {
    free: {
      label: "Booster gratuit", cost: 0, free: true, size: 5, shinyRate: 1 / 15,
      slots: ["any", "any", "any", "any", "uncommonPlus"],
      blurb: "Un booster offert toutes les 15 minutes.",
    },
    standard: {
      label: "Booster", cost: 100, size: 5, shinyRate: 1 / 15,
      slots: ["any", "any", "any", "any", "uncommonPlus"],
      blurb: "5 cartes dont 1 peu commune ou mieux.",
    },
    eclat: {
      label: "Booster Éclat", cost: 350, size: 5, shinyRate: 1 / 4, guaranteedShiny: true,
      slots: ["any", "any", "uncommonPlus", "uncommonPlus", "rarePlus"],
      blurb: "1 rare ou mieux, 1 shiny garanti, shiny ×4 plus fréquentes.",
    },
  };

  // ---------- Utilitaires ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n, w = 3) => String(n).padStart(w, "0");

  function weightedPick(weights) {
    const entries = Object.entries(weights);
    let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) if ((r -= w) <= 0) return k;
    return entries[entries.length - 1][0];
  }

  // Petit hash déterministe pour la puissance et la teinte des cartes.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  const storage = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
    },
  };

  // ---------- État ----------
  let themeKey = storage.get("cartes:theme", Object.keys(THEMES)[0]);
  if (!THEMES[themeKey]) themeKey = Object.keys(THEMES)[0];
  let theme, cards, state;

  const freshState = () => ({
    coins: START_COINS, lastFree: 0, owned: {},
    stats: { packs: 0, cards: 0, shinies: 0, legendaries: 0, sold: 0 },
  });

  function loadTheme(key) {
    themeKey = key;
    storage.set("cartes:theme", key);
    theme = THEMES[key];
    cards = theme.cards.map((c, i) => {
      const r = RARITIES[c.rarity];
      const h = hash(key + c.name);
      return {
        ...c, idx: i, num: i + 1,
        power: r.power[0] + (h % (r.power[1] - r.power[0] + 1)),
        hue: (theme.hue + (h % 120) - 60 + 360) % 360,
      };
    });
    state = Object.assign(freshState(), storage.get("cartes:state:" + key, {}));
    document.documentElement.style.setProperty("--accent", theme.accent);
    document.documentElement.style.setProperty("--theme-hue", theme.hue);
    $("#brandIcon").textContent = theme.icon;
    $("#themeName").textContent = theme.name;
    $("#themeTagline").textContent = theme.tagline;
    document.title = theme.name + " · Collection";
    renderAll();
  }

  const save = () => storage.set("cartes:state:" + themeKey, state);
  const own = (idx) => state.owned[idx] || { n: 0, s: 0 };

  // ---------- Rendu d'une carte ----------
  function cardEl(card, { shiny = false, isNew = false, count = null } = {}) {
    const r = RARITIES[card.rarity];
    const node = el("div", `card r-${card.rarity}${shiny ? " shiny" : ""}`);
    node.dataset.idx = card.idx;
    node.style.setProperty("--rc", r.color);
    node.style.setProperty("--art-hue", card.hue);
    node.innerHTML = `
      <div class="card-inner">
        <div class="card-frame">
          <div class="card-head">
            <span class="card-name">${esc(card.name)}</span>
            <span class="card-power">${card.power}</span>
          </div>
          <div class="card-art"><span class="card-emoji">${card.emoji}</span></div>
          <div class="card-type">${esc(card.type)}</div>
          <p class="card-desc">${esc(card.desc)}</p>
          <div class="card-foot">
            <span class="gems">${"◆".repeat(r.gems)}</span>
            <span class="card-num">${shiny ? "✦ " : ""}${pad(card.num)}/${pad(cards.length)}</span>
          </div>
        </div>
        <div class="holo"></div>
        <div class="sparkle"></div>
        <div class="glare"></div>
      </div>
      ${isNew ? '<span class="badge-new">NEW</span>' : ""}
      ${count ? `<span class="badge-count">${count}</span>` : ""}`;
    return node;
  }

  function lockedEl(card) {
    const node = el("div", "card locked");
    node.dataset.idx = card.idx;
    node.innerHTML = `<div class="card-inner"><div class="locked-face">
      <span class="locked-emoji">${card.emoji}</span>
      <span class="locked-num">${pad(card.num)}</span>
      <span class="gems" style="color:${RARITIES[card.rarity].color}">${"◆".repeat(RARITIES[card.rarity].gems)}</span>
    </div></div>`;
    return node;
  }

  // Inclinaison 3D + reflet suivant le pointeur (délégation pour toutes les cartes).
  function tilt(card, e) {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const strength = card.closest(".detail-card") ? 18 : 12;
    card.style.setProperty("--rx", `${(0.5 - y) * strength}deg`);
    card.style.setProperty("--ry", `${(x - 0.5) * strength}deg`);
    card.style.setProperty("--mx", `${x * 100}%`);
    card.style.setProperty("--my", `${y * 100}%`);
    card.style.setProperty("--bg-x", `${30 + x * 40}%`);
    card.style.setProperty("--bg-y", `${30 + y * 40}%`);
    card.classList.add("active");
  }
  function untilt(card) {
    ["--rx", "--ry", "--mx", "--my", "--bg-x", "--bg-y"].forEach((p) => card.style.removeProperty(p));
    card.classList.remove("active");
  }
  document.addEventListener("pointermove", (e) => {
    const card = e.target.closest(".card:not(.locked)");
    document.querySelectorAll(".card.active").forEach((c) => c !== card && untilt(c));
    if (card && !card.closest(".flip:not(.flipped)")) tilt(card, e);
  });
  document.addEventListener("pointerleave", () => document.querySelectorAll(".card.active").forEach(untilt));

  // ---------- Boutique ----------
  function renderShop() {
    const box = $("#packs");
    box.innerHTML = "";
    for (const [key, p] of Object.entries(PACKS)) {
      const node = el("div", `pack-offer pack-${key}`);
      node.innerHTML = `
        <div class="pack" data-pack="${key}">
          <div class="pack-top"></div>
          <div class="pack-body">
            <span class="pack-icon">${theme.icon}</span>
            <span class="pack-title">${esc(theme.pack)}</span>
            <span class="pack-sub">${esc(p.label)}</span>
          </div>
        </div>
        <p class="pack-blurb">${esc(p.blurb)}</p>
        <button class="btn primary buy" data-pack="${key}"></button>`;
      box.appendChild(node);
    }
    updateShopButtons();
    renderOdds();
  }

  function updateShopButtons() {
    document.querySelectorAll("button.buy").forEach((b) => {
      const p = PACKS[b.dataset.pack];
      if (p.free) {
        const left = FREE_COOLDOWN - (Date.now() - state.lastFree);
        if (left > 0) {
          const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
          b.textContent = `Disponible dans ${m}:${String(s).padStart(2, "0")}`;
          b.disabled = true;
        } else {
          b.textContent = "Ouvrir gratuitement";
          b.disabled = false;
        }
      } else {
        b.innerHTML = `Ouvrir · <span class="coin">◎</span> ${p.cost}`;
        b.disabled = state.coins < p.cost;
      }
    });
    $("#coins").textContent = state.coins.toLocaleString("fr-FR");
  }
  setInterval(updateShopButtons, 1000);

  function renderOdds() {
    const present = new Set(cards.map((c) => c.rarity));
    const rows = ORDER.filter((r) => present.has(r)).map((r) => {
      const n = cards.filter((c) => c.rarity === r).length;
      const pct = (SLOT_WEIGHTS.any[r] / Object.values(SLOT_WEIGHTS.any).reduce((a, b) => a + b, 0)) * 100;
      return `<tr><td><span class="dot" style="background:${RARITIES[r].color}"></span>${RARITIES[r].label}</td>
        <td>${n} cartes</td><td>${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % par carte</td></tr>`;
    });
    $("#oddsTable").innerHTML = `<table>${rows.join("")}</table>
      <p class="muted">Dernière carte de chaque booster : peu commune ou mieux garantie.
      Chance de shiny : 1 sur 15 par carte (1 sur 4 dans le Booster Éclat, avec 1 shiny garanti).</p>`;
  }

  // ---------- Tirage ----------
  function drawRarity(slot) {
    const present = new Set(cards.map((c) => c.rarity));
    const weights = Object.fromEntries(Object.entries(SLOT_WEIGHTS[slot]).filter(([r]) => present.has(r)));
    return weightedPick(weights);
  }

  function drawPack(p) {
    const pulls = p.slots.map((slot) => {
      const rarity = drawRarity(slot);
      const pool = cards.filter((c) => c.rarity === rarity);
      return { card: pool[Math.floor(Math.random() * pool.length)], shiny: Math.random() < p.shinyRate };
    });
    if (p.guaranteedShiny && !pulls.some((x) => x.shiny)) {
      pulls[Math.floor(Math.random() * pulls.length)].shiny = true;
    }
    // Les meilleures cartes en dernier pour le suspense.
    return pulls.sort((a, b) => ORDER.indexOf(a.card.rarity) - ORDER.indexOf(b.card.rarity) || a.shiny - b.shiny);
  }

  function openPack(key) {
    const p = PACKS[key];
    if (p.free) {
      if (Date.now() - state.lastFree < FREE_COOLDOWN) return;
      state.lastFree = Date.now();
    } else {
      if (state.coins < p.cost) return toast("Pas assez de pièces");
      state.coins -= p.cost;
    }
    const pulls = drawPack(p);
    // Enregistrement immédiat : rien n'est perdu si la page est fermée pendant l'animation.
    for (const pull of pulls) {
      const o = (state.owned[pull.card.idx] ||= { n: 0, s: 0 });
      pull.isNew = pull.shiny ? o.s === 0 : o.n === 0 && o.s === 0;
      pull.shiny ? o.s++ : o.n++;
      state.stats.cards++;
      if (pull.shiny) state.stats.shinies++;
      if (pull.card.rarity === "L") state.stats.legendaries++;
    }
    state.stats.packs++;
    save();
    updateShopButtons();
    showOpening(pulls);
  }

  // ---------- Animation d'ouverture ----------
  let pendingFlips = 0;

  function showOpening(pulls) {
    const overlay = $("#opening"), stage = $("#stage");
    stage.innerHTML = "";
    stage.className = "stage";
    $("#collect").hidden = true;
    $("#revealAll").hidden = true;
    overlay.hidden = false;

    const pack = el("div", "pack big");
    pack.innerHTML = `<div class="pack-top"></div>
      <div class="pack-body"><span class="pack-icon">${theme.icon}</span>
      <span class="pack-title">${esc(theme.pack)}</span><span class="pack-sub">Cliquer pour ouvrir</span></div>`;
    stage.appendChild(pack);

    pack.addEventListener("click", () => {
      pack.classList.add("tearing");
      setTimeout(() => {
        pack.remove();
        dealCards(pulls);
      }, 900);
    }, { once: true });
  }

  function dealCards(pulls) {
    const stage = $("#stage");
    stage.classList.add("dealt");
    pendingFlips = pulls.length;
    pulls.forEach((pull, i) => {
      const flip = el("div", `flip r-${pull.card.rarity}${pull.shiny ? " has-shiny" : ""}`);
      flip.style.setProperty("--rc", RARITIES[pull.card.rarity].color);
      flip.style.animationDelay = `${i * 90}ms`;
      const back = el("div", "flip-back", `<div class="back-pattern"><span>${theme.icon}</span></div>`);
      const front = el("div", "flip-front");
      front.appendChild(cardEl(pull.card, { shiny: pull.shiny, isNew: pull.isNew }));
      flip.append(back, front);
      flip.addEventListener("click", () => reveal(flip, pull), { once: true });
      stage.appendChild(flip);
    });
    $("#revealAll").hidden = false;
  }

  function reveal(flip, pull) {
    if (flip.classList.contains("flipped")) return;
    flip.classList.add("flipped");
    if (pull.shiny || ORDER.indexOf(pull.card.rarity) >= 2) {
      const burst = el("div", `burst${pull.shiny ? " burst-shiny" : ""}`);
      flip.appendChild(burst);
      setTimeout(() => burst.remove(), 1200);
    }
    if (pull.shiny) toast(`✦ ${pull.card.name} shiny !`);
    else if (pull.card.rarity === "L") toast(`★ ${pull.card.name} — Légendaire !`);
    if (--pendingFlips === 0) {
      $("#revealAll").hidden = true;
      $("#collect").hidden = false;
    }
  }

  $("#revealAll").addEventListener("click", () => {
    document.querySelectorAll("#stage .flip:not(.flipped)").forEach((f, i) => setTimeout(() => f.click(), i * 180));
  });
  $("#collect").addEventListener("click", () => {
    $("#opening").hidden = true;
    renderAll();
  });

  // ---------- Album ----------
  function renderProgress() {
    const total = cards.length;
    const owned = cards.filter((c) => own(c.idx).n + own(c.idx).s > 0).length;
    const shiny = cards.filter((c) => own(c.idx).s > 0).length;
    $("#progNormal").textContent = `${owned}/${total}`;
    $("#progShiny").textContent = `${shiny}/${total}`;
    $("#barNormal").style.width = `${(owned / total) * 100}%`;
    $("#barShiny").style.width = `${(shiny / total) * 100}%`;
  }

  function renderAlbum() {
    const q = $("#search").value.trim().toLowerCase();
    const fr = $("#filterRarity").value;
    const fo = $("#filterOwned").value;
    const grid = $("#grid");
    grid.innerHTML = "";
    let shown = 0;
    for (const card of cards) {
      const o = own(card.idx);
      const has = o.n + o.s > 0;
      if (fr && card.rarity !== fr) continue;
      if (fo === "owned" && !has) continue;
      if (fo === "missing" && has) continue;
      if (fo === "shiny" && !o.s) continue;
      if (fo === "dupes" && o.n < 2 && o.s < 2) continue;
      if (q && !(has && card.name.toLowerCase().includes(q))) continue;
      const cell = el("div", "cell");
      if (has) {
        const total = o.n + o.s;
        cell.appendChild(cardEl(card, { shiny: o.s > 0, count: total > 1 ? `×${total}` : null }));
        if (o.s) cell.appendChild(el("span", "badge-shiny", `✦${o.s > 1 ? " " + o.s : ""}`));
      } else {
        cell.appendChild(lockedEl(card));
      }
      grid.appendChild(cell);
      shown++;
    }
    if (!shown) grid.appendChild(el("p", "muted empty", "Aucune carte ne correspond."));
  }

  $("#grid").addEventListener("click", (e) => {
    const card = e.target.closest(".card:not(.locked)");
    if (card) openDetail(+card.dataset.idx);
  });
  ["#search", "#filterRarity", "#filterOwned"].forEach((s) => $(s).addEventListener("input", renderAlbum));

  function sellValue(card, shiny) {
    return RARITIES[card.rarity].sell * (shiny ? SHINY_SELL_MULT : 1);
  }

  function sell(idx, shiny, qty) {
    const card = cards[idx], o = own(idx);
    const key = shiny ? "s" : "n";
    const n = Math.min(qty, o[key] - 1);
    if (n <= 0) return 0;
    o[key] -= n;
    const gain = n * sellValue(card, shiny);
    state.coins += gain;
    state.stats.sold += gain;
    return gain;
  }

  $("#sellAll").addEventListener("click", () => {
    let gain = 0;
    for (const c of cards) gain += sell(c.idx, false, Infinity) + sell(c.idx, true, Infinity);
    save();
    toast(gain ? `Doublons vendus : +${gain} ◎` : "Aucun doublon à vendre");
    renderAll();
  });

  // ---------- Détail ----------
  let detailShiny = false;

  function openDetail(idx, shiny) {
    const card = cards[idx], o = own(idx), r = RARITIES[card.rarity];
    detailShiny = shiny ?? o.s > 0;
    const box = $("#detailCard");
    box.innerHTML = "";
    box.appendChild(cardEl(card, { shiny: detailShiny }));
    $("#detailInfo").innerHTML = `
      <h2>${esc(card.name)}</h2>
      <p class="rarity-line" style="color:${r.color}">${"◆".repeat(r.gems)} ${r.label}</p>
      <p class="muted">${esc(card.type)} · n° ${pad(card.num)}</p>
      <div class="owned-row">
        <div><b>${o.n}</b><span>normale${o.n > 1 ? "s" : ""}</span></div>
        <div class="shiny-text"><b>${o.s}</b><span>shiny</span></div>
      </div>
      <div class="detail-actions">
        ${o.n > 0 && o.s > 0 ? `<button class="btn ghost" data-act="toggle">Voir la version ${detailShiny ? "normale" : "shiny"}</button>` : ""}
        ${o.n > 1 ? `<button class="btn" data-act="sell-n">Vendre 1 doublon · +${sellValue(card, false)} ◎</button>` : ""}
        ${o.s > 1 ? `<button class="btn" data-act="sell-s">Vendre 1 doublon shiny · +${sellValue(card, true)} ◎</button>` : ""}
      </div>`;
    $("#detailInfo").onclick = (e) => {
      const act = e.target.dataset.act;
      if (act === "toggle") openDetail(idx, !detailShiny);
      if (act === "sell-n" || act === "sell-s") {
        const gain = sell(idx, act === "sell-s", 1);
        save();
        toast(`+${gain} ◎`);
        updateShopButtons();
        renderAlbum();
        openDetail(idx, detailShiny);
      }
    };
    $("#detail").hidden = false;
  }

  const closeDetail = () => ($("#detail").hidden = true);
  $("#detailClose").addEventListener("click", closeDetail);
  $("#detail").addEventListener("click", (e) => e.target.id === "detail" && closeDetail());
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeDetail());

  // ---------- Réglages ----------
  function renderSettings() {
    const list = $("#themeList");
    list.innerHTML = "";
    for (const [key, t] of Object.entries(THEMES)) {
      const s = storage.get("cartes:state:" + key, null);
      const owned = s ? Object.values(s.owned).filter((o) => o.n + o.s > 0).length : 0;
      const b = el("button", `theme-choice${key === themeKey ? " current" : ""}`);
      b.style.setProperty("--tc", t.accent);
      b.innerHTML = `<span class="theme-icon">${t.icon}</span>
        <span><b>${esc(t.name)}</b><small>${esc(t.tagline)}</small></span>
        <span class="theme-prog">${owned}/${t.cards.length}</span>`;
      b.addEventListener("click", () => { loadTheme(key); toast(`Thème : ${t.name}`); });
      list.appendChild(b);
    }
    const st = state.stats;
    $("#stats").innerHTML = [
      ["Boosters ouverts", st.packs], ["Cartes obtenues", st.cards], ["Shiny obtenues", st.shinies],
      ["Légendaires obtenues", st.legendaries], ["Pièces gagnées en ventes", st.sold],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v.toLocaleString("fr-FR")}</dd></div>`).join("");
  }

  $("#reset").addEventListener("click", () => {
    if (!confirm(`Effacer toute la collection « ${theme.name} » ?`)) return;
    state = freshState();
    save();
    renderAll();
    toast("Collection réinitialisée");
  });

  // ---------- Navigation ----------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + t.dataset.view));
  }));

  $("#packs").addEventListener("click", (e) => {
    const b = e.target.closest("button.buy");
    if (b && !b.disabled) openPack(b.dataset.pack);
  });

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function renderAll() {
    const sel = $("#filterRarity");
    const present = new Set(cards.map((c) => c.rarity));
    sel.innerHTML = '<option value="">Toutes raretés</option>' +
      ORDER.filter((r) => present.has(r)).map((r) => `<option value="${r}">${RARITIES[r].label}</option>`).join("");
    renderShop();
    renderProgress();
    renderAlbum();
    renderSettings();
  }

  loadTheme(themeKey);
})();
