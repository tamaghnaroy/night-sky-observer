# Night Sky Observer — v1.x

A browser-based real-time night sky application for amateur astronomers and astrophotographers. No installation required — open `index.html` locally or serve over HTTP.

---

## Current Feature Set

### Sky Chart & Rendering
- **Canvas-based azimuthal equidistant projection** — full hemisphere view from horizon to zenith
- **Star catalog** — ~9,000 stars to magnitude 6.0, loaded dynamically from d3-celestial (CDN) with embedded fallback for offline use; magnitude-scaled rendering with radial glow halos
- **All 88 IAU constellation lines** — fetched from d3-celestial GeoJSON; labelled at centroid; falls back to embedded subset offline
- **Zodiac band overlay** — all 12 zodiac constellations with symbols and season labels (toggle)
- **7 planets + Moon** — Mercury through Neptune; positions computed via JPL Keplerian elements (Jean Meeus algorithms, ~1° accuracy); Moon with phase rendering showing illuminated limb
- **Comet overlay** — live fetch from NASA/JPL Small Body Database API; 8-comet hardcoded fallback
- **24 deep sky objects** — curated Messier/NGC subset (galaxies, nebulae, open/globular clusters); displayed in Plan & Shoot and Tonight panels; **not yet rendered on sky chart canvas**
- **Alt/Az coordinate grid** — toggleable 30°/30° grid overlay
- **Compass rose** — 8-point, N highlighted red
- **Altitude ring labels** — 30°, 60°, 90° marks
- **Night Mode** — full red-filter CSS overlay for dark adaptation

### Location & Time
- **GPS auto-detect** via browser Geolocation API
- **City search** via Nominatim/OpenStreetMap (fuzzy, returns top 6 results)
- **Manual coordinate entry** — lat/lon with validation
- **localStorage persistence** — location saved across sessions
- **Local time display** — shows observer local time with UTC offset derived from longitude
- **Time travel** — datetime-local picker to simulate any date/time; "Use Current Time" reset button

### Interaction
- **Hover tooltips** — name, altitude, azimuth, magnitude, moon phase % on mouseover
- **Click-to-log details** — appends full RA/Dec/Alt/Az/Mag data to side panel (last 15 clicked objects)
- **Object search modal** — full-text search across stars, planets, deep sky objects, constellations
- **Tonight panel** — visibility score (moon + hour heuristic), moon phase %, dark window (sunset→sunrise), ranked best targets, upcoming events

### Astrophotography Tools
- **Gear Profile** — camera type (phone / DSLR-mirrorless / tracker / telescope), focal length, sensor crop factor; persisted to localStorage
- **Plan & Shoot panel** — ranked target list, current alt/az, best-time heuristic, suggested ISO / max exposure (500-rule), FOV calculation from focal length + crop factor, moon proximity warning

---

## Architecture

```
├── index.html          # UI shell, all modals & slide panels
├── styles.css          # Dark theme, night-mode filter, responsive layout
├── app.js              # NightSkyApp class — rendering, calculations, panels (~1540 lines)
├── planets.js          # Self-contained Astronomy engine (Meeus + JPL Keplerian elements)
├── stardata.js         # Embedded fallback star catalog (HYG subset)
└── issues/             # Bug tracker & planning documents
```

### Data Sources
| Data | Source | Fallback |
|------|--------|----------|
| Stars (6 mag) | d3-celestial CDN GeoJSON | `stardata.js` embedded |
| Constellation lines | d3-celestial CDN GeoJSON | Hardcoded subset in `app.js` |
| Planet positions | JPL Keplerian elements (`planets.js`) | N/A |
| Moon position & phase | `planets.js` (Meeus Ch.47) | N/A |
| Comets | NASA/JPL SBDB REST API | 8 hardcoded fallback comets |
| City geocoding | Nominatim/OpenStreetMap | Manual coordinate entry |

### Coordinate Pipeline
1. **RA/Dec** (J2000 from catalog) → **Hour Angle** (via Local Sidereal Time)
2. **Hour Angle + Dec + Lat** → **Altitude/Azimuth** (standard spherical trig)
3. **Alt/Az** → **Canvas XY** (azimuthal equidistant: `r = radius × (1 - alt/90)`)

---

## Known Gaps & Bugs (v1.x)

- Deep sky objects (DSOs) not rendered on the sky chart canvas — only appear in panels
- Comet hover/click does not show tooltip or detail log
- Zodiac constellation lines not drawn — only symbol + name shown at RA/Dec centroid
- Sky chart not zoomable / pannable — fixed full-hemisphere view only
- Constellation lookup (`getConstellation`) uses a coarse hardcoded RA/Dec bounding box
- Visibility score is a rough heuristic (moon phase + local hour); no atmospheric/weather data
- Sun position not computed or displayed (no civil/nautical/astronomical twilight calculation)
- No Milky Way overlay
- No satellite tracking (ISS, etc.)
- No meteor shower calendar
- No export / screenshot of sky chart
- No dark sky map / Bortle scale integration
- No AI-assisted object identification or observing guidance

---

## Browser Requirements

- Modern browser with HTML5 Canvas API
- Geolocation API (optional — manual entry available as fallback)
- Internet connection for CDN star data, city search, comet API (offline fallback available)

---

## License

MIT License — open source, free to use and modify.
