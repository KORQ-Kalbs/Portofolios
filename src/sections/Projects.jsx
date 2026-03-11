/**
 * Projects.jsx — Twilight Zone: Flashlight Cursor + Griflan Interaction
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  Z-LAYER STACK                                                             ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  z:0  Three.js canvas — floor + stray fish (InstancedMesh, 8 fish)        ║
 * ║  z:1  HTML content — project list (pointer-events: auto)                  ║
 * ║  z:2  Flashlight overlay — dark radial-gradient with transparent hole     ║
 * ║       (pointer-events: none → events pass through to z:1 content)        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * FLASHLIGHT FORMULA (dari prompt):
 *   visibility = smoothstep(radius, radius-blur, distance(cursor, fragCoord))
 *
 * Implementasi di CSS radial-gradient:
 *   transparent 0px → transparent (r-blur)px → dark r px → full-dark (r+40)px
 *   Inner circle = transparent  → content visible  (high smoothstep value)
 *   Outer ring   = dark overlay → content hidden   (low smoothstep value)
 *
 * RAYCASTER (mouse → 3D world):
 *   mousemove → NDC coords → raycaster.setFromCamera → ray.intersectPlane
 *   → floor plane Y=-8 → hit.xyz → flashLight.position.set(hit.x, hit.y+3, hit.z)
 *   Akurasi 1:1 dengan gerakan mouse (tidak ada hardcoded offset).
 *
 * FLOOR MORPHING (About seabed → Projects trench):
 *   window.__aboutFloorPositions: Float32Array dari About (seabed)
 *   trenchPositions:              Float32Array computed here (deep trench)
 *   KEDUANYA: PlaneGeometry 48×24, 48×24 segments → VERTEX COUNT IDENTIK
 *   ScrollTrigger scrub → morphProgress 0→1 → rAF lerps Y per-vertex
 *
 * GRIFLAN INTERACTION:
 *   idle   → title dimmed, no tags
 *   hover  → title brighter, tags drop down with gravitational float
 *   active → title shifts left (scale 0.6), preview slides from right
 *   (all via GSAP timeline, not CSS transitions)
 *
 * STRAY FISH:
 *   8 fish (InstancedMesh, shared geometry with About for shadow aesthetics).
 *   Circular orbit paths, varying speed/size. Caught by flashlight beam.
 *   Low-poly flat-shading creates dramatic shadow on rocky trench floor.
 *
 * CURSOR STATE:
 *   Projects.jsx ScrollTrigger → body.classList.toggle("cursor-flashlight")
 *   Cursor.jsx MutationObserver → GSAP morph Robot ↔ Flashlight SVG
 */

import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLightRef } from "../context/LightContext";
import { smoothScrollTo } from "../utils/gsapConfig";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
/** Flashlight radii in pixels */
const FL_RADIUS = 240; /* transparent circle radius           */
const FL_BLUR = 65; /* feather/blend zone width            */
const FL_RADIUS_HOVER = 290; /* expanded on project hover           */

/** Floor geometry — MUST match About.jsx for vertex-level morphing */
const FLOOR_W = 48;
const FLOOR_H = 24;
const FLOOR_SEGW = 48;
const FLOOR_SEGH = 24;

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT DATA
// ─────────────────────────────────────────────────────────────────────────────
const PROJECTS = [
  {
    id: 1,
    title: "E-Commerce Platform",
    year: "2024",
    tags: ["React", "Laravel", "MySQL", "Tailwind"],
    desc: "Full-featured online store dengan cart, checkout, dan admin dashboard.",
    preview:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&q=80",
    accent: "#7a9040",
    role: "Full-Stack Developer",
    href: "#",
  },
  {
    id: 2,
    title: "Real-time Chat App",
    year: "2024",
    tags: ["Node.js", "Socket.io", "React", "MongoDB"],
    desc: "WebSocket messaging dengan rooms, typing indicators, dan file sharing.",
    preview:
      "https://images.unsplash.com/photo-1611746872915-64382b5c76da?w=900&q=80",
    accent: "#5a7a60",
    role: "Backend Developer",
    href: "#",
  },
  {
    id: 3,
    title: "School Management System",
    year: "2023",
    tags: ["PHP", "MySQL", "Bootstrap", "Laravel"],
    desc: "Sistem akademik untuk jadwal, nilai, dan rekord pelajar.",
    preview:
      "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=900&q=80",
    accent: "#6a7a30",
    role: "Full-Stack Developer",
    href: "#",
  },
  {
    id: 4,
    title: "Weather Dashboard",
    year: "2023",
    tags: ["React", "OpenWeather API", "Chart.js"],
    desc: "Live weather forecast dengan interactive maps dan historical charts.",
    preview:
      "https://images.unsplash.com/photo-1504608524841-42584120d17a?w=900&q=80",
    accent: "#4a6070",
    role: "Frontend Developer",
    href: "#",
  },
  {
    id: 5,
    title: "Portfolio CMS",
    year: "2024",
    tags: ["Vue.js", "Strapi", "PostgreSQL", "REST API"],
    desc: "CMS headless untuk manajemen konten portfolio dengan API fleksibel.",
    preview:
      "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=900&q=80",
    accent: "#5a5080",
    role: "Full-Stack Developer",
    href: "#",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LOW-POLY FISH GEOMETRY (shared shape with About for shadow aesthetics)
// ─────────────────────────────────────────────────────────────────────────────
function makeFishGeo() {
  const nose = [0.6, 0.0, 0.0],
    topL = [0.0, 0.2, 0.14],
    topR = [0.0, 0.2, -0.14],
    botL = [0.0, -0.16, 0.12],
    botR = [0.0, -0.16, -0.12],
    tail = [-0.5, 0.0, 0.0],
    ttl = [-0.6, 0.28, 0.08],
    tbl = [-0.6, -0.28, 0.08];
  const tris = [
    nose,
    topL,
    botL,
    topL,
    tail,
    botL,
    nose,
    botR,
    topR,
    topR,
    botR,
    tail,
    nose,
    topR,
    topL,
    topL,
    topR,
    tail,
    nose,
    botL,
    botR,
    botL,
    botR,
    tail,
    tail,
    ttl,
    tbl,
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => {
    pos[i * 3] = v[0];
    pos[i * 3 + 1] = v[1];
    pos[i * 3 + 2] = v[2];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals(); /* per-face normals = flat shading */
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────
// THREE.JS SCENE BUILDER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Build Twilight Zone scene.
 * @param {HTMLCanvasElement} canvas
 * @param {number}            sectionH  — pixel height of section element
 * @param {object}            iLight    — initial LightContext data
 */
function buildScene(canvas, sectionH, iLight) {
  const W = canvas.clientWidth || window.innerWidth;
  const H = sectionH || window.innerHeight;

  /* ── Renderer ─────────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;

  /* ── Scene ───────────────────────────────────────────────────────── */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x010403, 0.06); /* dense abyss fog */

  /* ── Camera ──────────────────────────────────────────────────────── */
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 80);
  camera.position.set(0, 7, 14);
  camera.lookAt(0, -2, 0);

  /* ════════════════════════════════════════════════════════════════
   * FLOOR — 48×24 plane, 48×24 segments (IDENTICAL to About.jsx)
   * Initial shape = deep rocky trench.
   * Morphed FROM About seabed positions via window.__aboutFloorPositions.
   * ════════════════════════════════════════════════════════════════ */
  const floorGeo = new THREE.PlaneGeometry(
    FLOOR_W,
    FLOOR_H,
    FLOOR_SEGW,
    FLOOR_SEGH,
  );
  floorGeo.rotateX(-Math.PI / 2);

  const fPos = floorGeo.attributes.position;
  const fCount = fPos.count;

  /* Deep trench: center depressed, edges raised, jagged rock noise */
  const trenchPos = new Float32Array(fCount * 3);
  for (let i = 0; i < fCount; i++) {
    const x = fPos.getX(i),
      z = fPos.getZ(i);
    /* Trench V-shape: deeper at center, shallower at x-edges */
    const trenchV = -Math.cos((x / FLOOR_W) * Math.PI * 0.9) * 3.8;
    /* Rocky jaggedness */
    const rock =
      Math.sin(x * 1.45 + 0.8) * Math.cos(z * 1.12) * 0.85 +
      Math.sin(x * 2.9 + z * 1.6) * 0.38;
    const newY = -8.5 + trenchV + rock;
    fPos.setY(i, newY);
    trenchPos[i * 3] = fPos.getX(i);
    trenchPos[i * 3 + 1] = newY;
    trenchPos[i * 3 + 2] = fPos.getZ(i);
  }
  fPos.needsUpdate = true;
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshLambertMaterial({ color: 0x050808 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  scene.add(floorMesh);

  /* ════════════════════════════════════════════════════════════════
   * STRAY FISH — InstancedMesh (8 fish, 1 draw call)
   * Deeper and slower than About fish. Caught by flashlight beam.
   * Low-poly flat shading casts dramatic shadows on trench walls.
   * ════════════════════════════════════════════════════════════════ */
  const FISH_N = 8;
  const fishGeo = makeFishGeo();
  const fishMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(0.12, 0.5, 0.42),
    emissive: new THREE.Color(0.01, 0.06, 0.05),
    shininess: 25,
    flatShading: true,
  });
  const fishIM = new THREE.InstancedMesh(fishGeo, fishMat, FISH_N);
  fishIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  /* Per-fish orbit config: { cx, cy, cz, rx, ry, rz, speed, phase } */
  const fishOrbits = Array.from({ length: FISH_N }, (_, i) => ({
    cx: (i % 2 === 0 ? -1 : 1) * (3 + Math.random() * 5),
    cy: -2 + Math.random() * 2.5,
    cz: -5 + Math.random() * 8,
    rx: 3.5 + Math.random() * 3.5,
    ry: 1.0 + Math.random() * 1.0,
    rz: 2.5 + Math.random() * 2.5,
    speed: 0.55 + Math.random() * 0.45,
    phase: Math.random() * Math.PI * 2,
  }));

  /* Per-fish color variation */
  const tmpC = new THREE.Color();
  for (let i = 0; i < FISH_N; i++) {
    tmpC.setHSL(
      0.44 + Math.random() * 0.14,
      0.45 + Math.random() * 0.25,
      0.28 + Math.random() * 0.18,
    );
    fishIM.setColorAt(i, tmpC);
  }
  if (fishIM.instanceColor) fishIM.instanceColor.needsUpdate = true;
  scene.add(fishIM);

  /* ════════════════════════════════════════════════════════════════
   * LIGHTS
   * ════════════════════════════════════════════════════════════════ */
  /* Flashlight: PointLight yang mengikuti mouse */
  const flashLight = new THREE.PointLight(0xfff8e0, 16.0, 22, 2.0);
  flashLight.position.set(0, 4, 5);
  scene.add(flashLight);

  /* Ambient: sangat minimal — abyss hampir tanpa cahaya */
  const ambLight = new THREE.AmbientLight(0x050808, 1.8);
  scene.add(ambLight);

  /* Dim fill: sedikit detail di luar lingkaran senter */
  const rimLight = new THREE.PointLight(0x0a1a10, 0.8, 35, 2);
  rimLight.position.set(-8, 5, 8);
  scene.add(rimLight);

  /* Plane untuk Raycaster intersection (posisi Y=−8 = dasar trench) */
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 8);

  /* ── Dispose ──────────────────────────────────────────────────── */
  const dispose = () => {
    [floorGeo, floorMat, fishGeo, fishMat].forEach((o) => o?.dispose?.());
    renderer.dispose();
  };

  return {
    renderer,
    scene,
    camera,
    floorGeo,
    floorMesh,
    trenchPos,
    fishIM,
    fishOrbits,
    flashLight,
    ambLight,
    floorPlane,
    dispose,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAVITY TAG COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * One tag pill with gravitational float behavior.
 *
 * ENTER: drops down from title + gravitational bob (GSAP infinite yoyo)
 * LEAVE: floats back up and fades out
 *
 * "Gravitational pull": finalY = baseOffset + Math.sin(index×1.5)×2
 * → tags settle at slightly different depths below title (gravitational spread)
 * → then bob around that resting position (suspended in water simulation)
 *
 * @param {string}  tag
 * @param {number}  index
 * @param {boolean} visible — controlled by parent hover/active state
 * @param {string}  accent  — hex color for pill border/text
 */
const GravityTag = ({ tag, index, visible, accent }) => {
  const ref = useRef(null);
  const bobRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    bobRef.current?.kill();

    if (visible) {
      /* Drop + settle, then start gravitational bob */
      const restY = index * 3; /* gravity spread: deeper for later tags */
      gsap.fromTo(
        ref.current,
        { y: -14, opacity: 0, scale: 0.82 },
        {
          y: restY,
          opacity: 1,
          scale: 1,
          duration: 0.48 + index * 0.04,
          delay: index * 0.055,
          ease: "power2.out",
          onComplete() {
            /* Gravitational bob: oscillate around resting position */
            const bobAmp = 3 + Math.sin(index * 1.5) * 1.8;
            bobRef.current = gsap.timeline({ repeat: -1, yoyo: true });
            bobRef.current.to(ref.current, {
              y: restY + bobAmp,
              duration: 1.7 + index * 0.2,
              ease: "sine.inOut",
            });
          },
        },
      );
    } else {
      /* Float up and fade */
      gsap.to(ref.current, {
        y: -10,
        opacity: 0,
        scale: 0.82,
        duration: 0.28,
        delay: Math.max(0, (3 - index) * 0.025),
        ease: "power2.in",
      });
    }

    return () => bobRef.current?.kill();
  }, [visible, index]);

  return (
    <span
      ref={ref}
      style={{
        display: "inline-block",
        padding: "3px 11px",
        borderRadius: "4px",
        background: `${accent}1a`,
        border: `1px solid ${accent}44`,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "0.57rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: accent,
        opacity: 0,
        willChange: "transform, opacity",
        marginRight: "7px",
        marginBottom: "4px",
      }}
    >
      {tag}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ROW — Griflan Interaction
// ─────────────────────────────────────────────────────────────────────────────
/**
 * One row in the center project list.
 *
 * STATES (controlled by hover + active):
 *   idle   → title dimmed, no tags, number visible
 *   hover  → title brighter + letter-spacing tightens, tags appear w/ gravity
 *   active → title shifts LEFT 30% + scales 0.58, preview slides from RIGHT
 *
 * PREVIEW LAZY LOAD:
 *   <img data-src="..."> → src only set on first activate (imgLoadedRef flag)
 *   Prevents loading all preview images on page load.
 */
const ProjectRow = ({ project, index, isActive, onActivate, onDeactivate }) => {
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef(null);
  const titleRef = useRef(null);
  const numRef = useRef(null);
  const previewRef = useRef(null);
  const lazyLoaded = useRef(false);

  /* ── Hover in ───────────────────────────────────────────────────── */
  const onEnter = useCallback(() => {
    setHovered(true);
    gsap.to(titleRef.current, {
      letterSpacing: "-0.005em",
      duration: 0.28,
      ease: "power2.out",
    });
    gsap.to(numRef.current, { x: -7, opacity: 0.28, duration: 0.22 });
  }, []);

  /* ── Hover out ──────────────────────────────────────────────────── */
  const onLeave = useCallback(() => {
    setHovered(false);
    gsap.to(titleRef.current, {
      letterSpacing: "-0.03em",
      duration: 0.32,
      ease: "power2.inOut",
    });
    gsap.to(numRef.current, { x: 0, opacity: 0.14, duration: 0.28 });
  }, []);

  /* ── Click: Griflan shift ────────────────────────────────────────── */
  const onClick = useCallback(
    (e) => {
      e.stopPropagation();
      isActive ? onDeactivate() : onActivate(project.id);
    },
    [isActive, onActivate, onDeactivate, project.id],
  );

  /* ── Active state animation ─────────────────────────────────────── */
  useEffect(() => {
    if (!titleRef.current || !previewRef.current) return;

    if (isActive) {
      /* Title: cinematic shift to left */
      gsap.to(titleRef.current, {
        xPercent: -28,
        scale: 0.58,
        opacity: 0.65,
        transformOrigin: "left center",
        duration: 0.62,
        ease: "power3.inOut",
      });
      /* Preview: slide in from right */
      gsap.fromTo(
        previewRef.current,
        { xPercent: 105, opacity: 0 },
        { xPercent: 0, opacity: 1, duration: 0.72, ease: "power3.inOut" },
      );
      /* Lazy load image on first activation */
      if (!lazyLoaded.current) {
        lazyLoaded.current = true;
        const img = previewRef.current?.querySelector("img[data-src]");
        if (img) img.src = img.getAttribute("data-src");
      }
    } else {
      /* Restore title */
      gsap.to(titleRef.current, {
        xPercent: 0,
        scale: 1,
        opacity: 1,
        transformOrigin: "left center",
        duration: 0.52,
        ease: "power3.inOut",
      });
      /* Slide preview out */
      gsap.to(previewRef.current, {
        xPercent: 108,
        opacity: 0,
        duration: 0.44,
        ease: "power3.in",
      });
    }
  }, [isActive]);

  const dimTitle = !hovered && !isActive;

  return (
    <div
      ref={rowRef}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        position: "relative",
        padding: "1.85rem 3.5rem",
        borderBottom: "1px solid rgba(255,255,255,0.042)",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        background: hovered ? "rgba(255,255,255,0.018)" : "transparent",
        transition: "background 0.3s",
      }}
    >
      {/* Row number (top-left hint) */}
      <span
        ref={numRef}
        style={{
          position: "absolute",
          left: "1.4rem",
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.52rem",
          letterSpacing: "0.15em",
          color: `${project.accent}55`,
          opacity: 0.14,
          willChange: "transform, opacity",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* ── Title block ─────────────────────────────────────────────── */}
      <div ref={titleRef} style={{ willChange: "transform, opacity" }}>
        <h2
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(1.85rem, 4.8vw, 3.6rem)",
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            color: dimTitle
              ? "rgba(160,190,180,0.50)"
              : "rgba(230,245,240,0.96)",
            margin: 0,
            transition: "color 0.22s ease",
          }}
        >
          {project.title}
        </h2>

        {/* Meta: year + role */}
        <div
          style={{
            display: "flex",
            gap: "1.4rem",
            marginTop: "0.38rem",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.58rem",
              letterSpacing: "0.12em",
              color: `${project.accent}88`,
            }}
          >
            {project.year}
          </span>
          <span
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "0.70rem",
              color: "rgba(160,185,175,0.28)",
              letterSpacing: "0.05em",
            }}
          >
            {project.role}
          </span>
        </div>

        {/* Gravity tags */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            marginTop: "0.72rem",
            minHeight: "26px",
          }}
        >
          {project.tags.map((tag, ti) => (
            <GravityTag
              key={tag}
              tag={tag}
              index={ti}
              visible={hovered || isActive}
              accent={project.accent}
            />
          ))}
        </div>
      </div>

      {/* ── Preview panel (slides from RIGHT on click) ───────────────── */}
      <div
        ref={previewRef}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "44%",
          height: "100%",
          overflow: "hidden",
          transform: "translateX(108%)",
          opacity: 0,
          willChange: "transform, opacity",
          borderLeft: `1px solid ${project.accent}28`,
        }}
      >
        {/* Gradient bg (shows before image loads) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(145deg, ${project.accent}18, #020608)`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "1.4rem",
          }}
        >
          <p
            style={{
              fontFamily: "Outfit, sans-serif",
              fontSize: "0.84rem",
              lineHeight: 1.65,
              color: "rgba(175,210,195,0.55)",
              marginBottom: "1rem",
            }}
          >
            {project.desc}
          </p>
          <a
            href={project.href}
            style={{
              display: "inline-block",
              padding: "7px 16px",
              background: project.accent,
              color: "#fff",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.60rem",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: "4px",
              alignSelf: "flex-start",
            }}
          >
            View Project →
          </a>
        </div>
        {/* Lazy-loaded image */}
        <img
          data-src={project.preview}
          alt={project.title}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            opacity: 0.32,
            mixBlendMode: "luminosity",
          }}
          onLoad={(e) => gsap.to(e.target, { opacity: 0.32, duration: 0.6 })}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Projects = () => {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const contentRef = useRef(null);
  const headerRef = useRef(null);

  /* Flashlight radius (animated via GSAP — use plain object so GSAP can tween it) */
  const flRadius = useRef({ v: FL_RADIUS });

  /* Mouse position refs */
  const mouseScreen = useRef({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const mouseWorld = useRef(new THREE.Vector3());

  /* State */
  const [activeProject, setActiveProject] = useState(null);
  const isInSectionRef = useRef(false);
  const isInViewRef = useRef(false);
  const morphProgress = useRef(0);

  /* Timing */
  const rafRef = useRef(null);
  const elapsedRef = useRef(0);
  const prevTsRef = useRef(null);
  const lightRef = useLightRef();

  // ── GSAP ────────────────────────────────────────────────────────────────
  useGSAP(
    () => {
      /* Header entrance */
      gsap.fromTo(
        headerRef.current?.querySelectorAll(".ptl") ?? [],
        { y: 45, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 82%",
            once: true,
          },
        },
      );

      /* ── Floor morphing ScrollTrigger ─────────────────────────────────
       * scrub: 2 → 2-second lag behind scroll (cinematic "sinking" feel)  */
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 92%",
        end: "top 25%",
        scrub: 2.0,
        onUpdate: (self) => {
          morphProgress.current = self.progress;
        },
      });

      /* ── Cursor class toggle → triggers Cursor.jsx morph ─────────────── */
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top 55%",
        end: "bottom 45%",
        onEnter: () => enterSection(),
        onLeave: () => leaveSection(),
        onEnterBack: () => enterSection(),
        onLeaveBack: () => leaveSection(),
      });

      function enterSection() {
        isInSectionRef.current = true;
        document.body.classList.add("cursor-flashlight");
        /* Expand flashlight from 0 to FL_RADIUS */
        gsap.fromTo(
          flRadius.current,
          { v: 0 },
          { v: FL_RADIUS, duration: 0.65, ease: "power2.out" },
        );
      }

      function leaveSection() {
        isInSectionRef.current = false;
        document.body.classList.remove("cursor-flashlight");
      }

      /* IntersectionObserver: pause rAF when off-screen */
      const io = new IntersectionObserver(
        ([e]) => {
          isInViewRef.current = e.isIntersecting;
        },
        { threshold: 0.01 },
      );
      if (sectionRef.current) io.observe(sectionRef.current);
      return () => io.disconnect();
    },
    { scope: sectionRef },
  );

  // ── Three.js + rAF ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const three = buildScene(canvas, section.offsetHeight, lightRef.current);
    const raycaster = new THREE.Raycaster();
    const fishDummy = new THREE.Object3D();

    /* ── Flashlight CSS gradient updater ────────────────────────────
     * Implements prompt formula visually:
     *   visibility = smoothstep(radius, radius-blur, dist(cursor, frag))
     * CSS: transparent center [0 … r-blur] → dark rim [r-blur … r+40] */
    const updateOverlayCSS = () => {
      if (!overlayRef.current) return;
      if (!isInSectionRef.current) {
        /* Outside section: fully dark (no hole) */
        overlayRef.current.style.background = "rgba(1,3,2,0.97)";
        return;
      }
      const { x, y } = mouseScreen.current;
      const r = flRadius.current.v;
      const b = FL_BLUR;
      overlayRef.current.style.background =
        `radial-gradient(circle at ${x}px ${y}px,` +
        `transparent 0px,` +
        `transparent ${Math.max(0, r - b)}px,` /* smoothstep inner (fully transparent) */ +
        `rgba(1,3,2,0.86) ${r}px,` /* smoothstep outer edge                */ +
        `rgba(1,3,2,0.98) ${r + 50}px)`; /* fully dark                            */
    };

    /* ── Mouse handler ────────────────────────────────────────────── */
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();

      /* Screen coords (for CSS overlay) */
      mouseScreen.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      /* Always update overlay for smooth response */
      updateOverlayCSS();

      if (!isInSectionRef.current) return;

      /* NDC → Raycaster → floor plane intersection */
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, three.camera);
      const hit = new THREE.Vector3();
      /* floorPlane: normal (0,1,0), constant 8 → plane at Y = -8 */
      if (raycaster.ray.intersectPlane(three.floorPlane, hit)) {
        mouseWorld.current.copy(hit);
        /* Flashlight 3D: hover 3 units above floor hit point */
        three.flashLight.position.set(hit.x, hit.y + 3, hit.z);
      }
    };

    /* Hover on project rows: expand flashlight radius */
    const onRowEnter = () =>
      gsap.to(flRadius.current, {
        v: FL_RADIUS_HOVER,
        duration: 0.3,
        ease: "power2.out",
      });
    const onRowLeave = () =>
      gsap.to(flRadius.current, {
        v: FL_RADIUS,
        duration: 0.4,
        ease: "power2.inOut",
      });
    /* Delegate using event capture */
    const onMouseEnterSection = (e) => {
      if (e.target.closest?.("[data-proj-row]")) {
        onRowEnter();
      }
    };
    const onMouseLeaveSection = (e) => {
      if (e.target.closest?.("[data-proj-row]")) {
        onRowLeave();
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    section.addEventListener("mouseenter", onMouseEnterSection, true);
    section.addEventListener("mouseleave", onMouseLeaveSection, true);

    /* Resize */
    const onResize = () => {
      const W = canvas.clientWidth,
        H = section.offsetHeight;
      three.camera.aspect = W / H;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    /* ── rAF loop ─────────────────────────────────────────────────── */
    const loop = (ts) => {
      if (prevTsRef.current !== null)
        elapsedRef.current += (ts - prevTsRef.current) * 0.001;
      prevTsRef.current = ts;
      const t = elapsedRef.current;

      if (!isInViewRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      /* Also update overlay on every frame (handles flashlight radius changes) */
      updateOverlayCSS();

      /* ── Floor morphing ─────────────────────────────────────────────
       * lerp(aboutSeabed, trench, morphProgress) per vertex Y only.
       * morphProgress is driven by ScrollTrigger scrub (smooth).       */
      const mp = morphProgress.current;
      const aboutPos = window.__aboutFloorPositions;
      if (aboutPos && mp > 0.001) {
        const fPos = three.floorGeo.attributes.position;
        for (let i = 0; i < fPos.count; i++) {
          const ay = aboutPos[i * 3 + 1];
          const ty = three.trenchPos[i * 3 + 1];
          fPos.setY(i, ay + (ty - ay) * mp);
        }
        fPos.needsUpdate = true;
        if (mp < 0.998) three.floorGeo.computeVertexNormals();
      }

      /* ── Stray fish orbit ───────────────────────────────────────────
       * Each fish follows a 3D elliptical orbit.
       * InstancedMesh.setMatrixAt() per frame (DynamicDrawUsage).      */
      const orbits = three.fishOrbits;
      for (let i = 0; i < orbits.length; i++) {
        const o = orbits[i];
        const angle = t * o.speed + o.phase;
        const fx = o.cx + Math.cos(angle) * o.rx;
        const fy = o.cy + Math.sin(angle * 0.38) * o.ry;
        const fz = o.cz + Math.sin(angle) * o.rz;
        fishDummy.position.set(fx, fy, fz);
        /* Orient toward travel direction */
        const dx = -Math.sin(angle) * o.rx;
        const dz = -Math.cos(angle) * o.rz;
        fishDummy.rotation.y = Math.atan2(dx, dz);
        /* Breathing scale */
        fishDummy.scale.setScalar(0.4 + Math.sin(t * 2.1 + i * 1.9) * 0.025);
        fishDummy.updateMatrix();
        three.fishIM.setMatrixAt(i, fishDummy.matrix);
      }
      three.fishIM.instanceMatrix.needsUpdate = true;

      /* ── Flashlight intensity modulation ────────────────────────────
       * Slightly weaker during day (more ambient light = less dramatic)*/
      const lData = lightRef.current;
      const nightBoost = 1.0 - lData.dayBlend * 0.45;
      three.flashLight.intensity = isInSectionRef.current
        ? 16.0 * nightBoost
        : 1.5;

      /* ── Render ─────────────────────────────────────────────────── */
      three.renderer.render(three.scene, three.camera);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      section.removeEventListener("mouseenter", onMouseEnterSection, true);
      section.removeEventListener("mouseleave", onMouseLeaveSection, true);
      document.body.classList.remove("cursor-flashlight");
      three.dispose();
    };
  }, []);

  // ── JSX ─────────────────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      id="projects"
      style={{
        position: "relative",
        minHeight: "165vh",
        background:
          "linear-gradient(180deg,#020805 0%,#010603 40%,#010302 100%)",
        overflow: "hidden",
      }}
    >
      {/* z:0 — Three.js canvas (floor + fish) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* z:1 — Project content (behind overlay but visible through flashlight hole) */}
      <div ref={contentRef} style={{ position: "relative", zIndex: 1 }}>
        {/* Section header */}
        <div ref={headerRef} style={{ padding: "5rem 3.5rem 2rem" }}>
          <div
            className="ptl"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.60rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(110,190,140,0.35)",
              marginBottom: "1rem",
            }}
          >
            ↓ 02 / Projects
          </div>
          <div
            className="ptl"
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(0.80rem, 1.8vw, 1.05rem)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(110,190,140,0.28)",
              marginBottom: "0.6rem",
            }}
          >
            Selected Work
          </div>
          <div
            style={{
              height: "1px",
              background:
                "linear-gradient(90deg, rgba(60,190,110,0.18), transparent)",
            }}
          />
        </div>

        {/* Project list */}
        <div
          onClick={() => setActiveProject(null)}
          style={{ maxWidth: "1300px", margin: "0 auto" }}
        >
          {PROJECTS.map((p, i) => (
            <div key={p.id} data-proj-row="true">
              <ProjectRow
                project={p}
                index={i}
                isActive={activeProject === p.id}
                onActivate={setActiveProject}
                onDeactivate={() => setActiveProject(null)}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "3.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid rgba(255,255,255,0.035)",
          }}
        >
          <button
            onClick={() => smoothScrollTo("contact")}
            style={{
              background: "none",
              border: "none",
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "1.05rem",
              color: "rgba(135,195,162,0.50)",
              cursor: "pointer",
              letterSpacing: "0.04em",
              transition: "color 0.22s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#a8d8b8")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(135,195,162,0.50)")
            }
          >
            Let's work together →
          </button>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.56rem",
              letterSpacing: "0.16em",
              color: "rgba(70,150,90,0.22)",
              textTransform: "uppercase",
            }}
          >
            {PROJECTS.length} Projects
          </span>
        </div>
      </div>

      {/* z:2 — Flashlight overlay (dark backdrop with transparent cursor hole)
       * pointer-events: none → mouse events pass through to z:1 content  */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background: "rgba(1,3,2,0.97)" /* default: fully dark */,
        }}
      />

      <style>{`
        body.cursor-flashlight { cursor: none !important; }
        #projects { --fl-accent: rgba(100,200,130,0.06); }
      `}</style>
    </section>
  );
};

export default Projects;
