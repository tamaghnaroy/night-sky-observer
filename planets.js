// planets.js — Self-contained astronomical calculations (no external CDN needed)
// Algorithms: Jean Meeus "Astronomical Algorithms" + JPL Approximate Keplerian Elements
// Accuracy: ~1° for planets, ~2° for Moon — sufficient for a sky chart

const Astronomy = (() => {
    'use strict';
    const DEG = Math.PI / 180;
    const RAD = 180 / Math.PI;
    const norm360 = x => ((x % 360) + 360) % 360;

    // ── Julian Date ──────────────────────────────────────────────────────────
    function julianDate(date) {
        return date.getTime() / 86400000.0 + 2440587.5;
    }

    // ── Obliquity of ecliptic (Meeus eq. 22.2) ───────────────────────────────
    function obliquity(T) {
        return (23.439291111 - 0.013004167 * T - 0.0000001639 * T * T
                + 0.0000005036 * T * T * T) * DEG;
    }

    // ── Solve Kepler's equation iteratively ──────────────────────────────────
    function solveKepler(M_deg, e) {
        const M = norm360(M_deg) * DEG;
        let E = M + e * Math.sin(M) * (1.0 + e * Math.cos(M));
        for (let i = 0; i < 12; i++) {
            const dE = (M - E + e * Math.sin(E)) / (1.0 - e * Math.cos(E));
            E += dE;
            if (Math.abs(dE) < 1e-12) break;
        }
        return E;
    }

    // ── JPL Keplerian elements (1800–2050 AD)  ───────────────────────────────
    // Format per planet: [a0, da, e0, de, I0, dI, L0, dL, w0, dw, O0, dO]
    //   a  = semi-major axis (AU)
    //   e  = eccentricity
    //   I  = inclination (deg)
    //   L  = mean longitude (deg)
    //   w~ = longitude of perihelion (deg)  ← w in code
    //   O  = longitude of ascending node (deg)
    //   d* = rate per Julian century
    const ELEMENTS = {
        Mercury: [0.38709927, 0.00000037,  0.20563593,  0.00001906,
                  7.00497902,-0.00594749, 252.25032350, 149472.67411175,
                 77.45779628, 0.16047689,  48.33076593,  -0.12534081],
        Venus:   [0.72333566, 0.00000390,  0.00677672, -0.00004107,
                  3.39467605,-0.00078890, 181.97909950,  58517.81538729,
                131.60246718, 0.00268329,  76.67984255,  -0.27769418],
        Mars:    [1.52371034, 0.00001847,  0.09339410,  0.00007882,
                  1.84969142,-0.00813131,  -4.55343205,  19140.30268499,
                -23.94362959, 0.44441088,  49.55953891,  -0.29257343],
        Jupiter: [5.20288700,-0.00011607,  0.04838624, -0.00013253,
                  1.30439695,-0.00183714,  34.39644051,   3034.74612775,
                 14.72847983, 0.21252668, 100.47390909,   0.20469106],
        Saturn:  [9.53667594,-0.00125060,  0.05386179, -0.00050991,
                  2.48599187, 0.00193609,  49.95424423,   1222.49362201,
                 92.59887831,-0.41897216, 113.66242448,  -0.28867794],
        Uranus:  [19.18916464,-0.00196176, 0.04725744, -0.00004397,
                  0.77263783,-0.00242939, 313.23810451,    428.48202785,
                170.95427630, 0.40805281,  74.01692503,    0.04240589],
        Neptune: [30.06992276, 0.00026291, 0.00859048,  0.00005105,
                  1.77004347, 0.00035372, -55.12002969,    218.45945325,
                 44.96476227,-0.32241464, 131.78422574,   -0.00508664],
    };

    // Earth–Moon Barycenter elements
    const EARTH_ELEM = [
        1.00000261, 0.00000562,  0.01671123, -0.00004392,
       -0.00001531,-0.01294668, 100.46457166, 35999.37244981,
       102.93768193, 0.32327364,  0.0,          0.0
    ];

    // ── Compute heliocentric ecliptic XYZ for given elements at time T ────────
    function heliocentricXYZ(elem, T) {
        const [a0,da, e0,de, I0,dI, L0,dL, w0,dw, O0,dO] = elem;
        const a = a0 + da * T;
        const e = e0 + de * T;
        const I = (I0 + dI * T) * DEG;
        const L = norm360(L0 + dL * T);          // mean longitude (deg)
        const w = norm360(w0 + dw * T);           // longitude of perihelion (deg)
        const O = norm360(O0 + dO * T);           // longitude of ascending node (deg)

        const M     = norm360(L - w);              // mean anomaly (deg)
        const omega = norm360(w - O);              // argument of perihelion (deg)
        const E     = solveKepler(M, e);           // eccentric anomaly (rad)

        // Position in orbital plane
        const xOrb = a * (Math.cos(E) - e);
        const yOrb = a * Math.sqrt(1.0 - e * e) * Math.sin(E);

        // Rotate to ecliptic reference frame
        const cosO = Math.cos(O * DEG), sinO = Math.sin(O * DEG);
        const cosI = Math.cos(I),       sinI = Math.sin(I);
        const cosW = Math.cos(omega * DEG), sinW = Math.sin(omega * DEG);

        const Px = ( cosO * cosW - sinO * sinW * cosI) * xOrb + (-cosO * sinW - sinO * cosW * cosI) * yOrb;
        const Py = ( sinO * cosW + cosO * sinW * cosI) * xOrb + (-sinO * sinW + cosO * cosW * cosI) * yOrb;
        const Pz = ( sinW * sinI) * xOrb + (cosW * sinI) * yOrb;

        return { x: Px, y: Py, z: Pz };
    }

    // ── Ecliptic XYZ → equatorial RA/Dec ─────────────────────────────────────
    function eclipticToEquatorial(x, y, z, eps) {
        const cosE = Math.cos(eps), sinE = Math.sin(eps);
        const xEq = x;
        const yEq = y * cosE - z * sinE;
        const zEq = y * sinE + z * cosE;
        const ra  = norm360(Math.atan2(yEq, xEq) * RAD) / 15.0; // hours
        const dec = Math.asin(Math.max(-1, Math.min(1, zEq / Math.sqrt(xEq*xEq + yEq*yEq + zEq*zEq)))) * RAD;
        return { ra, dec };
    }

    // ── Simplified Moon position (Meeus Ch.47 low-precision) ─────────────────
    function moonPosition(date) {
        const jd = julianDate(date);
        const T  = (jd - 2451545.0) / 36525.0;

        const D  = norm360(297.85036 + 445267.111480 * T - 0.0019142 * T * T);
        const M  = norm360(357.52772 + 35999.050340 * T - 0.0001603 * T * T);
        const Mp = norm360(134.96298 + 477198.867398 * T + 0.0086972 * T * T);
        const F  = norm360(93.27191  + 483202.017538 * T - 0.0036825 * T * T);
        const Om = norm360(125.04452 - 1934.136261 * T);

        // Longitude (sum of periodic terms, arcseconds / 1e-6 degrees after /1e6)
        const sumL = 6288774 * Math.sin(Mp * DEG)
                   + 1274027 * Math.sin((2*D - Mp) * DEG)
                   +  658314 * Math.sin(2 * D * DEG)
                   +  213618 * Math.sin(2 * Mp * DEG)
                   -  185116 * Math.sin(M * DEG)
                   -  114332 * Math.sin(2 * F * DEG)
                   +   58793 * Math.sin((2*D - 2*Mp) * DEG)
                   +   57066 * Math.sin((2*D - M - Mp) * DEG)
                   +   53322 * Math.sin((2*D + Mp) * DEG)
                   +   45758 * Math.sin((2*D - M) * DEG)
                   -   40923 * Math.sin((M - Mp) * DEG)
                   -   34720 * Math.sin(D * DEG)
                   -   30383 * Math.sin((M + Mp) * DEG)
                   +   15327 * Math.sin((2*D - 2*F) * DEG)
                   -   12528 * Math.sin((Mp + 2*F) * DEG)
                   +   10980 * Math.sin((Mp - 2*F) * DEG)
                   +   10675 * Math.sin((4*D - Mp) * DEG)
                   +   10034 * Math.sin(3 * Mp * DEG)
                   +    8548 * Math.sin((4*D - 2*Mp) * DEG);

        // Latitude
        const sumB = 5128122 * Math.sin(F * DEG)
                   +  280602 * Math.sin((Mp + F) * DEG)
                   +  277693 * Math.sin((Mp - F) * DEG)
                   +  173237 * Math.sin((2*D - F) * DEG)
                   +   55413 * Math.sin((2*D - Mp + F) * DEG)
                   +   46271 * Math.sin((2*D - Mp - F) * DEG)
                   +   32573 * Math.sin((2*D + F) * DEG)
                   +   17198 * Math.sin((2*Mp + F) * DEG)
                   +    9266 * Math.sin((2*D + Mp - F) * DEG)
                   +    8822 * Math.sin((2*Mp - F) * DEG)
                   -    6875 * Math.sin(Mp * DEG);

        const L0  = norm360(218.3165 + 481267.8813 * T);
        const lon = L0 + sumL / 1000000.0 - 0.00478 * Math.sin(Om * DEG); // apparent
        const lat = sumB / 1000000.0;

        const eps = obliquity(T);
        const lonR = lon * DEG, latR = lat * DEG;
        const x   = Math.cos(latR) * Math.cos(lonR);
        const y   = Math.cos(latR) * Math.sin(lonR);
        const z   = Math.sin(latR);
        return eclipticToEquatorial(x, y, z, eps);
    }

    // ── Local Sidereal Time ──────────────────────────────────────────────────
    function localSiderealTime(date, lonDeg) {
        const jd = julianDate(date);
        const T  = (jd - 2451545.0) / 36525.0;
        const gst = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
                    + 0.000387933 * T * T - (T * T * T) / 38710000.0;
        return norm360(gst + lonDeg);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Public API — mirrors the astronomy-engine interface used in app.js
    // ═══════════════════════════════════════════════════════════════════════════

    class Observer {
        constructor(lat, lon, elev = 0) {
            this.latitude  = lat;
            this.longitude = lon;
            this.height    = elev;
        }
    }

    function Equator(bodyName, date, observer /*, ofdate, aberration */) {
        const jd = julianDate(date);
        const T  = (jd - 2451545.0) / 36525.0;
        const eps = obliquity(T);

        if (bodyName === 'Moon') {
            return moonPosition(date);
        }

        const earth  = heliocentricXYZ(EARTH_ELEM, T);
        const planet = heliocentricXYZ(ELEMENTS[bodyName], T);

        // Geocentric ecliptic vector
        const gx = planet.x - earth.x;
        const gy = planet.y - earth.y;
        const gz = planet.z - earth.z;

        return eclipticToEquatorial(gx, gy, gz, eps);
    }

    function Horizon(date, observer, ra_hours, dec_deg /*, refraction */) {
        const lst  = localSiderealTime(date, observer.longitude);
        const ha   = norm360(lst - ra_hours * 15.0);          // hour angle (deg)
        const haR  = ha      * DEG;
        const decR = dec_deg * DEG;
        const latR = observer.latitude * DEG;

        const sinAlt = Math.sin(decR) * Math.sin(latR)
                     + Math.cos(decR) * Math.cos(latR) * Math.cos(haR);
        const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * RAD;

        const cosAlt = Math.cos(altitude * DEG);
        let azimuth = 0;
        if (Math.abs(cosAlt) > 1e-10) {
            const cosAz = (Math.sin(decR) - Math.sin(latR) * Math.sin(altitude * DEG))
                        / (Math.cos(latR) * cosAlt);
            azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD;
            if (Math.sin(haR) > 0) azimuth = 360.0 - azimuth;
        }
        return { altitude, azimuth };
    }

    function MoonPhase(date) {
        // Returns Moon's elongation from Sun in degrees (0=new, 180=full)
        const jd = julianDate(date);
        const T  = (jd - 2451545.0) / 36525.0;
        const D  = norm360(297.85036 + 445267.111480 * T - 0.0019142 * T * T);
        return D;
    }

    // Approximate visual magnitudes (fixed per body for simplicity)
    const APPROX_MAG = {
        Mercury: 0.0, Venus: -4.2, Mars: 0.5,
        Jupiter: -2.5, Saturn: 0.6, Uranus: 5.7, Neptune: 7.8
    };

    function Illumination(bodyName, date) {
        if (bodyName === 'Moon') {
            const phase    = MoonPhase(date);
            const fraction = (1 - Math.cos(phase * DEG)) / 2;
            return { mag: -12.6, phase_fraction: fraction };
        }
        return { mag: APPROX_MAG[bodyName] ?? 1.0, phase_fraction: 1.0 };
    }

    return { Observer, Equator, Horizon, MoonPhase, Illumination };
})();
