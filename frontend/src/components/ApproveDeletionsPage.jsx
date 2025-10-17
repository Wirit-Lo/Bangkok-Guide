import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldX, Trash2, Eye, AlertTriangle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

const ApproveDeletionsPage = ({ setNotification, handleAuthError, handleItemClick }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDeletionRequests = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/deletion-requests`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลคำขอลบได้');
            
            const data = await response.json();
            setRequests(data);
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [setNotification, handleAuthError]);

    useEffect(() => {
        fetchDeletionRequests();
    }, [fetchDeletionRequests]);

    const handleAction = async (locationId, action) => {
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

            if (response.status === 401 || response.status === 403) return handleAuthError();
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'การดำเนินการล้มเหลว');

            setNotification({ message: data.message, type: 'success' });
            // Remove the processed item from the list
            setRequests(prev => prev.filter(req => req.id !== locationId));
        } catch (error) {
            setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' });
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full">
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
                                            <img src={item.imageUrl || 'https://placehold.co/100x100/e2e8f0/333333?text=N/A'} alt={item.name} className="w-16 h-16 object-cover rounded-md"/>
                                        </td>
                                        <td className="p-4 font-semibold text-gray-800 dark:text-gray-100">{item.name}</td>
                                        <td className="p-4 text-gray-600 dark:text-gray-400 hidden md:table-cell">{item.category}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button onClick={() => handleItemClick(item)} className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-full" title="ดูรายละเอียด">
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => handleAction(item.id, 'deny')} className="p-2 text-yellow-600 hover:text-yellow-700 dark:hover:text-yellow-500 rounded-full" title="ปฏิเสธการลบ">
                                                    <ShieldX size={18} />
                                                </button>
                                                <button onClick={() => handleAction(item.id, 'approve')} className="p-2 text-red-600 hover:text-red-700 dark:hover:text-red-500 rounded-full" title="อนุมัติการลบ (ลบถาวร)">
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
