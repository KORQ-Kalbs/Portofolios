import SectionWrapper from "/src/components/SectionWrapper";

const SKILLS = ["React", "Node.js", "PHP", "Laravel", "MySQL", "Tailwind CSS"];

const About = () => (
  <SectionWrapper title="About Me">
    <div className="grid gap-8 p-8 border border-gray-700 md:grid-cols-2 bg-gray-800/50 rounded-3xl backdrop-blur-md">
      <div>
        <h3 className="mb-4 text-2xl font-bold">The Story</h3>
        <p className="leading-relaxed text-gray-400">
          Siswa di SMK Negeri 4 Bogor yang memiliki ketertarikan tinggi pada
          pengembangan perangkat lunak...
        </p>
      </div>
      <div>
        <h3 className="mb-4 text-2xl font-bold">Tech Stack</h3>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => (
            <span
              key={skill}
              className="px-4 py-2 text-sm bg-gray-700 border border-gray-600 rounded-lg"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </div>
  </SectionWrapper>
);
export default About;
