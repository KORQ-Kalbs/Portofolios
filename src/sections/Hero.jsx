/**
 * Hero.jsx
 * Full-screen landing section with:
 * - Staggered character-by-character title reveal (manual split-text)
 * - Animated sub-headline and CTA buttons
 * - Olive grid / crosshair decorative element
 * - Diagonal olive accent line
 * - Animated scroll indicator at the bottom
 * - Parallax layer that reacts to mouse movement
 */
import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { smoothScrollTo } from "../utils/gsapConfig";

// ── Data ──────────────────────────────────────────────────────────────────────
const TITLE_LINES = ["I BUILD", "DIGITAL", "THINGS."];
const TAGS = ["React", "Node.js", "PHP", "Laravel", "Tailwind", "MySQL"];

// ── Helper: split string into animatable character spans ─────────────────────
/**
 * Returns an array of <span> elements, one per character.
 * Spaces are rendered as non-breaking spaces to preserve layout.
 */
const SplitChars = ({ text, className = "" }) =>
  text.split("").map((char, i) => (
    <span
      key={i}
      className={`char ${className}`}
      style={{ display: "inline-block", willChange: "transform, opacity" }}
    >
      {char === " " ? "\u00A0" : char}
    </span>
  ));

// ── Component ─────────────────────────────────────────────────────────────────
const Hero = () => {
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const tagsRef = useRef(null);
  const ctaRef = useRef(null);
  const parallaxRef = useRef(null);
  const scrollIndRef = useRef(null);

  // ── Entrance animations ───────────────────────────────────────────────────
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // 1. All title characters burst in from below with stagger
      tl.fromTo(
        titleRef.current.querySelectorAll(".char"),
        { y: 120, opacity: 0, rotateX: -80, skewX: 6 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          skewX: 0,
          duration: 1,
          stagger: 0.025, // 25ms between each character
        },
        0.2,
      );

      // 2. Sub-headline fades + rises after title
      tl.fromTo(
        subRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        "-=0.2",
      );

      // 3. Tag chips appear with stagger
      tl.fromTo(
        tagsRef.current.querySelectorAll(".tag-chip"),
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.5, stagger: 0.07 },
        "-=0.3",
      );

      // 4. CTA buttons slide up
      tl.fromTo(
        ctaRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 },
        "-=0.3",
      );

      // 5. Scroll indicator pulses
      tl.fromTo(
        scrollIndRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.8 },
        "-=0.2",
      );

      // Continuous scroll-indicator bounce
      gsap.to(scrollIndRef.current.querySelector(".scroll-dot"), {
        y: 8,
        duration: 0.9,
        ease: "power1.inOut",
        yoyo: true,
        repeat: -1,
      });
    },
    { scope: heroRef },
  );

  // ── Mouse parallax ────────────────────────────────────────────────────────
  useEffect(() => {
    /**
     * On mouse move, subtly shift the parallax layer in the opposite direction
     * to create a soft depth illusion.
     */
    const handleMouse = (e) => {
      const { innerWidth: W, innerHeight: H } = window;
      const rx = (e.clientX / W - 0.5) * 2; // -1 to 1
      const ry = (e.clientY / H - 0.5) * 2;

      gsap.to(parallaxRef.current, {
        x: rx * -20,
        y: ry * -10,
        duration: 1.2,
        ease: "power1.out",
      });
    };

    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <section
      id="hero"
      ref={heroRef}
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        position: "relative",
        overflow: "hidden",
        paddingTop: "72px", // clear navbar
      }}
    >
      {/* ── Decorative background elements (parallax layer) ── */}
      <div
        ref={parallaxRef}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {/* Large olive circle — top right */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-10%",
            width: "55vw",
            height: "55vw",
            borderRadius: "50%",
            border: "1px solid rgba(107,124,62,0.12)",
            background:
              "radial-gradient(circle at 40% 40%, rgba(107,124,62,0.06), transparent 70%)",
          }}
        />
        {/* Medium circle — bottom left */}
        <div
          style={{
            position: "absolute",
            bottom: "-8%",
            left: "-5%",
            width: "30vw",
            height: "30vw",
            borderRadius: "50%",
            border: "1px solid rgba(107,124,62,0.08)",
          }}
        />
        {/* Crosshair grid dot (top left) */}
        <svg
          style={{
            position: "absolute",
            top: "18%",
            left: "6%",
            opacity: 0.25,
          }}
          width="60"
          height="60"
          viewBox="0 0 60 60"
        >
          <line
            x1="30"
            y1="0"
            x2="30"
            y2="60"
            stroke="#9ab050"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="30"
            x2="60"
            y2="30"
            stroke="#9ab050"
            strokeWidth="0.5"
          />
          <circle
            cx="30"
            cy="30"
            r="4"
            stroke="#9ab050"
            strokeWidth="0.5"
            fill="none"
          />
        </svg>
        {/* Diagonal accent line */}
        <svg
          style={{
            position: "absolute",
            bottom: "15%",
            right: "8%",
            opacity: 0.18,
          }}
          width="180"
          height="180"
          viewBox="0 0 180 180"
        >
          <line
            x1="0"
            y1="180"
            x2="180"
            y2="0"
            stroke="#9ab050"
            strokeWidth="1"
          />
          <line
            x1="30"
            y1="180"
            x2="180"
            y2="30"
            stroke="#9ab050"
            strokeWidth="0.5"
          />
          <line
            x1="60"
            y1="180"
            x2="180"
            y2="60"
            stroke="#9ab050"
            strokeWidth="0.3"
          />
        </svg>
      </div>

      {/* ── Main content ── */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 2rem",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Status badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 14px",
            border: "1px solid rgba(154,176,80,0.3)",
            borderRadius: "100px",
            marginBottom: "2rem",
            background: "rgba(107,124,62,0.08)",
          }}
        >
          {/* Pulsing green dot */}
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#9ab050",
              boxShadow: "0 0 8px #9ab050",
              animation: "pulse 2s infinite",
            }}
          />
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.68rem",
              letterSpacing: "0.12em",
              color: "#9ab050",
              textTransform: "uppercase",
            }}
          >
            Available for work
          </span>
        </div>

        {/* ── Main title — each line rendered with SplitChars ── */}
        <div
          ref={titleRef}
          style={{
            perspective: "800px",
            overflow: "hidden",
            paddingBottom: "0.1em",
          }}
        >
          {TITLE_LINES.map((line, li) => (
            <div
              key={li}
              style={{
                overflow: "hidden",
                lineHeight: "0.95",
                paddingBottom: "0.05em",
              }}
            >
              <h1
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 800,
                  // Fluid font size: clamp between 56px and 120px
                  fontSize: "clamp(3.5rem, 10vw, 7.5rem)",
                  letterSpacing: "-0.02em",
                  color: li === 1 ? "transparent" : "#e4e4dc",
                  // The middle line is outline-only for visual contrast
                  WebkitTextStroke: li === 1 ? "1px rgba(154,176,80,0.7)" : "0",
                  display: "block",
                }}
              >
                <SplitChars text={line} />
              </h1>
            </div>
          ))}
        </div>

        {/* ── Sub-headline ── */}
        <p
          ref={subRef}
          style={{
            marginTop: "1.5rem",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 300,
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            color: "#a0a09a",
            maxWidth: "480px",
            lineHeight: 1.6,
          }}
        >
          Student developer at{" "}
          <span style={{ color: "#c8c8c0", fontWeight: 500 }}>
            SMK Negeri 4 Bogor
          </span>{" "}
          — crafting full-stack web experiences with care.
        </p>

        {/* ── Tech tag chips ── */}
        <div
          ref={tagsRef}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "1.5rem",
          }}
        >
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="tag-chip"
              style={{
                padding: "4px 12px",
                borderRadius: "4px",
                background: "rgba(107,124,62,0.1)",
                border: "1px solid rgba(107,124,62,0.25)",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.7rem",
                letterSpacing: "0.06em",
                color: "#9ab050",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* ── CTA buttons ── */}
        <div
          ref={ctaRef}
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "2.5rem",
            flexWrap: "wrap",
          }}
        >
          {/* Primary CTA */}
          <button
            onClick={() => smoothScrollTo("projects")}
            style={{
              padding: "14px 32px",
              background: "linear-gradient(135deg, #7a9040, #4a5c28)",
              border: "none",
              borderRadius: "6px",
              fontFamily: "Outfit, sans-serif",
              fontWeight: 600,
              fontSize: "0.9rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#e4e4dc",
              boxShadow: "0 8px 24px rgba(107,124,62,0.3)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              gsap.to(e.currentTarget, {
                y: -3,
                boxShadow: "0 14px 32px rgba(107,124,62,0.45)",
                duration: 0.25,
              });
            }}
            onMouseLeave={(e) => {
              gsap.to(e.currentTarget, {
                y: 0,
                boxShadow: "0 8px 24px rgba(107,124,62,0.3)",
                duration: 0.25,
              });
            }}
          >
            View Projects
          </button>

          {/* Secondary CTA */}
          <button
            onClick={() => smoothScrollTo("contact")}
            style={{
              padding: "14px 32px",
              background: "transparent",
              border: "1px solid rgba(228,228,220,0.2)",
              borderRadius: "6px",
              fontFamily: "Outfit, sans-serif",
              fontWeight: 500,
              fontSize: "0.9rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#c8c8c0",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(154,176,80,0.6)";
              e.currentTarget.style.color = "#9ab050";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(228,228,220,0.2)";
              e.currentTarget.style.color = "#c8c8c0";
            }}
          >
            Get in Touch
          </button>
        </div>

        {/* ── Stats row ── */}
        <div
          style={{
            display: "flex",
            gap: "3rem",
            marginTop: "4rem",
            flexWrap: "wrap",
          }}
        >
          {[
            { num: "15+", label: "Projects Built" },
            { num: "3+", label: "Years Learning" },
            { num: "6", label: "Technologies" },
          ].map(({ num, label }) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 700,
                  fontSize: "2rem",
                  color: "#9ab050",
                  lineHeight: 1,
                }}
              >
                {num}
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#5a5a56",
                  marginTop: "4px",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scroll indicator (bottom centre) ── */}
      <div
        ref={scrollIndRef}
        style={{
          position: "absolute",
          bottom: "2.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#5a5a56",
          }}
        >
          Scroll
        </span>
        {/* Mouse outline with bouncing dot */}
        <div
          style={{
            width: "22px",
            height: "34px",
            borderRadius: "11px",
            border: "1.5px solid rgba(90,90,86,0.5)",
            display: "flex",
            justifyContent: "center",
            paddingTop: "5px",
          }}
        >
          <div
            className="scroll-dot"
            style={{
              width: "3px",
              height: "8px",
              borderRadius: "2px",
              background: "#9ab050",
            }}
          />
        </div>
      </div>

      {/* ── Pulse keyframe for the "available" badge ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #9ab050; }
          50%       { opacity: 0.5; box-shadow: 0 0 4px #9ab050; }
        }
      `}</style>
    </section>
  );
};

export default Hero;
