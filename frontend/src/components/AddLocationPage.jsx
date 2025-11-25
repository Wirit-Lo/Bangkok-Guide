import React, { useState, useEffect } from 'react';
import { Clock, Phone, X, MapPin, Tag, FileText, Send, ChevronDown, Check, Landmark, Coffee, ShoppingBag, Utensils, Store, Menu, UploadCloud, Loader } from 'lucide-react';

// --- ⭐⭐ START: API URL Configuration ⭐⭐ ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    // Replace with your actual deployed backend URL
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();
// --- ⭐⭐ END: API URL Configuration ⭐⭐ ---

// --- Reusable Sub-Components ---

const InputGroup = ({ icon, label, id, ...props }) => (
    <div>
        <label htmlFor={id} className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
            {React.cloneElement(icon, { size: 14 })}
            <span className="ml-1.5">{label}</span>
        </label>
        <input
            id={id}
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
            {...props}
        />
    </div>
);

const categories = [
    { name: 'วัด', icon: <Landmark size={18} />, color: 'text-amber-500' },
    { name: 'ร้านอาหาร', icon: <Utensils size={18} />, color: 'text-emerald-500' },
    { name: 'คาเฟ่', icon: <Coffee size={18} />, color: 'text-orange-500' },
    { name: 'ตลาด', icon: <Store size={18} />, color: 'text-violet-500' },
    { name: 'ห้างสรรพสินค้า', icon: <ShoppingBag size={18} />, color: 'text-rose-500' },
    { name: 'อื่นๆ', icon: <Menu size={18} />, color: 'text-slate-500' },
];

const CategoryDropdown = ({ selectedCategory, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedCatInfo = categories.find(c => c.name === selectedCategory) || categories[0];

    return (
        <div>
            <label htmlFor="category-button" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">ประเภท</label>
            <div className="relative">
                <button id="category-button" type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-left">
                    <span className="flex items-center text-gray-800 dark:text-white">
                        <span className={selectedCatInfo.color}>{selectedCatInfo.icon}</span>
                        <span className="ml-3">{selectedCategory}</span>
                    </span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                        {categories.map((cat) => (
                            <button key={cat.name} type="button" onClick={() => { onSelect(cat.name); setIsOpen(false); }} className="w-full flex items-center px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                                <span className={cat.color}>{cat.icon}</span>
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
        if (image instanceof File) {
            const url = URL.createObjectURL(image);
            setObjectUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
             setObjectUrl(image);
        }
    }, [image]);

    if (!objectUrl) return null;

    return (
        <div className="relative group aspect-square">
            <img src={objectUrl} alt={`preview ${image.name || 'image'}`} className="w-full h-full object-cover rounded-lg" />
            <button type="button" onClick={onRemove} className="absolute top-0 right-0 -m-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image">
                <X size={14} />
            </button>
        </div>
    );
};


const ImageUploader = ({ images, onImageChange, onRemove }) => (
    <div>
        <label htmlFor="images" className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">อัปโหลดรูปภาพ (สูงสุด 10 รูป)</label>
        <input type="file" id="images" name="images" accept="image/*" multiple onChange={onImageChange} className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-100 dark:file:bg-gray-600 file:text-gray-700 dark:file:text-gray-200 file:font-semibold hover:file:bg-gray-200 dark:hover:file:bg-gray-500" />
        {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
                {images.map((image, index) => (
                    <ImageItem key={index} image={image} onRemove={() => onRemove(index)} />
                ))}
            </div>
        )}
    </div>
);


// --- Main Component ---
const AddLocationPage = ({ setCurrentPage, onLocationAdded, setNotification, handleAuthError }) => {
    const [formData, setFormData] = useState({
        name: '',
        category: categories[0].name,
        googleMapUrl: '',
        description: '',
        startTime: '',
        endTime: '',
        contact: '', // Initialize as empty string
        images: [],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'contact') {
            // Allow digits only
            const numericValue = value.replace(/[^0-9]/g, '');
            // Limit length, but allow empty string
            if (numericValue.length <= 10) {
                setFormData(prev => ({ ...prev, [name]: numericValue }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleTimeChange = (e) => {
         const { name, value } = e.target;
         setFormData(prev => ({ ...prev, [name]: value }));
    };

    // --- Validate form on every data change ---
    useEffect(() => {
        const { name, googleMapUrl, description, images, startTime, endTime } = formData;

        // 1. Check required text fields (Contact is NOT included here)
        const requiredFieldsFilled =
            name.trim() !== '' &&
            googleMapUrl.trim() !== '' &&
            description.trim() !== '';

        // 2. Check for at least one image
        const hasImage = images.length > 0;

        // 3. Check time validation
        const timeIsValid = (startTime && endTime) || (!startTime && !endTime);

        // ✅ Set form validity (Contact is optional, so it's not in the condition)
        setIsFormValid(requiredFieldsFilled && hasImage && timeIsValid);

    }, [formData]);


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
        if (!formData.googleMapUrl.trim()) {
            setNotification({ message: 'กรุณากรอกลิงก์ Google Maps', type: 'error' });
            return;
        }
        if (formData.images.length === 0) {
            setNotification({ message: 'กรุณาอัปโหลดอย่างน้อย 1 รูป', type: 'error' });
            return;
        }
        if (!formData.description.trim()) {
            setNotification({ message: 'กรุณากรอกรายละเอียด', type: 'error' });
            return;
        }

        if (formData.googleMapUrl && !formData.googleMapUrl.startsWith('https://www.google.com/maps') && !formData.googleMapUrl.startsWith('https://maps.app.goo.gl')) {
            setNotification({ message: 'รูปแบบลิงก์ Google Maps ไม่ถูกต้อง', type: 'error' });
            return;
        }

        if ((formData.startTime && !formData.endTime) || (!formData.startTime && formData.endTime)) {
             setNotification({ message: 'กรุณาระบุทั้งเวลาเปิดและเวลาปิด หรือเว้นว่างทั้งคู่', type: 'error'});
             return;
        }

        setIsSubmitting(true);

        const token = localStorage.getItem('token');
        console.log("Token retrieved for Add Location:", token ? 'Exists' : 'MISSING!');

        if (!token) {
            console.error("Add Location Error: No token found. Calling handleAuthError.");
            handleAuthError();
            setIsSubmitting(false);
            return;
        }

        const data = new FormData();
        for (const key in formData) {
            if (key !== 'images' && key !== 'startTime' && key !== 'endTime') {
                // If contact is empty string, it sends empty string (which is fine)
                data.append(key, formData[key]);
            }
        }

        const hoursString = formData.startTime && formData.endTime ? `${formData.startTime}-${formData.endTime}` : '';
        data.append('hours', hoursString);

        formData.images.forEach(imageFile => {
            if (imageFile instanceof File) {
                 data.append('images', imageFile);
            }
        });

        try {
            const response = await fetch(`${API_BASE_URL}/api/locations`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: data,
            });

            console.log("Add Location Response Status:", response.status);

            if (response.status === 401 || response.status === 403) {
                console.error("Add Location Error: Received 401/403. Calling handleAuthError.");
                handleAuthError();
                return;
            }

            const responseData = await response.json();
            if (!response.ok) {
                console.error("Add Location Error Data:", responseData);
                throw new Error(responseData.error || 'เกิดข้อผิดพลาดที่ไม่รู้จัก');
            }

            console.log("Add Location Success:", responseData);
            setNotification({ message: 'เพิ่มสถานที่ใหม่เรียบร้อยแล้ว!', type: 'success' });
            if (onLocationAdded) onLocationAdded(responseData.id);
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
                {/* Left side image */}
                <div className="hidden md:block md:w-5/12 relative">
                    <img src="https://i.pinimg.com/736x/a2/be/b5/a2beb5f58adc8386709c8ba8ba67b529.jpg" alt="Travel background" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-8 flex flex-col justify-end text-white">
                        <h3 className="text-3xl font-bold" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>แบ่งปันสถานที่โปรด</h3>
                        <p className="mt-2 text-lg" style={{ textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>ร่วมเป็นส่วนหนึ่งในการสร้างชุมชนนักเดินทาง</p>
                    </div>
                </div>

                {/* Right side form */}
                <div className="w-full md:w-7/12 p-8 sm:p-10 flex flex-col justify-center">
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">เพิ่มสถานที่ใหม่</h2>

                    <form onSubmit={handleSubmit} className="space-y-5 flex-grow overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                        <InputGroup icon={<Tag />} label="ชื่อสถานที่" id="name" name="name" type="text" value={formData.name} onChange={handleInputChange} required />
                        <CategoryDropdown selectedCategory={formData.category} onSelect={(cat) => setFormData(prev => ({ ...prev, category: cat }))} />
                        <InputGroup icon={<MapPin />} label="ลิงก์ Google Maps" id="googleMapUrl" name="googleMapUrl" type="url" value={formData.googleMapUrl} onChange={handleInputChange} placeholder="วางลิงก์จาก Address Bar หรือปุ่ม Share" />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                    <Clock size={14} className="mr-1.5" /> เวลาทำการ
                                </label>
                                <div className="flex items-center gap-2">
                                     <input
                                         id="startTime"
                                         name="startTime"
                                         type="time"
                                         value={formData.startTime}
                                         onChange={handleTimeChange}
                                         className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                                     />
                                     <span className="text-gray-500 dark:text-gray-400">-</span>
                                     <input
                                         id="endTime"
                                         name="endTime"
                                         type="time"
                                         value={formData.endTime}
                                         onChange={handleTimeChange}
                                         className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                                     />
                                </div>
                            </div>
                            {/* --- ⭐⭐ UPDATED: Contact Field is now Optional ⭐⭐ --- */}
                            <InputGroup
                                icon={<Phone />}
                                label="เบอร์ติดต่อ (ไม่บังคับ)"
                                id="contact"
                                name="contact"
                                type="tel"
                                value={formData.contact}
                                onChange={handleInputChange}
                                placeholder="ระบุเบอร์โทรศัพท์ (ถ้ามี)"
                                maxLength="10"
                                pattern="[0-9]*"
                            />
                            {/* --- ⭐⭐ END UPDATE ⭐⭐ --- */}
                        </div>

                        <div>
                            <label htmlFor="description" className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1"><FileText size={14} className="mr-1.5" /> รายละเอียด</label>
                            <textarea id="description" name="description" rows="4" value={formData.description} onChange={handleInputChange} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" placeholder="ใส่คำอธิบายสั้นๆ..."></textarea>
                        </div>
                        <ImageUploader images={formData.images} onImageChange={handleImageChange} onRemove={handleRemoveImage} />

                        <div className="pt-2">
                            <button type="submit" disabled={isSubmitting || !isFormValid} className="w-full flex justify-center items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all shadow-md disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed disabled:opacity-50">
                                {isSubmitting ? <Loader size={18} className="animate-spin mr-2"/> : <Send size={18} className="mr-2" />}
                                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddLocationPage;