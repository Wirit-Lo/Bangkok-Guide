import React, { useState, useEffect } from 'react';
import { MapPin, Utensils, Home as HomeIcon, PlusCircle, LogIn, LogOut, User, Heart, Menu, X, Settings, Sun, Moon, Bell, Gift, ThumbsUp, MessageSquare, BellOff } from 'lucide-react';

// --- Reusable NavLink Component ---
const NavLink = ({ icon, text, page, setCurrentPage, isActive }) => (
  <button
    onClick={() => setCurrentPage(page)}
    className="relative group flex items-center px-4 py-3 text-base font-medium transition-colors"
  >
    <div className={`mr-2 transition-colors ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'}`}>
      {icon}
    </div>
    <span className={`transition-colors ${isActive ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'}`}>
      {text}
    </span>
    <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 dark:bg-blue-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ${isActive ? 'scale-x-100' : ''}`}></span>
  </button>
);

// <<< REMOVED: The formatTimeAgo function has been removed to revert to absolute timestamps.

// Helper to get notification icon
const getNotificationIcon = (type) => {
    switch (type) {
        case 'new_location':
            return <MapPin size={14} className="text-blue-500"/>;
        case 'new_product':
            return <Gift size={14} className="text-amber-500"/>;
        case 'new_like':
            return <ThumbsUp size={14} className="text-pink-500"/>;
        case 'new_reply':
            return <MessageSquare size={14} className="text-green-500"/>;
        default:
            return <Bell size={14} className="text-gray-500"/>;
    }
};


const Header = ({ currentPage, setCurrentPage, currentUser, handleLogout, theme, toggleTheme, notifications, unreadCount, handleMarkNotificationsAsRead, handleItemClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { icon: <HomeIcon size={20} />, text: "หน้าหลัก", page: "home" },
    { icon: <MapPin size={20} />, text: "สถานที่ท่องเที่ยว", page: "attractions" },
    { icon: <Utensils size={20} />, text: "ร้านอาหาร", page: "foodshops" },
    { icon: <PlusCircle size={20} />, text: "เพิ่มสถานที่", page: "add-location" },
  ];
  
  const handleNotificationClick = (notification) => {
      handleItemClick(notification.payload.location);
      setIsNotificationPanelOpen(false);
  };

  const toggleNotificationPanel = () => {
      const willBeOpen = !isNotificationPanelOpen;
      setIsNotificationPanelOpen(willBeOpen);
      if (willBeOpen && unreadCount > 0) {
          handleMarkNotificationsAsRead();
      }
  };


  const logoTextColor = theme === 'dark' ? 'text-white' : (scrolled ? 'text-blue-600' : 'text-white');
  
  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 dark:bg-gray-800/95 shadow-md backdrop-blur-sm border-b border-gray-200 dark:border-gray-700' : 'bg-transparent'}`}>
      <div className="container mx-auto flex items-center justify-between p-5">
        
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setCurrentPage('home')}
        >
          <MapPin className={`transition-all duration-300 ${logoTextColor} group-hover:animate-pulse group-hover:drop-shadow-lg`} size={36} />
          <span className="text-3xl font-extrabold">
            <span
              className="bg-gradient-to-r from-sky-400 via-violet-500 to-pink-500 bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-wide group-hover:brightness-110"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}
            >
              Bangkok Guide
            </span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-2 bg-white/50 dark:bg-gray-700/50 p-1 rounded-full shadow-inner">
          {navLinks
            .filter(link => link.page !== 'add-location' || currentUser)
            .map(link => (
              <NavLink key={link.page} {...link} setCurrentPage={setCurrentPage} isActive={currentPage === link.page} />
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
            <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme"
            >
                {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
            </button>

            {currentUser && (
                <div className="relative">
                    <button
                        onClick={toggleNotificationPanel}
                        className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Bell size={22} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                               {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    <div 
                        className={`absolute right-0 top-full mt-2 w-80 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 transition-all duration-200 ${isNotificationPanelOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
                    >
                        <div className="p-3 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-100">การแจ้งเตือน</h4>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {notifications && notifications.length > 0 ? (
                                notifications.map(notif => {
                                    const icon = getNotificationIcon(notif.type);
                                    let text = '';
                                    if (notif.type === 'new_location') text = 'ได้เพิ่มสถานที่ใหม่:';
                                    else if (notif.type === 'new_product') text = `ได้เพิ่มของขึ้นชื่อใหม่ที่ ${notif.payload.location.name}:`;
                                    else if (notif.type === 'new_like') text = 'ได้กดถูกใจรีวิวของคุณที่';
                                    else if (notif.type === 'new_reply') text = 'ได้ตอบกลับรีวิวของคุณที่';

                                    return (
                                    <button 
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`w-full text-left flex items-start p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b dark:border-gray-700 ${!notif.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                    >
                                        <div className="flex-shrink-0 relative">
                                            <img src={notif.payload.location.imageUrl || 'https://placehold.co/100x100/e2e8f0/333333?text=Img'} className="w-16 h-16 rounded-lg object-cover"/>
                                            <div className="absolute -bottom-2 -right-2 bg-white dark:bg-gray-700 p-1 rounded-full shadow">
                                                {icon}
                                            </div>
                                        </div>
                                        <div className="ml-4 flex-1">
                                            <p className="text-sm text-gray-700 dark:text-gray-200">
                                                <span className="font-bold">{notif.actor_name}</span>
                                                {` ${text} `}
                                                {notif.type !== 'new_product' && <span className="font-bold">{notif.payload.location.name}</span>}
                                            </p>
                                            
                                            {(notif.type === 'new_product' || (notif.type === 'new_reply' && notif.payload.comment)) && (
                                                <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                                     <p className="text-sm italic text-gray-600 dark:text-gray-300 truncate">
                                                        "{notif.type === 'new_product' ? notif.payload.product.name : notif.payload.comment}"
                                                     </p>
                                                </div>
                                            )}

                                            {/* <<< CHANGED: Reverted to absolute timestamp >>> */}
                                            <p className="text-xs text-gray-400 mt-1">{new Date(notif.created_at).toLocaleString('th-TH')}</p>
                                        </div>
                                    </button>
                                )})
                            ) : (
                                <div className="p-8 flex flex-col items-center justify-center text-center">
                                    <BellOff size={40} className="text-gray-300 dark:text-gray-500" />
                                    <p className="mt-4 font-semibold text-gray-700 dark:text-gray-200">ยังไม่มีการแจ้งเตือน</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">การแจ้งเตือนใหม่ๆ จะแสดงที่นี่</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}


          {currentUser ? (
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 pl-2 pr-4 py-2 rounded-full bg-gradient-to-r from-green-400 to-teal-500 text-white shadow-lg hover:shadow-green-500/50 transition-all"
              >
                <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                   {currentUser.profile_image_url ? (
                     <img src={`${currentUser.profile_image_url}`} alt="Profile" className="w-full h-full rounded-full object-cover" />
                   ) : (
                     <User size={18} />
                   )}
                </div>
                <span className="font-semibold text-base">{currentUser.displayName}</span>
              </button>
              <div 
                className={`absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl transition-all duration-200 ${isUserMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
              >
                <div className="p-2">
                  <button onClick={() => { setCurrentPage('profile'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md">
                    <Settings size={16} className="mr-2" /> แก้ไขโปรไฟล์
                  </button>
                  <button onClick={() => { setCurrentPage('favorites'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md">
                    <Heart size={16} className="mr-2" /> รายการโปรด
                  </button>
                  <hr className="my-1 border-gray-100 dark:border-gray-600" />
                  <button onClick={() => { handleLogout(); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md">
                    <LogOut size={16} className="mr-2" /> ออกจากระบบ
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setCurrentPage('login')}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:shadow-lg hover:shadow-blue-500/50 transition-all shadow-md"
            >
              <LogIn size={18} />
              <span className="text-base font-bold">เข้าสู่ระบบ</span>
            </button>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
            {currentUser && (
                <div className="relative">
                    <button
                        onClick={toggleNotificationPanel}
                        className="p-2 rounded-full bg-white/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200"
                    >
                        <Bell size={24} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 flex h-3 w-3">
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </button>
                </div>
            )}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-full bg-white/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 pb-4 px-2 border-t border-gray-200 dark:border-gray-700">
          <nav className="flex flex-col items-start gap-1">
            {navLinks
              .filter(link => link.page !== 'add-location' || currentUser)
              .map(link => (
                <NavLink key={link.page} {...link} setCurrentPage={(page) => {setCurrentPage(page); setIsMobileMenuOpen(false);}} isActive={currentPage === link.page} />
            ))}
            <hr className="w-full my-2 border-gray-200 dark:border-gray-700" />
            <button
                onClick={()=>{toggleTheme(); setIsMobileMenuOpen(false);}}
                className="w-full flex items-center p-3 text-left"
            >
                <div className="text-gray-400">{theme === 'light' ? <Moon size={20}/> : <Sun size={20}/>}</div>
                <span className="ml-3 font-semibold text-gray-600 dark:text-gray-300">เปลี่ยนเป็น {theme === 'light' ? 'ธีมมืด' : 'ธีมสว่าง'}</span>
            </button>
            <hr className="w-full my-2 border-gray-200 dark:border-gray-700" />
            {currentUser ? (
              <>
                <button onClick={() => { setCurrentPage('profile'); setIsMobileMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Settings size={16} className="mr-2" /> แก้ไขโปรไฟล์
                </button>
                <button onClick={() => { setCurrentPage('favorites'); setIsMobileMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                  <Heart size={16} className="mr-2" /> รายการโปรด
                </button>
                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md">
                  <LogOut size={16} className="mr-2" /> ออกจากระบบ
                </button>
              </>
            ) : (
              <button onClick={() => { setCurrentPage('login'); setIsMobileMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                <LogIn size={16} className="mr-2" /> เข้าสู่ระบบ
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;

