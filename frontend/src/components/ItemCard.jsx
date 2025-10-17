import React, { memo, useMemo } from 'react'; // <<< FIX 1: Import memo
import { Star, Heart, Edit, Trash2 } from 'lucide-react';

// <<< FIX 1 (PERFORMANCE): Wrap component in memo >>>
const ItemCard = memo(({
    item,
    handleItemClick,
    currentUser,
    favorites,
    handleToggleFavorite,
    handleEditItem,
    handleDeleteItem
}) => {
    // --- FIX 1: ป้องกัน Error หาก 'item' ไม่มีข้อมูล ---
    if (!item) {
        return null;
    }

    // --- FIX 2: ตรวจสอบให้แน่ใจว่า 'favorites' เป็น Array ก่อนใช้งาน ---
    const isFavorite = Array.isArray(favorites) ? favorites.includes(item.id) : false;

    // --- FIX 3 (IMPROVED & FINAL): แปลง rating, จำกัดค่าให้อยู่ในช่วง 0-5, และจัดการค่าที่ไม่มี ---
    const displayRating = Math.max(0, Math.min(5, parseFloat(item.rating || 0)));

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

    // <<< FIX 2 (A11Y): Add keyboard handler for clickable card >>>
    const handleCardKeyDown = (e) => {
        if (handleItemClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault(); // Prevent space from scrolling page
            handleItemClick(item);
        }
    };

    return (
        <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
            onClick={() => handleItemClick && handleItemClick(item)}
            // <<< FIX 2 (A11Y): Add accessibility attributes >>>
            role="button"
            tabIndex={0}
            onKeyDown={handleCardKeyDown}
        >
            <div className="relative">
                <img className="w-full h-48 object-cover" src={item.imageUrl || 'https://placehold.co/400x300/cccccc/333333?text=Image'} alt={item.name || 'Location Image'} />

                {/* --- FIX 4: Use displayRating for display --- */}
                {/* Show rating badge only if rating data exists */}
                {item.rating !== null && item.rating !== undefined && (
                    <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold flex items-center shadow-lg">
                        <Star size={14} className="mr-1" fill="black" />
                        <span>{displayRating.toFixed(1)}</span>
                    </div>
                )}

                {currentUser && (
                    <button
                        onClick={onFavoriteClick}
                        className="absolute top-3 right-3 bg-white/80 p-2 rounded-full text-red-500 hover:bg-white transition-colors"
                        // <<< FIX 3 (A11Y): Use aria-label instead of title >>>
                        aria-label={isFavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
                    >
                        <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                )}
            </div>
            <div className="p-6 flex flex-col flex-grow">
                <div className="font-bold text-xl mb-2 text-gray-800 dark:text-gray-100 truncate">{item.name || 'ไม่มีชื่อ'}</div>
                <p className="text-gray-600 dark:text-gray-300 text-base line-clamp-3 flex-grow">{item.description || 'ไม่มีคำอธิบาย'}</p>

                <div className="mt-4">
                    {currentUser && currentUser.role === 'admin' ? (
                        <div className="flex items-center justify-between space-x-2">
                            <button
                                onClick={onEditClick}
                                className="flex items-center justify-center w-full bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg text-center hover:bg-yellow-600 transition-colors"
                            >
                                <Edit size={16} className="mr-2" />
                                แก้ไข
                            </button>
                            <button
                                onClick={onDeleteClick}
                                className="flex items-center justify-center w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg text-center hover:bg-red-700 transition-colors"
                            >
                                <Trash2 size={16} className="mr-2" />
                                ลบ
                            </button>
                        </div>
                    ) : (
                        // <<< FIX 4 (SEMANTICS/A11Y): Change div to button >>>
                        <button
                            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-center hover:bg-blue-700 transition-colors"
                            // Prevent event propagation if the card itself handles the click
                             onClick={(e) => { e.stopPropagation(); if (handleItemClick) handleItemClick(item); }}
                        >
                            ดูรายละเอียด
                        </button>
                        // <<< END FIX 4 >>>
                    )}
                </div>
            </div>
        </div>
    );
}); // <<< END FIX 1 (memo) >>>

export default ItemCard;