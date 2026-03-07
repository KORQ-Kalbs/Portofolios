const SectionWrapper = ({ children, title }) => (
  <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
    <div className="inline-block px-4 py-1 mb-4 text-sm font-medium text-blue-400 border rounded-full bg-blue-500/10 border-blue-500/20">
      {title}
    </div>
    {children}
  </div>
);

export default SectionWrapper;
