import React from 'react';

const Footer = () => (
  <footer className="bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 p-6 mt-12 rounded-t-3xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-none border-t border-gray-100 dark:border-gray-800 transition-colors duration-300">
    <div className="container mx-auto text-center text-sm md:text-base font-medium">
      &copy; {new Date().getFullYear()} บางเขน แบงค์คอกไกด์. สงวนลิขสิทธิ์.
    </div>
  </footer>
);

export default Footer;