import React, { useState, useEffect } from 'react';
import { Check, X, MapPin, Loader, Info, AlertCircle, CheckCircle } from 'lucide-react';

const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};

// --- ✨ Modern Confirmation Modal Component ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, type }) => {
    if (!isOpen) return null;

    const isApprove = type === 'approve';
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 animate-fade-in-up border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`mb-4 p-4 rounded-full ${isApprove ? 'bg-green-100 dark:bg-green-900/30 text-green-500' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
                        {isApprove ? <CheckCircle size={48} strokeWidth={2} /> : <AlertCircle size={48} strokeWidth={2} />}
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
                            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold shadow-lg transition-transform active:scale-95 ${
                                isApprove 
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-green-500/30' 
                                    : 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-red-500/30'
                            }`}
                        >
                            {isApprove ? 'ยืนยันอนุมัติ' : 'ยืนยันไม่อนุมัติ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ApproveNewLocationsPage = ({ setNotification, handleAuthError, onItemStatusUpdate }) => {
    const [pendingItems, setPendingItems] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // State for Modal control
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        type: null, // 'approve' | 'reject'
        item: null
    });

    const API_BASE_URL = getApiBaseUrl();

    useEffect(() => {
        fetchPendingLocations();
    }, []);

    const fetchPendingLocations = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            handleAuthError();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/pending`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch pending locations');
            }

            const data = await response.json();
            setPendingItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching pending locations:", error);
            setNotification({ message: 'ไม่สามารถดึงข้อมูลรายการรออนุมัติได้', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // --- Action Handlers that open the Modal ---
    const confirmApprove = (item) => {
        setModalConfig({
            isOpen: true,
            type: 'approve',
            item: item
        });
    };

    const confirmReject = (item) => {
        setModalConfig({
            isOpen: true,
            type: 'reject',
            item: item
        });
    };

    const closeModal = () => {
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    // --- Actual API Calls ---
    const executeAction = async () => {
        const { type, item } = modalConfig;
        if (!item) return;

        const token = localStorage.getItem('token');
        closeModal(); // Close modal immediately

        try {
            if (type === 'approve') {
                const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}/approve`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to approve');

                setPendingItems(prev => prev.filter(i => i.id !== item.id));
                if (onItemStatusUpdate) onItemStatusUpdate(item.id, 'approved');
                setNotification({ message: `อนุมัติ "${item.name}" เรียบร้อยแล้ว`, type: 'success' });

            } else if (type === 'reject') {
                const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Failed to reject');

                setPendingItems(prev => prev.filter(i => i.id !== item.id));
                setNotification({ message: `ปฏิเสธและลบ "${item.name}" แล้ว`, type: 'success' });
            }
        } catch (error) {
            setNotification({ message: 'เกิดข้อผิดพลาดในการทำรายการ', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader className="animate-spin mr-2" /> กำลังโหลดรายการรออนุมัติ...
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            {/* Modal Injection */}
            <ConfirmationModal 
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={executeAction}
                type={modalConfig.type}
                title={modalConfig.type === 'approve' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการไม่อนุมัติ'}
                message={
                    modalConfig.type === 'approve' 
                    ? `คุณต้องการอนุมัติสถานที่ "${modalConfig.item?.name}" ให้แสดงผลบนหน้าเว็บใช่หรือไม่?` 
                    : `คุณต้องการปฏิเสธและลบสถานที่ "${modalConfig.item?.name}" ทิ้งอย่างถาวรใช่หรือไม่?`
                }
            />

            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white flex items-center">
                <Info className="mr-2 text-blue-500" />
                รายการสถานที่รออนุมัติ ({pendingItems.length})
            </h2>

            {pendingItems.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <Check className="mx-auto h-12 w-12 text-green-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg">ไม่มีรายการที่รออนุมัติในขณะนี้</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingItems.map((item) => (
                        <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col hover:shadow-xl transition-shadow duration-300">
                            {/* Image Section - แก้ไข: เพิ่ม overflow-hidden เพื่อป้องกันรูปลอยออกนอกกรอบ */}
                            <div className="relative h-48 bg-gray-200 group overflow-hidden">
                                <img
                                    src={item.imageUrl || item.image_url || 'https://placehold.co/600x400?text=No+Image'}
                                    alt={item.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    onError={(e) => e.target.src = 'https://placehold.co/600x400?text=Error'}
                                />
                                <div className="absolute top-2 right-2 bg-yellow-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-white/20">
                                    รออนุมัติ
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                                    <h3 className="text-white font-bold text-lg truncate drop-shadow-md">{item.name}</h3>
                                    <p className="text-gray-200 text-sm flex items-center drop-shadow-sm">
                                        <MapPin size={14} className="mr-1 text-yellow-400" />
                                        {item.category || 'ไม่ระบุหมวดหมู่'}
                                    </p>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="p-4 flex-1 flex flex-col">
                                <div className="mb-4 flex-1">
                                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
                                        {item.description || 'ไม่มีคำอธิบาย'}
                                    </p>
                                    
                                    {/* Author Info */}
                                    <div className="flex items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <img 
                                            src={item.authorProfileImageUrl || 'https://placehold.co/40x40?text=?'} 
                                            className="w-8 h-8 rounded-full mr-3 border-2 border-white dark:border-gray-600 shadow-sm"
                                            alt="Author"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 uppercase tracking-wide">เสนอโดย</span>
                                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                                {item.author || item.displayName || item.username || 'ไม่ระบุชื่อ'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <button
                                        onClick={() => confirmReject(item)}
                                        className="flex items-center justify-center px-4 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:bg-gray-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all font-medium text-sm group"
                                    >
                                        <X size={18} className="mr-1.5 transition-transform group-hover:rotate-90" /> ไม่อนุมัติ
                                    </button>
                                    <button
                                        onClick={() => confirmApprove(item)}
                                        className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/30 rounded-lg transition-all font-medium text-sm group"
                                    >
                                        <Check size={18} className="mr-1.5 transition-transform group-hover:scale-125" /> อนุมัติ
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ApproveNewLocationsPage;