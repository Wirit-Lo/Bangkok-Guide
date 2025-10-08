import React from 'react';

const NavLink = ({ icon, text, page, setCurrentPage }) => (
  <button
    onClick={() => setCurrentPage(page)}
    className="flex items-center px-4 py-2 rounded-full hover:bg-white hover:text-purple-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-70 text-base md:text-lg font-medium group relative overflow-hidden" /* Added relative and overflow-hidden */
  >
    {/* Added a subtle background ripple effect on hover */}
    <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-full scale-0 group-hover:scale-100 origin-center"></span>
    {icon}
    <span className="ml-2 z-10 group-hover:font-bold">{text}</span> {/* z-10 to keep text above ripple */}
  </button>
);

export default NavLink;
