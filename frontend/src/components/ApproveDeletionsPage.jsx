import React, { useState, useEffect } from 'react';
import { Trash2, XCircle, MapPin, Loader, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};

// --- ✨ Modern Confirmation Modal (Reusable Style) ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, type }) => {
    if (!isOpen) return null;

    const isDelete = type === 'delete'; // True = ลบจริงๆ (อนุมัติให้ลบ), False = ยกเลิกคำขอ (เก็บไว้)
    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 animate-fade-in-up border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className={`mb-4 p-4 rounded-full ${isDelete ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>
                        {isDelete ? <Trash2 size={48} strokeWidth={2} /> : <ShieldCheck size={48} strokeWidth={2} />}
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
                                isDelete 
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:shadow-red-500/30' 
                                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-blue-500/30'
                            }`}
                        >
                            {isDelete ? 'ยืนยันลบ' : 'เก็บไว้ (ปฏิเสธ)'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ApproveDeletionsPage = ({ setNotification, handleAuthError, handleItemClick }) => {
    const [deletionRequests, setDeletionRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const API_BASE_URL = getApiBaseUrl();

    // Modal State
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        type: null, // 'delete' | 'keep'
        item: null
    });

    useEffect(() => {
        fetchDeletionRequests();
    }, []);

    const fetchDeletionRequests = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            handleAuthError();
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/deletion-requests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            if (!response.ok) throw new Error('Failed to fetch');

            const data = await response.json();
            setDeletionRequests(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setNotification({ message: 'ไม่สามารถดึงข้อมูลคำขอลบได้', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // --- Modal Handlers ---
    const confirmDelete = (item) => {
        setModalConfig({
            isOpen: true,
            type: 'delete',
            item: item
        });
    };

    const confirmKeep = (item) => {
        setModalConfig({
            isOpen: true,
            type: 'keep',
            item: item
        });
    };

    const closeModal = () => {
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    // --- Actions ---
    const executeAction = async () => {
        const { type, item } = modalConfig;
        if (!item) return;
        
        const token = localStorage.getItem('token');
        closeModal();

        try {
            if (type === 'delete') {
                // อนุมัติให้ลบ (Delete จริงๆ)
                const res = await fetch(`${API_BASE_URL}/api/locations/${item.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to delete');
                
                setDeletionRequests(prev => prev.filter(i => i.id !== item.id));
                setNotification({ message: `ลบสถานที่ "${item.name}" เรียบร้อยแล้ว`, type: 'success' });

            } else {
                // ปฏิเสธการลบ (เปลี่ยนสถานะกลับเป็น approved)
                const res = await fetch(`${API_BASE_URL}/api/locations/${item.id}/deny-deletion`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to deny');

                setDeletionRequests(prev => prev.filter(i => i.id !== item.id));
                setNotification({ message: `ยกเลิกคำขอลบ "${item.name}" แล้ว (สถานที่ยังอยู่)`, type: 'success' });
            }
        } catch (err) {
            setNotification({ message: 'เกิดข้อผิดพลาด', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-500 dark:text-gray-400">
                <Loader size={48} className="animate-spin mb-4 text-red-500" />
                <p className="text-lg">กำลังโหลดรายการคำขอลบ...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto min-h-screen">
            <ConfirmationModal 
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                onConfirm={executeAction}
                type={modalConfig.type}
                title={modalConfig.type === 'delete' ? 'ยืนยันการลบถาวร' : 'ปฏิเสธคำขอลบ'}
                message={
                    modalConfig.type === 'delete' 
                    ? `คุณแน่ใจหรือไม่ที่จะลบ "${modalConfig.item?.name}" ออกจากระบบถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้` 
                    : `คุณต้องการเก็บสถานที่ "${modalConfig.item?.name}" ไว้ และยกเลิกสถานะ "ร้องขอลบ" ใช่หรือไม่?`
                }
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        <AlertTriangle className="text-red-500" size={32} />
                        จัดการคำขอลบสถานที่
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        รายการสถานที่ที่ผู้ใช้หรือเจ้าของแจ้งขอให้ลบออกจากระบบ
                    </p>
                </div>
                <button 
                    onClick={fetchDeletionRequests} 
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    title="รีเฟรชข้อมูล"
                >
                    <RefreshCw size={20} className="text-gray-600 dark:text-gray-300" />
                </button>
            </div>

            {/* Content */}
            {deletionRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800/50 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 text-center animate-fade-in-up">
                    <div className="bg-green-100 dark:bg-green-900/20 p-6 rounded-full mb-6">
                        <ShieldCheck size={64} className="text-green-500 dark:text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-700 dark:text-gray-200">ยอดเยี่ยม! ไม่มีคำขอลบตกค้าง</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">สถานที่ทั้งหมดในระบบอยู่ในสถานะปกติ</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {deletionRequests.map((item) => (
                        <div key={item.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-300 flex flex-col">
                            
                            {/* Image Section */}
                            <div className="relative h-56 overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer" onClick={() => handleItemClick(item)}>
                                <img
                                    src={item.imageUrl || item.image_url || 'https://placehold.co/600x400?text=No+Image'}
                                    alt={item.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 grayscale group-hover:grayscale-0"
                                    onError={(e) => e.target.src = 'https://placehold.co/600x400?text=Error'}
                                />
                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />
                                
                                {/* Status Badge */}
                                <div className="absolute top-3 right-3 bg-red-500/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg border border-red-400/50 flex items-center gap-1 animate-pulse">
                                    <Trash2 size={12} /> ร้องขอลบ
                                </div>

                                {/* Content Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                    <h3 className="text-lg font-bold truncate mb-1">{item.name}</h3>
                                    <div className="flex items-center text-gray-300 text-sm">
                                        <MapPin size={14} className="mr-1 text-red-400" />
                                        {item.category || 'ไม่ระบุหมวดหมู่'}
                                    </div>
                                </div>
                            </div>

                            {/* Info & Actions */}
                            <div className="p-5 flex-1 flex flex-col justify-between bg-red-50/30 dark:bg-red-900/10">
                                {/* ✅ ปรับปรุงส่วนแสดงข้อมูลผู้ใช้งาน */}
                                <div className="mb-4 flex-1">
                                    <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                                        <img 
                                            src={item.authorProfileImageUrl || 'https://placehold.co/40x40?text=?'} 
                                            className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-600 shadow-sm object-cover mr-3"
                                            alt="Requestor"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-red-400 dark:text-red-300 uppercase tracking-wide font-bold">
                                                ผู้แจ้งลบ
                                            </span>
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                                {item.author || item.displayName || 'ไม่ระบุตัวตน'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                                    <button
                                        onClick={() => confirmKeep(item)}
                                        className="flex items-center justify-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600 rounded-xl transition-all font-medium text-sm shadow-sm"
                                    >
                                        <XCircle size={18} className="mr-1.5" /> ปฏิเสธ
                                    </button>
                                    <button
                                        onClick={() => confirmDelete(item)}
                                        className="flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg hover:shadow-red-500/30 rounded-xl transition-all font-medium text-sm"
                                    >
                                        <Trash2 size={18} className="mr-1.5" /> อนุมัติลบ
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

export default ApproveDeletionsPage;