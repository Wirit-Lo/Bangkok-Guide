import React, { useState, useEffect, useMemo, useCallback } from 'react';
// --- FIX: Import AlertTriangle และ X สำหรับ Modal ---
import { CheckCircle, XCircle, Loader, AlertTriangle, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- Import Components & Pages (ใช้ import จริงจากโปรเจกต์ของคุณ) ---
// (หมายเหตุ: ตรวจสอบว่า path ของ components เหล่านี้ถูกต้อง)
// --- FIX: เปลี่ยน path aliases '@/...' เป็น relative paths './...' ---
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
// ⭐⭐⭐ นี่คือจุดที่แก้ไขครับ! ⭐⭐⭐
// เปลี่ยนจากการ hard-code 'http://localhost:5000'
// เป็นการดึงค่าจาก Environment Variable (VITE_API_URL) ที่ตั้งค่าไว้บน Vercel
// ถ้าหาไม่เจอ (เช่น รันในเครื่อง) ให้ใช้ 'http://localhost:5000' เป็นค่าสำรอง
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// ⭐⭐⭐ สิ้นสุดจุดที่แก้ไข ⭐⭐⭐


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

// --- FIX: เพิ่ม Reusable Confirmation Modal ---
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

  // --- FIX: เพิ่ม State สำหรับ Modal การลบ ---
  const [itemToDelete, setItemToDelete] = useState(null); // (null หรือ locationId)

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
    // ⭐⭐⭐ เพิ่ม console.log ตรงนี้ ⭐⭐⭐
    console.log('Fetching locations from:', API_BASE_URL);
    // ⭐⭐⭐ สิ้นสุดจุดที่เพิ่ม ⭐⭐⭐
    try {
      const [attractionsResponse, foodShopsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/attractions`),
        fetch(`${API_BASE_URL}/api/foodShops`),
      ]);

      // Check for 404 specifically maybe?
      if (attractionsResponse.status === 404 || foodShopsResponse.status === 404) {
          console.error('Received 404 - Check if backend routes are correct and deployed.');
          throw new Error('Endpoint not found (404)');
      }
      if (!attractionsResponse.ok || !foodShopsResponse.ok) {
          console.error('Fetch error:', attractionsResponse.status, foodShopsResponse.status);
          throw new Error(`Failed to fetch locations (${attractionsResponse.status}/${foodShopsResponse.status})`);
      }

      const attractionsData = await attractionsResponse.json();
      const foodShopsData = await foodShopsResponse.json();
      setAttractions(attractionsData);
      setFoodShops(foodShopsData);
    } catch (error) {
      console.error('Error fetching data from backend:', error);
      // Avoid showing generic error if it was 404
      if (!error.message.includes('404')) {
        setNotification({ message: 'ไม่สามารถโหลดข้อมูลจาก Backend ได้', type: 'error' });
      } else {
        setNotification({ message: 'ไม่พบ Endpoint ที่เรียก (404)', type: 'error'});
      }
    } finally {
      setLoadingData(false);
    }
  }, [setNotification]); // Removed API_BASE_URL from dependencies as it's constant now

  const fetchFavorites = useCallback(async (userToken) => {
    if (!userToken) return setFavorites([]);
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
  }, [handleAuthError]); // Removed API_BASE_URL

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // --- Effects ---
  useEffect(() => {
    const initializeApp = async () => {
      // Fetch initial location data
      await fetchLocations();

      // Check for stored user session
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setCurrentUser(parsedUser);
          setToken(storedToken);
          // Fetch favorites only after setting the token
          await fetchFavorites(storedToken);
        } catch (e) {
          console.error('Failed to parse user from localStorage', e);
          handleAuthError(); // Clear invalid session
        }
      }
    };
    initializeApp();
  }, [fetchLocations, fetchFavorites, handleAuthError]); // Dependencies for initial app load

  // Effect for Server-Sent Events (Notifications)
  useEffect(() => {
    if (!token) {
      setNotifications([]); // Clear notifications if no token
      return; // Don't establish connection if not logged in
    }

    // Establish SSE connection
    const eventSource = new EventSource(`${API_BASE_URL}/api/events?token=${token}`);

    eventSource.onopen = () => console.log('✅ SSE Connection established.');

    eventSource.onmessage = (event) => {
      try {
        const eventData = JSON.parse(event.data);

        // Handle historic notifications received upon connection
        if (eventData.type === 'historic_notifications' && Array.isArray(eventData.data)) {
          const formattedData = eventData.data.map(formatNotification);
          setNotifications(formattedData);
        }
        // Handle real-time notifications
        else if (eventData.type === 'notification' && eventData.data) {
          const newNotification = formatNotification(eventData.data);
          // Add new notification to the beginning, limit array size
          setNotifications((prev) => [newNotification, ...prev].slice(0, 20));

          // Optionally update local data based on notification type (e.g., new location added)
          if (eventData.data.type === 'new_location' && eventData.data.payload?.location) {
            const newLocation = formatRowForFrontend(eventData.data.payload.location); // Ensure formatting
            if(newLocation) {
                const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(newLocation.category);
                const setter = isFoodShop ? setFoodShops : setAttractions;
                // Add the new location if it's not already present (prevent duplicates)
                setter((prev) => prev.some(item => item.id === newLocation.id) ? prev : [newLocation, ...prev]);
            }
          }
        }
      } catch (e) {
          console.error("Error processing SSE message:", e, event.data);
      }
    };

    eventSource.onerror = (err) => {
      console.error('❌ EventSource failed:', err);
      // Don't automatically close on error, browser might retry
      // eventSource.close();
    };

    // Cleanup function: close SSE connection when component unmounts or token changes
    return () => {
      console.log('Closing SSE Connection.');
      eventSource.close();
    };
  }, [token]); // Re-run effect if token changes (login/logout)

  // Effect to update unread notification count whenever notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter((n) => !n.is_read).length);
  }, [notifications]);

  // Effect to apply theme (dark/light) to HTML element and save preference
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  // --- More Handlers ---
  // Navigate between pages with transition effect
  const handleSetCurrentPage = useCallback((page) => {
    if (currentPage === page) return; // Prevent unnecessary transitions
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(page);
      setIsTransitioning(false);
      window.scrollTo(0, 0); // Scroll to top on page change
    }, 200); // Duration matches transition-opacity
    setIsSidebarOpen(false); // Close sidebar on page navigation
  }, [currentPage, setIsSidebarOpen]); // Include isSidebarOpen setter

  // Mark notifications as read on the server
  const handleMarkNotificationsAsRead = useCallback(async () => {
    if (unreadCount === 0 || !token) return;
    // Optimistically update UI
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
          // Revert UI changes if server update fails (optional)
          console.error('Failed to mark notifications as read on server:', response.status);
          // Could re-fetch notifications here to get the true state
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      // Revert UI changes or re-fetch
    }
  }, [unreadCount, token]); // Include API_BASE_URL? No, constant.

  // Handle clicking on a notification - navigate to the linked location detail
  const handleNotificationClick = useCallback(async (notificationPayload) => {
    const locationId = notificationPayload.link;
    if (!locationId) {
      console.warn('Notification has no associated link.', notificationPayload);
      return;
    }

    // Check if the location is already in the local state
    const allItems = [...attractions, ...foodShops];
    const location = allItems.find((item) => item.id === locationId);

    if (location) {
      setSelectedItem(location);
      handleSetCurrentPage('detail');
    } else {
      // If not in state, attempt to fetch it directly as a fallback
      console.warn(`Location ${locationId} not found in local state, fetching as fallback...`);
      try {
          const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`);
          if (!response.ok) {
              if (response.status === 404) {
                 setNotification({ message: 'ไม่พบข้อมูลสถานที่ที่เชื่อมโยงกับการแจ้งเตือนนี้', type: 'error' });
              } else {
                 throw new Error(`Failed to fetch location ${locationId}`);
              }
              return; // Stop if fetch fails or is 404
          }
          const itemData = await response.json();
          if (itemData && itemData.id) {
              setSelectedItem(itemData);
              handleSetCurrentPage('detail');
          } else {
               setNotification({ message: 'ได้รับข้อมูลสถานที่ที่ไม่ถูกต้อง', type: 'error' });
          }
      } catch(error) {
          console.error("Error fetching location from notification link:", error);
          setNotification({ message: 'ไม่สามารถโหลดข้อมูลสถานที่จากการแจ้งเตือนได้', type: 'error' });
      }
    }
    setIsSidebarOpen(false); // Close sidebar after clicking notification
  }, [attractions, foodShops, setIsSidebarOpen, handleSetCurrentPage, setNotification]); // Include necessary dependencies

  // Toggle favorite status for a location
  const handleToggleFavorite = useCallback(async (locationId) => {
    if (!currentUser) {
      setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' });
      return handleSetCurrentPage('login'); // Redirect to login
    }
    const isCurrentlyFavorite = favorites.includes(locationId);
    // Optimistic UI update
    setFavorites((prev) => (isCurrentlyFavorite ? prev.filter((id) => id !== locationId) : [...prev, locationId]));

    try {
      const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationId }),
      });
      if (response.status === 401 || response.status === 403) return handleAuthError(); // Handle auth errors
      if (!response.ok) throw new Error('Failed to toggle favorite on server'); // Throw for other errors

      const data = await response.json();
      // Show success message based on server response
      setNotification({
        message: data.status === 'added' ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว',
        type: 'success',
      });
      // Optionally re-fetch favorites to ensure sync, though optimistic update might be enough
      // await fetchFavorites(token);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setNotification({ message: 'เกิดข้อผิดพลาดในการอัปเดตรายการโปรด', type: 'error' });
      // Revert optimistic update or re-fetch favorites on error
      await fetchFavorites(token);
    }
  }, [currentUser, favorites, token, handleAuthError, fetchFavorites, handleSetCurrentPage, setNotification]); // Dependencies for toggling favorite

  // Handle successful login
  const handleLogin = (userData, userToken) => {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', userToken);
    setCurrentUser(userData);
    setToken(userToken);
    fetchFavorites(userToken); // Fetch favorites for the newly logged-in user
    handleSetCurrentPage('home'); // Navigate to home
    setNotification({ message: `ยินดีต้อนรับ, ${userData.displayName || userData.username}!`, type: 'success' });
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentUser(null);
    setToken(null);
    setFavorites([]); // Clear favorites
    setNotifications([]); // Clear notifications
    setUnreadCount(0);
    setNotification({ message: 'ออกจากระบบสำเร็จ', type: 'success' });
    handleSetCurrentPage('home'); // Navigate to home
  };

  // Handle profile update from UserProfilePage
  const handleProfileUpdate = (updatedUser, newToken) => {
    setCurrentUser(updatedUser);
    // Update token only if it was actually refreshed (e.g., after password change)
    if (newToken) {
        setToken(newToken);
        localStorage.setItem('token', newToken);
    }
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setNotification({ message: 'ข้อมูลโปรไฟล์อัปเดตแล้ว!', type: 'success' });
  };

  // Callback to refresh location data (e.g., after adding/editing/deleting)
  const handleDataRefresh = useCallback(async (updatedItemId) => {
    await fetchLocations(); // Re-fetch all locations
    // If the currently viewed detail item was updated, refresh its data too
    if (updatedItemId && selectedItem?.id === updatedItemId) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/locations/${updatedItemId}`);
        if (response.ok) {
          const updatedItemData = await response.json();
          setSelectedItem(updatedItemData); // Update the detail view
        } else {
            // Handle case where item might have been deleted
             if (response.status === 404) {
                 setSelectedItem(null); // Clear selection if deleted
                 handleSetCurrentPage('home'); // Go back home
                 setNotification({message: "สถานที่นี้อาจถูกลบไปแล้ว", type: 'error'});
             }
        }
      } catch (error) {
        console.error('Failed to refresh selected item:', error);
      }
    }
  }, [fetchLocations, selectedItem, handleSetCurrentPage, setNotification]); // Include dependencies

  // Handle item update from EditLocationModal
  const handleUpdateItem = (updatedItem) => {
    // Update the item in the correct state array (attractions or foodShops)
    const updateState = (setter) =>
      setter((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));

    // Check which array the item belongs to (or assume based on category)
    const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(updatedItem.category);
    if (isFoodShop) {
        updateState(setFoodShops);
    } else {
        updateState(setAttractions);
    }

    // If the edited item is the one currently selected for detail view, update that too
    if (selectedItem?.id === updatedItem.id) {
      setSelectedItem(updatedItem);
    }
    // Close the edit modal
    setIsEditModalOpen(false);
    setItemToEdit(null);
  };

  // --- FIX: เพิ่มฟังก์ชันสำหรับยืนยันการลบ (Execute Delete) ---
  // This function is called when user confirms deletion in the modal
  const executeDelete = async () => {
      if (!itemToDelete) return; // Safety check: ensure an item ID is set
      if (!token) return handleAuthError(); // Ensure user is authenticated

      const locationId = itemToDelete;
      setItemToDelete(null); // Close the confirmation modal immediately

      try {
          const response = await fetch(`${API_BASE_URL}/api/locations/${locationId}`, {
              method: 'DELETE',
              headers: {
                  'Authorization': `Bearer ${token}` // Send auth token
              }
          });

          if (response.status === 401 || response.status === 403) {
              return handleAuthError(); // Handle auth errors (e.g., token expired, not admin)
          }

          // Status 204 No Content indicates successful deletion
          if (response.ok || response.status === 204) {
              setNotification({ message: 'ลบสถานที่สำเร็จ', type: 'success' });
              // Refresh the list of locations after successful deletion
              await fetchLocations();
              // If the deleted item was the selected detail item, clear selection and go home
              if (selectedItem?.id === locationId) {
                  setSelectedItem(null);
                  handleSetCurrentPage('home');
              }
          } else {
              // Try to parse error message from backend response
              const errorData = await response.json().catch(() => ({ error: 'เกิดข้อผิดพลาดในการลบ' }));
              throw new Error(errorData.error || `Server responded with status ${response.status}`);
          }
      } catch (error) {
          console.error('Error deleting item:', error);
          setNotification({ message: error.message || 'ไม่สามารถลบข้อมูลได้', type: 'error' });
      }
  };


  // --- Memoized Data ---
  // Memoize filtered lists to avoid recalculation on every render unless dependencies change
  const filteredAttractions = useMemo(() => {
    if (!Array.isArray(attractions)) return []; // Ensure attractions is an array
    if (selectedCategory === 'ทั้งหมด') return attractions; // Return all if 'ทั้งหมด'
    // Filter by category
    return attractions.filter((item) => item.category === selectedCategory);
  }, [attractions, selectedCategory]);

  const filteredFoodShops = useMemo(() => {
    if (!Array.isArray(foodShops)) return []; // Ensure foodShops is an array
    if (selectedCategory === 'ทั้งหมด') return foodShops; // Return all if 'ทั้งหมด'
    // Filter by category
    return foodShops.filter((item) => item.category === selectedCategory);
  }, [foodShops, selectedCategory]);

  // Memoize the list of favorite items
  const favoriteItems = useMemo(() => {
    const allItems = [...attractions, ...foodShops]; // Combine both lists
    if (!Array.isArray(favorites)) return []; // Ensure favorites is an array of IDs
    // Filter combined list based on favorite IDs
    return allItems.filter((item) => favorites.includes(item.id));
  }, [attractions, foodShops, favorites]); // Dependencies: all item lists and the favorites list

  // --- Page Rendering Logic ---
  const renderPage = () => {
    // Show loading indicator only on initial load or if user data isn't available yet
    if (loadingData && (!attractions.length || !foodShops.length)) {
      return (
        <div className="flex flex-col justify-center items-center h-96 text-gray-500 dark:text-gray-400">
          <Loader className="animate-spin h-12 w-12" />
          <p className="mt-4 text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }

    // Props common to many page components
    const commonProps = {
      handleItemClick: (item) => {
        setSelectedItem(item);
        handleSetCurrentPage('detail');
      },
      currentUser,
      favorites,
      handleToggleFavorite,
      // Propagate functions for editing and deleting to child components
      handleEditItem: (item) => {
        setItemToEdit(item);
        setIsEditModalOpen(true);
      },
      // --- FIX: handleDeleteItem now opens the confirmation modal ---
      handleDeleteItem: (locationId) => {
          setItemToDelete(locationId); // Set the ID of the item to be potentially deleted
      },
    };

    // Switch statement to render the correct page component based on `currentPage` state
    switch (currentPage) {
      case 'attractions':
        return <AttractionsPage attractions={filteredAttractions} {...commonProps} selectedCategory={selectedCategory} />;
      case 'foodshops':
        return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} selectedCategory={selectedCategory} />;
      case 'add-location':
        return <AddLocationPage setCurrentPage={handleSetCurrentPage} onLocationAdded={handleDataRefresh} setNotification={setNotification} handleAuthError={handleAuthError} />;
      case 'login':
        return <LoginPage onAuthSuccess={handleLogin} setNotification={setNotification} />;
      case 'favorites':
        return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
      case 'profile':
        return <UserProfilePage currentUser={currentUser} onProfileUpdate={handleProfileUpdate} handleAuthError={handleAuthError} handleLogout={handleLogout} setNotification={setNotification} />;
      // Admin-specific pages
      case 'manage-products':
        return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} />;
      case 'deletion-requests':
        return <ApproveDeletionsPage setNotification={setNotification} handleAuthError={handleAuthError} handleItemClick={commonProps.handleItemClick} />;
      case 'detail':
        if (selectedItem) {
          return <DetailPage item={selectedItem} setCurrentPage={handleSetCurrentPage} onReviewSubmitted={() => handleDataRefresh(selectedItem.id)} {...commonProps} setNotification={setNotification} handleAuthError={handleAuthError} />;
        }
        // Fallback: If no item is selected, redirect to home
        handleSetCurrentPage('home');
        return null;
      default: // 'home' or any other unknown page defaults to HomePage
        return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
    }
  };

  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-900 font-sans antialiased flex flex-col">
      {/* Global notification display */}
      <Notification notification={notification} setNotification={setNotification} />
      {/* Inject Sarabun font and basic animation styles */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap'); body { font-family: 'Sarabun', sans-serif; } .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* Main Header */}
      <Header
        setCurrentPage={handleSetCurrentPage}
        currentUser={currentUser}
        handleLogout={handleLogout}
        theme={theme}
        toggleTheme={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
        notifications={notifications}
        unreadCount={unreadCount}
        handleMarkNotificationsAsRead={handleMarkNotificationsAsRead}
        onNotificationClick={handleNotificationClick}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
      />

      {/* Main layout container (flex row) */}
      <div className="flex flex-1 p-4 gap-4">

        {/* Sidebar container (relative for potential sticky positioning within) */}
        <div className="relative">
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

        {/* Main Content Area (takes remaining space) */}
        <main className={`flex-1 w-0 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'filter brightness-50 md:filter-none' : ''}`}>
          {/* Content wrapper with transition */}
          <div className={`flex-1 container mx-auto transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              {renderPage()} {/* Render the active page component */}
          </div>
          {/* Footer */}
          <Footer />
        </main>
      </div>

      {/* Confirmation Modal for Deletion */}
      <ConfirmationModal
          isOpen={!!itemToDelete} // Open if itemToDelete has an ID
          onClose={() => setItemToDelete(null)} // Close by clearing the ID
          onConfirm={executeDelete} // Call the delete execution function on confirm
          title="ยืนยันการลบ"
          message="คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่นี้? การกระทำนี้ไม่สามารถย้อนกลับได้ และจะลบรีวิว, ของขึ้นชื่อ, และรายการโปรดทั้งหมดที่เกี่ยวข้องกับสถานที่นี้ด้วย"
      />

      {/* Edit Location Modal */}
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

