// sky-worker.js — background thread for star / DSO coordinate transforms
// Offloads the per-frame raDecToAltAz loop from the main UI thread.

function localSiderealTime(jd, lon) {
    const T = (jd - 2451545.0) / 36525.0;
    const gst = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
                + 0.000387933 * T * T - (T * T * T) / 38710000.0;
    return ((gst + lon) % 360 + 360) % 360;
}

function raDecToAltAz(raDeg, decDeg, latR, lst) {
    const ha   = (lst - raDeg + 360) % 360;
    const haR  = ha   * Math.PI / 180;
    const decR = decDeg * Math.PI / 180;
    const sinAlt = Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(haR);
    const altR   = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const cosAz  = (Math.sin(decR) - Math.sin(latR) * Math.sin(altR)) / (Math.cos(latR) * Math.cos(altR));
    let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
    if (Math.sin(haR) > 0) az = 360 - az;
    return { alt: altR * 180 / Math.PI, az };
}

self.onmessage = function(e) {
    const { cmd, ras, decs, nStars, lat, lon, jd } = e.data;
    if (cmd !== 'computePositions') return;

    const n    = ras.length;
    const alts = new Float32Array(n);
    const azs  = new Float32Array(n);
    const lst  = localSiderealTime(jd, lon);
    const latR = lat * Math.PI / 180;

    for (let i = 0; i < n; i++) {
        const r = raDecToAltAz(ras[i], decs[i], latR, lst);
        alts[i] = r.alt;
        azs[i]  = r.az;
    }

    self.postMessage({ cmd: 'positions', alts, azs, nStars }, [alts.buffer, azs.buffer]);
};
