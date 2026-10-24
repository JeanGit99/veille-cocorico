# Cartes : collection & ouverture de boosters

Interface web statique (HTML/CSS/JS, sans dépendance ni build) pour ouvrir des boosters
et compléter une collection de cartes, avec variante **shiny** holographique.

Ouvrir `index.html` dans un navigateur suffit. La progression est sauvegardée dans le `localStorage`.

## Fonctionnalités

- **3 boosters** : gratuit (toutes les 15 min), standard (100 ◎), Éclat (350 ◎, 1 shiny garanti).
- **5 raretés** : Commune, Peu commune, Rare, Épique, Légendaire. Dernière carte du booster ≥ peu commune.
- **Shiny** : 1 chance sur 15 par carte (1 sur 4 dans l'Éclat). Effet holographique arc-en-ciel,
  paillettes et reflet qui suivent la souris, inclinaison 3D.
- **Ouverture animée** : déchirement du booster, cartes distribuées face cachée, halo d'anticipation
  sur les rares, retournement une par une ou « Tout révéler ».
- **Album** : silhouettes des cartes manquantes, compteurs, filtres (rareté, possédées, manquantes,
  shiny, doublons), recherche, progression normale et shiny.
- **Économie** : revente des doublons (shiny ×4) pour racheter des boosters.
- **Multi-thèmes** : chaque thème a sa propre progression.

## Thèmes inclus

| Thème | Cartes | Idée |
|---|---|---|
| **Fromages AOP** (par défaut) | 34 | Du Comté à la Rigotte de Condrieu, illustrés en SVG ; rareté calquée sur les volumes de production |
| Bestiaire de France | 25 | Créatures du folklore régional : Tarasque, Vouivre, Ankou, Mélusine… |
| Océans & Abysses | 20 | Des récifs aux abysses, jusqu'à l'Atlantide |
| Cosmos | 20 | Planètes, étoiles, phénomènes célestes |

## Autres idées de thèmes

- **Monuments & châteaux de France**, avec les châteaux de la Loire en série spéciale.
- **Festival électro** : instruments, styles musicaux, scènes, objets du festivalier.
- **Minéraux & pierres précieuses** : le shiny colle naturellement au thème.
- **Dinosaures & fossiles**.
- **Mythologies du monde** : un set par panthéon (grec, nordique, égyptien, japonais).
- **Insectes & petites bêtes** du jardin.
- **Recettes de grand-mère / gastronomie régionale**.

## Ajouter un thème

Ajouter une entrée dans `themes.js` :

```js
monTheme: {
  name: "Mon thème", tagline: "…", pack: "Booster …", icon: "🎴",
  accent: "#ff6b6b", hue: 0,
  cards: [{ name: "…", emoji: "🎴", rarity: "C", type: "…", desc: "…" }, …],
},
```

Options : `render(card)` pour dessiner l'illustration soi-même (voir `fromages.js`, qui dessine
chaque fromage selon sa forme, sa croûte et sa pâte), `artBg` pour le fond des illustrations,
`rarityNote` pour expliquer la logique de rareté, et `mark` sur une carte pour un petit pictogramme.

Les taux de tirage, prix et règles se règlent en haut de `app.js`.
