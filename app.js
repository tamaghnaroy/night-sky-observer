// ── NightSkyApp ─────────────────────────────────────────────────────────────
// Stars & constellation lines loaded dynamically from d3-celestial (jsdelivr CDN).
// Falls back to embedded stardata.js when offline.
// Planet/moon positions computed locally via planets.js (JPL Keplerian elements).

// d3-celestial stores RA as negated longitude (-RA). Convert to 0-360 degrees:
const d3CelRA = lon => ((360 - lon) % 360 + 360) % 360;

// IAU 3-letter code → English constellation name
const IAU_NAMES = {
    And:'Andromeda', Ant:'Antlia',   Aps:'Apus',        Aqr:'Aquarius',
    Aql:'Aquila',   Ara:'Ara',       Ari:'Aries',       Aur:'Auriga',
    Boo:'Boötes',   Cae:'Caelum',    Cam:'Camelopardalis', Cnc:'Cancer',
    CVn:'Canes Venatici', CMa:'Canis Major', CMi:'Canis Minor',
    Cap:'Capricornus', Car:'Carina', Cas:'Cassiopeia',  Cen:'Centaurus',
    Cep:'Cepheus',  Cet:'Cetus',     Cha:'Chamaeleon',  Cir:'Circinus',
    Col:'Columba',  Com:'Coma Ber.', CrA:'Corona Aus.', CrB:'Corona Bor.',
    Crv:'Corvus',   Crt:'Crater',    Cru:'Crux',        Cyg:'Cygnus',
    Del:'Delphinus',Dor:'Dorado',    Dra:'Draco',       Equ:'Equuleus',
    Eri:'Eridanus', For:'Fornax',    Gem:'Gemini',      Gru:'Grus',
    Her:'Hercules', Hor:'Horologium',Hya:'Hydra',       Hyi:'Hydrus',
    Ind:'Indus',    Lac:'Lacerta',   Leo:'Leo',         LMi:'Leo Minor',
    Lep:'Lepus',    Lib:'Libra',     Lup:'Lupus',       Lyn:'Lynx',
    Lyr:'Lyra',     Men:'Mensa',     Mic:'Microscopium',Mon:'Monoceros',
    Mus:'Musca',    Nor:'Norma',     Oct:'Octans',      Oph:'Ophiuchus',
    Ori:'Orion',    Pav:'Pavo',      Peg:'Pegasus',     Per:'Perseus',
    Phe:'Phoenix',  Pic:'Pictor',    Psc:'Pisces',      PsA:'Piscis Aus.',
    Pup:'Puppis',   Pyx:'Pyxis',     Ret:'Reticulum',   Sge:'Sagitta',
    Sgr:'Sagittarius', Sco:'Scorpius', Scl:'Sculptor',  Sct:'Scutum',
    Ser:'Serpens',  Sex:'Sextans',   Tau:'Taurus',      Tel:'Telescopium',
    Tri:'Triangulum', TrA:'Tri. Aus.', Tuc:'Tucana',   UMa:'Ursa Major',
    UMi:'Ursa Minor', Vel:'Vela',    Vir:'Virgo',       Vol:'Volans',
    Vul:'Vulpecula'
};

// Hipparcos catalog (HIP) number → IAU common star name
const HIP_NAMES = {
    677:   'Alpheratz',  746:   'Caph',       1067:  'Algenib',
    2021:  'Ankaa',      3179:  'Mirfak',     5447:  'Eltanin',
    7588:  'Achernar',   8886:  'Schedar',    8903:  'Hamal',
    9884:  'Mirach',     9640:  'Almach',     11767: 'Polaris',
    14576: 'Algol',      15863: 'Menkar',     17678: 'Electra',
    21421: 'Aldebaran',  24436: 'Rigel',      24608: 'Capella',
    25336: 'Elnath',     25930: 'Mintaka',    26311: 'Alnilam',
    26727: 'Alnitak',    27366: 'Bellatrix',  27989: 'Betelgeuse',
    30438: 'Canopus',    32349: 'Sirius',     33579: 'Adhara',
    34444: 'Wezen',      36850: 'Castor',     37279: 'Procyon',
    37826: 'Pollux',     39429: 'Naos',       44816: 'Avior',
    45238: 'Miaplacidus',46390: 'Aspidiske', 49669: 'Regulus',
    53910: 'Merak',      54061: 'Dubhe',      57632: 'Denebola',
    59803: 'Porrima',    60718: 'Acrux',      61084: 'Gacrux',
    62434: 'Mimosa',     63608: 'Cor Caroli', 65474: 'Spica',
    67301: 'Alkaid',     68702: 'Hadar',      69673: 'Arcturus',
    71683: 'Rigil Kent.',72105: 'Kochab',     80112: 'Shaula',
    80763: 'Antares',    84012: 'Sabik',      86032: 'Rasalhague',
    87833: 'Kaus Aus.',  90185: 'Nunki',      91262: 'Vega',
    92855: 'Sulafat',    95947: 'Albireo',    97649: 'Altair',
    100751:'Peacock',    102098:'Deneb',      105199:'Alderamin',
    109268:'Alnair',     110130:'Peacock',    113368:'Fomalhaut',
    113881:'Scheat',     113963:'Markab'
};

const PLANET_DEFS = [
    { body: 'Mercury', name: 'Mercury', color: '#b0a090', size: 5 },
    { body: 'Venus',   name: 'Venus',   color: '#ffe88a', size: 7 },
    { body: 'Mars',    name: 'Mars',    color: '#e05030', size: 6 },
    { body: 'Jupiter', name: 'Jupiter', color: '#daa96a', size: 9 },
    { body: 'Saturn',  name: 'Saturn',  color: '#e8d89a', size: 8 },
    { body: 'Uranus',  name: 'Uranus',  color: '#80e8e0', size: 5 },
    { body: 'Neptune', name: 'Neptune', color: '#5080ff', size: 5 },
];

class NightSkyApp {
    constructor() {
        this.canvas  = document.getElementById('sky-chart');
        this.ctx     = this.canvas.getContext('2d');
        this.location    = { lat: null, lon: null };
        this.currentTime = new Date();
        this.showConstellations = true;
        this.showZodiac          = true;
        this.showComets          = true;
        this.showPlanets        = true;
        this.showGrid           = false;
        this.showDSOs           = true;
        this.showLabels         = true;
        this.showMeteors = false;
        this.showISS     = false;
        this.issData     = null;
        this.issTimer    = null;
        this.stars    = [];
        this.dsos     = [];
        this.planets  = [];
        this.comets  = [];
        this.moonData = null;
        this.tooltip  = null;
        this.dynamicConstellations = null;
        this.locationUTCOffset = 0;
        this.center   = { x: 0, y: 0 };
        this.radius   = 0;
        this.nightMode = false;
        this.simMode = false;
        this.selectedObject = null;
        this.zoomFactor = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.dragStart = null;
        this.hasDragged = false;
        this.gearProfile = {
            level: 'phone',
            focalLength: 50,
            cropFactor: 1,
            aperture: 50,
            pixelPitch: 5.97
        };
        this.observationLog = this.loadObsLog();
        this.dsos = this.buildDSOCatalog();
        this.zodiacConstellations = this.buildZodiacCatalog();
        this.lastDataFetch = null;
        this.init();
    }

    // ── Initialisation ────────────────────────────────────────────────────────
    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.initToggleButtonStates();
        this.setCurrentDateTime();
        this.tooltip = this.createTooltip();
        document.getElementById('loading').classList.add('active');
        document.querySelector('#loading p').textContent = 'Loading star catalog…';
        await this.loadDynamicData();
        this.getLocation();
        setInterval(() => {
            if (this.location.lat !== null && !this.simMode) {
                this.setCurrentDateTime();
                this.updateSkyChart();
            }
        }, 60000);
    }

    buildStarCatalog() {
        this.stars = STARS.map(([ra, dec, mag, name], i) => ({
            ra, dec, magnitude: mag, name: name || '', id: i,
            alt: 0, az: 0, visible: false, isPlanet: false
        }));
    }

    // ── Dynamic data from d3-celestial (local first, CDN fallback) ───────────────
    async loadDynamicData() {
        const LOCAL_BASE = './data/';
        const CDN_BASE = 'https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/';
        
        let starsJson, consJson;
        
        // Try local files first for offline support
        try {
            const [starsResp, consResp] = await Promise.all([
                fetch(LOCAL_BASE + 'stars.6.json'),
                fetch(LOCAL_BASE + 'constellations.lines.json')
            ]);
            if (!starsResp.ok || !consResp.ok) throw new Error('Local files not found');
            
            [starsJson, consJson] = await Promise.all([
                starsResp.json(), consResp.json()
            ]);
            console.log('★ Loaded star data from local files');
        } catch (e) {
            // Fall back to CDN
            console.log('Local files not found, trying CDN...');
            try {
                const [starsResp, consResp] = await Promise.all([
                    fetch(CDN_BASE + 'stars.6.json'),
                    fetch(CDN_BASE + 'constellations.lines.json')
                ]);
                if (!starsResp.ok || !consResp.ok) throw new Error('Non-200 response');

                [starsJson, consJson] = await Promise.all([
                    starsResp.json(), consResp.json()
                ]);
                console.log('★ Loaded star data from CDN');
            } catch (e2) {
                console.warn('Dynamic catalog load failed — using embedded fallback:', e2.message);
                this.buildStarCatalog();
                this.dynamicConstellations = null;
                return;
            }
        }

        // Process star data
        this.stars = starsJson.features.map((f, i) => {
            const [lon, lat] = f.geometry.coordinates;
            const p = f.properties;
            return {
                ra:        d3CelRA(lon),
                dec:       lat,
                magnitude: p.mag,
                name:      HIP_NAMES[f.id] || '',
                id: i, alt: 0, az: 0, visible: false, isPlanet: false
            };
        });

        // Process constellation data
        this.dynamicConstellations = consJson.features.map(f => ({
            name:     IAU_NAMES[f.id] || f.properties.n || f.id || '',
            color:    '#a0c8ff',
            segments: f.geometry.coordinates.map(line =>
                line.map(([lon, lat]) => [d3CelRA(lon), lat])
            )
        }));

        console.log(`★ Loaded ${this.stars.length} stars and ${this.dynamicConstellations.length} constellations`);
        
        // Fetch comets from NASA/JPL dynamically
        await this.fetchDynamicData();
        console.log(`☄ Loaded ${this.comets.length} comets`);
    }

    setupCanvas() {
        const resize = () => {
            const c = this.canvas.parentElement;
            this.canvas.width  = c.clientWidth;
            this.canvas.height = Math.min(Math.max(c.clientWidth * 0.65, 440), 680);
            this.center.x = this.canvas.width  / 2;
            this.center.y = this.canvas.height / 2;
            this.radius   = Math.min(this.canvas.width, this.canvas.height) * 0.43;
            if (this.location.lat !== null) this.updateSkyChart();
            else this.renderEmpty();
        };
        resize();
        window.addEventListener('resize', resize);
    }

    setupEventListeners() {
        document.getElementById('current-time').addEventListener('click', () => {
            this.setCurrentDateTime();
            this.updateSkyChart();
        });
        document.getElementById('datetime').addEventListener('change', () => {
            this.simMode = true;
            this.currentTime = new Date(document.getElementById('datetime').value);
            this.updateSkyChart();
        });
        document.getElementById('toggle-constellations').addEventListener('click', (e) => {
            this.showConstellations = !this.showConstellations;
            e.target.classList.toggle('active', this.showConstellations);
            this.render();
        });
        document.getElementById('toggle-zodiac').addEventListener('click', (e) => {
            this.showZodiac = !this.showZodiac;
            e.target.classList.toggle('active', this.showZodiac);
            this.render();
        });
        document.getElementById('toggle-comets').addEventListener('click', (e) => {
            this.showComets = !this.showComets;
            e.target.classList.toggle('active', this.showComets);
            this.render();
        });
        document.getElementById('toggle-planets').addEventListener('click', (e) => {
            this.showPlanets = !this.showPlanets;
            e.target.classList.toggle('active', this.showPlanets);
            this.render();
        });
        document.getElementById('toggle-grid').addEventListener('click', (e) => {
            this.showGrid = !this.showGrid;
            e.target.classList.toggle('active', this.showGrid);
            this.render();
        });
        document.getElementById('toggle-dsos').addEventListener('click', (e) => {
            this.showDSOs = !this.showDSOs;
            e.target.classList.toggle('active', this.showDSOs);
            this.render();
        });
        document.getElementById('toggle-meteors').addEventListener('click', (e) => {
            this.showMeteors = !this.showMeteors;
            e.target.classList.toggle('active', this.showMeteors);
            this.render();
        });
        document.getElementById('toggle-iss').addEventListener('click', (e) => {
            this.showISS = !this.showISS;
            e.target.classList.toggle('active', this.showISS);
            if (this.showISS) this.startISSTracking();
            else              this.stopISSTracking();
        });
        // Location modal
        document.getElementById('edit-location').addEventListener('click', () => this.openLocationModal(false));
        document.getElementById('modal-cancel').addEventListener('click', () => this.closeLocationModal());
        document.getElementById('modal-apply').addEventListener('click', () => {
            const latInput = document.getElementById('manual-lat').value.trim();
            const lonInput = document.getElementById('manual-lon').value.trim();
            const errEl = document.getElementById('modal-error');
            
            if (!latInput || !lonInput) {
                errEl.textContent = 'Please enter both latitude and longitude.';
                return;
            }
            
            const lat = parseFloat(latInput);
            const lon = parseFloat(lonInput);
            
            if (isNaN(lat) || isNaN(lon)) {
                errEl.textContent = 'Please enter valid numeric coordinates.';
                return;
            }
            if (lat < -90 || lat > 90) {
                errEl.textContent = 'Latitude must be between -90 and 90.';
                return;
            }
            if (lon < -180 || lon > 180) {
                errEl.textContent = 'Longitude must be between -180 and 180.';
                return;
            }
            
            errEl.textContent = '';
            this.applyLocation(lat, lon, `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
            this.closeLocationModal();
        });
        document.getElementById('modal-use-gps').addEventListener('click', () => {
            const errEl = document.getElementById('modal-error');
            errEl.textContent = 'Requesting GPS…';
            navigator.geolocation.getCurrentPosition(
                pos => {
                    this.applyLocation(
                        pos.coords.latitude, pos.coords.longitude,
                        `${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`
                    );
                    this.closeLocationModal();
                },
                () => { errEl.textContent = 'GPS denied. Please enter coordinates manually.'; },
                { timeout: 10000 }
            );
        });
        document.getElementById('city-search-btn').addEventListener('click', () => {
            const q = document.getElementById('city-search').value.trim();
            if (q) this.searchCity(q);
        });
        document.getElementById('city-search').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const q = document.getElementById('city-search').value.trim();
                if (q) this.searchCity(q);
            }
        });
        // Close on backdrop click
        document.getElementById('location-modal').addEventListener('click', e => {
            if (e.target === document.getElementById('location-modal') && this.location.lat !== null)
                this.closeLocationModal();
        });

        // Night mode toggle
        document.getElementById('toggle-night-mode').addEventListener('click', () => this.toggleNightMode());

        // Reset view button
        document.getElementById('btn-reset-view').addEventListener('click', () => {
            this.zoomFactor = 1;
            this.panX = 0;
            this.panY = 0;
            this.render();
        });

        // Quick action buttons
        document.getElementById('btn-tonight').addEventListener('click', () => this.openTonightPanel());
        document.getElementById('btn-search').addEventListener('click', () => this.openSearchModal());
        document.getElementById('btn-plan').addEventListener('click', () => this.openPlanPanel());
        document.getElementById('btn-gear').addEventListener('click', () => this.openGearModal());
        document.getElementById('btn-log').addEventListener('click', () => this.openLogPanel());
        document.getElementById('close-log').addEventListener('click', () => this.closeLogPanel());
        document.getElementById('clear-log').addEventListener('click', () => this.clearObsLog());
        document.getElementById('btn-export').addEventListener('click', () => this.exportChart());

        // Panel close buttons
        document.getElementById('close-tonight').addEventListener('click', () => this.closeTonightPanel());
        document.getElementById('close-plan').addEventListener('click', () => this.closePlanPanel());

        // Search modal
        document.getElementById('search-cancel').addEventListener('click', () => this.closeSearchModal());
        document.getElementById('object-search').addEventListener('input', e => {
            const results = this.searchObjects(e.target.value);
            this.displaySearchResults(results);
        });

        // Gear modal
        document.getElementById('gear-save').addEventListener('click', () => this.saveGearProfile());
        document.getElementById('gear-cancel').addEventListener('click', () => this.closeGearModal());

        // ── Zoom & Pan ────────────────────────────────────────────────────────
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85;
            this.zoomFactor = Math.max(1, Math.min(8, this.zoomFactor * delta));
            if (this.zoomFactor === 1) { this.panX = 0; this.panY = 0; }
            this.render();
        }, { passive: false });

        this.canvas.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.hasDragged = false;
            this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        });
        this.canvas.addEventListener('mousemove', e => {
            if (this.isDragging && this.zoomFactor > 1) {
                this.hasDragged = true;
                this.panX = e.clientX - this.dragStart.x;
                this.panY = e.clientY - this.dragStart.y;
                this.render();
            } else {
                this.handleHover(e);
            }
        });
        this.canvas.addEventListener('mouseup', e => {
            this.isDragging = false;
            if (!this.hasDragged) this.handleClick(e);
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.tooltip.style.display = 'none';
        });

        // Touch: pinch-zoom + drag
        let lastTouchDist = null;
        this.canvas.addEventListener('touchstart', e => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.hasDragged = false;
                this.dragStart = { x: e.touches[0].clientX - this.panX, y: e.touches[0].clientY - this.panY };
            }
            if (e.touches.length === 2) {
                lastTouchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: true });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            if (e.touches.length === 2 && lastTouchDist) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                this.zoomFactor = Math.max(1, Math.min(8, this.zoomFactor * (dist / lastTouchDist)));
                lastTouchDist = dist;
                if (this.zoomFactor === 1) { this.panX = 0; this.panY = 0; }
                this.render();
            } else if (e.touches.length === 1 && this.isDragging && this.zoomFactor > 1) {
                this.hasDragged = true;
                this.panX = e.touches[0].clientX - this.dragStart.x;
                this.panY = e.touches[0].clientY - this.dragStart.y;
                this.render();
            }
        }, { passive: false });
        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
            lastTouchDist = null;
        });

        // Double-click / double-tap resets zoom
        this.canvas.addEventListener('dblclick', () => {
            this.zoomFactor = 1;
            this.panX = 0;
            this.panY = 0;
            this.render();
        });
    }

    setCurrentDateTime() {
        this.simMode = false;
        this.currentTime = new Date();
        const d = this.currentTime;
        const pad = n => String(n).padStart(2, '0');
        document.getElementById('datetime').value =
            `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    getLocation() {
        // 1. Try saved location first (instant)
        const saved = this.loadSavedLocation();
        if (saved) {
            this.applyLocation(saved.lat, saved.lon, saved.label, false, saved.utcOffset);
            return;
        }
        // 2. Try browser GPS, with default fallback
        document.getElementById('loading').classList.add('active');
        if (!navigator.geolocation) {
            this.useDefaultLocation();
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const gpsUTCOffset = -(new Date().getTimezoneOffset() / 60);
                this.applyLocation(
                    pos.coords.latitude, pos.coords.longitude,
                    `${pos.coords.latitude.toFixed(4)}°, ${pos.coords.longitude.toFixed(4)}°`,
                    true, gpsUTCOffset
                );
            },
            () => {
                this.useDefaultLocation();
            },
            { timeout: 8000 }
        );
    }

    initToggleButtonStates() {
        // Set initial active states for toggle buttons (fixes §2.1)
        document.getElementById('toggle-constellations').classList.toggle('active', this.showConstellations);
        document.getElementById('toggle-zodiac').classList.toggle('active', this.showZodiac);
        document.getElementById('toggle-planets').classList.toggle('active', this.showPlanets);
        document.getElementById('toggle-comets').classList.toggle('active', this.showComets);
        document.getElementById('toggle-grid').classList.toggle('active', this.showGrid);
        document.getElementById('toggle-dsos').classList.toggle('active', this.showDSOs);
        if (document.getElementById('toggle-meteors')) {
            document.getElementById('toggle-meteors').classList.toggle('active', this.showMeteors);
        }
        if (document.getElementById('toggle-iss')) {
            document.getElementById('toggle-iss').classList.toggle('active', this.showISS);
        }
    }

    useDefaultLocation() {
        // Use a sensible default (Christchurch, NZ) when GPS fails
        document.getElementById('loading').classList.remove('active');
        const defaultLoc = { lat: -43.5321, lon: 172.6362, label: 'Christchurch, NZ (default)', utcOffset: 13 };
        this.applyLocation(defaultLoc.lat, defaultLoc.lon, defaultLoc.label, true, defaultLoc.utcOffset);
        // Show location modal so user can adjust if needed, but non-blocking
        setTimeout(() => this.openLocationModal(false), 500);
    }

    applyLocation(lat, lon, label, save = true, utcOffset = undefined) {
        this.location.lat = lat;
        this.location.lon = lon;
        this.locationUTCOffset = (utcOffset !== undefined) ? utcOffset : Math.round(lon / 15 * 2) / 2;
        document.getElementById('location').textContent = label;
        document.getElementById('loading').classList.remove('active');
        if (save) this.saveLocation(lat, lon, label, this.locationUTCOffset);
        this.updateSkyChart();
        // Pre-compute tonight's data so panel is ready (fixes §2.5)
        this.updateTonightPanelData();
    }

    updateTonightPanelData() {
        // Cache tonight's sky data so panel is ready when opened
        if (this.location.lat === null) return;
        this.tonightDataCache = {
            moonPhase: this.moonData ? this.moonData.phase : 0,
            moonPct: this.moonData ? Math.round(this.moonData.fraction * 100) : 0,
            darkWindow: this.computeDarkWindow(),
            targets: this.getBestTargetsTonight()
        };
    }

    computeDarkWindow() {
        const astro = this.getSunTimeAtAlt(-18);
        const sunset = this.getSunsetTime();
        const sunrise = this.getSunriseTime();
        const darkFrom = astro.eve || (sunset ? new Date(sunset.getTime() + 3600000) : null);
        const darkTo = astro.morn || (sunrise ? new Date(sunrise.getTime() - 3600000) : null);
        return { darkFrom, darkTo, astro };
    }

    // ── localStorage persistence ──────────────────────────────────────────────
    saveLocation(lat, lon, label, utcOffset) {
        try {
            localStorage.setItem('nso_location', JSON.stringify({ lat, lon, label, utcOffset }));
        } catch (_) {}
    }

    loadSavedLocation() {
        try {
            const raw = localStorage.getItem('nso_location');
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (typeof obj.lat === 'number' && typeof obj.lon === 'number') return obj;
        } catch (_) {}
        return null;
    }

    // ── Location modal ────────────────────────────────────────────────────────
    openLocationModal(required = false) {
        const modal = document.getElementById('location-modal');
        modal.style.display = 'flex';
        document.getElementById('modal-error').textContent = required
            ? 'GPS unavailable or denied — please set your location below.'
            : '';
        document.getElementById('city-results').innerHTML = '';
        // Pre-fill coords if already set
        if (this.location.lat !== null) {
            document.getElementById('manual-lat').value = this.location.lat.toFixed(4);
            document.getElementById('manual-lon').value = this.location.lon.toFixed(4);
        }
        // Cancel only available when a location is already set
        document.getElementById('modal-cancel').style.display = required && this.location.lat === null ? 'none' : '';
    }

    closeLocationModal() {
        document.getElementById('location-modal').style.display = 'none';
    }

    async searchCity(query) {
        const errEl  = document.getElementById('modal-error');
        const resEl  = document.getElementById('city-results');
        errEl.textContent  = 'Searching…';
        resEl.innerHTML    = '';
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
            const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const data = await resp.json();
            errEl.textContent = '';
            if (!data.length) { errEl.textContent = 'No results found.'; return; }
            resEl.innerHTML = data.map((r, i) =>
                `<div class="city-result-item" data-idx="${i}"
                      data-lat="${r.lat}" data-lon="${r.lon}">
                    ${r.display_name.split(',').slice(0, 3).join(', ')}
                    <small>${parseFloat(r.lat).toFixed(4)}°, ${parseFloat(r.lon).toFixed(4)}°</small>
                </div>`
            ).join('');
            resEl.querySelectorAll('.city-result-item').forEach(el => {
                el.addEventListener('click', () => {
                    const lat   = parseFloat(el.dataset.lat);
                    const lon   = parseFloat(el.dataset.lon);
                    const label = el.childNodes[0].textContent.trim();
                    this.applyLocation(lat, lon, label);
                    this.closeLocationModal();
                });
            });
        } catch (e) {
            errEl.textContent = 'Search failed — check your internet connection.';
        }
    }

    // ── Astronomical calculations ─────────────────────────────────────────────
    julianDate(date) {
        return date.getTime() / 86400000.0 + 2440587.5;
    }

    localSiderealTime() {
        const jd  = this.julianDate(this.currentTime);
        const T   = (jd - 2451545.0) / 36525.0;
        let gst   = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
                    + 0.000387933 * T * T - (T * T * T) / 38710000.0;
        const lst = ((gst + this.location.lon) % 360 + 360) % 360;
        return lst;
    }

    localSiderealTimeAt(date) {
        const jd = this.julianDate(date);
        const T  = (jd - 2451545.0) / 36525.0;
        let gst  = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
                   + 0.000387933 * T * T - (T * T * T) / 38710000.0;
        return ((gst + this.location.lon) % 360 + 360) % 360;
    }

    angularSeparation(ra1, dec1, ra2, dec2) {
        const r1 = ra1  * Math.PI / 180, d1 = dec1 * Math.PI / 180;
        const r2 = ra2  * Math.PI / 180, d2 = dec2 * Math.PI / 180;
        const cos = Math.sin(d1) * Math.sin(d2) +
                    Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2);
        return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    }

    raDecToAltAz(raDeg, decDeg) {
        const lst    = this.localSiderealTime();
        const ha     = (lst - raDeg + 360) % 360;
        const haR    = ha  * Math.PI / 180;
        const decR   = decDeg * Math.PI / 180;
        const latR   = this.location.lat * Math.PI / 180;
        const sinAlt = Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(haR);
        const altR   = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
        const cosAz  = (Math.sin(decR) - Math.sin(latR) * Math.sin(altR)) / (Math.cos(latR) * Math.cos(altR));
        let az       = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
        if (Math.sin(haR) > 0) az = 360 - az;
        return { alt: altR * 180 / Math.PI, az };
    }

    // ── Get planet & moon positions via astronomy-engine ─────────────────────
    computePlanetPositions() {
        if (typeof Astronomy === 'undefined') {
            console.warn('astronomy-engine not loaded – planet positions unavailable');
            this.planets = [];
            return;
        }
        const observer = new Astronomy.Observer(this.location.lat, this.location.lon, 0);
        const date     = this.currentTime;

        this.planets = PLANET_DEFS.map(def => {
            try {
                const equ = Astronomy.Equator(def.body, date, observer, true, true);
                const hor = Astronomy.Horizon(date, observer, equ.ra, equ.dec, 'normal');
                const illum = Astronomy.Illumination(def.body, date);
                let elongation = null;
                try { elongation = Astronomy.AngleFromSun(def.body, date); } catch(_) {}
                return {
                    name:         def.name,
                    color:        def.color,
                    size:         def.size,
                    ra:           equ.ra * 15,
                    dec:          equ.dec,
                    alt:          hor.altitude,
                    az:           hor.azimuth,
                    magnitude:    illum.mag,
                    phase_frac:   illum.phase_fraction,
                    phase_angle:  illum.phase_angle,
                    helio_dist:   illum.helio_dist,
                    geo_dist:     illum.geo_dist,
                    elongation:   elongation,
                    visible:      hor.altitude > -0.5,
                    isPlanet:     true
                };
            } catch (err) {
                console.warn(`Planet ${def.name} error:`, err);
                return null;
            }
        }).filter(Boolean);

        // Moon
        try {
            const moonEqu  = Astronomy.Equator('Moon', date, observer, true, true);
            const moonHor  = Astronomy.Horizon(date, observer, moonEqu.ra, moonEqu.dec, 'normal');
            const moonPhase = Astronomy.MoonPhase(date);  // 0-360
            const moonIllum = Astronomy.Illumination('Moon', date);
            this.moonData = {
                name:      'Moon',
                ra:        moonEqu.ra * 15,
                dec:       moonEqu.dec,
                alt:       moonHor.altitude,
                az:        moonHor.azimuth,
                phase:     moonPhase,
                fraction:  moonIllum.phase_fraction,
                visible:   moonHor.altitude > -0.5,
                isPlanet:  false, isMoon: true,
                color:     '#e8e8d0', size: 11, magnitude: -12.6
            };
        } catch(e) { this.moonData = null; }
    }

    // ── Planet detail helpers ─────────────────────────────────────────────────
    static get PLANET_RADII_KM() {
        return { Mercury:2439.7, Venus:6051.8, Mars:3396.2, Jupiter:71492,
                 Saturn:60268, Uranus:25559, Neptune:24764 };
    }

    planetAngularSizeArcsec(name, distAU) {
        const r = NightSkyApp.PLANET_RADII_KM[name];
        if (!r || !distAU) return null;
        return 2 * Math.atan(r / (distAU * 1.496e8)) * 180 / Math.PI * 3600;
    }

    getPlanetRiseSet(name) {
        if (typeof Astronomy === 'undefined') return null;
        try {
            const body     = name === 'Moon' ? 'Moon' : name;
            const observer = new Astronomy.Observer(this.location.lat, this.location.lon, 0);
            const noon     = new Date(this.currentTime);
            noon.setHours(0, 0, 0, 0);
            const rise = Astronomy.SearchRiseSet(body, observer,  1, noon, 1);
            const set  = Astronomy.SearchRiseSet(body, observer, -1, noon, 1);
            return {
                rise: rise ? new Date(rise.date) : null,
                set:  set  ? new Date(set.date)  : null
            };
        } catch(_) { return null; }
    }

    // ── Local time display for selected location ─────────────────────────────
    updateLocationTimeDisplay() {
        const el = document.getElementById('location-time');
        if (!el || this.location.lat === null) return;
        const locMs   = this.currentTime.getTime() + this.locationUTCOffset * 3600000;
        const locDate = new Date(locMs);
        const pad     = n => String(n).padStart(2, '0');
        const h = locDate.getUTCHours();
        const m = locDate.getUTCMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12  = h % 12 || 12;
        const sign  = this.locationUTCOffset >= 0 ? '+' : '';
        el.textContent = `📍 Local: ${h12}:${pad(m)} ${ampm} (UTC${sign}${this.locationUTCOffset})`;
    }

    // ── Main update ───────────────────────────────────────────────────────────
    updateSkyChart() {
        if (this.location.lat === null) return;

        // Update star positions
        this.stars.forEach(s => {
            const { alt, az } = this.raDecToAltAz(s.ra, s.dec);
            s.alt     = alt;
            s.az      = az;
            s.visible = alt > -0.3;
        });

        // Update DSO positions
        this.dsos.forEach(d => {
            const { alt, az } = this.raDecToAltAz(d.ra, d.dec);
            d.alt     = alt;
            d.az      = az;
            d.visible = alt > 0;
        });

        this.computePlanetPositions();
        this.render();
        this.updateInfoPanel();
        this.updateLocationTimeDisplay();
    }

    // ── Rendering ─────────────────────────────────────────────────────────────
    renderEmpty() {
        const ctx = this.ctx;
        ctx.fillStyle = '#060b1e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = 'rgba(100,140,255,0.3)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Waiting for location…', this.center.x, this.center.y);
        ctx.textAlign = 'start';
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = '#060b1e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply zoom/pan transform for sky content
        ctx.save();
        if (this.zoomFactor !== 1 || this.panX !== 0 || this.panY !== 0) {
            ctx.translate(this.center.x + this.panX, this.center.y + this.panY);
            ctx.scale(this.zoomFactor, this.zoomFactor);
            ctx.translate(-this.center.x, -this.center.y);
        }
        this.drawSkyDome();
        this.drawSunGlow();
        if (this.showGrid)           this.drawAltAzGrid();
        this.drawStars();
        if (this.showConstellations) this.drawConstellations();
        if (this.showZodiac)         this.drawZodiac();
        if (this.showDSOs)           this.drawDSOs();
        if (this.showComets)         this.drawComets();
        if (this.showMeteors)        this.drawMeteorShowers();
        if (this.showISS)            this.drawISS();
        if (this.showPlanets)        this.drawPlanetsAndMoon();
        this.drawSelectedHighlight();
        this.drawHorizonRing();
        ctx.restore();
        // Compass and altitude labels stay in screen space (not affected by zoom/pan)
        this.drawCompassLabels();
        this.drawAltitudeLabels();
        this.drawOffScreenPointer();
    }

    drawSkyDome() {
        const { ctx, center, radius } = this;
        const grad = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        grad.addColorStop(0,   '#1a2050');
        grad.addColorStop(0.6, '#0d1230');
        grad.addColorStop(1,   '#060b1e');
        ctx.save();
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }

    drawAltAzGrid() {
        const { ctx, center, radius } = this;
        ctx.save();
        ctx.strokeStyle = 'rgba(80,120,200,0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);

        for (let alt = 0; alt < 90; alt += 30) {
            const r = radius * (1 - alt / 90);
            ctx.beginPath();
            ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        for (let az = 0; az < 360; az += 30) {
            const angle = (az - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawAltitudeLabels() {
        const { ctx, center, radius } = this;
        ctx.save();
        ctx.fillStyle = 'rgba(130,160,220,0.5)';
        ctx.font      = '10px Arial';
        ctx.textAlign = 'center';
        [30, 60].forEach(alt => {
            const r = radius * (1 - alt / 90);
            ctx.fillText(`${alt}°`, center.x + r + 4, center.y - 3);
        });
        ctx.fillText('90°', center.x + 3, center.y - 3);
        ctx.restore();
    }

    starColor(mag) {
        if (mag < 0)  return '#ffe8c0';
        if (mag < 1)  return '#fff4e8';
        if (mag < 2)  return '#fffef8';
        if (mag < 3.5)return '#eeeeff';
        return '#c8d0ff';
    }

    drawStars() {
        const { ctx } = this;
        this.stars.forEach(star => {
            if (!star.visible) return;
            const pos = this.altAzToXY(star.alt, star.az);
            if (!pos) return;

            const r = Math.max(0.6, 4.0 - star.magnitude * 0.65);
            const alpha = Math.max(0.25, Math.min(1, 1.15 - star.magnitude * 0.15));

            if (r > 1.5) {
                const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 2.5);
                glow.addColorStop(0,   `rgba(255,255,230,${alpha})`);
                glow.addColorStop(0.4, `rgba(255,255,200,${alpha * 0.4})`);
                glow.addColorStop(1,   'rgba(255,255,200,0)');
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fillStyle = this.starColor(star.magnitude);
            ctx.globalAlpha = alpha;
            ctx.fill();
            ctx.globalAlpha = 1;

            if (this.showLabels && star.name && star.magnitude < 2.5) {
                ctx.save();
                ctx.font = `${star.magnitude < 1.5 ? 11 : 10}px Arial`;
                ctx.shadowColor = 'rgba(0,0,20,0.9)';
                ctx.shadowBlur = 3;
                ctx.fillStyle = 'rgba(180,210,255,0.85)';
                ctx.fillText(star.name, pos.x + r + 3, pos.y - r);
                ctx.restore();
            }
        });
    }

    drawConstellations() {
        const { ctx } = this;
        const conData = this.dynamicConstellations || CONSTELLATIONS;
        conData.forEach(con => {
            const color = con.color || 'rgba(100,160,255,0.55)';
            ctx.strokeStyle = color;
            ctx.lineWidth   = 1;
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur  = 3;

            con.segments.forEach(seg => {
                if (seg.length < 2) return;
                const pts = seg.map(([ra, dec]) => {
                    const { alt, az } = this.raDecToAltAz(ra, dec);
                    return alt > 0 ? this.altAzToXY(alt, az) : null;
                });

                for (let i = 0; i < pts.length - 1; i++) {
                    const p1 = pts[i], p2 = pts[i + 1];
                    if (!p1 || !p2) continue;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });

            // Constellation name label at centroid of visible points
            const allPts = con.segments.flat()
                .map(([ra, dec]) => {
                    const { alt, az } = this.raDecToAltAz(ra, dec);
                    return alt > 5 ? this.altAzToXY(alt, az) : null;
                })
                .filter(Boolean);

            if (allPts.length > 0) {
                const cx = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
                const cy = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
                ctx.restore();
                ctx.fillStyle = 'rgba(140,180,255,0.5)';
                ctx.font      = 'italic 10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(con.name, cx, cy);
                ctx.textAlign = 'start';
            } else {
                ctx.restore();
            }
        });
    }

    drawZodiac() {
        const { ctx } = this;
        const epsR = 23.439 * Math.PI / 180; // obliquity of ecliptic

        ctx.save();

        // ── 1. Ecliptic path: sample every 2° of ecliptic longitude ─────────
        ctx.strokeStyle = 'rgba(255,200,70,0.5)';
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        let penDown = false;
        for (let lam = 0; lam <= 362; lam += 2) {
            const lamR  = (lam % 360) * Math.PI / 180;
            let raDeg   = Math.atan2(Math.cos(epsR) * Math.sin(lamR), Math.cos(lamR)) * 180 / Math.PI;
            if (raDeg < 0) raDeg += 360;
            const decDeg = Math.asin(Math.sin(epsR) * Math.sin(lamR)) * 180 / Math.PI;
            const { alt, az } = this.raDecToAltAz(raDeg, decDeg);
            if (alt > 0.5) {
                const pos = this.altAzToXY(alt, az);
                if (pos) {
                    if (!penDown) { ctx.moveTo(pos.x, pos.y); penDown = true; }
                    else           ctx.lineTo(pos.x, pos.y);
                    continue;
                }
            }
            penDown = false; // below horizon — lift pen
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // ── 2. Zodiac constellation labels at correct RA positions ───────────
        this.zodiacConstellations.forEach(z => {
            const { alt, az } = this.raDecToAltAz(z.ra * 15, z.dec);
            if (alt < 6) return;
            const pos = this.altAzToXY(alt, az);
            if (!pos) return;
            ctx.fillStyle   = 'rgba(255,215,110,0.88)';
            ctx.font        = this.zoomFactor > 1.5 ? 'bold 12px Arial' : '10px Arial';
            ctx.textAlign   = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur  = 3;
            ctx.fillText(`${z.symbol} ${z.name}`, pos.x, pos.y);
            ctx.shadowBlur  = 0;
        });

        ctx.restore();
    }

    drawComets() {
        const { ctx } = this;
        
        this.comets.forEach(comet => {
            const { alt, az } = this.raDecToAltAz(comet.ra, comet.dec);
            if (alt > 5) {
                const pos = this.altAzToXY(alt, az);
                if (pos) {
                    ctx.save();
                    ctx.shadowColor = '#90ee90';
                    ctx.shadowBlur = 10;
                    
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#90ee90';
                    ctx.fill();
                    
                    if (this.showLabels) {
                        ctx.fillStyle = 'rgba(150,230,150,0.9)';
                        ctx.font = '10px Arial';
                        ctx.textAlign = 'left';
                        const shortName = comet.name.length > 15 ? comet.name.substring(0, 12) + '...' : comet.name;
                        ctx.fillText(shortName, pos.x + 8, pos.y + 3);
                    }
                    
                    ctx.restore();
                }
            }
        });
    }

    // ── Meteor Showers ────────────────────────────────────────────────────────
    static get METEOR_SHOWERS() {
        return [
            { name: 'Quadrantids',     month: 1,  day: 3,  ra: 15.3,  dec: 49.7,  zhr: 120, parent: '2003 EH1'              },
            { name: 'Lyrids',          month: 4,  day: 22, ra: 18.08, dec: 33.3,  zhr: 18,  parent: 'C/1861 G1 Thatcher'    },
            { name: 'Eta Aquariids',   month: 5,  day: 6,  ra: 22.5,  dec: -1.0,  zhr: 50,  parent: '1P/Halley'             },
            { name: 'Delta Aquariids', month: 7,  day: 30, ra: 22.67, dec: -16.4, zhr: 25,  parent: '96P/Machholz'          },
            { name: 'Perseids',        month: 8,  day: 12, ra: 3.18,  dec: 58.1,  zhr: 100, parent: '109P/Swift-Tuttle'     },
            { name: 'Draconids',       month: 10, day: 8,  ra: 17.53, dec: 54.0,  zhr: 10,  parent: '21P/Giacobini-Zinner'  },
            { name: 'Orionids',        month: 10, day: 21, ra: 6.35,  dec: 15.6,  zhr: 25,  parent: '1P/Halley'             },
            { name: 'Taurids (S)',     month: 11, day: 5,  ra: 3.47,  dec: 13.6,  zhr: 5,   parent: '2P/Encke'              },
            { name: 'Leonids',         month: 11, day: 17, ra: 10.13, dec: 22.0,  zhr: 15,  parent: '55P/Tempel-Tuttle'     },
            { name: 'Geminids',        month: 12, day: 14, ra: 7.53,  dec: 32.5,  zhr: 150, parent: '3200 Phaethon'         },
            { name: 'Ursids',          month: 12, day: 22, ra: 14.53, dec: 75.3,  zhr: 10,  parent: '8P/Tuttle'             },
        ];
    }

    // Returns showers within ±7 days of peak for the current date
    activeShowers(windowDays = 7) {
        const d   = this.currentTime;
        const doy = n => {
            const y = d.getFullYear();
            return Math.round((new Date(y, n.month - 1, n.day) - new Date(y, 0, 0)) / 86400000);
        };
        const curDoy = Math.round((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        return NightSkyApp.METEOR_SHOWERS.filter(s => {
            const diff = Math.abs(curDoy - doy(s));
            return diff <= windowDays || diff >= (365 - windowDays);
        });
    }

    drawMeteorShowers() {
        if (this.location.lat === null) return;
        const { ctx } = this;
        const active = this.activeShowers(10);
        active.forEach(s => {
            const { alt, az } = this.raDecToAltAz(s.ra * 15, s.dec);
            if (alt < 5) return;
            const pos = this.altAzToXY(alt, az);
            if (!pos) return;
            ctx.save();
            // Radiant starburst
            const r = 10, spokes = 8;
            ctx.strokeStyle = 'rgba(255,220,100,0.9)';
            ctx.lineWidth   = 1.5;
            ctx.shadowColor = 'rgba(255,200,50,0.7)';
            ctx.shadowBlur  = 6;
            for (let i = 0; i < spokes; i++) {
                const a = (i / spokes) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(pos.x + Math.cos(a) * 3, pos.y + Math.sin(a) * 3);
                ctx.lineTo(pos.x + Math.cos(a) * r, pos.y + Math.sin(a) * r);
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,230,120,0.95)';
            ctx.fill();
            ctx.shadowBlur = 0;
            // Label
            ctx.fillStyle = 'rgba(255,220,100,0.9)';
            ctx.font      = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
            ctx.fillText(`${s.name} ZHR:${s.zhr}`, pos.x, pos.y - 14);
            ctx.shadowBlur = 0;
            ctx.restore();
        });
    }

    drawDSOs() {
        const { ctx } = this;
        const pixScale = this.radius / 5400;

        this.dsos.forEach(dso => {
            if (!dso.visible) return;
            const pos = this.altAzToXY(dso.alt, dso.az);
            if (!pos) return;

            const r = Math.max(5, Math.min(18, dso.size * pixScale * 2));

            ctx.save();
            switch (dso.type) {
                case 'Gx':  this.drawGalaxySymbol(ctx, pos.x, pos.y, r);  break;
                case 'OC':  this.drawOpenClusterSymbol(ctx, pos.x, pos.y, r); break;
                case 'GC':  this.drawGlobularSymbol(ctx, pos.x, pos.y, r); break;
                case 'Nb':  this.drawNebulaSymbol(ctx, pos.x, pos.y, r);  break;
                case 'PN':  this.drawPNSymbol(ctx, pos.x, pos.y, Math.max(4, r * 0.6)); break;
                case 'SNR': this.drawSNRSymbol(ctx, pos.x, pos.y, r);     break;
                default:    this.drawNebulaSymbol(ctx, pos.x, pos.y, r);
            }

            if (dso.mag < 6 || (this.zoomFactor > 2 && dso.mag < 9)) {
                ctx.fillStyle = this.dsoLabelColor(dso.type);
                ctx.font = dso.mag < 5 ? 'bold 10px Arial' : '9px Arial';
                ctx.textAlign = 'left';
                ctx.shadowColor = 'rgba(0,0,20,0.9)';
                ctx.shadowBlur = 3;
                ctx.fillText(dso.name, pos.x + r + 3, pos.y + 3);
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        });
    }

    drawGalaxySymbol(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(140,200,255,0.85)';
        ctx.lineWidth = 1;
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 6);
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    drawOpenClusterSymbol(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,240,120,0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,240,120,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawGlobularSymbol(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,80,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
        ctx.stroke();
        ctx.restore();
    }

    drawNebulaSymbol(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(100,230,200,0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x,       y - r);
        ctx.lineTo(x + r * 0.7, y);
        ctx.lineTo(x,       y + r);
        ctx.lineTo(x - r * 0.7, y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawPNSymbol(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(80,220,220,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        const t = r + 3;
        ctx.beginPath();
        ctx.moveTo(x - t, y);     ctx.lineTo(x - t - 3, y);
        ctx.moveTo(x + t, y);     ctx.lineTo(x + t + 3, y);
        ctx.moveTo(x, y - t);     ctx.lineTo(x, y - t - 3);
        ctx.moveTo(x, y + t);     ctx.lineTo(x, y + t + 3);
        ctx.stroke();
        ctx.restore();
    }

    drawSNRSymbol(ctx, x, y, r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(240,120,200,0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    dsoLabelColor(type) {
        const c = { Gx:'rgba(140,200,255,0.9)', OC:'rgba(255,240,120,0.9)',
                    GC:'rgba(255,210,80,0.9)', Nb:'rgba(100,230,200,0.9)',
                    PN:'rgba(80,220,220,0.9)', SNR:'rgba(240,120,200,0.9)' };
        return c[type] || 'rgba(180,210,255,0.85)';
    }

    drawPlanetsAndMoon() {
        const allBodies = [...this.planets];
        if (this.moonData) allBodies.push(this.moonData);

        allBodies.forEach(body => {
            if (!body.visible) return;
            const pos = this.altAzToXY(body.alt, body.az);
            if (!pos) return;

            const { ctx } = this;
            const r = body.size;

            if (body.isMoon) {
                this.drawMoonSymbol(pos, r, body.phase);
            } else {
                const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 3);
                glow.addColorStop(0,   body.color + 'cc');
                glow.addColorStop(0.5, body.color + '44');
                glow.addColorStop(1,   'transparent');
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r * 3, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
                ctx.fillStyle = body.color;
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth   = 1;
                ctx.stroke();
            }

            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.font      = 'bold 11px Arial';
            ctx.shadowColor = '#000';
            ctx.shadowBlur  = 4;
            ctx.fillText(body.name, pos.x + r + 4, pos.y - r + 4);
            ctx.shadowBlur  = 0;

            if (body.magnitude !== undefined && body.magnitude < 3) {
                ctx.fillStyle = 'rgba(200,220,180,0.6)';
                ctx.font      = '9px Arial';
                ctx.fillText(`${body.magnitude.toFixed(1)}m`, pos.x + r + 4, pos.y + 6);
            }
        });
    }

    drawMoonSymbol(pos, r, phase) {
        const { ctx } = this;
        const moonGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 4);
        moonGlow.addColorStop(0,   'rgba(240,240,200,0.35)');
        moonGlow.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 4, 0, Math.PI * 2);
        ctx.fillStyle = moonGlow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#d8d8c0';
        ctx.fill();

        const phaseAngle = phase * Math.PI / 180;
        const limbX = pos.x + r * Math.cos(phaseAngle) * 0.6;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, -Math.PI / 2, Math.PI / 2);
        ctx.arc(limbX, pos.y, r * Math.abs(Math.cos(phaseAngle)), Math.PI / 2, -Math.PI / 2, phase < 180);
        ctx.closePath();
        ctx.fillStyle = '#090d22';
        ctx.fill();
    }

    drawHorizonRing() {
        const { ctx, center, radius } = this;
        ctx.save();
        const grad = ctx.createLinearGradient(center.x - radius, 0, center.x + radius, 0);
        grad.addColorStop(0,   'rgba(60,140,100,0.7)');
        grad.addColorStop(0.5, 'rgba(80,180,120,0.9)');
        grad.addColorStop(1,   'rgba(60,140,100,0.7)');
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 2.5;
        ctx.stroke();
        ctx.restore();
    }

    drawCompassLabels() {
        const { ctx, center, radius } = this;
        const dirs = [
            { label: 'N', az: 0,   color: '#ff7070' },
            { label: 'NE', az: 45, color: '#ffffff' },
            { label: 'E', az: 90,  color: '#ffffff' },
            { label: 'SE',az: 135, color: '#ffffff' },
            { label: 'S', az: 180, color: '#ffffff' },
            { label: 'SW',az: 225, color: '#ffffff' },
            { label: 'W', az: 270, color: '#ffffff' },
            { label: 'NW',az: 315, color: '#ffffff' },
        ];
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        dirs.forEach(d => {
            const angle = (d.az - 90) * Math.PI / 180;
            const dist  = radius + (d.label.length === 1 ? 22 : 18);
            const x     = center.x + Math.cos(angle) * dist;
            const y     = center.y + Math.sin(angle) * dist;
            ctx.font      = d.label.length === 1 ? 'bold 14px Arial' : '11px Arial';
            ctx.fillStyle = d.color;
            ctx.fillText(d.label, x, y);
        });
        ctx.textAlign    = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    // ── Selected object overlay & off-screen pointer ─────────────────────────
    drawSelectedHighlight() {
        if (!this.selectedObject) return;
        const obj = this.selectedObject;
        const { alt, az } = (obj.alt !== undefined)
            ? obj
            : this.raDecToAltAz(obj.ra, obj.dec);
        if (alt < 0) return;
        const pos = this.altAzToXY(alt, az);
        if (!pos) return;
        const ctx = this.ctx;
        ctx.save();
        const pulse = 12 + 3 * Math.sin(Date.now() / 300);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,220,80,0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,220,80,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        // Trigger next frame for pulse animation only when a selection is active
        if (!this._animFrame) {
            this._animFrame = requestAnimationFrame(() => {
                this._animFrame = null;
                if (this.selectedObject) this.render();
            });
        }
    }

    drawOffScreenPointer() {
        if (!this.selectedObject) return;
        const obj = this.selectedObject;
        const { alt, az } = (obj.alt !== undefined)
            ? obj
            : this.raDecToAltAz(obj.ra, obj.dec);
        // Convert canvas pos (accounting for zoom/pan) to screen-space to check visibility
        const rawPos = (alt >= 0) ? this.altAzToXY(alt, az) : null;
        const screenX = rawPos ? (rawPos.x - this.center.x) * this.zoomFactor + this.center.x + this.panX : null;
        const screenY = rawPos ? (rawPos.y - this.center.y) * this.zoomFactor + this.center.y + this.panY : null;
        const inView = screenX !== null
            && screenX >= 0 && screenX <= this.canvas.width
            && screenY >= 0 && screenY <= this.canvas.height;
        const name = obj.name || 'Selected';
        if (inView) return;
        // Object is off-screen: draw directional arrow + label at edge
        const ctx = this.ctx;
        ctx.save();
        const cx = this.center.x, cy = this.center.y;
        let angle;
        if (alt < 0) {
            // Below horizon: point toward the azimuth on horizon ring
            angle = (az - 90) * Math.PI / 180;
        } else {
            angle = Math.atan2((screenY - cy), (screenX - cx));
        }
        const edgeDist = Math.min(cx, cy) - 40;
        const ex = cx + Math.cos(angle) * edgeDist;
        const ey = cy + Math.sin(angle) * edgeDist;
        ctx.translate(ex, ey);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,220,80,0.9)';
        ctx.fill();
        ctx.rotate(-angle);
        ctx.font = 'bold 11px Arial';
        ctx.fillStyle = 'rgba(255,220,80,0.9)';
        ctx.textAlign = 'center';
        const label = alt < 0
            ? `${name} (below horizon)`
            : `${name} — ${az.toFixed(0)}° ${alt.toFixed(0)}°alt`;
        ctx.fillText(label, 0, -22);
        ctx.restore();
    }

    // ── Projection helpers ────────────────────────────────────────────────────
    altAzToXY(alt, az) {
        if (alt < 0) return null;
        const r     = this.radius * (1 - alt / 90);
        const angle = (az - 90) * Math.PI / 180;
        return {
            x: this.center.x + Math.cos(angle) * r,
            y: this.center.y + Math.sin(angle) * r
        };
    }

    objectsAtXY(x, y, radius = 12) {
        const hits = [];
        [...this.stars, ...this.planets, this.moonData, ...this.dsos].filter(Boolean).forEach(obj => {
            if (!obj.visible) return;
            const pos = this.altAzToXY(obj.alt, obj.az);
            if (!pos) return;
            const d = Math.hypot(x - pos.x, y - pos.y);
            if (d < radius) hits.push({ obj, d });
        });
        hits.sort((a, b) => a.d - b.d);
        return hits.map(h => h.obj);
    }

    // ── Interaction ───────────────────────────────────────────────────────────
    handleHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
        let y = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
        // Inverse zoom/pan transform so hit-test matches canvas object coords
        x = (x - (this.center.x + this.panX)) / this.zoomFactor + this.center.x;
        y = (y - (this.center.y + this.panY)) / this.zoomFactor + this.center.y;
        const hits = this.objectsAtXY(x, y);
        if (hits.length === 0) { this.tooltip.style.display = 'none'; return; }
        const obj = hits[0];
        this.tooltip.innerHTML = `
            <strong>${obj.name || 'Star'}</strong><br>
            Alt: ${obj.alt.toFixed(1)}°&nbsp; Az: ${obj.az.toFixed(1)}°
            ${obj.magnitude !== undefined ? `<br>Mag: ${Number(obj.magnitude).toFixed(1)}` : ''}
            ${obj.isDSO ? `<br>${obj.type} · ${obj.size}′` : ''}
            ${obj.isMoon ? `<br>Phase: ${obj.phase.toFixed(0)}° (${(obj.fraction*100).toFixed(0)}% lit)` : ''}
        `;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left    = `${e.clientX + 14}px`;
        this.tooltip.style.top     = `${e.clientY - 36}px`;
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left) * (this.canvas.width  / rect.width);
        let y = (e.clientY - rect.top)  * (this.canvas.height / rect.height);
        x = (x - (this.center.x + this.panX)) / this.zoomFactor + this.center.x;
        y = (y - (this.center.y + this.panY)) / this.zoomFactor + this.center.y;
        const hits = this.objectsAtXY(x, y);
        if (hits.length > 0) {
            this.selectedObject = hits[0];
            this.pushObjectDetails(hits[0]);
            this.render();
        }
    }

    pushObjectDetails(obj) {
        const list = document.getElementById('objects-list');
        const div  = document.createElement('div');
        div.className = 'object-item';

        let extraLines = '';

        if (obj.isPlanet) {
            if (obj.magnitude !== undefined)
                extraLines += `<br>Mag <b>${Number(obj.magnitude).toFixed(1)}</b>`;
            if (obj.phase_frac !== undefined && obj.phase_frac !== null)
                extraLines += ` &nbsp; Phase <b>${Math.round(obj.phase_frac * 100)}%</b>`;
            if (obj.elongation !== null && obj.elongation !== undefined)
                extraLines += ` &nbsp; Elong <b>${obj.elongation.toFixed(1)}°</b>`;
            // Angular size from geocentric distance
            if (obj.geo_dist) {
                const angSz = this.planetAngularSizeArcsec(obj.name, obj.geo_dist);
                if (angSz) extraLines += `<br>Angular size ≈ <b>${angSz.toFixed(1)}″</b>`;
            }
            // Rise / Set
            const rs = this.getPlanetRiseSet(obj.name);
            if (rs) {
                const fmt = t => t ? this.formatTime(t) : '--';
                extraLines += `<br>Rises <b>${fmt(rs.rise)}</b> &nbsp; Sets <b>${fmt(rs.set)}</b>`;
            }
        } else if (obj.isMoon) {
            extraLines += `<br>Phase <b>${obj.phase.toFixed(0)}°</b> · <b>${(obj.fraction*100).toFixed(0)}%</b> illuminated`;
            const rs = this.getPlanetRiseSet('Moon');
            if (rs) {
                const fmt = t => t ? this.formatTime(t) : '--';
                extraLines += `<br>Rises <b>${fmt(rs.rise)}</b> &nbsp; Sets <b>${fmt(rs.set)}</b>`;
            }
        } else {
            if (obj.magnitude !== undefined)
                extraLines += `<br>Mag ${Number(obj.magnitude).toFixed(1)}`;
            if (obj.isDSO)
                extraLines += `<br>Size ${obj.size}′`;
        }

        div.innerHTML = `
            <strong>${obj.name || 'Unnamed Star'}</strong>
            &nbsp;<span style="font-size:0.75em;opacity:0.7">${obj.isDSO ? obj.type : obj.isPlanet ? '● Planet' : obj.isMoon ? '☽ Moon' : '★ Star'}</span><br>
            Alt <b>${obj.alt.toFixed(2)}°</b>&nbsp; Az <b>${obj.az.toFixed(2)}°</b><br>
            RA ${(obj.ra/15).toFixed(3)}h &nbsp; Dec ${obj.dec.toFixed(2)}°
            ${extraLines}
            <br><button class="log-this-btn" style="margin-top:5px;font-size:0.75em;padding:2px 9px;
                background:rgba(70,140,255,0.25);border:1px solid rgba(100,160,255,0.4);
                border-radius:4px;color:rgba(180,210,255,0.9);cursor:pointer">📓 Log this</button>
        `;
        div.querySelector('.log-this-btn').addEventListener('click', () => this.logObject(obj));
        list.prepend(div);
        if (list.children.length > 15) list.removeChild(list.lastChild);
    }

    createTooltip() {
        const t = document.createElement('div');
        t.className = 'tooltip';
        document.body.appendChild(t);
        return t;
    }

    // ── Info panel ────────────────────────────────────────────────────────────
    updateInfoPanel() {
        const list = document.getElementById('objects-list');
        const visibleBodies = [
            ...this.planets.filter(p => p.visible),
            ...(this.moonData && this.moonData.visible ? [this.moonData] : []),
            ...this.stars.filter(s => s.visible && s.name && s.magnitude < 2.5)
                         .sort((a, b) => a.magnitude - b.magnitude)
                         .slice(0, 12)
        ];
        list.innerHTML = visibleBodies.map(obj => `
            <div class="object-item">
                <strong>${obj.name}</strong>
                <span style="float:right;opacity:0.6;font-size:0.8em">${obj.isPlanet ? '●' : obj.isMoon ? '☽' : '★'}</span><br>
                Alt ${obj.alt.toFixed(1)}°&nbsp; Az ${obj.az.toFixed(1)}°
                ${obj.magnitude !== undefined ? `&nbsp;|&nbsp; Mag ${Number(obj.magnitude).toFixed(1)}` : ''}
            </div>
        `).join('');
    }

    // ── Deep Sky Catalog ───────────────────────────────────────────────────────
    buildDSOCatalog() {
        return DSO_CATALOG.map(([name, type, ra_h, dec, mag, size, con]) => ({
            name, type, ra: ra_h * 15, dec, mag, size,
            const: con, icon: this.dsoIcon(type),
            alt: 0, az: 0, visible: false, isDSO: true
        }));
    }

    dsoIcon(type) {
        return { Gx: '🌌', OC: '⭐', GC: '✨', Nb: '💫', PN: '🔵', SNR: '💥' }[type] || '◎';
    }

    // ── Zodiac Constellations ───────────────────────────────────────────────────
    buildZodiacCatalog() {
        // RA/Dec computed from ecliptic midpoints (λ = 15°, 45°, ... 345°) with ε = 23.439°
        // so labels sit exactly on the drawn ecliptic curve
        const eps = 23.439 * Math.PI / 180;
        const eclPt = (lamDeg) => {
            const l = lamDeg * Math.PI / 180;
            let ra = Math.atan2(Math.cos(eps) * Math.sin(l), Math.cos(l)) * 180 / Math.PI;
            if (ra < 0) ra += 360;
            return { ra: ra / 15, dec: Math.asin(Math.sin(eps) * Math.sin(l)) * 180 / Math.PI };
        };
        return [
            { name: 'Aries',       symbol: '♈', ...eclPt( 15) },
            { name: 'Taurus',      symbol: '♉', ...eclPt( 45) },
            { name: 'Gemini',      symbol: '♊', ...eclPt( 75) },
            { name: 'Cancer',      symbol: '♋', ...eclPt(105) },
            { name: 'Leo',         symbol: '♌', ...eclPt(135) },
            { name: 'Virgo',       symbol: '♍', ...eclPt(165) },
            { name: 'Libra',       symbol: '♎', ...eclPt(195) },
            { name: 'Scorpius',    symbol: '♏', ...eclPt(225) },
            { name: 'Sagittarius', symbol: '♐', ...eclPt(255) },
            { name: 'Capricornus', symbol: '♑', ...eclPt(285) },
            { name: 'Aquarius',    symbol: '♒', ...eclPt(315) },
            { name: 'Pisces',      symbol: '♓', ...eclPt(345) },
        ];
    }

    // ── Dynamic Data Fetching from NASA/JPL ─────────────────────────────────────
    async fetchDynamicData() {
        const now = new Date();
        if (this.lastDataFetch && (now - this.lastDataFetch) < 3600000) {
            return;
        }

        const comets = [];
        
        try {
            const response = await fetch('/api/comets');
            if (response.ok) {
                const data = await response.json();
                if (data.objects) {
                    data.objects.slice(0, 20).forEach(obj => {
                        if (obj.pha || obj.pc > 0) {
                            comets.push({
                                name: obj.full_name || obj.pdes,
                                designation: obj.pdes,
                                ra: obj.ra ? obj.ra[0] : 0,
                                dec: obj.dec ? obj.dec[0] : 0,
                                mag: obj.h ? parseFloat(obj.h) : 10,
                                velocity: obj.velocity ? obj.velocity[0] : 0,
                                distance: obj.distance ? obj.distance[0] : 0,
                                discovered: obj.discovery_date || 'Unknown'
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.log('Using fallback comet data');
        }

        if (comets.length === 0) {
            comets.push(...this.getFallbackComets());
        }

        this.comets = comets;
        this.lastDataFetch = now;
    }

    getFallbackComets() {
        return [
            { name: 'C/2023 A3 (Tsuchinshan-ATLAS)', designation: 'C/2023 A3', ra: 14.5, dec: -8, mag: 7, velocity: 25, distance: 2.1, discovered: '2023-01-09' },
            { name: 'C/2024 G3 (ATLAS)', designation: 'C/2024 G3', ra: 22.0, dec: -55, mag: 6, velocity: 42, distance: 0.4, discovered: '2024-04-05' },
            { name: '12P/Pons-Brooks', designation: '12P/Pons-Brooks', ra: 1.5, dec: 55, mag: 8, velocity: 20, distance: 1.5, discovered: '1812-07-12' },
            { name: '13P/Olbers', designation: '13P/Olbers', ra: 6.0, dec: 30, mag: 9, velocity: 22, distance: 1.9, discovered: '1795-03-17' },
            { name: 'C/2022 E3 (ZTF)', designation: 'C/2022 E3', ra: 10.5, dec: 70, mag: 10, velocity: 18, distance: 2.8, discovered: '2022-03-02' },
            { name: 'C/2021 A1 (Leonard)', designation: 'C/2021 A1', ra: 8.0, dec: 35, mag: 9, velocity: 30, distance: 2.0, discovered: '2021-01-03' },
        ];
    }

    // ── Night Mode Toggle ─────────────────────────────────────────────────────
    toggleNightMode() {
        this.nightMode = !this.nightMode;
        document.body.classList.toggle('night-mode', this.nightMode);
        const btn = document.getElementById('toggle-night-mode');
        if (btn) btn.classList.toggle('active', this.nightMode);
    }

    // ── Tonight View ───────────────────────────────────────────────────────────
    // ── Panel management ─────────────────────────────────────────────────────
    closeAllPanels() {
        document.getElementById('tonight-panel').classList.remove('open');
        document.getElementById('plan-panel').classList.remove('open');
        document.getElementById('log-panel').classList.remove('open');
        document.getElementById('search-modal').style.display = 'none';
        document.getElementById('gear-modal').style.display = 'none';
        document.getElementById('location-modal').style.display = 'none';
    }

    openTonightPanel() {
        this.closeAllPanels();
        document.getElementById('tonight-panel').classList.add('open');
        this.updateTonightPanel();
    }

    closeTonightPanel() {
        document.getElementById('tonight-panel').classList.remove('open');
    }

    updateTonightPanel() {
        if (this.location.lat === null) return;
        
        // Moon phase
        const moonPhase = this.moonData ? this.moonData.phase : 0;
        const moonPct = this.moonData ? Math.round(this.moonData.fraction * 100) : 0;
        // Use phase angle (0-360°) for waxing/waning: 0=New, 90=First Qtr, 180=Full, 270=Last Qtr
        const phaseDesc = moonPhase < 22.5 ? 'New Moon' :
                          moonPhase < 67.5 ? 'Waxing Crescent' :
                          moonPhase < 112.5 ? 'First Quarter' :
                          moonPhase < 157.5 ? 'Waxing Gibbous' :
                          moonPhase < 202.5 ? 'Full Moon' :
                          moonPhase < 247.5 ? 'Waning Gibbous' :
                          moonPhase < 292.5 ? 'Last Quarter' :
                          moonPhase < 337.5 ? 'Waning Crescent' : 'New Moon';
        document.getElementById('moon-phase').textContent = `${moonPct}%`;
        document.getElementById('moon-desc').textContent = phaseDesc;

        // Twilight times — civil (-6°), nautical (-12°), astronomical (-18°)
        const civil    = this.getSunTimeAtAlt(-6);
        const nautical = this.getSunTimeAtAlt(-12);
        const astro    = this.getSunTimeAtAlt(-18);
        const fmt = t => t ? this.formatTime(t) : '--';
        const twRow = (label, col, eve, morn) =>
            `<span style="color:${col}">■</span> ${label}: ${fmt(eve)} – ${fmt(morn)}&emsp;`;
        const twilightEl = document.getElementById('twilight-times');
        if (twilightEl) {
            twilightEl.innerHTML =
                twRow('Civil',    '#f0a050', civil.eve,    civil.morn) +
                twRow('Nautical', '#8080e0', nautical.eve, nautical.morn) +
                `<br>` +
                twRow('Astro',   '#3060c0', astro.eve,    astro.morn) +
                `<span style="color:rgba(160,200,255,0.5)">(below −18° = truly dark)</span>`;
        }

        // Use astro twilight for the dark window display; fall back to sunset/sunrise
        const darkFrom = astro.eve  || this.getSunsetTime();
        const darkTo   = astro.morn || this.getSunriseTime();
        document.getElementById('dark-window').textContent = darkFrom && darkTo ?
            `${this.formatTime(darkFrom)} – ${this.formatTime(darkTo)}` : '--';
        document.getElementById('dark-window-desc').textContent = 'Astronomical dark (Sun < −18°)';

        // Best targets
        const targets = this.getBestTargetsTonight();
        const scoreColor = s => s >= 75 ? '#4caf7d' : s >= 50 ? '#f0c040' : s >= 30 ? '#e07840' : '#888';
        const targetsHtml = targets.slice(0, 8).map(t => `
            <div class="target-item" data-ra="${t.ra}" data-dec="${t.dec}">
                <span class="target-icon">${t.icon}</span>
                <div class="target-info">
                    <div class="target-name">${t.name}</div>
                    <div class="target-meta">${t.type} • ${t.const}</div>
                </div>
                <span class="target-score" style="background:${scoreColor(t.score)};color:#fff;
                    border-radius:4px;padding:2px 6px;font-size:0.8em;font-weight:bold;min-width:32px;
                    text-align:center">${t.score}</span>
            </div>
        `).join('');
        document.getElementById('tonight-targets').innerHTML = targetsHtml || '<p>No targets available</p>';
        document.querySelectorAll('.target-item').forEach(item => {
            item.addEventListener('click', () => {
                const ra = parseFloat(item.dataset.ra);
                const dec = parseFloat(item.dataset.dec);
                if (!isNaN(ra) && !isNaN(dec)) {
                    this.centerOnObject({ ra, dec, name: item.querySelector('.target-name').textContent });
                }
            });
        });

        // Active meteor showers
        const activeSh = this.activeShowers(7);
        const meteorSection = document.getElementById('meteor-section');
        const meteorList    = document.getElementById('meteor-showers-list');
        if (meteorSection && meteorList) {
            if (activeSh.length === 0) {
                meteorSection.style.display = 'none';
            } else {
                meteorSection.style.display = 'block';
                const moonFrac = this.moonData ? this.moonData.fraction : 0;
                meteorList.innerHTML = activeSh.map(s => {
                    const { alt } = this.raDecToAltAz(s.ra * 15, s.dec);
                    const radiantUp = alt > 0;
                    const effectiveZHR = Math.round(s.zhr * (1 - moonFrac * 0.7));
                    const d = this.currentTime;
                    const peakDate = new Date(d.getFullYear(), s.month - 1, s.day);
                    const daysOff  = Math.round((peakDate - d) / 86400000);
                    const whenStr  = daysOff === 0 ? 'Peak tonight!' :
                                     daysOff > 0   ? `Peak in ${daysOff}d` : `${-daysOff}d past peak`;
                    return `<div style="padding:6px 0;border-bottom:1px solid rgba(100,150,255,0.12)">
                        <div style="display:flex;justify-content:space-between">
                            <span style="color:rgba(255,220,100,0.95);font-weight:bold">✦ ${s.name}</span>
                            <span style="font-size:0.8em;color:${daysOff===0?'#4caf7d':'rgba(160,200,255,0.6)'}">${whenStr}</span>
                        </div>
                        <div style="font-size:0.8em;color:rgba(160,200,255,0.7);margin-top:2px">
                            ZHR ~${effectiveZHR} (moon-adj) · Radiant ${radiantUp ? `${alt.toFixed(0)}° alt` : 'below horizon'} · ${s.parent}
                        </div>
                    </div>`;
                }).join('');
            }
        }
    }

    getSunsetTime() {
        const d = new Date(this.currentTime);
        const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        const lat = this.location.lat;
        const decl = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365);
        const tanProd = Math.tan(lat * Math.PI / 180) * Math.tan(decl * Math.PI / 180);
        if (Math.abs(tanProd) > 1) return null;
        const hourAngle = Math.acos(-tanProd) * 180 / Math.PI;
        const solarNoon = 12 - this.location.lon / 15;
        return new Date(d.setHours(Math.floor(solarNoon - hourAngle / 15),
            Math.round(((solarNoon - hourAngle / 15) % 1) * 60), 0, 0));
    }

    getSunriseTime() {
        const d = new Date(this.currentTime);
        const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        const lat = this.location.lat;
        const decl = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365);
        const tanProd = Math.tan(lat * Math.PI / 180) * Math.tan(decl * Math.PI / 180);
        if (Math.abs(tanProd) > 1) return null;
        const hourAngle = Math.acos(-tanProd) * 180 / Math.PI;
        const solarNoon = 12 - this.location.lon / 15;
        return new Date(d.setHours(Math.floor(solarNoon + hourAngle / 15),
            Math.round(((solarNoon + hourAngle / 15) % 1) * 60), 0, 0));
    }

    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // ── Sun position (Jean Meeus simplified) ──────────────────────────────────
    computeSunPosition() {
        const jd = this.julianDate(this.currentTime);
        const n  = jd - 2451545.0;
        const L  = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
        const gR = ((357.528 + 0.9856003 * n) % 360 + 360) % 360 * Math.PI / 180;
        const lam = (L + 1.915 * Math.sin(gR) + 0.020 * Math.sin(2 * gR)) * Math.PI / 180;
        const eps = (23.439 - 0.0000004 * n) * Math.PI / 180;
        let ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * 180 / Math.PI;
        if (ra < 0) ra += 360;
        const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) * 180 / Math.PI;
        const { alt, az } = this.raDecToAltAz(ra, dec);
        return { ra, dec, alt, az };
    }

    // ── Time when Sun reaches altDeg today (eve = setting side, morn = rising side) ──
    getSunTimeAtAlt(altDeg) {
        const d  = new Date(this.currentTime);
        const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        const lat = this.location.lat;
        const decl   = -23.45 * Math.cos(2 * Math.PI * (doy + 10) / 365);
        const sinAlt = Math.sin(altDeg * Math.PI / 180);
        const sinLat = Math.sin(lat * Math.PI / 180);
        const cosLat = Math.cos(lat * Math.PI / 180);
        const sinDec = Math.sin(decl * Math.PI / 180);
        const cosDec = Math.cos(decl * Math.PI / 180);
        const cosHA  = (sinAlt - sinDec * sinLat) / (cosDec * cosLat);
        if (Math.abs(cosHA) > 1) return { eve: null, morn: null };
        const haH = Math.acos(cosHA) * 180 / Math.PI / 15;
        const sn  = 12 - this.location.lon / 15;
        const mk  = (h) => {
            const hh = ((h % 24) + 24) % 24;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(hh), Math.round((hh % 1) * 60), 0, 0);
        };
        return { eve: mk(sn + haH), morn: mk(sn - haH) };
    }

    // ── Sky glow overlay based on Sun altitude ────────────────────────────────
    drawSunGlow() {
        if (this.location.lat === null) return;
        const sun = this.computeSunPosition();
        if (sun.alt < -18) return;
        const { ctx, center, radius } = this;
        const intensity = Math.max(0, Math.min(1, (sun.alt + 18) / 18));
        const angle = (sun.az - 90) * Math.PI / 180;
        const hx = center.x + Math.cos(angle) * radius;
        const hy = center.y + Math.sin(angle) * radius;
        const glowR = radius * (0.5 + 0.5 * intensity);
        let c0, c1;
        if (sun.alt > -6) {
            const a = intensity * 0.65;
            c0 = `rgba(255,140,40,${a})`; c1 = `rgba(255,60,10,${a * 0.2})`;
        } else if (sun.alt > -12) {
            const a = intensity * 0.38;
            const f = (sun.alt + 12) / 6;
            c0 = `rgba(${Math.round(80 + 175*f)},${Math.round(70 + 80*f)},${Math.round(170 - 130*f)},${a})`;
            c1 = `rgba(20,40,120,${a * 0.2})`;
        } else {
            const a = intensity * 0.18;
            c0 = `rgba(30,55,150,${a})`; c1 = `rgba(5,15,60,0)`;
        }
        ctx.save();
        const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, glowR);
        grad.addColorStop(0, c0);
        grad.addColorStop(1, c1);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }

    getBestTargetsTonight() {
        const sunset   = this.getSunsetTime();
        const sunrise  = this.getSunriseTime();
        if (!sunset || !sunrise) return [];

        // Use astro twilight (-18°) for dark window; fall back to sunset+1h / sunrise-1h
        const astro = this.getSunTimeAtAlt(-18);
        const darkStart = astro.eve  || new Date(sunset.getTime()  + 3600000);
        const darkEnd   = astro.morn || new Date(sunrise.getTime() - 3600000);
        const darkDurH  = Math.max(1, (darkEnd - darkStart) / 3600000);

        const lat      = this.location.lat;
        const moonRA   = this.moonData ? this.moonData.ra   : null;
        const moonDec  = this.moonData ? this.moonData.dec  : null;
        const moonFrac = this.moonData ? this.moonData.fraction : 0;

        const scoreObj = (obj) => {
            const ra  = obj.ra;
            const dec = obj.dec;

            // 1. Peak altitude at meridian transit (HA = 0)  [0-30 pts]
            const peakAlt = 90 - Math.abs(lat - dec);
            if (peakAlt < 10) return null;
            const altScore = peakAlt < 20
                ? 0
                : Math.min(30, (peakAlt - 20) / 70 * 30);

            // 2. Transit falls inside dark window            [0-20 pts]
            const lstDark = this.localSiderealTimeAt(darkStart);
            let haDeg = ((lstDark - ra) + 360) % 360;
            if (haDeg > 180) haDeg -= 360; // negative = not yet transited at darkStart
            const hoursUntilTransit = -haDeg / 15;
            const transitMs  = darkStart.getTime() + hoursUntilTransit * 3600000;
            const inWindow   = transitMs >= darkStart.getTime() && transitMs <= darkEnd.getTime();
            let transitScore;
            if (inWindow) {
                const frac = hoursUntilTransit / darkDurH;
                transitScore = Math.round(20 - Math.abs(frac - 0.5) * 12);
            } else {
                transitScore = peakAlt > 40 ? 8 : peakAlt > 25 ? 4 : 0;
            }

            // 3. Moon separation                            [0-25 pts]
            let moonSepScore = 20;
            if (moonRA !== null && moonFrac > 0.15) {
                const sep = this.angularSeparation(ra, dec, moonRA, moonDec);
                moonSepScore = sep >= 60 ? 25
                             : sep >= 30 ? Math.round(10 + (sep - 30) / 30 * 15)
                             : Math.round(sep / 30 * 10);
                if (obj.isDSO) moonSepScore = Math.max(0, moonSepScore - Math.round(moonFrac * 8));
            }

            // 4. Hours above 20° during dark window         [0-15 pts]
            const altMinR  = 20 * Math.PI / 180;
            const decR     = dec * Math.PI / 180;
            const latR     = lat * Math.PI / 180;
            const cosHALim = (Math.sin(altMinR) - Math.sin(decR) * Math.sin(latR))
                           / (Math.cos(decR) * Math.cos(latR));
            let darkWindowScore;
            if (cosHALim >= 1) {
                darkWindowScore = 0;
            } else if (cosHALim <= -1) {
                darkWindowScore = 15;
            } else {
                const visH = 2 * Math.acos(cosHALim) * 180 / Math.PI / 15;
                darkWindowScore = Math.round(Math.min(15, visH / darkDurH * 15));
            }

            // 5. Gear suitability                           [0-10 pts]
            const gear = (this.gearProfile && this.gearProfile.level) || 'telescope';
            let gearScore = 5;
            if (obj.isDSO) {
                const mag = obj.mag, sz = obj.size;
                if (gear === 'phone') {
                    gearScore = (mag < 5 && sz > 30) ? 10 : (mag < 7 && sz > 15) ? 8
                              : (mag < 9 && sz > 5)  ?  5 : 1;
                } else if (gear === 'binoculars') {
                    gearScore = (mag < 7 && sz > 5)  ? 10 : (mag < 9 && sz > 2) ? 7
                              : (mag < 11)            ?  4 : 1;
                } else {
                    gearScore = mag < 9 ? 10 : mag < 11 ? 7 : 5;
                }
            } else if (obj.isPlanet) {
                gearScore = 10;
            } else {
                gearScore = (obj.magnitude || 5) < 2 ? 8 : 5;
            }

            return Math.min(100, Math.max(0,
                Math.round(altScore + transitScore + moonSepScore + darkWindowScore + gearScore)));
        };

        const results = [];

        // Filter out objects that are currently below horizon (fixes §2.6)
        this.planets.filter(p => p.visible && p.alt > 0).forEach(p => {
            const s = scoreObj({ ...p, isPlanet: true });
            if (s !== null && s >= 5) results.push({
                name: p.name, type: 'Planet',
                ra: p.ra, dec: p.dec,
                const: this.getConstellation(p.ra, p.dec),
                icon: '●', score: s
            });
        });

        this.dsos.filter(d => d.mag < 11 && d.alt > 0).forEach(d => {
            const s = scoreObj(d);
            if (s !== null && s >= 10) results.push({
                name: d.name, type: d.type,
                ra: d.ra, dec: d.dec,
                const: d.const, icon: d.icon, score: s
            });
        });

        return results.sort((a, b) => b.score - a.score);
    }

    getConstellation(ra, dec) {
        // Simplified constellation lookup
        if (dec > 80) return 'Ursa Minor';
        if (dec > 60) return ra > 180 ? 'Cepheus' : 'Ursa Major';
        if (dec > 40) return ra > 120 && ra < 220 ? 'Leo' : 'Ursa Major';
        if (dec > 20) return ra > 80 && ra < 150 ? 'Orion' : ra > 180 && ra < 260 ? 'Virgo' : 'Boötes';
        if (dec > 0) return ra > 60 && ra < 120 ? 'Taurus' : ra > 240 && ra < 300 ? 'Sagittarius' : 'Cetus';
        return ra > 270 ? 'Phoenix' : 'Eridanus';
    }

    getUpcomingEvents() {
        const events = [];
        const d = this.currentTime;
        
        // Simple moon events
        if (this.moonData) {
            const phase = this.moonData.phase;
            if (phase < 15) events.push({ name: 'New Moon', time: 'Best for deep sky' });
            if (phase > 165 && phase < 180) events.push({ name: 'Full Moon', time: 'Bright moonlight' });
        }

        // Planet visibility
        const visiblePlanets = this.planets.filter(p => p.visible).map(p => p.name).join(', ');
        if (visiblePlanets) {
            events.push({ name: `Planets visible: ${visiblePlanets}`, time: 'Tonight' });
        }

        return events;
    }

    // ── Search ─────────────────────────────────────────────────────────────────
    openSearchModal() {
        this.closeAllPanels();
        document.getElementById('search-modal').style.display = 'flex';
        document.getElementById('object-search').focus();
    }

    closeSearchModal() {
        document.getElementById('search-modal').style.display = 'none';
        document.getElementById('search-results').innerHTML = '';
        document.getElementById('object-search').value = '';
    }

    searchObjects(query) {
        const q = query.toLowerCase();
        const results = [];

        // Search stars
        this.stars.forEach(s => {
            if (s.name && s.name.toLowerCase().includes(q)) {
                results.push({
                    name: s.name,
                    type: 'Star',
                    ra: s.ra,
                    dec: s.dec,
                    mag: s.magnitude,
                    icon: '★'
                });
            }
        });

        // Search planets
        this.planets.forEach(p => {
            if (p.name.toLowerCase().includes(q)) {
                results.push({
                    name: p.name,
                    type: 'Planet',
                    ra: p.ra,
                    dec: p.dec,
                    mag: p.magnitude,
                    icon: '●'
                });
            }
        });

        // Search deep sky
        this.dsos.forEach(ds => {
            if (ds.name.toLowerCase().includes(q) || ds.const.toLowerCase().includes(q)) {
                results.push({
                    name: ds.name,
                    type: ds.type,
                    ra: ds.ra,
                    dec: ds.dec,
                    mag: ds.mag,
                    icon: ds.icon
                });
            }
        });

        // Search constellations
        const conNames = [...new Set(this.dsos.map(ds => ds.const))];
        conNames.forEach(c => {
            if (c.toLowerCase().includes(q)) {
                results.push({
                    name: c,
                    type: 'Constellation',
                    ra: 0,
                    dec: 0,
                    icon: '✨'
                });
            }
        });

        return results.slice(0, 15);
    }

    displaySearchResults(results) {
        const html = results.map(r => `
            <div class="search-result-item" data-ra="${r.ra}" data-dec="${r.dec}" data-name="${r.name}">
                <span class="search-result-icon">${r.icon}</span>
                <div class="search-result-info">
                    <div class="search-result-name">${r.name}</div>
                    <div class="search-result-type">${r.type}</div>
                </div>
                <div class="search-result-pos">${r.ra ? 'RA ' + (r.ra/15).toFixed(2) + 'h' : ''} ${r.dec ? 'Dec ' + r.dec.toFixed(1) + '°' : ''}</div>
            </div>
        `).join('');
        document.getElementById('search-results').innerHTML = html || '<p style="padding:15px;color:rgba(180,210,255,0.5)">No results found</p>';

        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const ra = parseFloat(item.dataset.ra);
                const dec = parseFloat(item.dataset.dec);
                const name = item.querySelector('.search-result-name')?.textContent || '';
                this.closeSearchModal();
                if (!isNaN(ra) && !isNaN(dec)) {
                    this.centerOnObject({ ra, dec, name });
                }
            });
        });
    }

    // ── Gear Profile ───────────────────────────────────────────────────────────
    static get SENSOR_PRESETS() {
        return [
            { name: 'Phone',        level: 'phone',     fl: 26,   crop: 7.0, pitch: 1.2,  aperture: 3  },
            { name: 'Sony A7 III',  level: 'tracker',   fl: 50,   crop: 1.0, pitch: 5.97, aperture: 50 },
            { name: 'Sony A7R V',   level: 'tracker',   fl: 85,   crop: 1.0, pitch: 4.37, aperture: 85 },
            { name: 'Canon 6D II',  level: 'dslr',      fl: 50,   crop: 1.0, pitch: 6.55, aperture: 50 },
            { name: 'Canon R6',     level: 'tracker',   fl: 50,   crop: 1.0, pitch: 4.35, aperture: 50 },
            { name: 'Nikon D750',   level: 'dslr',      fl: 50,   crop: 1.0, pitch: 5.95, aperture: 50 },
            { name: 'APS-C (1.5×)', level: 'dslr',      fl: 50,   crop: 1.5, pitch: 4.23, aperture: 50 },
            { name: 'MFT (2×)',     level: 'dslr',      fl: 50,   crop: 2.0, pitch: 3.76, aperture: 50 },
        ];
    }

    openGearModal() {
        this.closeAllPanels();
        document.getElementById('gear-modal').style.display = 'flex';
        const saved = this.loadGearProfile();
        if (saved) {
            this.gearProfile = { ...this.gearProfile, ...saved };
            const radio = document.querySelector(`input[name="gear-level"][value="${saved.level}"]`);
            if (radio) radio.checked = true;
            document.getElementById('focal-length').value  = saved.focalLength  || 50;
            document.getElementById('crop-factor').value   = saved.cropFactor   || 1;
            document.getElementById('aperture-mm').value   = saved.aperture     || 50;
            document.getElementById('pixel-pitch').value   = saved.pixelPitch   || 5.97;
        }
        this.renderGearPresets();
    }

    renderGearPresets() {
        const container = document.getElementById('gear-presets');
        if (!container) return;
        container.innerHTML = NightSkyApp.SENSOR_PRESETS.map((p, i) => `
            <button class="preset-btn" data-idx="${i}" style="font-size:0.75em;padding:3px 8px;
                margin:2px;background:rgba(80,120,200,0.25);border:1px solid rgba(100,150,255,0.3);
                border-radius:4px;color:rgba(180,210,255,0.9);cursor:pointer">${p.name}</button>
        `).join('');
        container.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = NightSkyApp.SENSOR_PRESETS[parseInt(btn.dataset.idx)];
                document.querySelector(`input[name="gear-level"][value="${p.level}"]`).checked = true;
                document.getElementById('focal-length').value = p.fl;
                document.getElementById('aperture-mm').value  = p.aperture;
                document.getElementById('pixel-pitch').value  = p.pitch;
                const sel = document.getElementById('crop-factor');
                const opt = [...sel.options].find(o => Math.abs(parseFloat(o.value) - p.crop) < 0.05);
                if (opt) sel.value = opt.value;
            });
        });
    }

    closeGearModal() {
        document.getElementById('gear-modal').style.display = 'none';
    }

    saveGearProfile() {
        const level       = document.querySelector('input[name="gear-level"]:checked').value;
        const focalLength = parseInt(document.getElementById('focal-length').value)  || 50;
        const cropFactor  = parseFloat(document.getElementById('crop-factor').value) || 1;
        const aperture    = parseFloat(document.getElementById('aperture-mm').value)  || 50;
        const pixelPitch  = parseFloat(document.getElementById('pixel-pitch').value)  || 5.97;
        this.gearProfile  = { level, focalLength, cropFactor, aperture, pixelPitch };
        try { localStorage.setItem('nso_gear', JSON.stringify(this.gearProfile)); } catch (_) {}
        this.closeGearModal();
    }

    loadGearProfile() {
        try {
            const raw = localStorage.getItem('nso_gear');
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return null;
    }

    // ── NPF exposure calculator ────────────────────────────────────────────────
    npfExposure(decDeg) {
        const { focalLength: fl, cropFactor: cf, pixelPitch: p } = this.gearProfile;
        const sensorDiag = Math.sqrt((36 / cf) ** 2 + (24 / cf) ** 2);
        const npf = (35 * Math.atan(sensorDiag / (2 * fl)) * 180 / Math.PI
                    + 30 * p)
                   / (Math.cos(decDeg * Math.PI / 180) * 15);
        return Math.max(1, Math.round(npf));
    }

    // ── FOV calculator ─────────────────────────────────────────────────────────
    fovDegrees() {
        const { focalLength: fl, cropFactor: cf } = this.gearProfile;
        const w = 2 * Math.atan(36 / cf / (2 * fl)) * 180 / Math.PI;
        const h = 2 * Math.atan(24 / cf / (2 * fl)) * 180 / Math.PI;
        return { w, h };
    }

    // ── Plan & Shoot ───────────────────────────────────────────────────────────
    openPlanPanel() {
        this.closeAllPanels();
        document.getElementById('plan-panel').classList.add('open');
        this.updatePlanTargets();
    }

    closePlanPanel() {
        document.getElementById('plan-panel').classList.remove('open');
    }

    updatePlanTargets() {
        const targets = this.getBestTargetsTonight().slice(0, 10);
        const html = targets.map((t, i) => `
            <div class="plan-target-item" data-index="${i}">
                <span class="target-icon">${t.icon}</span>
                <div class="target-info">
                    <div class="target-name">${t.name}</div>
                    <div class="target-meta">${t.type} • Score: ${t.score}</div>
                </div>
            </div>
        `).join('');
        document.getElementById('plan-target-list').innerHTML = html;

        // Add click handlers
        document.querySelectorAll('.plan-target-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.plan-target-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                const idx = parseInt(item.dataset.index);
                this.showPlanTargetDetails(targets[idx]);
            });
        });
    }

    showPlanTargetDetails(target) {
        // Enrich with full DSO data if available (for framing)
        const fullDso = this.dsos.find(d => d.name === target.name);
        const richTarget = fullDso ? { ...target, ...fullDso } : target;
        this.centerOnObject(richTarget);

        const details = document.getElementById('plan-details');
        details.style.display = 'block';

        const { alt, az } = this.raDecToAltAz(richTarget.ra, richTarget.dec);
        const peakAlt = 90 - Math.abs(this.location.lat - richTarget.dec);

        document.getElementById('plan-target-info').innerHTML = `
            <div class="target-name" style="font-size:1.2em;margin-bottom:6px">${richTarget.name}</div>
            <div class="target-meta">${richTarget.type}${richTarget.const ? ' in ' + richTarget.const : ''}</div>
            <div style="margin-top:8px;color:rgba(180,210,255,0.7);font-size:0.9em">
                Alt <b style="color:#adf">${alt.toFixed(1)}°</b> &nbsp; Az <b style="color:#adf">${az.toFixed(1)}°</b> &nbsp;
                Peak <b style="color:#adf">${peakAlt.toFixed(1)}°</b><br>
                RA ${(richTarget.ra / 15).toFixed(3)}h &nbsp; Dec ${richTarget.dec.toFixed(2)}°
                ${richTarget.mag !== undefined ? `&nbsp; Mag ${richTarget.mag}` : ''}
                ${richTarget.size ? `&nbsp; ${richTarget.size}′` : ''}
            </div>
        `;

        // Transit time
        const lst   = this.localSiderealTime();
        let haDeg   = ((lst - richTarget.ra) + 360) % 360;
        if (haDeg > 180) haDeg -= 360;
        const hoursToTransit = -haDeg / 15;
        let transitNote;
        if (Math.abs(hoursToTransit) < 0.25) {
            transitNote = 'At meridian now — best altitude';
        } else if (hoursToTransit > 0 && hoursToTransit < 12) {
            const h = Math.floor(hoursToTransit), m = Math.round((hoursToTransit % 1) * 60);
            transitNote = `Transits in ${h}h ${m}m`;
        } else {
            const hPast = Math.abs(hoursToTransit);
            const h = Math.floor(hPast), m = Math.round((hPast % 1) * 60);
            transitNote = `Transited ${h}h ${m}m ago`;
        }

        document.getElementById('plan-timing').innerHTML = `
            <div class="setting-row"><span class="setting-label">Transit</span><span class="setting-value">${transitNote}</span></div>
            <div class="setting-row"><span class="setting-label">Now Alt</span><span class="setting-value">${alt.toFixed(1)}°</span></div>
            <div class="setting-row"><span class="setting-label">Score</span><span class="setting-value">${target.score}/100</span></div>
        `;

        document.getElementById('plan-settings').innerHTML = this.getSuggestedSettings(richTarget);
    }

    // ── Object navigation ─────────────────────────────────────────────────────
    centerOnObject(obj) {
        this.selectedObject = obj;
        const { alt, az } = (obj.alt !== undefined && obj.az !== undefined)
            ? obj
            : this.raDecToAltAz(obj.ra, obj.dec);
        if (alt > 2) {
            const pos = this.altAzToXY(alt, az);
            if (pos) {
                if (this.zoomFactor < 2) this.zoomFactor = 2;
                // pan so object appears at canvas centre
                // screen = (canvas - cx)*Z + cx + panX  → set screenX = cx → panX = (cx - pos.x)*Z
                this.panX = (this.center.x - pos.x) * this.zoomFactor;
                this.panY = (this.center.y - pos.y) * this.zoomFactor;
            }
        }
        this.render();
    }

    getSuggestedSettings(target) {
        const { level, focalLength, aperture } = this.gearProfile;
        const { w: fovW, h: fovH } = this.fovDegrees();
        const npfSec = this.npfExposure(target.dec || 0);

        let html = '';

        // Gear summary
        html += `<div class="setting-row"><span class="setting-label">Gear</span>
                 <span class="setting-value">${focalLength}mm · f/${(focalLength / Math.max(1, aperture)).toFixed(1)}</span></div>`;

        // FOV
        html += `<div class="setting-row"><span class="setting-label">FOV</span>
                 <span class="setting-value">${fovW.toFixed(1)}° × ${fovH.toFixed(1)}°
                 (${(fovW * 60).toFixed(0)}′ × ${(fovH * 60).toFixed(0)}′)</span></div>`;

        // Framing fit (DSOs only)
        if (target.isDSO && target.size) {
            const sz = target.size; // arcmin
            const fovWarcmin = fovW * 60, fovHarcmin = fovH * 60;
            const fits = sz <= fovWarcmin * 0.8 && sz <= fovHarcmin * 0.8;
            const fills = sz >= fovWarcmin * 0.5 || sz >= fovHarcmin * 0.5;
            const framingNote = sz > fovWarcmin
                ? `⚠ Too large — ${sz}′ object exceeds ${fovWarcmin.toFixed(0)}′ FOV`
                : fits && fills
                ? `✓ Good framing — object fills ${Math.round(sz / fovWarcmin * 100)}% of width`
                : fits
                ? `✓ Fits — object is ${Math.round(sz / fovWarcmin * 100)}% of FOV width`
                : `△ Object (${sz}′) is small in frame`;
            const color = sz > fovWarcmin ? '#ff9060' : fills ? '#4caf7d' : '#f0c040';
            html += `<div class="setting-row"><span class="setting-label">Framing</span>
                     <span class="setting-value" style="color:${color}">${framingNote}</span></div>`;
        }

        // NPF max exposure
        const trackerMult = level === 'tracker' ? 10 : level === 'telescope' ? 20 : 1;
        const maxExp = level === 'phone' ? Math.min(15, npfSec)
                     : level === 'dslr'  ? npfSec
                     : npfSec * trackerMult;
        const expLabel = level === 'tracker' || level === 'telescope'
            ? `${maxExp}s (NPF × ${trackerMult} tracked)`
            : `${maxExp}s (NPF rule, untracked)`;
        html += `<div class="setting-row"><span class="setting-label">Max Exposure</span>
                 <span class="setting-value">${expLabel}</span></div>`;

        // ISO suggestion
        const iso = level === 'phone'     ? 'Auto / Night Mode'
                  : level === 'dslr'      ? 'ISO 1600–3200'
                  : level === 'tracker'   ? 'ISO 800–1600'
                  : 'ISO 400–800';
        html += `<div class="setting-row"><span class="setting-label">ISO</span>
                 <span class="setting-value">${iso}</span></div>`;

        // Aperture limiting magnitude (Naked-eye + 2.1*log10(D/7mm))
        const limMag = 6.5 + 2.1 * Math.log10(Math.max(7, aperture) / 7);
        html += `<div class="setting-row"><span class="setting-label">Lim. Magnitude</span>
                 <span class="setting-value">≈${limMag.toFixed(1)} mag</span></div>`;

        // Moon warning
        if (this.moonData && target.ra !== undefined) {
            const moonSep = this.angularSeparation(target.ra, target.dec, this.moonData.ra, this.moonData.dec);
            if (moonSep < 15) {
                html += `<div class="setting-row"><span class="setting-label">⚠ Moon</span>
                         <span class="setting-value" style="color:#ff7070">${moonSep.toFixed(0)}° — bright sky</span></div>`;
            } else if (moonSep < 30) {
                html += `<div class="setting-row"><span class="setting-label">⚠ Moon</span>
                         <span class="setting-value" style="color:#ffb870">${moonSep.toFixed(0)}° — some glow</span></div>`;
            }
        }

        return html;
    }

    // ── ISS Tracker ───────────────────────────────────────────────────────────
    startISSTracking() {
        this.fetchISSPosition();
        this.issTimer = setInterval(() => this.fetchISSPosition(), 10000);
    }

    stopISSTracking() {
        if (this.issTimer) { clearInterval(this.issTimer); this.issTimer = null; }
        this.issData = null;
        this.render();
    }

    async fetchISSPosition() {
        try {
            const res  = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
            if (!res.ok) throw new Error('ISS API error');
            const json = await res.json();
            this.issData = {
                lat:     json.latitude,
                lon:     json.longitude,
                altKm:   json.altitude,
                velKms:  json.velocity,
                visible: json.visibility   // 'daylight' | 'eclipsed' | 'visible'
            };
            if (this.showISS) this.render();
        } catch (_) {
            // silently keep last known position
        }
    }

    issGeodeticToAltAz(issLat, issLon, issAltKm) {
        const R   = 6371;
        const deg = Math.PI / 180;
        const latO = this.location.lat * deg,  lonO = this.location.lon * deg;
        const latI = issLat * deg,             lonI = issLon * deg;
        const rI   = R + issAltKm;

        // ECEF for observer and ISS
        const ox = R  * Math.cos(latO) * Math.cos(lonO);
        const oy = R  * Math.cos(latO) * Math.sin(lonO);
        const oz = R  * Math.sin(latO);
        const ix = rI * Math.cos(latI) * Math.cos(lonI);
        const iy = rI * Math.cos(latI) * Math.sin(lonI);
        const iz = rI * Math.sin(latI);

        const dx = ix - ox, dy = iy - oy, dz = iz - oz;
        const range = Math.sqrt(dx*dx + dy*dy + dz*dz);

        // ECEF → local ENU at observer
        const sLat = Math.sin(latO), cLat = Math.cos(latO);
        const sLon = Math.sin(lonO), cLon = Math.cos(lonO);
        const e =  -sLon*dx + cLon*dy;
        const n =  -sLat*cLon*dx - sLat*sLon*dy + cLat*dz;
        const u =   cLat*cLon*dx + cLat*sLon*dy + sLat*dz;

        const alt = Math.asin(u / range) * 180 / Math.PI;
        const az  = ((Math.atan2(e, n) * 180 / Math.PI) + 360) % 360;
        return { alt, az, rangeKm: range };
    }

    drawISS() {
        if (!this.issData || this.location.lat === null) return;
        const { ctx } = this;
        const { alt, az, rangeKm } = this.issGeodeticToAltAz(
            this.issData.lat, this.issData.lon, this.issData.altKm);

        const isVisible = alt > 0;
        const pos = isVisible ? this.altAzToXY(alt, az) : null;

        if (pos) {
            ctx.save();
            // ISS symbol — cross with circle
            const r = 9;
            const glow = this.issData.visible === 'visible' ? 'rgba(100,255,180,0.8)' : 'rgba(200,200,255,0.6)';
            ctx.strokeStyle = glow;
            ctx.lineWidth   = 1.8;
            ctx.shadowColor = glow;
            ctx.shadowBlur  = 8;
            // Solar panel cross
            ctx.beginPath();
            ctx.moveTo(pos.x - r, pos.y); ctx.lineTo(pos.x + r, pos.y);
            ctx.moveTo(pos.x, pos.y - r * 0.5); ctx.lineTo(pos.x, pos.y + r * 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            ctx.shadowBlur = 0;
            // Label
            if (this.showLabels) {
                ctx.fillStyle = 'rgba(180,255,220,0.9)';
                ctx.font = 'bold 10px Arial';
                ctx.textAlign = 'left';
                ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 3;
                ctx.fillText(`ISS  ${alt.toFixed(0)}°alt  ${Math.round(rangeKm)}km`, pos.x + 12, pos.y + 3);
                ctx.shadowBlur = 0;
            }
            ctx.restore();
        }

        // Always update ISS status in Tonight panel if open
        const issEl = document.getElementById('iss-status');
        if (issEl) {
            issEl.innerHTML = isVisible
                ? `<span style="color:#4cff90">● Visible</span> — Alt ${alt.toFixed(1)}°, Az ${az.toFixed(1)}°, Range ${Math.round(rangeKm)} km`
                : `<span style="color:rgba(160,200,255,0.4)">● Below horizon</span> — Lat ${this.issData.lat.toFixed(2)}°, Lon ${this.issData.lon.toFixed(2)}°`;
        }
    }

    // ── Star Chart Export ─────────────────────────────────────────────────────
    exportChart() {
        // Create an off-screen canvas at the same resolution
        const src = this.canvas;
        const off = document.createElement('canvas');
        off.width  = src.width;
        off.height = src.height;
        const oc = off.getContext('2d');

        // Copy current sky chart
        oc.drawImage(src, 0, 0);

        // Stamp metadata bar at the bottom
        const barH = Math.round(src.height * 0.055);
        const pad  = Math.round(barH * 0.25);
        oc.fillStyle = 'rgba(0,0,20,0.75)';
        oc.fillRect(0, src.height - barH, src.width, barH);

        const locStr = this.location.lat !== null
            ? `${this.location.lat.toFixed(3)}°, ${this.location.lon.toFixed(3)}°`
            : 'Location unknown';
        const dt = this.currentTime.toLocaleString([], {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const visibleDSOs = this.dsos.filter(d => d.visible).length;
        const metaText = `Night Sky Observer  ·  ${dt}  ·  ${locStr}  ·  ${visibleDSOs} DSOs visible`;

        const fontSize = Math.max(10, Math.round(barH * 0.42));
        oc.font      = `${fontSize}px Arial`;
        oc.fillStyle = 'rgba(180,210,255,0.85)';
        oc.textAlign = 'left';
        oc.textBaseline = 'middle';
        oc.fillText(metaText, pad, src.height - barH / 2);

        // Watermark top-right
        oc.font      = `bold ${Math.round(fontSize * 0.85)}px Arial`;
        oc.fillStyle = 'rgba(255,255,255,0.25)';
        oc.textAlign = 'right';
        oc.fillText('nightskyobserver.app', src.width - pad, pad + fontSize * 0.5);

        // Trigger download
        const link = document.createElement('a');
        const safe = dt.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `sky_chart_${safe}.png`;
        link.href = off.toDataURL('image/png');
        link.click();
    }

    // ── Observation Logger ────────────────────────────────────────────────────
    loadObsLog() {
        try {
            const raw = localStorage.getItem('nso_obslog');
            return raw ? JSON.parse(raw) : [];
        } catch (_) { return []; }
    }

    saveObsLog() {
        try { localStorage.setItem('nso_obslog', JSON.stringify(this.observationLog)); } catch (_) {}
    }

    logObject(obj) {
        const entry = {
            id:        Date.now(),
            timestamp: new Date().toISOString(),
            name:      obj.name || 'Unnamed Star',
            type:      obj.isDSO ? obj.type : obj.isPlanet ? 'Planet' : obj.isMoon ? 'Moon' : 'Star',
            icon:      obj.icon || (obj.isPlanet ? '●' : obj.isMoon ? '☽' : '★'),
            ra:        obj.ra,
            dec:       obj.dec,
            alt:       obj.alt,
            az:        obj.az,
            mag:       obj.magnitude ?? obj.mag ?? null,
            notes:     ''
        };
        this.observationLog.unshift(entry);
        this.saveObsLog();
        // Flash the log button to confirm
        const btn = document.getElementById('btn-log');
        if (btn) {
            btn.style.background = 'rgba(70,200,130,0.4)';
            setTimeout(() => { btn.style.background = ''; }, 800);
        }
        // Refresh panel if open
        if (document.getElementById('log-panel').classList.contains('open')) {
            this.updateLogPanel();
        }
    }

    openLogPanel() {
        this.closeAllPanels();
        document.getElementById('log-panel').classList.add('open');
        this.updateLogPanel();
    }

    closeLogPanel() {
        document.getElementById('log-panel').classList.remove('open');
    }

    updateLogPanel() {
        const log   = this.observationLog;
        const empty = document.getElementById('log-empty');
        const stats = document.getElementById('log-stats');
        const list  = document.getElementById('log-entries');

        if (log.length === 0) {
            empty.style.display = 'block';
            list.innerHTML = '';
            stats.textContent = '';
            return;
        }
        empty.style.display = 'none';

        // Stats line
        const types = {};
        log.forEach(e => { types[e.type] = (types[e.type] || 0) + 1; });
        const typeSummary = Object.entries(types).map(([t, n]) => `${n} ${t}`).join(' · ');
        stats.textContent = `${log.length} observation${log.length > 1 ? 's' : ''} — ${typeSummary}`;

        list.innerHTML = log.map(e => {
            const dt  = new Date(e.timestamp);
            const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
            <div class="log-entry" data-id="${e.id}" style="border-bottom:1px solid rgba(100,150,255,0.15);
                padding:8px 0;margin-bottom:4px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <div>
                        <span style="font-size:1em">${e.icon}</span>
                        <strong style="color:rgba(220,235,255,0.95)">${e.name}</strong>
                        <span style="font-size:0.75em;color:rgba(160,200,255,0.6);margin-left:5px">${e.type}</span>
                    </div>
                    <div style="text-align:right;font-size:0.75em;color:rgba(160,200,255,0.5)">
                        ${dateStr}<br>${timeStr}
                    </div>
                </div>
                <div style="font-size:0.8em;color:rgba(160,200,255,0.65);margin-top:2px">
                    Alt ${e.alt.toFixed(1)}° · Az ${e.az.toFixed(1)}°
                    ${e.mag !== null ? ` · Mag ${Number(e.mag).toFixed(1)}` : ''}
                </div>
                <div style="margin-top:5px;display:flex;gap:6px;align-items:center">
                    <input type="text" placeholder="Add note…" value="${e.notes}"
                        data-id="${e.id}"
                        style="flex:1;background:rgba(30,50,100,0.4);border:1px solid rgba(80,120,200,0.3);
                            border-radius:4px;color:rgba(200,220,255,0.9);font-size:0.78em;padding:3px 7px">
                    <button class="del-log-btn" data-id="${e.id}"
                        style="font-size:0.75em;padding:2px 8px;background:rgba(180,40,40,0.3);
                            border:1px solid rgba(255,80,80,0.3);border-radius:4px;
                            color:#ffaaaa;cursor:pointer">✕</button>
                </div>
            </div>`;
        }).join('');

        // Note auto-save on input blur
        list.querySelectorAll('input[data-id]').forEach(inp => {
            inp.addEventListener('change', () => {
                const entry = this.observationLog.find(e => e.id === parseInt(inp.dataset.id));
                if (entry) { entry.notes = inp.value; this.saveObsLog(); }
            });
        });
        // Delete individual entry
        list.querySelectorAll('.del-log-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.observationLog = this.observationLog.filter(e => e.id !== parseInt(btn.dataset.id));
                this.saveObsLog();
                this.updateLogPanel();
            });
        });
    }

    clearObsLog() {
        if (this.observationLog.length === 0) return;
        if (!confirm(`Clear all ${this.observationLog.length} observation(s)?`)) return;
        this.observationLog = [];
        this.saveObsLog();
        this.updateLogPanel();
    }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { 
    window.app = new NightSkyApp(); 
});
