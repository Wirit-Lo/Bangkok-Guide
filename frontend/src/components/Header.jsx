import React, { useState, useEffect, useRef, memo } from 'react';
import { 
    Sun, Moon, Bell, User, X, MapPin, MessageSquare, ThumbsUp, BellOff, 
    Settings, Heart, LogOut, LogIn, Menu, Home as HomeIcon, Utensils, 
    PlusCircle, Users, Trash2 // เพิ่ม Trash2 icon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Reusable NavLink Component ---
const NavLink = memo(({ icon, text, page, setCurrentPage, isActive }) => (
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
));

// --- Individual Notification Item Component ---
const NotificationItem = memo(({ notification, onNotificationClick }) => {
    
    const handleItemClick = () => {
        if (notification.link) {
            onNotificationClick(notification);
        }
    };

    const handleKeyDown = (e) => {
        if (notification.link && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleItemClick();
        }
    };

    return (
        <div 
            onClick={notification.link ? handleItemClick : undefined} 
            className={`w-full text-left flex items-start p-3 transition-colors duration-200 border-b dark:border-gray-700 ${notification.link ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : ''}`}
            role={notification.link ? "button" : undefined}
            tabIndex={notification.link ? 0 : undefined}
            onKeyDown={handleKeyDown}
        >
            <div className="flex-shrink-0 relative">
                <img 
                    src={notification.userImage || 'https://placehold.co/48x48/e2e8f0/333333?text=🌍'} 
                    className="w-10 h-10 rounded-full object-cover shadow-sm"
                    alt="Profile image"
                />
            </div>
            <div className="ml-4 flex-1 overflow-hidden">
                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2" dangerouslySetInnerHTML={{ __html: notification.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}></p>
                <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-1">
                    {formatDistanceToNow(new Date(notification.time), { addSuffix: true, locale: th })}
                </p>
            </div>
        </div>
    );
});


// --- Notification Panel Component ---
const NotificationPanel = ({ isOpen, notifications, onNotificationClick, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className={`absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 transition-all duration-200 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
            <div className="flex justify-between items-center p-4 font-bold border-b dark:border-gray-700 text-gray-800 dark:text-white">
                การแจ้งเตือน
                <button 
                    onClick={onClose} 
                    className="text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    aria-label="Close notifications panel"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="flex flex-col max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                    notifications.map((notif) => <NotificationItem key={notif.id} notification={notif} onNotificationClick={onNotificationClick} />)
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                        <BellOff size={40} className="text-gray-300 dark:text-gray-500" />
                        <p className="mt-4 font-semibold text-gray-700 dark:text-gray-200">ยังไม่มีการแจ้งเตือน</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">การแจ้งเตือนใหม่ๆ จะแสดงที่นี่</p>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main Header Component ---
const Header = ({ 
    currentPage, 
    setCurrentPage, 
    currentUser, 
    handleLogout, 
    theme, 
    toggleTheme, 
    notifications,
    unreadCount,
    handleMarkNotificationsAsRead,
    onNotificationClick,
    
    // --- New Props for Multi-Account ---
    handleAddAccount,
    savedAccounts = [],
    handleSelectAccount,
    handleRemoveAccount // รับ props ลบบัญชี
}) => {
    const [scrolled, setScrolled] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const userMenuRef = useRef(null);
    const notificationPanelRef = useRef(null);

    // Effect for handling scroll to change header style
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Effect for closing menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setIsUserMenuOpen(false);
            if (notificationPanelRef.current && !notificationPanelRef.current.contains(event.target)) setIsNotificationPanelOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleNotificationPanel = () => {
        const willBeOpen = !isNotificationPanelOpen;
        setIsNotificationPanelOpen(willBeOpen);
        if (willBeOpen && unreadCount > 0) {
            setTimeout(() => handleMarkNotificationsAsRead(), 1500);
        }
    };

    const handleLogoKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCurrentPage('home');
        }
    };

    const navLinks = [
        { icon: <HomeIcon size={20} />, text: "หน้าหลัก", page: "home" },
        { icon: <MapPin size={20} />, text: "สถานที่ท่องเที่ยว", page: "attractions" },
        { icon: <Utensils size={20} />, text: "ร้านอาหาร", page: "foodshops" },
    ];
    if (currentUser) {
        navLinks.push({ icon: <PlusCircle size={20} />, text: "เพิ่มสถานที่", page: "add-location" });
    }

    // Filter accounts to show only OTHER accounts
    const otherAccounts = savedAccounts.filter(acc => acc.user.id !== currentUser?.id);
    
    return (
        <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'bg-white/95 dark:bg-gray-800/95 shadow-md backdrop-blur-sm border-b border-gray-200 dark:border-gray-700' : 'bg-transparent'}`}>
            <div className="container mx-auto flex items-center justify-between p-5">
                <div 
                    className="flex items-center gap-3 cursor-pointer group" 
                    onClick={() => setCurrentPage('home')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={handleLogoKeyDown}
                >
                    <MapPin className={`transition-all duration-300 text-blue-600 dark:text-blue-400 group-hover:animate-pulse group-hover:drop-shadow-lg`} size={36} />
                    <span className="text-3xl font-extrabold">
                        <span className="bg-gradient-to-r from-sky-400 via-violet-500 to-pink-500 bg-clip-text text-transparent transition-all duration-300 group-hover:tracking-wide group-hover:brightness-110" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>Bangkok Guide</span>
                    </span>
                </div>

                <nav className="hidden md:flex items-center gap-2 bg-white/50 dark:bg-gray-700/50 p-1 rounded-full shadow-inner">
                    {navLinks.map(link => <NavLink key={link.page} {...link} setCurrentPage={setCurrentPage} isActive={currentPage === link.page} />)}
                </nav>

                <div className="hidden md:flex items-center gap-4">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme">
                        {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
                    </button>
                    {currentUser && (
                        <div className="relative" ref={notificationPanelRef}>
                            <button 
                                onClick={toggleNotificationPanel} 
                                className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                aria-label="Toggle notifications"
                            >
                                <Bell size={22} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">{unreadCount > 9 ? '9+' : unreadCount}</span>
                                )}
                            </button>
                            <NotificationPanel 
                                isOpen={isNotificationPanelOpen} 
                                notifications={notifications} 
                                onNotificationClick={(notification) => {
                                    onNotificationClick(notification);
                                    setIsNotificationPanelOpen(false);
                                }}
                                onClose={() => setIsNotificationPanelOpen(false)}
                            />
                        </div>
                    )}
                    {currentUser ? (
                        <div className="relative" ref={userMenuRef}>
                            <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 pl-2 pr-4 py-2 rounded-full bg-gradient-to-r from-green-400 to-teal-500 text-white shadow-lg hover:shadow-green-500/50 transition-all">
                                 <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center overflow-hidden">
                                     {currentUser.profileImageUrl || currentUser.profileImage ? 
                                        <img src={currentUser.profileImageUrl || currentUser.profileImage} alt="Profile" className="w-full h-full rounded-full object-cover" /> 
                                        : <User size={18} />}
                                 </div>
                                <span className="font-semibold text-base">{currentUser.displayName || currentUser.username}</span>
                            </button>
                            
                            {/* User Dropdown Menu */}
                            <div className={`absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-700 rounded-lg shadow-xl transition-all duration-200 z-50 ${isUserMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                                <div className="p-2">
                                    <button onClick={() => { setCurrentPage('profile'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md">
                                        <Settings size={16} className="mr-2" /> แก้ไขโปรไฟล์
                                    </button>
                                    <button onClick={() => { setCurrentPage('favorites'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md">
                                        <Heart size={16} className="mr-2" /> รายการโปรด
                                    </button>
                                    
                                    <hr className="my-1 border-gray-100 dark:border-gray-600" />

                                    {/* Multi-Account Section */}
                                    {otherAccounts.length > 0 && (
                                        <div className="mb-1">
                                            <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                สลับบัญชี
                                            </div>
                                            {otherAccounts.map((account, index) => (
                                                // --- ปรับโครงสร้างเป็น Flex เพื่อวางปุ่มลบไว้ด้านขวา ---
                                                <div key={index} className="flex items-center justify-between w-full group hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors pr-2">
                                                    <button 
                                                        onClick={() => { handleSelectAccount(account); setIsUserMenuOpen(false); }}
                                                        className="flex-1 text-left px-3 py-2 text-gray-700 dark:text-gray-200 flex items-center gap-2 transition-colors text-sm overflow-hidden"
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                            {account.user.profileImageUrl || account.user.profileImage ? (
                                                                <img src={account.user.profileImageUrl || account.user.profileImage} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User size={14} />
                                                            )}
                                                        </div>
                                                        <span className="truncate">{account.user.displayName || account.user.username}</span>
                                                    </button>
                                                    
                                                    {/* --- ปุ่มลบบัญชี (แสดงเมื่อ Hover) --- */}
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            handleRemoveAccount(account); 
                                                        }}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                        title="ลบบัญชีนี้"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            <hr className="my-1 border-gray-100 dark:border-gray-600" />
                                        </div>
                                    )}

                                    <button onClick={() => { handleAddAccount(); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md">
                                        <PlusCircle size={16} className="mr-2" /> เพิ่มบัญชีอื่น
                                    </button>

                                    <hr className="my-1 border-gray-100 dark:border-gray-600" />
                                    
                                    <button onClick={() => { handleLogout(); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md">
                                        <LogOut size={16} className="mr-2" /> ออกจากระบบ
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setCurrentPage('login')} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:shadow-lg hover:shadow-blue-500/50 transition-all shadow-md"><LogIn size={18} /><span className="text-base font-bold">เข้าสู่ระบบ</span></button>
                    )}
                </div>

                {/* Mobile Menu (Simplified for brevity, uses existing patterns) */}
                <div className="md:hidden flex items-center gap-2">
                     {/* You can implement mobile menu toggle logic here if needed */}
                </div>
            </div>
        </header>
    );
};

export default Header;