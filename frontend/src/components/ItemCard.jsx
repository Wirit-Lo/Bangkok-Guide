import React from 'react';
import { Star, Heart, Edit, Trash2 } from 'lucide-react';

const ItemCard = ({ 
  item, 
  handleItemClick, 
  currentUser, 
  favorites, 
  handleToggleFavorite,
  // --- NEW PROPS for Admin actions ---
  handleEditItem, 
  handleDeleteItem 
}) => {
  const isFavorite = favorites && favorites.includes(item.id);

  const onFavoriteClick = (e) => {
    e.stopPropagation(); // ป้องกัน event bubbling
    handleToggleFavorite(item.id);
  };

  // --- NEW HANDLERS for Admin buttons ---
  const onEditClick = (e) => {
    e.stopPropagation(); // ป้องกัน event bubbling
    handleEditItem(item); // ส่งข้อมูล item ทั้งหมดกลับไป
  };

  const onDeleteClick = (e) => {
    e.stopPropagation(); // ป้องกัน event bubbling
    handleDeleteItem(item.id); // ส่งแค่ ID กลับไปเพื่อลบ
  };


  return (
    <div 
      className="bg-white rounded-xl shadow-md overflow-hidden transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
      onClick={() => handleItemClick(item)}
    >
      <div className="relative">
        <img className="w-full h-48 object-cover" src={item.imageUrl || 'https://placehold.co/400x300/cccccc/333333?text=Image'} alt={item.name} />
        {item.rating > 0 && (
          <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold flex items-center shadow-lg">
            <Star size={14} className="mr-1" fill="black" />
            <span>{item.rating.toFixed(1)}</span>
          </div>
        )}
        {currentUser && (
          <button
            onClick={onFavoriteClick}
            className="absolute top-3 right-3 bg-white/80 p-2 rounded-full text-red-500 hover:bg-white transition-colors"
            title={isFavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
          >
            <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <div className="font-bold text-xl mb-2 text-gray-800 truncate">{item.name}</div>
        <p className="text-gray-600 text-base line-clamp-3 flex-grow">{item.description}</p>
        
        {/* --- MODIFIED: Conditional Rendering for Admin Controls --- */}
        <div className="mt-4">
          {currentUser && currentUser.role === 'admin' ? (
            // <<< VIEW FOR ADMIN
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
            // <<< VIEW FOR REGULAR USERS
            <div className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg text-center">
              ดูรายละเอียด
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
