/**
 * Navbar.jsx
 * Fixed top navigation bar with:
 * - Logo / brand name on the left
 * - Nav links on the right that scroll to sections via GSAP ScrollTo
 * - Background fades in after scrolling past the hero
 * - An active-section indicator that moves between links
 * - Entrance slide-down animation on mount
 */
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { smoothScrollTo } from "../utils/gsapConfig";

// ── Nav links config ──────────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: "About", id: "about" },
  { label: "Projects", id: "projects" },
  { label: "Contact", id: "contact" },
];

// ── Component ─────────────────────────────────────────────────────────────────
const Navbar = () => {
  const navRef = useRef(null);
  const [active, setActive] = useState("hero");
  const [scrolled, setScrolled] = useState(false);

  // ── Entrance animation ─────────────────────────────────────────────────────
  useGSAP(
    () => {
      gsap.fromTo(
        navRef.current,
        { y: -80, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.4 },
      );
    },
    { scope: navRef },
  );

  // ── Scroll-based effects ───────────────────────────────────────────────────
  useEffect(() => {
    /**
     * ScrollTrigger for navbar background:
     * Background appears once user scrolls 60px past top.
     */
    const st = ScrollTrigger.create({
      start: "top top-=60",
      onEnter: () => setScrolled(true),
      onLeaveBack: () => setScrolled(false),
    });

    /**
     * Active section tracking — watch each section's scroll position
     * and update the active state to highlight the matching nav link.
     */
    const sectionIds = ["hero", ...NAV_LINKS.map((l) => l.id)];
    const triggers = sectionIds.map((id) =>
      ScrollTrigger.create({
        trigger: `#${id}`,
        start: "top center",
        end: "bottom center",
        onEnter: () => setActive(id),
        onEnterBack: () => setActive(id),
      }),
    );

    return () => {
      st.kill();
      triggers.forEach((t) => t.kill());
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  /** Navigate to a section and close mobile menu */
  const handleNav = (id) => {
    smoothScrollTo(id);
  };

  return (
    <nav
      ref={navRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        // Background transitions from transparent to dark on scroll
        background: scrolled ? "rgba(10,10,9,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(107,124,62,0.15)"
          : "1px solid transparent",
        transition:
          "background 0.5s ease, backdrop-filter 0.5s ease, border-color 0.5s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 2rem",
          height: "72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* ── Logo / brand ── */}
        <button
          onClick={() => handleNav("hero")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
          aria-label="Go to top"
        >
          {/* Olive orb logo mark */}
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #9ab050, #4a5c28)",
              display: "block",
              boxShadow: "0 0 16px rgba(154,176,80,0.4)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 700,
              fontSize: "1.1rem",
              letterSpacing: "0.06em",
              color: "#e4e4dc",
            }}
          >
            DEV<span style={{ color: "#9ab050" }}>.</span>
          </span>
        </button>

        {/* ── Desktop nav links ── */}
        <ul
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2.5rem",
            listStyle: "none",
          }}
        >
          {NAV_LINKS.map(({ label, id }) => (
            <li key={id}>
              <button
                onClick={() => handleNav(id)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "4px 0",
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: active === id ? 600 : 400,
                  fontSize: "0.875rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active === id ? "#9ab050" : "#a0a09a",
                  transition: "color 0.3s ease",
                  position: "relative",
                }}
              >
                {label}
                {/* Active underline */}
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: "#9ab050",
                    transformOrigin: "left",
                    transform: active === id ? "scaleX(1)" : "scaleX(0)",
                    transition: "transform 0.35s cubic-bezier(0.25,0.8,0.25,1)",
                  }}
                />
              </button>
            </li>
          ))}

          {/* ── "Hire me" CTA button ── */}
          <li>
            <button
              onClick={() => handleNav("contact")}
              style={{
                background: "transparent",
                border: "1px solid #9ab050",
                borderRadius: "4px",
                padding: "8px 20px",
                fontFamily: "Outfit, sans-serif",
                fontWeight: 500,
                fontSize: "0.8rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9ab050",
                transition: "background 0.25s ease, color 0.25s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#9ab050";
                e.currentTarget.style.color = "#0a0a09";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#9ab050";
              }}
            >
              Hire Me
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
