import React, { useState, useEffect } from 'react';
import { Clock, Phone, X, MapPin, Tag, FileText, Send, ChevronDown, Check, Landmark, Coffee, ShoppingBag, Utensils, ListFilter } from 'lucide-react';

// --- Reusable Sub-Components (No changes needed here) ---

const InputGroup = ({ icon, label, id, ...props }) => (
    <div>
        <label htmlFor={id} className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
            {icon}
            <span className="ml-1.5">{label}</span>
        </label>
        <input
            id={id}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
            {...props}
        />
    </div>
);

const categories = [
    { name: 'วัด', icon: <Landmark size={18} /> },
    { name: 'คาเฟ่', icon: <Coffee size={18} /> },
    { name: 'ห้างสรรพสินค้า', icon: <ShoppingBag size={18} /> },
    { name: 'ร้านอาหาร', icon: <Utensils size={18} /> },
    { name: 'ตลาด', icon: <ListFilter size={18} /> },
    { name: 'อื่นๆ', icon: <ListFilter size={18} /> },
];

const CategoryDropdown = ({ selectedCategory, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">ประเภท</label>
            <div className="relative">
                <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-left">
                    <span className="text-gray-800 dark:text-white">{selectedCategory}</span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
                        {categories.map((cat) => (
                            <button key={cat.name} type="button" onClick={() => { onSelect(cat.name); setIsOpen(false); }} className="w-full flex items-center px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                                {cat.icon}
                                <span className="ml-2">{cat.name}</span>
                                {selectedCategory === cat.name && <Check size={16} className="ml-auto text-blue-600" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ImageItem = ({ image, onRemove }) => {
    const [objectUrl, setObjectUrl] = useState(null);
    useEffect(() => {
        const url = URL.createObjectURL(image);
        setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [image]);

    return (
        <div className="relative group aspect-square">
            {objectUrl && <img src={objectUrl} alt={`preview ${image.name}`} className="w-full h-full object-cover rounded-lg" />}
            <button type="button" onClick={onRemove} className="absolute top-0 right-0 -m-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image">
                <X size={14} />
            </button>
        </div>
    );
};

const ImagePreview = ({ images, onRemove }) => (
    images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {images.map((image, index) => (
                <ImageItem key={index} image={image} onRemove={() => onRemove(index)} />
            ))}
        </div>
    )
);

// --- Main Component ---
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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setNotification({ message: 'กรุณากรอกชื่อสถานที่', type: 'error' });
            return;
        }
        
        // <<< --- START OF CHANGE --- >>>
        // Updated validation to accept both full Google Maps URLs and short URLs (goo.gl)
        if (formData.googleMapUrl && !formData.googleMapUrl.startsWith('https://www.google.com/maps') && !formData.googleMapUrl.startsWith('https://maps.app.goo.gl')) {
            setNotification({ message: 'รูปแบบลิงก์ Google Maps ไม่ถูกต้อง', type: 'error' });
            return;
        }
        // <<< --- END OF CHANGE --- >>>

        setIsSubmitting(true);
        
        const token = localStorage.getItem('token');
        if (!token) {
            handleAuthError();
            setIsSubmitting(false); // Stop submission
            return;
        }

        const data = new FormData();
        for (const key in formData) {
            if (key !== 'images') {
                data.append(key, formData[key]);
            }
        }
        formData.images.forEach(imageFile => {
            data.append('images', imageFile);
        });

        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            const response = await fetch(`${apiUrl}/api/locations`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: data,
            });

            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.error || 'เกิดข้อผิดพลาดที่ไม่รู้จัก');
            }

            setNotification({ message: 'เพิ่มสถานที่ใหม่เรียบร้อยแล้ว!', type: 'success' });
            if (onLocationAdded) onLocationAdded();
            if (setCurrentPage) setCurrentPage('home');

        } catch (err) {
            console.error('Submit Error:', err);
            setNotification({ message: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[80vh] p-4">
            <div className="relative w-full max-w-5xl flex flex-col md:flex-row bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
                <div className="hidden md:block md:w-5/12 relative">
                    <img src="https://i.pinimg.com/736x/a2/be/b5/a2beb5f58adc8386709c8ba8ba67b529.jpg" alt="Travel background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent p-8 flex flex-col justify-end text-white">
                        <h3 className="text-3xl font-bold hero-text-shadow">แบ่งปันสถานที่โปรด</h3>
                        <p className="mt-2 text-lg hero-text-shadow">ร่วมเป็นส่วนหนึ่งในการสร้างชุมชนนักเดินทาง</p>
                    </div>
                </div>

                <div className="w-full md:w-7/12 p-8 sm:p-10 flex flex-col justify-center">
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">เพิ่มสถานที่ใหม่</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto max-h-[70vh] pr-2">
                        <InputGroup icon={<Tag size={14} />} label="ชื่อสถานที่" id="name" name="name" type="text" value={formData.name} onChange={handleInputChange} required />
                        <CategoryDropdown selectedCategory={formData.category} onSelect={(cat) => setFormData({ ...formData, category: cat })} />
                        <InputGroup icon={<MapPin size={14} />} label="ลิงก์ Google Maps" id="googleMapUrl" name="googleMapUrl" type="url" value={formData.googleMapUrl} onChange={handleInputChange} placeholder="วางลิงก์จาก Address Bar หรือปุ่ม Share" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputGroup icon={<Clock size={14} />} label="เวลาทำการ" id="hours" name="hours" type="text" value={formData.hours} onChange={handleInputChange} placeholder="เช่น 09:00 - 18:00 น." />
                            <InputGroup icon={<Phone size={14} />} label="เบอร์ติดต่อ" id="contact" name="contact" type="tel" value={formData.contact} onChange={handleInputChange} placeholder="เช่น 02-123-4567" />
                        </div>
                        <div>
                            <label htmlFor="description" className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1"><FileText size={14} className="mr-1.5" /> รายละเอียด</label>
                            <textarea id="description" name="description" rows="4" value={formData.description} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white" placeholder="ใส่คำอธิบายสั้นๆ..."></textarea>
                        </div>
                        <div>
                            <label htmlFor="images" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">อัปโหลดรูปภาพ (สูงสุด 10 รูป)</label>
                            <input type="file" id="images" name="images" accept="image/*" multiple onChange={handleImageChange} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-100 dark:file:bg-gray-600 file:text-gray-700 dark:file:text-gray-200 file:font-semibold hover:file:bg-gray-200 dark:hover:file:bg-gray-500" />
                        </div>
                        <ImagePreview images={formData.images} onRemove={handleRemoveImage} />
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
