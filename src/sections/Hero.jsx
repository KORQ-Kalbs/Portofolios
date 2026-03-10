/**
 * Hero.jsx — Zone-Shift Ocean: Water-Like PBR Shader
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ARSITEKTUR KESELURUHAN:
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │  Night Sky (THREE.Points, 2500 stars, per-star twinkle shader)            │
 * │  Crescent Moon (SphereGeometry × 2 trick) + PointLight                   │
 * │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Surface shimmer (CSS) ─ ─ ─ ─ ─ ─ ─ ─        │
 * │                                                                           │
 * │  HTML CONTENT (z:3) — naik saat scroll                                   │
 * │     I BUILD  /  DIGITAL  /  THINGS.                                      │
 * │                                                                           │
 * │  ═══ WAVE CANVAS (z:4) — Three.js WebGLRenderer, alpha:true ═══          │
 * │                                                                           │
 * │  scroll = 0.0  →  SURFACE ZONE: laut flat, teal/cyan tenang             │
 * │  scroll = 0.3  →  Wave mulai naik, barrel forming                        │
 * │  scroll = 0.5  →  BARREL PEAK: arch di atas teks, PBR highlight          │
 * │  scroll = 0.7  →  Wave crash, foam burst, TWILIGHT ZONE tints            │
 * │  scroll = 1.0  →  ABYSS ZONE: charcoal-black, deep-sea biolum           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * MARINE COLOR ZONES (dikontrol uZone 0→1→2):
 *   Surface Zone (uZone 0..1): Teal → Midnight Cyan
 *     Warna: #0a4a5a → #062845 → #031830
 *   Twilight Zone (uZone 1..2): Midnight Blue → Deep Charcoal
 *     Warna: #031830 → #05101a → #080d12
 *   Abyss Zone (uZone 2..3): Charcoal → Pure Black
 *     Warna: #080d12 → #04080d → #010203
 *
 * VERTEX SHADER — 3 displacement layers:
 *   1. Barrel Arc (circular cross-section, scroll-driven, CPU-defined radius)
 *   2. Gerstner Waves (4 trains, physics-based trochoid, ambient)
 *   3. fBm Surface Noise (6 octaves, layered, independen dari scroll)
 *      → small ripples yang terus bergerak di atas barrel shape
 *      → memberikan feel "air nyata" vs "plastik"
 *
 * FRAGMENT SHADER — Water-Like PBR:
 *   A. Derivative Normal Map: dPdx/dPdy untuk reconstruct normal dari noise
 *      → detail mikro-permukaan air tanpa texture lookup
 *   B. PBR Lighting:
 *      - Fresnel (Schlick): air lebih reflektif di sudut grazing
 *      - Specular (GGX/Cook-Torrance approx): highlight lembut di permukaan
 *      - SSS: cahaya menembus dari dalam barrel (backlit glow)
 *   C. Marine Zone Color: smooth gradient antar zona berdasarkan uZone
 *   D. Normal-mapped reflections dari env map simulasi (procedural sky color)
 *   E. Deep-sea Bioluminescence: FBM warped, sangat subtle di abyss zone
 *   F. Caustic pattern (layered sin) — lebih aktif di surface zone
 *   G. Foam (animated UV noise) — di crest/lip
 *   H. Alpha: opaque body, semi-transparent lip
 *
 * BLANK GAP FIX: CSS position:sticky bukan GSAP pin.
 * EVENT BUS: emitScrollProgress("hero", p) → App.jsx handle BubbleBg fade.
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  smoothScrollTo,
  emitScrollProgress,
  SCROLL_MILESTONES as SM,
} from "../utils/gsapConfig";

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_LINES = ["I BUILD", "DIGITAL", "THINGS."];
const TAGS = ["React", "Node.js", "PHP", "Laravel", "Tailwind", "MySQL"];

// ─────────────────────────────────────────────────────────────────────────────
// ── VERTEX SHADER ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
/**
 * VERTEX SHADER — 3 Layer Displacement
 *
 * Layer 1: BARREL ARC
 *   Circular cross-section formula:
 *     θ       = ny × totalAngle     (ny = normalized height 0..1)
 *     yWorld  = R × sin(θ)          (vertex naik seiring θ)
 *     zWorld  = R × (1−cos(θ))      (vertex curl ke depan)
 *   R dan totalAngle dikontrol oleh uScroll.
 *
 * Layer 2: GERSTNER WAVES (4 trains)
 *   Trochoid = orbit sirkular partikel air.
 *   Lebih realistis dari simple sine: crest tajam, trough landai.
 *   gScale dikecilkan saat barrel forming agar tidak merusak arc.
 *
 * Layer 3: fBm SURFACE NOISE
 *   6-octave Fractal Brownian Motion berdasarkan posisi XZ + uTime.
 *   Amplitude sangat kecil (0.08–0.25) → micro ripples di permukaan.
 *   Frekuensi tinggi → detail halus seperti air nyata.
 *   Independent dari scroll: terus bergerak bahkan saat tidak scroll.
 *
 * VARYING output ke fragment:
 *   vUv, vNy, vWorldNormal, vWorldPos, vFoamMask,
 *   vNoiseVal  (FBM value untuk normal map di fragment)
 *   vZoneDepth (0..3 = Surface/Twilight/Abyss, berubah seiring scroll)
 */
const VERTEX_SHADER = /* glsl */ `
  precision highp float;

  /* ── Uniforms (di-set dari JavaScript setiap frame) ─────────────────── */
  uniform float uTime;    /* elapsed seconds — driver animasi ambient */
  uniform float uScroll;  /* lerped scroll progress 0..1              */

  /* ── Varyings (dikirim ke fragment shader) ───────────────────────────── */
  varying vec2  vUv;
  varying float vNy;          /* normalized height 0=bottom, 1=top       */
  varying vec3  vWorldNormal; /* surface normal di world space            */
  varying vec3  vWorldPos;    /* world position vertex                    */
  varying float vFoamMask;    /* 1 di area crest/lip (untuk foam color)  */
  varying float vNoiseVal;    /* raw FBM value untuk derivative normal    */
  varying float vZoneDepth;   /* 0=surface, 1=twilight, 2=abyss zone     */
  varying float vCurlDepth;   /* 0..1 seberapa jauh di dalam barrel      */

  #define PI      3.14159265358979
  #define TWO_PI  6.28318530717959

  /* ════════════════════════════════════════════════════════════════════════
   * HASH & NOISE UTILITIES
   * Diperlukan untuk fBm surface ripple layer.
   * Hash: deterministic pseudo-random float dari vec2 input.
   * gradient2: 2D gradient noise (lebih halus dari value noise).
   * ════════════════════════════════════════════════════════════════════════ */

  /* Hash sederhana: diperlukan untuk noise base */
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  /* 2D Gradient noise (Perlin-like).
   * Lebih smooth dari value noise: menggunakan gradient acak per cell.
   * Hasil: [-0.5, +0.5] (berbeda dari value noise yang [0,1]).
   *
   * Teknik: generate gradient vektor acak di setiap corner integer,
   * lalu interpolasi dot(gradient, offset) dengan cubic Hermite. */
  float gradientNoise(vec2 p) {
    vec2  i  = floor(p);
    vec2  f  = fract(p);
    vec2  u  = f * f * (3.0 - 2.0 * f);  /* cubic Hermite smoothing */

    /* Pseudo-random gradient angle per corner */
    float a = hash21(i + vec2(0.0, 0.0));
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    /* Convert hash [0,1] ke angle, compute gradient */
    vec2 ga = vec2(cos(a * TWO_PI), sin(a * TWO_PI));
    vec2 gb = vec2(cos(b * TWO_PI), sin(b * TWO_PI));
    vec2 gc = vec2(cos(c * TWO_PI), sin(c * TWO_PI));
    vec2 gd = vec2(cos(d * TWO_PI), sin(d * TWO_PI));

    /* dot(gradient, offset from corner) di setiap corner */
    float va = dot(ga, f - vec2(0.0, 0.0));
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));

    return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
  }

  /* fBm (Fractional Brownian Motion) — 6 octaves.
   * Setiap oktave: frekuensi × 2.1 (lacunarity), amplitudo × 0.48 (gain).
   * Lacunarity 2.1 (bukan 2.0) → slight anisotropy → lebih organik.
   * Gain 0.48 (bukan 0.5) → high-freq detail tidak dominan.
   * Hasil: pola fractal multi-skala seperti permukaan air sungguhan.
   *
   * @param p   : posisi 2D (biasanya XZ dalam world space + time offset)
   * @param oct : jumlah oktave (6 = detail halus, tidak terlalu mahal)
   * @returns   : value [-1, +1] (gradient noise di-sum)             */
  float fbm(vec2 p, int oct) {
    float value = 0.0;
    float amp   = 0.5;
    float freq  = 1.0;
    /* Unroll loop — GLSL ES 1.00 tidak support dynamic loop index */
    value += gradientNoise(p * freq) * amp; freq *= 2.1; amp *= 0.48;
    value += gradientNoise(p * freq) * amp; freq *= 2.1; amp *= 0.48;
    value += gradientNoise(p * freq) * amp; freq *= 2.1; amp *= 0.48;
    value += gradientNoise(p * freq) * amp; freq *= 2.1; amp *= 0.48;
    value += gradientNoise(p * freq) * amp; freq *= 2.1; amp *= 0.48;
    value += gradientNoise(p * freq) * amp;
    return value;
  }

  /* ════════════════════════════════════════════════════════════════════════
   * GERSTNER WAVE (1 train)
   * Trochoid wave model — partikel bergerak dalam orbit sirkular.
   * Lebih realistis dari sine: crest lebih tajam, trough lebih landai.
   *
   * @param pos       : XZ world position
   * @param dir       : normalized wave direction vec2
   * @param steepness : Q factor (0=sine, 1=max trochoid, >1=loops/invalid)
   * @param wavelength: λ dalam world units
   * @param speed     : multiplier phase velocity c=√(g/k)
   * @param t         : uTime
   * @returns         : vec3(Δx, Δy, Δz) displacement                   */
  vec3 gerstner(vec2 pos, vec2 dir, float steepness, float lambda, float speed, float t) {
    float k   = TWO_PI / lambda;
    float c   = sqrt(9.81 / k) * speed;   /* phase velocity deep water */
    float phi = k * dot(dir, pos) - c * t;
    float A   = steepness / k;             /* amplitude dari Q          */
    return vec3(
      dir.x * A * cos(phi),  /* horizontal displacement along dir     */
      A         * sin(phi),  /* vertical displacement                  */
      dir.y * A * cos(phi)   /* horizontal displacement perp to dir    */
    );
  }

  /* Analytical normal dari satu Gerstner wave.
   * Lebih akurat daripada finite-difference (tidak butuh neighbor vertex). */
  vec3 gerstnerNormal(vec2 pos, vec2 dir, float Q, float lambda, float speed, float t) {
    float k   = TWO_PI / lambda;
    float c   = sqrt(9.81 / k) * speed;
    float phi = k * dot(dir, pos) - c * t;
    float WA  = Q * cos(phi);
    return vec3(-dir.x * WA, 1.0 - Q * sin(phi), -dir.y * WA);
  }

  void main() {
    vUv = uv;

    /* ── Normalized height ──────────────────────────────────────────────────
     * PlaneGeometry(24, 18): height=18, y ∈ [-9, +9].
     * ny=0 di dasar, ny=1 di puncak geometri.                           */
    float halfH = 9.0;
    float ny    = clamp((position.y + halfH) / (halfH * 2.0), 0.0, 1.0);
    vNy         = ny;

    vec3 pos = position;   /* posisi lokal yang akan kita modifikasi */

    /* ════════════════════════════════════════════════════════════════════
     * LAYER 1: BARREL ARC (Circular Cross-Section)
     * ════════════════════════════════════════════════════════════════════
     *
     * Side view (YZ plane), cross-section pada scroll=0.5:
     *
     *            LIP (curl ke +Z)
     *           ╔══════╗
     *          ╔╝ TUBE ╚╗   ← hollow inside barrel
     *         ╔╝         ╚╗
     * ════════╝             ╚════════   ← water level
     *
     * Formula:
     *   R        = radius barrel (tumbuh → max → menyusut seiring scroll)
     *   θ        = ny × totalAngle   (mapping: bottom=0, top=totalAngle)
     *   yWorld   = R × sin(θ)        (naik seiring θ bertambah)
     *   zWorld   = R × (1−cos(θ))    (curl ke depan: 0 di bawah, max di atas)
     *
     * approachZ: wave bergerak mendekat dari Z=-5 (jauh) ke Z=+5 (past cam)
     * "Teks di Z=0": titik tengah pendekatan → saat wave ada di Z≈0,
     * dia menutupi seluruh viewport.                                    */

    /* Radius: tumbuh saat rise phase (0→55%), menyusut saat crash (55%→100%) */
    float riseP  = smoothstep(0.00, 0.55, uScroll);
    float crashP = smoothstep(0.55, 1.00, uScroll);
    float barrelR = (uScroll < 0.55)
                  ? mix(0.15, 8.2, riseP)      /* rising: 0.15 → 8.2   */
                  : mix(8.2,  0.2, crashP);     /* crashing: 8.2 → 0.2  */

    /* totalAngle: 0 (flat) → ~1.95π (fully crashed) */
    float totalAngle = uScroll * PI * 1.95;
    float theta      = ny * totalAngle;

    /* Terapkan barrel arc: ganti Y dan Z vertex */
    pos.y = barrelR * sin(theta);
    float approachZ = mix(-5.0, 5.0, uScroll);
    pos.z = barrelR * (1.0 - cos(theta)) + approachZ;

    /* ════════════════════════════════════════════════════════════════════
     * LAYER 2: GERSTNER WAVES (4 trains)
     * ════════════════════════════════════════════════════════════════════
     * Memberikan bentuk gelombang yang physics-based di X direction.
     * gScale dikecilkan saat barrel forming agar tidak mengganggu arc.
     * Diaplikasikan di X (chop horizontal) + sebagian kecil di Y/Z.   */

    /* Skala Gerstner: full saat calm, dikecilkan saat barrel (scroll>0.4) */
    float gScale = 0.24 * (1.0 - smoothstep(0.40, 0.78, uScroll) * 0.82);
    vec2  xzIn   = vec2(position.x, 0.0);  /* input XZ sebelum barrel  */

    vec3 g1 = gerstner(xzIn, normalize(vec2( 1.0,  0.18)), 0.33, 8.8,  0.94, uTime) * gScale;
    vec3 g2 = gerstner(xzIn, normalize(vec2( 0.28, 1.00)), 0.21, 5.4,  0.81, uTime) * gScale * 0.70;
    vec3 g3 = gerstner(xzIn, normalize(vec2(-0.50, 0.80)), 0.16, 3.1,  1.16, uTime) * gScale * 0.50;
    vec3 g4 = gerstner(xzIn, normalize(vec2( 0.80,-0.42)), 0.09, 1.7,  1.42, uTime) * gScale * 0.32;

    /* Tambahkan Gerstner ke X (dominan), sedikit ke Y dan Z */
    pos.x += g1.x + g2.x + g3.x + g4.x;
    pos.y += (g1.y + g2.y) * 0.30 * (1.0 - smoothstep(0.5, 0.9, ny));
    pos.z += (g1.z + g2.z) * 0.18 * (1.0 - smoothstep(0.6, 1.0, ny));

    /* ════════════════════════════════════════════════════════════════════
     * LAYER 3: fBm SURFACE NOISE (micro-ripples)
     * ════════════════════════════════════════════════════════════════════
     * 6-octave FBM berdasarkan XZ position + time offset.
     * Ini yang memberikan "water-like texture" — tidak plastik.
     * Bergerak independent dari scroll (selalu animasi, bahkan saat diam).
     *
     * Sampling position: UV space (0..1) scaled ke range yang baik.
     * Time offset berbeda di X dan Y → pola bergerak diagonal.
     *
     * Amplitude fbmAmp:
     *   - Kecil di dasar (tidak perlu ripple di bawah)
     *   - Medium di body
     *   - Kecil di crest (crest area dikontrol barrel, bukan noise)
     * Ini menjaga lip barrel tetap bersih.                             */

    /* Koordinat noise: scaled UV + time drift */
    vec2 noiseCoord = vUv * 5.5
                    + vec2(uTime * 0.095, uTime * -0.072);

    /* FBM value: dipakai untuk vertex Z displacement DAN dikirim ke fragment
     * via vNoiseVal untuk reconstruct normal map                       */
    float noiseZ  = fbm(noiseCoord, 6);          /* range ≈ [-0.9, +0.9] */
    vNoiseVal     = noiseZ;                       /* bawa ke fragment     */

    /* Spatial amplitude mask: 0 di bawah/atas, 1 di tengah body */
    float noiseMask  = smoothstep(0.05, 0.30, ny) * (1.0 - smoothstep(0.72, 0.96, ny));
    /* Tambahan: lebih kecil saat barrel fully formed (0.5+) agar tidak distort */
    float noiseScroll = 1.0 - smoothstep(0.45, 0.75, uScroll) * 0.70;
    float fbmAmp     = 0.18 * noiseMask * noiseScroll;

    /* Terapkan noise hanya di Z (depth ripple, tidak X/Y agar barrel bersih) */
    pos.z += noiseZ * fbmAmp;

    /* ════════════════════════════════════════════════════════════════════
     * VARYINGS CALCULATION
     * ════════════════════════════════════════════════════════════════════ */

    /* Foam mask: 1 di area crest/lip θ ∈ [0.40π, 1.10π] */
    vFoamMask = smoothstep(PI*0.38, PI*0.42, theta)
              * (1.0 - smoothstep(PI*1.08, PI*1.14, theta));

    /* Curl depth: seberapa dalam vertex berada di dalam barrel arc
     * Dipakai di fragment untuk SSS dan biolum intensity             */
    vCurlDepth = smoothstep(PI*0.30, PI*0.88, theta)
               * (1.0 - smoothstep(PI*0.88, PI*1.32, theta));

    /* Zone depth: berapa "dalam" zona ocean yang sedang digambar
     * 0=Surface, 1=Twilight, 2=Abyss
     * Dikombinasikan dari scroll progress dan vertex height:
     *   - Saat scroll rendah: semua vertex di Surface Zone
     *   - Saat scroll tinggi: vertex bawah (ny kecil) makin dalam       */
    float scrollDepth  = uScroll * 2.2;           /* 0 → 2.2 saat scroll */
    float vertexDepth  = (1.0 - ny) * 0.55;       /* dasar vertex lebih dalam */
    vZoneDepth = clamp(scrollDepth + vertexDepth, 0.0, 2.5);

    /* ── Surface normal ─────────────────────────────────────────────────── */
    /* Normal dari barrel arc + Gerstner contribution */
    vec3 arcNormal = normalize(vec3(0.0, sin(theta), -cos(theta)));
    vec3 gN1 = gerstnerNormal(xzIn, normalize(vec2(1.0, 0.18)), 0.33, 8.8, 0.94, uTime) * gScale * 0.35;
    vec3 gN2 = gerstnerNormal(xzIn, normalize(vec2(0.28, 1.0)), 0.21, 5.4, 0.81, uTime) * gScale * 0.25;
    /* FBM perturbs normal slightly (micro surface detail) */
    vec3 noiseNorm = normalize(arcNormal + vec3(noiseZ*0.08, noiseZ*0.05, 0.0));
    vec3 combined  = normalize(noiseNorm + gN1 * 0.28 + gN2 * 0.18);
    vWorldNormal   = normalize(mat3(modelMatrix) * combined);

    /* World position untuk lighting di fragment */
    vec4 wp4    = modelMatrix * vec4(pos, 1.0);
    vWorldPos   = wp4.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp4;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// ── FRAGMENT SHADER ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
/**
 * FRAGMENT SHADER — Water-Like PBR
 *
 * LAYER PIPELINE:
 *   A. Derivative Normal Map  → mikro-surface normal dari noise gradient
 *   B. Marine Zone Color      → Surface/Twilight/Abyss gradient
 *   C. PBR Lighting           → Fresnel + GGX Specular + SSS
 *   D. Environment Reflection → procedural sky/night reflection
 *   E. Caustic Pattern        → layered sin, lebih aktif di surface zone
 *   F. Bioluminescence        → FBM warped, subtle di abyss
 *   G. Foam at Crest          → animated UV noise, hanya di vFoamMask
 *   H. Alpha blending         → opaque body, semi-transparent lip
 *
 * KEY UNIFORMS (dari JS):
 *   uTime, uScroll, uZone,      — animasi & zone control
 *   uCameraPos, uMoonPos,        — untuk lighting
 *   uMoonColor, uMoonIntensity   — intensitas bulan berubah seiring scroll
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  /* ── Uniforms ─────────────────────────────────────────────────────────── */
  uniform float uTime;
  uniform float uScroll;
  uniform float uZone;           /* 0=surface, 1=twilight, 2=abyss       */
  uniform float uBiolumIntensity;/* 0 (calm) → 1 (crash)                 */
  uniform vec3  uCameraPos;
  uniform vec3  uMoonPos;
  uniform vec3  uMoonColor;
  uniform float uMoonIntensity;

  /* ── Varyings dari vertex shader ─────────────────────────────────────── */
  varying vec2  vUv;
  varying float vNy;
  varying vec3  vWorldNormal;
  varying vec3  vWorldPos;
  varying float vFoamMask;
  varying float vNoiseVal;      /* raw FBM value untuk derivative normal   */
  varying float vZoneDepth;
  varying float vCurlDepth;

  #define PI 3.14159265358979

  /* ════════════════════════════════════════════════════════════════════════
   * HASH & NOISE (dibutuhkan untuk derivative normal + biolum)
   * Harus re-deklarasi di fragment shader (tidak shared dengan vertex).
   * ════════════════════════════════════════════════════════════════════════ */

  float hashF(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  /* Value noise (lebih murah dari gradient noise untuk fragment use) */
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hashF(i), hashF(i + vec2(1,0)), u.x),
      mix(hashF(i + vec2(0,1)), hashF(i + vec2(1,1)), u.x),
      u.y
    );
  }

  /* fBm untuk bioluminescence pattern (4 octave, lebih murah dari vertex) */
  float fbmLight(vec2 p) {
    float v = 0.0, a = 0.5, f = 1.0;
    v += valueNoise(p*f)*a; f*=2.0; a*=0.5;
    v += valueNoise(p*f)*a; f*=2.0; a*=0.5;
    v += valueNoise(p*f)*a; f*=2.0; a*=0.5;
    v += valueNoise(p*f)*a;
    return v;
  }

  /* Warped fBm: domain-warped untuk pola "swirling" lebih organik */
  float warpedFbm(vec2 p) {
    vec2 q = vec2(fbmLight(p), fbmLight(p + vec2(5.2, 1.3)));
    return fbmLight(p + 1.75 * q);
  }

  /* ════════════════════════════════════════════════════════════════════════
   * GGX SPECULAR (Cook-Torrance approximation)
   * Lebih realistis dari Blinn-Phong untuk permukaan air.
   * GGX distribusi memiliki "long tail" → highlight lembut di tepi.
   *
   * @param N : surface normal (normalized)
   * @param V : view direction (normalized)
   * @param L : light direction (normalized)
   * @param roughness : 0=mirror, 1=fully diffuse (air ≈ 0.02–0.08)
   * @returns : specular scalar                                          */
  float ggxSpecular(vec3 N, vec3 V, vec3 L, float roughness) {
    vec3  H    = normalize(V + L);
    float NdH  = max(dot(N, H), 0.0);
    float NdV  = max(dot(N, V), 1e-4);
    float NdL  = max(dot(N, L), 0.0);
    float a    = roughness * roughness;
    float a2   = a * a;
    /* GGX Distribution D */
    float denom = (NdH * NdH * (a2 - 1.0) + 1.0);
    float D     = a2 / (PI * denom * denom);
    /* Smith Geometry G (schlick approx) */
    float k  = roughness * 0.5;
    float G1V = NdV / (NdV * (1.0 - k) + k);
    float G1L = NdL / (NdL * (1.0 - k) + k);
    float G   = G1V * G1L;
    /* Combined (simplified, no π denominator for efficiency) */
    return D * G * NdL;
  }

  /* ════════════════════════════════════════════════════════════════════════
   * MARINE ZONE COLOR FUNCTION
   * Mengembalikan base color berdasarkan uZone (0=surface, 2=abyss)
   * dan vNy (height dalam geometri).
   *
   * Palette:
   *   Surface (0..1): Teal/Cyan — cahaya menembus permukaan
   *     #0d8fa0 → #0a5568 → #062a40
   *   Twilight (1..2): Midnight Blue — cahaya makin redup
   *     #062a40 → #041a2a → #03111c
   *   Abyss (2..3): Charcoal Black — tidak ada cahaya, hanya darkness
   *     #03111c → #020a10 → #010305
   *
   * Setiap zona juga dikombinasikan dengan vNy untuk gradien depth lokal
   * (atas vertex lebih terang dari bawah dalam satu zona yang sama).    */
  vec3 marineZoneColor(float zone, float ny) {
    /* Warna per zona (5 stops total) */
    vec3 cSurf1  = vec3(0.052, 0.562, 0.628);  /* bright teal surface    */
    vec3 cSurf2  = vec3(0.038, 0.336, 0.408);  /* deep teal              */
    vec3 cTwi1   = vec3(0.024, 0.165, 0.250);  /* midnight blue          */
    vec3 cTwi2   = vec3(0.016, 0.088, 0.145);  /* deep midnight          */
    vec3 cAbyss1 = vec3(0.010, 0.048, 0.078);  /* dark charcoal-blue     */
    vec3 cAbyss2 = vec3(0.004, 0.016, 0.028);  /* near-black abyss       */

    /* Height gradient dalam satu zona: atas lebih terang, bawah lebih gelap */
    float ht = smoothstep(0.1, 0.9, ny);  /* 0=bawah, 1=atas              */

    vec3 surface  = mix(cSurf2,  cSurf1,  ht * 0.70 + 0.10);
    vec3 twilight = mix(cTwi2,   cTwi1,   ht * 0.60 + 0.10);
    vec3 abyss    = mix(cAbyss2, cAbyss1, ht * 0.45);

    /* Interpolasi antar zona berdasarkan zone float 0..2 */
    vec3 color;
    if (zone < 1.0) {
      /* Surface → Twilight */
      color = mix(surface, twilight, zone);
    } else {
      /* Twilight → Abyss */
      color = mix(twilight, abyss, zone - 1.0);
    }
    return color;
  }

  void main() {
    /* Surface vectors */
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);

    /* ════════════════════════════════════════════════════════════════════
     * A. DERIVATIVE NORMAL MAP
     * ════════════════════════════════════════════════════════════════════
     * Teknik ini menggunakan dFdx/dFdy (screen-space partial derivatives)
     * dari vNoiseVal (dikirim dari vertex) untuk memperkirakan mikro-normal.
     *
     * dFdx(v): perbedaan v antara pixel ini dan pixel di kanan-nya
     * dFdy(v): perbedaan v antara pixel ini dan pixel di atas-nya
     * Cross product tangent × bitangent → perturbed normal.
     *
     * Ini mensimulasikan normal map tanpa texture lookup:
     * → Detail mikro-surface dari FBM noise langsung di fragment shader.
     * Hasilnya: speculer highlight yang bergerak-gerak seperti air nyata. */

    /* Partial derivatives dari noise value di screen space */
    float dNdx = dFdx(vNoiseVal);  /* gradient horizontal                  */
    float dNdy = dFdy(vNoiseVal);  /* gradient vertikal                     */

    /* Normal perturbation strength:
     * lebih kuat saat calm (detail terlihat jelas di permukaan flat),
     * lebih lemah saat barrel forming (barrel shape sudah dramatic)     */
    float normalStr = mix(0.85, 0.22, smoothstep(0.25, 0.65, uScroll));

    /* Perturb: tambahkan screen-space gradient sebagai normal offset
     * Magnitude kecil (0.18) agar tidak completely flip surface normal */
    vec3 perturbedN = normalize(N + vec3(dNdx * normalStr * 0.18,
                                          dNdy * normalStr * 0.18,
                                          0.0));

    /* ════════════════════════════════════════════════════════════════════
     * B. MARINE ZONE BASE COLOR
     * ════════════════════════════════════════════════════════════════════ */
    /* Zone clamped 0..2 untuk input ke marineZoneColor */
    float zone    = clamp(vZoneDepth, 0.0, 2.0);
    vec3 baseColor = marineZoneColor(zone, vNy);

    /* Sedikit "murkiness" — kekeruhan air: warna menjadi lebih abu-abu
     * di zone dalam (twilight/abyss). Water turbidity simulation.     */
    float turbidity = smoothstep(0.5, 2.0, zone) * 0.30;
    baseColor = mix(baseColor, vec3(0.015, 0.025, 0.035) * 0.8, turbidity);

    /* ════════════════════════════════════════════════════════════════════
     * C. PBR LIGHTING
     * ════════════════════════════════════════════════════════════════════ */

    /* Light direction: moon → vertex */
    vec3 L = normalize(uMoonPos - vWorldPos);

    /* ── Ambient ────────────────────────────────────────────────────────
     * Ambient sangat gelap (malam hari). Sedikit teal tint dari sky.   */
    vec3 ambientColor = vec3(0.010, 0.018, 0.022) * mix(1.0, 0.3, zone * 0.5);
    vec3 color        = baseColor * ambientColor;

    /* ── GGX Diffuse (Lambert) ──────────────────────────────────────────
     * Diffuse pakai perturbed normal untuk detail permukaan air.       */
    float NdL    = max(dot(perturbedN, L), 0.0);
    float NdLraw = max(dot(N, L), 0.0);  /* untuk SSS (tidak di-perturb) */
    vec3 diffuse = baseColor * NdL * uMoonColor * uMoonIntensity * 0.38;

    /* ── GGX Specular (Cook-Torrance) ───────────────────────────────────
     * Roughness air: 0.02 (sangat smooth = mirror-like di calm water).
     * Saat wave forming: sedikit lebih rough karena foam/turbulence.   */
    float roughness = mix(0.025, 0.095, smoothstep(0.25, 0.75, uScroll));
    float spec      = ggxSpecular(perturbedN, V, L, roughness);
    /* Specular color: bulan (cold white) + slight teal dari water refl  */
    vec3  specular  = uMoonColor * spec * uMoonIntensity
                    * mix(2.2, 0.8, zone * 0.5)    /* lebih kuat di surface */
                    * smoothstep(0.1, 0.6, vNy);   /* hanya di atas half    */

    color += diffuse + specular;

    /* ── Fresnel Reflectance (Schlick) ──────────────────────────────────
     * Perhatian: gunakan N biasa (bukan perturbed) untuk Fresnel.
     * F0 air = 0.02 (refleksi 2% pada incidence normal).
     * Pada sudut grazing (edge-on): mendekati 1 (mirror reflection).   */
    float cosT    = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);

    /* ── Environment Reflection (procedural) ───────────────────────────
     * Kita tidak punya HDR env map — simulasikan dengan:
     *   - Surface zone: pantulkan warna langit malam (gelap biru-hijau)
     *   - Twilight: pantulkan bioluminescence (subtle cyan)
     *   - Abyss: nyaris tidak ada refleksi (sangat dalam)              */
    vec3 nightSky   = vec3(0.008, 0.015, 0.022);  /* langit malam         */
    vec3 deepRefl   = vec3(0.004, 0.010, 0.018);  /* refleksi dari dalam  */
    vec3 envColor   = mix(nightSky, deepRefl, clamp(zone, 0.0, 1.0));
    /* Modulate dengan Fresnel: lebih reflektif di tepi (grazing angle)  */
    color += envColor * fresnel * mix(0.65, 0.18, zone * 0.5);

    /* ── Subsurface Scattering (fake SSS) ──────────────────────────────
     * Cahaya menembus barrel: sisi belakang barrel terkena moonlight,
     * cahaya menyebar dalam air, keluar dari sisi depan → backlit glow.
     * Hanya aktif saat barrel forming (scroll > 0.18).                 */
    float backScatter  = max(0.0, -dot(N, L));  /* N berlawanan arah L    */
    float sssProgress  = smoothstep(0.18, 0.52, uScroll);
    /* SSS lebih kuat di area curl dan di surface zone (cahaya menembus) */
    float sssMask      = vCurlDepth * sssProgress * (1.0 - zone * 0.4);
    float sssIntensity = backScatter * sssMask * 0.70;
    /* Warna SSS: mix antara warna zona (teal di surface, biru di twilight)
     * dengan sedikit putih-dingin (transmitted moonlight)               */
    vec3 sssColor = mix(
      baseColor * 1.5 + uMoonColor * 0.3,   /* surface SSS              */
      uMoonColor * 0.15,                     /* deep zone SSS (faint)    */
      clamp(zone, 0.0, 1.0)
    );
    color += sssColor * sssIntensity;

    /* ── God Ray Rim ─────────────────────────────────────────────────────
     * Cahaya bulan menembus barrel → rim glow di tepi curl.
     * Efek "light shining through curling wave" yang iconic.            */
    float rimFactor = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 1.6);
    float godRay    = vFoamMask * rimFactor * sssProgress * 0.50;
    /* God ray warna: cold moonlight + zone tint */
    vec3 godRayCol  = mix(uMoonColor * 0.55, vec3(0.02, 0.35, 0.38), zone * 0.5);
    color += godRayCol * godRay;

    /* ════════════════════════════════════════════════════════════════════
     * D. CAUSTIC PATTERN
     * ════════════════════════════════════════════════════════════════════
     * Caustics: pola cahaya fokus dari refraksi permukaan air.
     * Sangat aktif di Surface Zone (cahaya menembus).
     * Makin dalam (twilight/abyss) → makin tidak terlihat.
     * Caustic bergerak seiring uTime.                                   */
    float c1 = sin(vUv.x * 10.0 + uTime * 2.0) * sin(vUv.y * 7.5  - uTime * 1.7);
    float c2 = sin(vUv.x *  6.8 - uTime * 1.3) * sin(vUv.y * 11.5 + uTime * 2.5);
    float c3 = sin(vUv.x * 15.0 + uTime * 2.8) * cos(vUv.y *  8.5 - uTime * 2.0);
    float causticRaw  = (c1 * 0.5 + c2 * 0.35 + c3 * 0.15) * 0.5 + 0.5;
    float causticSharp = pow(causticRaw, 5.0);
    float causticMask  = smoothstep(0.08, 0.35, vNy)
                       * (1.0 - smoothstep(0.74, 0.92, vNy))
                       * (1.0 - smoothstep(0.0, 1.2, zone));  /* fade di zone */
    /* Caustic color: bright teal di surface, fades di dalam */
    vec3 causticColor = mix(
      vec3(0.12, 0.55, 0.55),   /* teal caustic di surface */
      vec3(0.02, 0.12, 0.15),   /* subtle di twilight      */
      clamp(zone, 0.0, 1.0)
    );
    color += causticColor * causticSharp * causticMask * 0.20;

    /* ════════════════════════════════════════════════════════════════════
     * E. BIOLUMINESCENCE
     * ════════════════════════════════════════════════════════════════════
     * Warped FBM untuk pola fitoplankton.
     * Di surface zone: hamper tidak terlihat (laut tenang).
     * Di abyss zone: lebih aktif, charcoal-cyan (deep-sea style).
     *
     * "Deep-sea style" berbeda dari "toxic ocean" version:
     *   - Lebih biru-hijau gelap, bukan lime-cyan elektrik
     *   - Lebih halus, bukan meledak-ledak
     *   - Hanya terlihat di kedalaman (zone > 0.8)                     */
    float biolumActive = smoothstep(0.8, 2.0, vZoneDepth)  /* muncul di deep */
                       * uBiolumIntensity;

    /* Warp noise coordinate dengan time untuk pola yang bergerak       */
    vec2 biolumUV = vUv * 4.0 + vec2(uTime * 0.10, uTime * -0.07);
    float biolum  = warpedFbm(biolumUV);
    float biolumSpot = pow(max(0.0, biolum), 3.2);  /* sharpen ke spots   */

    /* Pulse: berkedip halus (lebih lambat dari biolum sebelumnya)      */
    float pulse = 0.78 + 0.22 * sin(uTime * 1.4 + biolum * PI);

    /* Spatial mask: biolum di tengah body, tidak di tepi atas/bawah    */
    float biolumMask = smoothstep(0.08, 0.32, vNy)
                     * (1.0 - smoothstep(0.78, 0.96, vNy));

    float biolumFinal = biolumSpot * pulse * biolumMask * biolumActive;

    /* Warna deep-sea biolum: charcoal-cyan (subtle, bukan elektrik)    */
    /* Di surface/twilight: hampir tidak ada                            */
    vec3 biolumColor = mix(
      vec3(0.008, 0.045, 0.055),   /* very subtle dark teal              */
      vec3(0.020, 0.110, 0.140),   /* charcoal-cyan di abyss             */
      smoothstep(1.2, 2.2, vZoneDepth)
    );
    color += biolumColor * biolumFinal * 1.4;

    /* ════════════════════════════════════════════════════════════════════
     * F. FOAM AT CREST
     * ════════════════════════════════════════════════════════════════════
     * Foam = busa putih di puncak ombak.
     * Warna foam berdasarkan zone:
     *   Surface: putih sedikit cyan (moonlit foam)
     *   Twilight/Abyss: foam makin menghilang (tidak ada cahaya)       */
    float foam1 = sin(vUv.x * 24.0 + uTime * 2.0) * sin(vUv.y * 12.0 - uTime * 1.6);
    float foam2 = sin(vUv.x * 16.0 - uTime * 1.5 + vUv.y * 5.0) * 0.6
                + sin(vUv.x * 38.0 + uTime * 3.0) * 0.4;
    float foamTex = pow(max(0.0, foam1 * foam2 * 0.5 + 0.5), 3.0);
    float foamStr = vFoamMask * smoothstep(0.75, 1.0, vNy) * foamTex;
    /* Foam warna: putih moonlit di surface, makin redup di dalam       */
    vec3 foamColor = mix(
      vec3(0.75, 0.88, 0.90),   /* moonlit foam: putih-cyan            */
      vec3(0.20, 0.30, 0.35),   /* deep foam: charcoal                 */
      clamp(zone * 0.8, 0.0, 1.0)
    );
    /* Foam juga berkurang di zone dalam (tidak ada cahaya = foam gelap) */
    float foamVis = foamStr * (1.0 - zone * 0.55);
    color = mix(color, foamColor, clamp(foamVis, 0.0, 1.0));
    /* Specular boost di foam area (busa reflektif) */
    color += uMoonColor * spec * vFoamMask * 0.35 * (1.0 - zone * 0.5);

    /* ════════════════════════════════════════════════════════════════════
     * G. ZONE ATMOSPHERE (fog/dark vignette per zone)
     * ════════════════════════════════════════════════════════════════════
     * Di abyss zone, semua warna di-tint sangat gelap.
     * Ini memperkuat rasa "kedalaman tanpa cahaya".                    */
    float abyssBlend = smoothstep(1.5, 2.2, vZoneDepth);
    vec3  abyssTint  = vec3(0.002, 0.005, 0.008);
    color = mix(color, abyssTint, abyssBlend * 0.65);

    /* ════════════════════════════════════════════════════════════════════
     * H. ALPHA
     * ════════════════════════════════════════════════════════════════════ */
    /* Body: opaque (0.90–0.95), sedikit transparan */
    float alphaBody = mix(0.94, 0.82, vNy);
    /* Curl tip: semi-transparan (thin water + SSS visible) */
    float alphaCurl = 1.0 - vFoamMask * sssProgress * 0.50;
    float alpha     = alphaBody * alphaCurl;
    /* Solid di dasar, transparan di ujung paling atas */
    alpha = mix(1.0, alpha, smoothstep(0.0, 0.10, vNy));
    /* Fade in saat scroll mulai (tidak muncul langsung) */
    alpha *= smoothstep(0.015, 0.10, uScroll);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
/** Split text → animatable <span> per karakter untuk GSAP */
const SplitChars = ({ text }) =>
  text.split("").map((ch, i) => (
    <span
      key={i}
      className="char"
      style={{ display: "inline-block", willChange: "transform, opacity" }}
    >
      {ch === " " ? "\u00A0" : ch}
    </span>
  ));

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS SCENE BUILDER
// Dipisahkan dari React untuk menghindari re-creation saat render.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build seluruh Three.js scene:
 *   - WebGLRenderer (alpha:transparent)
 *   - Night Sky (Points, 2500 stars)
 *   - Moon (crescent trick + PointLight)
 *   - Wave Mesh (PlaneGeometry + ShaderMaterial)
 *   - Foam + Spray particles (Points)
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {object} — scene objects + uniforms + dispose()
 */
function buildScene(canvas) {
  const W = canvas.clientWidth || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;

  /* ── Renderer ─────────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true /* transparent bg → HTML/CSS background terlihat */,
    antialias: true,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); /* fully transparent clear */

  /* ── Scene ───────────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  /* Fog ringan: memperkuat ilusi kedalaman air (tidak terlalu pekat
   * agar bintang tetap terlihat di awal)                               */
  scene.fog = new THREE.FogExp2(0x010503, 0.018);

  /* ── Camera ──────────────────────────────────────────────────────────── */
  /* FOV 65°, sedikit di atas center (y=2.5), looking ke (0, 2, 0) */
  const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
  camera.position.set(0.0, 2.5, 12.0);
  camera.lookAt(0, 2.0, 0);

  /* ══════════════════════════════════════════════════════════════════════
   * NIGHT SKY — THREE.Points (2500 bintang)
   * ══════════════════════════════════════════════════════════════════════ */
  const STAR_COUNT = 2500;
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starCol = new Float32Array(STAR_COUNT * 3);
  const starSz = new Float32Array(STAR_COUNT);
  const starTmp = new THREE.Color();

  for (let i = 0; i < STAR_COUNT; i++) {
    /* Distribusi di belahan atas sphere (langit) */
    const phi = Math.acos(1 - Math.random() * 1.6);
    const theta = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * 12;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 5;
    starPos[i * 3 + 2] = r * Math.cos(phi) - 12;

    /* Warna bintang: putih (60%), biru (25%), kuning (10%), oranye (5%) */
    const roll = Math.random();
    if (roll < 0.6) starTmp.setHSL(0.6, 0.12, 0.82 + Math.random() * 0.18);
    else if (roll < 0.85)
      starTmp.setHSL(0.62, 0.58, 0.72 + Math.random() * 0.22);
    else if (roll < 0.95)
      starTmp.setHSL(0.14, 0.62, 0.78 + Math.random() * 0.18);
    else starTmp.setHSL(0.05, 0.72, 0.7 + Math.random() * 0.2);
    starCol[i * 3] = starTmp.r;
    starCol[i * 3 + 1] = starTmp.g;
    starCol[i * 3 + 2] = starTmp.b;

    /* Ukuran: 95% kecil, 5% terang/besar */
    starSz[i] =
      Math.random() < 0.05
        ? 3.5 + Math.random() * 2.5
        : 0.6 + Math.random() * 1.4;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  starGeo.setAttribute("size", new THREE.BufferAttribute(starSz, 1));

  /* Custom shader untuk twinkle dan size attenuation per-star */
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uStarTime: { value: 0.0 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute vec3  color;
      uniform   float uStarTime;
      varying   vec3  vStarColor;
      varying   float vBright;

      /* Deterministic hash per bintang untuk fase twinkle unik */
      float sh(float n) { return fract(sin(n * 127.1) * 43758.5); }

      void main() {
        vStarColor = color;
        /* Phase: berbeda per bintang berdasarkan posisi */
        float phase   = sh(position.x + position.y * 0.17 + position.z * 0.31);
        /* Twinkle: sinusoidal, kecepatan dan fase berbeda per bintang  */
        float twinkle = 0.72 + 0.28 * sin(uStarTime * (1.3 + phase*2.8) + phase*6.28);
        vBright = twinkle;

        gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        /* Perspektif size: jauh = kecil. 280 = magic constant untuk FOV 65° */
        gl_PointSize = size * twinkle * (280.0 / -gl_Position.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3  vStarColor;
      varying float vBright;
      void main() {
        /* Jarak dari center point = lingkaran halus */
        float d     = length(gl_PointCoord - 0.5) * 2.0;
        /* Gaussian falloff: lingkaran dengan tepi lembut */
        float alpha = exp(-d * d * 3.8) * vBright;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vStarColor * vBright, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ══════════════════════════════════════════════════════════════════════
   * MOON — Crescent via dua sphere overlapping
   * Sphere putih (body) + Sphere hitam lebih kecil offset ke kiri (shadow)
   * → efek crescent tanpa texture. Simple, efektif.
   * ══════════════════════════════════════════════════════════════════════ */
  const MOON_POS = new THREE.Vector3(7, 10, -20);

  /* Body sphere: putih kehijauan, emissive untuk self-glow */
  const moonGeo = new THREE.SphereGeometry(2.4, 64, 64);
  const moonMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0xcde0cc),
    emissive: new THREE.Color(0x8faa8f),
    emissiveIntensity: 0.5,
    shininess: 15,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.copy(MOON_POS);
  scene.add(moonMesh);

  /* Shadow sphere: hitam, sedikit lebih kecil, offset untuk crescent */
  const shdGeo = new THREE.SphereGeometry(2.15, 48, 48);
  const shdMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x000000),
    depthWrite: false,
  });
  const shdMesh = new THREE.Mesh(shdGeo, shdMat);
  /* Offset: -2.1 di X (ke kiri), +0.35 di Y (sedikit ke atas),
   * +0.65 di Z (sedikit ke depan — agar tidak z-fight dengan moon body) */
  shdMesh.position.set(MOON_POS.x - 2.1, MOON_POS.y + 0.35, MOON_POS.z + 0.65);
  scene.add(shdMesh);

  /* Moon halo: plane shader dengan radial gradient glow */
  const haloGeo = new THREE.PlaneGeometry(12, 12);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uHaloI: { value: 0.38 } },
    vertexShader: `varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uHaloI;
      varying vec2  v;
      void main(){
        float d=length(v-0.5)*2.0;
        float h=exp(-d*d*2.5)*uHaloI;
        gl_FragColor=vec4(0.72,0.88,0.68,h*0.40);
      }`,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.set(MOON_POS.x, MOON_POS.y, MOON_POS.z + 1);
  haloMesh.lookAt(camera.position);
  scene.add(haloMesh);

  /* PointLight dari posisi moon — primary light source malam */
  const moonLight = new THREE.PointLight(0xbbd5aa, 5.5, 130, 1.4);
  moonLight.position.copy(MOON_POS);
  scene.add(moonLight);

  /* Fill light bawah (reflected dari permukaan air) */
  const fillLight = new THREE.PointLight(0x112210, 1.2, 55);
  fillLight.position.set(0, -5, 8);
  scene.add(fillLight);

  /* Ambient minimal (malam hari) */
  scene.add(new THREE.AmbientLight(0x050c05, 1.5));

  /* ══════════════════════════════════════════════════════════════════════
   * WAVE MESH
   * PlaneGeometry 192×256 segmen:
   *   - X (192): lebar wave, Gerstner chop horizontal
   *   - Y (256): barrel arc direction — lebih banyak = curl lebih smooth
   * Semua displacement di GPU vertex shader. Zero JS CPU untuk geometry.
   * ══════════════════════════════════════════════════════════════════════ */
  const waveGeo = new THREE.PlaneGeometry(24, 18, 192, 256);

  const waveUniforms = {
    uTime: { value: 0.0 },
    uScroll: { value: 0.0 },
    uZone: { value: 0.0 },
    uBiolumIntensity: { value: 0.0 },
    uCameraPos: { value: camera.position.clone() },
    uMoonPos: { value: moonLight.position.clone() },
    uMoonColor: { value: new THREE.Color(0x9abba8) },
    uMoonIntensity: { value: 1.0 },
  };

  const waveMat = new THREE.ShaderMaterial({
    uniforms: waveUniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    extensions: { derivatives: true } /* aktifkan dFdx/dFdy */,
  });

  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.position.set(0, 0, 0);
  scene.add(waveMesh);

  /* ── Foam + Spray particles ─────────────────────────────────────────── */
  const mkPts = (n, color, size) => {
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.0,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  };

  /* Foam: cyan-white (moonlit foam) */
  const foamPts = mkPts(300, 0x88cccc, 0.16);
  /* Spray: lebih besar, lebih jarang, lebih terang */
  const sprayPts = mkPts(90, 0xaadddd, 0.26);
  scene.add(foamPts);
  scene.add(sprayPts);

  /* ── Dispose ──────────────────────────────────────────────────────────── */
  const dispose = () => {
    [
      waveGeo,
      waveMat,
      starGeo,
      starMat,
      moonGeo,
      moonMat,
      shdGeo,
      shdMat,
      haloGeo,
      haloMat,
      foamPts.geometry,
      foamPts.material,
      sprayPts.geometry,
      sprayPts.material,
    ].forEach((o) => o?.dispose?.());
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    waveMesh,
    waveUniforms,
    foamPts,
    sprayPts,
    moonLight,
    starMat,
    haloMat,
    dispose,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE UPDATER
// Mirrors barrel arc formula dari vertex shader (JS approximation).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Update foam + spray particle positions setiap frame.
 * Posisi crest dihitung ulang di JS agar partikel mengikuti wave.
 *
 * @param {THREE.Points} foam
 * @param {THREE.Points} spray
 * @param {number}       scrollP — lerped scroll 0..1
 * @param {number}       t       — elapsed seconds
 */
function updateParticles(foam, spray, scrollP, t) {
  /* Mirror barrel arc params dari vertex shader */
  const barrelR =
    scrollP < 0.55
      ? 0.15 + (scrollP / 0.55) * 8.05 /* rise   */
      : 8.2 - ((scrollP - 0.55) / 0.45) * 8.0; /* crash  */
  const totalAngle = scrollP * Math.PI * 1.95;
  const approachZ = -5.0 + scrollP * 10.0;

  /* Crest di ny ≈ 0.78 */
  const crestTheta = 0.78 * totalAngle;
  const crestY = barrelR * Math.sin(crestTheta);
  const crestZ = barrelR * (1 - Math.cos(crestTheta)) + approachZ;

  /* Foam visibility: ramp in dari scroll 0.08 */
  const foamVis = Math.min(1, Math.max(0, (scrollP - 0.08) / 0.28));
  foam.material.opacity = foamVis * 0.7;
  spray.material.opacity =
    Math.min(1, Math.max(0, (scrollP - 0.22) / 0.25)) * 0.45;

  const fPos = foam.geometry.attributes.position;
  const sPos = spray.geometry.attributes.position;

  /* Foam: tersebar di sepanjang X (wave width ≈ 24) */
  for (let i = 0; i < fPos.count; i++) {
    const fr = i / fPos.count;
    fPos.setXYZ(
      i,
      -11.5 + fr * 23.0 + Math.sin(t * 2.8 + i * 0.8) * 0.55,
      crestY + Math.abs(Math.sin(t * 3.2 + i * 1.3)) * 0.55,
      crestZ + Math.sin(t * 4.5 + i * 2.1) * 0.22 + 0.14,
    );
  }
  fPos.needsUpdate = true;

  /* Spray: di atas crest, lebih random */
  for (let i = 0; i < sPos.count; i++) {
    const fr = i / sPos.count;
    sPos.setXYZ(
      i,
      -10.0 + fr * 20.0 + Math.sin(t * 2.0 + i * 1.2) * 1.4,
      crestY + Math.abs(Math.sin(t * 2.5 + i * 1.9)) * 2.0 + 0.5,
      crestZ + Math.sin(t * 3.2 + i * 2.5) * 0.4,
    );
  }
  sPos.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Hero = () => {
  /* ── DOM Refs ─────────────────────────────────────────────────────────── */
  const wrapperRef = useRef(null); /* 320vh scroll container             */
  const stickyRef = useRef(null); /* 100vh sticky viewport              */
  const canvasRef = useRef(null); /* Three.js render target             */
  const contentRef = useRef(null); /* hero text (naik saat scroll)       */
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const tagsRef = useRef(null);
  const ctaRef = useRef(null);
  const statsRef = useRef(null);
  const tabRowRef = useRef(null);
  const depthRef = useRef(null);

  /* ── Animation state (no re-render) ──────────────────────────────────── */
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const elapsedRef = useRef(0);
  const prevTsRef = useRef(null);
  const rafRef = useRef(null);

  /* ── GSAP: entrance + ScrollTrigger ───────────────────────────────────── */
  useGSAP(
    () => {
      /* Entrance animation */
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(
        titleRef.current.querySelectorAll(".char"),
        { y: 110, opacity: 0, rotateX: -75, skewX: 4 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          skewX: 0,
          duration: 1.15,
          stagger: 0.022,
        },
        0.2,
      );
      tl.fromTo(
        subRef.current,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        "-=0.30",
      );
      tl.fromTo(
        tagsRef.current.querySelectorAll(".tag-chip"),
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, stagger: 0.055 },
        "-=0.35",
      );
      tl.fromTo(
        ctaRef.current,
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55 },
        "-=0.30",
      )
        .fromTo(
          statsRef.current,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          "-=0.28",
        )
        .fromTo(
          tabRowRef.current,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.6 },
          "-=0.20",
        );

      /* ScrollTrigger — CSS sticky (tidak ada GSAP pin → tidak ada blank gap) */
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          targetScrollRef.current = self.progress;
          if (depthRef.current) {
            depthRef.current.textContent = `${Math.round(self.progress * 85)}m`;
          }
          /* Broadcast ke App.jsx via event bus */
          emitScrollProgress("hero", self.progress);
        },
      });
    },
    { scope: wrapperRef },
  );

  /* ── Three.js init + rAF loop ─────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const three = buildScene(canvas);

    const onResize = () => {
      const W = canvas.clientWidth,
        H = canvas.clientHeight;
      three.camera.aspect = W / H;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    /* rAF render loop */
    const loop = (ts) => {
      if (prevTsRef.current !== null)
        elapsedRef.current += (ts - prevTsRef.current) * 0.001;
      prevTsRef.current = ts;
      const elapsed = elapsedRef.current;

      /* ── Lerp scroll progress (rate 0.065 = ~15 frame lag = "berat air") */
      const cur = currentScrollRef.current;
      const tgt = targetScrollRef.current;
      currentScrollRef.current = cur + (tgt - cur) * 0.065;
      const p = currentScrollRef.current;

      /* ── Zone calculation ──────────────────────────────────────────────
       * Zone float 0..2: menentukan marine zone warna di fragment.
       * scroll=0: zone=0 (Surface), scroll=0.5: zone=1 (Twilight edge),
       * scroll=1: zone=2 (Abyss).                                        */
      const zoneVal = p * 2.0;

      /* ── Bioluminescence intensity ─────────────────────────────────────
       * Naik mulai dari SM.WAVE_RISING (0.20) mencapai max di 1.0.
       * Tapi deep-sea biolum cuma terlihat di zone > 0.8 (twilight+),
       * jadi di surface (p < 0.4) hampir tidak visible walau int > 0.  */
      const biolumInt = Math.min(1, Math.max(0, (p - SM.WAVE_RISING) / 0.8));

      /* ── Update uniforms ───────────────────────────────────────────────── */
      three.waveUniforms.uTime.value = elapsed;
      three.waveUniforms.uScroll.value = p;
      three.waveUniforms.uZone.value = zoneVal;
      three.waveUniforms.uBiolumIntensity.value = biolumInt;
      three.waveUniforms.uCameraPos.value.copy(three.camera.position);
      three.waveUniforms.uMoonPos.value.copy(three.moonLight.position);

      /* ── Moon intensity: naik saat barrel peak, turun saat abyss ───────
       * scroll=0:    intensity 5.5 (calm night)
       * scroll=0.5:  intensity 18  (barrel peak, moon sorot maksimal)
       * scroll=0.85: intensity 2   (masuk abyss, moon tidak terlihat)  */
      const moonRise = Math.min(1, p / SM.BARREL_PEAK);
      const moonFade =
        p > SM.BARREL_PEAK
          ? 1.0 - ((p - SM.BARREL_PEAK) / (1.0 - SM.BARREL_PEAK)) * 0.88
          : 1.0;
      const moonInt = (5.5 + moonRise * 12.5) * moonFade;
      three.moonLight.intensity = moonInt;
      three.waveUniforms.uMoonIntensity.value = moonInt / 18.0; /* normalized */

      /* Halo bulan: makin kecil saat barrel (cahaya lebih fokus ke wave) */
      if (three.haloMat.uniforms)
        three.haloMat.uniforms.uHaloI.value = 0.38 * (1.0 - biolumInt * 0.45);

      /* Stars twinkle time */
      if (three.starMat.uniforms)
        three.starMat.uniforms.uStarTime.value = elapsed;

      /* ── Content float up ──────────────────────────────────────────────
       * Mulai di SM.WAVE_RISING (0.20), selesai di SM.SUBMERGE (0.85).
       * easeInQuad: lambat mulai, cepat di akhir (terasa natural).      */
      if (contentRef.current) {
        if (p > SM.WAVE_RISING) {
          const ft = Math.min(
            1,
            (p - SM.WAVE_RISING) / (SM.SUBMERGE - SM.WAVE_RISING),
          );
          const ease = ft * ft;
          gsap.set(contentRef.current, { y: -ease * 310, opacity: 1 - ease });
        } else {
          gsap.set(contentRef.current, { y: 0, opacity: 1 });
        }
      }

      /* ── Particles ──────────────────────────────────────────────────── */
      updateParticles(three.foamPts, three.sprayPts, p, elapsed);

      /* ── Render ─────────────────────────────────────────────────────── */
      three.renderer.render(three.scene, three.camera);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      three.dispose();
    };
  }, []);

  /* ── JSX ──────────────────────────────────────────────────────────────── */
  return (
    /*
     * wrapperRef: height 320vh — scroll space nyata.
     * ScrollTrigger pada wrapper → lerp di rAF.
     * id="hero" untuk smoothScrollTo("hero").
     */
    <div
      ref={wrapperRef}
      id="hero"
      style={{ height: "320vh", position: "relative" }}
    >
      {/*
       * stickyRef: position:sticky, top:0, height:100vh.
       * Tetap di viewport selama wrapper di-scroll.
       * Tidak ada GSAP pin → tidak ada spacer → tidak ada blank gap.
       * Background CSS: hitam malam, terlihat MELALUI canvas (alpha:true).
       */}
      <div
        ref={stickyRef}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          /* Night ocean: hitam sangat gelap, hint biru-hijau minimal */
          background:
            "linear-gradient(180deg, #000e0a 0%, #010c08 25%, #010a06 55%, #020d08 85%, #011008 100%)",
        }}
      >
        {/* ── Surface Shimmer (z:2) — CSS animated, teal version ─────── */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "72px",
            left: 0,
            right: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              height: "2px",
              background:
                "linear-gradient(90deg,transparent,rgba(40,180,160,0.50) 50%,transparent)",
              animation: "shimH 7s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "1px",
              marginTop: "5px",
              background:
                "linear-gradient(90deg,transparent 18%,rgba(55,200,175,0.20) 50%,transparent 82%)",
              animation: "shimH 10s ease-in-out infinite reverse",
            }}
          />
        </div>

        {/* ── Hero Content (z:3) ─────────────────────────────────────────
         * Teks HTML. "Berada di Z=0" dalam screen space — canvas (z:4)
         * mulai transparan, lalu wave menutupi saat mendekati.          */}
        <div
          ref={contentRef}
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 2rem",
            paddingTop: "72px",
            position: "relative",
            zIndex: 3,
            willChange: "transform, opacity",
          }}
        >
          <div style={{ height: "4vh" }} />

          {/* Available badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 14px",
              borderRadius: "100px",
              marginBottom: "1.8rem",
              border: "1px solid rgba(40,180,160,0.22)",
              background: "rgba(20,100,90,0.07)",
              backdropFilter: "blur(6px)",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#28b4a0",
                boxShadow: "0 0 8px #28b4a0",
                animation: "dotPulse 2.5s infinite",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "JetBrains Mono,monospace",
                fontSize: "0.65rem",
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: "#28b4a0",
              }}
            >
              Available for work
            </span>
          </div>

          {/* Heading — split chars untuk GSAP per-character flip-in */}
          <div
            ref={titleRef}
            style={{
              perspective: "1000px",
              overflow: "hidden",
              paddingBottom: "0.1em",
            }}
          >
            {TITLE_LINES.map((line, li) => (
              <div
                key={li}
                style={{
                  overflow: "hidden",
                  lineHeight: "0.93",
                  paddingBottom: "0.07em",
                }}
              >
                <h1
                  style={{
                    fontFamily: "Syne,sans-serif",
                    fontWeight: 800,
                    fontSize: "clamp(3.5rem,10vw,7.5rem)",
                    letterSpacing: "-0.025em",
                    display: "block",
                    /* Baris DIGITAL: outline only (teal tint) */
                    color: li === 1 ? "transparent" : "#a8d8d0",
                    WebkitTextStroke:
                      li === 1 ? "1px rgba(40,180,160,0.55)" : "0",
                    textShadow:
                      li !== 1 ? "0 0 40px rgba(25,130,115,0.12)" : "none",
                  }}
                >
                  <SplitChars text={line} />
                </h1>
              </div>
            ))}
          </div>

          <p
            ref={subRef}
            style={{
              marginTop: "1.4rem",
              fontFamily: "Outfit,sans-serif",
              fontWeight: 300,
              fontSize: "clamp(0.92rem,2vw,1.18rem)",
              color: "#3a7870",
              maxWidth: "450px",
              lineHeight: 1.7,
            }}
          >
            Student developer at{" "}
            <span style={{ color: "#6ab8b0", fontWeight: 500 }}>
              SMK Negeri 4 Bogor
            </span>{" "}
            — crafting full-stack web experiences from the deep.
          </p>

          <div
            ref={tagsRef}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "1.4rem",
            }}
          >
            {TAGS.map((tag) => (
              <span
                key={tag}
                className="tag-chip"
                style={{
                  padding: "4px 12px",
                  borderRadius: "4px",
                  background: "rgba(20,100,90,0.09)",
                  border: "1px solid rgba(40,175,155,0.20)",
                  fontFamily: "JetBrains Mono,monospace",
                  fontSize: "0.67rem",
                  letterSpacing: "0.06em",
                  color: "#28b4a0",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div
            ref={ctaRef}
            style={{
              display: "flex",
              gap: "1rem",
              marginTop: "2.2rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => smoothScrollTo("projects")}
              style={{
                padding: "12px 28px",
                background: "linear-gradient(135deg,#1a5a52,#0e3830)",
                border: "1px solid rgba(40,175,155,0.28)",
                borderRadius: "6px",
                fontFamily: "Outfit,sans-serif",
                fontWeight: 600,
                fontSize: "0.87rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#88d8cc",
                boxShadow: "0 6px 18px rgba(15,90,80,0.22)",
              }}
              onMouseEnter={(e) =>
                gsap.to(e.currentTarget, {
                  y: -3,
                  boxShadow: "0 12px 24px rgba(15,90,80,0.42)",
                  duration: 0.2,
                })
              }
              onMouseLeave={(e) =>
                gsap.to(e.currentTarget, {
                  y: 0,
                  boxShadow: "0 6px 18px rgba(15,90,80,0.22)",
                  duration: 0.25,
                })
              }
            >
              View Projects
            </button>
            <button
              onClick={() => smoothScrollTo("contact")}
              style={{
                padding: "12px 28px",
                background: "rgba(3,12,10,0.45)",
                border: "1px solid rgba(40,175,155,0.18)",
                borderRadius: "6px",
                fontFamily: "Outfit,sans-serif",
                fontWeight: 400,
                fontSize: "0.87rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#306860",
                backdropFilter: "blur(6px)",
                transition: "border-color 0.2s,color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(40,175,155,0.45)";
                e.currentTarget.style.color = "#28b4a0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(40,175,155,0.18)";
                e.currentTarget.style.color = "#306860";
              }}
            >
              Get in Touch
            </button>
          </div>

          <div
            ref={statsRef}
            style={{
              display: "flex",
              gap: "2.5rem",
              marginTop: "3rem",
              flexWrap: "wrap",
            }}
          >
            {[
              ["15+", "Projects Built"],
              ["3+", "Years Learning"],
              ["6", "Technologies"],
            ].map(([num, label]) => (
              <div key={label}>
                <div
                  style={{
                    fontFamily: "Syne,sans-serif",
                    fontWeight: 700,
                    fontSize: "1.85rem",
                    color: "#28b4a0",
                    lineHeight: 1,
                    textShadow: "0 0 16px rgba(30,170,150,0.28)",
                  }}
                >
                  {num}
                </div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono,monospace",
                    fontSize: "0.60rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#144a42",
                    marginTop: "4px",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Three.js Canvas (z:4) ─────────────────────────────────────
         * WebGLRenderer target. alpha:true → CSS background terlihat.
         * Bintang + bulan + wave semua dirender di sini.
         * pointer-events:none → klik menembus ke HTML (z:3) di bawah.  */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 4,
            pointerEvents: "none",
          }}
        />

        {/* ── Depth gauge (z:5) ─────────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            bottom: "5.5rem",
            right: "2rem",
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "1px",
              height: "52px",
              background:
                "linear-gradient(to bottom,transparent,rgba(35,175,155,0.33))",
            }}
          />
          <span
            ref={depthRef}
            style={{
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "0.61rem",
              letterSpacing: "0.12em",
              color: "rgba(35,175,155,0.36)",
            }}
          >
            0m
          </span>
          <span
            style={{
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "0.53rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(20,120,108,0.22)",
            }}
          >
            depth
          </span>
        </div>

        {/* ── Bottom Tab Row (z:5) ──────────────────────────────────── */}
        <div
          ref={tabRowRef}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 5,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
          }}
        >
          {[
            ["About", "about"],
            ["Projects", "projects"],
            ["Contact", "contact"],
          ].map(([label, id], i) => (
            <button
              key={id}
              onClick={() => smoothScrollTo(id)}
              style={{
                background: "none",
                border: "none",
                padding: "0 2rem 1.6rem 2rem",
                paddingTop: "0.75rem",
                textAlign: "left",
                borderRight: i < 2 ? "1px solid rgba(20,100,90,0.14)" : "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.querySelector(".tl").style.color = "#28b4a0";
                e.currentTarget.querySelector(".tl-line").style.transform =
                  "scaleX(1)";
                e.currentTarget.querySelector(".tl-line").style.background =
                  "rgba(35,175,155,0.42)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.querySelector(".tl").style.color =
                  i === 0 ? "#28b4a0" : "#144a42";
                e.currentTarget.querySelector(".tl-line").style.transform =
                  i === 0 ? "scaleX(1)" : "scaleX(0.28)";
                e.currentTarget.querySelector(".tl-line").style.background =
                  i === 0 ? "rgba(35,175,155,0.36)" : "rgba(12,55,48,0.28)";
              }}
            >
              <span
                className="tl"
                style={{
                  display: "block",
                  fontFamily: "JetBrains Mono,monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: i === 0 ? "#28b4a0" : "#144a42",
                  marginBottom: "0.5rem",
                  transition: "color 0.25s",
                }}
              >
                {label}
              </span>
              <div
                className="tl-line"
                style={{
                  height: "1px",
                  background:
                    i === 0 ? "rgba(35,175,155,0.36)" : "rgba(12,55,48,0.28)",
                  transformOrigin: "left center",
                  transform: i === 0 ? "scaleX(1)" : "scaleX(0.28)",
                  transition: "transform 0.3s ease,background 0.3s ease",
                  marginRight: "2rem",
                }}
              />
            </button>
          ))}
        </div>

        {/* Keyframes CSS */}
        <style>{`
          @keyframes shimH {
            0%,100% { opacity:0.22; transform:scaleX(0.82) translateX(-12%); }
            50%      { opacity:1;   transform:scaleX(1)    translateX(12%);  }
          }
          @keyframes dotPulse {
            0%,100% { opacity:1;    box-shadow:0 0 8px #28b4a0; }
            50%      { opacity:0.32; box-shadow:0 0 3px #28b4a0; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default Hero;
