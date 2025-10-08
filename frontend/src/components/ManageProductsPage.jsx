import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, X, Image as ImageIcon, Save, Gift, MapPin } from 'lucide-react';

// Helper function to group products by location
const groupProducts = (products) => {
    if (!products) return {};
    return products.reduce((acc, product) => {
        const key = product.location_name || 'ของขึ้นชื่อส่วนกลาง';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(product);
        return acc;
    }, {});
};


const ManageProductsPage = ({ setNotification, handleAuthError }) => {
    const [groupedProducts, setGroupedProducts] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
            return handleAuthError();
        }

        try {
            const response = await fetch('http://localhost:5000/api/famous-products/all', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลได้');
            
            const data = await response.json();
            setGroupedProducts(groupProducts(data));
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [setNotification, handleAuthError]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleOpenModal = (product = null) => {
        setEditingProduct(product || { name: '', description: '', image: null, imageUrl: null });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleDelete = async (productId) => {
        if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
        
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        // Use the more general '/api/products/' endpoint which allows admins to delete any product
        try {
            const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'เกิดข้อผิดพลาดในการลบ');
            }
            setNotification({ message: 'ลบข้อมูลสำเร็จ', type: 'success' });
            fetchProducts();
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">จัดการข้อมูลของขึ้นชื่อทั้งหมด</h1>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="flex items-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus size={20} className="mr-2" />
                    เพิ่มของขึ้นชื่อ (ส่วนกลาง)
                </button>
            </div>
            {isLoading ? (
                <p className="dark:text-gray-300">กำลังโหลดข้อมูล...</p>
            ) : (
                <div className="space-y-8">
                    {Object.keys(groupedProducts).length > 0 ? Object.entries(groupedProducts).map(([groupName, products]) => (
                        <div key={groupName}>
                            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-3 pb-2 border-b-2 border-gray-200 dark:border-gray-600 flex items-center">
                                {groupName === 'ของขึ้นชื่อส่วนกลาง' ? <Gift className="mr-3 text-amber-500" /> : <MapPin className="mr-3 text-teal-500" />}
                                {groupName}
                            </h2>
                            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {products.length > 0 ? products.map(product => (
                                        <li key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <div className="flex items-center min-w-0">
                                                <img src={product.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'} alt={product.name} className="w-16 h-16 object-cover rounded-md mr-4 flex-shrink-0"/>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{product.name}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{product.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-2 flex-shrink-0 ml-4">
                                                <button onClick={() => handleOpenModal(product)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"><Edit size={18} /></button>
                                                <button onClick={() => handleDelete(product.id)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600"><Trash2 size={18} /></button>
                                            </div>
                                        </li>
                                    )) : (
                                        <li className="p-4 text-center text-gray-500 dark:text-gray-400">ยังไม่มีข้อมูล</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )) : (
                         <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">ไม่พบข้อมูลของขึ้นชื่อในระบบ</p>
                        </div>
                    )}
                </div>
            )}
            {isModalOpen && (
                <ProductModal
                    product={editingProduct}
                    onClose={handleCloseModal}
                    onSave={fetchProducts}
                    setNotification={setNotification}
                    handleAuthError={handleAuthError}
                />
            )}
        </div>
    );
};

const ProductModal = ({ product, onClose, onSave, setNotification, handleAuthError }) => {
    const [name, setName] = useState(product?.name || '');
    const [description, setDescription] = useState(product?.description || '');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(product?.imageUrl || null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isEditing = !!product?.id;

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const url = isEditing ? `http://localhost:5000/api/products/${product.id}` : 'http://localhost:5000/api/famous-products';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'เกิดข้อผิดพลาด');
            }
            
            setNotification({ message: `บันทึกข้อมูล '${name}' สำเร็จ`, type: 'success' });
            onSave();
            onClose();
        } catch (error) {
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? `แก้ไข: ${product.name}` : 'เพิ่มของขึ้นชื่อ (ส่วนกลาง)'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><X size={24} /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                       <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อ</label>
                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
                       </div>
                       <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">คำอธิบาย</label>
                            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
                       </div>
                       <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">รูปภาพ</label>
                            <div className="mt-2 flex items-center">
                                <div className="w-24 h-24 mr-4 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                   {imagePreview ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-gray-400" />}
                                </div>
                                <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-50 dark:file:bg-gray-600 file:text-gray-700 dark:file:text-gray-200 hover:file:bg-gray-100 dark:hover:file:bg-gray-500"/>
                            </div>
                       </div>
                       <div className="flex justify-end space-x-3 pt-4">
                            <button type="button" onClick={onClose} className="bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">ยกเลิก</button>
                            <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
                                <Save size={18} className="mr-2"/>
                                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                            </button>
                       </div>
                </form>
            </div>
        </div>
    );
};


export default ManageProductsPage;

