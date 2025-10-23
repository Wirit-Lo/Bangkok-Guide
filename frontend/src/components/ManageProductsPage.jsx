import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Gift, Image as ImageIcon, Save, AlertTriangle, X, MapPin } from 'lucide-react';

// --- Reusable Confirmation Modal ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    // ... (โค้ด ConfirmationModal เหมือนเดิม) ...
    if (!isOpen) return null;
    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose} // Allow closing by clicking backdrop
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 transform transition-all"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                <div className="flex items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-gray-100">{title}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        onClick={onConfirm}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                    >
                        ยืนยัน
                    </button>
                    <button
                        onClick={onClose}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm transition-colors"
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Reusable Product Modal ---
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
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file); // Use Data URL for preview
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const token = localStorage.getItem('token');
        if (!token) {
            setIsSubmitting(false);
            return handleAuthError();
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL;
        // <<< ADDED LOG >>>
        console.log('[ProductModal] API_BASE_URL:', API_BASE_URL);
        if (!API_BASE_URL) {
             setNotification({ message: 'Error: API URL is not configured.', type: 'error' });
             setIsSubmitting(false);
             return;
        }


        const formData = new FormData();
        formData.append('name', name.trim()); // Trim input
        formData.append('description', description.trim());
        if (imageFile) formData.append('image', imageFile);
        // Do NOT append locationId here for central products

        const url = isEditing
            ? `${API_BASE_URL}/api/famous-products/${product.id}`
            : `${API_BASE_URL}/api/famous-products`;
        const method = isEditing ? 'PUT' : 'POST';
        console.log(`[ProductModal] Submitting to URL: ${method} ${url}`); // Log URL

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` }, // No Content-Type needed for FormData
                body: formData,
            });

            console.log('[ProductModal] Response Status:', response.status); // Log status

            if (response.status === 401 || response.status === 403) return handleAuthError();

            // Improved error handling: try parsing JSON only if looks like JSON
            if (!response.ok) {
                let errorPayload = { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    try {
                        errorPayload = await response.json();
                    } catch (jsonError) {
                         console.error("Failed to parse JSON error response:", jsonError);
                         // Keep the default error message
                    }
                } else {
                     // If not JSON, maybe read as text?
                     const textError = await response.text();
                     console.error("Non-JSON error response:", textError);
                     errorPayload.error = `Server Error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorPayload.error || 'เกิดข้อผิดพลาด');
            }

            // Handle potential JSON response for success (e.g., created product data)
            let successMessage = `บันทึกข้อมูล '${name}' สำเร็จ`;
            try {
                 const successData = await response.json();
                 // You might use successData if needed
                 console.log("[ProductModal] Save successful, data:", successData);
                 if(successData.message) successMessage = successData.message;
            } catch (e) {
                // If response has no body or is not JSON, ignore parsing error
                console.log("[ProductModal] Save successful (no JSON body or parsing error ignored)");
            }

            setNotification({ message: successMessage, type: 'success' });
            onSave(); // Callback to refresh list
            onClose(); // Close modal
        } catch (error) {
            console.error('[ProductModal] Submit Error:', error);
            setNotification({ message: error.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };


    // ... (JSX for ProductModal form - unchanged) ...
        return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg p-6 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? `แก้ไข: ${product.name}` : 'เพิ่มของขึ้นชื่อ (ส่วนกลาง)'}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                        aria-label="Close modal"
                    >
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="prod-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อ</label>
                        <input type="text" id="prod-name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
                    </div>
                    <div>
                        <label htmlFor="prod-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">คำอธิบาย</label>
                        <textarea id="prod-description" value={description} onChange={e => setDescription(e.target.value)} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"></textarea>
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
                        <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                            <Save size={18} className="mr-2"/>
                            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ManageProductsPage = ({ setNotification, handleAuthError }) => {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [deletingProductId, setDeletingProductId] = useState(null);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        console.log("[ManageProductsPage] Starting fetchProducts..."); // <<< ADDED LOG >>>

        const token = localStorage.getItem('token');
        if (!token) {
            console.error("[ManageProductsPage] No token found, aborting fetch."); // <<< ADDED LOG >>>
            setIsLoading(false); // Stop loading indicator
            return handleAuthError(); // Redirect or show login
        }

        const API_BASE_URL = import.meta.env.VITE_API_URL;
        console.log("[ManageProductsPage] API_BASE_URL:", API_BASE_URL); // <<< ADDED LOG >>>
        if (!API_BASE_URL) {
            console.error("[ManageProductsPage] VITE_API_URL is not defined!"); // <<< ADDED LOG >>>
            setNotification({ message: 'Error: API URL is not configured.', type: 'error' });
            setIsLoading(false);
            return;
        }

        const fetchUrl = `${API_BASE_URL}/api/famous-products/all`;
        console.log("[ManageProductsPage] Fetching from URL:", fetchUrl); // <<< ADDED LOG >>>

        try {
            const response = await fetch(fetchUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log("[ManageProductsPage] Fetch response status:", response.status); // <<< ADDED LOG >>>

            if (response.status === 401 || response.status === 403) {
                console.error("[ManageProductsPage] Auth error (401/403)."); // <<< ADDED LOG >>>
                return handleAuthError();
            }

            // <<< IMPROVED ERROR HANDLING >>>
            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    // Try to read the response body as text, might contain useful info
                    const errorText = await response.text();
                    console.error("[ManageProductsPage] Error response body:", errorText);
                    // Check if it's JSON before trying to parse
                     const contentType = response.headers.get('content-type');
                     if (contentType && contentType.includes('application/json')) {
                         const errorJson = JSON.parse(errorText); // Safe to parse now
                         errorMsg = errorJson.error || errorJson.message || errorMsg;
                     } else if (errorText.toLowerCase().includes("<!doctype html")) {
                         errorMsg = "Server returned an HTML error page. Check backend logs.";
                     } else {
                         errorMsg = errorText || errorMsg; // Use text if not HTML or JSON
                     }
                } catch (e) {
                     console.error("[ManageProductsPage] Error reading/parsing error response:", e);
                     // Keep the original HTTP error message
                }
                throw new Error(errorMsg); // Throw the determined error message
            }
            
            console.log("[ManageProductsPage] Fetch successful, attempting to parse JSON..."); // <<< ADDED LOG >>>
            const data = await response.json();
            console.log("[ManageProductsPage] Data received:", data); // <<< ADDED LOG >>>
            setProducts(Array.isArray(data) ? data : []); // Ensure products is always an array
        
        } catch (error) {
            console.error("[ManageProductsPage] fetchProducts error:", error); // <<< ADDED LOG >>>
            // Check for specific error types if needed
            if (error instanceof SyntaxError) { // JSON parsing error
                setNotification({ message: `Error parsing server response: ${error.message}`, type: 'error' });
            } else {
                 setNotification({ message: `ไม่สามารถโหลดข้อมูล: ${error.message}`, type: 'error' });
            }
            setProducts([]); // Clear products on error
        } finally {
            console.log("[ManageProductsPage] fetchProducts finished."); // <<< ADDED LOG >>>
            setIsLoading(false);
        }
    }, [setNotification, handleAuthError]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleOpenModal = (product = null) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSave = () => {
        fetchProducts(); // Re-fetch data after saving
    };

    const confirmDelete = (productId) => {
        setDeletingProductId(productId);
    };

    const handleDelete = async () => {
        if (!deletingProductId) return;

        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();

        const API_BASE_URL = import.meta.env.VITE_API_URL;
        if (!API_BASE_URL) {
            setNotification({ message: 'Error: API URL is not configured.', type: 'error' });
            setDeletingProductId(null);
            return;
        }

        const deleteUrl = `${API_BASE_URL}/api/famous-products/${deletingProductId}`;
        console.log("[ManageProductsPage] Attempting DELETE:", deleteUrl); // <<< ADDED LOG >>>

        try {
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log("[ManageProductsPage] DELETE response status:", response.status); // <<< ADDED LOG >>>

            if (response.status === 401 || response.status === 403) return handleAuthError();
            
            // Allow 204 No Content for successful DELETE
            if (!response.ok && response.status !== 204) {
                 let errorMsg = `HTTP error! status: ${response.status}`;
                 try {
                     const errorText = await response.text();
                     console.error("[ManageProductsPage] Delete Error response body:", errorText);
                     const contentType = response.headers.get('content-type');
                     if (contentType && contentType.includes('application/json')) {
                         const errorJson = JSON.parse(errorText);
                         errorMsg = errorJson.error || errorJson.message || errorMsg;
                     } else {
                         errorMsg = errorText || errorMsg;
                     }
                 } catch(e){
                      console.error("[ManageProductsPage] Error reading/parsing delete error response:", e);
                 }
                throw new Error(errorMsg);
            }

            setNotification({ message: 'ลบข้อมูลสำเร็จ', type: 'success' });
            fetchProducts(); // Re-fetch after delete
        } catch (error) {
            console.error("[ManageProductsPage] handleDelete error:", error); // <<< ADDED LOG >>>
            setNotification({ message: `เกิดข้อผิดพลาดในการลบ: ${error.message}`, type: 'error' });
        } finally {
            setDeletingProductId(null); // Close confirmation modal
        }
    };

    // ... (JSX for ManageProductsPage table and structure - unchanged) ...
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full">
            {isModalOpen && <ProductModal product={editingProduct} onClose={handleCloseModal} onSave={handleSave} setNotification={setNotification} handleAuthError={handleAuthError} />}
            <ConfirmationModal
                isOpen={!!deletingProductId}
                onClose={() => setDeletingProductId(null)}
                onConfirm={handleDelete}
                title="ยืนยันการลบ"
                message="คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลของขึ้นชื่อนี้?"
            />

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">จัดการข้อมูลของขึ้นชื่อทั้งหมด</h1>
                <button onClick={() => handleOpenModal(null)} className="flex items-center bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                    <Plus size={20} className="mr-2" />
                    เพิ่มของขึ้นชื่อ (ส่วนกลาง)
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-lg">
                {isLoading ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 p-8">กำลังโหลดข้อมูล...</p>
                ) : products.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b dark:border-gray-700">
                                    <th className="p-4">รูปภาพ</th>
                                    <th className="p-4">ชื่อ</th>
                                    <th className="p-4 hidden sm:table-cell">สถานที่</th>
                                    <th className="p-4 hidden md:table-cell">คำอธิบาย</th>
                                    <th className="p-4 text-right">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(product => (
                                    <tr key={product.id} className="border-b dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="p-4">
                                            <img src={product.imageUrl || 'https://placehold.co/100x100/e2e8f0/333333?text=N/A'} alt={product.name} className="w-16 h-16 object-cover rounded-md"/>
                                        </td>
                                        <td className="p-4 font-semibold text-gray-800 dark:text-gray-100">{product.name}</td>
                                        <td className="p-4 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                                            <div className="flex items-center">
                                                {product.locationName !== 'ส่วนกลาง' && <MapPin size={16} className="mr-2 text-gray-400" />}
                                                {product.locationName}
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-600 dark:text-gray-400 hidden md:table-cell max-w-sm truncate">{product.description}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => handleOpenModal(product)}
                                                    className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-full"
                                                    aria-label={`แก้ไข ${product.name}`}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(product.id)}
                                                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full"
                                                    aria-label={`ลบ ${product.name}`}
                                                >
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
                        <Gift size={48} className="mx-auto mb-4" />
                        <h3 className="text-xl font-semibold">ไม่พบข้อมูลของขึ้นชื่อในระบบ</h3>
                        <p>คลิกปุ่ม 'เพิ่มของขึ้นชื่อ' เพื่อเริ่มต้น</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageProductsPage;
