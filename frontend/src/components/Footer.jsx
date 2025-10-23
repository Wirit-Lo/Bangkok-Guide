import React from 'react';

const Footer = () => (
  <footer className="bg-gray-900 text-white p-6 mt-12 rounded-t-3xl shadow-inner">
    <div className="container mx-auto text-center text-sm md:text-base">
      &copy; {new Date().getFullYear()} บางเขน แบงค์คอกไกด์. สงวนลิขสิทธิ์.
    </div>
  </footer>
);

export default Footer;