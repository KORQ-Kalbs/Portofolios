/**
 * Projects.jsx
 * Infinite auto-scrolling project card carousel.
 *
 * How it works:
 * - The PROJECTS array is duplicated 3× inside the track.
 * - GSAP animates the track xPercent from 0 to –33.33 then repeats.
 * - Because the content repeats every 33.33%, the seam is invisible.
 * - Hovering the track pauses the animation.
 * - Hovering a card lifts it and reveals an overlay with links.
 *
 * Cards also get a ScrollTrigger entrance: they fade-and-rise
 * when the section first scrolls into view.
 */
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SectionWrapper from "../components/SectionWrapper";

// ── Dummy project data ────────────────────────────────────────────────────────
const PROJECTS = [
  {
    id: 1,
    title: "E-Commerce Platform",
    tags: ["React", "Laravel", "MySQL"],
    desc: "Full-featured online store with cart, checkout, and admin dashboard.",
    year: "2024",
    color: "from-olive to-oliveMid", // decorative, unused; we inline-style the card accent
    accent: "#7a9040",
    emoji: "🛒",
    href: "#",
  },
  {
    id: 2,
    title: "Real-time Chat App",
    tags: ["Node.js", "Socket.io", "React"],
    desc: "WebSocket-powered messaging with rooms, typing indicators, and file sharing.",
    year: "2024",
    accent: "#5a7a60",
    emoji: "💬",
    href: "#",
  },
  {
    id: 3,
    title: "School Management",
    tags: ["PHP", "MySQL", "Bootstrap"],
    desc: "Academic management system for schedules, grades, and student records.",
    year: "2023",
    accent: "#6a7a30",
    emoji: "🏫",
    href: "#",
  },
  {
    id: 4,
    title: "Weather Dashboard",
    tags: ["React", "OpenWeather API", "Tailwind"],
    desc: "Live weather forecast with interactive maps and historical data charts.",
    year: "2023",
    accent: "#4a6070",
    emoji: "🌤️",
    href: "#",
  },
  {
    id: 5,
    title: "Portfolio Website",
    tags: ["React", "GSAP", "Vite"],
    desc: "The very site you are browsing — scroll animations and custom cursor.",
    year: "2025",
    accent: "#9ab050",
    emoji: "🚀",
    href: "#",
  },
];

// ── ProjectCard ───────────────────────────────────────────────────────────────
/**
 * A single project card with lift-on-hover and an overlay that slides in.
 */
const ProjectCard = ({ project }) => {
  const cardRef = useRef(null);
  const overlayRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  const handleEnter = () => {
    setHovered(true);
    gsap.to(cardRef.current, {
      y: -10,
      scale: 1.02,
      boxShadow: `0 24px 48px ${project.accent}44, 0 8px 16px rgba(0,0,0,0.5)`,
      duration: 0.35,
      ease: "power2.out",
    });
    gsap.to(overlayRef.current, {
      opacity: 1,
      y: 0,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  const handleLeave = () => {
    setHovered(false);
    gsap.to(cardRef.current, {
      y: 0,
      scale: 1,
      boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      duration: 0.4,
      ease: "power2.out",
    });
    gsap.to(overlayRef.current, {
      opacity: 0,
      y: 10,
      duration: 0.25,
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        flexShrink: 0,
        width: "clamp(280px, 30vw, 380px)",
        height: "300px",
        background: "#141413",
        border: `1px solid ${project.accent}33`,
        borderRadius: "16px",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        willChange: "transform",
        marginRight: "1.5rem",
        // Prevent click on the card from triggering on the whole row
        userSelect: "none",
      }}
    >
      {/* Accent gradient top strip */}
      <div
        style={{
          height: "3px",
          background: `linear-gradient(90deg, ${project.accent}, transparent)`,
        }}
      />

      {/* Card body */}
      <div style={{ padding: "1.5rem", height: "100%" }}>
        {/* Emoji icon + year */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1rem",
          }}
        >
          <span style={{ fontSize: "2.5rem" }}>{project.emoji}</span>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.65rem",
              letterSpacing: "0.12em",
              color: "#5a5a56",
            }}
          >
            {project.year}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 700,
            fontSize: "1.2rem",
            color: "#e4e4dc",
            marginBottom: "0.5rem",
            lineHeight: 1.2,
          }}
        >
          {project.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 300,
            fontSize: "0.82rem",
            color: "#7a7a74",
            lineHeight: 1.6,
            marginBottom: "1rem",
          }}
        >
          {project.desc}
        </p>

        {/* Tech tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {project.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "2px 8px",
                borderRadius: "3px",
                background: `${project.accent}18`,
                border: `1px solid ${project.accent}30`,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.06em",
                color: project.accent,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Hover overlay — "View Project" CTA */}
      <div
        ref={overlayRef}
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${project.accent}cc 0%, ${project.accent}44 60%, transparent 100%)`,
          display: "flex",
          alignItems: "flex-end",
          padding: "1.5rem",
          opacity: 0,
          transform: "translateY(10px)",
        }}
      >
        <a
          href={project.href}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: "rgba(10,10,9,0.85)",
            border: `1px solid ${project.accent}66`,
            borderRadius: "6px",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 500,
            fontSize: "0.8rem",
            letterSpacing: "0.06em",
            color: "#e4e4dc",
            textDecoration: "none",
          }}
        >
          View Project →
        </a>
      </div>
    </div>
  );
};

// ── Main Projects component ───────────────────────────────────────────────────
const Projects = () => {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const tweenRef = useRef(null);

  // Duplicate data 3× for seamless loop
  const tripled = [...PROJECTS, ...PROJECTS, ...PROJECTS];

  useGSAP(
    () => {
      const track = trackRef.current;

      /**
       * Infinite marquee:
       * Moves from xPercent 0 → –33.33 then repeats.
       * One "set" = 33.33% of the total tripled strip width,
       * so the loop seam is completely invisible.
       */
      tweenRef.current = gsap.to(track, {
        xPercent: -33.33,
        duration: 40,
        ease: "none",
        repeat: -1,
      });

      // Pause on hover
      const pause = () =>
        gsap.to(tweenRef.current, { timeScale: 0, duration: 0.5 });
      const resume = () =>
        gsap.to(tweenRef.current, { timeScale: 1, duration: 0.8 });

      const outer = sectionRef.current.querySelector(".track-outer");
      outer.addEventListener("mouseenter", pause);
      outer.addEventListener("mouseleave", resume);

      return () => {
        outer.removeEventListener("mouseenter", pause);
        outer.removeEventListener("mouseleave", resume);
      };
    },
    { scope: sectionRef },
  );

  return (
    <SectionWrapper id="projects" label="02 / PROJECTS">
      <div ref={sectionRef}>
        {/* Section heading */}
        <div
          style={{
            marginBottom: "3rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <h2
            style={{
              fontFamily: "Syne, sans-serif",
              fontWeight: 800,
              fontSize: "clamp(2.2rem, 5vw, 4rem)",
              letterSpacing: "-0.02em",
              color: "#e4e4dc",
              lineHeight: 1.05,
            }}
          >
            Selected <span style={{ color: "#9ab050" }}>Work</span>
          </h2> 
        </div>

        {/* ── Infinite card track ── */}
        {/* Outer wrapper clips overflow and fades the edges */}
        <div
          className="track-outer"
          style={{
            overflow: "hidden",
            margin: "0 -2rem",
            padding: "1.5rem 0",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            maskImage:
              "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        >
          <div
            ref={trackRef}
            style={{
              display: "flex",
              width: "max-content",
              willChange: "transform",
              paddingLeft: "2rem",
            }}
          >
            {tripled.map((project, i) => (
              <ProjectCard key={`${project.id}-${i}`} project={project} />
            ))}
          </div>
        </div>

        {/* ── "See all" link ── */}
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}>
          <a
            href="#"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#9ab050",
              textDecoration: "none",
              borderBottom: "1px solid rgba(154,176,80,0.3)",
              paddingBottom: "2px",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "#9ab050")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "rgba(154,176,80,0.3)")
            }
          >
            View All Projects ↗
          </a>
        </div>
      </div>
    </SectionWrapper>
  );
};

export default Projects;
