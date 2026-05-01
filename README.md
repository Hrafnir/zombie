# Etter Mørket — Zombie Survival Game

Et faktisk nedlastbart HTML/CSS/JS-prosjekt klart for GitHub Pages.

## Hva dette er

**Etter Mørket** er et top-down zombie survival-spill med:

- fullskjerm canvas-spill
- sprite sheet-basert animasjon
- prosedyregenerert kart
- dag/natt-syklus
- ressurser, loot og inventory
- crafting av våpen, piler, bandasjer og historiegjenstander
- bygging av base: bål, arbeidsbenk, barrikader, piggfeller og regnsamler
- ulike zombie-typer: vandrer, løper, kjempe og spytter
- enkel lokal lagring med `localStorage`
- musikk/ambient og lydeffekter
- GitHub Pages-klar filstruktur uten build step

## Filstruktur

```text
index.html
style.css
README.md
src/game.js
data/levels.json
assets/images/spritesheet.png
assets/images/title_cover.png
assets/audio/*.wav
assets/icons/favicon.svg
assets/icons/app-icon.svg
```

## Slik kjører du lokalt

Noen nettlesere blokkerer `fetch()` av JSON dersom du bare dobbeltklikker `index.html`.
Kjør derfor en enkel lokal server fra prosjektmappen:

```bash
python3 -m http.server 8000
```

Åpne deretter:

```text
http://localhost:8000
```

## Slik legger du det på GitHub Pages

1. Opprett et nytt GitHub repository.
2. Last opp alle filene i roten av repositoryet.
3. Gå til **Settings → Pages**.
4. Velg **Deploy from a branch**.
5. Velg branch `main` og folder `/root`.
6. Trykk **Save**.
7. Etter kort tid får du en GitHub Pages-lenke.

## Kontroller

| Tast | Handling |
|---|---|
| WASD / piltaster | Bevegelse |
| Shift | Sprint |
| Mus | Sikt |
| Venstreklikk | Angrip / skyt / plasser bygg |
| E | Samle, loot eller bruk objekt |
| C | Crafting |
| B | Byggemeny |
| I | Inventory og status |
| 1–5 | Velg våpen |
| Space | Dodge |
| Esc | Pause / lukk panel |

## Designnotater

Spillet er laget som en solid MVP med dybde nok til videreutvikling. All spillbalanse ligger primært i `data/levels.json`, slik at du enkelt kan endre oppskrifter, fiender, våpen og bygg uten å rote for mye i spillmotoren.

Mulige neste utvidelser:

- flere biomer
- flere våpen og verktøy
- NPC-er og oppdrag
- baseangrep med tydeligere bølger
- crafting-stasjoner med egne menyer
- mer avansert pathfinding
- større sprite sheet med flere animasjoner
- mobilkontroller
