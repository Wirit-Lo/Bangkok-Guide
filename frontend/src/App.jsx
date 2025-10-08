import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import EditLocationModal from './components/EditLocationModal'; 

// Import Pages (which are also in the components folder)
import HomePage from './components/HomePage';
import AttractionsPage from './components/AttractionsPage';
import FoodShopsPage from './components/FoodShopsPage';
import DetailPage from './components/DetailPage';
import AddLocationPage from './components/AddLocationPage';
import LoginPage from './components/LoginPage';
import FavoritesPage from './components/FavoritesPage';
import UserProfilePage from './components/UserProfilePage';
import ManageProductsPage from './components/ManageProductsPage';
import ApproveDeletionsPage from './components/ApproveDeletionsPage';

import { CheckCircle, XCircle, Loader } from 'lucide-react';

// --- Notification Component ---
const Notification = ({ notification, setNotification }) => {
    if (!notification.message) return null;

    const baseStyle = "fixed top-5 right-5 z-[100] flex items-center p-4 rounded-lg shadow-xl text-white transition-all duration-300 transform";
    const typeStyle = notification.type === 'success' 
        ? "bg-gradient-to-r from-green-500 to-teal-500" 
        : "bg-gradient-to-r from-red-500 to-orange-500";

    return (
        <div className={`${baseStyle} ${typeStyle} animate-fade-in-up`}>
            {notification.type === 'success' ? <CheckCircle className="mr-3" /> : <XCircle className="mr-3" />}
            <span>{notification.message}</span>
            <button onClick={() => setNotification({ message: '', type: '' })} className="ml-4 opacity-80 hover:opacity-100">&times;</button>
        </div>
    );
};


// Main App Component
const App = () => {
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
    const [currentUser, setCurrentUser] = useState(null);
    const [favorites, setFavorites] = useState([]);
    const [attractions, setAttractions] = useState([]);
    const [foodShops, setFoodShops] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [dataError, setDataError] = useState(null);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);
    
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const handleAuthError = useCallback(() => {
        setNotification({ message: 'เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง', type: 'error' });
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setCurrentPage('login');
    }, []);

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    useEffect(() => {
        if (notification.message) {
            const timer = setTimeout(() => {
                setNotification({ message: '', type: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchLocations = useCallback(async () => {
        setDataError(null);
        try {
            const attractionsResponse = await fetch('http://localhost:5000/api/attractions');
            if (!attractionsResponse.ok) throw new Error('Failed to fetch attractions');
            const attractionsData = await attractionsResponse.json();
            setAttractions(attractionsData);

            const foodShopsResponse = await fetch('http://localhost:5000/api/foodShops');
            if (!foodShopsResponse.ok) throw new Error('Failed to fetch food shops');
            const foodShopsData = await foodShopsResponse.json();
            setFoodShops(foodShopsData);

        } catch (error) {
            console.error("Error fetching data from backend:", error);
            setDataError("ไม่สามารถโหลดข้อมูลจาก Backend ได้");
        } finally {
            setLoadingData(false);
        }
    }, []);

    const fetchFavorites = useCallback(async () => {
        if (!currentUser) {
            setFavorites([]);
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch(`http://localhost:5000/api/favorites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 403) {
                handleAuthError();
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server responded with ${response.status}`);
            }
            
            const data = await response.json();
            if (Array.isArray(data)) {
                setFavorites(data);
            } else {
                setFavorites([]);
            }
            
        } catch (error) {
            console.error("Error fetching favorites:", error.message);
            setFavorites([]);
        }
    }, [currentUser, handleAuthError]);

    useEffect(() => {
        setLoadingData(true);
        fetchLocations();
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            try {
                setCurrentUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user from localStorage", e);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
    }, [fetchLocations]);

    useEffect(() => {
        fetchFavorites();
    }, [currentUser, fetchFavorites]);
    
    useEffect(() => {
        if (!currentUser) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) return;
        
        const fetchNotifications = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/notifications', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Could not fetch notifications');
                const data = await response.json();
                setNotifications(data);
                setUnreadCount(data.filter(n => !n.is_read).length);
            } catch (error) {
                console.error(error);
            }
        };
        fetchNotifications();

        const eventSource = new EventSource(`http://localhost:5000/api/events?token=${token}`);
        eventSource.onopen = () => console.log("SSE Connection established.");

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (['new_location', 'new_product', 'new_like', 'new_reply'].includes(data.type)) {
                const newNotification = {
                    id: crypto.randomUUID(),
                    actor_name: data.actorName,
                    type: data.type,
                    payload: {
                        location: data.location,
                        product: data.product,
                        comment: data.comment
                    },
                    is_read: 0,
                    created_at: new Date().toISOString(),
                };

                setNotifications(prev => [newNotification, ...prev].slice(0, 20));
                setUnreadCount(prev => prev + 1);
                if (data.type === 'new_location') {
                     fetchLocations();
                }
            }
        };

        eventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            eventSource.close();
        };

        return () => {
            console.log("Closing SSE Connection.");
            eventSource.close();
        };
    }, [currentUser, fetchLocations]);

    const handleMarkNotificationsAsRead = useCallback(async () => {
        if (unreadCount === 0) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            await fetch('http://localhost:5000/api/notifications/read', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        } catch (error) {
            console.error("Failed to mark notifications as read:", error);
        }
    }, [unreadCount]);

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
            handleSetCurrentPage('login');
            return;
        }
        
        const token = localStorage.getItem('token');
        const isCurrentlyFavorite = favorites.includes(locationId);
        setFavorites(prev => isCurrentlyFavorite ? prev.filter(id => id !== locationId) : [...prev, locationId]);

        try {
            const response = await fetch('http://localhost:5000/api/favorites/toggle', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ locationId }),
            });
            if (response.status === 403) {
                handleAuthError();
                return;
            }
            const data = await response.json();
            setNotification({ message: data.status === 'added' ? 'เพิ่มในรายการโปรดแล้ว' : 'ลบออกจากรายการโปรดแล้ว', type: 'success' });
            fetchFavorites(); 
        } catch (error) {
            console.error("Error toggling favorite:", error);
            fetchFavorites();
        }
    }, [currentUser, favorites, fetchFavorites, handleAuthError]);

    const handleItemClick = (item) => {
        setSelectedItem(item);
        handleSetCurrentPage('detail');
    };

    const handleAuthSuccess = (userData, token) => {
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        setCurrentUser(userData);
        handleSetCurrentPage('home');
        setNotification({ message: `ยินดีต้อนรับ, ${userData.displayName || userData.username}!`, type: 'success' });
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setCurrentUser(null);
        setNotification({ message: 'ออกจากระบบสำเร็จ', type: 'success' });
        handleSetCurrentPage('home');
    };

    const handleProfileUpdate = (updatedUserData, newToken) => {
        setCurrentUser(updatedUserData);
        localStorage.setItem('user', JSON.stringify(updatedUserData));
        if (newToken) {
            localStorage.setItem('token', newToken);
        }
        setNotification({ message: 'อัปเดตโปรไฟล์สำเร็จ!', type: 'success' });
    };

    const handleDeleteItem = async (itemIdToDelete) => {
        const token = localStorage.getItem('token');
        if (!token) {
            return handleAuthError();
        }

        if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้อย่างถาวร?')) {
            try {
                const response = await fetch(`http://localhost:5000/api/locations/${itemIdToDelete}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                });

                if (response.status === 403) {
                    handleAuthError();
                    return;
                }
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'ไม่สามารถลบข้อมูลได้');
                }

                setNotification({ message: 'ลบข้อมูลสำเร็จ!', type: 'success' });
                fetchLocations(); 

            } catch (error) {
                console.error('Error deleting item:', error);
                setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' });
            }
        }
    };

    const handleEditItem = (item) => {
        setItemToEdit(item);
        setIsEditModalOpen(true);
    };
    
    const handleUpdateItem = (updatedItem) => {
        if (updatedItem.type === 'attraction') {
            setAttractions(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        } else {
            setFoodShops(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
        }
        
        if (selectedItem && selectedItem.id === updatedItem.id) {
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
        if (loadingData) {
            return (
                <div className="flex flex-col justify-center items-center h-96 text-gray-500 dark:text-gray-400">
                    <Loader className="animate-spin h-12 w-12 text-blue-500" />
                    <p className="mt-4 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            );
        }

        if (dataError) {
            return <div className="text-center p-8 text-red-600">{dataError}</div>;
        }

        const commonProps = {
            handleItemClick,
            currentUser,
            favorites,
            handleToggleFavorite,
            handleEditItem,
            handleDeleteItem,
        };

        switch (currentPage) {
            case 'home':
                return <HomePage attractions={attractions} foodShops={foodShops} setCurrentPage={handleSetCurrentPage} {...commonProps} />;
            case 'attractions':
                return <AttractionsPage attractions={filteredAttractions} {...commonProps} />;
            case 'foodshops':
                return <FoodShopsPage foodShops={filteredFoodShops} {...commonProps} />;
            case 'add-location':
                return <AddLocationPage 
                            setCurrentPage={handleSetCurrentPage} 
                            onLocationAdded={fetchLocations} 
                            setNotification={setNotification}
                            handleAuthError={handleAuthError}
                        />;
            case 'login':
                return <LoginPage onAuthSuccess={handleAuthSuccess} setNotification={setNotification} />;
            case 'favorites':
                return <FavoritesPage favoriteItems={favoriteItems} {...commonProps} />;
            case 'profile':
                return <UserProfilePage 
                            currentUser={currentUser} 
                            onProfileUpdate={handleProfileUpdate} 
                            handleAuthError={handleAuthError} 
                            handleLogout={handleLogout}
                            setNotification={setNotification}
                        />;
            case 'manage-products':
                return <ManageProductsPage setNotification={setNotification} handleAuthError={handleAuthError} />;
            
            case 'deletion-requests':
                return <ApproveDeletionsPage 
                            setNotification={setNotification} 
                            handleAuthError={handleAuthError}
                            handleItemClick={handleItemClick}
                        />;

            case 'detail':
                if (selectedItem) {
                    return (
                        <DetailPage
                            item={selectedItem}
                            setCurrentPage={handleSetCurrentPage}
                            onReviewSubmitted={fetchLocations}
                            handleItemClick={handleItemClick}
                            currentUser={currentUser}
                            favorites={favorites}
                            handleToggleFavorite={handleToggleFavorite}
                            handleEditItem={handleEditItem}
                            setNotification={setNotification}
                            handleAuthError={handleAuthError}
                        />
                    );
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
            
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap'); body { font-family: 'Sarabun', sans-serif; } .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; opacity: 0; transform: translateY(20px); } @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            <Header 
                currentPage={currentPage}
                setCurrentPage={handleSetCurrentPage} 
                currentUser={currentUser}
                handleLogout={handleLogout}
                theme={theme}
                toggleTheme={toggleTheme}
                notifications={notifications}
                unreadCount={unreadCount}
                handleMarkNotificationsAsRead={handleMarkNotificationsAsRead}
                handleItemClick={handleItemClick}
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

