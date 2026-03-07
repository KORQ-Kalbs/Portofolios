import SectionWrapper from "/src/components/SectionWrapper";

const Hero = ({ onNavigate }) => (
  <SectionWrapper title="Welcome to my world">
    <h1 className="text-5xl font-extrabold leading-tight md:text-7xl">
      Transforming <span className="text-blue-500">Ideas</span> into Digital{" "}
      <span className="text-purple-500">Reality.</span>
    </h1>
    <p className="max-w-2xl text-lg text-gray-400">
      I'm a Full-stack Developer focused on building clean, performant, and
      user-centric applications.
    </p>
    <div className="flex pt-4 space-x-4">
      <button
        onClick={() => onNavigate("projects")}
        className="px-8 py-3 font-semibold transition-all bg-blue-600 rounded-full hover:bg-blue-700"
      >
        View Projects
      </button>
      <button
        onClick={() => onNavigate("contact")}
        className="px-8 py-3 font-semibold transition-all border border-gray-600 rounded-full hover:border-blue-500"
      >
        Contact Me
      </button>
    </div>
  </SectionWrapper>
);
export default Hero;
