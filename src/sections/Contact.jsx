/**
 * Contact.jsx
 * A bold, editorial contact section with:
 * - Large "Let's Talk" heading with animated character reveal
 * - Oversized email address as a link
 * - Social links grid
 * - Minimal contact form (name · email · message)
 * - Footer strip at the bottom
 *
 * All form state is local (no backend); extend with EmailJS or Formspree.
 */
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import SectionWrapper from "../components/SectionWrapper";

// ── Social links data ─────────────────────────────────────────────────────────
const SOCIALS = [
  {
    label: "GitHub",
    handle: "@yourhandle",
    href: "https://github.com/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    handle: "linkedin.com/in/you",
    href: "https://linkedin.com/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    handle: "@yourhandle",
    href: "https://instagram.com/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
];

// ── InputField ─────────────────────────────────────────────────────────────────
/**
 * Reusable animated form field.
 * The bottom border turns olive on focus.
 */
const InputField = ({
  label,
  type = "text",
  multiline = false,
  value,
  onChange,
  name,
}) => {
  const [focused, setFocused] = useState(false);

  const baseStyle = {
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${focused ? "#9ab050" : "rgba(90,90,86,0.4)"}`,
    borderRadius: 0,
    padding: "0.75rem 0",
    fontFamily: "Outfit, sans-serif",
    fontWeight: 400,
    fontSize: "0.95rem",
    color: "#e4e4dc",
    outline: "none",
    resize: "none",
    transition: "border-color 0.25s ease",
    display: "block",
  };

  return (
    <div style={{ position: "relative", marginBottom: "2rem" }}>
      <label
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "0.6rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: focused ? "#9ab050" : "#5a5a56",
          transition: "color 0.25s",
          display: "block",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      {multiline ? (
        <textarea
          name={name}
          rows={4}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={baseStyle}
        />
      ) : (
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={baseStyle}
        />
      )}
    </div>
  );
};

// ── Main Contact component ────────────────────────────────────────────────────
const Contact = () => {
  const headingRef = useRef(null);
  const leftColRef = useRef(null);
  const rightColRef = useRef(null);

  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent

  // ── Entrance animation ─────────────────────────────────────────────────────
  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: headingRef.current,
        start: "top 80%",
        once: true,
      },
    });

    tl.fromTo(
      headingRef.current.querySelectorAll(".contact-char"),
      { y: 80, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.02, ease: "power3.out" },
    );

    tl.fromTo(
      [leftColRef.current, rightColRef.current],
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.15, ease: "power2.out" },
      "-=0.4",
    );
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("sending");
    // Simulate async send
    setTimeout(() => setStatus("sent"), 1500);
  };

  const contactWord = "CONTACT.";

  return (
    <SectionWrapper id="contact" label="03 / CONTACT">
      {/* ── Giant heading ── */}
      <div
        ref={headingRef}
        style={{ overflow: "hidden", marginBottom: "4rem" }}
      >
        <h2
          style={{
            fontFamily: "Syne, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(3rem, 10vw, 8rem)",
            letterSpacing: "-0.03em",
            lineHeight: 0.95,
          }}
        >
          {contactWord.split("").map((ch, i) => (
            <span
              key={i}
              className="contact-char"
              style={{
                display: "inline-block",
                // Alternate colour on specific chars for style
                color: i === 0 || ch === "." ? "#9ab050" : "#e4e4dc",
              }}
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h2>
        <p
          style={{
            fontFamily: "Outfit, sans-serif",
            fontWeight: 300,
            fontSize: "1rem",
            color: "#7a7a74",
            marginTop: "0.75rem",
          }}
        >
          Got a project in mind? Let&apos;s make something great.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "4rem",
          alignItems: "start",
        }}
      >
        {/* ── Left column: email + socials ── */}
        <div ref={leftColRef}>
          {/* Email */}
          <div style={{ marginBottom: "3rem" }}>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#9ab050",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              Email me
            </span>
            <a
              href="mailto:hello@example.com"
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                fontSize: "clamp(1.1rem, 3vw, 1.8rem)",
                color: "#e4e4dc",
                textDecoration: "none",
                borderBottom: "1px solid rgba(154,176,80,0.3)",
                paddingBottom: "4px",
                transition: "color 0.2s, border-color 0.2s",
                display: "inline-block",
                wordBreak: "break-all",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#9ab050";
                e.currentTarget.style.borderColor = "#9ab050";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#e4e4dc";
                e.currentTarget.style.borderColor = "rgba(154,176,80,0.3)";
              }}
            >
              hello@yourname.dev
            </a>
          </div>

          {/* Social links */}
          <div>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#5a5a56",
                display: "block",
                marginBottom: "1rem",
              }}
            >
              Find me on
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "12px 16px",
                    background: "rgba(20,20,19,0.6)",
                    border: "1px solid rgba(107,124,62,0.18)",
                    borderRadius: "8px",
                    textDecoration: "none",
                    transition: "border-color 0.25s, background 0.25s",
                    maxWidth: "320px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(154,176,80,0.5)";
                    e.currentTarget.style.background = "rgba(107,124,62,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(107,124,62,0.18)";
                    e.currentTarget.style.background = "rgba(20,20,19,0.6)";
                  }}
                >
                  <span style={{ color: "#9ab050" }}>{s.icon}</span>
                  <div>
                    <div
                      style={{
                        fontFamily: "Outfit, sans-serif",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: "#e4e4dc",
                        lineHeight: 1.2,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "0.65rem",
                        color: "#5a5a56",
                        marginTop: "2px",
                      }}
                    >
                      {s.handle}
                    </div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: "#5a5a56",
                      fontSize: "0.8rem",
                    }}
                  >
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: contact form ── */}
        <div ref={rightColRef}>
          {status === "sent" ? (
            /* Success state */
            <div
              style={{
                padding: "3rem 2rem",
                textAlign: "center",
                background: "rgba(107,124,62,0.08)",
                border: "1px solid rgba(107,124,62,0.3)",
                borderRadius: "12px",
              }}
            >
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
              <h3
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 700,
                  fontSize: "1.4rem",
                  color: "#e4e4dc",
                  marginBottom: "0.5rem",
                }}
              >
                Message sent!
              </h3>
              <p
                style={{
                  fontFamily: "Outfit, sans-serif",
                  color: "#7a7a74",
                  fontSize: "0.9rem",
                }}
              >
                I'll get back to you as soon as possible.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <InputField
                label="Your Name"
                name="name"
                value={form.name}
                onChange={handleChange}
              />
              <InputField
                label="Email Address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
              <InputField
                label="Message"
                name="message"
                multiline
                value={form.message}
                onChange={handleChange}
              />

              <button
                type="submit"
                disabled={status === "sending"}
                style={{
                  width: "100%",
                  padding: "14px 24px",
                  background:
                    status === "sending"
                      ? "rgba(107,124,62,0.5)"
                      : "linear-gradient(135deg, #7a9040, #4a5c28)",
                  border: "none",
                  borderRadius: "6px",
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#e4e4dc",
                  boxShadow: "0 8px 24px rgba(107,124,62,0.25)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (status !== "sending")
                    gsap.to(e.currentTarget, {
                      y: -2,
                      boxShadow: "0 14px 32px rgba(107,124,62,0.4)",
                      duration: 0.2,
                    });
                }}
                onMouseLeave={(e) => {
                  gsap.to(e.currentTarget, {
                    y: 0,
                    boxShadow: "0 8px 24px rgba(107,124,62,0.25)",
                    duration: 0.2,
                  });
                }}
              >
                {status === "sending" ? "Sending…" : "Send Message →"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Footer strip ── */}
      <div
        style={{
          marginTop: "6rem",
          paddingTop: "2rem",
          borderTop: "1px solid rgba(107,124,62,0.15)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            color: "#3a3a38",
          }}
        >
          © 2025 — Built with React + GSAP + ❤️
        </span>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "0.65rem",
            letterSpacing: "0.1em",
            color: "#3a3a38",
          }}
        >
          SMK Negeri 4 Bogor
        </span>
      </div>
    </SectionWrapper>
  );
};

export default Contact;
