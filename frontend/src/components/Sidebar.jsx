import React, { memo } from 'react';
import {
    LayoutGrid, Landmark, Coffee, ShoppingBag, Utensils, Store,
    User, Heart, LogIn, LogOut, PlusCircle, Wrench, ShieldCheck,
    ChevronLeft, Menu, X, MapPin
} from 'lucide-react';

// --- Reusable Navigation Item Component with new design ---
const NavItem = ({ icon, text, onClick, isSelected, isOpen, color }) => (
    <button
        onClick={onClick}
        title={!isOpen ? text : ''}
        className={`w-full flex items-center p-3 rounded-xl text-left transition-all duration-300 group relative
            ${!isOpen && 'justify-center'}
            ${isSelected
                ? 'bg-gradient-to-tr from-indigo-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/30'
                : 'text-gray-500 dark:text-gray-400 hover:bg-slate-200/50 dark:hover:bg-gray-700/60'
            }`}
    >
        <div className={isSelected ? 'text-white' : `${color || 'text-gray-500 dark:text-gray-400'} transition-colors group-hover:opacity-90`}>
            {React.cloneElement(icon, { strokeWidth: isSelected ? 2.5 : 2 })}
        </div>
        <span className={`font-semibold whitespace-nowrap transition-all duration-200 ${isOpen ? 'ml-4 opacity-100' : 'w-0 opacity-0'}`}>
            {text}
        </span>
    </button>
);

const categories = [
    { name: 'ทั้งหมด', icon: <LayoutGrid size={22} />, color: 'text-sky-500' },
    { name: 'วัด', icon: <Landmark size={22} />, color: 'text-amber-500' },
    { name: 'คาเฟ่', icon: <Coffee size={22} />, color: 'text-orange-500' },
    { name: 'ห้างสรรพสินค้า', icon: <ShoppingBag size={22} />, color: 'text-rose-500' },
    { name: 'ร้านอาหาร', icon: <Utensils size={22} />, color: 'text-emerald-500' },
    { name: 'ตลาด', icon: <Store size={22} />, color: 'text-violet-500' },
    { name: 'อื่นๆ', icon: <Menu size={22} />, color: 'text-slate-500' },
];

const Sidebar = memo(({ 
    selectedCategory, 
    setSelectedCategory, 
    setCurrentPage, 
    currentUser, 
    handleLogout,
    isSidebarOpen, 
    toggleSidebar 
}) => {

    const handleCategoryClick = (category) => {
        setSelectedCategory(category.name);
        const foodCategories = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'];
        
        if (foodCategories.includes(category.name)) {
            setCurrentPage('foodshops');
        } else if (category.name !== 'ทั้งหมด') {
            setCurrentPage('attractions');
        } else {
            setCurrentPage('home');
        }
    };
    
    // --- ฟังก์ชันสำหรับคลิกโลโก้ ---
    const handleLogoClick = () => {
        setCurrentPage('home');
        setSelectedCategory('ทั้งหมด'); 
    };

    // --- ⭐⭐ แก้ไข CSS Class ตรงนี้ (เพิ่ม rounded-3xl) ⭐⭐ ---
    const sidebarContainerClasses = `
        sticky top-0 h-screen z-40
        flex flex-col shadow-2xl shadow-slate-900/10 dark:shadow-black/20
        bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-r border-slate-200/50 dark:border-gray-700/50
        rounded-r-3xl md:rounded-3xl /* เพิ่มความโค้งมน */
        transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
        ${isSidebarOpen ? 'w-72' : 'w-0 md:w-[100px]'} 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `;
    // --- ⭐⭐ จบการแก้ไข ⭐⭐ ---

    return (
        <>
            {isSidebarOpen && (
                <div
                    onClick={toggleSidebar}
                    className="fixed inset-0 bg-black/50 z-30 md:hidden" 
                    aria-hidden="true"
                ></div>
            )}
            <aside className={`${sidebarContainerClasses} relative ml-4 my-4`}> {/* เพิ่ม margin เล็กน้อยเพื่อให้เห็นความโค้งชัดขึ้น */}
                <button 
                    onClick={toggleSidebar} 
                    className="hidden md:flex items-center justify-center w-8 h-8 bg-white dark:bg-gray-700 text-gray-500 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 rounded-full shadow-lg border border-slate-200 dark:border-slate-600 absolute top-1/2 -translate-y-1/2 -right-4 z-50 transition-all duration-300"
                    aria-label={isSidebarOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
                >
                    <ChevronLeft size={18} className={`transition-transform duration-500 ease-in-out ${!isSidebarOpen && 'rotate-180'}`} />
                </button>

                <div className="flex items-center justify-center pt-8 pb-6 px-4 flex-shrink-0 relative">
                    <button
                        onClick={handleLogoClick}
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 transition-transform duration-200 hover:scale-105 active:scale-95"
                        aria-label="กลับไปหน้าหลัก"
                    >
                        <MapPin size={32} strokeWidth={2.5} />
                    </button>

                     <button onClick={toggleSidebar} className="absolute top-4 right-4 p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-700 md:hidden">
                         <X size={22} />
                     </button>
                </div>

                <div className="flex-grow overflow-y-auto overflow-x-hidden p-4 space-y-6 custom-scrollbar">
                    <div>
                        <h3 className={`px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-opacity ${!isSidebarOpen && 'hidden'}`}>
                            หมวดหมู่
                        </h3>
                        <nav className="space-y-1">
                            {categories.map((category) => (
                                <NavItem
                                    key={category.name}
                                    icon={category.icon}
                                    text={category.name}
                                    isOpen={isSidebarOpen}
                                    isSelected={selectedCategory === category.name}
                                    onClick={() => handleCategoryClick(category)}
                                    color={category.color}
                                />
                            ))}
                        </nav>
                    </div>

                    {(currentUser) && (
                        <div>
                             <h3 className={`px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider transition-opacity ${!isSidebarOpen && 'hidden'}`}>
                                การจัดการ
                            </h3>
                            <nav className="space-y-1">
                                <NavItem
                                    icon={<PlusCircle size={22} />}
                                    text="เพิ่มสถานที่"
                                    isOpen={isSidebarOpen}
                                    onClick={() => setCurrentPage('add-location')}
                                    color="text-green-500"
                                />
                                {currentUser.role === 'admin' && (
                                    <>
                                            <NavItem
                                                icon={<Wrench size={22} />}
                                                text="จัดการของขึ้นชื่อ"
                                                isOpen={isSidebarOpen}
                                                onClick={() => setCurrentPage('manage-products')}
                                                color="text-blue-500"
                                            />
                                            <NavItem
                                                icon={<ShieldCheck size={22} />}
                                                text="อนุมัติการลบ"
                                                isOpen={isSidebarOpen}
                                                onClick={() => setCurrentPage('deletion-requests')}
                                                color="text-teal-500"
                                            />
                                    </>
                                )}
                            </nav>
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-br-3xl md:rounded-b-3xl"> {/* เพิ่มความโค้งมนส่วนล่าง */}
                    {currentUser ? (
                        <div className="space-y-2">
                            <NavItem icon={<Heart size={22} />} text="รายการโปรด" isOpen={isSidebarOpen} onClick={() => setCurrentPage('favorites')} color="text-red-500"/>
                            <hr className="border-slate-200/80 dark:border-slate-700/80 my-3 mx-3"/>
                             <button
                                onClick={() => setCurrentPage('profile')}
                                className={`w-full flex items-center p-2 rounded-lg text-left transition-colors hover:bg-slate-100 dark:hover:bg-gray-700/50 ${!isSidebarOpen && 'justify-center'}`}
                                aria-label={`View profile for ${currentUser.displayName || currentUser.username}`}
                            >
                                <div className="w-11 h-11 bg-slate-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white dark:border-gray-700 shadow-sm">
                                    {currentUser.profileImageUrl ? (
                                        <img src={currentUser.profileImageUrl} alt="User profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={24} className="text-slate-500 dark:text-slate-300" />
                                    )}
                                </div>
                                <div className={`overflow-hidden transition-all duration-200 ${isSidebarOpen ? 'ml-3 w-auto opacity-100' : 'w-0 opacity-0'}`}>
                                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{currentUser.displayName || currentUser.username}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ดูโปรไฟล์</p>
                                </div>
                            </button>
                            <NavItem icon={<LogOut size={22} />} text="ออกจากระบบ" isOpen={isSidebarOpen} onClick={handleLogout} color="text-red-500" />
                        </div>
                    ) : (
                         <NavItem icon={<LogIn size={22} />} text="เข้าสู่ระบบ" isOpen={isSidebarOpen} onClick={() => setCurrentPage('login')} color="text-lime-500" />
                    )}
                </div>
            </aside>
        </>
    );
});

export default Sidebar;