import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, XCircle, Loader, AlertTriangle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';
import { createClient } from '@supabase/supabase-js';

// --- Components Imports ---
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Sidebar from './components/Sidebar.jsx';
import EditLocationModal from './components/EditLocationModal.jsx';
import HomePage from './components/HomePage.jsx';
import AttractionsPage from './components/AttractionsPage.jsx';
import FoodShopsPage from './components/FoodShopsPage.jsx';
import DetailPage from './components/DetailPage.jsx';
import AddLocationPage from './components/AddLocationPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import FavoritesPage from './components/FavoritesPage.jsx';
import UserProfilePage from './components/UserProfilePage.jsx';
import ManageProductsPage from './components/ManageProductsPage.jsx';
import ApproveDeletionsPage from './components/ApproveDeletionsPage.jsx';
import ApproveNewLocationsPage from './components/ApproveNewLocationsPage.jsx'; // ✅ เพิ่ม Import หน้าอนุมัติสถานที่

// --- Global API Configuration ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();

// --- 🔴 ตั้งค่า SUPABASE ---
// ⚠️ ตรวจสอบ KEY ของคุณให้ถูกต้อง
const supabaseUrl = 'https://fsbfiefjtyejfzgisjco.supabase.co'; 
const supabaseAnonKey = 'sb_publishable_JD-RR-99MGcWZ768Gewbeg_8NclU-Tx';

// สร้าง Supabase Client
let supabase = null;
try {
    if (supabaseUrl && supabaseUrl.startsWith('http') && supabaseAnonKey && supabaseAnonKey.length > 20) {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.warn("⚠️ Supabase Config Missing: Please check supabaseUrl and supabaseAnonKey in App.jsx");
    }
} catch (err) {
    console.error("Supabase init error:", err);
}

// --- Notification Formatter Function ---
const formatNotification = (rawNotification) => {
    let parsedPayload = rawNotification.payload;
    if (typeof parsedPayload === 'string') {
        try {
            parsedPayload = JSON.parse(parsedPayload);
        } catch (e) {
            console.error('Failed to parse notification payload:', e);
            parsedPayload = {}; 
        }
    } else if (parsedPayload === null || typeof parsedPayload !== 'object') {
        parsedPayload = {}; 
    }

    const { type, created_at, id, actor_name, is_read, actor_profile_image_url } = rawNotification;
    const payload = parsedPayload;

    let message = 'มีการแจ้งเตือนใหม่';
    const defaultImage = 'https://placehold.co/40x40/3b82f6/ffffff?text=User';
    let image = actor_profile_image_url;
    let link = null;
    let targetId = null;

    const actor = `**${actor_name || 'มีคน'}**`;
    const locationName = payload.location?.name || payload.locationName;
    const locationImageUrl = payload.location?.imageUrl || payload.locationImageUrl;
    const locationId = payload.location?.id || payload.locationId;
    const productName = payload.product?.name || payload.productName;
    const productImageUrl = payload.product?.imageUrl || payload.productImageUrl;
    
    const commentId = payload.comment?.id || payload.commentId || payload.review?.id || payload.reviewId || payload.id;

    switch (type) {
        case 'new_review':
            message = `${actor} ได้รีวิว: **"${locationName || 'โพสต์ของคุณ'}"**`;
            link = locationId;
            targetId = commentId;
            break;
        case 'new_like':
            message = `${actor} ถูกใจรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            targetId = commentId;
            break;
        case 'new_reply':
            message = `${actor} ตอบกลับรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            targetId = commentId;
            break;
        case 'new_comment_like':
            message = `${actor} ถูกใจความคิดเห็นของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            targetId = commentId;
            break;
        case 'new_location':
            message = `มีการเพิ่มสถานที่ใหม่โดย ${actor}: **"${locationName || 'ไม่มีชื่อ'}"**`;
            image = locationImageUrl || image; 
            link = locationId;
            break;
        case 'new_product':
            message = locationName
                ? `${actor} เพิ่มของขึ้นชื่อใหม่ใน **"${locationName}"**: **"${productName || 'ไม่มีชื่อ'}"**`
                : `${actor} เพิ่มของขึ้นชื่อใหม่: **"${productName || 'ไม่มีชื่อ'}"**`;
            image = productImageUrl || locationImageUrl || image;
            link = locationId; 
            break;
        case 'mention':
        case 'new_mention':
            message = `${actor} ได้กล่าวถึงคุณใน: **"${locationName || 'ความคิดเห็น'}"**`;
            link = locationId;
            targetId = commentId;
            break;
        default:
            break;
    }

    const timeString = created_at ? formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: th }) : 'เมื่อสักครู่';

    return {
        id: id || crypto.randomUUID(),
        message,
        userImage: image && typeof image === 'string' && image.startsWith('http') ? image : defaultImage, 
        time: timeString, 
        is_read: is_read || false,
        link, 
        targetId, 
        payload: typeof payload === 'object' && payload !== null ? payload : {},
        original_created_at: created_at || new Date().toISOString(),
    };
};

// --- Notification Component ---
const Notification = ({ notification, setNotification }) => {
    useEffect(() => {
        if (notification.message) {
            const timer = setTimeout(() => {
                setNotification({ message: '', type: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification, setNotification]);

    if (!notification.message) return null;

    const baseStyle =
        'fixed top-5 right-5 z-[200] flex items-center p-4 rounded-lg shadow-xl text-white transition-all duration-300 transform'; 
    const typeStyle =
        notification.type === 'success'
            ? 'bg-gradient-to-r from-green-500 to-teal-500'
            : notification.type === 'error'
            ? 'bg-gradient-to-r from-red-500 to-orange-500'
            : 'bg-gradient-to-r from-blue-500 to-indigo-500'; 

    return (
        <div className={`${baseStyle} ${typeStyle} animate-fade-in-up`}>
            {notification.type === 'success' ? <CheckCircle className="mr-3" /> : notification.type === 'error' ? <XCircle className="mr-3" /> : null}
            <span>{notification.message}</span>
            <button
                onClick={() => setNotification({ message: '', type: '' })}
                className="ml-4 opacity-80 hover:opacity-100"
                aria-label="Close notification" 
            >
                <X size={18}/> 
            </button>
        </div>
    );
};

// --- Confirmation Modal ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="flex items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-gray-100">{title || 'ยืนยัน'}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{message || 'คุณแน่ใจหรือไม่?'}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button onClick={onConfirm} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors">ยืนยัน</button>
                    <button onClick={onClose} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm transition-colors">ยกเลิก</button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
const App = () => {
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [targetCommentId, setTargetCommentId] = useState(null);
    const [savedAccounts, setSavedAccounts] = useState([]);
    const [itemToDelete, setItemToDelete] = useState(null); 

    const handleSetCurrentPage = useCallback((page, force = false) => {
        if (currentPage === page && !force) return; 
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentPage(page);
            setIsTransitioning(false);
            window.scrollTo(0, 0); 
        }, 200); 
        setIsSidebarOpen(false); 
    }, [currentPage]); 

    // --- Auth Error Handler ---
    const handleAuthError = useCallback(async () => {
        console.error("Authentication error or session expired. Logging out."); 
        setNotification({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', type: 'error' });
        
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setToken(null);
        setFavorites([]); 
        setNotifications([]); 
        setUnreadCount(0); 
        
        if (supabase) {
            await supabase.auth.signOut();
        }

        setCurrentPage('login'); 
    }, [setNotification]); 

    const handleLogin = useCallback((userData, userToken) => {
        if (!userData || !userToken) {
            setNotification({ message: 'ข้อมูลการเข้าสู่ระบบไม่สมบูรณ์', type: 'error'});
            return; 
        }

        try {
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('token', userToken);

            setSavedAccounts(prev => {
                const otherAccounts = prev.filter(acc => acc.user.id !== userData.id);
                const newAccounts = [...otherAccounts, { user: userData, token: userToken }];
                localStorage.setItem('saved_accounts', JSON.stringify(newAccounts));
                return newAccounts;
            });

        } catch (error) {
            console.error("Error saving to localStorage:", error);
            return;
        }

        setCurrentUser(userData);
        setToken(userToken);
        setNotification({ message: `ยินดีต้อนรับ, ${userData.displayName || userData.username}!`, type: 'success' });
        
        // 🚀 สั่งให้แอปเปลี่ยนไปหน้า Home ทันทีหลัง Login สำเร็จ
        handleSetCurrentPage('home', true);
    }, [setNotification, handleSetCurrentPage]); 

    // --- 🟢 Fix: ไม่สั่ง Logout เมื่อเกิด Error 403 จาก Favorites ---
    const fetchFavorites = useCallback(async (userToken) => {
        if (!userToken) { setFavorites([]); return; } 
        try {
            const response = await fetch(`${API_BASE_URL}/api/favorites`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            
            // ถ้า Backend ตอบกลับ 403 หรือ 401 เราแค่ Log Error แต่ "ไม่ Logout"
            // เพื่อป้องกัน Infinite Loop ที่เกิดจาก Backend ไม่รับ Token แต่ Supabase รับ
            if (response.status === 401 || response.status === 403) {
                console.warn("Backend rejected token (403/401). Favorites will be empty, but staying logged in.");
                return; 
            }

            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const data = await response.json(); 
            setFavorites(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching favorites:', error.message);
        }
    }, []); // เอา handleAuthError ออกจาก dependency

    const fetchLocations = useCallback(async (silent = false) => {
        if (!silent) setLoadingData(true);
        try {
            const [attractionsResponse, foodShopsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/attractions`),
                fetch(`${API_BASE_URL}/api/foodShops`),
            ]);
            const attractionsData = await attractionsResponse.json();
            const foodShopsData = await foodShopsResponse.json();
            setAttractions(Array.isArray(attractionsData) ? attractionsData : []); 
            setFoodShops(Array.isArray(foodShopsData) ? foodShopsData : []); 
        } catch (error) {
            console.error('Error fetching data:', error);
            setAttractions([]); setFoodShops([]); 
        } finally {
            if (!silent) setLoadingData(false);
        }
    }, []); 

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    // --- Effect for Social Login ---
    useEffect(() => {
        if (!supabase) return;

        const handleSupabaseSession = (session) => {
            if (!session?.user) return;
            
            const user = session.user;
            const currentStoredUser = localStorage.getItem('user');
            if (currentStoredUser) {
                const parsedUser = JSON.parse(currentStoredUser);
                if (parsedUser.id === user.id) return; 
            }

            const mappedUser = {
                id: user.id,
                email: user.email,
                username: user.user_metadata?.full_name || user.email.split('@')[0],
                displayName: user.user_metadata?.full_name || user.email.split('@')[0],
                profileImage: user.user_metadata?.avatar_url || user.user_metadata?.picture,
                role: 'user', 
                provider: 'social'
            };

            handleLogin(mappedUser, session.access_token);
            fetchFavorites(session.access_token);
            
            if (window.location.pathname === '/login' || currentPage === 'login') {
                handleSetCurrentPage('home');
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                if (!localStorage.getItem('token')) {
                    handleSupabaseSession(session);
                }
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                handleSupabaseSession(session);
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setCurrentUser(null);
                setToken(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [handleLogin, fetchFavorites, handleSetCurrentPage, currentPage]);

    // --- Init App ---
    useEffect(() => {
        const initializeApp = async () => {
            setLoadingData(true); 
            await fetchLocations();
            
            const storedAccounts = localStorage.getItem('saved_accounts');
            if (storedAccounts) {
                try { setSavedAccounts(JSON.parse(storedAccounts)); } catch (e) {}
            }

            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setCurrentUser(parsedUser);
                    setToken(storedToken);
                    fetchFavorites(storedToken); 
                } catch (e) {
                    console.error("Init user error");
                }
            }
            setLoadingData(false); 
        };
        initializeApp();
    }, [fetchLocations, fetchFavorites]); 

    // --- SSE Logic ---
    useEffect(() => {
        if (!token) {
            setNotifications([]); 
            return; 
        }

        let eventSource;
        let reconnectTimeout;

        const connectSSE = () => {
            const currentToken = localStorage.getItem('token');
            if (!currentToken) return;

            if (eventSource) { eventSource.close(); }
            if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }

            const sseUrl = `${API_BASE_URL}/api/events?token=${encodeURIComponent(currentToken)}`;
            eventSource = new EventSource(sseUrl);

            eventSource.onopen = () => console.log('✅ SSE Connection established.');

            eventSource.onmessage = (event) => {
                try {
                    const eventData = JSON.parse(event.data);

                    if (eventData.type === 'historic_notifications' && Array.isArray(eventData.data)) {
                        const formattedData = eventData.data.map(formatNotification).sort((a, b) => new Date(b.original_created_at) - new Date(a.original_created_at));
                        setNotifications(formattedData.slice(0, 50)); 
                    } else if (eventData.type === 'notification' && eventData.data) {
                        const newNotification = formatNotification(eventData.data);
                        setNotifications((prev) => [newNotification, ...prev].slice(0, 50));

                        if (eventData.data.type === 'new_location' && eventData.data.payload?.location) {
                            const newLocation = eventData.data.payload.location; 
                            if (newLocation && newLocation.id) {
                                const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category);
                                const setter = isFoodShop ? setFoodShops : setAttractions;
                                setter((prev) => {
                                    const exists = prev.some(item => item.id === newLocation.id);
                                    return exists ? prev.map(item => item.id === newLocation.id ? newLocation : item) : [newLocation, ...prev]; 
                                });
                            }
                        }
                    }
                } catch (e) { console.error("SSE Error:", e); }
            };

            eventSource.onerror = (err) => {
                eventSource.close(); 
                if (!reconnectTimeout && localStorage.getItem('token')) {
                      reconnectTimeout = setTimeout(() => { reconnectTimeout = null; connectSSE(); }, 5000); 
                }
            };
        }
        connectSSE(); 
        return () => {
            if (eventSource) { eventSource.close(); }
            if (reconnectTimeout) { clearTimeout(reconnectTimeout); }
        };
    }, [token]);

    useEffect(() => {
        setUnreadCount(notifications.filter((n) => !n.is_read).length);
    }, [notifications]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const handleMarkNotificationsAsRead = useCallback(async () => {
        if (unreadCount === 0 || !token) return;
        const currentlyUnreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        setNotifications((prev) => prev.map((n) => currentlyUnreadIds.includes(n.id) ? { ...n, is_read: true } : n));
        setUnreadCount(0); 
        try {
            await fetch(`${API_BASE_URL}/api/notifications/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (error) {
           console.error("Failed to mark read");
        }
    }, [unreadCount, token, notifications]); 

    const handleDeleteNotification = useCallback(async (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notificationId) {
             try {
                const token = localStorage.getItem('token');
                if (token) {
                    await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            } catch (error) { console.error(error); }
        }
    }, []);

    const handleClearAllNotifications = useCallback(async () => {
        if (notifications.length === 0) return;
        if (!window.confirm('คุณต้องการลบการแจ้งเตือนทั้งหมดใช่หรือไม่?')) return;
        setNotifications([]);
        setUnreadCount(0);
        try {
            const token = localStorage.getItem('token');
            if (token) {
                await fetch(`${API_BASE_URL}/api/notifications`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                setNotification({ message: 'ล้างการแจ้งเตือนทั้งหมดแล้ว', type: 'success' });
            }
        } catch (error) {
            setNotification({ message: 'เกิดข้อผิดพลาดในการล้างแจ้งเตือน', type: 'error' });
        }
    }, [notifications]);

    const handleNotificationClick = useCallback(async (notificationPayload) => {
        const locationId = notificationPayload.link;
        if (!locationId) return;

        if (notificationPayload.targetId) {
            setTargetCommentId(notificationPayload.targetId);
        }

        const allItems = [...attractions, ...foodShops];
        let location = allItems.find((item) => item.id === locationId);

        if (!location) { 
            await fetchLocations(true); 
            try {
                const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`);
                if (response.ok) {
                    location = await response.json();
                }
            } catch(error) { return; } 
        }

        if (location?.id) { 
            setSelectedItem(location);
            handleSetCurrentPage('detail', true); 
        }
        setIsSidebarOpen(false); 
    }, [attractions, foodShops, handleSetCurrentPage, fetchLocations]); 

    const handleToggleFavorite = useCallback(async (locationId) => {
        if (!currentUser) {
            setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' });
            return handleSetCurrentPage('login');
        }
        const isCurrentlyFavorite = favorites.includes(locationId);
        setFavorites((prev) => (isCurrentlyFavorite ? prev.filter((id) => id !== locationId) : [...prev, locationId]));
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ locationId }),
            });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error('Failed');
            
            setNotification({ 
                message: isCurrentlyFavorite ? 'ลบออกจากรายการโปรดแล้ว' : 'เพิ่มลงในรายการโปรดแล้ว', 
                type: 'success' 
            });

        } catch (error) {
            setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' });
            setFavorites((prev) => (isCurrentlyFavorite ? [...prev, locationId] : prev.filter((id) => id !== locationId)));
        }
    }, [currentUser, favorites, token, handleAuthError, handleSetCurrentPage]); 

    const handleLogout = () => {
        if (supabase) { supabase.auth.signOut(); }
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setToken(null);
        setFavorites([]);
        setNotifications([]);
        setUnreadCount(0);
        setNotification({ message: 'ออกจากระบบสำเร็จ', type: 'success' });
        handleSetCurrentPage('home');
    };

    const handleAddAccount = useCallback(() => {
        setCurrentUser(null); setToken(null);
        localStorage.removeItem('user'); localStorage.removeItem('token');
        handleSetCurrentPage('login');
    }, [handleSetCurrentPage]);

    const handleSelectAccount = useCallback((account) => {
            setCurrentUser(account.user);
            setToken(account.token);
            localStorage.setItem('user', JSON.stringify(account.user));
            localStorage.setItem('token', account.token);
            handleSetCurrentPage('home');
            fetchFavorites(account.token); 
    }, [handleSetCurrentPage, fetchFavorites]);

    const handleRemoveAccount = useCallback((accountToRemove) => {
        setSavedAccounts(prev => {
            const newAccounts = prev.filter(acc => acc.user.id !== accountToRemove.user.id);
            localStorage.setItem('saved_accounts', JSON.stringify(newAccounts));
            return newAccounts;
        });
        setNotification({ message: 'ลบบัญชีออกจากรายการแล้ว', type: 'success' });
    }, []);

    const handleProfileUpdate = (updatedUser, newToken) => {
        setCurrentUser(updatedUser);
        if (newToken) { setToken(newToken); localStorage.setItem('token', newToken); }
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setNotification({ message: 'ข้อมูลโปรไฟล์อัปเดตแล้ว!', type: 'success' });
    };

    const handleDataRefresh = useCallback(async (updatedItemId) => {
        await fetchLocations(true); 
        if (updatedItemId && selectedItem && String(selectedItem.id) === String(updatedItemId) && currentPage === 'detail') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/locations/${updatedItemId}`);
                if (response.ok) { setSelectedItem(await response.json()); }
            } catch (error) {}
        }
    }, [fetchLocations, selectedItem, currentPage]); 

    // ✅ ฟังก์ชันใหม่: สำหรับอัปเดตสถานะของ Item ในรายการหลักทันที (Merged)
    const handleItemStatusUpdate = useCallback((itemId, newStatus) => {
        setAttractions(prev => prev.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
        setFoodShops(prev => prev.map(item => item.id === itemId ? { ...item, status: newStatus } : item));
        
        // อัปเดต selectedItem ด้วยถ้ากำลังเปิดอยู่
        if (selectedItem && selectedItem.id === itemId) {
            setSelectedItem(prev => ({ ...prev, status: newStatus }));
        }
    }, [selectedItem]);

    const handleUpdateItem = (updatedItem) => {
        const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(updatedItem.category);
        let itemFoundInAttractions = false;
        let itemFoundInFoodShops = false;

        setAttractions((prev) => {
            const newState = prev.map((item) => {
                    if (item.id === updatedItem.id) { itemFoundInAttractions = true; return isFoodShop ? null : updatedItem; }
                    return item;
                }).filter(Boolean); 
            if (!isFoodShop && !itemFoundInAttractions) { return [updatedItem, ...newState]; }
            return newState;
        });

        setFoodShops((prev) => {
            const newState = prev.map((item) => {
                    if (item.id === updatedItem.id) { itemFoundInFoodShops = true; return !isFoodShop ? null : updatedItem; }
                    return item;
                }).filter(Boolean); 
            if (isFoodShop && !itemFoundInFoodShops) { return [updatedItem, ...newState]; }
            return newState;
        });

        if (selectedItem?.id === updatedItem.id) { setSelectedItem(updatedItem); }
        setIsEditModalOpen(false); setItemToEdit(null);
    };

    const executeDelete = async () => {
        if (!itemToDelete) return; 
        const locationId = itemToDelete;
        setItemToDelete(null);
        const token = localStorage.getItem('token');
        if (!token) { return handleAuthError(); }

        setLoadingData(true); 
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) { return handleAuthError(); }
            if (response.ok || response.status === 204) { 
                setNotification({ message: 'ลบสถานที่สำเร็จ', type: 'success' });
                setAttractions(prev => prev.filter(item => item.id !== locationId));
                setFoodShops(prev => prev.filter(item => item.id !== locationId));
                if (selectedItem?.id === locationId) { setSelectedItem(null); handleSetCurrentPage('home'); }
            } else { throw new Error('Failed to delete'); }
        } catch (error) {
            setNotification({ message: 'ไม่สามารถลบข้อมูลได้', type: 'error' });
        } finally { setLoadingData(false); }
    };

    const filteredAttractions = useMemo(() => {
        if (!Array.isArray(attractions)) return [];
        // ✅ กรองเฉพาะที่อนุมัติแล้ว (User) หรือทั้งหมด (Admin)
        let visibleItems = attractions;
        if (currentUser?.role !== 'admin') {
            visibleItems = attractions.filter(item => item.status === 'approved');
        }
        return selectedCategory === 'ทั้งหมด' ? visibleItems : visibleItems.filter(item => item.category === selectedCategory);
    }, [attractions, selectedCategory, currentUser]);

    const filteredFoodShops = useMemo(() => {
        if (!Array.isArray(foodShops)) return [];
        // ✅ กรองเฉพาะที่อนุมัติแล้ว (User) หรือทั้งหมด (Admin)
        let visibleItems = foodShops;
        if (currentUser?.role !== 'admin') {
            visibleItems = foodShops.filter(item => item.status === 'approved');
        }
        return selectedCategory === 'ทั้งหมด' ? visibleItems : visibleItems.filter(item => item.category === selectedCategory);
    }, [foodShops, selectedCategory, currentUser]);

    const favoriteItems = useMemo(() => {
        const allItems = [...attractions, ...foodShops];
        if (!Array.isArray(favorites)) return [];
        return allItems.filter(item => item && item.id && favorites.includes(item.id));
    }, [attractions, foodShops, favorites]);

    const renderPage = () => {
        if (loadingData || isTransitioning) {
            return (
                <div className="flex flex-col justify-center items-center h-96 text-gray-500 dark:text-gray-400">
                    <Loader className="animate-spin h-12 w-12" />
                    <p className="mt-4 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            );
        }

        const commonProps = {
            handleItemClick: (item) => { setSelectedItem(item); handleSetCurrentPage('detail'); },
            currentUser, favorites, handleToggleFavorite,
            handleEditItem: (item) => { setItemToEdit(item); setIsEditModalOpen(true); }, 
            handleDeleteItem: (locationId) => { setItemToDelete(locationId); },
            // ✅ ส่งฟังก์ชันนี้เข้าไปด้วย (Merged)
            onItemStatusUpdate: handleItemStatusUpdate 
        };

        switch (currentPage) {
            case 'attractions': return <AttractionsPage attractions={filteredAttractions} {...commonProps} selectedCategory={selectedCategory} />;
            case 'foodshops':   return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} selectedCategory={selectedCategory} />;
            case 'add-location': return <AddLocationPage setCurrentPage={handleSetCurrentPage} onLocationAdded={handleDataRefresh} setNotification={setNotification} handleAuthError={handleAuthError} />;
            case 'login':        return <LoginPage onAuthSuccess={handleLogin} setNotification={setNotification} API_BASE_URL={API_BASE_URL} />;
            case 'favorites':    return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
            case 'profile':      return <UserProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} handleAuthError={handleAuthError} handleLogout={handleLogout} setNotification={setNotification} />;
            case 'manage-products': return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} />;
            case 'deletion-requests': return <ApproveDeletionsPage setNotification={setNotification} handleAuthError={handleAuthError} handleItemClick={commonProps.handleItemClick} />;
            // ✅ Route ใหม่สำหรับหน้าอนุมัติ
            case 'approve-new-locations': 
                return (
                    <ApproveNewLocationsPage 
                        setNotification={setNotification} 
                        handleAuthError={handleAuthError} 
                        // ส่ง handleDataRefresh ให้ทำงานหลังจากอนุมัติ เพื่อดึงข้อมูลใหม่มาแสดงทันที
                        onItemStatusUpdate={async (id, status) => {
                            handleItemStatusUpdate(id, status);
                            await handleDataRefresh(); 
                        }} 
                    />
                );
            case 'detail':
                if (selectedItem) {
                    return <DetailPage
                                item={selectedItem}
                                setCurrentPage={handleSetCurrentPage}
                                onReviewSubmitted={() => handleDataRefresh(selectedItem.id)}
                                {...commonProps} // commonProps มี onItemStatusUpdate อยู่แล้ว
                                setNotification={setNotification}
                                handleAuthError={handleAuthError}
                                targetCommentId={targetCommentId}
                                clearTargetCommentId={() => setTargetCommentId(null)}
                            />;
                }
                setTimeout(() => handleSetCurrentPage('home'), 0);
                return null; 
            default: 
                return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-gray-900 font-sans antialiased flex flex-col">
            <Notification notification={notification} setNotification={setNotification} />
             <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');
                body { font-family: 'Sarabun', sans-serif; }
                .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            
            <Header
                setCurrentPage={handleSetCurrentPage}
                currentUser={currentUser}
                handleLogout={handleLogout}
                theme={theme}
                toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                notifications={notifications}
                unreadCount={unreadCount}
                handleMarkNotificationsAsRead={handleMarkNotificationsAsRead}
                onNotificationClick={handleNotificationClick}
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                handleAddAccount={handleAddAccount}
                savedAccounts={savedAccounts}
                handleSelectAccount={handleSelectAccount}
                handleRemoveAccount={handleRemoveAccount}
                handleDeleteNotification={handleDeleteNotification} 
                handleClearAllNotifications={handleClearAllNotifications} 
            />

            <div className="flex flex-1 p-4 gap-4"> 
                <aside className="sticky top-4 h-fit max-h-[calc(100vh-6rem)] self-start overflow-y-auto hidden md:block z-50 no-scrollbar rounded-3xl overflow-hidden shadow-xl">
                    <Sidebar
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        setCurrentPage={handleSetCurrentPage}
                        currentUser={currentUser}
                        handleLogout={handleLogout}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                    />
                </aside>

                <main className={`flex-1 w-0 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'filter brightness-50 md:filter-none' : ''}`}> 
                    {loadingData || isTransitioning ? renderPage() : (
                        <div className={`flex-1 container mx-auto transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                            {renderPage()}
                        </div>
                    )}
                    {!loadingData && !isTransitioning && <Footer />} 
                </main>
            </div>

            <ConfirmationModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={executeDelete} 
                title="ยืนยันการลบ"
                message="คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่นี้? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบรีวิว, ของขึ้นชื่อ, และรายการโปรดทั้งหมดที่เกี่ยวข้องกับสถานที่นี้ด้วย"
            />
            {isEditModalOpen && itemToEdit && ( 
                <EditLocationModal
                    item={itemToEdit}
                    onClose={() => { setIsEditModalOpen(false); setItemToEdit(null); }} 
                    onItemUpdated={handleUpdateItem} 
                    setNotification={setNotification}
                    handleAuthError={handleAuthError}
                />
            )}
        </div>
    );
};

export default App;