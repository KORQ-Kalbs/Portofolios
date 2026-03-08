/**
 * Navbar.jsx
 * Layout terinspirasi Griflan.com:
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  About          DEV.                      [ Hire Me ]   │
 *  │  Projects                                               │
 *  │  Contact                                                │
 *  └─────────────────────────────────────────────────────────┘
 *
 * - Nav links: stacked vertikal di pojok KIRI ATAS (position:fixed)
 * - Brand name: di TENGAH ATAS (position:fixed, center)
 * - CTA "Hire Me": di pojok KANAN ATAS (position:fixed)
 *
 * Tidak ada background bar — semua elemen float di atas konten.
 * Active link mendapat underline olive yang scale-in dari kiri.
 * Entrance: setiap grup elemen slide + fade in dengan stagger.
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
  const linksRef = useRef(null); // left column wrapper
  const brandRef = useRef(null); // center brand
  const ctaRef = useRef(null); // right CTA button

  const [active, setActive] = useState("hero");

  // ── Entrance stagger animation on mount ────────────────────────────────────
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Brand drops in from above
    tl.fromTo(
      brandRef.current,
      { y: -24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      0.2,
    );

    // Nav links stagger in from left
    tl.fromTo(
      linksRef.current.querySelectorAll(".nav-link-item"),
      { x: -18, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, stagger: 0.09 },
      0.3,
    );

    // CTA slides in from right
    tl.fromTo(
      ctaRef.current,
      { x: 18, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6 },
      0.4,
    );
  });

  // ── Active section tracker via ScrollTrigger ───────────────────────────────
  useEffect(() => {
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
    return () => triggers.forEach((t) => t.kill());
  }, []);

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          LEFT — nav links stacked vertikal
      ══════════════════════════════════════════════════════ */}
      <div
        ref={linksRef}
        style={{
          position: "fixed",
          top: "1.8rem",
          left: "2rem",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "0.08rem",
        }}
      >
        {NAV_LINKS.map(({ label, id }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              className="nav-link-item"
              onClick={() => smoothScrollTo(id)}
              style={{
                background: "none",
                border: "none",
                padding: "2px 0",
                display: "block",
                textAlign: "left",
                fontFamily: "Outfit, sans-serif",
                fontWeight: isActive ? 600 : 400,
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                color: isActive ? "#9ab050" : "#a0a09a",
                transition: "color 0.3s ease",
                position: "relative",
                paddingBottom: "3px",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "#c8c8c0";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "#a0a09a";
              }}
            >
              {label}
              {/* Underline grows from left when this section is active */}
              <span
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "1px",
                  background: "#9ab050",
                  transformOrigin: "left center",
                  transform: isActive ? "scaleX(1)" : "scaleX(0)",
                  transition: "transform 0.35s cubic-bezier(0.25,0.8,0.25,1)",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════
          CENTER — brand name
      ══════════════════════════════════════════════════════ */}
      <div
        ref={brandRef}
        style={{
          position: "fixed",
          top: "1.75rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
        }}
      >
        <button
          onClick={() => smoothScrollTo("hero")}
          aria-label="Back to top"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          <span
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "1.15rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e4e4dc",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {/* Small olive orb as logo mark */}
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#9ab050",
                boxShadow: "0 0 10px rgba(154,176,80,0.6)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            DEV<span style={{ color: "#9ab050" }}>.</span>
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT — "Hire Me" solid CTA button
      ══════════════════════════════════════════════════════ */}
      <div
        ref={ctaRef}
        style={{
          position: "fixed",
          top: "1.55rem",
          right: "2rem",
          zIndex: 1000,
        }}
      >
        <button
          onClick={() => smoothScrollTo("contact")}
          style={{
            background: "#9ab050",
            border: "none",
            borderRadius: "5px",
            padding: "10px 22px",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 700,
            fontSize: "0.82rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#0a0a09",
            boxShadow: "0 4px 20px rgba(154,176,80,0.25)",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            gsap.to(e.currentTarget, {
              backgroundColor: "#b8cc60",
              y: -2,
              boxShadow: "0 8px 28px rgba(154,176,80,0.4)",
              duration: 0.2,
            });
          }}
          onMouseLeave={(e) => {
            gsap.to(e.currentTarget, {
              backgroundColor: "#9ab050",
              y: 0,
              boxShadow: "0 4px 20px rgba(154,176,80,0.25)",
              duration: 0.25,
            });
          }}
        >
          Hire Me
        </button>
      </div>
    </>
  );
};

export default Navbar;
