const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 8765;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json'
};

// ── Orbital mechanics helpers ─────────────────────────────────────────────────

function julianDateNow() {
    return Date.now() / 86400000.0 + 2440587.5;
}

// Iterative Kepler equation solver (handles high eccentricity)
function solveKepler(M, e) {
    let E = e > 0.8 ? Math.PI : M + e * Math.sin(M);
    for (let i = 0; i < 50; i++) {
        const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
        E += dE;
        if (Math.abs(dE) < 1e-10) break;
    }
    return E;
}

// Earth heliocentric position in ecliptic (J2000, AU)
function earthPos(jd) {
    const T  = (jd - 2451545.0) / 36525.0;
    const g  = (357.528 + 35999.050 * T) * Math.PI / 180;
    const L  = (280.460 + 36000.770 * T) * Math.PI / 180;
    const lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
    const r  = 1.00014 - 0.01671 * Math.cos(g) - 0.000140 * Math.cos(2 * g);
    return { x: r * Math.cos(lam), y: r * Math.sin(lam), z: 0 };
}

// Convert orbital elements → geocentric equatorial RA/Dec for a given JD
function elementsToRaDec(e, a, q, i_deg, om_deg, w_deg, tp_jd, jd) {
    const D2R = Math.PI / 180;
    const i = i_deg * D2R, om = om_deg * D2R, w = w_deg * D2R;
    let nu, r;

    if (e < 0.999) {
        // Elliptical
        const sma = a > 0 ? a : q / (1 - e);
        const n   = (2 * Math.PI) / (365.25 * Math.pow(sma, 1.5));
        let M = ((n * (jd - tp_jd)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const E = solveKepler(M, e);
        nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2),
                            Math.sqrt(1 - e) * Math.cos(E / 2));
        r  = sma * (1 - e * Math.cos(E));
    } else {
        // Near-parabolic / parabolic (Barker's equation)
        const k = 0.01720209895; // Gaussian gravitational constant (AU^3/2 / day)
        const W = 3 * k * (jd - tp_jd) / (Math.sqrt(2) * Math.pow(q, 1.5));
        const Y = Math.cbrt(W + Math.sqrt(W * W + 1));
        const s = Y - 1 / Y;
        nu = 2 * Math.atan(s);
        r  = q * (1 + s * s);
    }

    // Heliocentric ecliptic (J2000)
    const xH = r * ( Math.cos(om) * Math.cos(w + nu) - Math.sin(om) * Math.sin(w + nu) * Math.cos(i));
    const yH = r * ( Math.sin(om) * Math.cos(w + nu) + Math.cos(om) * Math.sin(w + nu) * Math.cos(i));
    const zH = r *   Math.sin(w + nu) * Math.sin(i);

    const earth = earthPos(jd);
    const dx = xH - earth.x, dy = yH - earth.y, dz = zH - earth.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Ecliptic → equatorial (J2000, obliquity 23.439°)
    const eps = 23.439 * D2R;
    const xEq = dx;
    const yEq = dy * Math.cos(eps) - dz * Math.sin(eps);
    const zEq = dy * Math.sin(eps) + dz * Math.cos(eps);

    let ra = Math.atan2(yEq, xEq) * 180 / Math.PI;
    if (ra < 0) ra += 360;
    const dec = Math.asin(Math.max(-1, Math.min(1, zEq / dist))) * 180 / Math.PI;
    return { ra, dec, dist };
}

// Apply topocentric (observer-specific) parallax correction to geocentric RA/Dec
// Reduces positional error for nearby objects (< 1 AU) from ~1° max to sub-arcsec typical
function topocentricCorrection(ra_deg, dec_deg, dist, lat_deg, lon_deg, jd) {
    const D2R = Math.PI / 180;
    const a_e  = 4.2635e-5; // Earth equatorial radius in AU
    const flat = 1 / 298.257; // Earth flattening
    const lat  = lat_deg * D2R;
    const rho_sin = (1 - flat * (2 - flat)) * Math.sin(lat);
    const rho_cos = Math.cos(lat);

    // Greenwich Mean Sidereal Time → Local Apparent Sidereal Time
    const GMST = ((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360 + 360) % 360;
    const LST  = (GMST + lon_deg) * D2R;

    const ra  = ra_deg  * D2R;
    const dec = dec_deg * D2R;
    const pi  = Math.asin(Math.min(1, a_e / dist)); // horizontal parallax

    const dRa  = -rho_cos * Math.sin(pi) * Math.sin(LST - ra) / Math.cos(dec);
    const dDec = -Math.sin(pi) * (rho_sin * Math.cos(dec) - rho_cos * Math.sin(dec) * Math.cos(LST - ra));

    let topoRa = ra_deg + dRa * 180 / Math.PI;
    if (topoRa <   0) topoRa += 360;
    if (topoRa >= 360) topoRa -= 360;
    return { ra: topoRa, dec: dec_deg + dDec * 180 / Math.PI };
}

// Fetch bright comets from SBDB, compute RA/Dec from orbital elements.
// Optional lat/lon params produce topocentric (observer-specific) coordinates.
function proxyComets(req, res) {
    const jd  = julianDateNow();
    const urlParts = new URL(req.url, `http://localhost:${PORT}`);
    const obsLat = urlParts.searchParams.get('lat')  ? parseFloat(urlParts.searchParams.get('lat'))  : null;
    const obsLon = urlParts.searchParams.get('lon')  ? parseFloat(urlParts.searchParams.get('lon'))  : null;
    const hasObserver = obsLat !== null && isFinite(obsLat) && obsLon !== null && isFinite(obsLon);

    // SBDB Query API - returns comets with orbital elements sorted by perihelion distance
    const url = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api?' +
                'fields=full_name,pdes,e,a,q,i,om,w,tp,H&sb-kind=c&limit=40&sort=q&dir=ASC';

    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const fields = parsed.fields || [];
                const idx = {};
                fields.forEach((f, i) => { idx[f] = i; });

                const comets = [];
                (parsed.data || []).forEach(row => {
                    try {
                        const e      = parseFloat(row[idx['e']]);
                        const a      = row[idx['a']] != null ? parseFloat(row[idx['a']]) : null;
                        const q      = parseFloat(row[idx['q']]);
                        const i_deg  = parseFloat(row[idx['i']]);
                        const om_deg = parseFloat(row[idx['om']]);
                        const w_deg  = parseFloat(row[idx['w']]);
                        const tp_jd  = parseFloat(row[idx['tp']]);
                        const H      = row[idx['H']] != null ? parseFloat(row[idx['H']]) : null;
                        const name   = (row[idx['full_name']] || row[idx['pdes']] || '').trim();
                        const pdes   = (row[idx['pdes']] || '').trim();

                        if ([e, q, i_deg, om_deg, w_deg, tp_jd].some(v => !isFinite(v))) return;

                        let { ra, dec, dist } = elementsToRaDec(e, a, q, i_deg, om_deg, w_deg, tp_jd, jd);
                        if (!isFinite(ra) || !isFinite(dec)) return;
                        if (dist > 5) return;

                        // Apply topocentric correction when observer location is known
                        if (hasObserver) {
                            const topo = topocentricCorrection(ra, dec, dist, obsLat, obsLon, jd);
                            ra  = topo.ra;
                            dec = topo.dec;
                        }

                        comets.push({
                            name, designation: pdes, ra, dec, mag: H,
                            dist: +dist.toFixed(3),
                            topocentric: hasObserver
                        });
                    } catch (_) {}
                });

                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ comets, topocentric: hasObserver }));
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ comets: [], topocentric: false, error: e.message }));
            }
        });
    }).on('error', err => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ comets: [], topocentric: false, error: err.message }));
    });
}

// Observing conditions from Open-Meteo (free, no API key)
function proxyWeather(req, res) {
    const urlParts = new URL(req.url, `http://localhost:${PORT}`);
    const lat = urlParts.searchParams.get('lat');
    const lon = urlParts.searchParams.get('lon');

    if (!lat || !lon) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing lat/lon' }));
        return;
    }

    const url = `https://api.open-meteo.com/v1/forecast?` +
        `latitude=${lat}&longitude=${lon}` +
        `&hourly=cloud_cover,visibility,wind_speed_10m&forecast_days=1&timezone=UTC&timeformat=unixtime`;

    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                const times  = parsed.hourly?.time || [];
                const nowTs  = Math.floor(Date.now() / 1000);
                let idx = times.findIndex(t => t >= nowTs);
                if (idx < 0) idx = 0;

                const cloud = parsed.hourly?.cloud_cover?.[idx]  ?? null; // %
                const vis   = parsed.hourly?.visibility?.[idx]   ?? null; // m
                const wind  = parsed.hourly?.wind_speed_10m?.[idx] ?? null; // km/h

                // Simple 1–5 seeing index: lower wind + lower cloud = better
                let seeing = 3;
                if (cloud !== null && wind !== null) {
                    const ws = wind  <  5 ? 2 : wind  < 15 ? 1 : 0;
                    const cs = cloud < 10 ? 2 : cloud < 40 ? 1 : 0;
                    seeing   = Math.min(5, Math.max(1, 1 + ws + cs));
                }
                const SEEING_LABELS = ['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent'];
                const observing     = cloud === null ? null : cloud < 30 ? 'Good' : cloud < 70 ? 'Fair' : 'Poor';

                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({
                    cloud,
                    visibility: vis !== null ? +(vis / 1000).toFixed(1) : null,
                    wind,
                    seeing,
                    seeingLabel: SEEING_LABELS[seeing],
                    observing
                }));
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    }).on('error', err => {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
    });
}

// ── Plate-solve helpers ───────────────────────────────────────────────────────

function httpsPost(hostname, urlPath, body, headers) {
    return new Promise((resolve, reject) => {
        const options = { hostname, path: urlPath, method: 'POST', headers };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function httpsGetText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let data = '';
            res.on('data', c => { data += c; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// POST /api/platesolve  – accepts { apikey, imageBase64 }, returns { subid }
function proxySolve(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: 'POST required' }));
        return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        try {
            const { apikey, imageBase64 } = JSON.parse(body);
            if (!apikey || !imageBase64) throw new Error('Missing apikey or imageBase64');

            // Step 1: login to nova.astrometry.net
            const loginPayload = `request-json=${encodeURIComponent(JSON.stringify({ apikey }))}`;
            const loginResp = await httpsPost('nova.astrometry.net', '/api/login', loginPayload, {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(loginPayload)
            });
            const loginData = JSON.parse(loginResp);
            if (loginData.status !== 'success') throw new Error('API key rejected by astrometry.net');
            const session = loginData.session;

            // Step 2: upload image as multipart/form-data
            const imageBuffer = Buffer.from(imageBase64, 'base64');
            const boundary    = `AstroSolveBdy${Date.now()}`;
            const submitJSON  = JSON.stringify({ session, allow_commercial_use: 'n', allow_modifications: 'n', publicly_visible: 'n' });
            const part1 = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="request-json"\r\n\r\n${submitJSON}\r\n`);
            const part2h = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`);
            const part2t = Buffer.from(`\r\n--${boundary}--\r\n`);
            const multipart = Buffer.concat([part1, part2h, imageBuffer, part2t]);

            const uploadResp = await httpsPost('nova.astrometry.net', '/api/upload', multipart, {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': multipart.length
            });
            const uploadData = JSON.parse(uploadResp);
            if (uploadData.status !== 'success') throw new Error('Upload failed: ' + (uploadData.errormessage || JSON.stringify(uploadData)));

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ subid: uploadData.subid, status: 'submitted' }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: e.message }));
        }
    });
}

// GET /api/solvepoll?subid=X  or  /api/solvepoll?jobid=X
async function proxySolvePoll(req, res) {
    const urlParts = new URL(req.url, `http://localhost:${PORT}`);
    const subid = urlParts.searchParams.get('subid');
    const jobid = urlParts.searchParams.get('jobid');
    try {
        if (jobid) {
            const data   = await httpsGetText(`https://nova.astrometry.net/api/jobs/${jobid}/info/`);
            const parsed = JSON.parse(data);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({
                status:      parsed.status,
                ra:          parsed.calibration?.ra,
                dec:         parsed.calibration?.dec,
                orientation: parsed.calibration?.orientation,
                pixscale:    parsed.calibration?.pixscale
            }));
        } else if (subid) {
            const data   = await httpsGetText(`https://nova.astrometry.net/api/submissions/${subid}`);
            const parsed = JSON.parse(data);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ jobs: parsed.jobs || [] }));
        } else {
            throw new Error('Missing subid or jobid');
        }
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
    }
}

// Proxy timezone API to get accurate UTC offset from lat/lon
function proxyTimezone(req, res) {
    const urlParts = new URL(req.url, `http://localhost:${PORT}`);
    const lat = urlParts.searchParams.get('lat');
    const lon = urlParts.searchParams.get('lon');
    
    if (!lat || !lon) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing lat/lon parameters' }));
        return;
    }
    
    // Use timeapi.io for timezone lookup (free tier, no key required)
    const url = `https://timeapi.io/api/Time/current/coordinate?latitude=${lat}&longitude=${lon}`;
    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                // Handle sub-hour offsets (e.g., India +5:30, Nepal +5:45)
                const hours = parsed.currentUtcOffset?.hours || 0;
                const minutes = parsed.currentUtcOffset?.minutes || 0;
                const utcOffset = hours + (hours >= 0 ? minutes / 60 : -minutes / 60);
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    timezone: parsed.timeZone,
                    utcOffset: utcOffset,
                    dst: parsed.isDayLightSavingTime
                }));
            } catch (e) {
                // Fallback: calculate rough offset from longitude
                const roughOffset = Math.round(parseFloat(lon) / 15 * 2) / 2;
                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({
                    timezone: 'unknown',
                    utcOffset: roughOffset,
                    dst: false,
                    fallback: true
                }));
            }
        });
    }).on('error', (err) => {
        // Fallback on API error
        const roughOffset = Math.round(parseFloat(lon) / 15 * 2) / 2;
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            timezone: 'unknown',
            utcOffset: roughOffset,
            dst: false,
            fallback: true
        }));
    });
}

http.createServer((req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Proxy endpoint for comet API (accepts optional ?lat=&lon= for topocentric correction)
    if (req.url === '/api/comets' || req.url.startsWith('/api/comets?')) {
        proxyComets(req, res);
        return;
    }

    // Proxy endpoint for weather / observing conditions
    if (req.url.startsWith('/api/weather')) {
        proxyWeather(req, res);
        return;
    }

    // Proxy endpoint for timezone API
    if (req.url.startsWith('/api/timezone')) {
        proxyTimezone(req, res);
        return;
    }

    // Plate-solve proxy (astrometry.net nova)
    if (req.url === '/api/platesolve' || req.url.startsWith('/api/platesolve')) {
        proxySolve(req, res);
        return;
    }

    // Plate-solve status polling
    if (req.url.startsWith('/api/solvepoll')) {
        proxySolvePoll(req, res);
        return;
    }

    let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}).listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
