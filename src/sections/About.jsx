/**
 * About.jsx
 * Contains two sub-sections:
 *
 * 1. "Who I Am" — two-column bio grid with a large pull-quote
 *    and a quick-facts list. Cards animate in via ScrollTrigger.
 *
 * 2. Skills Marquee — two rows of tech skills scrolling in opposite
 *    directions, infinitely and seamlessly.  Each row is a flex strip
 *    duplicated 3× so GSAP can loop it cleanly.
 *    Inspired by the "You Win We Grin" style from griflan.com.
 *    - Row A → scrolls LEFT  (default direction)
 *    - Row B → scrolls RIGHT (reversed)
 *    Hovering either row slows it down.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SectionWrapper from "../components/SectionWrapper";

// ── Data ──────────────────────────────────────────────────────────────────────
const SKILLS_A = [
  { name: "React", icon: "⚛️" },
  { name: "Node.js", icon: "🟩" },
  { name: "PHP", icon: "🐘" },
  { name: "Laravel", icon: "🔴" },
  { name: "MySQL", icon: "🗄️" },
  { name: "Tailwind CSS", icon: "🎨" },
  { name: "JavaScript", icon: "🟡" },
  { name: "REST API", icon: "🔌" },
];

const SKILLS_B = [
  { name: "Git", icon: "🌿" },
  { name: "Figma", icon: "🖼️" },
  { name: "Vite", icon: "⚡" },
  { name: "Express.js", icon: "🚂" },
  { name: "Vue.js", icon: "🍀" },
  { name: "Bootstrap", icon: "🅱️" },
  { name: "PostgreSQL", icon: "🐘" },
  { name: "TypeScript", icon: "🔷" },
];

// ── MarqueeRow component ──────────────────────────────────────────────────────
/**
 * Renders a single infinite-scrolling skill row.
 * The items are triplicated so there is always overflow on both sides
 * and the GSAP animation can loop from position 0 → -33.33% seamlessly.
 *
 * @param {Array}   items     - Array of { name, icon }
 * @param {number}  duration  - Full loop duration in seconds
 * @param {boolean} reverse   - If true the row scrolls right instead of left
 */
const MarqueeRow = ({ items, duration = 28, reverse = false }) => {
  const trackRef = useRef(null);

  useGSAP(
    () => {
      const track = trackRef.current;

      /**
       * Move the strip by exactly one "set" width (–33.33% of 3× strip).
       * Because the content repeats every 33.33%, xPercent –33.33
       * looks identical to 0% → seamless loop on repeat.
       */
      const tween = gsap.to(track, {
        xPercent: reverse ? 0 : -33.33,
        duration,
        ease: "none",
        repeat: -1,
        // Start reversed row at –33.33% so it begins in the same visual
        // position as the forward row
        startAt: reverse ? { xPercent: -33.33 } : {},
      });

      // Slow down on hover (feels premium)
      const slowDown = () => gsap.to(tween, { timeScale: 0.3, duration: 0.5 });
      const speedUp = () => gsap.to(tween, { timeScale: 1, duration: 0.8 });

      const parent = track.parentElement;
      parent.addEventListener("mouseenter", slowDown);
      parent.addEventListener("mouseleave", speedUp);

      return () => {
        parent.removeEventListener("mouseenter", slowDown);
        parent.removeEventListener("mouseleave", speedUp);
      };
    },
    { scope: trackRef },
  );

  // Triple the items for seamless loop
  const tripled = [...items, ...items, ...items];

  return (
    <div
      style={{
        overflow: "hidden",
        // Fade edges with a mask
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        maskImage:
          "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
      }}
    >
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: "0",
          width: "max-content", // let it be as wide as it needs
          willChange: "transform",
        }}
      >
        {tripled.map((skill, i) => (
          <SkillPill key={i} skill={skill} />
        ))}
      </div>
    </div>
  );
};

// ── SkillPill ─────────────────────────────────────────────────────────────────
/**
 * Individual skill item inside the marquee.
 * Shows icon + name separated by a vertical rule.
 */
const SkillPill = ({ skill }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "12px",
      padding: "0 2.5rem",
      height: "72px",
      whiteSpace: "nowrap",
      borderRight: "1px solid rgba(107,124,62,0.2)",
    }}
  >
    <span style={{ fontSize: "1.4rem" }}>{skill.icon}</span>
    <span
      style={{
        fontFamily: "Syne, sans-serif",
        fontWeight: 700,
        fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
        letterSpacing: "-0.01em",
        color: "#c8c8c0",
      }}
    >
      {skill.name}
    </span>
  </div>
);

// ── Main About component ──────────────────────────────────────────────────────
const About = () => {
  const bioRef = useRef(null);
  const quoteRef = useRef(null);
  const factsRef = useRef(null);
  const marqueeARef = useRef(null);
  const marqueeBRef = useRef(null);

  // Animate bio cards on scroll
  useGSAP(
    () => {
      gsap.fromTo(
        [quoteRef.current, factsRef.current],
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: {
            trigger: bioRef.current,
            start: "top 80%",
            once: true,
          },
        },
      );

      // Row label animations
      [marqueeARef.current, marqueeBRef.current].forEach((el, i) => {
        gsap.fromTo(
          el,
          { x: i === 0 ? -30 : 30, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.6,
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              once: true,
            },
          },
        );
      });
    },
    { scope: bioRef },
  );

  return (
    <SectionWrapper id="about" label="01 / ABOUT">
      {/* ════════════════════════════════════════════════
          BIO GRID
      ════════════════════════════════════════════════ */}
      <div ref={bioRef}>
        {/* Section heading */}
        <h2
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(2.2rem, 5vw, 4rem)",
            letterSpacing: "-0.02em",
            color: "#e4e4dc",
            marginBottom: "3rem",
            lineHeight: 1.05,
          }}
        >
          A developer who{" "}
          <span
            style={{
              color: "transparent",
              WebkitTextStroke: "1px rgba(154,176,80,0.8)",
            }}
          >
            thinks
          </span>{" "}
          before
          <br />
          he types.
        </h2>

        {/* Two-column bio */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
            marginBottom: "4rem",
          }}
        >
          {/* Pull quote card */}
          <div
            ref={quoteRef}
            style={{
              padding: "2rem",
              background: "rgba(20,20,19,0.7)",
              border: "1px solid rgba(107,124,62,0.2)",
              borderRadius: "12px",
              backdropFilter: "blur(8px)",
            }}
          >
            <p
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "1.25rem",
                lineHeight: 1.45,
                color: "#e4e4dc",
                marginBottom: "1rem",
              }}
            >
              "Saya percaya kode yang bersih adalah kode yang berbicara
              sendiri."
            </p>
            <p
              style={{
                fontFamily: "Outfit, sans-serif",
                fontWeight: 300,
                fontSize: "0.9rem",
                lineHeight: 1.7,
                color: "#7a7a74",
              }}
            >
              Siswa di SMK Negeri 4 Bogor dengan ketertarikan tinggi pada
              pengembangan perangkat lunak. Setiap baris kode bagi saya adalah
              kesempatan untuk belajar sesuatu yang baru dan menciptakan sesuatu
              yang bermakna.
            </p>
          </div>

          {/* Quick facts card */}
          <div
            ref={factsRef}
            style={{
              padding: "2rem",
              background: "rgba(20,20,19,0.7)",
              border: "1px solid rgba(107,124,62,0.2)",
              borderRadius: "12px",
              backdropFilter: "blur(8px)",
            }}
          >
            <h3
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#9ab050",
                marginBottom: "1.25rem",
              }}
            >
              Quick Facts
            </h3>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {[
                {
                  icon: "🎓",
                  text: "SMK Negeri 4 Bogor — Software Engineering",
                },
                { icon: "💻", text: "Full-Stack Web Developer" },
                { icon: "🌱", text: "Currently learning DevOps & Cloud" },
                {
                  icon: "🎯",
                  text: "Passionate about clean, maintainable code",
                },
                { icon: "📍", text: "Bogor, Jawa Barat, Indonesia" },
              ].map(({ icon, text }) => (
                <li
                  key={text}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    fontFamily: "Outfit, sans-serif",
                    fontSize: "0.875rem",
                    color: "#a0a09a",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: "1px" }}>
                    {icon}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════
          SKILLS MARQUEE — full-bleed (outside max-width)
      ════════════════════════════════════════════════ */}
      <div style={{ margin: "0 -2rem" }}>
        {/* Divider header */}
        <div
          ref={marqueeARef}
          style={{
            textAlign: "center",
            padding: "0 2rem 1.5rem",
          }}
        >
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              letterSpacing: "-0.02em",
              color: "transparent",
              WebkitTextStroke: "1px rgba(154,176,80,0.5)",
              textTransform: "uppercase",
            }}
          >
            — WHAT I&apos;M GOOD AT —
          </span>
        </div>

        {/* Row A — scrolls left */}
        <div
          style={{
            borderTop: "1px solid rgba(107,124,62,0.15)",
            borderBottom: "1px solid rgba(107,124,62,0.15)",
            background: "rgba(10,10,9,0.5)",
          }}
        >
          <MarqueeRow items={SKILLS_A} duration={30} reverse={false} />
        </div>

        {/* Gap between rows */}
        <div style={{ height: "2px", background: "rgba(107,124,62,0.06)" }} />

        {/* Row B — scrolls right */}
        <div
          ref={marqueeBRef}
          style={{
            borderTop: "1px solid rgba(107,124,62,0.1)",
            borderBottom: "1px solid rgba(107,124,62,0.1)",
            background: "rgba(10,10,9,0.3)",
          }}
        >
          <MarqueeRow items={SKILLS_B} duration={24} reverse={true} />
        </div>
      </div>
    </SectionWrapper>
  );
};

export default About;
