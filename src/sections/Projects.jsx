import SectionWrapper from "/src/components/SectionWrapper";

const PROJECTS = [
  {
    title: "Toko Imaji",
    desc: "E-commerce platform with PHP/MySQL",
    tag: "Web App",
  },
  {
    title: "Personal Portfolio",
    desc: "Interactive portfolio with React",
    tag: "Design",
  },
];

const Projects = () => (
  <SectionWrapper title="Featured Work">
    <div className="grid gap-6 md:grid-cols-2">
      {PROJECTS.map((p, i) => (
        <div
          key={i}
          className="overflow-hidden transition-all border border-gray-700 group bg-gray-800/40 rounded-2xl hover:border-blue-500/50"
        >
          <div className="h-48 transition-transform duration-500 bg-gray-700 group-hover:scale-105" />
          <div className="p-6">
            <span className="font-mono text-xs tracking-widest text-blue-400 uppercase">
              {p.tag}
            </span>
            <h3 className="mt-2 text-xl font-bold">{p.title}</h3>
            <p className="mt-2 text-sm text-gray-400">{p.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </SectionWrapper>
);
export default Projects;
