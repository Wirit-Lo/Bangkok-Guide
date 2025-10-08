import React from 'react';
import { Heart, MapPin, Star } from 'lucide-react';

const ItemCard = ({ item, handleItemClick, handleToggleFavorite, isFavorite }) => (
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
            {item.rating > 0 && (
                <div className="absolute top-3 left-3 bg-yellow-400 text-white text-sm font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Star size={14} fill="white" />
                    <span>{item.rating.toFixed(1)}</span>
                </div>
            )}
            <button 
                onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.id); }}
                className="absolute top-3 right-3 bg-white/80 dark:bg-gray-800/80 p-2 rounded-full transition-colors"
            >
                <Heart size={20} className={`transition-all ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-600 dark:text-gray-300'}`} />
            </button>
        </div>
        <div className="p-4 flex-grow flex flex-col">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate">{item.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex-grow truncate">{item.description}</p>
            <button 
                className="mt-4 w-full bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => handleItemClick(item)}
            >
                ดูรายละเอียด
            </button>
        </div>
    </div>
);

const FavoritesPage = ({ favoriteItems, handleItemClick, favorites, handleToggleFavorite }) => {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex items-center mb-8">
                <Heart size={32} className="text-red-500 mr-4" fill="currentColor" />
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
                    รายการโปรด
                </h1>
            </div>

            {favoriteItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {favoriteItems.map((item) => (
                        <ItemCard 
                            key={item.id} 
                            item={item}
                            handleItemClick={handleItemClick}
                            handleToggleFavorite={handleToggleFavorite}
                            isFavorite={favorites.includes(item.id)}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 px-4 bg-white dark:bg-gray-800 rounded-2xl">
                    <Heart size={48} className="mx-auto text-gray-400 dark:text-gray-500" />
                    <h3 className="mt-4 text-xl font-semibold text-gray-800 dark:text-gray-100">คุณยังไม่มีรายการโปรด</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                        กดรูปหัวใจเพื่อบันทึกสถานที่ที่น่าสนใจไว้ที่นี่
                    </p>
                </div>
            )}
        </div>
    );
};

export default FavoritesPage;
