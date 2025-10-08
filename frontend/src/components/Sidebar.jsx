import React from 'react';
import { 
  LayoutGrid, Landmark, Coffee, ShoppingBag, Utensils, ListFilter, 
  User, Heart, LogIn, LogOut, ChevronRight, PlusCircle, Wrench, ShieldCheck
} from 'lucide-react';

const categories = [
  { name: 'ทั้งหมด', icon: <LayoutGrid size={20} /> },
  { name: 'วัด', icon: <Landmark size={20} /> },
  { name: 'คาเฟ่', icon: <Coffee size={20} /> },
  { name: 'ห้างสรรพสินค้า', icon: <ShoppingBag size={20} /> },
  { name: 'ร้านอาหาร', icon: <Utensils size={20} /> },
  { name: 'อื่นๆ', icon: <ListFilter size={20} /> },
];

const Sidebar = ({ selectedCategory, setSelectedCategory, setCurrentPage, currentUser, handleLogout }) => {
  
  const handleCategoryClick = (category) => {
    setSelectedCategory(category.name);
    
    if (category.name === 'ร้านอาหาร' || category.name === 'คาเฟ่') {
      setCurrentPage('foodshops');
    } else if (category.name !== 'ทั้งหมด') {
      setCurrentPage('attractions');
    } else {
      setCurrentPage('home');
    }
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg p-5 pt-24 z-20 transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out border-r border-gray-100 dark:border-gray-700 flex flex-col">
      
      {/* --- ส่วนหมวดหมู่ --- */}
      <div className="flex-grow">
        <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4 px-2">หมวดหมู่</h3>
        <nav className="space-y-2">
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => handleCategoryClick(category)}
              className={`w-full flex items-center p-3 rounded-lg text-left transition-all duration-200 group
                ${selectedCategory === category.name
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <div className={`transition-colors ${selectedCategory === category.name ? 'text-white' : 'text-gray-400 group-hover:text-blue-500'}`}>
                {category.icon}
              </div>
              <span className="ml-3 font-semibold">{category.name}</span>
              <ChevronRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </nav>

        <hr className="my-6 border-gray-200 dark:border-gray-600" />
        
        <nav className="space-y-2">
          {currentUser && (
            <button
              onClick={() => setCurrentPage('add-location')}
              className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
            >
              <PlusCircle size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              <span className="ml-3 font-semibold">เพิ่มสถานที่</span>
            </button>
          )}

          {currentUser && currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setCurrentPage('manage-products')}
                className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
              >
                <Wrench size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="ml-3 font-semibold">จัดการของขึ้นชื่อ</span>
              </button>
              {/* <<< NEW: Admin menu for deletion requests >>> */}
              <button
                onClick={() => setCurrentPage('deletion-requests')}
                className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
              >
                <ShieldCheck size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="ml-3 font-semibold">อนุมัติการลบ</span>
              </button>
            </>
          )}
        </nav>
      </div>

      {/* --- ส่วนบัญชีผู้ใช้ --- */}
      <div className="flex-shrink-0">
        <hr className="my-4 border-t border-gray-200 dark:border-gray-600" />
        {currentUser ? (
          <div className="space-y-2">
            <button 
              onClick={() => setCurrentPage('profile')}
              className="w-full flex items-center p-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                {currentUser.profile_image_url ? (
                  <img src={currentUser.profile_image_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User size={20} className="text-blue-600 dark:text-blue-300" />
                )}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{currentUser.displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">ดูโปรไฟล์</p>
              </div>
            </button>
            <button
              onClick={() => setCurrentPage('favorites')}
              className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
            >
              <Heart size={20} className="text-gray-400 group-hover:text-red-500 transition-colors" />
              <span className="ml-3 font-semibold">รายการโปรด</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
            >
              <LogOut size={20} className="text-gray-400 group-hover:text-red-500 transition-colors" />
              <span className="ml-3 font-semibold">ออกจากระบบ</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCurrentPage('login')}
            className="w-full flex items-center p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white group"
          >
            <LogIn size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
            <span className="ml-3 font-semibold">เข้าสู่ระบบ / สมัครสมาชิก</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

