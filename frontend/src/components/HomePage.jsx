import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, Star, Heart, Edit, Trash2 } from 'lucide-react';

// --- Reusable Card Component (MODIFIED for Admin & Rating Display) ---
const FeaturedCard = ({ 
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

  // --- FIX 2 (IMPROVED): แปลงและจำกัดค่า rating ---
  // บรรทัดนี้จะป้องกันไม่ให้คะแนนแสดงผลเกิน 5 และจัดการค่าที่ไม่มี
  const displayRating = Math.max(0, Math.min(5, parseFloat(item.rating || 0)));

  // --- FIX 3: ตรวจสอบว่ามีคะแนนจริงหรือไม่ก่อนแสดงผล ---
  // เราจะแสดงป้ายคะแนนก็ต่อเมื่อมี rating ที่เป็นค่าบวกเท่านั้น (ไม่มีการรีวิว = 0 หรือ null)
  const hasRating = item.rating !== null && item.rating !== undefined && parseFloat(item.rating) > 0;

  const isFavorite = useMemo(() => Array.isArray(favorites) && favorites.includes(item.id), [favorites, item.id]);

  const onFavoriteClick = (e) => {
    e.stopPropagation();
    handleToggleFavorite(item.id);
  };

  // NEW HANDLERS for Admin buttons
  const onEditClick = (e) => {
    e.stopPropagation();
    handleEditItem(item);
  };

  const onDeleteClick = (e) => {
    e.stopPropagation();
    handleDeleteItem(item.id);
  };

  return (
    <div 
      className="group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform hover:-translate-y-2 transition-all duration-300"
      onClick={() => handleItemClick(item)}
    >
      <img 
        src={item.imageUrl || 'https://placehold.co/400x500/cccccc/333333?text=Image'} 
        alt={item.name}
        className="w-full h-64 object-cover transition-transform duration-300 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
      
      {/* --- MODIFIED: Conditional Rendering for bottom content --- */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {currentUser && currentUser.role === 'admin' ? (
          // VIEW FOR ADMIN
          <div className="flex items-center justify-between space-x-2">
            <button
              onClick={onEditClick}
              className="flex items-center justify-center w-full bg-yellow-500 text-white font-bold py-2 px-3 rounded-lg text-center hover:bg-yellow-600 transition-colors text-sm"
            >
              <Edit size={16} className="mr-2" />
              แก้ไข
            </button>
            <button
              onClick={onDeleteClick}
              className="flex items-center justify-center w-full bg-red-600 text-white font-bold py-2 px-3 rounded-lg text-center hover:bg-red-700 transition-colors text-sm"
            >
              <Trash2 size={16} className="mr-2" />
              ลบ
            </button>
          </div>
        ) : (
          // VIEW FOR REGULAR USERS
          <div className="text-white">
            <h3 className="text-xl font-bold">{item.name}</h3>
            <p className="text-sm opacity-90 line-clamp-2">{item.description}</p>
          </div>
        )}
      </div>

      {/* --- FIX 4: ใช้ displayRating และเงื่อนไข hasRating --- */}
      {hasRating && (
        <div className="absolute top-3 left-3 bg-yellow-400 text-black px-2 py-1 rounded-full text-sm font-bold flex items-center shadow-lg">
            <Star size={14} className="mr-1" fill="black" />
            <span>{displayRating.toFixed(1)}</span>
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
  );
};

// --- รูปภาพสำหรับ Slider ---
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
  // NEW PROPS
  handleEditItem,
  handleDeleteItem
}) => {
  // --- State และ Effect สำหรับจัดการ Image Slider ---
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % heroImages.length);
    }, 5000); // เปลี่ยนรูปทุก 5 วินาที
    return () => clearInterval(timer);
  }, []);

  const featuredAttractions = useMemo(() => 
    [...(attractions || [])].sort(() => 0.5 - Math.random()).slice(0, 4), 
    [attractions]
  );
  
  const featuredFoodShops = useMemo(() => 
    [...(foodShops || [])].sort(() => 0.5 - Math.random()).slice(0, 4), 
    [foodShops]
  );

  return (
    <div className="space-y-12">
      
      {/* --- Hero Section --- */}
      <div className="relative h-96 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center text-center text-white p-6">
        {heroImages.map((src, index) => (
            <img 
              key={src}
              src={src}
              alt="Bang Khen Scenery"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
            />
        ))}
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 animate-fade-in-up">
          <h1 
            className="text-5xl md:text-7xl font-extrabold leading-tight" 
            style={{ textShadow: '0 3px 6px rgba(0,0,0,0.5)' }}
          >
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              สำรวจกรุงเทพฯ
            </span>
            <br/>
            <span className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              ในมุมมองใหม่
            </span>
          </h1>
          <p 
            className="mt-4 text-lg md:text-xl max-w-2xl mx-auto animate-fade-in-up" 
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)', animationDelay: '0.6s' }}
          >
            ค้นพบเสน่ห์ที่ซ่อนอยู่ ตั้งแต่สถานที่ทางประวัติศาสตร์ไปจนถึงคาเฟ่สุดชิค
          </p>
        </div>
      </div>

      {/* --- Featured Attractions Section --- */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">สถานที่ท่องเที่ยวยอดนิยม</h2>
          <button 
            onClick={() => setCurrentPage('attractions')}
            className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-colors"
          >
            ดูทั้งหมด <ArrowRight size={16} className="ml-1" />
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
              // Pass admin handlers
              handleEditItem={handleEditItem}
              handleDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      </div>
      
      {/* --- Featured Food Shops Section --- */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">ร้านอาหารห้ามพลาด</h2>
          <button 
            onClick={() => setCurrentPage('foodshops')}
            className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-colors"
          >
            ดูทั้งหมด <ArrowRight size={16} className="ml-1" />
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
              // Pass admin handlers
              handleEditItem={handleEditItem}
              handleDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
