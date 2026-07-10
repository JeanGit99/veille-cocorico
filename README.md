# veille-cocorico

Petit poller **sans dépendance** qui surveille toute **décision** concernant le festival
**Cocorico Electro** du **samedi 11 juillet 2026** (château de La Ferté-Saint-Aubin, Loiret) —
annulation, report, restriction par arrêté préfectoral (canicule / vigilance rouge), ou
maintien confirmé — et envoie une **alerte push [ntfy](https://ntfy.sh)** dès qu'il y a du nouveau.

Tourne **100 % dans le cloud via GitHub Actions** (aucun PC à laisser allumé).

## Comment ça marche

À chaque exécution (`check.py`) :
1. **Site officiel** `cocorico-electro.fr` → apparition d'un terme de décision (annulé, reporté, maintenu, canicule…).
2. **Google News (festival)** → tout article citant *Cocorico* + un mot de décision.
3. **Google News (préfecture)** → un **arrêté préfectoral** restreignant rassemblements / événements pendant la canicule.
4. Dédoublonnage via `state.json` (chaque article n'alerte qu'une fois ; la baseline est établie au 1er passage, sans alerter).
5. **Alerte** → push `ntfy` urgent avec la citation + le lien. **Heartbeat** discret à chaque passage (topic `…-hb`) pour vérifier que la veille tourne.
6. **Garde-fou** : plus aucune alerte après le **samedi 11/07 20h00 (Paris)**.

## Configuration

- **Secret de dépôt requis** : `NTFY_TOPIC` = le nom du topic ntfy des alertes.
  (Settings → Secrets and variables → Actions → *New repository secret*.)
  Le heartbeat est envoyé sur `<NTFY_TOPIC>-hb`.
- **Planification** : `.github/workflows/veille.yml`, cron `*/5 * 10,11 7 *`
  (toutes les 5 min, uniquement les 10-11 juillet UTC → **s'arrête tout seul** ensuite).
- Déclenchement manuel possible : onglet **Actions → veille-cocorico → Run workflow**.

## Limites connues

- **Latence GitHub Actions** : les crons planifiés peuvent être décalés de quelques minutes
  (parfois plus en cas de forte charge). Alerte « quasi » temps réel, pas à la seconde.
- **Instagram / Facebook non lus** (murs anti-bot). La détection s'appuie sur le site officiel,
  la presse (Google News) et la préfecture — qui répercutent une annonce en quelques minutes.
- Détection par **mots-clés** : pensée pour éviter les faux positifs, mais un cas très inhabituel
  pourrait passer. La source est toujours citée dans l'alerte pour que tu juges.

## Arrêter

- Onglet **Actions** → *disable workflow*, ou pause le dépôt, ou supprime le dépôt.
- Le poller cesse de toute façon de se déclencher après le 11 juillet.
