import React, { useState, useEffect, useMemo, memo } from 'react';
import { ArrowRight, Star, Heart, Edit, Trash2, Search, X } from 'lucide-react';

// --- Reusable Card Component (กลับไปใช้ดีไซน์เดิม: รูป h-64 + เนื้อหาด้านล่าง) ---
const FeaturedCard = memo(({
    item,
    handleItemClick,
    currentUser,
    favorites,
    handleToggleFavorite,
    handleEditItem,
    handleDeleteItem
}) => {
    if (!item) return null;

    const displayRating = Math.max(0, Math.min(5, parseFloat(item.rating || 0)));
    const hasRating = item.rating !== null && item.rating !== undefined && parseFloat(item.rating) > 0;
    const isFavorite = useMemo(() => Array.isArray(favorites) && favorites.includes(item.id), [favorites, item.id]);

    const onFavoriteClick = (e) => {
        e.stopPropagation();
        handleToggleFavorite(item.id);
    };

    const onEditClick = (e) => {
        e.stopPropagation();
        handleEditItem(item);
    };

    const onDeleteClick = (e) => {
        e.stopPropagation();
        handleDeleteItem(item.id);
    };

    const handleCardKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleItemClick(item);
        }
    };

    return (
        <div
            className="group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform hover:-translate-y-2 transition-all duration-300 h-full flex flex-col bg-white dark:bg-gray-800"
            onClick={() => handleItemClick(item)}
            role="button"
            tabIndex={0}
            onKeyDown={handleCardKeyDown}
        >
            {/* ส่วนรูปภาพ (h-64 ตามเดิม) */}
            <div className="relative h-64 overflow-hidden">
                <img
                    src={item.imageUrl || 'https://placehold.co/400x500/cccccc/333333?text=Image'}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>
                
                {/* Rating Badge */}
                {hasRating && (
                    <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-full text-xs font-bold flex items-center shadow-md">
                        <Star size={12} className="mr-1 fill-black" />
                        <span>{displayRating.toFixed(1)}</span>
                    </div>
                )}

                {/* Favorite Button */}
                {currentUser && (
                    <button
                        onClick={onFavoriteClick}
                        className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm p-2 rounded-full text-white hover:bg-white hover:text-red-500 transition-all duration-200"
                        aria-label={isFavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
                    >
                        <Heart size={18} className={isFavorite ? "fill-red-500 text-red-500" : ""} />
                    </button>
                )}
            </div>

            {/* ส่วนเนื้อหา (แยกออกมาอยู่ด้านล่าง ตามเดิม) */}
            <div className="flex-1 p-4 flex flex-col justify-end relative">
                {currentUser && currentUser.role === 'admin' ? (
                    <div className="space-y-3">
                         <h3 className="text-xl font-bold text-gray-800 dark:text-white line-clamp-1">{item.name}</h3>
                         <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={onEditClick}
                                className="flex-1 flex items-center justify-center bg-yellow-500 text-white font-bold py-2 px-2 rounded-lg hover:bg-yellow-600 transition-colors text-sm"
                            >
                                <Edit size={14} className="mr-1" /> แก้ไข
                            </button>
                            <button
                                onClick={onDeleteClick}
                                className="flex-1 flex items-center justify-center bg-red-600 text-white font-bold py-2 px-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
                            >
                                <Trash2 size={14} className="mr-1" /> ลบ
                            </button>
                        </div>
                    </div>
                ) : (
                    // User View: แสดงชื่อและคำอธิบาย (ปรับสีตัวอักษรให้เข้ากับพื้นหลังขาว/ดำ)
                    <div className="text-gray-800 dark:text-white">
                         <h3 className="text-xl font-bold mb-1 line-clamp-1">{item.name}</h3>
                         <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{item.description}</p>
                    </div>
                )}
            </div>
        </div>
    );
});

// --- Image URLs for Slider ---
const heroImages = [
    "https://dltv.ac.th/upload/data/tv/45/logo.png",
    "https://thaipublica.org/wp-content/uploads/2023/12/Thaipublica_ttb-%E0%B9%84%E0%B8%97%E0%B8%A2%E0%B9%80%E0%B8%97%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B8%A7%E0%B9%84%E0%B8%97%E0%B8%A22-scaled.jpg",
    "https://image.bangkokbiznews.com/uploads/images/md/2021/10/2JXqqbp8c1iKn5Dbrh5E.jpg"
];

const HomePage = ({
    attractions,
    foodShops,
    handleItemClick,
    setCurrentPage,
    currentUser,
    favorites,
    handleToggleFavorite,
    handleEditItem,
    handleDeleteItem,
    // ✅ รับ Props Search เพื่อใช้ในการสลับหน้า
    searchTerm,
    setSearchTerm
}) => {
    // --- Slider Logic ---
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImageIndex(prevIndex => (prevIndex + 1) % heroImages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    // --- Search Logic (ยังคงไว้เพื่อให้ค้นหาได้) ---
    const allItems = useMemo(() => [...(attractions || []), ...(foodShops || [])], [attractions, foodShops]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const lowerTerm = searchTerm.toLowerCase();
        return allItems.filter(item => 
            item.name?.toLowerCase().includes(lowerTerm) || 
            item.description?.toLowerCase().includes(lowerTerm) ||
            item.category?.toLowerCase().includes(lowerTerm)
        );
    }, [searchTerm, allItems]);

    // --- Featured Logic (สำหรับหน้าปกติ) ---
    const featuredAttractions = useMemo(() =>
        [...(attractions || [])].sort(() => 0.5 - Math.random()).slice(0, 4),
        [attractions]
    );

    const featuredFoodShops = useMemo(() =>
        [...(foodShops || [])].sort(() => 0.5 - Math.random()).slice(0, 4),
        [foodShops]
    );

    return (
        <div className="space-y-12 pb-12">
            
            {/* --- Hero Section (แสดงเฉพาะตอนไม่ได้ค้นหา) --- */}
            {!searchTerm && (
                <div className="relative h-[450px] rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center text-center text-white p-6 group">
                    {heroImages.map((src, index) => (
                        <img
                            key={src}
                            src={src}
                            alt="Bang Khen Scenery"
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
                        />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60"></div>
                    
                    <div className="relative z-10 w-full max-w-3xl animate-fade-in-up flex flex-col items-center">
                        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-2" style={{ textShadow: '0 4px 10px rgba(0,0,0,0.6)' }}>
                            <span className="bg-gradient-to-r from-white via-blue-100 to-blue-200 bg-clip-text text-transparent">
                                สำรวจกรุงเทพฯ
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl font-light text-gray-100 mb-8 drop-shadow-md">
                            ในมุมมองใหม่ที่คุณไม่เคยเห็น
                        </p>
                    </div>
                </div>
            )}

            {/* --- Content Switcher: Search Results vs Default View --- */}
            {searchTerm ? (
                // 🔍 View: Search Results (แสดงผลลัพธ์การค้นหา)
                <div className="animate-fade-in-up min-h-[400px]">
                    <div className="flex items-center justify-between mb-6 px-2">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Search className="text-blue-500" />
                            ผลลัพธ์การค้นหา: <span className="text-blue-600">"{searchTerm}"</span>
                        </h2>
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1 font-medium bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full transition-colors"
                        >
                            <X size={14} /> ล้างคำค้นหา
                        </button>
                    </div>

                    {searchResults.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {searchResults.map(item => (
                                <FeaturedCard
                                    key={item.id}
                                    item={item}
                                    handleItemClick={handleItemClick}
                                    currentUser={currentUser}
                                    favorites={favorites}
                                    handleToggleFavorite={handleToggleFavorite}
                                    handleEditItem={handleEditItem}
                                    handleDeleteItem={handleDeleteItem}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                            <Search size={64} className="text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-xl font-bold text-gray-600 dark:text-gray-300">ไม่พบข้อมูลที่ตรงกัน</h3>
                            <p className="text-gray-500 dark:text-gray-400 mt-2">ลองใช้คำค้นหาอื่น หรือตรวจสอบตัวสะกด</p>
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="mt-6 px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-500/30"
                            >
                                ดูรายการแนะนำทั้งหมด
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // 🏠 View: Default (ดีไซน์เดิม แสดง 2 หมวดหมู่)
                <>
                    <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-gray-800 dark:text-white border-l-4 border-blue-500 pl-3">
                                สถานที่ท่องเที่ยวยอดนิยม
                            </h2>
                            <button
                                onClick={() => setCurrentPage('attractions')}
                                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-colors group"
                            >
                                ดูทั้งหมด <ArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {featuredAttractions.map(item => (
                                <FeaturedCard
                                    key={item.id}
                                    item={item}
                                    handleItemClick={handleItemClick}
                                    currentUser={currentUser}
                                    favorites={favorites}
                                    handleToggleFavorite={handleToggleFavorite}
                                    handleEditItem={handleEditItem}
                                    handleDeleteItem={handleDeleteItem}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold text-gray-800 dark:text-white border-l-4 border-orange-500 pl-3">
                                ร้านอาหารห้ามพลาด
                            </h2>
                            <button
                                onClick={() => setCurrentPage('foodshops')}
                                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-colors group"
                            >
                                ดูทั้งหมด <ArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {featuredFoodShops.map(item => (
                                <FeaturedCard
                                    key={item.id}
                                    item={item}
                                    handleItemClick={handleItemClick}
                                    currentUser={currentUser}
                                    favorites={favorites}
                                    handleToggleFavorite={handleToggleFavorite}
                                    handleEditItem={handleEditItem}
                                    handleDeleteItem={handleDeleteItem}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default HomePage;