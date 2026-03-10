/**
 * skyTime.js — Real-Time Sky State Calculator
 * ══════════════════════════════════════════════════════════════════════
 *
 * Membaca jam lokal pengguna (new Date().getHours()) dan mengembalikan
 * seluruh state langit: fase, blend factor, posisi matahari/bulan,
 * warna langit, dan parameter cahaya untuk wave shader.
 *
 * TIME PHASES:
 * ┌───────────────────────────────────────────────────────────────┐
 * │  00:00 ────── 05:30 ── 06:30 ─────────── 17:30 ── 18:30 ──── 24:00  │
 * │  ◄──── NIGHT ───────► ◄─DAWN─► ◄── DAY ──► ◄─DUSK─► ◄── NIGHT ────► │
 * └───────────────────────────────────────────────────────────────┘
 *
 * TRANSITION WINDOW (1 jam):
 *   Dawn: 05:30–06:30 → blend = (hour - 5.5) → 0..1  (night→day)
 *   Dusk: 17:30–18:30 → blend = (hour - 17.5) → 0..1 (day→night)
 *   Saat blend ∈ (0,1): kedua objek (sun + moon) terlihat,
 *   sky gradient ter-lerp antara dua state.
 *
 * CELESTIAL ARC:
 *   Sun arc:  terbit di timur (scene +X) jam 06:00, puncak jam 12:00,
 *             terbenam di barat (scene -X) jam 18:00.
 *   Moon arc: terbit di timur jam 18:00, puncak jam 00:00,
 *             terbenam di barat jam 06:00.
 *
 *   Rumus arc (bidang XY, Z konstan = −20):
 *     angle  = progress × π          (0=horizon timur, π/2=zenith, π=horizon barat)
 *     x      = cos(angle) × R        (cos(0)=1 → timur/+X)
 *     y      = sin(angle) × R        (sin(π/2)=1 → puncak)
 *
 * SKY GRADIENT COLORS:
 *   5 state × 3 CSS warna (horizon, mid, zenith):
 *     night: #000305 / #010508 / #000203
 *     dawn:  #1a0f2e / #8b4a1f / #e8b86d
 *     day:   #4a9ed1 / #2d6a9f / #1a3a5c
 *     dusk:  #d4772a / #8b4510 / #1a0a2d
 *     (intermediate values computed via lerp in getSkyGradient)
 *
 * EXPORT:
 *   getSkyState()       → SkyState object (lihat tipe di bawah)
 *   getSkyGradient()    → CSS gradient string
 *   SKY_PHASE           → enum konstanta fase
 *   CELESTIAL_ARC_R     → radius arc (world units)
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Radius busur arc langit dalam Three.js world units */
export const CELESTIAL_ARC_R = 22;

/** Depth (Z) posisi objek langit — jauh di belakang wave */
export const CELESTIAL_Z = -20;

/** Batas jam transisi (dalam decimal hours) */
const DAWN_START = 5.5; /* 05:30 AM */
const DAWN_END = 6.5; /* 06:30 AM */
const DUSK_START = 17.5; /* 05:30 PM */
const DUSK_END = 18.5; /* 06:30 PM */

/** Enum fase langit — gunakan ini sebagai konstanta di seluruh app */
export const SKY_PHASE = Object.freeze({
  NIGHT: "night",
  DAWN: "dawn",
  DAY: "day",
  DUSK: "dusk",
});

// ─────────────────────────────────────────────────────────────────────────────
// SKY COLOR PALETTES
// Setiap entry: [horizon, mid-sky, zenith] dalam format hex string.
// Horizon = warna di garis cakrawala, zenith = warna langsung di atas kepala.
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  /* Malam: hitam sangat gelap dengan hint biru-navy */
  night: {
    horizon: [0.003, 0.012, 0.025] /* #000C1A — midnight navy   */,
    mid: [0.002, 0.008, 0.018] /* #000412 — deep navy       */,
    zenith: [0.001, 0.004, 0.012] /* #00010B — near-black      */,
    fog: [0.004, 0.01, 0.02] /* Scene fog color           */,
  },
  /* Subuh: ungu-oranye gradient saat matahari mau terbit */
  dawn: {
    horizon: [0.91, 0.471, 0.129] /* #E87821 — oranye horizon  */,
    mid: [0.545, 0.29, 0.122] /* #8B4A1F — coklat-ungu     */,
    zenith: [0.102, 0.059, 0.18] /* #1A0F2E — ungu gelap      */,
    fog: [0.3, 0.18, 0.08],
  },
  /* Siang: biru cerah langit bersih */
  day: {
    horizon: [0.529, 0.808, 0.922] /* #87CEE9 — biru muda/cyan  */,
    mid: [0.176, 0.416, 0.62] /* #2D6A9E — biru medium     */,
    zenith: [0.102, 0.227, 0.361] /* #1A3A5C — biru gelap      */,
    fog: [0.35, 0.55, 0.7],
  },
  /* Senja: oranye-merah sebelum gelap */
  dusk: {
    horizon: [0.831, 0.467, 0.165] /* #D4772A — oranye senja    */,
    mid: [0.545, 0.271, 0.063] /* #8B4510 — coklat-merah    */,
    zenith: [0.102, 0.039, 0.176] /* #1A0A2D — ungu gelap      */,
    fog: [0.28, 0.15, 0.05],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linear interpolation antara dua nilai.
 * @param {number} a
 * @param {number} b
 * @param {number} t — 0..1
 */
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Lerp antara dua warna (array [r,g,b] float 0..1).
 * @param {number[]} ca — warna awal [r,g,b]
 * @param {number[]} cb — warna tujuan [r,g,b]
 * @param {number}   t  — 0..1
 * @returns {number[]} — warna hasil [r,g,b]
 */
const lerpColor = (ca, cb, t) => [
  lerp(ca[0], cb[0], t),
  lerp(ca[1], cb[1], t),
  lerp(ca[2], cb[2], t),
];

/**
 * Konversi float array [r,g,b] ke CSS hex string "#RRGGBB".
 * @param {number[]} c — [r,g,b] dalam range 0..1
 * @returns {string}
 */
const toHex = (c) => {
  const r = Math.round(Math.min(1, Math.max(0, c[0])) * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(Math.min(1, Math.max(0, c[1])) * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(Math.min(1, Math.max(0, c[2])) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
};

/**
 * Konversi float array [r,g,b] ke THREE.Color-compatible {r,g,b} object.
 * Digunakan untuk meng-update THREE.Color.setRGB() dari palette data.
 */
export const toThreeColor = (c) => ({ r: c[0], g: c[1], b: c[2] });

/**
 * Smoothstep: interpolasi cubic 0..1 dengan ease di kedua ujung.
 * Lebih natural dari linear untuk transisi langit.
 */
const smoothstep = (t) => t * t * (3 - 2 * t);

// ─────────────────────────────────────────────────────────────────────────────
// CELESTIAL POSITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hitung posisi matahari di langit berdasarkan jam.
 *
 * Arc sun: terbit timur (06:00) → zenith (12:00) → terbenam barat (18:00).
 * Di luar jam itu, matahari di bawah horizon (y negatif), tidak perlu ditampilkan.
 *
 * Rumus:
 *   progress  = (hour - 6) / 12        → 0 saat 06:00, 1 saat 18:00
 *   arcAngle  = progress × π           → 0..π
 *   x         = cos(arcAngle) × R      → +R (timur) → 0 → -R (barat)
 *   y         = sin(arcAngle) × R      → 0 → +R (zenith) → 0
 *   z         = CELESTIAL_Z            → konstan, jauh di belakang
 *
 * @param {number} hour — decimal hour 0..24
 * @returns {{ x: number, y: number, z: number, visible: boolean }}
 */
export function getSunPosition(hour) {
  const progress = (hour - 6) / 12; /* 0=sunrise, 0.5=noon, 1=sunset */
  const arcAngle = progress * Math.PI;
  const R = CELESTIAL_ARC_R;

  return {
    x: Math.cos(arcAngle) * R /* east(+) → west(-) */,
    y: Math.sin(arcAngle) * R * 0.85 /* 0.85 = sedikit tidak sampai zenith */,
    z: CELESTIAL_Z,
    visible:
      progress >= -0.05 && progress <= 1.05 /* sedikit toleransi di horizon */,
  };
}

/**
 * Hitung posisi bulan di langit berdasarkan jam.
 *
 * Moon arc: berlawanan dengan matahari.
 * Terbit timur 18:00 → zenith 00:00 → terbenam barat 06:00.
 *
 * Untuk menghitung nightProgress:
 *   - Jam 18:00..24:00 → nightHour = hour - 18
 *   - Jam 00:00..06:00 → nightHour = hour + 6
 *   nightProgress = nightHour / 12  (0=terbit, 0.5=puncak, 1=terbenam)
 *
 * @param {number} hour — decimal hour 0..24
 * @returns {{ x: number, y: number, z: number, visible: boolean }}
 */
export function getMoonPosition(hour) {
  const nightHour = hour >= 18 ? hour - 18 : hour + 6;
  const progress = nightHour / 12;
  const arcAngle = progress * Math.PI;
  const R = CELESTIAL_ARC_R;

  return {
    x: Math.cos(arcAngle) * R /* east(+) → west(-) */,
    y: Math.sin(arcAngle) * R * 0.85,
    z: CELESTIAL_Z,
    visible: progress >= 0 && progress <= 1,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: getSkyState()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mengembalikan seluruh sky state berdasarkan waktu saat ini.
 * Dipanggil setiap frame dari rAF loop (sangat cepat — hanya Date + math).
 *
 * @param {Date} [date] — opsional, default = new Date()
 *
 * @returns {SkyState} object dengan field:
 *   phase        {string}    — "night"|"dawn"|"day"|"dusk"
 *   dayBlend     {number}    — 0=night, 1=day (untuk shader uniform)
 *   transBlend   {number}    — 0..1 di dalam transition window (dawn/dusk)
 *   sunPos       {object}    — {x, y, z, visible}
 *   moonPos      {object}    — {x, y, z, visible}
 *
 *   sunAlpha     {number}    — opacity objek matahari 0..1
 *   moonAlpha    {number}    — opacity objek bulan 0..1
 *
 *   horizColor   {number[]}  — [r,g,b] warna horizon langit (blended)
 *   midColor     {number[]}  — [r,g,b] warna mid-sky (blended)
 *   zenithColor  {number[]}  — [r,g,b] warna zenith (blended)
 *   fogColor     {number[]}  — [r,g,b] warna fog scene
 *
 *   lightPos     {object}    — {x,y,z} posisi primary light (sun atau moon)
 *   lightColor   {number[]}  — [r,g,b] warna primary light
 *   lightIntensity {number}  — intensitas primary light (base, tanpa scroll mult)
 *   ambientColor {number[]}  — [r,g,b] warna ambient light scene
 *   ambientInt   {number}    — intensitas ambient
 */
export function getSkyState(date = new Date()) {
  /* Waktu dalam decimal hours: 14.50 = 14:30 (2:30 PM) */
  const hour =
    date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;

  /* ── Tentukan fase dan blend factor ─────────────────────────────────── */
  let phase, dayBlend, transBlend;

  if (hour >= DAWN_END && hour < DUSK_START) {
    /* ── FULL DAY (06:30 – 17:30) ────────────────────────────────────── */
    phase = SKY_PHASE.DAY;
    dayBlend = 1.0;
    transBlend = 0.0;
  } else if (hour >= DAWN_START && hour < DAWN_END) {
    /* ── DAWN TRANSITION (05:30 – 06:30) ─────────────────────────────── */
    phase = SKY_PHASE.DAWN;
    transBlend = (hour - DAWN_START) / (DAWN_END - DAWN_START); /* 0..1  */
    /* Smoothstep untuk transisi yang lebih natural (ease-in-out)        */
    dayBlend = smoothstep(transBlend);
  } else if (hour >= DUSK_START && hour < DUSK_END) {
    /* ── DUSK TRANSITION (17:30 – 18:30) ─────────────────────────────── */
    phase = SKY_PHASE.DUSK;
    transBlend = (hour - DUSK_START) / (DUSK_END - DUSK_START); /* 0..1  */
    dayBlend = smoothstep(1.0 - transBlend); /* day→night: 1→0        */
  } else {
    /* ── FULL NIGHT (18:30 – 05:30) ──────────────────────────────────── */
    phase = SKY_PHASE.NIGHT;
    dayBlend = 0.0;
    transBlend = 0.0;
  }

  /* ── Posisi matahari dan bulan ───────────────────────────────────────── */
  const sunPos = getSunPosition(hour);
  const moonPos = getMoonPosition(hour);

  /* ── Opacity objek langit ────────────────────────────────────────────── */
  /* Sun:  terlihat penuh saat day, fade in/out saat dawn/dusk             */
  /* Moon: terlihat penuh saat night, fade in/out saat dusk/dawn           */
  let sunAlpha, moonAlpha;

  if (phase === SKY_PHASE.DAY) {
    sunAlpha = 1.0;
    moonAlpha = 0.0;
  } else if (phase === SKY_PHASE.NIGHT) {
    sunAlpha = 0.0;
    moonAlpha = 1.0;
  } else if (phase === SKY_PHASE.DAWN) {
    /* Dawn: matahari fade-in (0→1), bulan fade-out (1→0) */
    sunAlpha = smoothstep(transBlend);
    moonAlpha = 1.0 - smoothstep(transBlend);
  } else {
    /* Dusk: matahari fade-out (1→0), bulan fade-in (0→1) */
    sunAlpha = 1.0 - smoothstep(transBlend);
    moonAlpha = smoothstep(transBlend);
  }

  /* ── Sky colors: lerp antara palette berdasarkan phase ──────────────── */
  /* Tentukan dua palette yang di-blend: fromPalette dan toPalette         */
  let fromPal, toPal, t;

  if (phase === SKY_PHASE.DAWN) {
    /* Dawn: lerp dari night ke day via intermediate dawn colors           */
    /* t < 0.5: night → dawn; t > 0.5: dawn → day                         */
    if (transBlend < 0.5) {
      fromPal = PALETTE.night;
      toPal = PALETTE.dawn;
      t = transBlend * 2;
    } else {
      fromPal = PALETTE.dawn;
      toPal = PALETTE.day;
      t = (transBlend - 0.5) * 2;
    }
  } else if (phase === SKY_PHASE.DUSK) {
    /* Dusk: lerp dari day ke night via intermediate dusk colors           */
    if (transBlend < 0.5) {
      fromPal = PALETTE.day;
      toPal = PALETTE.dusk;
      t = transBlend * 2;
    } else {
      fromPal = PALETTE.dusk;
      toPal = PALETTE.night;
      t = (transBlend - 0.5) * 2;
    }
  } else if (phase === SKY_PHASE.DAY) {
    fromPal = toPal = PALETTE.day;
    t = 0;
  } else {
    fromPal = toPal = PALETTE.night;
    t = 0;
  }

  const blendT = smoothstep(t);
  const horizColor = lerpColor(fromPal.horizon, toPal.horizon, blendT);
  const midColor = lerpColor(fromPal.mid, toPal.mid, blendT);
  const zenithColor = lerpColor(fromPal.zenith, toPal.zenith, blendT);
  const fogColor = lerpColor(fromPal.fog, toPal.fog, blendT);

  /* ── Primary light: sun (siang) atau moon (malam) ────────────────────── */
  /* Posisi light mengikuti dominant celestial object                       */
  const useSun = dayBlend >= 0.5;
  const lightPos = useSun ? sunPos : moonPos;

  /* Warna light:
   *   Sun:  warm white-yellow (#fffae8 di siang, oranye di dawn/dusk)
   *   Moon: cool white dengan hint blue-green (#bbd5aa atau #d0e0ff)     */
  const sunLightColor = lerpColor(
    [1.0, 0.7, 0.28] /* dawn/dusk: oranye hangat   */,
    [1.0, 0.97, 0.88] /* noon: putih kekuningan      */,
    Math.sin(((hour - 6) / 12) * Math.PI) /* paling putih di tengah hari */,
  );
  const moonLightColor = [0.73, 0.84, 0.67]; /* #BACF55 green-white bulan */

  const lightColor = lerpColor(moonLightColor, sunLightColor, dayBlend);

  /* Intensitas light: lebih terang di siang, lebih lemah di malam         */
  const baseSunInt = 14.0;
  const baseMoonInt = 6.0;
  const lightIntensity = lerp(baseMoonInt, baseSunInt, dayBlend);

  /* Ambient: sedikit lebih terang di siang */
  const ambientColor = lerpColor(
    [0.02, 0.032, 0.028] /* night ambient: very dark */,
    [0.055, 0.082, 0.095] /* day ambient: pale sky    */,
    dayBlend,
  );
  const ambientInt = lerp(1.5, 3.5, dayBlend);

  return {
    phase,
    dayBlend,
    transBlend,
    sunPos,
    moonPos,
    sunAlpha,
    moonAlpha,
    horizColor,
    midColor,
    zenithColor,
    fogColor,
    lightPos,
    lightColor,
    lightIntensity,
    ambientColor,
    ambientInt,
    hour /* expose hour untuk debug/display */,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS GRADIENT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menghasilkan CSS gradient string dari SkyState.
 * Digunakan untuk update background sticky div Hero.
 *
 * @param {object} state — hasil dari getSkyState()
 * @returns {string} — CSS linear-gradient string
 */
export function getSkyGradient(state) {
  const h = toHex(state.horizColor);
  const m = toHex(state.midColor);
  const z = toHex(state.zenithColor);
  return `linear-gradient(180deg, ${z} 0%, ${m} 45%, ${h} 100%)`;
}

/**
 * Mengembalikan label waktu yang bisa ditampilkan di UI.
 * @param {object} state
 * @returns {string}
 */
export function getSkyLabel(state) {
  const h = Math.floor(state.hour);
  const m = Math.floor((state.hour % 1) * 60)
    .toString()
    .padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default getSkyState;
