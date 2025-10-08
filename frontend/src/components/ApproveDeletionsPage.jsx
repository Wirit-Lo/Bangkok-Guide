import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Check, X, Clock, ArrowUpDown } from 'lucide-react';

const ApproveDeletionsPage = ({ setNotification, handleAuthError, handleItemClick }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortBy, setSortBy] = useState('newest'); // 'newest' or 'oldest'

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        try {
            // Append the sortBy query parameter to the request URL
            const response = await fetch(`http://localhost:5000/api/locations/pending-deletion?sortBy=${sortBy}`, {
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
    }, [setNotification, handleAuthError, sortBy]); // Add sortBy to dependency array

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]); // This effect will re-run whenever fetchRequests changes (i.e., when sortBy changes)

    const handleAction = async (locationId, action) => {
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        try {
            const response = await fetch(`http://localhost:5000/api/locations/${locationId}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            
            setNotification({ message: data.message, type: 'success' });
            fetchRequests(); // Refresh the list
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center">
                    <ShieldCheck size={32} className="mr-3 text-blue-600 dark:text-blue-400" />
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">จัดการคำขอลบสถานที่</h1>
                </div>
                <div className="relative flex items-center">
                     <ArrowUpDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="appearance-none w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-200"
                        aria-label="Sort deletion requests"
                    >
                        <option value="newest">ใหม่สุดก่อน</option>
                        <option value="oldest">เก่าสุดก่อน</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <p className="dark:text-gray-300 text-center">กำลังโหลดข้อมูล...</p>
            ) : requests.length === 0 ? (
                <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <p className="text-gray-500 dark:text-gray-400">ไม่มีคำขอลบที่รอการอนุมัติในขณะนี้</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                        {requests.map(loc => (
                            <li key={loc.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-center cursor-pointer flex-1 mb-4 md:mb-0" onClick={() => handleItemClick(loc)}>
                                    <img src={loc.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'} alt={loc.name} className="w-20 h-20 object-cover rounded-md mr-4"/>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-gray-100">{loc.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">หมวดหมู่: {loc.category}</p>
                                        <div className="flex items-center text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                            <Clock size={14} className="mr-1" />
                                            <span>ส่งคำขอเมื่อ: {new Date(loc.deletion_requested_at).toLocaleString('th-TH')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2 self-end md:self-center">
                                    <button onClick={() => handleAction(loc.id, 'approve-deletion')} className="px-3 py-2 flex items-center bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium">
                                        <Check size={16} className="mr-1" /> อนุมัติ
                                    </button>
                                    <button onClick={() => handleAction(loc.id, 'deny-deletion')} className="px-3 py-2 flex items-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium">
                                        <X size={16} className="mr-1" /> ปฏิเสธ
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ApproveDeletionsPage;
