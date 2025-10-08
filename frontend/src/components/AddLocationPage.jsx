import React, { useState } from 'react';
import { Clock, Phone, X, MapPin, Tag, FileText, Camera, Send, ChevronDown, Check, Landmark, Coffee, ShoppingBag, Utensils, ListFilter } from 'lucide-react';

const categories = [
    { name: 'วัด', icon: <Landmark size={18} /> },
    { name: 'คาเฟ่', icon: <Coffee size={18} /> },
    { name: 'ห้างสรรพสินค้า', icon: <ShoppingBag size={18} /> },
    { name: 'ร้านอาหาร', icon: <Utensils size={18} /> },
    { name: 'ตลาด', icon: <ListFilter size={18} /> },
    { name: 'อื่นๆ', icon: <ListFilter size={18} /> },
];

// <<< MODIFIED: Added setNotification and handleAuthError to props
const AddLocationPage = ({ setCurrentPage, onLocationAdded, setNotification, handleAuthError }) => {
    const [formData, setFormData] = useState({
        name: '',
        category: 'วัด',
        googleMapUrl: '',
        description: '',
        hours: '',
        contact: '',
        images: [],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleCategorySelect = (categoryName) => {
        setFormData({ ...formData, category: categoryName });
        setIsCategoryOpen(false);
    };

    const handleImageChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFormData(prevState => ({
                ...prevState,
                images: [...prevState.images, ...newFiles].slice(0, 10)
            }));
            e.target.value = null;
        }
    };
    
    const handleRemoveImage = (indexToRemove) => {
        setFormData(prevState => ({
            ...prevState,
            images: prevState.images.filter((_, index) => index !== indexToRemove)
        }));
    };

    // <<< MODIFIED: Updated handleSubmit to include authentication
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const token = localStorage.getItem('token');
        if (!token) {
            handleAuthError(); // Call auth error handler if no token
            return;
        }

        const data = new FormData();
        data.append('name', formData.name);
        data.append('category', formData.category);
        data.append('description', formData.description);
        data.append('googleMapUrl', formData.googleMapUrl);
        data.append('hours', formData.hours);
        data.append('contact', formData.contact);
        
        if (formData.images.length > 0) {
            formData.images.forEach((imageFile) => {
                data.append('images', imageFile);
            });
        }

        try {
            const response = await fetch('http://localhost:5000/api/locations', {
                method: 'POST',
                headers: {
                    // Add the Authorization header with the token
                    'Authorization': `Bearer ${token}`
                },
                body: data,
            });

            // Handle auth errors specifically
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'ไม่สามารถบันทึกข้อมูลได้');
            }

            setNotification({ message: 'เพิ่มสถานที่ใหม่เรียบร้อยแล้ว!', type: 'success' });
            if (onLocationAdded) onLocationAdded();
            if (setCurrentPage) setCurrentPage('home');

        } catch (err) {
            console.error('เกิดข้อผิดพลาด:', err);
            setNotification({ message: err.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] p-4">
            <div className="relative w-full max-w-5xl flex flex-col md:flex-row bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                
                <div className="hidden md:block md:w-5/12 relative">
                    <img 
                        src="https://i.pinimg.com/736x/a2/be/b5/a2beb5f58adc8386709c8ba8ba67b529.jpg"
                        alt="Travel background"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent p-8 flex flex-col justify-end text-white">
                        <h3 className="text-3xl font-bold hero-text-shadow">แบ่งปันสถานที่โปรด</h3>
                        <p className="mt-2 text-lg hero-text-shadow">ร่วมเป็นส่วนหนึ่งในการสร้างชุมชนนักเดินทางในบางเขน</p>
                    </div>
                </div>

                <div className="w-full md:w-7/12 p-8 sm:p-10 flex flex-col justify-center">
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">เพิ่มสถานที่ใหม่</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto max-h-[70vh] pr-2">
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">ชื่อสถานที่</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white" required />
                        </div>

                        {/* --- Custom Dropdown --- */}
                        <div>
                            <label htmlFor="category" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">ประเภท</label>
                            <div className="relative">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                    className="w-full flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-left"
                                >
                                    <span className="text-gray-800 dark:text-white">{formData.category}</span>
                                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isCategoryOpen && (
                                    <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.name}
                                                type="button"
                                                onClick={() => handleCategorySelect(cat.name)}
                                                className="w-full flex items-center px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                                            >
                                                {cat.icon}
                                                <span className="ml-2">{cat.name}</span>
                                                {formData.category === cat.name && <Check size={16} className="ml-auto text-blue-600" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="googleMapUrl" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">ลิงก์ Google Maps</label>
                            <input type="url" id="googleMapUrl" name="googleMapUrl" value={formData.googleMapUrl} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white" placeholder="วางลิงก์แบบเต็มจาก Address Bar" />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="hours" className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1"><Clock size={14} className="mr-1.5" /> เวลาทำการ</label>
                                <input type="text" id="hours" name="hours" value={formData.hours} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" placeholder="เช่น 09:00 - 18:00 น." />
                            </div>
                            <div>
                                <label htmlFor="contact" className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1"><Phone size={14} className="mr-1.5" /> เบอร์ติดต่อ</label>
                                <input type="tel" id="contact" name="contact" value={formData.contact} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" placeholder="เช่น 02-123-4567" />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">รายละเอียด</label>
                            <textarea id="description" name="description" rows="4" value={formData.description} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" placeholder="ใส่คำอธิบายสั้นๆ..."></textarea>
                        </div>
                        
                        <div>
                            <label htmlFor="images" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">อัปโหลดรูปภาพ (สูงสุด 10 รูป)</label>
                            <input type="file" id="images" name="images" accept="image/*" multiple onChange={handleImageChange} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-100 dark:file:bg-gray-600 file:text-gray-700 dark:file:text-gray-200 file:font-semibold hover:file:bg-gray-200 dark:hover:file:bg-gray-500" />
                        </div>

                        {formData.images.length > 0 && (
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                                {formData.images.map((image, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        <img src={URL.createObjectURL(image)} alt={`preview ${index}`} className="w-full h-full object-cover rounded-lg" />
                                        <button type="button" onClick={() => handleRemoveImage(index)} className="absolute top-0 right-0 -m-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all shadow-md disabled:from-gray-400 disabled:to-gray-500">
                            <Send size={18} className="mr-2" />
                            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddLocationPage;

