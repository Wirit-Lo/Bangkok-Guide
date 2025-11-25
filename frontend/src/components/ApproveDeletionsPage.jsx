import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldX, Trash2, Eye, AlertTriangle } from 'lucide-react';

// --- ⭐⭐ START: API URL Configuration ⭐⭐ ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();
// --- ⭐⭐ END: API URL Configuration ⭐⭐ ---

// --- ⭐⭐ NEW: Confirmation Modal Component ⭐⭐ ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isDangerous }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-start">
                    <div className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${isDangerous ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                        <AlertTriangle className={`h-6 w-6 ${isDangerous ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} aria-hidden="true" />
                    </div>
                    <div className="ml-4 text-left">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-gray-100" id="modal-title">{title}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-300">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none sm:ml-3 sm:w-auto sm:text-sm ${isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        onClick={onConfirm}
                    >
                        ยืนยัน
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>
    );
};

const ApproveDeletionsPage = ({ setNotification, handleAuthError, handleItemClick }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [permissionError, setPermissionError] = useState(false);
    
    // --- ⭐⭐ NEW: State for Modal ⭐⭐ ---
    const [confirmState, setConfirmState] = useState({ 
        isOpen: false, 
        title: '', 
        message: '', 
        isDangerous: false,
        onConfirm: () => {} 
    });

    const fetchDeletionRequests = useCallback(async () => {
        setIsLoading(true);
        setPermissionError(false);
        const token = localStorage.getItem('token');
        if (!token) {
            return handleAuthError();
        }

        const requestUrl = `${API_BASE_URL}/api/locations/deletion-requests`;

        try {
            const response = await fetch(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401) {
                console.error("Approve Page: 401 Unauthorized - logging out");
                return handleAuthError();
            }

            if (response.status === 403) {
                console.error("Approve Page: 403 Forbidden - Permission denied");
                setPermissionError(true);
                setIsLoading(false);
                return;
            }

            if (!response.ok) {
                let errorData = { message: `ไม่สามารถดึงข้อมูลคำขอลบได้ (Status: ${response.status})` };
                try {
                    const errorText = await response.text();
                    try {
                        errorData = JSON.parse(errorText);
                    } catch (jsonError) {
                        console.error("[ApproveDeletionsPage] Received non-JSON error response:", errorText);
                        errorData.message = `เกิดข้อผิดพลาดจาก Server (Status: ${response.status}). ไม่สามารถอ่านข้อมูล JSON ได้.`;
                    }
                } catch (textError) {
                    console.error("[ApproveDeletionsPage] Could not read error response text:", textError);
                }
                throw new Error(errorData.error || errorData.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
            }
            
            const data = await response.json();
            setRequests(data);
        } catch (error) {
            console.error("[ApproveDeletionsPage] Error in fetchDeletionRequests catch block:", error); 
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [setNotification, handleAuthError]); 

    useEffect(() => {
        fetchDeletionRequests();
    }, [fetchDeletionRequests]); 

    // --- ⭐⭐ UPDATED: Execute Action (Separated from Click Handler) ⭐⭐ ---
    const executeAction = async (locationId, action) => {
        // Close modal first
        setConfirmState(prev => ({ ...prev, isOpen: false }));

        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        const isApprove = action === 'approve';
        const url = isApprove ? `${API_BASE_URL}/api/locations/${locationId}` : `${API_BASE_URL}/api/locations/${locationId}/deny-deletion`;
        const method = isApprove ? 'DELETE' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401) return handleAuthError();
            if (response.status === 403) throw new Error("คุณไม่มีสิทธิ์ดำเนินการนี้ (403 Forbidden)");
            
            let data = {};
            const responseText = await response.text();
            
            if (response.status !== 204 && responseText) { 
                try {
                    data = JSON.parse(responseText); 
                } catch (jsonError) {
                    console.error("Failed to parse response JSON in executeAction:", responseText);
                    throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
                }
            }

            if (!response.ok) {
                throw new Error(data.error || `การดำเนินการล้มเหลว (Status: ${response.status})`);
            }

            const successMessage = data.message || (isApprove ? 'ลบสถานที่เรียบร้อยแล้ว' : 'ปฏิเสธการลบเรียบร้อยแล้ว');
            setNotification({ message: successMessage, type: 'success' });

            setRequests(prev => prev.filter(req => req.id !== locationId));
        } catch (error) {
            console.error("Error in executeAction:", error); 
            setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' });
        }
    };

    // --- ⭐⭐ UPDATED: Handle Click (Trigger Modal) ⭐⭐ ---
    const handleActionClick = (locationId, action) => {
        const isApprove = action === 'approve';

        if (isApprove) {
            // Show Confirmation Modal for Deletion
            setConfirmState({
                isOpen: true,
                title: 'ยืนยันการลบถาวร',
                message: 'คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่นี้อย่างถาวร? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
                isDangerous: true,
                onConfirm: () => executeAction(locationId, action)
            });
        } else {
            // For deny, maybe just execute or show a softer confirmation? 
            // Let's execute directly for now as per original logic, or you can add modal here too.
            executeAction(locationId, action);
        }
    };

    if (permissionError) {
        return (
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full flex flex-col items-center justify-center min-h-[50vh]">
                <ShieldX size={64} className="text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">เข้าถึงถูกปฏิเสธ (403 Forbidden)</h2>
                <p className="text-gray-600 dark:text-gray-300 text-center">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full">
            {/* --- ⭐⭐ NEW: Modal Component Instance ⭐⭐ --- */}
            <ConfirmationModal 
                isOpen={confirmState.isOpen} 
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                isDangerous={confirmState.isDangerous}
            />

            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">จัดการคำขอลบสถานที่</h1>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg">
                {isLoading ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 p-8">กำลังโหลดข้อมูลคำขอ...</p>
                ) : requests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-gray-700">
                                    <th className="p-4">รูปภาพ</th>
                                    <th className="p-4">ชื่อสถานที่</th>
                                    <th className="p-4 hidden md:table-cell">หมวดหมู่</th>
                                    <th className="p-4 text-right">ดำเนินการ</th>
                                </tr> 
                            </thead>
                            <tbody>
                                {requests.map(item => (
                                    <tr key={item.id} className="border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="p-4">
                                            <img 
                                                src={item.imageUrl || `https://placehold.co/100x100/e2e8f0/333333?text=N%2FA`} 
                                                alt={item.name} 
                                                className="w-16 h-16 object-cover rounded-md"
                                                onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/100x100/e2e8f0/ff0000?text=Error`; }}
                                            />
                                        </td>
                                        <td className="p-4 font-semibold text-gray-800 dark:text-gray-100">{item.name}</td>
                                        <td className="p-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">{item.category}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button 
                                                onClick={() => handleItemClick(item)} 
                                                className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
                                                title="ดูรายละเอียด">
                                                    <Eye size={18} />
                                                </button>
                                                <button 
                                                // ⭐ Update: Call handleActionClick
                                                onClick={() => handleActionClick(item.id, 'deny')} 
                                                className="p-2 text-yellow-600 hover:text-yellow-700 dark:hover:text-yellow-500 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors" 
                                                title="ปฏิเสธการลบ">
                                                    <ShieldX size={18} />
                                                </button>
                                                <button 
                                                // ⭐ Update: Call handleActionClick
                                                onClick={() => handleActionClick(item.id, 'approve')} 
                                                className="p-2 text-red-600 hover:text-red-700 dark:hover:text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors" 
                                                title="อนุมัติการลบ (ลบถาวร)">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 dark:text-gray-400 p-12">
                        <ShieldCheck size={48} className="mx-auto mb-4 text-green-500" />
                        <h3 className="text-xl font-semibold">ยอดเยี่ยม!</h3>
                        <p>ไม่มีคำขอลบที่รอการอนุมัติในขณะนี้</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApproveDeletionsPage;