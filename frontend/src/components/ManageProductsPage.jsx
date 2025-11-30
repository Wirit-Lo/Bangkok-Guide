import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom'; // ✅ เพิ่ม import createPortal
import { Plus, Edit, Trash2, Package, MapPin, Search, Filter, AlertCircle, Loader, X } from 'lucide-react';

const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};

// --- ✨ Modern Confirmation Modal (Fixed with Portal) ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    // ✅ ใช้ createPortal เพื่อย้าย Modal ไปที่ body โดยตรง
    // ทำให้ position: fixed ยึดกับหน้าจอ (Viewport) เสมอ ไม่ไหลตาม Scroll
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop - สีเทาเข้มโปร่งแสง + เบลอ */}
            <div 
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 animate-fade-in-up border border-gray-100 dark:border-gray-700">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="mb-4 p-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 shadow-inner">
                        <Trash2 size={48} strokeWidth={2} />
                    </div>

                    {/* Text */}
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">
                        {message}
                    </p>

                    {/* Buttons */}
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold shadow-lg hover:shadow-red-500/30 transition-transform active:scale-95"
                        >
                            ยืนยันลบ
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body // 👈 เรนเดอร์ที่ body แทนที่จะเป็น div ซ้อนๆ กัน
    );
};

const ManageProductsPage = ({ setNotification, handleAuthError }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // State for Delete Modal
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        item: null
    });

    const API_BASE_URL = getApiBaseUrl();

    // Fetch Products
    const fetchProducts = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            handleAuthError();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/famous-products/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setNotification({ message: 'ไม่สามารถดึงข้อมูลของขึ้นชื่อได้', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // --- Modal Handlers ---
    const confirmDelete = (item) => {
        setDeleteModal({
            isOpen: true,
            item: item
        });
    };

    const closeDeleteModal = () => {
        setDeleteModal({ isOpen: false, item: null });
    };

    const executeDelete = async () => {
        const item = deleteModal.item;
        if (!item) return;

        closeDeleteModal(); // Close modal first
        
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE_URL}/api/famous-products/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setProducts(prev => prev.filter(p => p.id !== item.id));
                setNotification({ message: `ลบ "${item.name}" เรียบร้อยแล้ว`, type: 'success' });
            } else {
                throw new Error('Failed');
            }
        } catch (err) {
            setNotification({ message: 'เกิดข้อผิดพลาดในการลบ', type: 'error' });
        }
    };

    // --- 🟢 Logic การจัดกลุ่มข้อมูลตามชื่อสถานที่ ---
    const groupedProducts = useMemo(() => {
        const filtered = products.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.locationName && p.locationName.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        // Group by locationName
        const groups = filtered.reduce((acc, product) => {
            const locationName = product.locationName || 'ส่วนกลาง (General)';
            if (!acc[locationName]) {
                acc[locationName] = [];
            }
            acc[locationName].push(product);
            return acc;
        }, {});

        return groups;
    }, [products, searchTerm]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
                <Loader size={48} className="animate-spin mb-4 text-blue-500" />
                <p>กำลังโหลดข้อมูลของขึ้นชื่อ...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in-up min-h-screen">
            
            {/* Modal Injection - ตอนนี้จะลอยอยู่เหนือทุกอย่างและกลางจอเสมอ */}
            <ConfirmationModal 
                isOpen={deleteModal.isOpen}
                onClose={closeDeleteModal}
                onConfirm={executeDelete}
                title="ยืนยันการลบ"
                message={`คุณแน่ใจหรือไม่ที่จะลบของขึ้นชื่อ "${deleteModal.item?.name}"? การกระทำนี้ไม่สามารถย้อนกลับได้`}
            />

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Package className="text-blue-500" /> จัดการข้อมูลของขึ้นชื่อทั้งหมด
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        รวมสินค้า {products.length} รายการ จาก {Object.keys(groupedProducts).length} สถานที่
                    </p>
                </div>
                
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="ค้นหาสินค้า หรือ สถานที่..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-700 dark:text-gray-200"
                        />
                    </div>
                </div>
            </div>

            {/* Content Section */}
            {Object.keys(groupedProducts).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 text-center">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                        <Package size={48} className="text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">ไม่พบข้อมูลของขึ้นชื่อ</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">ลองค้นหาด้วยคำอื่น หรือยังไม่มีการเพิ่มข้อมูลเข้ามา</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(groupedProducts).map(([locationName, items]) => (
                        <div key={locationName} className="space-y-4">
                            {/* Location Header */}
                            <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                    <MapPin size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                    {locationName}
                                </h2>
                                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                    {items.length} รายการ
                                </span>
                            </div>

                            {/* Grid of Items */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {items.map((item) => (
                                    <div key={item.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 flex flex-col relative">
                                        
                                        {/* Image Area */}
                                        <div className="relative h-48 overflow-hidden bg-gray-100 dark:bg-gray-900">
                                            <img 
                                                src={item.imageUrl || item.imageurl || 'https://placehold.co/400x300?text=No+Image'} 
                                                alt={item.name} 
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                onError={(e) => e.target.src = 'https://placehold.co/400x300?text=Error'}
                                            />
                                            {/* Overlay Actions */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                                                <button 
                                                    onClick={() => confirmDelete(item)}
                                                    className="p-3 bg-white text-red-600 rounded-full hover:bg-red-50 transition-transform hover:scale-110 shadow-lg border border-red-100" 
                                                    title="ลบ"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h3 className="font-bold text-gray-800 dark:text-white mb-1 truncate" title={item.name}>
                                                {item.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
                                                {item.description || 'ไม่มีคำอธิบาย'}
                                            </p>
                                            
                                            {/* Footer with Author */}
                                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                <img 
                                                    src={item.profileImageUrl || item.authorProfileImageUrl || 'https://placehold.co/24x24?text=?'} 
                                                    alt="Author" 
                                                    className="w-6 h-6 rounded-full border border-white dark:border-gray-600 shadow-sm object-cover"
                                                />
                                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                    โดย: {item.author || item.displayName || 'Admin'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ManageProductsPage;