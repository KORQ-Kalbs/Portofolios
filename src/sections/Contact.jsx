import React, { useState } from "react";
import SectionWrapper from "/src/components/SectionWrapper";

const Contact = () => {
  const [status, setStatus] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("Message sent successfully!");
    e.target.reset();
  };

  return (
    <SectionWrapper title="Get In Touch">
      <form
        onSubmit={handleSubmit}
        className="max-w-lg p-8 space-y-4 border border-gray-700 bg-gray-800/30 rounded-3xl"
      >
        <input
          required
          type="text"
          placeholder="Your Name"
          className="w-full p-4 transition-all border border-gray-700 outline-none bg-gray-900/50 rounded-xl focus:border-blue-500"
        />
        <input
          required
          type="email"
          placeholder="Your Email"
          className="w-full p-4 transition-all border border-gray-700 outline-none bg-gray-900/50 rounded-xl focus:border-blue-500"
        />
        <textarea
          required
          placeholder="Message"
          rows="4"
          className="w-full p-4 transition-all border border-gray-700 outline-none bg-gray-900/50 rounded-xl focus:border-blue-500"
        />
        <button className="w-full py-4 font-bold transition-all bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl shadow-blue-500/20">
          Send Message
        </button>
        {status && (
          <p className="text-sm text-center text-green-400">{status}</p>
        )}
      </form>
    </SectionWrapper>
  );
};
export default Contact;
