import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, XCircle, Loader, AlertTriangle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

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

// --- Global API Configuration ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();

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
    let image = actor_profile_image_url || 'https://placehold.co/40x40/7e22ce/white?text=🔔';
    let link = null;

    const actor = `**${actor_name || 'มีคน'}**`;
    const locationName = payload.location?.name || payload.locationName;
    const locationImageUrl = payload.location?.imageUrl || payload.locationImageUrl;
    const locationId = payload.location?.id || payload.locationId;
    const productName = payload.product?.name || payload.productName;
    const productImageUrl = payload.product?.imageUrl || payload.productImageUrl;

    switch (type) {
        case 'new_review':
            message = `${actor} ได้รีวิว: **"${locationName || 'โพสต์ของคุณ'}"**`;
            link = locationId;
            break;
        case 'new_like':
            message = `${actor} ถูกใจรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            break;
        case 'new_reply':
            message = `${actor} ตอบกลับรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            break;
        case 'new_comment_like':
            message = `${actor} ถูกใจความคิดเห็นของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
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
        default:
            console.warn("Unknown notification type:", type);
            break;
    }

    const timeString = created_at ? formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: th }) : 'เมื่อสักครู่';

    return {
        id: id || crypto.randomUUID(),
        message,
        userImage: image && typeof image === 'string' && image.startsWith('http')
                  ? image
                  : 'https://placehold.co/40x40/7e22ce/white?text=🔔', 
        time: timeString, 
        is_read: is_read || false,
        link, 
        payload: typeof payload === 'object' && payload !== null ? payload : {},
        original_created_at: created_at || new Date().toISOString(),
    };
};

// --- General Purpose Notification Component ---
const Notification = ({ notification, setNotification }) => {
    if (!notification.message) return null;

    useEffect(() => {
        const timer = setTimeout(() => {
            setNotification({ message: '', type: '' });
        }, 3000);
        return () => clearTimeout(timer);
    }, [notification, setNotification]);

    const baseStyle =
        'fixed top-5 right-5 z-[100] flex items-center p-4 rounded-lg shadow-xl text-white transition-all duration-300 transform';
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

// --- Reusable Confirmation Modal ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose} 
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all"
                onClick={e => e.stopPropagation()} 
            >
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
                    <button
                        onClick={onConfirm}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                    >
                        ยืนยัน
                    </button>
                    <button
                        onClick={onClose}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm transition-colors"
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // --- Multi-Account Support ---
    const [savedAccounts, setSavedAccounts] = useState([]);

    // --- State for Deletion Confirmation Modal ---
    const [itemToDelete, setItemToDelete] = useState(null); 

    // --- Handlers & Callbacks ---
    const handleAuthError = useCallback(() => {
        console.error("Authentication error or session expired. Logging out."); 
        setNotification({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', type: 'error' });
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setToken(null);
        setFavorites([]); 
        setNotifications([]); 
        setUnreadCount(0); 
        setCurrentPage('login'); 
    }, [setNotification]); 

    const fetchLocations = useCallback(async () => {
        setLoadingData(true);
        console.log('Fetching locations from:', API_BASE_URL);
        try {
            const [attractionsResponse, foodShopsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/attractions`),
                fetch(`${API_BASE_URL}/api/foodShops`),
            ]);

            if (!attractionsResponse.ok) {
                throw new Error(`Failed to fetch attractions (${attractionsResponse.status})`);
            }
            if (!foodShopsResponse.ok) {
                throw new Error(`Failed to fetch food shops (${foodShopsResponse.status})`);
            }

            const attractionsData = await attractionsResponse.json();
            const foodShopsData = await foodShopsResponse.json();
            setAttractions(Array.isArray(attractionsData) ? attractionsData : []); 
            setFoodShops(Array.isArray(foodShopsData) ? foodShopsData : []); 

        } catch (error) {
            console.error('Error fetching data from backend:', error);
            if (error instanceof SyntaxError && error.message.includes("Unexpected token '<'")) {
                setNotification({ message: `ไม่สามารถโหลดข้อมูลได้: Server ส่งข้อมูลที่ไม่ใช่ JSON กลับมา (อาจเกิดข้อผิดพลาดที่ Backend)`, type: 'error' });
            } else {
                setNotification({ message: `ไม่สามารถโหลดข้อมูลได้: ${error.message}`, type: 'error' });
            }
            setAttractions([]); 
            setFoodShops([]); 
        } finally {
            setLoadingData(false);
        }
    }, [setNotification]); 

    const fetchFavorites = useCallback(async (userToken) => {
        if (!userToken) { setFavorites([]); return; } 
        console.log('Fetching favorites with token:', userToken); 
        try {
            const response = await fetch(`${API_BASE_URL}/api/favorites`, {
                headers: { Authorization: `Bearer ${userToken}` },
            });
            console.log('Favorites response status:', response.status); 
            if (response.status === 401 || response.status === 403) {
                console.log('Auth error while fetching favorites, calling handleAuthError');
                return handleAuthError();
            }
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const data = await response.json();
            console.log('Fetched favorites:', data); 
            setFavorites(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching favorites:', error.message);
            setFavorites([]); 
        }
    }, [handleAuthError]); 

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    // --- Effects ---
    useEffect(() => {
        const initializeApp = async () => {
            console.log("Initializing App...");
            setLoadingData(true); 
            await fetchLocations();
            
            // --- Load saved accounts ---
            const storedAccounts = localStorage.getItem('saved_accounts');
            if (storedAccounts) {
                try {
                    setSavedAccounts(JSON.parse(storedAccounts));
                } catch (e) {
                    console.error("Failed to parse saved accounts", e);
                }
            }

            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (storedToken && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setCurrentUser(parsedUser);
                    setToken(storedToken);
                    await fetchFavorites(storedToken);
                } catch (e) {
                    console.error('Failed to parse user from localStorage', e);
                    handleAuthError();
                }
            } else {
                console.log("No stored token or user found.");
            }
            setLoadingData(false); 
            console.log("App initialization complete.");
        };
        initializeApp();
    }, [fetchLocations, fetchFavorites, handleAuthError]); 

    useEffect(() => {
        if (!token) {
            console.log("SSE: No token, skipping connection.");
            setNotifications([]); 
            return; 
        }

        let eventSource;
        let reconnectTimeout;

        const connectSSE = () => {
            if (eventSource) {
                console.log("SSE: Closing existing connection before reconnecting.");
                eventSource.close();
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null; 
            }

            console.log(`SSE: Attempting to connect to ${API_BASE_URL}/api/events...`);
            const sseUrl = `${API_BASE_URL}/api/events?token=${encodeURIComponent(token)}`;
            console.log("SSE URL:", sseUrl); 
            eventSource = new EventSource(sseUrl);

            eventSource.onopen = () => console.log('✅ SSE Connection established.');

            eventSource.onmessage = (event) => {
                try {
                    const eventData = JSON.parse(event.data);
                    console.log("SSE Message Received:", eventData.type); 

                    if (eventData.type === 'historic_notifications' && Array.isArray(eventData.data)) {
                        const formattedData = eventData.data
                            .map(formatNotification)
                            .sort((a, b) => new Date(b.original_created_at) - new Date(a.original_created_at));
                        setNotifications(formattedData.slice(0, 50)); 
                        console.log(`SSE: Loaded ${formattedData.length} historic notifications.`);
                    } else if (eventData.type === 'notification' && eventData.data) {
                        const newNotification = formatNotification(eventData.data);
                        console.log("SSE: Received new notification:", newNotification);
                        setNotifications((prev) =>
                            [newNotification, ...prev]
                            .sort((a, b) => new Date(b.original_created_at) - new Date(a.original_created_at))
                            .slice(0, 50) 
                        );

                        if (eventData.data.type === 'new_location' && eventData.data.payload?.location) {
                            const newLocation = eventData.data.payload.location; 
                            if (newLocation && newLocation.id) {
                                const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category);
                                const setter = isFoodShop ? setFoodShops : setAttractions;
                                setter((prev) => {
                                    const exists = prev.some(item => item.id === newLocation.id);
                                    return exists
                                        ? prev.map(item => item.id === newLocation.id ? newLocation : item)
                                        : [newLocation, ...prev]; 
                                });
                                 console.log(`SSE: Real-time update: Added/Updated location ${newLocation.id}`);
                            }
                        }

                    } else if (eventData.type === 'connected') {
                        console.log(`SSE Client ID: ${eventData.clientId}`);
                    }
                } catch (e) { console.error("SSE: Error processing message:", e, event.data); }
            };

            eventSource.onerror = (err) => {
                console.error('❌ SSE EventSource failed:', err);
                eventSource.close(); 
                if (!reconnectTimeout) {
                     console.log('SSE: Attempting reconnect in 5 seconds...');
                     reconnectTimeout = setTimeout(() => {
                        reconnectTimeout = null; 
                        connectSSE();
                     }, 5000); 
                }
            };
        };

        connectSSE(); 

        return () => {
            console.log('SSE: Closing Connection.');
            if (eventSource) {
                eventSource.close();
                eventSource = null; 
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
        };
    }, [token, handleAuthError]); 

    useEffect(() => {
        setUnreadCount(notifications.filter((n) => !n.is_read).length);
    }, [notifications]);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    // --- More Handlers ---
    const handleSetCurrentPage = useCallback((page) => {
        console.log(`Navigating to page: ${page}`); 
        if (currentPage === page) {
            console.log("Already on this page, skipping transition.");
            return; 
        }
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentPage(page);
            setIsTransitioning(false);
            window.scrollTo(0, 0); 
            console.log(`Navigation complete to: ${page}`);
        }, 200); 
        setIsSidebarOpen(false); 
    }, [currentPage]); 

    const handleMarkNotificationsAsRead = useCallback(async () => {
        if (unreadCount === 0 || !token) return;
        console.log("Marking notifications as read...");
        const currentlyUnreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        setNotifications((prev) => prev.map((n) => currentlyUnreadIds.includes(n.id) ? { ...n, is_read: true } : n));
        setUnreadCount(0); 

        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                console.error('Failed to mark notifications as read on server:', response.status);
                 setNotification({message: "ไม่สามารถอัปเดตสถานะแจ้งเตือนบนเซิร์ฟเวอร์", type: "error"});
                 setUnreadCount(currentlyUnreadIds.length); 
                 setNotifications((prev) => prev.map((n) => currentlyUnreadIds.includes(n.id) ? { ...n, is_read: false } : n)); 
            } else {
                console.log("Notifications marked as read on server.");
            }
        } catch (error) {
           console.error('Error marking notifications as read:', error);
           setNotification({message: "เกิดข้อผิดพลาดในการเชื่อมต่อเพื่ออัปเดตแจ้งเตือน", type: "error"});
           setUnreadCount(currentlyUnreadIds.length); 
           setNotifications((prev) => prev.map((n) => currentlyUnreadIds.includes(n.id) ? { ...n, is_read: false } : n)); 
        }
    }, [unreadCount, token, notifications, setNotification]); 

    const handleNotificationClick = useCallback(async (notificationPayload) => {
        console.log("Notification clicked:", notificationPayload);
        const locationId = notificationPayload.link;
        if (!locationId) { console.warn('Notification has no link.', notificationPayload); return; }

        const allItems = [...attractions, ...foodShops];
        let location = allItems.find((item) => item.id === locationId);

        if (!location) { 
            console.warn(`Location ${locationId} not in state, fetching...`);
            setLoadingData(true); 
            try {
                const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`);
                if (!response.ok) throw new Error(`Failed to fetch ${locationId} (${response.status})`);
                location = await response.json();
                console.log("Fetched location from notification:", location);
            } catch(error) {
                console.error("Error fetching location from notification:", error);
                setNotification({ message: 'ไม่สามารถโหลดข้อมูลสถานที่ได้', type: 'error' });
                return; 
            } finally {
                 setLoadingData(false); 
            }
        }

        if (location?.id) { 
            setSelectedItem(location);
            handleSetCurrentPage('detail');
        } else {
            console.error("Invalid location data received after fetch from notification.");
            setNotification({ message: 'ได้รับข้อมูลสถานที่ที่ไม่ถูกต้อง', type: 'error' });
        }

        setIsSidebarOpen(false); 
    }, [attractions, foodShops, handleSetCurrentPage, setNotification]); 

    const handleToggleFavorite = useCallback(async (locationId) => {
        if (!currentUser) {
            console.log("Toggle Favorite: User not logged in.");
            setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' });
            return handleSetCurrentPage('login');
        }
        console.log(`Toggling favorite for location: ${locationId}`);
        const isCurrentlyFavorite = favorites.includes(locationId);
        setFavorites((prev) => (isCurrentlyFavorite ? prev.filter((id) => id !== locationId) : [...prev, locationId]));
        console.log(`Optimistic UI: ${isCurrentlyFavorite ? 'Removed from' : 'Added to'} favorites.`);
        try {
            const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ locationId }),
            });
            console.log('Toggle favorite response status:', response.status);
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error('Failed to toggle favorite on server');
            const data = await response.json(); 
            console.log("Toggle favorite success:", data.status);
            
            // Notification on success
            setNotification({ 
                message: isCurrentlyFavorite ? 'ลบออกจากรายการโปรดแล้ว' : 'เพิ่มลงในรายการโปรดแล้ว', 
                type: 'success' 
            });

        } catch (error) {
            console.error('Error toggling favorite:', error);
            setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' });
            console.log("Reverting optimistic UI for favorites.");
            setFavorites((prev) => (isCurrentlyFavorite ? [...prev, locationId] : prev.filter((id) => id !== locationId)));
        }
    }, [currentUser, favorites, token, handleAuthError, handleSetCurrentPage, setNotification]); 

    const handleLogin = (userData, userToken) => {
        console.log("LOGIN SUCCESSFUL - User ID:", userData?.id);
        
        if (!userData || !userToken) {
            setNotification({ message: 'ข้อมูลการเข้าสู่ระบบไม่สมบูรณ์', type: 'error'});
            return; 
        }

        try {
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('token', userToken);

            // --- Save to multi-session list ---
            setSavedAccounts(prev => {
                // Filter out existing entry for this user to avoid duplicates
                const otherAccounts = prev.filter(acc => acc.user.id !== userData.id);
                const newAccounts = [...otherAccounts, { user: userData, token: userToken }];
                localStorage.setItem('saved_accounts', JSON.stringify(newAccounts));
                return newAccounts;
            });

        } catch (error) {
            console.error("Error saving to localStorage:", error);
            setNotification({ message: 'ไม่สามารถบันทึกข้อมูลการเข้าสู่ระบบในเบราว์เซอร์', type: 'error'});
            return;
        }

        setCurrentUser(userData);
        setToken(userToken);
        fetchFavorites(userToken); 
        handleSetCurrentPage('home');
        setNotification({ message: `ยินดีต้อนรับ, ${userData.displayName || userData.username}!`, type: 'success' });
    };


    const handleLogout = () => {
        console.log("Logging out user...");
        
        // --- Remove ONLY current user from saved list (Full Logout) ---
        if (currentUser) {
            const newSaved = savedAccounts.filter(acc => acc.user.id !== currentUser.id);
            setSavedAccounts(newSaved);
            localStorage.setItem('saved_accounts', JSON.stringify(newSaved));
        }

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

    // --- Add Account (Go to login but keep session) ---
    const handleAddAccount = useCallback(() => {
        // Clear active session in memory only, but DON'T remove from 'saved_accounts'
        setCurrentUser(null);
        setToken(null);
        localStorage.removeItem('user'); 
        localStorage.removeItem('token');
        handleSetCurrentPage('login');
    }, [handleSetCurrentPage]);

    // --- Switch to Saved Account ---
    const handleSelectAccount = useCallback((account) => {
         setCurrentUser(account.user);
         setToken(account.token);
         localStorage.setItem('user', JSON.stringify(account.user));
         localStorage.setItem('token', account.token);
         handleSetCurrentPage('home');
         fetchFavorites(account.token); 
    }, [handleSetCurrentPage, fetchFavorites]);

    // --- Remove Saved Account ---
    const handleRemoveAccount = useCallback((accountToRemove) => {
        setSavedAccounts(prev => {
            const newAccounts = prev.filter(acc => acc.user.id !== accountToRemove.user.id);
            localStorage.setItem('saved_accounts', JSON.stringify(newAccounts));
            return newAccounts;
        });
        setNotification({ message: 'ลบบัญชีออกจากรายการแล้ว', type: 'success' });
    }, []);

    const handleProfileUpdate = (updatedUser, newToken) => {
        console.log("Updating profile:", updatedUser);
        setCurrentUser(updatedUser);
        if (newToken) {
            setToken(newToken);
            localStorage.setItem('token', newToken);
        }
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Update in saved accounts too
        setSavedAccounts(prev => {
            const newAccounts = prev.map(acc => 
                acc.user.id === updatedUser.id 
                ? { ...acc, user: updatedUser, token: newToken || acc.token } 
                : acc
            );
            localStorage.setItem('saved_accounts', JSON.stringify(newAccounts));
            return newAccounts;
        });

        setNotification({ message: 'ข้อมูลโปรไฟล์อัปเดตแล้ว!', type: 'success' });
    };

    const handleDataRefresh = useCallback(async (updatedItemId) => {
        console.log(`Refreshing data... Item ID: ${updatedItemId}`);
        
        // 1. Fetch new lists to update main data (e.g. review counts)
        await fetchLocations();

        // 2. If we are currently viewing the updated item, refresh it in place
        //    This fixes the "bouncing out" issue by updating data instead of navigating away.
        if (updatedItemId && selectedItem?.id === updatedItemId && currentPage === 'detail') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/locations/${updatedItemId}`);
                if (response.ok) {
                    const freshItemData = await response.json();
                    setSelectedItem(freshItemData); // Update detail view with fresh data
                    console.log("Updated selected item in place.");
                }
            } catch (error) {
                console.error("Error refreshing selected item:", error);
            }
        }
    }, [fetchLocations, selectedItem, currentPage, API_BASE_URL]); 

    const handleUpdateItem = (updatedItem) => {
        console.log("Handling item update in App.jsx:", updatedItem);
        const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(updatedItem.category);
        console.log(`Item ${updatedItem.id} is now in category: ${updatedItem.category}. Is FoodShop? ${isFoodShop}`);

        let itemFoundInAttractions = false;
        let itemFoundInFoodShops = false;

        setAttractions((prev) => {
            const newState = prev
                .map((item) => {
                    if (item.id === updatedItem.id) {
                        itemFoundInAttractions = true;
                        return isFoodShop ? null : updatedItem; 
                    }
                    return item;
                })
                .filter(Boolean); 
            if (!isFoodShop && !itemFoundInAttractions) {
                console.log(`Adding ${updatedItem.id} to attractions list.`);
                return [updatedItem, ...newState];
            }
            return newState;
        });

        setFoodShops((prev) => {
            const newState = prev
                .map((item) => {
                    if (item.id === updatedItem.id) {
                        itemFoundInFoodShops = true;
                        return !isFoodShop ? null : updatedItem; 
                    }
                    return item;
                })
                .filter(Boolean); 
            if (isFoodShop && !itemFoundInFoodShops) {
                console.log(`Adding ${updatedItem.id} to foodShops list.`);
                return [updatedItem, ...newState];
            }
            return newState;
        });

        if (selectedItem?.id === updatedItem.id) {
            console.log(`Updating selected item view for ${updatedItem.id}`);
            setSelectedItem(updatedItem);
        }
        setIsEditModalOpen(false); 
        setItemToEdit(null);
    };


    const executeDelete = async () => {
        if (!itemToDelete) return; 
        const locationId = itemToDelete;
        console.log(`Executing delete for location ID: ${locationId}`);

        setItemToDelete(null);

        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Delete cancelled: No token found.");
            return handleAuthError(); 
        }

        setLoadingData(true); 
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('Delete response status:', response.status);

            if (response.status === 401 || response.status === 403) {
                console.log("Auth error during delete, calling handleAuthError.");
                return handleAuthError(); 
            }

            if (response.ok || response.status === 204) { 
                console.log(`Successfully deleted location ${locationId}`);
                setNotification({ message: 'ลบสถานที่สำเร็จ', type: 'success' });
                setAttractions(prev => prev.filter(item => item.id !== locationId));
                setFoodShops(prev => prev.filter(item => item.id !== locationId));
                if (selectedItem?.id === locationId) {
                    console.log(`Selected item ${locationId} was deleted, navigating home.`);
                    setSelectedItem(null);
                    handleSetCurrentPage('home');
                }
            } else {
                let errorData = { error: `เกิดข้อผิดพลาดในการลบ (${response.status})` };
                try {
                    errorData = await response.json(); 
                } catch (e) {
                    console.warn("Could not parse JSON error response during delete.");
                }
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            setNotification({ message: error.message || 'ไม่สามารถลบข้อมูลได้', type: 'error' });
        } finally {
            setLoadingData(false); 
        }
    };


    const filteredAttractions = useMemo(() => {
        if (!Array.isArray(attractions)) return [];
        return selectedCategory === 'ทั้งหมด' ? attractions : attractions.filter(item => item.category === selectedCategory);
    }, [attractions, selectedCategory]);

    const filteredFoodShops = useMemo(() => {
        if (!Array.isArray(foodShops)) return [];
        return selectedCategory === 'ทั้งหมด' ? foodShops : foodShops.filter(item => item.category === selectedCategory);
    }, [foodShops, selectedCategory]);

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
            currentUser, 
            favorites,
            handleToggleFavorite,
            handleEditItem: (item) => { console.log("Opening edit modal for:", item); setItemToEdit(item); setIsEditModalOpen(true); }, 
            handleDeleteItem: (locationId) => { console.log("Requesting delete confirmation for:", locationId); setItemToDelete(locationId); }, 
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
                console.warn("Detail page rendered without selectedItem, redirecting home.");
                useEffect(() => { handleSetCurrentPage('home'); }, [handleSetCurrentPage]);
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
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                /* Hide scrollbar for Chrome, Safari and Opera */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                /* Hide scrollbar for IE, Edge and Firefox */
                .no-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
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
                
                // --- ⭐ PROPS: ส่งฟังก์ชันจัดการบัญชี ---
                handleAddAccount={handleAddAccount}
                savedAccounts={savedAccounts}
                handleSelectAccount={handleSelectAccount}
                handleRemoveAccount={handleRemoveAccount} // ส่งฟังก์ชันลบไป
            />

            <div className="flex flex-1 p-4 gap-4"> 
                {/* --- Sidebar Wrapper Fixed --- */}
                {/* ใช้ h-fit และ max-h เพื่อให้ Sidebar หดตัวตามเนื้อหา (กำจัด Gap ตรงกลาง) แต่ไม่เกินความสูงหน้าจอ */}
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

                {/* Main Content Area */}
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