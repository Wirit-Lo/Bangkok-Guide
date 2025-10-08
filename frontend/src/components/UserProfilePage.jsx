import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Mail, Save, AlertTriangle, ShieldOff, X } from 'lucide-react';

// <<< NEW: Modal component for account deletion confirmation >>>
const DeleteAccountModal = ({ isOpen, onClose, onConfirm, isDeleting }) => {
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(password);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={40} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">ยืนยันการลบบัญชี</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        การกระทำนี้เป็นการลบอย่างถาวรและไม่สามารถกู้คืนได้ ข้อมูลทั้งหมดของคุณ รวมถึงรีวิว, ความคิดเห็น, และรายการโปรดจะถูกลบทั้งหมด
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="password-confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            เพื่อยืนยัน โปรดกรอกรหัสผ่านปัจจุบันของคุณ:
                        </label>
                        <input
                            type="password"
                            id="password-confirm"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            disabled={isDeleting || !password}
                            className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors flex items-center"
                        >
                            {isDeleting ? 'กำลังลบ...' : 'ยืนยันและลบบัญชี'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const UserProfilePage = ({ currentUser, onProfileUpdate, handleAuthError, handleLogout, setNotification }) => {
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // <<< NEW: State for delete confirmation modal >>>
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);


    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName || '');
            setUsername(currentUser.username || '');
            setImagePreview(currentUser.profile_image_url || null);
        }
    }, [currentUser]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        const formData = new FormData();
        formData.append('displayName', displayName);
        formData.append('username', username);
        if (currentPassword) formData.append('currentPassword', currentPassword);
        if (newPassword) formData.append('newPassword', newPassword);
        if (profileImage) formData.append('profileImage', profileImage);

        try {
            const response = await fetch(`http://localhost:5000/api/users/${currentUser.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (response.status === 401 || response.status === 403) return handleAuthError();
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');

            onProfileUpdate(data.user); // Update user data in App.jsx state
            setNewPassword('');
            setCurrentPassword('');

        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // <<< NEW: Function to handle account deletion >>>
    const handleDeleteAccount = async (password) => {
        setIsDeleting(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        try {
            const response = await fetch(`http://localhost:5000/api/users/${currentUser.id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ currentPassword: password })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');

            setNotification({ message: data.message, type: 'success' });
            handleLogout(); // Log the user out after successful deletion
            
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };


    if (!currentUser) {
        return <div className="text-center p-8">กรุณาเข้าสู่ระบบ</div>;
    }

    return (
        <>
            <DeleteAccountModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                isDeleting={isDeleting}
            />
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">แก้ไขโปรไฟล์</h1>
                
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Profile Image Section */}
                        <div className="flex items-center space-x-6">
                            <div className="relative">
                                <img
                                    src={imagePreview || 'https://placehold.co/128x128/e2e8f0/333333?text=User'}
                                    alt="Profile Preview"
                                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                                />
                            </div>
                            <div>
                                <label htmlFor="profile-image-upload" className="cursor-pointer bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                                    เปลี่ยนรูปภาพ
                                </label>
                                <input id="profile-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">รองรับไฟล์ PNG, JPG, GIF</p>
                            </div>
                        </div>

                        {/* User Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">ชื่อที่แสดง</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">ชื่อผู้ใช้ (สำหรับเข้าระบบ)</label>
                                <div className="relative">
                                     <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" />
                                </div>
                            </div>
                        </div>

                        {/* Password Section */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">เปลี่ยนรหัสผ่าน</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านปัจจุบัน</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input type={showPassword ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="กรอกเพื่อเปลี่ยนชื่อผู้ใช้/รหัสผ่าน" className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านใหม่</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน" className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={isSubmitting} className="flex items-center justify-center bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400">
                                <Save size={20} className="mr-2" />
                                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* <<< NEW: Danger Zone for Account Deletion >>> */}
                <div className="mt-12 border-t-2 border-red-500/30 pt-8">
                     <h2 className="text-2xl font-bold text-red-600 dark:text-red-500 flex items-center mb-4">
                        <AlertTriangle className="mr-3"/>
                        โซนอันตราย
                    </h2>
                    <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">ลบบัญชีผู้ใช้ของคุณ</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">เมื่อลบบัญชีแล้ว ข้อมูลทั้งหมดจะถูกลบอย่างถาวรและไม่สามารถกู้คืนได้</p>
                        </div>
                        <button 
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center flex-shrink-0"
                        >
                            <ShieldOff size={18} className="mr-2"/>
                            ลบบัญชี
                        </button>
                    </div>
                </div>

            </div>
        </>
    );
};

export default UserProfilePage;
