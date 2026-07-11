#!/usr/bin/env python3
"""
Veille Cocorico Electro (canicule) - poller sans dependances.

Detecte une DECISION concernant le festival Cocorico Electro du samedi 11/07/2026
(La Ferte-Saint-Aubin, Loiret) : annulation / report / restriction par arrete
prefectoral / maintien confirme, et envoie une alerte push ntfy.

Sources : site officiel + Google News (festival) + Google News (prefecture/canicule).
Etat/dedup : state.json (seen_links, site_terms). Anti-spam : chaque article n'alerte
qu'une fois ; le premier passage (SEED) etablit la baseline sans alerter.

Variables d'env :
  NTFY_TOPIC   topic ntfy pour les alertes (heartbeat sur NTFY_TOPIC + "-hb")
  SEED=1       etablit la baseline (aucune alerte)
  DRY_RUN=1    n'envoie rien a ntfy, affiche seulement
  DEBUG=1      affiche tout ce qui est recupere/evalue
"""
import os, sys, re, json, html, unicodedata, urllib.parse, urllib.request, datetime
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

TOPIC = os.environ.get("NTFY_TOPIC", "").strip()
HB_TOPIC = (TOPIC + "-hb") if TOPIC else ""
SEED = os.environ.get("SEED") == "1"
DRY_RUN = os.environ.get("DRY_RUN") == "1"
DEBUG = os.environ.get("DEBUG") == "1"
STATE_PATH = os.environ.get("STATE_PATH", "state.json")
UA = "Mozilla/5.0 (VeilleCocorico; GitHubActions; +https://ntfy.sh)"

# Plus d'alerte apres samedi 11/07/2026 20:00 Paris = 18:00 UTC
DEADLINE_UTC = datetime.datetime(2026, 7, 11, 18, 0, 0, tzinfo=datetime.timezone.utc)
# Fenetre de recence des articles (heures)
RECENCY_H = 18
# Affichage des heures en HEURE DE PARIS (CEST = UTC+2 l'ete ; le projet ne tourne qu'en juillet).
PARIS_TZ = datetime.timezone(datetime.timedelta(hours=2))

NEWS = "https://news.google.com/rss/search?q={q}&hl=fr&gl=FR&ceid=FR:fr"
FEST_Q = '"Cocorico Electro"'
PREF_Q = 'Loiret canicule (festival OR rassemblement OR arrete OR manifestation OR "plein air" OR evenement OR concert)'
SITE = "https://www.cocorico-electro.fr/"

DECISION_PATTERNS = [
    r"\bannul\w*",       # annule, annulation, annuler, annulee
    r"\breporte\w*",     # reporte, reportee (PAS reportage)
    r"\breport\b",       # report (seul)
    r"\bdeprogramm\w*",
    r"\bmaintenu\w*",    # maintenu, maintenue, maintenus
    r"\bmaintien\b",
    r"\bmaintient\b",
    r"\bsuspend\w*",
    r"\bsuspension\b",
    r"\binterdi\w*",     # interdit, interdiction
    r"\bfermetur\w*",
    r"\bevacu\w*",
]
DECISION_RE = re.compile("|".join(DECISION_PATTERNS))
DECISION_SUBSET = re.compile(r"\bannul\w*|\breporte\w*|\binterdi\w*|\bmaintenu\w*|\bmaintien\b|\bsuspend\w*")


def paris_now():
    """Heure actuelle a Paris (pour l'affichage)."""
    return datetime.datetime.now(PARIS_TZ)


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm(s):
    s = html.unescape(s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = strip_accents(s).lower()
    return re.sub(r"\s+", " ", s).strip()


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        cs = r.headers.get_content_charset()
    return raw.decode(cs or "utf-8", errors="replace")


def load_state():
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(st):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=2, sort_keys=True)


def ntfy(topic, body, title=None, priority=None, tags=None):
    if not topic:
        print("[ntfy] pas de topic (NTFY_TOPIC vide)", file=sys.stderr)
        return
    if DRY_RUN:
        print(f"[DRY_RUN ntfy->{topic}] title={title!r} prio={priority} :: {body}")
        return
    headers = {"User-Agent": UA}
    if title:
        headers["Title"] = title
    if priority:
        headers["Priority"] = priority
    if tags:
        headers["Tags"] = tags
    req = urllib.request.Request("https://ntfy.sh/" + topic, data=body.encode("utf-8"),
                                 headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            r.read()
        print(f"[ntfy->{topic}] OK : {body[:100]}")
    except Exception as e:
        print(f"[ntfy ERREUR->{topic}] {e}", file=sys.stderr)


def alert(summary, url):
    ts = paris_now().strftime("%H:%M")
    body = summary + (f"\nSource: {url}" if url else "") + f"\n(detecte a {ts}, heure de Paris)"
    ntfy(TOPIC, body, title="COCORICO - DECISION", priority="urgent", tags="rotating_light,rooster")


def parse_items(xml_text):
    out = []
    try:
        root = ET.fromstring(xml_text)
    except Exception as e:
        print(f"[rss parse err] {e}", file=sys.stderr)
        return out
    for it in root.iter("item"):
        def g(tag):
            el = it.find(tag)
            return el.text if (el is not None and el.text) else ""
        out.append({"title": g("title"), "link": g("link"),
                    "desc": g("description"), "pub": g("pubDate")})
    return out


def within_hours(pubstr, hours):
    if not pubstr:
        return True
    try:
        dt = parsedate_to_datetime(pubstr)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return (datetime.datetime.now(datetime.timezone.utc) - dt) <= datetime.timedelta(hours=hours)
    except Exception:
        return True


def is_old_storyline(t):
    old = any(k in t for k in ["13 juillet", "quatrieme soiree", "4e soiree", "4eme soiree",
                               "lundi 13", "tribunal", "justice administrative", "arrete municipal",
                               "katia bailly", "mairie"])
    fresh = any(k in t for k in ["canicule", "vigilance", "samedi", "11 juillet", "orsec", "chaleur"])
    return old and not fresh


def consider_fest(it):
    t = norm(it["title"] + " " + it["desc"])
    if "cocorico" not in t:
        return None
    if is_old_storyline(t):
        return None
    hit = bool(DECISION_RE.search(t)) or ("canicule" in t and bool(DECISION_SUBSET.search(t)))
    if hit:
        return (f"PRESSE (festival) : {it['title']}", it["link"])
    return None


def consider_pref(it):
    t = norm(it["title"] + " " + it["desc"])
    # Cocorico cite explicitement : traite comme un signal festival
    if "cocorico" in t:
        if is_old_storyline(t):
            return None
        if DECISION_RE.search(t) or ("canicule" in t and DECISION_SUBSET.search(t)):
            return (f"PRESSE (festival) : {it['title']}", it["link"])
        return None
    # Sinon : uniquement un ARRETE PREFECTORAL restreignant les rassemblements/evenements
    if not any(k in t for k in ["canicule", "vigilance", "orsec"]):
        return None
    prefect = any(k in t for k in ["prefe", "arrete", "prefet"])
    restrict = bool(DECISION_SUBSET.search(t)) or "interdi" in t
    gathering = any(k in t for k in ["rassemblement", "manifestation", "evenement", "festival",
                                     "plein air", "grand public", "grand rassemblement"])
    if prefect and restrict and gathering:
        return (f"PREFECTURE (restriction evenements) : {it['title']}", it["link"])
    return None


def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    now_p = now.astimezone(PARIS_TZ)  # meme instant, affiche en heure de Paris
    st = load_state()
    seen = set(st.get("seen_links", []))
    site_base = set(st.get("site_terms", []))
    baseline = bool(st.get("baseline_established"))

    # Fenetre terminee
    if now > DEADLINE_UTC and not SEED:
        ntfy(HB_TOPIC, f"HB fenetre terminee {now_p.strftime('%Y-%m-%d %H:%M')} (Paris)",
             priority="min", tags="checkered_flag")
        print("Fenetre terminee - aucune alerte.")
        return

    # ---- Site officiel : termes de decision presents
    site_present = set()
    try:
        site_txt = norm(fetch(SITE))
        for m in DECISION_RE.finditer(site_txt):
            site_present.add(m.group(0))
        if "canicule" in site_txt:
            site_present.add("canicule")
        if DEBUG:
            print(f"[site] termes presents = {sorted(site_present)}")
    except Exception as e:
        print(f"[site err] {e}", file=sys.stderr)

    # ---- News festival + prefecture
    fest, pref = [], []
    try:
        fest = parse_items(fetch(NEWS.format(q=urllib.parse.quote(FEST_Q))))
    except Exception as e:
        print(f"[fest news err] {e}", file=sys.stderr)
    try:
        pref = parse_items(fetch(NEWS.format(q=urllib.parse.quote(PREF_Q))))
    except Exception as e:
        print(f"[pref news err] {e}", file=sys.stderr)
    if DEBUG:
        print(f"[news] festival={len(fest)} items, prefecture={len(pref)} items")

    # Candidats qualifiants (title, link)
    candidates = []
    for it in fest:
        r = consider_fest(it)
        if r:
            candidates.append(r)
            if DEBUG:
                print(f"  [FEST match] {it['title']}  <{it['link'][:70]}>")
    for it in pref:
        r = consider_pref(it)
        if r:
            candidates.append(r)
            if DEBUG:
                print(f"  [PREF match] {it['title']}  <{it['link'][:70]}>")

    all_links = [it["link"] for it in (fest + pref) if it["link"]]

    # ---- SEED ou baseline absente : etablir la baseline sans alerter
    if SEED or not baseline:
        st["site_terms"] = sorted(site_base | site_present)
        st["seen_links"] = sorted(seen | set(all_links))
        st["baseline_established"] = True
        save_state(st)
        print(f"[BASELINE] etablie. termes_site={st['site_terms']} liens_vus={len(st['seen_links'])} "
              f"candidats_ignores={len(candidates)}")
        if not SEED:
            ntfy(HB_TOPIC, f"HB baseline {now_p.strftime('%H:%M')} (Paris)", priority="min", tags="seedling")
        return

    # ---- Fonctionnement normal : alerter sur le nouveau
    to_alert = []

    new_site_terms = site_present - site_base
    if new_site_terms:
        to_alert.append((f"SITE OFFICIEL : nouveau(x) terme(s) {sorted(new_site_terms)} sur cocorico-electro.fr",
                         SITE))

    for summary, link in candidates:
        if link and link in seen:
            continue
        it_pub = next((x["pub"] for x in (fest + pref) if x["link"] == link), "")
        if not within_hours(it_pub, RECENCY_H):
            continue
        to_alert.append((summary, link))

    sent = 0
    for summary, url in to_alert:
        alert(summary, url)
        sent += 1

    # Mise a jour de l'etat
    st["site_terms"] = sorted(site_base | site_present)
    st["seen_links"] = sorted(seen | set(all_links))
    st["baseline_established"] = True
    save_state(st)

    status = "ALERTE" if sent else "RAS"
    ntfy(HB_TOPIC, f"HB {status} {now_p.strftime('%Y-%m-%d %H:%M')} (Paris)", priority="min", tags="hourglass")
    print(f"{status} - {sent} alerte(s) - {now_p.isoformat()} (Paris)")


if __name__ == "__main__":
    main()
