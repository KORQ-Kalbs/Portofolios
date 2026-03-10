/**
 * Hero.jsx — Clock-Synced Dynamic Sky + Zone-Shift Ocean Wave
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  REAL-TIME SKY SYSTEM                                                     ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  getSkyState(new Date())  →  phase, sunPos, moonPos, colors, lightData   ║
 * ║                                                                           ║
 * ║  DAY   (06:30–17:30): Biru langit, Matahari arc, PointLight kuning       ║
 * ║  DAWN  (05:30–06:30): Transisi gradual Night → Day  (blend 0→1)          ║
 * ║  DUSK  (17:30–18:30): Transisi gradual Day → Night (blend 1→0)           ║
 * ║  NIGHT (18:30–05:30): Bintang terang, Bulan sabit, PointLight putih       ║
 * ║                                                                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  CELESTIAL ARC (world coords, bidang XY):                                 ║
 * ║    R = 22  Z = -20                                                        ║
 * ║    angle = progress × π   (0 = timur/+X, π/2 = zenith, π = barat/-X)    ║
 * ║    x = cos(angle) × R     y = sin(angle) × R × 0.85                      ║
 * ║                                                                           ║
 * ║    Sun  terbit 06:00, puncak 12:00, terbenam 18:00                        ║
 * ║    Moon terbit 18:00, puncak 00:00, terbenam 06:00                        ║
 * ║                                                                           ║
 * ║  GSAP ANIMATIONS:                                                         ║
 * ║    1. Slow celestial drift — GSAP tween posisi objek langit tiap menit   ║
 * ║    2. Dawn/dusk transition — GSAP animasi warna sky + fade bintang       ║
 * ║    3. Scroll wave animation — barrel arc, content float, zone shift       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * THREE.JS LAYERS (z-order):
 *   Stars (Points, AdditiveBlending)         ← background
 *   Sun   (SphereGeometry + corona halo)     ← sky object siang
 *   Moon  (2× Sphere crescent + halo)        ← sky object malam
 *   Wave  (ShaderMaterial PBR + fBm)         ← foreground
 *   Foam  (Points)
 *
 * WAVE SHADER UNIFORMS:
 *   uLightPos / uLightColor / uLightIntensity  ← driven by skyState
 *   (sebelumnya uMoonPos/uMoonColor/uMoonIntensity — digeneralisasi)
 *
 * BLANK GAP FIX: CSS sticky (bukan GSAP pin).
 * EVENT BUS: emitScrollProgress("hero", p) → App.jsx BubbleBg.
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
import {
  getSkyState,
  getSkyGradient,
  getSkyLabel,
  getSunPosition,
  getMoonPosition,
  SKY_PHASE,
  CELESTIAL_ARC_R,
  CELESTIAL_Z,
} from "../utils/skyTime";

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────
const TITLE_LINES = ["I BUILD", "DIGITAL", "THINGS."];
const TAGS = ["React", "Node.js", "PHP", "Laravel", "Tailwind", "MySQL"];

// ─────────────────────────────────────────────────────────────────────────────
// ── VERTEX SHADER ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 3 Layer Displacement:
 *   1. Barrel Arc   — circular cross-section, scroll-driven
 *   2. Gerstner     — 4 wave trains, physics-based trochoid
 *   3. fBm Noise    — 6-octave gradient noise, micro-ripples, time-driven
 *
 * Tidak ada perubahan dari versi sebelumnya.
 * (uLightPos bukan di vertex, hanya di fragment)
 */
const VERTEX_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uScroll;

  varying vec2  vUv;
  varying float vNy;
  varying vec3  vWorldNormal;
  varying vec3  vWorldPos;
  varying float vFoamMask;
  varying float vNoiseVal;
  varying float vZoneDepth;
  varying float vCurlDepth;

  #define PI      3.14159265358979
  #define TWO_PI  6.28318530717959

  /* ── Hash & Gradient Noise (untuk fBm layer) ───────────────────────────── */
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  /* 2D Gradient Noise (Perlin-like) */
  float gradientNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);    /* cubic Hermite smoothing */
    float a = hash21(i);
    float b = hash21(i + vec2(1,0));
    float c = hash21(i + vec2(0,1));
    float d = hash21(i + vec2(1,1));
    /* Gradient vectors dari hash → angle */
    vec2 ga = vec2(cos(a*TWO_PI), sin(a*TWO_PI));
    vec2 gb = vec2(cos(b*TWO_PI), sin(b*TWO_PI));
    vec2 gc = vec2(cos(c*TWO_PI), sin(c*TWO_PI));
    vec2 gd = vec2(cos(d*TWO_PI), sin(d*TWO_PI));
    float va = dot(ga, f - vec2(0,0));
    float vb = dot(gb, f - vec2(1,0));
    float vc = dot(gc, f - vec2(0,1));
    float vd = dot(gd, f - vec2(1,1));
    return mix(mix(va,vb,u.x), mix(vc,vd,u.x), u.y);
  }

  /* 6-octave fBm */
  float fbm(vec2 p) {
    float v=0., a=0.5, f=1.;
    v+=gradientNoise(p*f)*a; f*=2.1; a*=0.48;
    v+=gradientNoise(p*f)*a; f*=2.1; a*=0.48;
    v+=gradientNoise(p*f)*a; f*=2.1; a*=0.48;
    v+=gradientNoise(p*f)*a; f*=2.1; a*=0.48;
    v+=gradientNoise(p*f)*a; f*=2.1; a*=0.48;
    v+=gradientNoise(p*f)*a;
    return v;
  }

  /* ── Gerstner Wave ─────────────────────────────────────────────────────── */
  vec3 gerstner(vec2 pos, vec2 dir, float Q, float lam, float spd, float t) {
    float k=TWO_PI/lam, c=sqrt(9.81/k)*spd, phi=k*dot(dir,pos)-c*t, A=Q/k;
    return vec3(dir.x*A*cos(phi), A*sin(phi), dir.y*A*cos(phi));
  }
  vec3 gerstnerN(vec2 pos, vec2 dir, float Q, float lam, float spd, float t) {
    float k=TWO_PI/lam, c=sqrt(9.81/k)*spd, phi=k*dot(dir,pos)-c*t, WA=Q*cos(phi);
    return vec3(-dir.x*WA, 1.-Q*sin(phi), -dir.y*WA);
  }

  void main() {
    vUv = uv;
    float halfH = 9.0;
    float ny    = clamp((position.y + halfH)/(halfH*2.), 0., 1.);
    vNy         = ny;
    vec3 pos    = position;

    /* ── Layer 1: Barrel Arc (circular cross-section) ─────────────────────
     * rise phase: R tumbuh 0..8.2, crash phase: R menyusut 8.2..0.2
     * totalAngle: 0 (flat) → ~1.95π (crashed)                           */
    float riseP  = smoothstep(0., 0.55, uScroll);
    float crashP = smoothstep(0.55, 1., uScroll);
    float barrelR = (uScroll < 0.55)
      ? mix(0.15, 8.2, riseP)
      : mix(8.2, 0.2, crashP);
    float totalAngle = uScroll * PI * 1.95;
    float theta      = ny * totalAngle;
    pos.y = barrelR * sin(theta);
    pos.z = barrelR * (1. - cos(theta)) + mix(-5., 5., uScroll);

    /* ── Layer 2: Gerstner Waves (4 trains) ───────────────────────────────
     * gScale dikecilkan saat barrel forming agar tidak distort arc       */
    float gScale = 0.24 * (1. - smoothstep(0.40, 0.78, uScroll) * 0.82);
    vec2  xzIn   = vec2(position.x, 0.);
    vec3 g1=gerstner(xzIn,normalize(vec2( 1.,.18)),0.33,8.8,.94,uTime)*gScale;
    vec3 g2=gerstner(xzIn,normalize(vec2( .28,1.)),0.21,5.4,.81,uTime)*gScale*.70;
    vec3 g3=gerstner(xzIn,normalize(vec2(-.50,.80)),0.16,3.1,1.16,uTime)*gScale*.50;
    vec3 g4=gerstner(xzIn,normalize(vec2( .80,-.42)),0.09,1.7,1.42,uTime)*gScale*.32;
    pos.x += g1.x+g2.x+g3.x+g4.x;
    pos.y += (g1.y+g2.y)*.30*(1.-smoothstep(.5,.9,ny));
    pos.z += (g1.z+g2.z)*.18*(1.-smoothstep(.6,1.,ny));

    /* ── Layer 3: fBm Surface Noise (micro-ripples) ─────────────────────
     * Independent dari scroll → terus animasi (feel "air nyata")        */
    vec2  nCoord = vUv*5.5 + vec2(uTime*.095, uTime*-.072);
    float nZ     = fbm(nCoord);
    vNoiseVal    = nZ;
    float nMask  = smoothstep(.05,.30,ny)*(1.-smoothstep(.72,.96,ny));
    float nScroll= 1.-smoothstep(.45,.75,uScroll)*.70;
    pos.z       += nZ * 0.18 * nMask * nScroll;

    /* ── Varyings ──────────────────────────────────────────────────────── */
    vFoamMask  = smoothstep(PI*.38,PI*.42,theta)*(1.-smoothstep(PI*1.08,PI*1.14,theta));
    vCurlDepth = smoothstep(PI*.30,PI*.88,theta)*(1.-smoothstep(PI*.88,PI*1.32,theta));
    vZoneDepth = clamp(uScroll*2.2+(1.-ny)*.55, 0., 2.5);

    /* Normal */
    vec3 arcN = normalize(vec3(0., sin(theta), -cos(theta)));
    vec3 gN1  = gerstnerN(xzIn,normalize(vec2(1.,.18)),0.33,8.8,.94,uTime)*gScale*.35;
    vec3 gN2  = gerstnerN(xzIn,normalize(vec2(.28,1.)),0.21,5.4,.81,uTime)*gScale*.25;
    vec3 noiseN  = normalize(arcN + vec3(nZ*.08, nZ*.05, 0.));
    vWorldNormal = normalize(mat3(modelMatrix)*normalize(noiseN+gN1*.28+gN2*.18));
    vec4 wp4     = modelMatrix * vec4(pos, 1.);
    vWorldPos    = wp4.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp4;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// ── FRAGMENT SHADER ──────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Diperbarui v4:
 *   uMoonPos/uMoonColor/uMoonIntensity  →  uLightPos/uLightColor/uLightIntensity
 *   Sekarang menerima sun ATAU moon sebagai light source, dikontrol dari JS.
 *
 *   Tambahan:
 *   uDayBlend  (0=night, 1=day) — menggeser warna water siang/malam
 *     Siang: wave lebih terang, teal lebih cerah, caustic lebih aktif
 *     Malam: lebih gelap, SSS lebih subtil, biolum lebih visible
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  /* ── Uniforms ────────────────────────────────────────────────────────── */
  uniform float uTime;
  uniform float uScroll;
  uniform float uZone;            /* 0=surface, 1=twilight, 2=abyss        */
  uniform float uBiolumIntensity;
  uniform float uDayBlend;        /* 0=night, 1=day — dari skyState        */
  uniform vec3  uCameraPos;
  uniform vec3  uLightPos;        /* world pos sun atau moon               */
  uniform vec3  uLightColor;      /* warna light: warm (sun) / cool (moon) */
  uniform float uLightIntensity;  /* scroll-modulated intensity            */

  /* ── Varyings ────────────────────────────────────────────────────────── */
  varying vec2  vUv;
  varying float vNy;
  varying vec3  vWorldNormal;
  varying vec3  vWorldPos;
  varying float vFoamMask;
  varying float vNoiseVal;
  varying float vZoneDepth;
  varying float vCurlDepth;

  #define PI 3.14159265358979

  /* ── Noise utilities (re-declared: fragment dan vertex tidak sharing) ── */
  float hashF(vec2 p) {
    p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+19.19); return fract(p.x*p.y);
  }
  float valueNoise(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(hashF(i),hashF(i+vec2(1,0)),u.x),
               mix(hashF(i+vec2(0,1)),hashF(i+vec2(1,1)),u.x),u.y);
  }
  float fbmL(vec2 p){
    float v=0.,a=.5,f=1.;
    v+=valueNoise(p*f)*a;f*=2.;a*=.5;
    v+=valueNoise(p*f)*a;f*=2.;a*=.5;
    v+=valueNoise(p*f)*a;f*=2.;a*=.5;
    v+=valueNoise(p*f)*a;
    return v;
  }
  float warpFbm(vec2 p){
    vec2 q=vec2(fbmL(p),fbmL(p+vec2(5.2,1.3)));
    return fbmL(p+1.75*q);
  }

  /* ── GGX Specular (Cook-Torrance) ──────────────────────────────────── */
  float ggx(vec3 N, vec3 V, vec3 L, float rough) {
    vec3 H=normalize(V+L);
    float NdH=max(dot(N,H),0.),NdV=max(dot(N,V),1e-4),NdL=max(dot(N,L),0.);
    float a=rough*rough,a2=a*a;
    float denom=(NdH*NdH*(a2-1.)+1.);
    float D=a2/(PI*denom*denom);
    float k=rough*.5;
    float G=(NdV/(NdV*(1.-k)+k))*(NdL/(NdL*(1.-k)+k));
    return D*G*NdL;
  }

  /* ── Marine Zone Color ─────────────────────────────────────────────── */
  vec3 marineZoneColor(float zone, float ny, float dayB) {
    /* Siang: lebih cerah, hint cyan gelap (sun menembus air)
     * Malam: lebih gelap, hint biru-navy gelap                          */
    vec3 cSurf1  = mix(vec3(.052,.562,.628), vec3(.040,.420,.490), 1.-dayB);
    vec3 cSurf2  = mix(vec3(.038,.336,.408), vec3(.025,.240,.320), 1.-dayB);
    vec3 cTwi1   = vec3(.024,.165,.250);
    vec3 cTwi2   = vec3(.016,.088,.145);
    vec3 cAbyss1 = vec3(.010,.048,.078);
    vec3 cAbyss2 = vec3(.004,.016,.028);

    float ht = smoothstep(.1,.9,ny);
    vec3 surf = mix(cSurf2, cSurf1, ht*.70+.10);
    vec3 twi  = mix(cTwi2,  cTwi1,  ht*.60+.10);
    vec3 ab   = mix(cAbyss2,cAbyss1,ht*.45);

    return (zone<1.) ? mix(surf,twi,zone) : mix(twi,ab,zone-1.);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPos - vWorldPos);

    /* ── A. Derivative Normal Map ─────────────────────────────────────
     * dFdx/dFdy dari vNoiseVal → micro-surface normal untuk PBR      */
    float dNdx = dFdx(vNoiseVal);
    float dNdy = dFdy(vNoiseVal);
    float nStr = mix(0.85, 0.22, smoothstep(.25,.65,uScroll));
    vec3 pertN = normalize(N + vec3(dNdx*nStr*.18, dNdy*nStr*.18, 0.));

    /* ── B. Marine Zone Color ─────────────────────────────────────────── */
    float zone    = clamp(vZoneDepth, 0., 2.);
    vec3 baseColor = marineZoneColor(zone, vNy, uDayBlend);
    /* Turbidity: keruh di zone dalam */
    float turb = smoothstep(.5,2.,zone)*.30;
    baseColor  = mix(baseColor, vec3(.015,.025,.035)*.8, turb);

    /* ── C. PBR Lighting ─────────────────────────────────────────────────
     * uLightPos bisa jadi sun atau moon — shader tidak perlu tahu.     */
    vec3 L = normalize(uLightPos - vWorldPos);
    vec3 H = normalize(L + V);

    /* Ambient: lebih terang di siang, malam sangat gelap */
    vec3 ambBase = mix(
      vec3(.010,.018,.022),   /* night ambient */
      vec3(.040,.065,.075),   /* day ambient   */
      uDayBlend
    );
    vec3 color = baseColor * ambBase * mix(1., .3, zone*.5);

    /* Diffuse */
    float NdL    = max(dot(pertN, L), 0.05);
    vec3  diffuse = baseColor * NdL * uLightColor * uLightIntensity * 0.40;

    /* GGX Specular — roughness lebih rendah di siang (gelombang sangat reflektif) */
    float roughness = mix(.025, .095, smoothstep(.25,.75,uScroll));
    float spec      = ggx(pertN, V, L, roughness);
    vec3  specular  = uLightColor * spec * uLightIntensity
                    * mix(2.5, .8, zone*.5) * smoothstep(.1,.6,vNy);

    color += diffuse + specular;

    /* Fresnel (Schlick) */
    float cosT   = clamp(dot(N,V), 0., 1.);
    float fresnel = .02 + .98*pow(1.-cosT, 5.);
    /* Reflected color: siang → biru langit, malam → biru gelap */
    vec3 skyRefl = mix(
      vec3(.008,.015,.025),    /* night sky reflection   */
      vec3(.055,.120,.180),    /* day sky reflection     */
      uDayBlend
    );
    color += skyRefl * fresnel * mix(.65,.18,zone*.5);

    /* SSS */
    float backScatter = max(0., -dot(N,L));
    float sssProg     = smoothstep(.18,.52,uScroll);
    float sssMask     = vCurlDepth * sssProg * (1.-zone*.4);
    float sssInt      = backScatter * sssMask * .70;
    /* SSS warna: siang lebih hangat (sun penetration), malam lebih dingin */
    vec3 sssColor = mix(
      baseColor*1.5 + uLightColor*.3,
      uLightColor*.15,
      clamp(zone,0.,1.)
    );
    color += sssColor * sssInt;

    /* God Ray rim */
    float rimFact = pow(1.-clamp(cosT,0.,1.), 1.6);
    float godRay  = vFoamMask * rimFact * sssProg * .50;
    vec3 godCol   = mix(uLightColor*.55, vec3(.02,.35,.38), zone*.5);
    color += godCol * godRay;

    /* ── D. Caustic Pattern ───────────────────────────────────────────
     * Siang: lebih aktif (sun through water), malam: lebih redup      */
    float causticStr = mix(.10, .20, uDayBlend);  /* siang lebih kuat   */
    float c1=sin(vUv.x*10.+uTime*2.)*sin(vUv.y*7.5-uTime*1.7);
    float c2=sin(vUv.x*6.8-uTime*1.3)*sin(vUv.y*11.5+uTime*2.5);
    float c3=sin(vUv.x*15.+uTime*2.8)*cos(vUv.y*8.5-uTime*2.0);
    float caustic = pow(max(0.,(c1*.5+c2*.35+c3*.15)*.5+.5),5.);
    float causticM = smoothstep(.08,.35,vNy)*(1.-smoothstep(.74,.92,vNy))
                   *(1.-smoothstep(0.,1.2,zone));
    /* Siang: caustic lebih cerah (cyan), malam: lebih redup            */
    vec3 causticC = mix(
      vec3(.04,.18,.18),    /* night caustic: subtle teal    */
      vec3(.12,.55,.55),    /* day caustic: bright teal      */
      uDayBlend
    );
    color += causticC * caustic * causticM * causticStr;

    /* ── E. Bioluminescence (deep-sea zone, hanya di malam/abyss) ───── */
    float biolumActive = smoothstep(.8,2.,vZoneDepth) * uBiolumIntensity
                       * (1.-uDayBlend*.8);   /* hampir tidak ada di siang */
    vec2  bUV   = vUv*4.+vec2(uTime*.10,uTime*-.07);
    float biolum = warpFbm(bUV);
    float bSpot  = pow(max(0.,biolum), 3.2);
    float pulse  = .78+.22*sin(uTime*1.4+biolum*PI);
    float bMask  = smoothstep(.08,.32,vNy)*(1.-smoothstep(.78,.96,vNy));
    float bFinal = bSpot * pulse * bMask * biolumActive;
    vec3 bColor  = mix(vec3(.008,.045,.055), vec3(.020,.110,.140),
                    smoothstep(1.2,2.2,vZoneDepth));
    color += bColor * bFinal * 1.4;

    /* ── F. Foam at Crest ────────────────────────────────────────────── */
    float f1=sin(vUv.x*24.+uTime*2.)*sin(vUv.y*12.-uTime*1.6);
    float f2=sin(vUv.x*16.-uTime*1.5+vUv.y*5.)*.6+sin(vUv.x*38.+uTime*3.)*.4;
    float fTex = pow(max(0.,f1*f2*.5+.5),3.);
    float fStr = vFoamMask*smoothstep(.75,1.,vNy)*fTex;
    /* Foam siang: putih-cyan cerah; malam: putih dingin */
    vec3 foamCol = mix(
      vec3(.75,.88,.90),    /* night: cool white-cyan  */
      vec3(.92,.96,.98),    /* day:   bright white     */
      uDayBlend
    );
    color = mix(color, foamCol*(1.-zone*.55), clamp(fStr,0.,1.));
    color += uLightColor * spec * vFoamMask * .35 * (1.-zone*.5);

    /* ── G. Abyss atmosphere vignette ────────────────────────────────── */
    float abyssB = smoothstep(1.5,2.2,vZoneDepth);
    color = mix(color, vec3(.002,.005,.008), abyssB*.65);

    /* ── H. Alpha ────────────────────────────────────────────────────── */
    float alpha = mix(.94,.82,vNy)*(1.-vFoamMask*sssProg*.50);
    alpha = mix(1.,alpha,smoothstep(0.,.10,vNy));
    alpha *= smoothstep(.015,.10,uScroll);

    gl_FragColor = vec4(color, clamp(alpha,0.,1.));
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT CHARS HELPER
// ─────────────────────────────────────────────────────────────────────────────
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
// SCENE BUILDER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Build Three.js scene dengan semua objek.
 * Semua objek langit (sun/moon/stars) dibuat di sini.
 * Visibilitas dikontrol dari rAF loop berdasarkan skyState.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object}            initSkyState — initial sky state dari getSkyState()
 */
function buildScene(canvas, initSkyState) {
  const W = canvas.clientWidth || window.innerWidth;
  const H = canvas.clientHeight || window.innerHeight;

  /* ── Renderer ─────────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  /* ── Scene ───────────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  /* Fog color dari initial sky state */
  const fogC = initSkyState.fogColor;
  scene.fog = new THREE.FogExp2(
    new THREE.Color(fogC[0], fogC[1], fogC[2]),
    0.018,
  );

  /* ── Camera ──────────────────────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
  camera.position.set(0, 2.5, 12);
  camera.lookAt(0, 2.0, 0);

  // ══════════════════════════════════════════════════════════════════════
  // STARS — THREE.Points (2500 bintang)
  // Opacity dikontrol dari rAF: fade out saat siang (uDayBlend=1)
  // ══════════════════════════════════════════════════════════════════════
  const STAR_N = 2500;
  const sPos = new Float32Array(STAR_N * 3);
  const sCol = new Float32Array(STAR_N * 3);
  const sSz = new Float32Array(STAR_N);
  const sTmp = new THREE.Color();

  for (let i = 0; i < STAR_N; i++) {
    /* Distribusi di belahan atas sphere (langit) */
    const phi = Math.acos(1 - Math.random() * 1.6);
    const th = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * 12;
    sPos[i * 3] = r * Math.sin(phi) * Math.cos(th);
    sPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(th) + 5;
    sPos[i * 3 + 2] = r * Math.cos(phi) - 12;

    /* Warna: putih 60%, biru 25%, kuning 10%, oranye 5% */
    const roll = Math.random();
    if (roll < 0.6) sTmp.setHSL(0.6, 0.12, 0.82 + Math.random() * 0.18);
    else if (roll < 0.85) sTmp.setHSL(0.62, 0.58, 0.72 + Math.random() * 0.22);
    else if (roll < 0.95) sTmp.setHSL(0.14, 0.62, 0.78 + Math.random() * 0.18);
    else sTmp.setHSL(0.05, 0.72, 0.7 + Math.random() * 0.2);
    sCol[i * 3] = sTmp.r;
    sCol[i * 3 + 1] = sTmp.g;
    sCol[i * 3 + 2] = sTmp.b;
    sSz[i] =
      Math.random() < 0.05
        ? 3.5 + Math.random() * 2.5
        : 0.6 + Math.random() * 1.4;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(sCol, 3));
  starGeo.setAttribute("size", new THREE.BufferAttribute(sSz, 1));

  /* Custom shader untuk per-star twinkle + perspektif size attenuation */
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uStarTime: { value: 0 },
      uStarOpacity: { value: 1 - initSkyState.dayBlend },
    },
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 color;
      uniform float uStarTime;
      varying vec3 vSC; varying float vBr;
      float sh(float n){return fract(sin(n*127.1)*43758.5);}
      void main(){
        vSC=color;
        float ph=sh(position.x+position.y*.17+position.z*.31);
        float tw=.72+.28*sin(uStarTime*(1.3+ph*2.8)+ph*6.28);
        vBr=tw;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        gl_PointSize=size*tw*(280./-gl_Position.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStarOpacity;
      varying vec3 vSC; varying float vBr;
      void main(){
        float d=length(gl_PointCoord-.5)*2.;
        float a=exp(-d*d*3.8)*vBr*uStarOpacity;
        if(a<.01)discard;
        gl_FragColor=vec4(vSC*vBr,a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ══════════════════════════════════════════════════════════════════════
  // SUN — SphereGeometry dengan emissive + corona halo + lens flare dots
  // ══════════════════════════════════════════════════════════════════════
  /**
   * Sun terdiri dari 3 layer:
   *   1. Core sphere: emissive kuning-putih (MeshStandardMaterial)
   *   2. Corona inner: sphere lebih besar, MeshBasicMaterial orange transparan
   *   3. Corona outer halo: plane shader radial glow (AdditiveBlending)
   *
   * MeshStandardMaterial.emissive = warna sendiri tanpa butuh cahaya
   * → matahari bersinar sendiri, tidak bergantung pada PointLight arah.
   */

  /* Sun core */
  const sunCoreMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(1.0, 0.97, 0.78),
    emissive: new THREE.Color(1.0, 0.82, 0.3),
    emissiveIntensity: 2.8,
    roughness: 1.0,
    metalness: 0.0,
  });
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 48, 48),
    sunCoreMat,
  );

  /* Sun corona inner (sphere semi-transparan lebih besar) */
  const sunCorona1 = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 32, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.55, 0.1),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );

  /* Sun glow halo — plane dengan radial gradient shader */
  const sunHaloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uGlowI: { value: 1.0 } },
    vertexShader: `varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: /* glsl */ `
      uniform float uGlowI;
      varying vec2 v;
      void main(){
        /* Radial gradient dari center (UV 0.5,0.5 = center) */
        float d=length(v-.5)*2.;
        /* Dua layer: inner bright core + outer softer glow */
        float inner=exp(-d*d*3.5)*0.90;
        float outer=exp(-d*d*1.1)*0.30;
        float glow =(inner+outer)*uGlowI;
        /* Warna: putih di tengah → kuning-oranye di tepi */
        vec3 col=mix(vec3(1.,.95,.70), vec3(1.,.50,.05), smoothstep(.0,.7,d));
        gl_FragColor=vec4(col,glow*.55);
      }`,
  });
  const sunHalo = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), sunHaloMat);

  /* Group sun ke dalam satu objek untuk kemudahan move */
  const sunGroup = new THREE.Group();
  sunGroup.add(sunCore, sunCorona1, sunHalo);

  /* Posisi awal dari skyState */
  const sp = initSkyState.sunPos;
  sunGroup.position.set(sp.x, sp.y, sp.z);
  /* Halo selalu menghadap kamera */
  sunHalo.position.set(0, 0, 1);
  sunHalo.lookAt(
    camera.position.clone().sub(sunGroup.position).add(sunGroup.position),
  );

  /* Visibility awal dari dayBlend */
  sunGroup.visible = initSkyState.sunAlpha > 0.01;
  sunGroup.children.forEach((c) => {
    if (c.material)
      c.material.opacity =
        (c === sunCore ? 1 : c === sunCorona1 ? 0.18 : 1) *
        initSkyState.sunAlpha;
  });

  scene.add(sunGroup);

  /* PointLight dari posisi sun */
  const sunLight = new THREE.PointLight(0xfff5e0, 0, 150, 1.2);
  sunLight.position.copy(sunGroup.position);
  scene.add(sunLight);

  // ══════════════════════════════════════════════════════════════════════
  // MOON — Crescent via 2 sphere trick + halo + PointLight
  // ══════════════════════════════════════════════════════════════════════
  /**
   * Crescent trick: Sphere putih emissive (body) + Sphere hitam lebih kecil
   * digeser ke kiri → menutupi sisi kiri body → crescent shape.
   * Tidak butuh texture, hasilnya clean dan scalable.
   */

  const moonBody = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 64, 64),
    new THREE.MeshPhongMaterial({
      color: new THREE.Color(0xd0ddc8),
      emissive: new THREE.Color(0x8a9a80),
      emissiveIntensity: 0.45,
      shininess: 14,
    }),
  );
  /* Sphere hitam: shadow untuk crescent effect */
  const moonShadow = new THREE.Mesh(
    new THREE.SphereGeometry(2.02, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false }),
  );
  /* Offset shadow ke kiri-sedikit-atas-sedikit-depan */
  moonShadow.position.set(-2.05, 0.32, 0.62);

  /* Moon atmospheric glow halo */
  const moonHaloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uHI: { value: initSkyState.moonAlpha * 0.4 } },
    vertexShader: `varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: /* glsl */ `
      uniform float uHI;
      varying vec2 v;
      void main(){
        float d=length(v-.5)*2.;
        float h=exp(-d*d*2.5)*uHI;
        gl_FragColor=vec4(.72,.88,.68,h*.40);
      }`,
  });
  const moonHalo = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), moonHaloMat);
  moonHalo.position.set(0, 0, 1);

  const moonGroup = new THREE.Group();
  moonGroup.add(moonBody, moonShadow, moonHalo);

  const mp = initSkyState.moonPos;
  moonGroup.position.set(mp.x, mp.y, mp.z);

  /* Visibility awal */
  moonGroup.visible = initSkyState.moonAlpha > 0.01;

  scene.add(moonGroup);

  /* PointLight dari posisi moon */
  const moonLight = new THREE.PointLight(0xbbd5aa, 0, 130, 1.4);
  moonLight.position.copy(moonGroup.position);
  scene.add(moonLight);

  // ══════════════════════════════════════════════════════════════════════
  // FILL & AMBIENT LIGHTS
  // ══════════════════════════════════════════════════════════════════════
  /* Fill bawah: pantulan air (selalu ada) */
  const fillLight = new THREE.PointLight(0x112210, 1.2, 55);
  fillLight.position.set(0, -5, 8);
  scene.add(fillLight);

  /* Ambient: dikontrol dari skyState */
  const ambLight = new THREE.AmbientLight(0x050a05, 1.5);
  scene.add(ambLight);

  // ══════════════════════════════════════════════════════════════════════
  // WAVE MESH
  // ══════════════════════════════════════════════════════════════════════
  /* Light uniforms sekarang generic: uLightPos/uLightColor/uLightIntensity */
  const lc = initSkyState.lightColor;
  const lp = initSkyState.lightPos;

  const waveUniforms = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uZone: { value: 0 },
    uBiolumIntensity: { value: 0 },
    uDayBlend: { value: initSkyState.dayBlend },
    uCameraPos: { value: camera.position.clone() },
    uLightPos: { value: new THREE.Vector3(lp.x, lp.y, lp.z) },
    uLightColor: { value: new THREE.Color(lc[0], lc[1], lc[2]) },
    uLightIntensity: { value: 1.0 },
  };

  const waveMat = new THREE.ShaderMaterial({
    uniforms: waveUniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    extensions: { derivatives: true },
  });

  const waveMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 18, 192, 256),
    waveMat,
  );
  scene.add(waveMesh);

  /* Foam + spray particles */
  const mkPts = (n, color, size) => {
    const buf = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(buf, 3));
    const mat = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geo, mat);
  };
  const foamPts = mkPts(300, 0x88cccc, 0.16);
  const sprayPts = mkPts(90, 0xaadddd, 0.26);
  scene.add(foamPts);
  scene.add(sprayPts);

  /* Dispose helper */
  const dispose = () => {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material))
          obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
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
    sunGroup,
    sunLight,
    sunHaloMat,
    moonGroup,
    moonLight,
    moonHaloMat,
    ambLight,
    fillLight,
    starMat,
    dispose,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTICLE UPDATER (mirrors barrel arc dari vertex shader)
// ─────────────────────────────────────────────────────────────────────────────
function updateParticles(foam, spray, scrollP, t) {
  const barrelR =
    scrollP < 0.55
      ? 0.15 + (scrollP / 0.55) * 8.05
      : 8.2 - ((scrollP - 0.55) / 0.45) * 8.0;
  const approachZ = -5 + scrollP * 10;
  const crestTheta = 0.78 * scrollP * Math.PI * 1.95;
  const crestY = barrelR * Math.sin(crestTheta);
  const crestZ = barrelR * (1 - Math.cos(crestTheta)) + approachZ;

  const foamVis = Math.min(1, Math.max(0, (scrollP - 0.08) / 0.28));
  foam.material.opacity = foamVis * 0.7;
  spray.material.opacity =
    Math.min(1, Math.max(0, (scrollP - 0.22) / 0.25)) * 0.45;

  const fP = foam.geometry.attributes.position;
  const sP = spray.geometry.attributes.position;
  for (let i = 0; i < fP.count; i++) {
    const fr = i / fP.count;
    fP.setXYZ(
      i,
      -11.5 + fr * 23 + Math.sin(t * 2.8 + i * 0.8) * 0.55,
      crestY + Math.abs(Math.sin(t * 3.2 + i * 1.3)) * 0.55,
      crestZ + Math.sin(t * 4.5 + i * 2.1) * 0.22 + 0.14,
    );
  }
  fP.needsUpdate = true;
  for (let i = 0; i < sP.count; i++) {
    const fr = i / sP.count;
    sP.setXYZ(
      i,
      -10 + fr * 20 + Math.sin(t * 2.0 + i * 1.2) * 1.4,
      crestY + Math.abs(Math.sin(t * 2.5 + i * 1.9)) * 2.0 + 0.5,
      crestZ + Math.sin(t * 3.2 + i * 2.5) * 0.4,
    );
  }
  sP.needsUpdate = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Hero = () => {
  /* ── DOM refs ──────────────────────────────────────────────────────────── */
  const wrapperRef = useRef(null);
  const stickyRef = useRef(null);
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const tagsRef = useRef(null);
  const ctaRef = useRef(null);
  const statsRef = useRef(null);
  const tabRowRef = useRef(null);
  const depthRef = useRef(null);
  const skyLabelRef = useRef(null); /* "6:45 AM" / "10:30 PM" UI label */

  /* ── Animation state ───────────────────────────────────────────────────── */
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);
  const elapsedRef = useRef(0);
  const prevTsRef = useRef(null);
  const rafRef = useRef(null);

  /* Cached sky state (lerped transition values) */
  const skyBlendRef =
    useRef(null); /* { dayBlend, sunAlpha, moonAlpha } lerping targets */

  /* GSAP: entrance + ScrollTrigger ─────────────────────────────────────── */
  useGSAP(
    () => {
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
        "-=.30",
      );
      tl.fromTo(
        tagsRef.current.querySelectorAll(".tag-chip"),
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, stagger: 0.055 },
        "-=.35",
      );
      tl.fromTo(
        ctaRef.current,
        { y: 15, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55 },
        "-=.30",
      )
        .fromTo(
          statsRef.current,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          "-=.28",
        )
        .fromTo(
          tabRowRef.current,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.6 },
          "-=.20",
        );

      /* ScrollTrigger: CSS sticky — tidak ada blank gap */
      ScrollTrigger.create({
        trigger: wrapperRef.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          targetScrollRef.current = self.progress;
          if (depthRef.current)
            depthRef.current.textContent = `${Math.round(self.progress * 85)}m`;
          emitScrollProgress("hero", self.progress);
        },
      });
    },
    { scope: wrapperRef },
  );

  /* Three.js init + rAF loop ──────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* ── Initial sky state ────────────────────────────────────────────────
     * Dibaca sekali saat mount → menentukan tampilan awal.
     * rAF loop akan terus update setiap detik (perubahan sangat lambat).  */
    const initState = getSkyState();
    const three = buildScene(canvas, initState);
    const stickyEl = stickyRef.current;

    /* Terapkan sky gradient CSS awal */
    if (stickyEl) stickyEl.style.background = getSkyGradient(initState);
    if (skyLabelRef.current)
      skyLabelRef.current.textContent = getSkyLabel(initState);

    /* Lerp targets untuk transisi smooth di rAF */
    skyBlendRef.current = {
      dayBlend: initState.dayBlend,
      sunAlpha: initState.sunAlpha,
      moonAlpha: initState.moonAlpha,
      horizR: initState.horizColor[0],
      horizG: initState.horizColor[1],
      horizB: initState.horizColor[2],
      zenithR: initState.zenithColor[0],
      zenithG: initState.zenithColor[1],
      zenithB: initState.zenithColor[2],
      midR: initState.midColor[0],
      midG: initState.midColor[1],
      midB: initState.midColor[2],
    };

    /* ── GSAP arc animations ──────────────────────────────────────────────
     * Matahari dan bulan bergerak perlahan di arc langit.
     * Kita gunakan GSAP untuk animasi posisi yang smooth:
     *   - Posisi awal: dari skyState real-time
     *   - Drift loop: GSAP tween yang sangat lambat (120 detik satu siklus)
     *     memberikan kesan pergerakan tanpa menghitung arc tiap detik
     *
     * Teknik: simpan "arc progress" dalam gsap-able object,
     * lalu lerp menuju nilai dari getSkyState() di rAF.                  */

    /* Arc progress object yang bisa di-GSAP */
    const arcObj = {
      sunArcProgress: (initState.hour - 6) / 12 /* 0=sunrise, 1=sunset    */,
      moonArcProgress:
        (initState.hour >= 18 ? initState.hour - 18 : initState.hour + 6) / 12,
    };

    /**
     * GSAP TWEEN: Slow Celestial Drift
     * Menganimasikan arc progress perlahan.
     * Rate: 1 jam real = 1 jam animasi tapi divisualisasikan.
     * Untuk demo: kita percepat 8× supaya pergerakan terlihat dalam menit.
     */
    const CELESTIAL_LOOP_DUR = 600; /* detik = 10 menit untuk satu siklus penuh */

    /* Sun slow drift GSAP (looping) */
    const sunDriftTl = gsap.timeline({ repeat: -1 });
    sunDriftTl.to(arcObj, {
      sunArcProgress:
        arcObj.sunArcProgress + 0.08 /* 8% dari siklus dalam 10 menit */,
      duration: CELESTIAL_LOOP_DUR * 0.08,
      ease: "none",
      modifiers: {
        /* Clamp agar tidak melampaui [0,1] */
        sunArcProgress: (v) => Math.min(1, Math.max(0, v)),
      },
    });

    /* Moon slow drift GSAP (looping) */
    const moonDriftTl = gsap.timeline({ repeat: -1 });
    moonDriftTl.to(arcObj, {
      moonArcProgress: arcObj.moonArcProgress + 0.08,
      duration: CELESTIAL_LOOP_DUR * 0.08,
      ease: "none",
      modifiers: {
        moonArcProgress: (v) => Math.min(1, Math.max(0, v)),
      },
    });

    /* ── Dawn/Dusk GSAP transition (jika saat ini di window transisi) ──── */
    /* Apakah kita sedang di transition window? */
    if (
      initState.phase === SKY_PHASE.DAWN ||
      initState.phase === SKY_PHASE.DUSK
    ) {
      /**
       * GSAP Transition Timeline untuk Dawn/Dusk:
       *   - Fade stars in/out
       *   - Sun/moon alpha crossfade
       *   - CSS sky color shift (via stickyEl background update di rAF)
       *
       * Durasi: sisa waktu dalam window (mis. jika 06:10 saat dawn,
       * window end 06:30 → sisa 20 menit = 1200 detik).
       * Untuk demo: compress ke 15 detik agar terlihat.
       */
      const transitionDuration = 15; /* detik (demo speed) */

      const endDayBlend = initState.phase === SKY_PHASE.DAWN ? 1.0 : 0.0;

      gsap.to(skyBlendRef.current, {
        dayBlend: endDayBlend,
        sunAlpha: endDayBlend,
        moonAlpha: 1 - endDayBlend,
        duration: transitionDuration,
        ease: "power1.inOut",
        onUpdate: () => {
          /* Star opacity update (diaplikasikan ke starMat.uniforms di rAF) */
        },
      });
    }

    /* ── Resize handler ───────────────────────────────────────────────── */
    const onResize = () => {
      const W = canvas.clientWidth,
        H = canvas.clientHeight;
      three.camera.aspect = W / H;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    /* ── Sky update timer (setiap 60 detik) ──────────────────────────────
     * Real-time sky: cukup update setiap menit (perubahan sangat lambat).
     * GSAP dawn/dusk transition lebih sering (di rAF via skyBlendRef).    */
    const skyUpdateInterval = setInterval(() => {
      const newState = getSkyState();
      /* Update target lerp values */
      if (skyBlendRef.current) {
        /* GSAP animate ke target baru agar transisi smooth */
        gsap.to(skyBlendRef.current, {
          dayBlend: newState.dayBlend,
          sunAlpha: newState.sunAlpha,
          moonAlpha: newState.moonAlpha,
          horizR: newState.horizColor[0],
          horizG: newState.horizColor[1],
          horizB: newState.horizColor[2],
          zenithR: newState.zenithColor[0],
          zenithG: newState.zenithColor[1],
          zenithB: newState.zenithColor[2],
          midR: newState.midColor[0],
          midG: newState.midColor[1],
          midB: newState.midColor[2],
          duration: 8.0 /* transisi 8 detik ke warna sky baru */,
          ease: "power2.inOut",
          overwrite: "auto",
        });
        if (skyLabelRef.current)
          skyLabelRef.current.textContent = getSkyLabel(newState);
      }
    }, 60000); /* setiap 60 detik */

    /* ── rAF Render Loop ─────────────────────────────────────────────────── */
    const loop = (ts) => {
      if (prevTsRef.current !== null)
        elapsedRef.current += (ts - prevTsRef.current) * 0.001;
      prevTsRef.current = ts;
      const elapsed = elapsedRef.current;

      /* Lerp scroll (rate .065 = "berat air") */
      const cur = currentScrollRef.current;
      const tgt = targetScrollRef.current;
      currentScrollRef.current = cur + (tgt - cur) * 0.065;
      const p = currentScrollRef.current;

      /* Zone dan biolum */
      const zoneVal = p * 2.0;
      const biolumInt = Math.min(1, Math.max(0, (p - SM.WAVE_RISING) / 0.8));

      /* ── Sky blend (dari GSAP-lerped skyBlendRef) ────────────────────
       * skyBlendRef di-lerp oleh GSAP (interval + dawn/dusk transition).
       * rAF tinggal baca dan terapkan ke scene.                          */
      const sb = skyBlendRef.current;
      const dayBlend = sb ? sb.dayBlend : initState.dayBlend;

      /* ── Update CSS sky gradient ─────────────────────────────────────
       * Rebuild gradient string dari lerped colors di skyBlendRef.
       * Dipanggil setiap frame agar transisi dawn/dusk smooth.           */
      if (stickyEl && sb) {
        const h = `rgb(${Math.round(sb.horizR * 255)},${Math.round(sb.horizG * 255)},${Math.round(sb.horizB * 255)})`;
        const m = `rgb(${Math.round(sb.midR * 255)},${Math.round(sb.midG * 255)},${Math.round(sb.midB * 255)})`;
        const z = `rgb(${Math.round(sb.zenithR * 255)},${Math.round(sb.zenithG * 255)},${Math.round(sb.zenithB * 255)})`;
        stickyEl.style.background = `linear-gradient(180deg,${z} 0%,${m} 45%,${h} 100%)`;
      }

      /* ── Update Celestial Objects ────────────────────────────────────
       * Gunakan arcObj (yang di-tween oleh GSAP) untuk posisi.
       * Ini memberikan pergerakan lambat yang smooth tanpa recalculate
       * tiap frame dari Date().                                          */

      /* Sun position dari arcObj.sunArcProgress */
      const sunAngle = arcObj.sunArcProgress * Math.PI;
      const R = CELESTIAL_ARC_R;
      const sunX = Math.cos(sunAngle) * R;
      const sunY = Math.sin(sunAngle) * R * 0.85;
      const sunAlpha = sb ? sb.sunAlpha : initState.sunAlpha;
      const moonAlph = sb ? sb.moonAlpha : initState.moonAlpha;

      three.sunGroup.position.set(sunX, sunY, CELESTIAL_Z);
      three.sunLight.position.copy(three.sunGroup.position);

      /* Sun visibility */
      three.sunGroup.visible = sunAlpha > 0.01;
      if (three.sunGroup.visible) {
        /* Core opacity selalu 1 tapi lerp group scale untuk fade in/out */
        three.sunGroup.scale.setScalar(sunAlpha);
        /* Halo glow intensity */
        if (three.sunHaloMat.uniforms)
          three.sunHaloMat.uniforms.uGlowI.value = sunAlpha;
      }

      /* Moon position dari arcObj.moonArcProgress */
      const moonAngle = arcObj.moonArcProgress * Math.PI;
      const moonX = Math.cos(moonAngle) * R;
      const moonY = Math.sin(moonAngle) * R * 0.85;

      three.moonGroup.position.set(moonX, moonY, CELESTIAL_Z);
      three.moonLight.position.copy(three.moonGroup.position);

      /* Moon visibility */
      three.moonGroup.visible = moonAlph > 0.01;
      if (three.moonGroup.visible) {
        three.moonGroup.scale.setScalar(moonAlph);
        if (three.moonHaloMat.uniforms)
          three.moonHaloMat.uniforms.uHI.value = moonAlph * 0.4;
      }

      /* ── Star opacity — fade out saat siang ──────────────────────────
       * Bintang tidak terlihat di siang hari.
       * Rate dikecilkan agar transisi halus (match dengan sky color lerp). */
      if (three.starMat.uniforms) {
        three.starMat.uniforms.uStarTime.value = elapsed;
        three.starMat.uniforms.uStarOpacity.value = Math.max(
          0,
          1 - dayBlend * 1.2,
        );
      }

      /* ── Primary light: sun atau moon? ───────────────────────────────
       * Pilih berdasarkan dayBlend: >0.5 = sun dominan, <0.5 = moon.
       * Intensitas masing-masing dimodulasi dengan alphaValue dan scroll. */
      const useSun = dayBlend >= 0.5;

      /* Scroll-modulated light intensity (moon/sun lebih terang saat barrel peak) */
      const lightRise = Math.min(1, p / SM.BARREL_PEAK);
      const lightFade =
        p > SM.BARREL_PEAK
          ? 1.0 - ((p - SM.BARREL_PEAK) / (1.0 - SM.BARREL_PEAK)) * 0.85
          : 1.0;

      /* Sun light */
      three.sunLight.intensity =
        sunAlpha > 0.01 ? (8 + lightRise * 14) * lightFade * sunAlpha : 0;

      /* Moon light */
      three.moonLight.intensity =
        moonAlph > 0.01 ? (5 + lightRise * 10) * lightFade * moonAlph : 0;

      /* ── Update wave shader uniforms ─────────────────────────────────
       * uLightPos   : posisi dominant light (sun atau moon)
       * uLightColor : warm (sun) atau cool (moon)
       * uLightIntensity: normalized 0..1                                */
      const domPos = useSun
        ? three.sunGroup.position
        : three.moonGroup.position;

      /* Lerp warna light (crossfade sun↔moon selama transisi) */
      const SUN_COLOR = new THREE.Color(1.0, 0.94, 0.78);
      const MOON_COLOR = new THREE.Color(0.73, 0.85, 0.67);
      const blendedLight = new THREE.Color().lerpColors(
        MOON_COLOR,
        SUN_COLOR,
        dayBlend,
      );

      const domIntensity = useSun
        ? three.sunLight.intensity
        : three.moonLight.intensity;

      three.waveUniforms.uTime.value = elapsed;
      three.waveUniforms.uScroll.value = p;
      three.waveUniforms.uZone.value = zoneVal;
      three.waveUniforms.uBiolumIntensity.value = biolumInt;
      three.waveUniforms.uDayBlend.value = dayBlend;
      three.waveUniforms.uCameraPos.value.copy(three.camera.position);
      three.waveUniforms.uLightPos.value.copy(domPos);
      three.waveUniforms.uLightColor.value.copy(blendedLight);
      three.waveUniforms.uLightIntensity.value = Math.min(1, domIntensity / 22);

      /* Ambient scene light dari dayBlend */
      three.ambLight.intensity = 1.5 + dayBlend * 2.0;
      three.ambLight.color.setRGB(
        0.03 + dayBlend * 0.025,
        0.05 + dayBlend * 0.035,
        0.045 + dayBlend * 0.055,
      );

      /* Fog color transition */
      if (sb) {
        const fLerp = dayBlend;
        three.scene.fog.color.setRGB(
          sb.horizR * 0.4 + (1 - fLerp) * 0.004,
          sb.horizG * 0.4 + (1 - fLerp) * 0.01,
          sb.horizB * 0.4 + (1 - fLerp) * 0.02,
        );
      }

      /* ── Content float up ────────────────────────────────────────────── */
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
      clearInterval(skyUpdateInterval);
      window.removeEventListener("resize", onResize);
      sunDriftTl.kill();
      moonDriftTl.kill();
      three.dispose();
    };
  }, []);

  /* ── JSX ──────────────────────────────────────────────────────────────── */
  /* Ambil initial sky state untuk render (CSS awal) */
  const initSky = getSkyState();
  const isDay = initSky.dayBlend >= 0.5;

  /* Warna aksen UI berdasarkan waktu: siang = teal biru, malam = teal hijau */
  const accentColor = isDay ? "#22a8d8" : "#28b4a0";
  const accentDim = isDay ? "#156890" : "#184a42";
  const textColor = isDay ? "#c8e8f0" : "#a8d8d0";
  const textDim = isDay ? "#3a6878" : "#3a7870";

  return (
    /*
     * wrapperRef: height 320vh — scroll container.
     * ScrollTrigger monitor ini → progress 0..1.
     */
    <div
      ref={wrapperRef}
      id="hero"
      style={{ height: "320vh", position: "relative" }}
    >
      {/*
       * stickyRef: CSS sticky, 100vh — tetap di viewport.
       * Background gradient di-set dari rAF setiap frame (sky transition).
       * Initial background dari getSkyGradient(initSky).
       */}
      <div
        ref={stickyRef}
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background: getSkyGradient(initSky),
          transition: "none" /* transisi dihandle di rAF, bukan CSS */,
        }}
      >
        {/* Surface shimmer (warna berubah siang/malam) */}
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
              background: `linear-gradient(90deg,transparent,${isDay ? "rgba(30,170,220,0.50)" : "rgba(40,180,160,0.50)"} 50%,transparent)`,
              animation: "shimH 7s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: "1px",
              marginTop: "5px",
              background: `linear-gradient(90deg,transparent 18%,${isDay ? "rgba(50,190,230,0.20)" : "rgba(55,200,175,0.20)"} 50%,transparent 82%)`,
              animation: "shimH 10s ease-in-out infinite reverse",
            }}
          />
        </div>

        {/* Hero content (z:3) */}
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

          {/* Sky time badge — menampilkan waktu lokal user */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "5px 14px",
              borderRadius: "100px",
              marginBottom: "1.8rem",
              border: `1px solid ${accentColor}38`,
              background: `${accentColor}12`,
              backdropFilter: "blur(6px)",
            }}
          >
            {/* Ikon matahari/bulan berdasarkan waktu */}
            <span style={{ fontSize: "0.7rem" }}>{isDay ? "☀️" : "🌙"}</span>
            <span
              ref={skyLabelRef}
              style={{
                fontFamily: "JetBrains Mono,monospace",
                fontSize: "0.60rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: accentColor,
              }}
            >
              {getSkyLabel(initSky)}
            </span>
            <span
              style={{
                width: "1px",
                height: "12px",
                background: `${accentColor}44`,
                display: "inline-block",
              }}
            />
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: accentColor,
                boxShadow: `0 0 8px ${accentColor}`,
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
                color: accentColor,
              }}
            >
              Available
            </span>
          </div>

          {/* Heading */}
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
                    color: li === 1 ? "transparent" : textColor,
                    WebkitTextStroke: li === 1 ? `1px ${accentColor}88` : "0",
                    textShadow: li !== 1 ? `0 0 40px ${accentColor}20` : "none",
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
              color: textDim,
              maxWidth: "450px",
              lineHeight: 1.7,
            }}
          >
            Student developer at{" "}
            <span style={{ color: accentColor, fontWeight: 500 }}>
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
                  background: `${accentColor}14`,
                  border: `1px solid ${accentColor}30`,
                  fontFamily: "JetBrains Mono,monospace",
                  fontSize: "0.67rem",
                  letterSpacing: "0.06em",
                  color: accentColor,
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
                background: isDay
                  ? "linear-gradient(135deg,#125c7a,#0b3a50)"
                  : "linear-gradient(135deg,#1a5a52,#0e3830)",
                border: `1px solid ${accentColor}44`,
                borderRadius: "6px",
                fontFamily: "Outfit,sans-serif",
                fontWeight: 600,
                fontSize: "0.87rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: textColor,
                boxShadow: `0 6px 18px ${accentColor}28`,
              }}
              onMouseEnter={(e) =>
                gsap.to(e.currentTarget, {
                  y: -3,
                  boxShadow: `0 12px 24px ${accentColor}44`,
                  duration: 0.2,
                })
              }
              onMouseLeave={(e) =>
                gsap.to(e.currentTarget, {
                  y: 0,
                  boxShadow: `0 6px 18px ${accentColor}28`,
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
                background: "rgba(3,12,14,0.45)",
                border: `1px solid ${accentColor}28`,
                borderRadius: "6px",
                fontFamily: "Outfit,sans-serif",
                fontWeight: 400,
                fontSize: "0.87rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: textDim,
                backdropFilter: "blur(6px)",
                transition: "border-color .2s,color .2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${accentColor}70`;
                e.currentTarget.style.color = accentColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${accentColor}28`;
                e.currentTarget.style.color = textDim;
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
                    color: accentColor,
                    lineHeight: 1,
                    textShadow: `0 0 16px ${accentColor}44`,
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
                    color: accentDim,
                    marginTop: "4px",
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Three.js canvas (z:4) */}
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

        {/* Depth gauge (z:5) */}
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
              background: `linear-gradient(to bottom,transparent,${accentColor}55)`,
            }}
          />
          <span
            ref={depthRef}
            style={{
              fontFamily: "JetBrains Mono,monospace",
              fontSize: "0.61rem",
              letterSpacing: "0.12em",
              color: `${accentColor}58`,
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
              color: `${accentColor}35`,
            }}
          >
            depth
          </span>
        </div>

        {/* Tab row (z:5) */}
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
                borderRight: i < 2 ? `1px solid ${accentColor}22` : "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.querySelector(".tl").style.color = accentColor;
                e.currentTarget.querySelector(".tl-line").style.transform =
                  "scaleX(1)";
                e.currentTarget.querySelector(".tl-line").style.background =
                  `${accentColor}66`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.querySelector(".tl").style.color =
                  i === 0 ? accentColor : accentDim;
                e.currentTarget.querySelector(".tl-line").style.transform =
                  i === 0 ? "scaleX(1)" : "scaleX(0.28)";
                e.currentTarget.querySelector(".tl-line").style.background =
                  i === 0 ? `${accentColor}55` : `${accentDim}44`;
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
                  color: i === 0 ? accentColor : accentDim,
                  marginBottom: "0.5rem",
                  transition: "color .25s",
                }}
              >
                {label}
              </span>
              <div
                className="tl-line"
                style={{
                  height: "1px",
                  background: i === 0 ? `${accentColor}55` : `${accentDim}44`,
                  transformOrigin: "left center",
                  transform: i === 0 ? "scaleX(1)" : "scaleX(0.28)",
                  transition: "transform .3s ease,background .3s ease",
                  marginRight: "2rem",
                }}
              />
            </button>
          ))}
        </div>

        <style>{`
          @keyframes shimH {
            0%,100%{opacity:.22;transform:scaleX(.82) translateX(-12%);}
            50%     {opacity:1; transform:scaleX(1)   translateX(12%); }
          }
          @keyframes dotPulse {
            0%,100%{opacity:1;    box-shadow:0 0 8px ${accentColor};}
            50%    {opacity:.32;  box-shadow:0 0 3px ${accentColor};}
          }
        `}</style>
      </div>
    </div>
  );
};

export default Hero;
