import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { 
    CheckCircle, XCircle, Loader, Sun, Moon, Bell, User, X, MapPin, 
    MessageSquare, ThumbsUp, BellOff, Settings, Heart, LogOut, LogIn, Menu, 
    Home as HomeIcon, Utensils, PlusCircle, LayoutGrid, Landmark, Coffee, 
    ShoppingBag, ListFilter, ChevronRight, Wrench, ShieldCheck, ArrowRight, 
    Star, TrendingUp, Edit, Trash2, Clock, Phone, Tag, FileText, Send, 
    ChevronDown, Check, Gift, Plus, Image as ImageIcon, Save, AlertTriangle, ShieldOff, Eye, EyeOff, Lock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- START: ALL COMPONENTS IN ONE FILE ---

// --- COMPONENT: Header ---

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
    onNotificationClick 
}) => {
    const [scrolled, setScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
    const userMenuRef = useRef(null);
    const notificationPanelRef = useRef(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
                                 <div className="w-8 h-8 bg-white/30 rounded-full flex items-center justify-center">
                                    {currentUser.profileImageUrl ? 
                                        <img src={currentUser.profileImageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" /> 
                                        : <User size={18} />}
                                 </div>
                                <span className="font-semibold text-base">{currentUser.displayName || currentUser.username}</span>
                            </button>
                            <div className={`absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl transition-all duration-200 ${isUserMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
                                <div className="p-2">
                                    <button onClick={() => { setCurrentPage('profile'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md"><Settings size={16} className="mr-2" /> แก้ไขโปรไฟล์</button>
                                    <button onClick={() => { setCurrentPage('favorites'); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md"><Heart size={16} className="mr-2" /> รายการโปรด</button>
                                    <hr className="my-1 border-gray-100 dark:border-gray-600" />
                                    <button onClick={() => { handleLogout(); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-md"><LogOut size={16} className="mr-2" /> ออกจากระบบ</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setCurrentPage('login')} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full hover:shadow-lg hover:shadow-blue-500/50 transition-all shadow-md"><LogIn size={18} /><span className="text-base font-bold">เข้าสู่ระบบ</span></button>
                    )}
                </div>

                {/* Mobile Menu */}
                <div className="md:hidden flex items-center gap-2">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Toggle theme">
                        {theme === 'light' ? <Moon size={22} /> : <Sun size={22} />}
                    </button>
                     <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-gray-600 dark:text-gray-400" aria-label="Open menu">
                        <Menu size={24} />
                    </button>
                </div>
            </div>
            
            {/* Mobile Menu Panel */}
            {isMobileMenuOpen && (
                 <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4">
                    <nav className="flex flex-col gap-2">
                         {navLinks.map(link => (
                            <button key={`mobile-${link.page}`} onClick={() => { setCurrentPage(link.page); setIsMobileMenuOpen(false); }} className={`flex items-center p-3 rounded-lg font-semibold ${currentPage === link.page ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                {link.icon}
                                <span className="ml-3">{link.text}</span>
                            </button>
                         ))}
                    </nav>
                </div>
            )}
        </header>
    );
};


// --- COMPONENT: Footer ---
const Footer = () => (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto md:ml-64">
        <div className="container mx-auto py-6 px-4 text-center text-gray-500 dark:text-gray-400">
            <p>&copy; {new Date().getFullYear()} Bangkok Guide. Created by Wirit Lo.</p>
        </div>
    </footer>
);

// --- COMPONENT: Sidebar ---
const Sidebar = ({ selectedCategory, setSelectedCategory, setCurrentPage, currentUser, handleLogout }) => {
 
    const handleCategoryClick = (category) => {
        setSelectedCategory(category.name);
        
        if (category.name === 'ร้านอาหาร' || category.name === 'คาเฟ่' || category.name === 'ตลาด') {
            setCurrentPage('foodshops');
        } else if (category.name !== 'ทั้งหมด') {
            setCurrentPage('attractions');
        } else {
            setCurrentPage('home');
        }
    };
 
    return (
        <aside className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg p-5 pt-24 z-30 transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out border-r border-gray-100 dark:border-gray-700 flex flex-col">
            
            <div className="flex-grow">
                <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">หมวดหมู่</h3>
                <nav className="space-y-2">
                    {categories.map((category) => (
                        <button
                            key={category.name}
                            onClick={() => handleCategoryClick(category)}
                            className={`w-full flex items-center p-3 rounded-lg text-left transition-all duration-200 group
                                ${selectedCategory === category.name
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <div className={`transition-colors ${selectedCategory === category.name ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`}>
                                {category.icon}
                            </div>
                            <span className="ml-3 font-semibold">{category.name}</span>
                            <ChevronRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    ))}
                </nav>

                <hr className="my-6 border-gray-200 dark:border-gray-600" />
                
                <nav className="space-y-2">
                    {currentUser && (
                        <button
                            onClick={() => setCurrentPage('add-location')}
                            className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
                        >
                            <PlusCircle size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                            <span className="ml-3 font-semibold">เพิ่มสถานที่</span>
                        </button>
                    )}

                    {currentUser && currentUser.role === 'admin' && (
                        <>
                            <button
                                onClick={() => setCurrentPage('manage-products')}
                                className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
                            >
                                <Wrench size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                <span className="ml-3 font-semibold">จัดการของขึ้นชื่อ</span>
                            </button>
                            <button
                                onClick={() => setCurrentPage('deletion-requests')}
                                className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
                            >
                                <ShieldCheck size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                <span className="ml-3 font-semibold">อนุมัติการลบ</span>
                            </button>
                        </>
                    )}
                </nav>
            </div>

            <div className="flex-shrink-0">
                <hr className="my-4 border-t border-gray-200 dark:border-gray-600" />
                {currentUser ? (
                    <div className="space-y-2">
                        <button 
                            onClick={() => setCurrentPage('profile')}
                            className="w-full flex items-center p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="w-10 h-10 bg-blue-100 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {currentUser.profileImageUrl ? (
                                    <img src={currentUser.profileImageUrl} alt="User profile" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <User size={20} className="text-blue-600 dark:text-blue-300" />
                                )}
                            </div>
                            <div className="ml-3 overflow-hidden">
                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{currentUser.displayName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">ดูโปรไฟล์</p>
                            </div>
                        </button>
                        <button
                            onClick={() => setCurrentPage('favorites')}
                            className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
                        >
                            <Heart size={20} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                            <span className="ml-3 font-semibold">รายการโปรด</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
                        >
                            <LogOut size={20} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                            <span className="ml-3 font-semibold">ออกจากระบบ</span>
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setCurrentPage('login')}
                        className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
                    >
                        <LogIn size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        <span className="ml-3 font-semibold">เข้าสู่ระบบ / สมัครสมาชิก</span>
                    </button>
                )}
            </div>
        </aside>
    );
};

// ... (Paste all other full components like HomePage, LoginPage, DetailPage, etc. here)
// For brevity, they are omitted but they should all be in this file.

// --- MAIN APP COMPONENT (The root of the application) ---

const App = () => {
    // --- State Management ---
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
    const [attractions, setAttractions] = useState([]);
    const [foodShops, setFoodShops] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    const handleAuthError = useCallback(() => {
        setNotification({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', type: 'error' });
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setToken(null);
        setCurrentPage('login');
    }, []);
    
    const fetchLocations = useCallback(async () => {
        setLoadingData(true);
        try {
            const [attractionsResponse, foodShopsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/attractions`),
                fetch(`${API_BASE_URL}/api/foodShops`),
            ]);
            if (!attractionsResponse.ok || !foodShopsResponse.ok) throw new Error('Failed to fetch locations');
            
            const attractionsData = await attractionsResponse.json();
            const foodShopsData = await foodShopsResponse.json();
            setAttractions(attractionsData);
            setFoodShops(foodShopsData);
        } catch (error) {
            console.error("Error fetching data from backend:", error);
            setNotification({ message: "ไม่สามารถโหลดข้อมูลจาก Backend ได้", type: 'error' });
        } finally {
            setLoadingData(false);
        }
    }, [API_BASE_URL]);

    const fetchFavorites = useCallback(async (userToken) => {
        if (!userToken) return setFavorites([]);
        try {
            const response = await fetch(`${API_BASE_URL}/api/favorites`, {
                headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const data = await response.json();
            setFavorites(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching favorites:", error.message);
            setFavorites([]);
        }
    }, [handleAuthError, API_BASE_URL]);

    useEffect(() => {
        const initializeApp = async () => {
            await fetchLocations();
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            if (storedToken && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setCurrentUser(parsedUser);
                    setToken(storedToken);
                    await fetchFavorites(storedToken);
                } catch (e) {
                    console.error("Failed to parse user from localStorage", e);
                    handleAuthError();
                }
            }
        };
        initializeApp();
    }, [fetchLocations, fetchFavorites, handleAuthError]);
    
    useEffect(() => {
        if (!token) {
            setNotifications([]);
            return;
        }

        const eventSource = new EventSource(`${API_BASE_URL}/api/events?token=${token}`);
        
        eventSource.onopen = () => console.log("✅ SSE Connection established.");

        eventSource.onmessage = (event) => {
            const eventData = JSON.parse(event.data);
            
            if (eventData.type === 'historic_notifications') {
                const formattedData = eventData.data.map(notif => formatNotification(notif, API_BASE_URL));
                setNotifications(formattedData);
            }
            
            if (eventData.type === 'notification' && eventData.data) {
                const newNotification = formatNotification(eventData.data, API_BASE_URL);
                setNotifications(prev => [newNotification, ...prev].slice(0, 20));

                if (eventData.data.type === 'new_location' && eventData.data.payload.location) {
                    const newLocation = eventData.data.payload.location;
                    const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category);
                    const setter = isFoodShop ? setFoodShops : setAttractions;
                    setter(prev => [newLocation, ...prev]);
                }
            }
        };

        eventSource.onerror = (err) => {
            console.error("❌ EventSource failed:", err);
            eventSource.close();
        };

        return () => {
            console.log("Closing SSE Connection.");
            eventSource.close();
        };
    }, [token, API_BASE_URL]);

    useEffect(() => {
        setUnreadCount(notifications.filter(n => !n.is_read).length);
    }, [notifications]);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [theme]);
    
    const handleMarkNotificationsAsRead = useCallback(async () => {
        if (unreadCount === 0 || !token) return;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        try {
            await fetch(`${API_BASE_URL}/api/notifications/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Failed to mark notifications as read on server:", error);
        }
    }, [unreadCount, token, API_BASE_URL]);
    
    const handleNotificationClick = useCallback((notificationPayload) => {
        const locationId = notificationPayload.link;
        if (!locationId) return;

        const allItems = [...attractions, ...foodShops];
        const location = allItems.find(item => item.id === locationId);
        
        if (location) {
            setSelectedItem(location);
            setCurrentPage('detail');
        } else {
            console.warn("Location not in state, fetching as fallback...");
            fetch(`${API_BASE_URL}/api/locations/${locationId}`)
                .then(res => res.ok ? res.json() : Promise.reject('Location not found via fallback'))
                .then(itemData => {
                    if (itemData && itemData.id) {
                        setSelectedItem(itemData);
                        setCurrentPage('detail');
                    } else {
                        setNotification({ message: 'ไม่พบข้อมูลสถานที่', type: 'error' });
                    }
                })
                .catch(() => setNotification({ message: 'ไม่สามารถโหลดข้อมูลสถานที่ได้', type: 'error' }));
        }
    }, [attractions, foodShops, API_BASE_URL, setNotification]);
    
    const handleSetCurrentPage = (page) => {
        if (currentPage === page) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentPage(page);
            setIsTransitioning(false);
            window.scrollTo(0, 0);
        }, 200);
    };

    const handleToggleFavorite = useCallback(async (locationId) => {
        if (!currentUser) {
            setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' });
            return handleSetCurrentPage('login');
        }
        
        const isCurrentlyFavorite = favorites.includes(locationId);
        
        setFavorites(prev => 
            isCurrentlyFavorite 
                ? prev.filter(id => id !== locationId) 
                : [...prev, locationId]
        );

        try {
            const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ locationId }),
            });
            
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error('Failed to toggle favorite on server');

        } catch (error) {
            console.error("Error toggling favorite:", error);
            setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' });
            fetchFavorites(token);
        }
    }, [currentUser, favorites, token, handleAuthError, fetchFavorites, API_BASE_URL, handleSetCurrentPage, setNotification]);
    
    const handleLogin = (userData, userToken) => {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userToken);
        setCurrentUser(userData);
        setToken(userToken);
        fetchFavorites(userToken);
        handleSetCurrentPage('home');
        setNotification({ message: `ยินดีต้อนรับ, ${userData.displayName || userData.username}!`, type: 'success' });
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setToken(null);
        setFavorites([]);
        setNotification({ message: 'ออกจากระบบสำเร็จ', type: 'success' });
        handleSetCurrentPage('home');
    };
    
    const handleProfileUpdate = (updatedUser, newToken) => {
        setCurrentUser(updatedUser);
        setToken(newToken);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        localStorage.setItem('token', newToken);
        setNotification({ message: 'ข้อมูลโปรไฟล์อัปเดตแล้ว!', type: 'success' });
    };

    const handleDataRefresh = useCallback(async (updatedItemId) => {
        await fetchLocations();
        if (updatedItemId && selectedItem?.id === updatedItemId) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/locations/${updatedItemId}`);
                if (response.ok) {
                    const updatedItemData = await response.json();
                    setSelectedItem(updatedItemData);
                }
            } catch (error) {
                console.error("Failed to refresh selected item:", error);
            }
        }
    }, [fetchLocations, selectedItem, API_BASE_URL]);

    const handleUpdateItem = (updatedItem) => {
        const updateState = (setter) => setter(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        if (attractions.some(a => a.id === updatedItem.id)) {
            updateState(setAttractions);
        } else {
            updateState(setFoodShops);
        }
        if (selectedItem?.id === updatedItem.id) {
            setSelectedItem(updatedItem);
        }
        setIsEditModalOpen(false);
        setItemToEdit(null);
    };

    const filteredAttractions = useMemo(() => {
        if (selectedCategory === 'ทั้งหมด') return attractions;
        return attractions.filter(item => item.category === selectedCategory);
    }, [attractions, selectedCategory]);

    const filteredFoodShops = useMemo(() => {
        if (selectedCategory === 'ทั้งหมด') return foodShops;
        return foodShops.filter(item => item.category === selectedCategory);
    }, [foodShops, selectedCategory]);
    
    const favoriteItems = useMemo(() => {
        const allItems = [...attractions, ...foodShops];
        if (!Array.isArray(favorites)) return [];
        return allItems.filter(item => favorites.includes(item.id));
    }, [attractions, foodShops, favorites]);

    const renderPage = () => {
        if (loadingData && !currentUser) {
            return (
                <div className="flex flex-col justify-center items-center h-96 text-gray-500 dark:text-gray-400">
                    <Loader className="animate-spin h-12 w-12 text-blue-500" />
                    <p className="mt-4 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            );
        }
        
        const commonProps = { 
            handleItemClick: (item) => { setSelectedItem(item); handleSetCurrentPage('detail'); },
            currentUser, 
            favorites, 
            handleToggleFavorite,
            handleEditItem: (item) => { setItemToEdit(item); setIsEditModalOpen(true); },
            handleDeleteItem: () => {} // Placeholder for now
        };

        switch (currentPage) {
            case 'attractions': return <AttractionsPage attractions={filteredAttractions} {...commonProps} />;
            case 'foodshops': return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} />;
            case 'add-location': return <AddLocationPage setCurrentPage={handleSetCurrentPage} onLocationAdded={handleDataRefresh} setNotification={setNotification} handleAuthError={handleAuthError} />;
            case 'login': return <LoginPage onAuthSuccess={handleLogin} setNotification={setNotification} />;
            case 'favorites': return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
            case 'profile': return <UserProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} handleAuthError={handleAuthError} handleLogout={handleLogout} setNotification={setNotification} />;
            case 'manage-products': return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} />;
            case 'deletion-requests': return <ApproveDeletionsPage setNotification={setNotification} handleAuthError={handleAuthError} handleItemClick={commonProps.handleItemClick} />;
            case 'detail':
                if (selectedItem) {
                    return <DetailPage 
                        item={selectedItem} 
                        setCurrentPage={handleSetCurrentPage} 
                        onReviewSubmitted={() => handleDataRefresh(selectedItem.id)} 
                        {...commonProps} 
                        setNotification={setNotification} 
                        handleAuthError={handleAuthError} 
                    />;
                }
                handleSetCurrentPage('home');
                return null;
            default:
                return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
        }
    };
    
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-gray-900 font-sans antialiased flex flex-col">
            <Notification notification={notification} setNotification={setNotification} />
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap'); body { font-family: 'Sarabun', sans-serif; } .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            <Header 
                setCurrentPage={handleSetCurrentPage} 
                currentUser={currentUser}
                handleLogout={handleLogout}
                theme={theme}
                toggleTheme={() => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))}
                notifications={notifications}
                unreadCount={unreadCount}
                handleMarkNotificationsAsRead={handleMarkNotificationsAsRead}
                onNotificationClick={handleNotificationClick}
            />
            <div className="flex flex-1">
                <Sidebar 
                    selectedCategory={selectedCategory} 
                    setSelectedCategory={setSelectedCategory} 
                    setCurrentPage={handleSetCurrentPage}
                    currentUser={currentUser}
                    handleLogout={handleLogout}
                />
                <main className="flex-grow md:ml-64 transition-all duration-300">
                    <div className={`p-4 sm:p-6 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="container mx-auto">
                            {renderPage()}
                        </div>
                    </div>
                </main>
            </div>
            <Footer />

            {isEditModalOpen && (
                <EditLocationModal 
                    item={itemToEdit}
                    onClose={() => setIsEditModalOpen(false)}
                    onItemUpdated={handleUpdateItem}
                    setNotification={setNotification}
                    handleAuthError={handleAuthError}
                />
            )}
        </div>
    );
};

export default App;

