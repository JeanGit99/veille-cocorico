// Thème « Fromages AOP » : chaque carte est illustrée par un fromage dessiné en SVG
// à partir de sa forme, de sa croûte et de sa pâte.
// Rareté calquée (approximativement) sur les volumes de production.

(() => {
  "use strict";

  // ---------- Outils de dessin ----------
  function mix(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const ch = (v) => Math.round(v + (t - v) * p);
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  function rng(str) {
    let a = 0;
    for (let i = 0; i < str.length; i++) a = Math.imul(a ^ str.charCodeAt(i), 2654435761);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const f = (n) => n.toFixed(1);

  // Semis de petits points (fleur blanche, marbrures, cendre…) dans une zone donnée.
  function speckles(rand, n, point, color, rMax = 1.4, opacity = 0.75) {
    let out = "";
    for (let i = 0; i < n; i++) {
      const [x, y] = point();
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.4 + rand() * rMax)}" fill="${color}" opacity="${opacity}"/>`;
    }
    return out;
  }

  // Part triangulaire posée devant le fromage : montre la pâte (persillage, raie de cendre).
  function wedge(c, rand, x0, y0, len, hs) {
    const top = c.top || mix(c.rind, 0.12);
    const P = [x0, y0], R = [x0 + len, y0 + 3], Q = [x0 + len - 9, y0 - 9];
    let s = `<polygon points="${P} ${Q} ${R}" fill="${top}"/>`;
    s += `<polygon points="${P} ${R} ${R[0]},${R[1] + hs} ${P[0]},${P[1] + hs}" fill="${c.paste}"/>`;
    s += `<polygon points="${P} ${R} ${R[0]},${R[1] + hs} ${P[0]},${P[1] + hs}" fill="black" opacity=".06"/>`;
    if (c.veins) {
      for (let i = 0; i < 16; i++) {
        const t = 0.08 + rand() * 0.88;
        const x = x0 + t * len, y = y0 + t * 3 + (0.12 + rand() * 0.76) * hs;
        s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(0.8 + rand() * 1.8)}" ry="${f(0.5 + rand() * 1.1)}" transform="rotate(${Math.round(rand() * 180)} ${f(x)} ${f(y)})" fill="${c.veins}" opacity=".85"/>`;
      }
    }
    if (c.ash) s += `<line x1="${P[0]}" y1="${f(P[1] + hs / 2)}" x2="${R[0]}" y2="${f(R[1] + hs / 2)}" stroke="#2b2b2b" stroke-width="1.3"/>`;
    if (c.bloom || c.washed) s += `<line x1="${P[0]}" y1="${P[1] + hs}" x2="${R[0]}" y2="${R[1] + hs}" stroke="${c.rind}" stroke-width="1.6"/>`;
    s += `<line x1="${Q[0]}" y1="${Q[1]}" x2="${R[0]}" y2="${R[1]}" stroke="${mix(c.rind, -0.1)}" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<line x1="${R[0]}" y1="${R[1]}" x2="${R[0]}" y2="${R[1] + hs}" stroke="${mix(c.rind, -0.15)}" stroke-width="2.6"/>`;
    return s;
  }

  // Cylindre vu de trois quarts : meules, tambours, disques.
  function cylinder(c, rand) {
    const w = c.w, h = c.h, ry = w * 0.2;
    const slice = c.slice !== false;
    const cx = slice ? 44 : 50;
    const by = 50 + h / 2 + ry / 2;
    const l = cx - w / 2, r = cx + w / 2, ty = by - h;
    const side = mix(c.rind, -0.18), top = c.top || mix(c.rind, 0.08);
    let s = `<ellipse cx="${cx + 6}" cy="${f(by + ry + 3)}" rx="${f(w / 2 + 10)}" ry="${f(ry * 0.7 + 2)}" fill="black" opacity=".25"/>`;
    s += `<path d="M${f(l)},${f(ty)} L${f(l)},${f(by)} A${f(w / 2)},${f(ry)} 0 0 0 ${f(r)},${f(by)} L${f(r)},${f(ty)} Z" fill="${side}"/>`;
    // Ombre douce sur la droite du flanc.
    s += `<path d="M${f(cx + w * 0.15)},${f(ty)} L${f(cx + w * 0.15)},${f(by + ry * 0.95)} A${f(w / 2)},${f(ry)} 0 0 0 ${f(r)},${f(by)} L${f(r)},${f(ty)} Z" fill="black" opacity=".12"/>`;

    const sidePoint = () => {
      const x = l + rand() * w, k = Math.sqrt(Math.max(0, 1 - ((x - cx) / (w / 2)) ** 2)) * ry;
      return [x, ty + k + rand() * (h)];
    };
    const topPoint = () => {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.92;
      return [cx + Math.cos(a) * d * w / 2, ty + Math.sin(a) * d * ry];
    };

    if (c.spruce) {
      // Sangle d'épicéa (Mont d'Or).
      s += `<path d="M${f(l)},${f(ty + 1)} L${f(l)},${f(by - 1)} A${f(w / 2)},${f(ry)} 0 0 0 ${f(r)},${f(by - 1)} L${f(r)},${f(ty + 1)} A${f(w / 2)},${f(ry)} 0 0 1 ${f(l)},${f(ty + 1)} Z" fill="#9a6a3c"/>`;
      for (let i = 1; i < 8; i++) {
        const x = l + (w * i) / 8, k = Math.sqrt(1 - ((x - cx) / (w / 2)) ** 2) * ry;
        s += `<line x1="${f(x)}" y1="${f(ty + k + 1)}" x2="${f(x)}" y2="${f(by + k - 1)}" stroke="#6e4524" stroke-width=".6" opacity=".7"/>`;
      }
    }
    if (c.bands) {
      // Bandes de laîche (Livarot).
      for (let i = 1; i <= c.bands; i++) {
        const y = ty + (h * i) / (c.bands + 1);
        s += `<path d="M${f(l)},${f(y)} A${f(w / 2)},${f(ry)} 0 0 0 ${f(r)},${f(y)}" fill="none" stroke="#6f7f32" stroke-width="1.8"/>`;
      }
    }
    if (c.ash && !c.bloom) {
      const y = ty + h / 2;
      s += `<path d="M${f(l)},${f(y)} A${f(w / 2)},${f(ry)} 0 0 0 ${f(r)},${f(y)}" fill="none" stroke="#2b2b2b" stroke-width="1"/>`;
    }

    s += `<ellipse cx="${cx}" cy="${f(ty)}" rx="${f(w / 2)}" ry="${f(ry)}" fill="${top}"/>`;
    if (c.fountain) s += `<ellipse cx="${cx}" cy="${f(ty + 0.6)}" rx="${f(w * 0.3)}" ry="${f(ry * 0.55)}" fill="${mix(c.rind, -0.25)}"/>`;
    if (c.spruce) {
      for (let i = 0; i < 6; i++) {
        const y = ty - ry * 0.6 + i * ry * 0.24;
        s += `<path d="M${f(cx - w * 0.36)},${f(y)} q${f(w * 0.12)},-2 ${f(w * 0.24)},0 t${f(w * 0.24)},0 t${f(w * 0.24)},0" fill="none" stroke="${mix(c.rind, -0.2)}" stroke-width=".7" opacity=".7"/>`;
      }
    }
    if (c.bloom) {
      s += speckles(rand, Math.round(w * 0.9), topPoint, c.bloom, 1.3);
      s += speckles(rand, Math.round(w * 0.6), sidePoint, c.bloom, 1.2);
    }
    if (c.mottle) {
      s += speckles(rand, Math.round(w * 0.8), topPoint, c.mottle, 1.8, 0.55);
      s += speckles(rand, Math.round(w * 0.5), sidePoint, c.mottle, 1.6, 0.55);
    }
    if (c.washed) s += speckles(rand, Math.round(w * 0.5), topPoint, mix(c.rind, -0.2), 1.1, 0.45);
    s += `<ellipse cx="${f(cx - w * 0.18)}" cy="${f(ty - ry * 0.25)}" rx="${f(w * 0.2)}" ry="${f(ry * 0.3)}" fill="white" opacity=".18"/>`;

    if (slice) {
      const hs = Math.max(8, Math.min(h * 0.85, 34));
      s += wedge(c, rand, 52, by + ry + 4 - hs, 40, hs);
    }
    return s;
  }

  // Bûche couchée (Sainte-Maure), avec sa paille.
  function log(c, rand) {
    const x1 = 18, x2 = 78, cy = 54, ry = 13, rx = 6;
    let s = `<ellipse cx="50" cy="${cy + ry + 4}" rx="38" ry="5" fill="black" opacity=".25"/>`;
    s += `<ellipse cx="${x1}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${mix(c.rind, -0.15)}"/>`;
    s += `<rect x="${x1}" y="${cy - ry}" width="${x2 - x1}" height="${ry * 2}" fill="${c.rind}"/>`;
    s += `<rect x="${x1}" y="${cy + 2}" width="${x2 - x1}" height="${ry - 2}" fill="black" opacity=".14"/>`;
    s += speckles(rand, 70, () => [x1 + rand() * (x2 - x1), cy - ry + rand() * ry * 2], c.bloom, 1.2);
    s += `<ellipse cx="${x2}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.paste}" stroke="${c.rind}" stroke-width="1.4"/>`;
    s += `<line x1="${x2 - 2}" y1="${cy}" x2="${x2 + 10}" y2="${cy - 1}" stroke="#d8b04a" stroke-width="1.6" stroke-linecap="round"/>`;
    s += `<circle cx="${x2}" cy="${cy}" r="1.3" fill="#b88d2e"/>`;
    return s;
  }

  // Pyramide tronquée (Valençay, Pouligny-Saint-Pierre).
  function pyramid(c, rand) {
    const by = 80, bw = 46, tw = c.tw, ht = c.ht, dx = 12, dy = 8, k = tw / bw;
    const L = 50 - bw / 2 - 4, Rb = L + bw, ty = by - ht, tl = 50 - tw / 2 - 4, tr = tl + tw;
    let s = `<ellipse cx="56" cy="${by + 2}" rx="34" ry="6" fill="black" opacity=".25"/>`;
    const front = `${L},${by} ${Rb},${by} ${tr},${ty} ${tl},${ty}`;
    const right = `${Rb},${by} ${Rb + dx},${by - dy} ${f(tr + dx * k)},${f(ty - dy * k)} ${tr},${ty}`;
    const topF = `${tl},${ty} ${tr},${ty} ${f(tr + dx * k)},${f(ty - dy * k)} ${f(tl + dx * k)},${f(ty - dy * k)}`;
    s += `<polygon points="${front}" fill="${c.rind}"/>`;
    s += `<polygon points="${right}" fill="${mix(c.rind, -0.22)}"/>`;
    s += `<polygon points="${topF}" fill="${mix(c.rind, 0.1)}"/>`;
    if (c.bloom) {
      s += speckles(rand, 60, () => {
        const v = rand(), half = (bw - (bw - tw) * v) / 2;
        return [46 + (rand() * 2 - 1) * half * 0.95, by - v * ht];
      }, c.bloom, 1.2);
    }
    return s;
  }

  // Pavé carré (Pont-l'Évêque, Maroilles), avec le quadrillage des claies.
  function square(c, rand) {
    const x = 22, y = 56, w = 48, h = 20, dx = 14, dy = 10;
    let s = `<ellipse cx="54" cy="${y + h + 3}" rx="38" ry="6" fill="black" opacity=".25"/>`;
    s += `<polygon points="${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}" fill="${mix(c.rind, -0.12)}"/>`;
    s += `<polygon points="${x + w},${y} ${x + w + dx},${y - dy} ${x + w + dx},${y - dy + h} ${x + w},${y + h}" fill="${mix(c.rind, -0.28)}"/>`;
    s += `<polygon points="${x},${y} ${x + w},${y} ${x + w + dx},${y - dy} ${x + dx},${y - dy}" fill="${c.rind}"/>`;
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      s += `<line x1="${f(x + w * t)}" y1="${y}" x2="${f(x + w * t + dx)}" y2="${y - dy}" stroke="${mix(c.rind, -0.25)}" stroke-width=".6"/>`;
      s += `<line x1="${f(x + dx * t)}" y1="${f(y - dy * t)}" x2="${f(x + w + dx * t)}" y2="${f(y - dy * t)}" stroke="${mix(c.rind, -0.25)}" stroke-width=".6"/>`;
    }
    s += speckles(rand, 30, () => [x + rand() * w, y + rand() * h], mix(c.rind, -0.3), 1, 0.4);
    return s;
  }

  // Cœur (Neufchâtel).
  function heart(c, rand) {
    const d = "M50 80 C22 62 18 42 32 36 C42 32 50 38 50 45 C50 38 58 32 68 36 C82 42 78 62 50 80 Z";
    let s = `<ellipse cx="52" cy="84" rx="28" ry="5" fill="black" opacity=".25"/>`;
    s += `<path d="${d}" transform="translate(0 6)" fill="${mix(c.rind, -0.2)}"/>`;
    s += `<path d="${d}" fill="${c.rind}"/>`;
    s += speckles(rand, 80, () => {
      for (;;) {
        const x = 24 + rand() * 52, y = 34 + rand() * 44;
        const nx = (x - 50) / 26, ny = (y - 40) / 34;
        if (nx * nx + (ny - Math.sqrt(Math.abs(nx)) * 0.6) ** 2 < 0.9) return [x, y];
      }
    }, c.bloom, 1.2);
    s += `<ellipse cx="38" cy="44" rx="7" ry="4" fill="white" opacity=".35"/>`;
    return s;
  }

  // Banon : petit palet emmailloté dans des feuilles de châtaignier.
  function leafParcel(c, rand) {
    let s = `<ellipse cx="52" cy="76" rx="32" ry="7" fill="black" opacity=".25"/>`;
    s += `<ellipse cx="50" cy="58" rx="30" ry="18" fill="#6b4a22"/>`;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
      const ex = 50 + Math.cos(a) * 30, ey = 58 + Math.sin(a) * 17;
      const col = ["#8a6230", "#9c7138", "#7a5527"][i % 3];
      s += `<path d="M50,50 Q${f(50 + Math.cos(a - 0.5) * 30)},${f(56 + Math.sin(a - 0.5) * 20)} ${f(ex)},${f(ey)} Q${f(50 + Math.cos(a + 0.5) * 22)},${f(56 + Math.sin(a + 0.5) * 14)} 50,50 Z" fill="${col}" stroke="#5a3d1a" stroke-width=".5"/>`;
      s += `<line x1="50" y1="50" x2="${f(ex)}" y2="${f(ey)}" stroke="#5a3d1a" stroke-width=".4" opacity=".7"/>`;
    }
    s += `<path d="M22,56 Q50,66 78,56" fill="none" stroke="#e3cf8f" stroke-width="1.6"/>`;
    s += `<path d="M38,42 Q46,58 44,75" fill="none" stroke="#e3cf8f" stroke-width="1.6"/>`;
    s += `<path d="M48,49 q-6,-10 2,-12 M52,49 q8,-9 -1,-12" fill="none" stroke="#e3cf8f" stroke-width="1.4" stroke-linecap="round"/>`;
    return s;
  }

  const SHAPES = { cyl: cylinder, log, pyramid, square, heart, leaf: leafParcel };

  function renderCheese(card) {
    const c = card.cheese;
    const body = SHAPES[c.shape](c, rng(card.name));
    return `<svg class="card-svg" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  }

  // ---------- Palettes de croûtes ----------
  const BLOOM = "#fbfaf4";
  const ASH = { rind: "#6a6c68", bloom: "#e9e8e0", paste: "#fbf8ef" };

  const cheese = (name, rarity, milk, region, desc, spec) => ({
    name, rarity, mark: { vache: "🐄", chevre: "🐐", brebis: "🐑" }[milk],
    type: `${{ vache: "Vache", chevre: "Chèvre", brebis: "Brebis" }[milk]} · ${region}`,
    desc, cheese: spec, emoji: "🧀",
  });

  const cards = [
    // Communes : les grandes productions.
    cheese("Comté", "C", "vache", "Jura", "Première AOP de France en volume : des meules d'environ 40 kg affinées au moins 4 mois.",
      { shape: "cyl", w: 72, h: 20, rind: "#b98a3e", paste: "#f3d77e" }),
    cheese("Reblochon", "C", "vache", "Savoie", "Son nom vient de « re-blocher » : traire une seconde fois, en cachette.",
      { shape: "cyl", w: 56, h: 12, rind: "#e1b676", paste: "#f6e7b8", bloom: "#fff7e6" }),
    cheese("Roquefort", "C", "brebis", "Aveyron", "Première AOC fromagère (1925), affiné dans les caves du Combalou.",
      { shape: "cyl", w: 46, h: 32, rind: "#e9e2cf", paste: "#eee6cf", veins: "#4f6a5a" }),
    cheese("Cantal", "C", "vache", "Auvergne", "Déjà cité par Pline l'Ancien ; il se déguste jeune, entre-deux ou vieux.",
      { shape: "cyl", w: 50, h: 40, rind: "#bca47a", paste: "#f2dc9c", mottle: "#8d7a55" }),
    cheese("Saint-Nectaire", "C", "vache", "Auvergne", "Affiné sur un lit de paille de seigle ; Louis XIV l'aurait mis à sa table.",
      { shape: "cyl", w: 58, h: 14, rind: "#a5967f", paste: "#f1e1b3", mottle: "#d4a35d" }),
    cheese("Morbier", "C", "vache", "Jura", "Sa raie noire séparait jadis le caillé du soir de celui du matin.",
      { shape: "cyl", w: 66, h: 18, rind: "#c99a5a", paste: "#f1dc9a", ash: true }),
    cheese("Brie de Meaux", "C", "vache", "Île-de-France", "Sacré « roi des fromages » au congrès de Vienne, en 1815.",
      { shape: "cyl", w: 80, h: 9, rind: "#f2ecdc", paste: "#f3dfa0", bloom: "#d7b98a" }),
    cheese("Munster", "C", "vache", "Alsace-Vosges", "Né chez les moines de la vallée de Munster ; croûte orangée lavée.",
      { shape: "cyl", w: 50, h: 14, rind: "#e98a3c", paste: "#f3e1b1", washed: true }),
    cheese("Camembert de Normandie", "C", "vache", "Normandie", "Lait cru, caillé moulé à la louche ; on prête sa recette à Marie Harel.",
      { shape: "cyl", w: 52, h: 14, rind: "#f4f0e4", paste: "#f4e3a6", bloom: "#d9bf93" }),
    cheese("Fourme d'Ambert", "C", "vache", "Auvergne", "L'un des bleus les plus doux, en haut cylindre d'environ 2 kg.",
      { shape: "cyl", w: 32, h: 50, rind: "#d4c3a2", paste: "#f1e7cc", veins: "#3e6a73", mottle: "#b49a72" }),

    // Peu communes.
    cheese("Bleu d'Auvergne", "U", "vache", "Auvergne", "Mis au point vers 1850 par Antoine Roussel grâce à la moisissure du pain de seigle.",
      { shape: "cyl", w: 48, h: 26, rind: "#e6dac0", paste: "#f2e8cc", veins: "#3b5e6e" }),
    cheese("Beaufort", "U", "vache", "Savoie", "Le « prince des gruyères », reconnaissable à son talon concave.",
      { shape: "cyl", w: 74, h: 20, rind: "#a87a3a", paste: "#f0d48a" }),
    cheese("Mont d'Or", "U", "vache", "Haut-Doubs", "Cerclé d'épicéa, il ne se fabrique qu'en saison froide et se déguste même chaud.",
      { shape: "cyl", w: 58, h: 16, rind: "#d9b77a", paste: "#f5e5b5", spruce: true }),
    cheese("Ossau-Iraty", "U", "brebis", "Pays basque & Béarn", "Traditionnellement servi avec de la confiture de cerises noires.",
      { shape: "cyl", w: 60, h: 22, rind: "#c8964f", paste: "#f3e2b0" }),
    cheese("Abondance", "U", "vache", "Haute-Savoie", "Héritier des moines de l'abbaye d'Abondance, il partage son nom avec une race de vache.",
      { shape: "cyl", w: 64, h: 18, rind: "#b07a3a", paste: "#efd18a" }),
    cheese("Pont-l'Évêque", "U", "vache", "Normandie", "Fromage carré parmi les plus anciens de Normandie.",
      { shape: "square", rind: "#e3a25a", paste: "#f4e2ac" }),
    cheese("Maroilles", "U", "vache", "Thiérache", "Imaginé par les moines de l'abbaye de Maroilles ; vedette de la flamiche.",
      { shape: "square", rind: "#d9772f", paste: "#f3e0ac" }),
    cheese("Chaource", "U", "vache", "Champagne", "Cœur crayeux, sous-croûte fondante : il adore le champagne.",
      { shape: "cyl", w: 40, h: 28, rind: "#f4efe3", paste: "#f8f1dc", bloom: "#dcc9a5" }),
    cheese("Époisses", "U", "vache", "Bourgogne", "Croûte lavée au marc de Bourgogne ; Brillat-Savarin le sacrait roi des fromages.",
      { shape: "cyl", w: 46, h: 16, rind: "#d4682a", paste: "#f3dfa8", washed: true }),

    // Rares.
    cheese("Livarot", "R", "vache", "Normandie", "Surnommé « le colonel » pour ses cinq bandes de laîche.",
      { shape: "cyl", w: 44, h: 22, rind: "#d4893e", paste: "#f2dca4", bands: 5, washed: true }),
    cheese("Salers", "R", "vache", "Cantal", "Uniquement fermier, fabriqué dans une gerle en bois quand les vaches sont au pré.",
      { shape: "cyl", w: 50, h: 42, rind: "#9c7a4e", paste: "#efd18c", mottle: "#6f5535" }),
    cheese("Laguiole", "R", "vache", "Aubrac", "Sa tome fraîche est l'âme de l'aligot.",
      { shape: "cyl", w: 50, h: 40, rind: "#c2a273", paste: "#f0d69a", mottle: "#94784e" }),
    cheese("Sainte-Maure de Touraine", "R", "chevre", "Touraine", "Une paille de seigle gravée le traverse de part en part.",
      { shape: "log", ...ASH }),
    cheese("Crottin de Chavignol", "R", "chevre", "Sancerrois", "Petit chèvre du Sancerrois, inséparable d'un verre de sancerre.",
      { shape: "cyl", w: 30, h: 22, rind: "#e6d4a9", paste: "#fbf6e6", bloom: "#c9b27e", slice: false }),
    cheese("Selles-sur-Cher", "R", "chevre", "Sologne", "Sa croûte cendrée se mange, et c'est même conseillé.",
      { shape: "cyl", w: 46, h: 12, ...ASH }),
    cheese("Neufchâtel", "R", "vache", "Pays de Bray", "En forme de cœur, dit-on, pour séduire les soldats anglais de la guerre de Cent Ans.",
      { shape: "heart", rind: "#f4f0e4", bloom: "#d6c3a0" }),
    cheese("Langres", "R", "vache", "Haute-Marne", "Son creux, la « fontaine », accueille un trait de marc de Champagne.",
      { shape: "cyl", w: 40, h: 26, rind: "#e49448", paste: "#f3e0ae", fountain: true, washed: true }),

    // Épiques.
    cheese("Valençay", "E", "chevre", "Berry", "Pyramide étêtée : Talleyrand l'aurait coupée pour ne pas fâcher Napoléon.",
      { shape: "pyramid", tw: 22, ht: 30, ...ASH }),
    cheese("Pouligny-Saint-Pierre", "E", "chevre", "Berry", "Surnommé la « tour Eiffel » pour sa haute pyramide.",
      { shape: "pyramid", tw: 10, ht: 44, rind: "#e9dfc6", bloom: "#b9ad8e" }),
    cheese("Brie de Melun", "E", "vache", "Île-de-France", "Plus petit, plus épais et plus corsé que son cousin de Meaux.",
      { shape: "cyl", w: 62, h: 12, rind: "#ede2c6", paste: "#f0d58e", bloom: "#b88a52" }),
    cheese("Bleu du Vercors-Sassenage", "E", "vache", "Vercors", "Les barons de Sassenage en réglaient déjà le commerce par une charte de 1338.",
      { shape: "cyl", w: 54, h: 22, rind: "#e3d6b8", paste: "#f3eacd", veins: "#4a6b63", mottle: "#c0aa7e" }),
    cheese("Chevrotin", "E", "chevre", "Savoie", "Le cousin chèvre du reblochon, exclusivement fermier.",
      { shape: "cyl", w: 38, h: 14, rind: "#e8c79a", paste: "#fbf4e2", bloom: BLOOM }),

    // Légendaires : les plus confidentiels.
    cheese("Banon", "L", "chevre", "Provence", "Enveloppé de feuilles de châtaignier nouées de raphia.",
      { shape: "leaf" }),
    cheese("Rigotte de Condrieu", "L", "chevre", "Lyonnais", "Minuscule chèvre des monts du Lyonnais, parmi les plus petites productions AOP.",
      { shape: "cyl", w: 26, h: 16, rind: "#efd2a0", paste: "#fbf4e2", bloom: "#c99a5a", slice: false }),
  ];

  // Placé en premier : c'est le thème par défaut.
  window.THEMES = {
    fromages: {
      name: "Fromages AOP",
      tagline: "Les fromages d'appellation d'origine protégée",
      pack: "Booster Plateau",
      icon: "🧀",
      accent: "#f2b544",
      hue: 40,
      rarityNote: "Rareté calquée sur les volumes de production : le Comté est partout, la Rigotte de Condrieu presque introuvable.",
      render: renderCheese,
      // Planche à fromage en bois derrière chaque illustration.
      artBg: `radial-gradient(circle at 50% 45%, rgb(255 228 170 / .45), transparent 65%),
        repeating-linear-gradient(0deg, rgb(60 30 10 / .10) 0 1px, transparent 1px 6px),
        linear-gradient(90deg, #b9824b 0 33%, #7d5229 33% 33.6%, #a9733f 33.6% 66%, #7d5229 66% 66.6%, #b37b45 66.6%)`,
      cards,
    },
    ...window.THEMES,
  };
})();
