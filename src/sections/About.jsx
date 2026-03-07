import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SectionWrapper from "/src/components/SectionWrapper";

gsap.registerPlugin(ScrollTrigger);

const SKILLS = [
  { name: "React", icon: "⚛️", color: "from-blue-500 to-cyan-500" },
  { name: "Node.js", icon: "🟢", color: "from-green-500 to-emerald-500" },
  { name: "PHP", icon: "🔵", color: "from-purple-500 to-violet-500" },
  { name: "Laravel", icon: "🔴", color: "from-red-500 to-pink-500" },
  { name: "MySQL", icon: "🗄️", color: "from-orange-500 to-amber-500" },
  { name: "Tailwind CSS", icon: "🎨", color: "from-cyan-400 to-blue-500" },
];

const About = () => {
  const scrollContainerRef = useRef(null);
  const skillsWrapperRef = useRef(null);

  useGSAP(() => {
    const container = scrollContainerRef.current;
    if (!container || !skillsWrapperRef.current) return;

    // Calculate the horizontal scroll distance
    const totalScroll =
      skillsWrapperRef.current.scrollWidth - window.innerWidth;

    // Start from left (negative position) so it can scroll right
    gsap.set(skillsWrapperRef.current, { x: -totalScroll });

    // Create the horizontal scroll animation WITH PINNING
    // This pins the section in place while the horizontal scroll happens
    // Scrolling from left (-totalScroll) to right (0)
    const animation = gsap.to(skillsWrapperRef.current, {
      x: 0, // Scroll to the right (from negative to 0)
      ease: "none",
      scrollTrigger: {
        trigger: container,
        start: "top top", // Pin when section reaches top
        end: () => `+=${totalScroll * 2}`, // Ensure full horizontal scroll completes
        scrub: 1,
        pin: true, // PIN THE SECTION
        anticipatePin: 1,
        markers: false,
        invalidateOnRefresh: true, // Recalculate on window resize
      },
    });

    // Entrance animation for skill cards (only on first view)
    const skillCards = container.querySelectorAll(".skill-card");
    skillCards.forEach((card, index) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: index * 0.1, // Stagger effect
          scrollTrigger: {
            trigger: container,
            start: "top 80%",
            once: true, // Only animate once
            markers: false,
          },
        },
      );
    });

    return () => {
      animation.scrollTrigger?.kill();
      skillCards.forEach((card) => {
        const triggers = ScrollTrigger.getAll().filter(
          (t) => t.trigger === card,
        );
        triggers.forEach((trigger) => trigger.kill());
      });
    };
  });

  const handleSkillHover = (skillCard) => {
    gsap.to(skillCard, {
      y: -15,
      boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)",
      duration: 0.3,
      ease: "power2.out",
    });
    gsap.to(skillCard.querySelector(".skill-icon"), {
      scale: 1.2,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  const handleSkillLeave = (skillCard) => {
    gsap.to(skillCard, {
      y: 0,
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
      duration: 0.3,
      ease: "power2.out",
    });
    gsap.to(skillCard.querySelector(".skill-icon"), {
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  return (
    <SectionWrapper title="About Me">
      <div className="grid gap-8 p-8 border border-gray-700 md:grid-cols-2 bg-gray-800/50 rounded-3xl backdrop-blur-md">
        <div>
          <h3 className="mb-4 text-2xl font-bold">The Story</h3>
          <p className="leading-relaxed text-gray-400">
            Siswa di SMK Negeri 4 Bogor yang memiliki ketertarikan tinggi pada
            pengembangan perangkat lunak. Passion saya dalam coding mendorong
            saya untuk terus belajar dan berkembang dalam dunia teknologi.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-2xl font-bold">Quick Facts</h3>
          <div className="space-y-3 text-gray-400">
            <p>📚 Student at SMK Negeri 4 Bogor</p>
            <p>💻 Full-Stack Web Developer</p>
            <p>🚀 Passionate about clean code</p>
            <p>🎯 Always learning & improving</p>
          </div>
        </div>
      </div>

      {/* Horizontal Scrolling Skills Gallery */}
      <div ref={scrollContainerRef} className="relative mt-12">
        <h3 className="mb-6 text-2xl font-bold">Tech Stack</h3>
        <div className="p-1 overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl">
          <div
            ref={skillsWrapperRef}
            className="flex gap-6 px-4 pb-4 will-change-transform"
            style={{ willChange: 'transform' }}
          >
            {SKILLS.map((skill, idx) => (
              <div
                key={idx}
                className={`skill-card flex-shrink-0 w-48 h-56 bg-gradient-to-br ${skill.color} p-1 rounded-2xl cursor-pointer transition-shadow group`}
                onMouseEnter={(e) => handleSkillHover(e.currentTarget)}
                onMouseLeave={(e) => handleSkillLeave(e.currentTarget)}
              >
                <div className="relative flex flex-col items-center justify-center w-full h-full p-6 overflow-hidden bg-gray-900 rounded-2xl">
                  {/* Animated background gradient */}
                  <div className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-20 bg-gradient-to-br from-white to-transparent"></div>

                  <div className="z-10 mb-4 text-6xl transition-transform duration-300 skill-icon">
                    {skill.icon}
                  </div>
                  <span className="z-10 text-xl font-bold text-center">
                    {skill.name}
                  </span>

                  {/* Hover indicator */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 transition-opacity duration-300 opacity-0 bg-gradient-to-r group-hover:opacity-100"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${skill.color === "from-blue-500 to-cyan-500" ? "#0ea5e9" : "#10b981"}, ${skill.color === "from-blue-500 to-cyan-500" ? "#06b6d4" : "#34d399"})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-center text-gray-500 md:text-right animate-pulse">
          ✨ Scroll down to explore all skills →
        </p>
      </div>
    </SectionWrapper>
  );
};

export default About;
