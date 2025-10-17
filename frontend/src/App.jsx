import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Import Components & Pages ---
// Assuming these imports are correct relative to your App.jsx file structure
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
// ❌ REMOVED: const API_BASE_URL = 'http://localhost:5000';

// --- Notification Formatter Function ---
// <<< MODIFIED: Added apiBaseUrl parameter >>>
const formatNotification = (rawNotification, apiBaseUrl) => {
    let parsedPayload = rawNotification.payload;
    if (typeof parsedPayload === 'string') {
        try { parsedPayload = JSON.parse(parsedPayload); }
        catch (e) { console.error("Failed to parse notification payload:", e); parsedPayload = {}; }
    }

    const { type, created_at, id, actor_name, is_read, actor_profile_image_url } = rawNotification;
    const payload = parsedPayload;
    let message = 'มีการแจ้งเตือนใหม่';
    let image = actor_profile_image_url || 'https://placehold.co/40x40/000000/FFFFFF?text=👤';
    let link = null;
    const actor = `**${actor_name || 'มีคน'}**`;
    const locationName = payload.location?.name || payload.locationName;
    const locationImageUrl = payload.location?.imageUrl || payload.locationImageUrl;
    const locationId = payload.location?.id || payload.locationId;
    const productName = payload.product?.name || payload.productName;

    switch (type) {
        case 'new_review': message = `${actor} ได้รีวิว: **"${locationName || 'โพสต์ของคุณ'}"**`; link = locationId; break;
        case 'new_like': message = `${actor} ถูกใจรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`; link = locationId; break;
        case 'new_reply': message = `${actor} ตอบกลับรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`; link = locationId; break;
        case 'new_comment_like': message = `${actor} ถูกใจความคิดเห็นของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`; link = locationId; break;
        case 'new_location': message = `มีการเพิ่มสถานที่ใหม่โดย ${actor}: **"${locationName || 'ไม่มีชื่อ'}"**`; image = locationImageUrl || image; link = locationId; break;
        case 'new_product': message = locationName ? `${actor} เพิ่มของขึ้นชื่อใหม่ใน **"${locationName}"**: **"${productName}"**` : `${actor} เพิ่มของขึ้นชื่อใหม่: **"${productName}"**`; image = locationImageUrl || payload.product?.image_url || payload.productImageUrl || image; link = locationId; break;
        default: break;
    }

    return {
        id: id || crypto.randomUUID(), message: message,
        // <<< MODIFIED: Uses passed apiBaseUrl >>>
        userImage: image && image.startsWith('http') ? image : (image ? `${apiBaseUrl}${image}` : 'https://placehold.co/40x40/7e22ce/white?text=🔔'),
        time: created_at || new Date().toISOString(), is_read: is_read || false, link: link, payload: payload,
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
    const baseStyle = "fixed top-5 right-5 z-[100] flex items-center p-4 rounded-lg shadow-xl text-white transition-all duration-300 transform";
    const typeStyle = notification.type === 'success' ? "bg-gradient-to-r from-green-500 to-teal-500" : "bg-gradient-to-r from-red-500 to-orange-500";
    return (
        <div className={`${baseStyle} ${typeStyle} animate-fade-in-up`}>
            {notification.type === 'success' ? <CheckCircle className="mr-3" /> : <XCircle className="mr-3" />}
            <span>{notification.message}</span>
            <button onClick={() => setNotification({ message: '', type: '' })} className="ml-4 opacity-80 hover:opacity-100">&times;</button>
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
    const [currentUser, setCurrentUser] = useState(null);
    const [token, setToken] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // <<< --- START OF CHANGE --- >>>
    // ✅ DEFINE API_BASE_URL here using environment variable with fallback
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // <<< --- END OF CHANGE --- >>>

    // --- Handlers & Callbacks ---
    const handleAuthError = useCallback(() => {
        setNotification({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', type: 'error' });
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setToken(null);
        setCurrentPage('login'); // Redirect to login
    }, []); // Removed setCurrentPage dependency

    const fetchLocations = useCallback(async () => {
        setLoadingData(true);
        try {
            // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
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
    }, [API_BASE_URL]); // <<< MODIFIED: Added dependency

    const fetchFavorites = useCallback(async (userToken) => {
        if (!userToken) return setFavorites([]);
        try {
            // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
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
    }, [handleAuthError, API_BASE_URL]); // <<< MODIFIED: Added dependency

    // --- Effects ---
    useEffect(() => {
        const initializeApp = async () => {
            await fetchLocations(); // Fetch locations first
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            if (storedToken && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    setCurrentUser(parsedUser);
                    setToken(storedToken);
                    await fetchFavorites(storedToken); // Fetch favorites after setting token
                } catch (e) { console.error("Failed to parse user from localStorage", e); handleAuthError(); }
            }
        };
        initializeApp();
    }, [fetchLocations, fetchFavorites, handleAuthError]); // Dependencies ensure this runs once correctly

    useEffect(() => {
        if (!token) { setNotifications([]); return; } // Don't establish SSE if no token
        // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
        const eventSource = new EventSource(`${API_BASE_URL}/api/events?token=${token}`);
        eventSource.onopen = () => console.log("✅ SSE Connection established.");
        eventSource.onmessage = (event) => {
            const eventData = JSON.parse(event.data);
            // <<< MODIFIED: Pass API_BASE_URL >>>
            const formatWithApiUrl = (notif) => formatNotification(notif, API_BASE_URL);

            if (eventData.type === 'historic_notifications') { setNotifications(eventData.data.map(formatWithApiUrl)); }
            if (eventData.type === 'notification' && eventData.data) {
                setNotifications(prev => [formatWithApiUrl(eventData.data), ...prev].slice(0, 20));
                if (eventData.data.type === 'new_location' && eventData.data.payload.location) {
                    const newLocation = eventData.data.payload.location;
                    const setter = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category) ? setFoodShops : setAttractions;
                    setter(prev => [newLocation, ...prev]);
                }
            }
        };
        eventSource.onerror = (err) => { console.error("❌ EventSource failed:", err); eventSource.close(); };
        return () => { console.log("Closing SSE Connection."); eventSource.close(); };
    }, [token, API_BASE_URL]); // <<< MODIFIED: Added dependency

    useEffect(() => { setUnreadCount(notifications.filter(n => !n.is_read).length); }, [notifications]);
    useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); localStorage.setItem('theme', theme); }, [theme]);

    // --- More Handlers ---
    const handleMarkNotificationsAsRead = useCallback(async () => {
        if (unreadCount === 0 || !token) return;
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
        try {
             // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
            await fetch(`${API_BASE_URL}/api/notifications/read`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        } catch (error) { console.error("Failed to mark notifications as read on server:", error); }
    }, [unreadCount, token, API_BASE_URL]); // <<< MODIFIED: Added dependency

    const handleNotificationClick = useCallback((notificationPayload) => {
        const locationId = notificationPayload.link;
        if (!locationId) return;
        const allItems = [...attractions, ...foodShops];
        const location = allItems.find(item => item.id === locationId);
        if (location) { setSelectedItem(location); setCurrentPage('detail'); }
        else {
            // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
            fetch(`${API_BASE_URL}/api/locations/${locationId}`)
                .then(res => res.ok ? res.json() : Promise.reject('Location not found'))
                .then(itemData => { if (itemData?.id) { setSelectedItem(itemData); setCurrentPage('detail'); } else { setNotification({ message: 'ไม่พบข้อมูลสถานที่', type: 'error' }); } })
                .catch(() => setNotification({ message: 'ไม่สามารถโหลดข้อมูลสถานที่ได้', type: 'error' }));
        }
    }, [attractions, foodShops, API_BASE_URL, setNotification]); // <<< MODIFIED: Added dependencies

    const handleSetCurrentPage = (page) => {
        if (currentPage === page) return;
        setIsTransitioning(true);
        setTimeout(() => { setCurrentPage(page); setIsTransitioning(false); window.scrollTo(0, 0); }, 200);
    };

    const handleToggleFavorite = useCallback(async (locationId) => {
        if (!currentUser) { setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' }); return handleSetCurrentPage('login'); }
        const isCurrentlyFavorite = favorites.includes(locationId);
        setFavorites(prev => isCurrentlyFavorite ? prev.filter(id => id !== locationId) : [...prev, locationId]);
        try {
             // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
            const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ locationId }) });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error('Failed to toggle favorite');
            const data = await response.json();
            // setNotification({ message: data.status === 'added' ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว', type: 'success' });
        } catch (error) { setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' }); fetchFavorites(token); }
    }, [currentUser, favorites, token, API_BASE_URL, handleAuthError, fetchFavorites, handleSetCurrentPage, setNotification]); // <<< MODIFIED: Added dependency

    const handleLogin = (userData, userToken) => { /* ... unchanged ... */ };
    const handleLogout = () => { /* ... unchanged ... */ };
    const handleProfileUpdate = (updatedUser, newToken) => { /* ... unchanged ... */ };

    const handleDataRefresh = useCallback(async (updatedItemId) => {
        await fetchLocations();
        if (updatedItemId && selectedItem?.id === updatedItemId) {
            try {
                 // <<< MODIFIED: Uses API_BASE_URL from component scope >>>
                const response = await fetch(`${API_BASE_URL}/api/locations/${updatedItemId}`);
                if (response.ok) setSelectedItem(await response.json());
            } catch (error) { console.error("Failed to refresh selected item:", error); }
        }
    }, [fetchLocations, selectedItem, API_BASE_URL]); // <<< MODIFIED: Added dependency

    const handleUpdateItem = (updatedItem) => { /* ... unchanged ... */ };

    // --- Memoized Data ---
    const filteredAttractions = useMemo(() => selectedCategory === 'ทั้งหมด' ? attractions : attractions.filter(item => item.category === selectedCategory), [attractions, selectedCategory]);
    const filteredFoodShops = useMemo(() => selectedCategory === 'ทั้งหมด' ? foodShops : foodShops.filter(item => item.category === selectedCategory), [foodShops, selectedCategory]);
    const favoriteItems = useMemo(() => [...attractions, ...foodShops].filter(item => favorites.includes(item.id)), [attractions, foodShops, favorites]);

    // --- Page Rendering Logic ---
    const renderPage = () => {
        // Show loading indicator longer if initial data fetch is still happening
        if (loadingData && (!attractions.length || !foodShops.length)) {
            return (<div className="flex justify-center items-center h-96"><Loader className="animate-spin h-12 w-12 text-blue-500" /><p className="ml-4 text-lg">กำลังโหลดข้อมูล...</p></div>);
        }
        const commonProps = { handleItemClick: (item) => { setSelectedItem(item); handleSetCurrentPage('detail'); }, currentUser, favorites, handleToggleFavorite, handleEditItem: (item) => { setItemToEdit(item); setIsEditModalOpen(true); }, handleDeleteItem: () => {} };
        switch (currentPage) {
            case 'attractions': return <AttractionsPage attractions={filteredAttractions} {...commonProps} />;
            case 'foodshops': return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} />;
            case 'add-location': return <AddLocationPage setCurrentPage={handleSetCurrentPage} onLocationAdded={handleDataRefresh} setNotification={setNotification} handleAuthError={handleAuthError} />;
            case 'login': return <LoginPage onAuthSuccess={handleLogin} />; // Removed setNotification as LoginPage doesn't use it directly
            case 'favorites': return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
            case 'profile': return <UserProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} handleAuthError={handleAuthError} handleLogout={handleLogout} setNotification={setNotification} />;
            case 'manage-products': return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} />;
            case 'deletion-requests': return <ApproveDeletionsPage setNotification={setNotification} handleAuthError={handleAuthError} handleItemClick={commonProps.handleItemClick} />;
            case 'detail': if (selectedItem) return <DetailPage item={selectedItem} setCurrentPage={handleSetCurrentPage} onReviewSubmitted={() => handleDataRefresh(selectedItem.id)} {...commonProps} setNotification={setNotification} handleAuthError={handleAuthError} />; handleSetCurrentPage('home'); return null;
            default: return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
        }
    };

    // --- JSX ---
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-gray-900 font-sans antialiased flex flex-col">
            {/* <<< MODIFIED: Use renamed component >>> */}
            <Notification notification={notification} setNotification={setNotification} />
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap'); body { font-family: 'Sarabun', sans-serif; } .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <Header currentPage={currentPage} setCurrentPage={handleSetCurrentPage} currentUser={currentUser} handleLogout={handleLogout} theme={theme} toggleTheme={() => setTheme(prev => (prev === 'light' ? 'dark' : 'light'))} notifications={notifications} unreadCount={unreadCount} handleMarkNotificationsAsRead={handleMarkNotificationsAsRead} onNotificationClick={handleNotificationClick} />
            <div className="flex flex-1">
                <Sidebar selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} setCurrentPage={handleSetCurrentPage} currentUser={currentUser} handleLogout={handleLogout} />
                <main className="flex-grow md:ml-64 transition-all duration-300">
                    <div className={`p-4 sm:p-6 transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="container mx-auto">{renderPage()}</div>
                    </div>
                </main>
            </div>
            <Footer />
            {isEditModalOpen && <EditLocationModal item={itemToEdit} onClose={() => setIsEditModalOpen(false)} onItemUpdated={handleUpdateItem} setNotification={setNotification} handleAuthError={handleAuthError} />}
        </div>
    );
};

export default App;