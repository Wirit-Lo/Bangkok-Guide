import React, { useState, useEffect } from 'react';
import { X, Save, Upload, Trash2 } from 'lucide-react';

const EditLocationModal = ({ item, onClose, onItemUpdated, setNotification, handleAuthError }) => {
    // --- Text fields state ---
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [googleMapUrl, setGoogleMapUrl] = useState('');
    const [hours, setHours] = useState('');
    const [contact, setContact] = useState('');
    
    // --- Image management state ---
    const [images, setImages] = useState([]); // Will store objects like { type: 'existing'/'new', data: url/File }

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (item) {
            // Set text fields
            setName(item.name || '');
            setCategory(item.category || '');
            setDescription(item.description || '');
            setGoogleMapUrl(item.google_map_url || item.googleMapUrl || '');
            setHours(item.hours || '');
            setContact(item.contact || '');

            // --- Populate initial images ---
            const initialImages = [];
            if (item.imageUrl) {
                initialImages.push({ type: 'existing', data: item.imageUrl });
            }
            if (item.detailImages && Array.isArray(item.detailImages)) {
                item.detailImages.forEach(imgUrl => {
                    // Avoid duplicates if imageUrl is also in detailImages
                    if (!initialImages.some(img => img.data === imgUrl)) {
                        initialImages.push({ type: 'existing', data: imgUrl });
                    }
                });
            }
            setImages(initialImages);
        }
    }, [item]);

    // --- Handle adding new image files ---
    const handleImageChange = (e) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({ type: 'new', data: file }));
            setImages(prev => [...prev, ...newFiles]);
        }
    };

    // --- Handle removing an image (works for both existing and new) ---
    const handleRemoveImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = localStorage.getItem('token');

        const formData = new FormData();
        formData.append('name', name);
        formData.append('category', category);
        formData.append('description', description);
        formData.append('googleMapUrl', googleMapUrl);
        formData.append('hours', hours);
        formData.append('contact', contact);

        const existingImages = images
            .filter(img => img.type === 'existing')
            .map(img => img.data);
        
        const newImageFiles = images
            .filter(img => img.type === 'new')
            .map(img => img.data);

        formData.append('existingImages', JSON.stringify(existingImages));
        newImageFiles.forEach(file => {
            formData.append('images', file);
        });
        
        try {
            const response = await fetch(`http://localhost:5000/api/locations/${item.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            });
            
            if (response.status === 403) {
                handleAuthError();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'ไม่สามารถอัปเดตข้อมูลได้');
            }

            const result = await response.json();
            setNotification({ message: 'อัปเดตข้อมูลสำเร็จ!', type: 'success' });
            onItemUpdated(result);

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
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">แก้ไขข้อมูล: {item.name}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <X size={24} className="text-gray-600 dark:text-gray-300" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                    {/* --- Text input fields --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อสถานที่</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมวดหมู่</label>
                        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คำอธิบาย</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="4" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"></textarea>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Maps URL</label>
                        <input type="url" value={googleMapUrl} onChange={(e) => setGoogleMapUrl(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เวลาทำการ</label>
                        <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ข้อมูลติดต่อ</label>
                        <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    </div>

                    {/* --- Image Management Section --- */}
                    <hr className="dark:border-gray-600" />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">จัดการรูปภาพ</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {images.map((image, index) => (
                                <div key={image.type === 'new' ? `${image.data.name}-${index}` : image.data} className="relative group aspect-square">
                                    <img 
                                        src={image.type === 'new' ? URL.createObjectURL(image.data) : image.data} 
                                        alt={`preview ${index}`} 
                                        className="w-full h-full object-cover rounded-lg" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => handleRemoveImage(index)} 
                                        className="absolute top-0 right-0 -m-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="ลบรูปภาพนี้"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                             <label htmlFor="image-upload" className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600">
                                <Upload size={32} className="text-gray-400" />
                                <span className="text-xs text-center text-gray-500 mt-1">เพิ่มรูปภาพ</span>
                                <input id="image-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </div>
                    </div>

                </form>

                <div className="p-4 border-t dark:border-gray-700 mt-auto flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 font-semibold">
                        ยกเลิก
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 disabled:bg-gray-400"
                    >
                        <Save size={18} />
                        {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditLocationModal;

