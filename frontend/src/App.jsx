import React, { useState, useEffect, useMemo, useCallback } from 'react';
// --- ⭐⭐⭐ แก้ไข: เพิ่ม Loader เข้าไปใน import ⭐⭐⭐ ---
import { CheckCircle, XCircle, Loader, AlertTriangle, X } from 'lucide-react';
// --- ⭐⭐⭐ สิ้นสุดจุดแก้ไข ⭐⭐⭐ ---
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Import Components & Pages ---
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
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


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
    case 'new_review':
      image = actor_profile_image_url || 'https://placehold.co/40x40/000000/FFFFFF?text=👤';
      message = `${actor} ได้รีวิว: **"${locationName || 'โพสต์ของคุณ'}"**`;
      link = locationId;
      break;
    case 'new_like':
      image = actor_profile_image_url || 'https://placehold.co/40x40/000000/FFFFFF?text=👤';
      message = `${actor} ถูกใจรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
      link = locationId;
      break;
    case 'new_reply':
      image = actor_profile_image_url || 'https://placehold.co/40x40/000000/FFFFFF?text=👤';
      message = `${actor} ตอบกลับรีวิวของคุณใน: **"${locationName || 'สถานที่แห่งหนึ่ง'}"**`;
      link = locationId;
      break;
    case 'new_comment_like':
      image = actor_profile_image_url || 'https://placehold.co/40x40/000000/FFFFFF?text=👤';
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
        ? `${actor} เพิ่มของขึ้นชื่อใหม่ใน **"${locationName}"**: **"${productName}"**`
        : `${actor} เพิ่มของขึ้นชื่อใหม่: **"${productName}"**`;
      image = locationImageUrl || payload.product?.image_url || payload.productImageUrl || image;
      link = locationId;
      break;
    default:
      break;
  }

  return {
    id: id || crypto.randomUUID(),
    message,
    userImage:
      image && image.startsWith('http')
        ? image
        : image
        ? `${API_BASE_URL}${image}` // This might be wrong if image URLs are absolute from Supabase
        : 'https://placehold.co/40x40/7e22ce/white?text=🔔',
    time: created_at || new Date().toISOString(),
    is_read: is_read || false,
    link,
    payload,
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
      : 'bg-gradient-to-r from-red-500 to-orange-500';

  return (
    <div className={`${baseStyle} ${typeStyle} animate-fade-in-up`}>
      {notification.type === 'success' ? <CheckCircle className="mr-3" /> : <XCircle className="mr-3" />}
      <span>{notification.message}</span>
      <button
        onClick={() => setNotification({ message: '', type: '' })}
        className="ml-4 opacity-80 hover:opacity-100"
      >
        &times;
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
                        <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-gray-100">{title}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
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
    setCurrentPage('login');
  }, [setCurrentPage, setNotification]);

  const fetchLocations = useCallback(async () => {
    setLoadingData(true);
    console.log('Fetching locations from:', API_BASE_URL); // Log the API URL being used
    try {
      const [attractionsResponse, foodShopsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/attractions`),
        fetch(`${API_BASE_URL}/api/foodShops`),
      ]);

      // Check for 404 specifically
      if (attractionsResponse.status === 404 || foodShopsResponse.status === 404) {
          console.error('Received 404 - Check if backend routes are correct and deployed.');
          throw new Error('Endpoint not found (404)');
      }
      // Check for other non-ok responses
      if (!attractionsResponse.ok || !foodShopsResponse.ok) {
          console.error('Fetch error status:', attractionsResponse.status, foodShopsResponse.status);
          // Try to get error text if available
          let errorText = `Failed to fetch locations (${attractionsResponse.status}/${foodShopsResponse.status})`;
          try {
              const attrError = attractionsResponse.ok ? null : await attractionsResponse.text();
              const foodError = foodShopsResponse.ok ? null : await foodShopsResponse.text();
              if (attrError) console.error("Attractions fetch error:", attrError);
              if (foodError) console.error("FoodShops fetch error:", foodError);
          } catch (parseErr) { /* Ignore parsing errors */ }
          throw new Error(errorText);
      }

      const attractionsData = await attractionsResponse.json();
      const foodShopsData = await foodShopsResponse.json();
      setAttractions(attractionsData);
      setFoodShops(foodShopsData);
    } catch (error) {
      console.error('Error fetching data from backend:', error);
      // Display specific error for 404, generic for others
      if (error.message.includes('404')) {
        setNotification({ message: 'ไม่พบ Endpoint ที่เรียก (404)', type: 'error'});
      } else {
        setNotification({ message: 'ไม่สามารถโหลดข้อมูลจาก Backend ได้', type: 'error' });
      }
    } finally {
      setLoadingData(false);
    }
  }, [setNotification]); // API_BASE_URL is constant, no need in deps

  const fetchFavorites = useCallback(async (userToken) => {
    if (!userToken) return setFavorites([]); // Don't fetch if not logged in
    try {
      const response = await fetch(`${API_BASE_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (response.status === 401 || response.status === 403) return handleAuthError(); // Handle expired/invalid token
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setFavorites(Array.isArray(data) ? data : []); // Ensure favorites is always an array
    } catch (error) {
      console.error('Error fetching favorites:', error.message);
      setFavorites([]); // Clear favorites on error
    }
  }, [handleAuthError]); // API_BASE_URL is constant

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // --- Effects ---
  // Initial app load effect
  useEffect(() => {
    const initializeApp = async () => {
      await fetchLocations(); // Fetch locations first
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) { // Check if user session exists
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setToken(storedToken);
          await fetchFavorites(storedToken); // Fetch favorites for logged-in user
        } catch (e) {
          console.error('Failed to parse user from localStorage', e);
          handleAuthError(); // Clear invalid session data
        }
      }
    };
    initializeApp();
    // Run only once on initial mount
  }, [fetchLocations, fetchFavorites, handleAuthError]); // Include necessary functions

  // Effect for Server-Sent Events (Notifications)
  useEffect(() => {
    if (!token) {
      setNotifications([]); // Clear notifications if logged out
      return; // Don't connect if not logged in
    }

    const eventSource = new EventSource(`${API_BASE_URL}/api/events?token=${token}`);
    eventSource.onopen = () => console.log('✅ SSE Connection established.');
    eventSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);
        if (eventData.type === 'historic_notifications' && Array.isArray(eventData.data)) {
          const formattedData = eventData.data.map(formatNotification);
          setNotifications(formattedData);
        } else if (eventData.type === 'notification' && eventData.data) {
          const newNotification = formatNotification(eventData.data);
          setNotifications((prev) => [newNotification, ...prev].slice(0, 20)); // Add new, limit size

          // Update local data for new locations received via SSE
          if (eventData.data.type === 'new_location' && eventData.data.payload?.location) {
             const newLocation = formatRowForFrontend(eventData.data.payload.location);
             if (newLocation) {
                 const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category);
                 const setter = isFoodShop ? setFoodShops : setAttractions;
                 setter((prev) => prev.some(item => item.id === newLocation.id) ? prev : [newLocation, ...prev]);
             }
          }
        }
      } catch (e) { console.error("Error processing SSE message:", e, event.data); }
    };
    eventSource.onerror = (err) => { console.error('❌ EventSource failed:', err); };

    // Cleanup: close connection on unmount or token change
    return () => { console.log('Closing SSE Connection.'); eventSource.close(); };
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
    if (currentPage === page) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsTransitioning(false);
      window.scrollTo(0, 0); // Scroll to top
    }, 200); // Transition duration
    setIsSidebarOpen(false); // Close sidebar
  }, [currentPage, setIsSidebarOpen]);

  // Mark notifications as read handler
  const handleMarkNotificationsAsRead = useCallback(async () => {
    if (unreadCount === 0 || !token) return;
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) console.error('Failed to mark notifications as read on server:', response.status);
    } catch (error) { console.error('Error marking notifications as read:', error); }
  }, [unreadCount, token]);

  // Notification click handler -> navigate to detail page
  const handleNotificationClick = useCallback(async (notificationPayload) => {
    const locationId = notificationPayload.link;
    if (!locationId) { console.warn('Notification has no link.', notificationPayload); return; }
    const allItems = [...attractions, ...foodShops];
    const location = allItems.find((item) => item.id === locationId);
    if (location) { // Found in local state
      setSelectedItem(location);
      handleSetCurrentPage('detail');
    } else { // Not found locally, fetch as fallback
      console.warn(`Location ${locationId} not in state, fetching...`);
      try {
          const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`);
          if (!response.ok) throw new Error(`Failed to fetch ${locationId} (${response.status})`);
          const itemData = await response.json();
          if (itemData?.id) { setSelectedItem(itemData); handleSetCurrentPage('detail'); }
          else setNotification({ message: 'ได้รับข้อมูลสถานที่ที่ไม่ถูกต้อง', type: 'error' });
      } catch(error) {
          console.error("Error fetching location from notification:", error);
          setNotification({ message: 'ไม่สามารถโหลดข้อมูลสถานที่ได้', type: 'error' });
      }
    }
    setIsSidebarOpen(false); // Close sidebar
  }, [attractions, foodShops, setIsSidebarOpen, handleSetCurrentPage, setNotification]);

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
      const data = await response.json();
      setNotification({ message: data.status === 'added' ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว', type: 'success' });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' });
      await fetchFavorites(token); // Revert UI / Re-fetch on error
    }
  }, [currentUser, favorites, token, handleAuthError, fetchFavorites, handleSetCurrentPage, setNotification]);

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

  // Data refresh handler (after add/edit/delete)
  const handleDataRefresh = useCallback(async (updatedItemId) => {
    await fetchLocations(); // Re-fetch all locations
    // If the viewed item was modified, refresh its details
    if (updatedItemId && selectedItem?.id === updatedItemId) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${updatedItemId}`);
        if (response.ok) setSelectedItem(await response.json());
        else if (response.status === 404) { // Handle deletion case
            setSelectedItem(null); handleSetCurrentPage('home');
            setNotification({message: "สถานที่นี้อาจถูกลบไปแล้ว", type: 'error'});
        }
      } catch (error) { console.error('Failed to refresh selected item:', error); }
    }
  }, [fetchLocations, selectedItem, handleSetCurrentPage, setNotification]);

  // Item update handler (from Edit Modal)
  const handleUpdateItem = (updatedItem) => {
    const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(updatedItem.category);
    const setter = isFoodShop ? setFoodShops : setAttractions;
    setter((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    if (selectedItem?.id === updatedItem.id) setSelectedItem(updatedItem); // Update detail view
    setIsEditModalOpen(false); setItemToEdit(null); // Close modal
  };

  // Delete execution handler (from Confirmation Modal)
  const executeDelete = async () => {
      if (!itemToDelete || !token) return handleAuthError();
      const locationId = itemToDelete;
      setItemToDelete(null); // Close modal
      try {
          const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
              method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.status === 401 || response.status === 403) return handleAuthError();
          if (response.ok || response.status === 204) { // 204 is success
              setNotification({ message: 'ลบสถานที่สำเร็จ', type: 'success' });
              await fetchLocations(); // Refresh lists
              if (selectedItem?.id === locationId) { setSelectedItem(null); handleSetCurrentPage('home'); } // Clear detail if deleted
          } else {
              const errorData = await response.json().catch(() => ({ error: 'เกิดข้อผิดพลาดในการลบ' }));
              throw new Error(errorData.error || `Server responded with ${response.status}`);
          }
      } catch (error) {
          console.error('Error deleting item:', error);
          setNotification({ message: error.message || 'ไม่สามารถลบข้อมูลได้', type: 'error' });
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
    return allItems.filter(item => favorites.includes(item.id));
  }, [attractions, foodShops, favorites]);

  // --- Page Rendering Logic ---
  const renderPage = () => {
    // Show loader only during initial data fetch
    // Check if *both* arrays are empty, indicating initial load
    if (loadingData && attractions.length === 0 && foodShops.length === 0) {
      return (
        <div className="flex flex-col justify-center items-center h-96 text-gray-500 dark:text-gray-400">
          <Loader className="animate-spin h-12 w-12" />
          <p className="mt-4 text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }

    // Common props passed to page components
    const commonProps = {
      handleItemClick: (item) => { setSelectedItem(item); handleSetCurrentPage('detail'); },
      currentUser,
      favorites,
      handleToggleFavorite,
      handleEditItem: (item) => { setItemToEdit(item); setIsEditModalOpen(true); },
      handleDeleteItem: (locationId) => { setItemToDelete(locationId); }, // Opens confirmation modal
    };

    // Render the appropriate page based on currentPage state
    switch (currentPage) {
      case 'attractions': return <AttractionsPage attractions={filteredAttractions} {...commonProps} selectedCategory={selectedCategory} />;
      case 'foodshops':   return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} selectedCategory={selectedCategory} />;
      case 'add-location': return <AddLocationPage setCurrentPage={handleSetCurrentPage} onLocationAdded={handleDataRefresh} setNotification={setNotification} handleAuthError={handleAuthError} />;
      case 'login':        return <LoginPage onAuthSuccess={handleLogin} setNotification={setNotification} API_BASE_URL={API_BASE_URL}/>; // Pass API_BASE_URL if needed locally
      case 'favorites':    return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
      case 'profile':      return <UserProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} handleAuthError={handleAuthError} handleLogout={handleLogout} setNotification={setNotification} />;
      case 'manage-products': return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} API_BASE_URL={API_BASE_URL}/>; // Pass API_BASE_URL
      case 'deletion-requests': return <ApproveDeletionsPage setNotification={setNotification} handleAuthError={handleAuthError} handleItemClick={commonProps.handleItemClick} API_BASE_URL={API_BASE_URL}/>; // Pass API_BASE_URL
      case 'detail':
        if (selectedItem) { return <DetailPage item={selectedItem} setCurrentPage={handleSetCurrentPage} onReviewSubmitted={() => handleDataRefresh(selectedItem.id)} {...commonProps} setNotification={setNotification} handleAuthError={handleAuthError} API_BASE_URL={API_BASE_URL}/>; } // Pass API_BASE_URL
        handleSetCurrentPage('home'); return null; // Redirect home if no item selected
      default: // 'home'
        return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
    }
  };

  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 font-sans antialiased flex flex-col">
      <Notification notification={notification} setNotification={setNotification} />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap'); body { font-family: 'Sarabun', sans-serif; } .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
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
      <div className="flex flex-1 p-4 gap-4">
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
        <main className={`flex-1 w-0 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'filter brightness-50 md:filter-none' : ''}`}> {/* Main Content */}
          <div className={`flex-1 container mx-auto transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              {renderPage()}
          </div>
          <Footer />
        </main>
      </div>
      {/* Modals */}
      <ConfirmationModal
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={executeDelete}
          title="ยืนยันการลบ"
          message="คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่นี้? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบรีวิว, ของขึ้นชื่อ, และรายการโปรดทั้งหมดที่เกี่ยวข้องกับสถานที่นี้ด้วย"
      />
      {isEditModalOpen && (
        <EditLocationModal
          item={itemToEdit}
          onClose={() => setIsEditModalOpen(false)}
          onItemUpdated={handleUpdateItem}
          setNotification={setNotification}
          handleAuthError={handleAuthError}
          API_BASE_URL={API_BASE_URL} // Pass API_BASE_URL to Edit Modal
        />
      )}
    </div>
  );
};

export default App;

