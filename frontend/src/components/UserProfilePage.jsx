import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, Mail, Save, AlertTriangle, ShieldOff, X, Camera } from 'lucide-react';

// --- START: API URL Configuration ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();
// --- END: API URL Configuration ---


// --- Helper Function from Code 2 (Better Image Logic) ---
const getInitialImage = (user) => {
    if (!user) return null;
    if (Array.isArray(user.profileImageUrl) && user.profileImageUrl.length > 0) return user.profileImageUrl[0];
    if (typeof user.profileImageUrl === 'string') return user.profileImageUrl;
    if (user.profileImage) return user.profileImage;
    if (user.user_metadata?.avatar_url) return user.user_metadata.avatar_url;
    return null;
};


// --- Delete Account Modal (From Code 1 - More Secure) ---
const DeleteAccountModal = ({ isOpen, onClose, onConfirm, isDeleting }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setShowPassword(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(password);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6 relative" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    <X size={24} />
                </button>

                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={40} className="text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">ยืนยันการลบบัญชี</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        การกระทำนี้เป็นการลบอย่างถาวรและไม่สามารถกู้คืนได้ ข้อมูลทั้งหมดของคุณจะถูกลบ
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="password-confirm-delete" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            เพื่อยืนยัน โปรดกรอกรหัสผ่านปัจจุบันของคุณ:
                        </label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password-confirm-delete"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
                                required
                                autoFocus
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors">
                            ยกเลิก
                        </button>
                        <button type="submit" disabled={isDeleting || !password} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center">
                            {isDeleting ? 'กำลังลบ...' : 'ยืนยันและลบบัญชี'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- User Profile Page Component ---
const UserProfilePage = ({ currentUser, onProfileUpdate, handleAuthError, handleLogout, setNotification }) => {
    // State Initialization
    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [profileImage, setProfileImage] = useState(null); // File object
    const [imagePreview, setImagePreview] = useState(null); // URL string

    // UI States
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Effect: Update state when currentUser changes (Merged Logic)
    useEffect(() => {
        if (currentUser) {
            setDisplayName(currentUser.displayName || '');
            setUsername(currentUser.username || '');
            // Use the robust image getter from Code 2
            setImagePreview(getInitialImage(currentUser));
            
            // Reset form fields
            setCurrentPassword('');
            setNewPassword('');
            setProfileImage(null);
        }
    }, [currentUser]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImage(file);
            // Create preview URL
            if (imagePreview && imagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(imagePreview);
            }
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Validation Logic from Code 2 (Ensure password is provided if changing sensitive data)
        if (newPassword && !currentPassword && currentUser.provider !== 'social') {
            setNotification({ message: 'กรุณากรอกรหัสผ่านปัจจุบันเพื่อเปลี่ยนรหัสผ่าน', type: 'error' });
            setIsSubmitting(false);
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        const formData = new FormData();
        formData.append('displayName', displayName);
        formData.append('username', username);
        if (currentPassword) formData.append('currentPassword', currentPassword);
        if (newPassword) formData.append('newPassword', newPassword);
        if (profileImage) formData.append('profileImage', profileImage);

        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (response.status === 401 || response.status === 403) return handleAuthError();
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');

            onProfileUpdate(data.user, data.token); 
            setNewPassword('');
            setCurrentPassword('');
            // Reset file input
            const fileInput = document.getElementById('profile-image-upload');
            if (fileInput) fileInput.value = "";
            
            setProfileImage(null);
            setNotification({ message: 'อัปเดตโปรไฟล์สำเร็จ!', type: 'success' });

        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAccount = async (password) => {
        setIsDeleting(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ currentPassword: password })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'เกิดข้อผิดพลาด');
            }

            setNotification({ message: 'ลบบัญชีผู้ใช้สำเร็จ', type: 'success' });
            handleLogout();
            
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
            <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">แก้ไขโปรไฟล์</h1>
                
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Image Upload Section */}
                        <div className="flex flex-col sm:flex-row items-center gap-8 pb-6 border-b dark:border-gray-700">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-700 shadow-md">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                            <User size={48} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <label htmlFor="profile-image-upload" className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white cursor-pointer hover:bg-blue-700 transition-colors shadow-lg group-hover:scale-110 transform duration-200">
                                    <Camera size={18} />
                                </label>
                                <input id="profile-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </div>
                            
                            <div className="text-center sm:text-left">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{displayName || 'User'}</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">อัปเดตรูปภาพและข้อมูลส่วนตัวของคุณ</p>
                                <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 text-xs font-medium">
                                    {currentUser.role === 'admin' ? 'Administrator' : 'Member'}
                                </div>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="display-name-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">ชื่อที่แสดง</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input id="display-name-input" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="username-input-profile" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">ชื่อผู้ใช้ (สำหรับเข้าระบบ)</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input 
                                        id="username-input-profile" 
                                        type="text" 
                                        value={username} 
                                        onChange={e => setUsername(e.target.value)} 
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" 
                                        autoComplete="username" 
                                        disabled={currentUser.provider === 'social'} 
                                    />
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">การเปลี่ยนชื่อผู้ใช้ต้องยืนยันด้วยรหัสผ่านปัจจุบัน</p>
                            </div>
                        </div>

                        {/* Password Section (Only if not social login) */}
                        {currentUser.provider !== 'social' && (
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">เปลี่ยนรหัสผ่าน</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="current-password-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านปัจจุบัน</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                            <input 
                                                id="current-password-input" 
                                                type={showCurrentPassword ? 'text' : 'password'} 
                                                value={currentPassword} 
                                                onChange={e => setCurrentPassword(e.target.value)} 
                                                placeholder="กรอกเพื่อยืนยันการเปลี่ยนแปลง" 
                                                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" 
                                                autoComplete="current-password" 
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                            >
                                                {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="new-password-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">รหัสผ่านใหม่</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                            <input 
                                                id="new-password-input" 
                                                type={showNewPassword ? 'text' : 'password'} 
                                                value={newPassword} 
                                                onChange={e => setNewPassword(e.target.value)} 
                                                placeholder="เว้นว่างไว้หากไม่ต้องการเปลี่ยน" 
                                                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-white" 
                                                autoComplete="new-password" 
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                            >
                                                {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={isSubmitting} className="flex items-center justify-center bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 shadow-lg">
                                <Save size={20} className="mr-2" />
                                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Danger Zone */}
                <div className="mt-12 border-t-2 border-red-500/30 pt-8">
                    <h2 className="text-2xl font-bold text-red-600 dark:text-red-500 flex items-center mb-4">
                        <AlertTriangle className="mr-3"/>
                        โซนอันตราย
                    </h2>
                    <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100">ลบบัญชีผู้ใช้ของคุณ</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">เมื่อลบบัญชีแล้ว ข้อมูลทั้งหมดจะถูกลบอย่างถาวร</p>
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