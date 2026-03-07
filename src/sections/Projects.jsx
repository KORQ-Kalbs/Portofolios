import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionWrapper from "/src/components/SectionWrapper";

gsap.registerPlugin(ScrollTrigger);

const PROJECTS = [
  {
    title: "Toko Imaji",
    desc: "E-commerce platform with PHP/MySQL",
    tag: "Web App",
    color: "from-blue-500 to-purple-600",
  },
  {
    title: "Personal Portfolio",
    desc: "Interactive portfolio with React & GSAP",
    tag: "Design",
    color: "from-purple-500 to-pink-600",
  },
  {
    title: "Task Manager",
    desc: "Real-time collaborative task application",
    tag: "Full-Stack",
    color: "from-green-500 to-emerald-600",
  },
  {
    title: "Data Dashboard",
    desc: "Analytics dashboard with live charts",
    tag: "Dashboard",
    color: "from-orange-500 to-red-600",
  },
];

const Projects = () => {
  const containerRef = useRef(null);
  const projectsRef = useRef([]);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      projectsRef.current.forEach((project, idx) => {
        if (!project) return;

        // Stagger scroll trigger animations
        gsap.fromTo(
          project,
          {
            opacity: 0,
            y: 50,
            rotateX: 10,
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            scrollTrigger: {
              trigger: project,
              start: "top 80%",
              end: "top 60%",
              scrub: 0.5,
              markers: false,
            },
          },
        );

        // Hover animations
        const overlay = project.querySelector(".project-overlay");
        const content = project.querySelector(".project-content");

        project.addEventListener("mouseenter", () => {
          gsap.to(project.querySelector(".project-image"), {
            scale: 1.1,
            duration: 0.5,
            ease: "power2.out",
          });

          gsap.to(overlay, {
            opacity: 1,
            duration: 0.4,
            ease: "power2.out",
          });

          gsap.to(content, {
            y: -5,
            duration: 0.4,
            ease: "power2.out",
          });
        });

        project.addEventListener("mouseleave", () => {
          gsap.to(project.querySelector(".project-image"), {
            scale: 1,
            duration: 0.5,
            ease: "power2.out",
          });

          gsap.to(overlay, {
            opacity: 0,
            duration: 0.4,
            ease: "power2.out",
          });

          gsap.to(content, {
            y: 0,
            duration: 0.4,
            ease: "power2.out",
          });
        });
      });
    }, containerRef);

    return () => ctx.revert();
  });

  return (
    <SectionWrapper title="Featured Work">
      <div ref={containerRef} className="grid gap-6 md:grid-cols-2">
        {PROJECTS.map((p, i) => (
          <div
            key={i}
            ref={(el) => (projectsRef.current[i] = el)}
            className="overflow-hidden transition-all border border-gray-700 group bg-gray-800/40 rounded-2xl hover:border-blue-500/50 cursor-pointer perspective"
          >
            {/* Project Image Container */}
            <div className="relative h-48 overflow-hidden bg-gray-700">
              <div
                className={`project-image w-full h-full bg-gradient-to-br ${p.color} transition-transform duration-500 flex items-center justify-center text-3xl`}
              >
                {i === 0 ? "🛍️" : i === 1 ? "🎨" : i === 2 ? "✅" : "📊"}
              </div>

              {/* Overlay */}
              <div className="project-overlay absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 flex items-center justify-center">
                <button className="px-6 py-2 text-sm font-semibold bg-blue-600 rounded-full hover:bg-blue-700 transition-colors">
                  View Project
                </button>
              </div>
            </div>

            {/* Project Content */}
            <div className="project-content p-6 transition-transform duration-300">
              <span className="font-mono text-xs tracking-widest text-blue-400 uppercase">
                {p.tag}
              </span>
              <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{p.desc}</p>

              {/* Tech indicators */}
              <div className="mt-4 flex gap-2">
                {[...Array(3)].map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full bg-gradient-to-r ${p.color}`}
                    style={{
                      width: `${60 - idx * 20}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
};

export default Projects;
