import React, { useState, useEffect } from 'react';
import { 
    X, Save, UploadCloud, Trash2, Loader, // Icons for modal
    Clock, Phone, MapPin, Tag, FileText, ChevronDown, Check, // Icons for inputs
    Landmark, Coffee, ShoppingBag, Utensils, Store, Menu // Icons for categories
} from 'lucide-react';

// --- ⭐⭐ START: API URL Configuration (Consistent with App) ⭐⭐ ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
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
            className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
            {...props}
        />
    </div>
);

// --- Categories with Icons ---
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
    const selectedCatInfo = categories.find(c => c.name === selectedCategory) || categories.find(c => c.name === 'อื่นๆ') || categories[0];

    return (
        <div>
            <label htmlFor="category-button-edit" className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                <Tag size={14} />
                <span className="ml-1.5">ประเภท</span>
            </label>
            <div className="relative">
                <button id="category-button-edit" type="button" onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-left">
                    <span className="flex items-center text-gray-800 dark:text-white">
                        <span className={selectedCatInfo.color}>{selectedCatInfo.icon}</span>
                        <span className="ml-3">{selectedCatInfo.name}</span>
                    </span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
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

// --- Special ImageItem for Edit Modal ---
const EditImageItem = ({ imageObj, onRemove }) => {
    const [objectUrl, setObjectUrl] = useState(null);

    useEffect(() => {
        let url = null;
        if (imageObj.type === 'new' && imageObj.data instanceof File) {
            url = URL.createObjectURL(imageObj.data);
            setObjectUrl(url);
        } else if (imageObj.type === 'existing') {
            setObjectUrl(imageObj.data);
        }

        return () => {
            if (url) {
                URL.revokeObjectURL(url);
            }
        };
    }, [imageObj]);

    if (!objectUrl) return null;

    return (
        <div className="relative group aspect-square">
            <img 
                src={objectUrl} 
                alt={`preview`} 
                className="w-full h-full object-cover rounded-lg" 
            />
            <button 
                type="button" 
                onClick={onRemove} 
                className="absolute top-0 right-0 -m-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                aria-label="Remove image"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};


// --- Main EditLocationModal Component ---
const EditLocationModal = ({ item, onClose, onItemUpdated, setNotification, handleAuthError }) => {
    // --- Text fields state ---
    const [name, setName] = useState('');
    const [category, setCategory] = useState(categories[0].name);
    const [description, setDescription] = useState('');
    const [googleMapUrl, setGoogleMapUrl] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [contact, setContact] = useState('');
    
    // --- Image management state ---
    const [images, setImages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Load item data ---
    useEffect(() => {
        if (item) {
            setName(item.name || '');
            setCategory(item.category || categories[0].name);
            setDescription(item.description || '');
            setGoogleMapUrl(item.google_map_url || item.googleMapUrl || '');
            setContact(item.contact || '');

            const currentHours = item.hours || '';
            const timeParts = currentHours.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
            if (timeParts) {
                setStartTime(timeParts[1]);
                setEndTime(timeParts[2]);
            } else {
                setStartTime('');
                setEndTime('');
            }

            const initialImages = [];
            if (item.imageUrl) {
                initialImages.push({ type: 'existing', data: item.imageUrl });
            }
            if (item.detailImages && Array.isArray(item.detailImages)) {
                item.detailImages.forEach(imgUrl => {
                    if (!initialImages.some(img => img.data === imgUrl)) {
                        initialImages.push({ type: 'existing', data: imgUrl });
                    }
                });
            }
            setImages(initialImages);
        }
    }, [item]);

    const handleImageChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({ type: 'new', data: file }));
            setImages(prev => [...prev, ...newFiles].slice(0, 10));
        }
        e.target.value = null;
    };

    const handleRemoveImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleContactChange = (e) => {
        const numericValue = e.target.value.replace(/[^0-9]/g, '');
        if (numericValue.length <= 10) {
            setContact(numericValue);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if ((startTime && !endTime) || (!startTime && endTime)) {
             setNotification({ message: 'กรุณาระบุทั้งเวลาเปิดและเวลาปิด หรือเว้นว่างทั้งคู่', type: 'error'});
             return;
        }

        setIsSubmitting(true);
        const token = localStorage.getItem('token');
        const formData = new FormData();

        // --- แก้ไข: เพิ่ม || '' เพื่อป้องกันส่ง null/undefined ---
        formData.append('name', name || '');
        formData.append('category', category || 'อื่นๆ');
        formData.append('description', description || '');
        formData.append('googleMapUrl', googleMapUrl || '');
        
        const hoursString = startTime && endTime ? `${startTime}-${endTime}` : '';
        formData.append('hours', hoursString);
        formData.append('contact', contact || '');

        const existingImages = images
            .filter(img => img.type === 'existing')
            .map(img => img.data);
        
        const newImageFiles = images
            .filter(img => img.type === 'new')
            .map(img => img.data);

        // ส่ง JSON String เสมอ แม้อาร์เรย์ว่าง
        formData.append('existingImages', JSON.stringify(existingImages));
        
        newImageFiles.forEach(file => {
            formData.append('images', file);
        });
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // ห้ามใส่ 'Content-Type': 'multipart/form-data' เด็ดขาด! fetch จะจัดการเอง
                },
                body: formData,
            });
            
            // ... (โค้ดเดิมส่วนจัดการ response) ...
            if (response.status === 401) {
                // ...
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'ไม่สามารถอัปเดตข้อมูลได้' }));
                throw new Error(errorData.error || `Server Error: ${response.status}`);
            }
            
            const result = await response.json();
            setNotification({ message: 'อัปเดตข้อมูลสำเร็จ!', type: 'success' });
            
            // สำคัญ: ถ้ามีการเปลี่ยนหมวดหมู่ ID อาจจะเปลี่ยน ต้องส่ง result ตัวล่าสุดกลับไป
            onItemUpdated(result); 
            onClose();

        } catch (error) {
            console.error('Failed to update item:', error);
            setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!item) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[99] flex items-center justify-center p-4 animate-fade-in">
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* --- Modal Header --- */}
                <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">แก้ไขข้อมูล: {item.name}</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        aria-label="Close modal"
                    >
                        <X size={24} />
                    </button>
                </div>
                
                {/* --- Modal Body (Scrollable Form) --- */}
                <form 
                    id="edit-location-form"
                    onSubmit={handleSubmit} 
                    className="p-6 overflow-y-auto space-y-5 custom-scrollbar"
                >
                    <InputGroup icon={<Tag />} label="ชื่อสถานที่" id="edit-loc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    
                    <CategoryDropdown selectedCategory={category} onSelect={(cat) => setCategory(cat)} />

                    <InputGroup icon={<MapPin />} label="ลิงก์ Google Maps" id="edit-loc-gmap" type="url" value={googleMapUrl} onChange={(e) => setGoogleMapUrl(e.target.value)} placeholder="วางลิงก์จาก Address Bar หรือปุ่ม Share" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                <Clock size={14} className="mr-1.5" /> เวลาทำการ
                            </label>
                            <div className="flex items-center gap-2">
                                <input 
                                    id="edit-loc-start-time"
                                    type="time" 
                                    value={startTime} 
                                    onChange={(e) => setStartTime(e.target.value)} 
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white" 
                                />
                                <span className="text-gray-500 dark:text-gray-400">-</span>
                                <input 
                                    id="edit-loc-end-time"
                                    type="time" 
                                    value={endTime} 
                                    onChange={(e) => setEndTime(e.target.value)} 
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <InputGroup 
                            icon={<Phone />} 
                            label="เบอร์ติดต่อ (10 หลัก)" 
                            id="edit-loc-contact" 
                            name="contact" 
                            type="tel"
                            value={contact} 
                            onChange={handleContactChange} 
                            placeholder="ใส่เฉพาะตัวเลข 10 หลัก" 
                            maxLength="10" 
                            pattern="[0-9]*"
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="edit-loc-description" className="flex items-center text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
                            <FileText size={14} className="mr-1.5" /> รายละเอียด
                        </label>
                        <textarea id="edit-loc-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="4" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500" placeholder="ใส่คำอธิบายสั้นๆ..."></textarea>
                    </div>

                    {/* --- Image Management Section --- */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">จัดการรูปภาพ (สูงสุด 10 รูป)</label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {images.map((imageObj, index) => (
                                <EditImageItem 
                                    key={imageObj.type === 'new' ? `${imageObj.data.name}-${index}` : imageObj.data} 
                                    imageObj={imageObj} 
                                    onRemove={() => handleRemoveImage(index)} 
                                />
                            ))}
                             {/* Uploader Button (only if less than 10 images) */}
                            {images.length < 10 && (
                                <label htmlFor="image-upload-edit" className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                                    <UploadCloud size={32} />
                                    <span className="text-xs text-center mt-1">เพิ่มรูปภาพ</span>
                                    <input id="image-upload-edit" type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                                </label>
                            )}
                        </div>
                         <input id="image-upload-edit-fallback" type="file" multiple accept="image/*" className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-100 dark:file:bg-gray-600 file:text-gray-700 dark:file:text-gray-200 file:font-semibold hover:file:bg-gray-200 dark:hover:file:bg-gray-500 mt-4" onChange={handleImageChange} />
                    </div>
                </form>

                {/* --- Modal Footer --- */}
                <div className="p-5 border-t dark:border-gray-700 mt-auto flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 rounded-lg bg-gray-100 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 font-semibold transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button 
                        type="submit"
                        form="edit-location-form"
                        disabled={isSubmitting}
                        className="w-[180px] flex justify-center items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-2.5 px-4 rounded-lg hover:shadow-lg hover:shadow-blue-500/50 transition-all shadow-md disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader size={18} className="animate-spin mr-2"/> : <Save size={18} className="mr-2" />}
                        {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditLocationModal;