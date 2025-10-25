// test
import React, { useState, useEffect, useMemo, useCallback } from 'react';
// --- ⭐⭐⭐ แก้ไข: เพิ่ม Loader เข้าไปใน import ⭐⭐⭐ ---
import { CheckCircle, XCircle, Loader, AlertTriangle, X } from 'lucide-react';
// --- ⭐⭐⭐ สิ้นสุดจุดแก้ไข ⭐⭐⭐ ---
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- ⭐ FIX: Correct Import Paths (Assuming App.jsx is in src/ and components are in src/components/) ---
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
// --- END FIX ---


// --- Global API Configuration ---
// ⭐ FIX: Avoid using import.meta.env directly to prevent build warnings
const getApiBaseUrl = () => {
    // Rely on hostname for local development vs production
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Use localhost for local development
        return 'http://localhost:5000';
    }
    // Assume production backend URL otherwise
    // Ensure this matches your deployed backend!
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();
// --- END FIX ---


// --- Notification Formatter Function ---
const formatNotification = (rawNotification) => {
    let parsedPayload = rawNotification.payload;
    if (typeof parsedPayload === 'string') {
        try {
            parsedPayload = JSON.parse(parsedPayload);
        } catch (e) {
            console.error('Failed to parse notification payload:', e);
            parsedPayload = {}; // Fallback to empty object
        }
    } else if (parsedPayload === null || typeof parsedPayload !== 'object') {
        parsedPayload = {}; // Ensure payload is always an object
    }


    const { type, created_at, id, actor_name, is_read, actor_profile_image_url } = rawNotification;
    const payload = parsedPayload;


    let message = 'มีการแจ้งเตือนใหม่';
    // Provide a default placeholder image
    let image = actor_profile_image_url || 'https://placehold.co/40x40/7e22ce/white?text=🔔';
    let link = null;


    const actor = `**${actor_name || 'มีคน'}**`;
    // Safely access potentially nested properties
    const locationName = payload.location?.name || payload.locationName;
    const locationImageUrl = payload.location?.imageUrl || payload.locationImageUrl;
    const locationId = payload.location?.id || payload.locationId;
    const productName = payload.product?.name || payload.productName;
    const productImageUrl = payload.product?.imageUrl || payload.productImageUrl;


    switch (type) {
        case 'new_review':
             // image already set to actor's image or default
            message = `${actor} ได้รีวิว: **"${locationName || 'โพสต์ของคุณ'}"**`;
            link = locationId;
            break;
        case 'new_like':
            // image already set
            message = `${actor} ถูกใจรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            break;
        case 'new_reply':
            // image already set
            message = `${actor} ตอบกลับรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            break;
        case 'new_comment_like':
             // image already set
            message = `${actor} ถูกใจความคิดเห็นของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
            link = locationId;
            break;
        case 'new_location':
            message = `มีการเพิ่มสถานที่ใหม่โดย ${actor}: **"${locationName || 'ไม่มีชื่อ'}"**`;
            image = locationImageUrl || image; // Use location image if available, else actor/default
            link = locationId;
            break;
        case 'new_product':
            message = locationName
                ? `${actor} เพิ่มของขึ้นชื่อใหม่ใน **"${locationName}"**: **"${productName || 'ไม่มีชื่อ'}"**`
                : `${actor} เพิ่มของขึ้นชื่อใหม่: **"${productName || 'ไม่มีชื่อ'}"**`;
            // Prioritize product image, then location, then actor/default
            image = productImageUrl || locationImageUrl || image;
            link = locationId; // Link to the location page where the product was added
            break;
        default:
            console.warn("Unknown notification type:", type);
            // Keep default message and image
            break;
    }


    // Ensure time is valid before formatting
    const timeString = created_at ? formatDistanceToNow(new Date(created_at), { addSuffix: true, locale: th }) : 'เมื่อสักครู่';


    return {
        id: id || crypto.randomUUID(),
        message,
        // Ensure userImage is a valid URL
        userImage: image && typeof image === 'string' && image.startsWith('http')
                   ? image
                   : 'https://placehold.co/40x40/7e22ce/white?text=🔔', // Fallback placeholder
        time: timeString, // Use formatted time string
        is_read: is_read || false,
        link, // This will be the locationId to navigate to
        // Keep original payload for potential use, ensure it's an object
        payload: typeof payload === 'object' && payload !== null ? payload : {},
        // Keep original timestamp for sorting if needed later
        original_created_at: created_at || new Date().toISOString(),
    };
};


// --- General Purpose Notification Component (for success/error messages) ---
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
            : 'bg-gradient-to-r from-blue-500 to-indigo-500'; // Default style if type is missing


    return (
        <div className={`${baseStyle} ${typeStyle} animate-fade-in-up`}>
            {notification.type === 'success' ? <CheckCircle className="mr-3" /> : notification.type === 'error' ? <XCircle className="mr-3" /> : null}
            <span>{notification.message}</span>
            <button
                onClick={() => setNotification({ message: '', type: '' })}
                className="ml-4 opacity-80 hover:opacity-100"
                aria-label="Close notification" // Add aria-label
            >
                <X size={18}/> {/* Use X icon */}
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
            onClick={onClose} // Allow closing by clicking background
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking modal content
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

 // --- State for Deletion Confirmation Modal ---
 const [itemToDelete, setItemToDelete] = useState(null); // (null or locationId)

 // --- Handlers & Callbacks ---
 const handleAuthError = useCallback(() => {
    setNotification({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', type: 'error' });
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentUser(null);
    setToken(null);
    setCurrentPage('login'); // Redirect to login
 }, [setCurrentPage, setNotification]); // Removed unnecessary dependencies

 const fetchLocations = useCallback(async () => {
    setLoadingData(true);
    console.log('Fetching locations from:', API_BASE_URL);
    try {
      const [attractionsResponse, foodShopsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/attractions`),
        fetch(`${API_BASE_URL}/api/foodShops`),
      ]);

      if (!attractionsResponse.ok || !foodShopsResponse.ok) {
        // Log detailed error status if fetch fails
        console.error('Fetch error status:', attractionsResponse.status, foodShopsResponse.status);
        throw new Error(`Failed to fetch locations (${attractionsResponse.status}/${foodShopsResponse.status})`);
      }

      const attractionsData = await attractionsResponse.json();
      const foodShopsData = await foodShopsResponse.json();
      setAttractions(Array.isArray(attractionsData) ? attractionsData : []); // Ensure array
      setFoodShops(Array.isArray(foodShopsData) ? foodShopsData : []); // Ensure array

    } catch (error) {
      console.error('Error fetching data from backend:', error);
      setNotification({ message: `ไม่สามารถโหลดข้อมูลได้: ${error.message}`, type: 'error' });
      setAttractions([]); // Clear data on error
      setFoodShops([]); // Clear data on error
    } finally {
      setLoadingData(false);
    }
 }, [setNotification]); // API_BASE_URL is stable, remove from deps

 const fetchFavorites = useCallback(async (userToken) => {
    if (!userToken) { setFavorites([]); return; } // Clear favorites if no token
    try {
      const response = await fetch(`${API_BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (response.status === 401 || response.status === 403) return handleAuthError();
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching favorites:', error.message);
      setFavorites([]); // Clear favorites on error
    }
 }, [handleAuthError]); // API_BASE_URL is stable

 const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
 }, []);

 // --- Effects ---
 // Initial app load effect (fetch data, check auth)
 useEffect(() => {
    const initializeApp = async () => {
      setLoadingData(true); // Ensure loading state is true initially
      await fetchLocations(); // Fetch locations first
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setToken(storedToken);
          await fetchFavorites(storedToken); // Fetch favorites only after setting token
        } catch (e) {
          console.error('Failed to parse user from localStorage', e);
          handleAuthError(); // Clear invalid session data
        }
      }
      setLoadingData(false); // Set loading to false after all initial fetches
    };
    initializeApp();
 }, [fetchLocations, fetchFavorites, handleAuthError]); // Dependencies for initialization logic

 // Effect for Server-Sent Events (Notifications)
 useEffect(() => {
    if (!token) {
      setNotifications([]); // Clear notifications if logged out
      return; // Don't connect if not logged in
    }

    let eventSource;
    let reconnectTimeout;

    const connectSSE = () => {
        // Close existing connection if any
        if (eventSource) {
            eventSource.close();
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }

        console.log(`Attempting to connect SSE to ${API_BASE_URL}/api/events...`);
        eventSource = new EventSource(`${API_BASE_URL}/api/events?token=${token}`);

        eventSource.onopen = () => console.log('✅ SSE Connection established.');

        eventSource.onmessage = (event) => {
            try {
                const eventData = JSON.parse(event.data);

                if (eventData.type === 'historic_notifications' && Array.isArray(eventData.data)) {
                    // Process historic notifications, sort by date descending
                    const formattedData = eventData.data
                        .map(formatNotification)
                        .sort((a, b) => new Date(b.original_created_at) - new Date(a.original_created_at));
                    setNotifications(formattedData.slice(0, 50)); // Limit historic load
                    console.log(`Loaded ${formattedData.length} historic notifications.`);
                } else if (eventData.type === 'notification' && eventData.data) {
                    const newNotification = formatNotification(eventData.data);
                    console.log("Received new notification:", newNotification);
                    // Add new notification to the beginning, sort, and limit
                    setNotifications((prev) =>
                        [newNotification, ...prev]
                        .sort((a, b) => new Date(b.original_created_at) - new Date(a.original_created_at))
                        .slice(0, 50) // Limit total notifications
                    );

                    // --- Real-time Data Update for New Locations ---
                    if (eventData.data.type === 'new_location' && eventData.data.payload?.location) {
                        const newLocation = eventData.data.payload.location; // Use raw data
                        if (newLocation && newLocation.id) {
                            const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category);
                            const setter = isFoodShop ? setFoodShops : setAttractions;
                            // Add or update the item in the correct list
                            setter((prev) => {
                                const exists = prev.some(item => item.id === newLocation.id);
                                return exists
                                    ? prev.map(item => item.id === newLocation.id ? newLocation : item)
                                    : [newLocation, ...prev]; // Add to beginning if new
                            });
                             console.log(`Real-time update: Added/Updated location ${newLocation.id}`);
                        }
                    }
                     // --- You could add similar logic for product updates/deletions if needed ---

                } else if (eventData.type === 'connected') {
                    console.log(`SSE Client ID: ${eventData.clientId}`);
                } else {
                     console.log("Received SSE message:", eventData);
                }
            } catch (e) { console.error("Error processing SSE message:", e, event.data); }
        };

        eventSource.onerror = (err) => {
            console.error('❌ EventSource failed:', err);
            eventSource.close(); // Close the failed connection
            // Attempt to reconnect after a delay
            if (!reconnectTimeout) {
                 console.log('Attempting SSE reconnect in 5 seconds...');
                 reconnectTimeout = setTimeout(connectSSE, 5000); // Reconnect after 5 seconds
            }
        };
    };

    connectSSE(); // Initial connection attempt

    // Cleanup: close connection and clear timeout
    return () => {
        console.log('Closing SSE Connection.');
        if (eventSource) {
            eventSource.close();
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }
    };
 }, [token]); // Reconnect if token changes

 // Update unread count when notifications change
 useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.is_read).length);
 }, [notifications]);

 // Apply theme class to HTML element and save preference
 useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
 }, [theme]);

 // --- More Handlers ---
 // Page navigation handler with transition
 const handleSetCurrentPage = useCallback((page) => {
    if (currentPage === page) return; // Prevent unnecessary transitions
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsTransitioning(false);
      window.scrollTo(0, 0); // Scroll to top after transition
    }, 200); // Match transition duration
    setIsSidebarOpen(false); // Always close sidebar on navigation
 }, [currentPage]); // Removed setIsSidebarOpen dependency

 // Mark notifications as read handler
 const handleMarkNotificationsAsRead = useCallback(async () => {
    if (unreadCount === 0 || !token) return;
    // Optimistic UI update
    const currentlyUnread = notifications.filter(n => !n.is_read).map(n => n.id);
    setNotifications((prev) => prev.map((n) => currentlyUnread.includes(n.id) ? { ...n, is_read: true } : n));
    setUnreadCount(0); // Immediately update count

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
          console.error('Failed to mark notifications as read on server:', response.status);
           // Optional: Revert optimistic update on failure, maybe after a delay
           // setNotifications(prevNotifications); // Requires storing prev state
           // setUnreadCount(currentlyUnread.length);
           setNotification({message: "ไม่สามารถอัปเดตสถานะแจ้งเตือนบนเซิร์ฟเวอร์", type: "error"});
      }
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        // Optional: Revert optimistic update on network error
        // setNotifications(prevNotifications);
        // setUnreadCount(currentlyUnread.length);
        setNotification({message: "เกิดข้อผิดพลาดในการเชื่อมต่อเพื่ออัปเดตแจ้งเตือน", type: "error"});
    }
 }, [unreadCount, token, notifications, setNotification]); // Added notifications and setNotification

 // Notification click handler -> navigate to detail page
 const handleNotificationClick = useCallback(async (notificationPayload) => {
    const locationId = notificationPayload.link;
    if (!locationId) { console.warn('Notification has no link.', notificationPayload); return; }

    const allItems = [...attractions, ...foodShops];
    let location = allItems.find((item) => item.id === locationId);

    if (!location) { // Not found locally, fetch as fallback
        console.warn(`Location ${locationId} not in state, fetching...`);
        setLoadingData(true); // Show loading indicator
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`);
            if (!response.ok) throw new Error(`Failed to fetch ${locationId} (${response.status})`);
            location = await response.json();
        } catch(error) {
            console.error("Error fetching location from notification:", error);
            setNotification({ message: 'ไม่สามารถโหลดข้อมูลสถานที่ได้', type: 'error' });
            setLoadingData(false);
            return; // Stop if fetch fails
        } finally {
             setLoadingData(false);
        }
    }

    if (location?.id) { // Ensure fetched data is valid
        setSelectedItem(location);
        handleSetCurrentPage('detail');
    } else {
        setNotification({ message: 'ได้รับข้อมูลสถานที่ที่ไม่ถูกต้อง', type: 'error' });
    }

    setIsSidebarOpen(false); // Close sidebar
 }, [attractions, foodShops, handleSetCurrentPage, setNotification]); // Removed setIsSidebarOpen

 // Toggle favorite status handler
 const handleToggleFavorite = useCallback(async (locationId) => {
    if (!currentUser) {
      setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' });
      return handleSetCurrentPage('login');
    }
    const isCurrentlyFavorite = favorites.includes(locationId);
    // Optimistic UI update
    setFavorites((prev) => (isCurrentlyFavorite ? prev.filter((id) => id !== locationId) : [...prev, locationId]));
    try {
      const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locationId }),
      });
      if (response.status === 401 || response.status === 403) return handleAuthError();
      if (!response.ok) throw new Error('Failed to toggle favorite on server');
      // Optional: Show success notification only if needed, avoids noise
      // const data = await response.json();
      // setNotification({ message: data.status === 'added' ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว', type: 'success' });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' });
      // Revert UI / Re-fetch on error
      setFavorites((prev) => (isCurrentlyFavorite ? [...prev, locationId] : prev.filter((id) => id !== locationId)));
      // Or simply refetch: await fetchFavorites(token);
    }
 }, [currentUser, favorites, token, handleAuthError, handleSetCurrentPage, setNotification]); // Removed fetchFavorites

 // Login handler
 const handleLogin = (userData, userToken) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    setCurrentUser(userData);
    setToken(userToken);
    fetchFavorites(userToken); // Fetch user's favorites
    handleSetCurrentPage('home');
    setNotification({ message: `ยินดีต้อนรับ, ${userData.displayName || userData.username}!`, type: 'success' });
 };

 // Logout handler
 const handleLogout = () => {
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

 // Profile update handler
 const handleProfileUpdate = (updatedUser, newToken) => {
    setCurrentUser(updatedUser);
    if (newToken) { setToken(newToken); localStorage.setItem('token', newToken); }
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setNotification({ message: 'ข้อมูลโปรไฟล์อัปเดตแล้ว!', type: 'success' });
 };

 // Data refresh handler (after add/edit/delete location)
 const handleDataRefresh = useCallback(async (updatedItemId) => {
    const previousSelectedItem = selectedItem; // Store current selected item
    await fetchLocations(); // Re-fetch all locations first

    // Check if the previously selected item still exists after refresh
    if (updatedItemId && previousSelectedItem?.id === updatedItemId) {
        // Attempt to find the updated item in the newly fetched lists
        const allNewItems = [...attractions, ...foodShops];
        const refreshedItem = allNewItems.find(item => item.id === updatedItemId);

        if (refreshedItem) {
             setSelectedItem(refreshedItem); // Update selected item with potentially changed data
        } else {
            // Item was likely deleted or moved table and fetch didn't catch up immediately
            console.warn(`Item ${updatedItemId} not found after refresh.`);
            setSelectedItem(null); // Clear selected item
            handleSetCurrentPage('home'); // Go back home
            setNotification({message: "สถานที่นี้อาจถูกลบหรือย้ายไปแล้ว", type: 'warning'});
        }
    }
 }, [fetchLocations, selectedItem, handleSetCurrentPage, setNotification, attractions, foodShops]); // Added attractions/foodShops deps

 // Item update handler (called by Edit Modal on successful save)
 const handleUpdateItem = (updatedItem) => {
    // Determine the correct list based on the *updated* category
    const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(updatedItem.category);

    // Update the item in the correct list (or add if it moved tables)
    setAttractions((prev) => isFoodShop
        ? prev.filter((item) => item.id !== updatedItem.id) // Remove if moved to foodShops
        : prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)) // Update if still attraction
    );
    setFoodShops((prev) => !isFoodShop
        ? prev.filter((item) => item.id !== updatedItem.id) // Remove if moved to attractions
        : prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)) // Update if still foodShop
    );

    // If the item wasn't in the list before (it moved), add it
     if (isFoodShop && !foodShops.some(item => item.id === updatedItem.id)) {
         setFoodShops(prev => [updatedItem, ...prev]);
     }
     if (!isFoodShop && !attractions.some(item => item.id === updatedItem.id)) {
         setAttractions(prev => [updatedItem, ...prev]);
     }


    // Update detail view if the edited item is currently selected
    if (selectedItem?.id === updatedItem.id) {
        setSelectedItem(updatedItem);
    }
    setIsEditModalOpen(false); // Close modal
    setItemToEdit(null);
 };

 // Delete execution handler (called by Confirmation Modal)
 const executeDelete = async () => {
    if (!itemToDelete || !token) {
        // Reset itemToDelete if token is missing before calling handleAuthError
        setItemToDelete(null);
        return handleAuthError();
    }
    const locationId = itemToDelete;
    setItemToDelete(null); // Close confirmation modal immediately

    setLoadingData(true); // Indicate loading during deletion
    try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) return handleAuthError();
        if (response.ok || response.status === 204) { // 204 No Content is success
            setNotification({ message: 'ลบสถานที่สำเร็จ', type: 'success' });
            // Remove from local state immediately
            setAttractions(prev => prev.filter(item => item.id !== locationId));
            setFoodShops(prev => prev.filter(item => item.id !== locationId));
            // If the deleted item was selected, go back home
            if (selectedItem?.id === locationId) {
                setSelectedItem(null);
                handleSetCurrentPage('home');
            }
        } else {
            const errorData = await response.json().catch(() => ({ error: `เกิดข้อผิดพลาดในการลบ (${response.status})` }));
            throw new Error(errorData.error || `Server responded with ${response.status}`);
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        setNotification({ message: error.message || 'ไม่สามารถลบข้อมูลได้', type: 'error' });
        // Optional: Refetch data on deletion error to ensure consistency
        // await fetchLocations();
    } finally {
        setLoadingData(false); // Stop loading indicator
    }
 };


 // --- Memoized Data ---
 // Memoize filtered lists based on selected category
 const filteredAttractions = useMemo(() => {
    if (!Array.isArray(attractions)) return [];
    return selectedCategory === 'ทั้งหมด' ? attractions : attractions.filter(item => item.category === selectedCategory);
 }, [attractions, selectedCategory]);

 const filteredFoodShops = useMemo(() => {
    if (!Array.isArray(foodShops)) return [];
    return selectedCategory === 'ทั้งหมด' ? foodShops : foodShops.filter(item => item.category === selectedCategory);
 }, [foodShops, selectedCategory]);

 // Memoize the list of favorite items
 const favoriteItems = useMemo(() => {
    const allItems = [...attractions, ...foodShops];
    if (!Array.isArray(favorites)) return [];
    // Ensure allItems have IDs before filtering
    return allItems.filter(item => item && item.id && favorites.includes(item.id));
 }, [attractions, foodShops, favorites]);

 // --- Page Rendering Logic ---
 const renderPage = () => {
    // Show loader overlay during initial data fetch OR during transitions
    if (loadingData && attractions.length === 0 && foodShops.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center h-96 text-gray-500 dark:text-gray-400">
          <Loader className="animate-spin h-12 w-12" />
          <p className="mt-4 text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }

    // Common props passed down to page components
    const commonProps = {
      handleItemClick: (item) => { setSelectedItem(item); handleSetCurrentPage('detail'); },
      currentUser, // ⭐⭐⭐ Pass currentUser down ⭐⭐⭐
      favorites,
      handleToggleFavorite,
      // Pass function to open edit modal
      handleEditItem: (item) => { setItemToEdit(item); setIsEditModalOpen(true); },
       // Pass function to open delete confirmation
      handleDeleteItem: (locationId) => { setItemToDelete(locationId); },
    };

    // Render the appropriate page component based on currentPage state
    switch (currentPage) {
      case 'attractions': return <AttractionsPage attractions={filteredAttractions} {...commonProps} selectedCategory={selectedCategory} />;
      case 'foodshops':   return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} selectedCategory={selectedCategory} />;
      case 'add-location': return <AddLocationPage setCurrentPage={handleSetCurrentPage} onLocationAdded={handleDataRefresh} setNotification={setNotification} handleAuthError={handleAuthError} />;
      case 'login':        return <LoginPage onAuthSuccess={handleLogin} setNotification={setNotification} />; // Removed API_BASE_URL prop
      case 'favorites':    return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
      case 'profile':      return <UserProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} handleAuthError={handleAuthError} handleLogout={handleLogout} setNotification={setNotification} />;
      case 'manage-products': return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} />; // Removed API_BASE_URL prop
      case 'deletion-requests': return <ApproveDeletionsPage setNotification={setNotification} handleAuthError={handleAuthError} handleItemClick={commonProps.handleItemClick} />; // Removed API_BASE_URL prop
      case 'detail':
        if (selectedItem) {
            // ⭐⭐⭐ Ensure currentUser is passed to DetailPage ⭐⭐⭐
            return <DetailPage
                        item={selectedItem}
                        setCurrentPage={handleSetCurrentPage}
                        onReviewSubmitted={() => handleDataRefresh(selectedItem.id)}
                        {...commonProps} // This already includes currentUser from commonProps
                        setNotification={setNotification}
                        handleAuthError={handleAuthError}
                        // API_BASE_URL is not needed if using the global constant
                   />;
        }
        handleSetCurrentPage('home'); return null; // Redirect home if no valid item selected
      default: // 'home' or any other case
        return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
    }
 };

 // --- JSX Structure ---
 return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 font-sans antialiased flex flex-col">
      <Notification notification={notification} setNotification={setNotification} />
      {/* Google Font Import & Animation Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Sarabun', sans-serif; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
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
      />
      <div className="flex flex-1 p-4 gap-4 overflow-hidden"> {/* Added overflow-hidden */}
        <div className="relative"> {/* Sidebar Wrapper */}
          <Sidebar
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            setCurrentPage={handleSetCurrentPage}
            currentUser={currentUser}
            handleLogout={handleLogout}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
          />
        </div>
        {/* Main Content Area */}
        <main className={`flex-1 w-0 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'filter brightness-50 md:filter-none' : ''} overflow-y-auto`}> {/* Added overflow-y-auto */}
          <div className={`flex-1 container mx-auto transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              {renderPage()}
          </div>
          <Footer />
        </main>
      </div>
      {/* Global Modals */}
      <ConfirmationModal
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={executeDelete}
          title="ยืนยันการลบ"
          message="คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่นี้? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบรีวิว, ของขึ้นชื่อ, และรายการโปรดทั้งหมดที่เกี่ยวข้องกับสถานที่นี้ด้วย"
      />
      {isEditModalOpen && itemToEdit && ( // Ensure itemToEdit is not null
        <EditLocationModal
          item={itemToEdit}
          onClose={() => { setIsEditModalOpen(false); setItemToEdit(null); }} // Clear itemToEdit on close
          onItemUpdated={handleUpdateItem}
          setNotification={setNotification}
          handleAuthError={handleAuthError}
          // API_BASE_URL should be accessible globally, no need to pass
        />
      )}
    </div>
 );
};

export default App;

