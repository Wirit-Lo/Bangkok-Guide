import React, { useState, useMemo } from 'react';
import { Star, Heart, Edit, Trash2, List, TrendingUp, MapPin } from 'lucide-react';

// --- Reusable Card Component (MODIFIED for Rating Display & Admin) ---
const ItemCard = ({ 
    item, 
    handleItemClick, 
    handleToggleFavorite, 
    isFavorite, 
    currentUser, 
    handleEditItem, 
    handleDeleteItem 
}) => {
    
    // --- FIX 1 (IMPROVED): แปลงและจำกัดค่า rating ---
    // บรรทัดนี้จะป้องกันไม่ให้คะแนนแสดงผลเกิน 5 และจัดการค่าที่ไม่มี
    const displayRating = Math.max(0, Math.min(5, parseFloat(item.rating || 0)));

    // --- FIX 2: ตรวจสอบว่ามีคะแนนจริงหรือไม่ก่อนแสดงผล ---
    // เราจะแสดงป้ายคะแนนก็ต่อเมื่อมี rating ที่เป็นค่าบวกเท่านั้น
    const hasRating = item.rating !== null && item.rating !== undefined && parseFloat(item.rating) > 0;

    // Handlers for admin buttons
    const onEditClick = (e) => {
        e.stopPropagation(); // Prevent card click
        handleEditItem(item);
    };

    const onDeleteClick = (e) => {
        e.stopPropagation(); // Prevent card click
        handleDeleteItem(item.id);
    };
    
    return (
        <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
            onClick={() => handleItemClick(item)}
        >
            <div className="relative">
                <img 
                    src={item.imageUrl || 'https://placehold.co/400x300/e2e8f0/64748b?text=Image'} 
                    alt={item.name}
                    className="w-full h-48 object-cover"
                />
                {/* --- FIX 3: ใช้ displayRating และเงื่อนไข hasRating --- */}
                {hasRating && (
                    <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold flex items-center shadow-lg">
                        <Star size={14} className="mr-1" fill="black" />
                        <span>{displayRating.toFixed(1)}</span>
                    </div>
                )}
                {currentUser && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                        className="absolute top-3 right-3 bg-white/80 dark:bg-gray-800/80 p-2 rounded-full transition-colors"
                    >
                        <Heart size={20} className={`transition-all ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-600 dark:text-gray-300'}`} />
                    </button>
                )}
            </div>
            <div className="p-4 flex-grow flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate">{item.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-grow truncate">{item.description}</p>

                {/* --- Conditional rendering for Admin Controls --- */}
                {currentUser && currentUser.role === 'admin' ? (
                    <div className="mt-4 flex gap-2">
                        <button 
                            className="w-full bg-yellow-500 text-white font-semibold py-2 rounded-lg hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                            onClick={onEditClick}
                        >
                            <Edit size={16} /> แก้ไข
                        </button>
                        <button 
                            className="w-full bg-red-600 text-white font-semibold py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                            onClick={onDeleteClick}
                        >
                            <Trash2 size={16} /> ลบ
                        </button>
                    </div>
                ) : (
                    <button 
                        className="mt-4 w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() => handleItemClick(item)}
                    >
                        ดูรายละเอียด
                    </button>
                )}
            </div>
        </div>
    );
};

const AttractionsPage = ({ 
    attractions, 
    handleItemClick, 
    favorites, 
    handleToggleFavorite, 
    currentUser, 
    handleEditItem, 
    handleDeleteItem 
}) => {
    const [sortOrder, setSortOrder] = useState('default'); // 'default' or 'rating'

    const sortedAttractions = useMemo(() => {
        let sorted = [...attractions];
        if (sortOrder === 'rating') {
            sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
        return sorted;
    }, [attractions, sortOrder]);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white">สถานที่ท่องเที่ยวในเขตบางเขน</h1>
                
                {/* Sort Buttons */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-full">
                    <button
                        onClick={() => setSortOrder('default')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                            sortOrder === 'default' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        <List size={16} />
                        ทั้งหมด
                    </button>
                    <button
                        onClick={() => setSortOrder('rating')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                            sortOrder === 'rating' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                        <TrendingUp size={16} />
                        ยอดนิยม
                    </button>
                </div>
            </div>

            {sortedAttractions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sortedAttractions.map((item) => (
                        <ItemCard 
                            key={item.id} 
                            item={item} 
                            handleItemClick={handleItemClick}
                            handleToggleFavorite={handleToggleFavorite}
                            isFavorite={favorites.includes(item.id)}
                            // --- Pass admin props down to ItemCard ---
                            currentUser={currentUser}
                            handleEditItem={handleEditItem}
                            handleDeleteItem={handleDeleteItem}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 px-4 bg-white dark:bg-gray-800 rounded-2xl">
                    <MapPin size={48} className="mx-auto text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100">ไม่พบสถานที่ท่องเที่ยว</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                        ยังไม่มีข้อมูลสถานที่ท่องเที่ยวในหมวดหมู่นี้
                    </p>
                </div>
            )}
        </div>
    );
};

export default AttractionsPage;

