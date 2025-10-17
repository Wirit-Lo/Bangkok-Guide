import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, Star, MessageSquare, Clock, Phone, ChevronLeft, Send, X, Edit, Trash2, Heart, ThumbsUp, ChevronRight, Gift, Plus, Image as ImageIcon, Save, AlertTriangle } from 'lucide-react';

// --- START: API URL Configuration ---
// This function dynamically sets the API URL based on the hostname.
// It uses the production URL for the deployed site and localhost for local development.
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    // Replace with your actual deployed backend URL
    return 'https://bangkok-guide.onrender.com'; 
};
const API_BASE_URL = getApiBaseUrl();
// --- END: API URL Configuration ---


// --- Helper & UI Components ---

const ImageLightbox = ({ images, selectedIndex, onClose, onNext, onPrev }) => {
    if (!images || images.length === 0) return null;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') onNext();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNext, onPrev]);

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:opacity-75"><X size={32} /></button>
            <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/40 transition-colors"><ChevronLeft size={32} /></button>
            <div className="relative w-full h-full max-w-4xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                {images.map((img, index) => (
                    <img key={index} src={img} alt={`Gallery view ${index + 1}`} className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${index === selectedIndex ? 'opacity-100' : 'opacity-0'}`} />
                ))}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/40 transition-colors"><ChevronRight size={32} /></button>
        </div>
    );
};

const StarRatingInput = ({ rating, setRating }) => (
  <div className="flex items-center space-x-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star 
        key={star} 
        size={28} 
        className="cursor-pointer transition-transform transform hover:scale-110 text-gray-300 dark:text-gray-600" 
        onClick={() => setRating(star)} 
        fill={star <= rating ? "#facc15" : "currentColor"} 
        stroke={star <= rating ? "#facc15" : "#9ca3af"} 
      />
    ))}
    </div>
);

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-start">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-4 text-left">
                        <h3 className="text-lg leading-6 font-bold text-gray-900 dark:text-gray-100" id="modal-title">{title}</h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-gray-300">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={onConfirm}
                    >
                        ยืนยัน
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                    >
                        ยกเลิก
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Review Card Component ---
const ReviewCard = ({ review, currentUser, onReviewDeleted, onEditClick }) => {
    const numericRating = parseFloat(review.rating || 0);
    const [likes, setLikes] = useState(Number(review.likes_count || 0));
    const [userHasLiked, setUserHasLiked] = useState(review.user_has_liked);
    const [comments, setComments] = useState([]);
    const [showComments, setShowComments] = useState(false);
    const [newReply, setNewReply] = useState("");
    const [commentCount, setCommentCount] = useState(review.comments_count || 0);
    const [isLiking, setIsLiking] = useState(false); 
    const canModify = currentUser && (currentUser.id === review.user_id || currentUser.role === 'admin');

    const handleToggleLike = async () => {
        if (!currentUser) return alert('กรุณาเข้าสู่ระบบเพื่อกดถูกใจ');
        const token = localStorage.getItem('token');
        if (!token) return alert('เซสชั่นหมดอายุ กรุณาเข้าสู่ระบบใหม่');

        if (isLiking) return;
        setIsLiking(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${review.id}/toggle-like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            const data = await response.json();

            if (response.ok) {
                setLikes(Number(data.likesCount));
                setUserHasLiked(data.status === 'liked');
            } else {
                console.error("Failed to toggle like:", data.error);
                alert('เกิดข้อผิดพลาด: ไม่สามารถอัปเดตสถานะการไลก์ได้');
            }
        } catch (error) {
            console.error("Network error during like toggle:", error);
            alert('เกิดข้อผิดพลาด: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        } finally {
            setIsLiking(false);
        }
    };

    const fetchComments = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${review.id}/comments`);
            const data = await response.json();
            setComments(data);
            setCommentCount(data.length);
        } catch (error) { console.error("Error fetching comments:", error); }
    };

    const handleToggleComments = () => {
        const newShowState = !showComments;
        setShowComments(newShowState);
        if (newShowState) fetchComments();
    };

    const handlePostReply = async (e) => {
        e.preventDefault();
        if (!newReply.trim()) return;
        const token = localStorage.getItem('token');
        if (!token && !currentUser) return alert('กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น');

        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${review.id}/comments`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ comment: newReply }),
            });
            if (response.ok) { setNewReply(""); fetchComments(); }
        } catch (error) { alert('เกิดข้อผิดพลาดในการแสดงความคิดเห็น'); }
    };

    return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center mb-2">
                        <div className="font-bold text-gray-800 dark:text-gray-100 mr-4">{review.author}</div>
                        <div className="flex">{[...Array(5)].map((_, i) => (<Star key={i} size={16} fill={i < numericRating ? '#facc15' : '#e5e7eb'} className={i < numericRating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'} strokeWidth={0} />))}</div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{review.comment}</p>
                </div>
                {canModify && (
                    <div className="flex space-x-2 flex-shrink-0 ml-4">
                        <button onClick={() => onEditClick(review)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" title="แก้ไขรีวิว"><Edit size={18} /></button>
                        <button onClick={() => onReviewDeleted(review.id)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full" title="ลบรีวิว"><Trash2 size={18} /></button>
                    </div>
                )}
            </div>
            {review.image_urls && review.image_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                    {review.image_urls.map((imgUrl, index) => (
                        <img 
                            key={index} 
                            src={imgUrl} 
                            alt={`Review ${index + 1}`} 
                            className="w-24 h-24 object-cover rounded-md bg-gray-200 dark:bg-gray-700" 
                            onError={(e) => { 
                                console.error(`Failed to load review image: ${imgUrl}`);
                                e.target.src = 'https://placehold.co/100x100/cccccc/333333?text=Error';
                            }}
                        />
                    ))}
                </div>
            )}
            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                <button 
                    onClick={handleToggleLike} 
                    disabled={isLiking}
                    className={`flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${userHasLiked ? 'text-blue-600 dark:text-blue-400 font-bold' : ''} ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <ThumbsUp size={16} />
                    <span>{isLiking ? 'กำลังโหลด' : `${likes} ถูกใจ`}</span> 
                </button>
                <button onClick={handleToggleComments} className="flex items-center space-x-1 hover:text-blue-600 dark:hover:text-blue-400"><MessageSquare size={16} /><span>{showComments ? 'ซ่อนความคิดเห็น' : `ความคิดเห็น (${commentCount})`}</span></button>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex-grow text-right">{new Date(review.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            {showComments && (
                <div className="mt-4 pl-6 border-l-2 border-gray-200 dark:border-gray-600 space-y-3">
                    {comments.map(comment => (<div key={comment.id} className="text-sm"><p><span className="font-bold text-gray-700 dark:text-gray-200">{comment.author}:</span> <span className="text-gray-600 dark:text-gray-300">{comment.comment}</span></p></div>))}
                    <form onSubmit={handlePostReply} className="flex space-x-2 pt-2"><input type="text" value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder="แสดงความคิดเห็น..." className="flex-grow p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" /><button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">ส่ง</button></form>
                </div>
            )}
        </div>
    );
};

const ProductModal = ({ product, locationId, onClose, onSave, setNotification, handleAuthError }) => {
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
        if (imageFile) formData.append('image', imageFile);

        if (!isEditing) formData.append('locationId', locationId);

        const url = isEditing ? `${API_BASE_URL}/api/famous-products/${product.id}` : `${API_BASE_URL}/api/famous-products`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, { method: method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'เกิดข้อผิดพลาด'); }
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
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{isEditing ? 'แก้ไขข้อมูลของขึ้นชื่อ' : 'เพิ่มของขึ้นชื่อใหม่'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><X size={24} /></button>
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


// --- Main Detail Page Component ---
const DetailPage = ({ item, setCurrentPage, onReviewSubmitted, handleItemClick, currentUser, favorites, handleToggleFavorite, handleEditItem, setNotification, handleAuthError }) => {
    
    const [reviews, setReviews] = useState([]);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [newRating, setNewRating] = useState(0);
    const [newComment, setNewComment] = useState("");
    const [newReviewImages, setNewReviewImages] = useState([]);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [editingReview, setEditingReview] = useState(null);
    const [editedRating, setEditedRating] = useState(0);
    const [editedComment, setEditedComment] = useState("");
    const [editedImages, setEditedImages] = useState([]);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [similarPlaces, setSimilarPlaces] = useState([]);
    const [isSimilarLoading, setIsSimilarLoading] = useState(true);
    const [locationProducts, setLocationProducts] = useState([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isRequestingDelete, setIsRequestingDelete] = useState(false);
    const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    useEffect(() => {
        if (item && item.category) {
            setIsSimilarLoading(true);
            const fetchSimilar = async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/locations/same-category?category=${encodeURIComponent(item.category)}&excludeId=${item.id}`);
                    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                    const data = await response.json();
                    setSimilarPlaces(data);
                } catch (error) {
                    console.error("Failed to fetch similar places:", error);
                    setSimilarPlaces([]);
                    setNotification({ message: 'ไม่สามารถโหลดสถานที่ใกล้เคียงได้', type: 'error' });
                } finally {
                    setIsSimilarLoading(false);
                }
            };
            fetchSimilar();
        }
    }, [item, setNotification]);
    
    const fetchLocationProducts = useCallback(async () => {
        if (!item) return;
        setIsLoadingProducts(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}/famous-products`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to fetch famous products');
            const data = await response.json();
            setLocationProducts(data);
        } catch (error) {
            console.error(error);
            setNotification({ message: error.message, type: 'error' });
        } finally {
            setIsLoadingProducts(false);
        }
    }, [item, setNotification]);

    useEffect(() => {
        if(item?.id) fetchLocationProducts();
    }, [item, fetchLocationProducts]);

    const allImages = useMemo(() => {
        if (!item) return [];
        const images = item.imageUrl ? [item.imageUrl] : [];
        if (item.detailImages && Array.isArray(item.detailImages)) {
            images.push(...item.detailImages.filter(img => img));
        }
        return [...new Set(images)];
    }, [item]);

    const isFavorite = useMemo(() => favorites && item && favorites.includes(item.id), [favorites, item]);

    const fetchReviews = useCallback(async () => {
        if (!item) return;
        try {
            const userIdQuery = currentUser ? `?userId=${currentUser.id}` : '';
            const response = await fetch(`${API_BASE_URL}/api/reviews/${item.id}${userIdQuery}`);
            if (!response.ok) throw new Error('Failed to fetch reviews');
            const data = await response.json();
            setReviews(data);
        } catch (error) { 
            console.error("Error fetching reviews:", error); 
            setNotification({ message: 'ไม่สามารถโหลดรีวิวได้', type: 'error' });
        }
    }, [item, currentUser, setNotification]);

    useEffect(() => {
        window.scrollTo(0, 0);
        setCurrentSlide(0);
        setShowReviewForm(false);
        setEditingReview(null);
        if (item) {
            fetchReviews();
        }
    }, [item, fetchReviews]);
    
    const handleReviewImageChange = (e) => { if (e.target.files) setNewReviewImages(prev => [...prev, ...Array.from(e.target.files)].slice(0, 5)); };
    const handleRemoveReviewImage = (index) => setNewReviewImages(prev => prev.filter((_, i) => i !== index));
    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (newRating === 0) return setNotification({ message: 'กรุณาให้คะแนนดาวก่อนส่งรีวิว', type: 'error' });
        if (!newComment.trim()) return setNotification({ message: 'กรุณากรอกความคิดเห็น', type: 'error' });
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        setIsSubmittingReview(true);
        const formData = new FormData();
        formData.append('rating', newRating);
        formData.append('comment', newComment);
        newReviewImages.forEach(file => formData.append('reviewImages', file));
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${item.id}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Failed to submit review'); }
            setShowReviewForm(false); setNewRating(0); setNewComment(""); setNewReviewImages([]);
            setNotification({ message: 'ขอบคุณสำหรับรีวิวครับ!', type: 'success' });
            if(onReviewSubmitted) onReviewSubmitted();
            fetchReviews();
        } catch (error) { setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' }); } 
        finally { setIsSubmittingReview(false); }
    };
    
    const confirmDeleteReview = (reviewId) => { setConfirmState({ isOpen: true, title: 'ยืนยันการลบรีวิว', message: 'คุณแน่ใจหรือไม่ว่าต้องการลบรีวิวนี้?', onConfirm: () => { handleDeleteReview(reviewId); setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); } }); };
    const handleDeleteReview = async (reviewId) => {
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ locationId: item.id }) });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || 'ไม่สามารถลบรีวิวได้'); }
            setNotification({ message: 'ลบรีวิวสำเร็จ', type: 'success' });
            if (onReviewSubmitted) onReviewSubmitted();
            fetchReviews();
        } catch (error) { setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' }); }
    };

    const handleEditClick = (review) => { setEditingReview(review); setEditedRating(review.rating); setEditedComment(review.comment); setEditedImages(review.image_urls.map(url => ({ type: 'existing', data: url }))); };
    const handleCancelEdit = () => setEditingReview(null);
    const handleEditImageChange = (e) => { if (e.target.files) { const newFiles = Array.from(e.target.files).map(file => ({ type: 'new', data: file })); setEditedImages(prev => [...prev, ...newFiles].slice(0, 5)); } };
    const handleRemoveEditedImage = (index) => setEditedImages(prev => prev.filter((_, i) => i !== index));
    const handleUpdateReview = async (e) => {
        e.preventDefault();
        if (!editingReview) return;
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        const formData = new FormData();
        formData.append('locationId', item.id);
        formData.append('rating', editedRating);
        formData.append('comment', editedComment);
        const existingImages = editedImages.filter(img => img.type === 'existing').map(img => img.data);
        const newImages = editedImages.filter(img => img.type === 'new').map(img => img.data);
        formData.append('existingImages', JSON.stringify(existingImages));
        newImages.forEach(file => formData.append('reviewImages', file));
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${editingReview.id}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || 'ไม่สามารถอัปเดตรีวิวได้'); }
            setNotification({ message: 'อัปเดตรีวิวสำเร็จ', type: 'success' });
            setEditingReview(null);
            if (onReviewSubmitted) onReviewSubmitted();
            fetchReviews();
        } catch (error) { setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' }); }
    };

    const handleNavigate = () => {
        if (item.googleMapUrl) {
            window.open(item.googleMapUrl, '_blank');
        } else if (item.coords?.lat && item.coords?.lng) {
            window.open(`https://www.google.com/maps?q=${item.coords.lat},${item.coords.lng}`, '_blank');
        }
    };

    const renderStars = (rating) => {
        const clampedRating = Math.max(0, Math.min(5, parseFloat(rating || 0)));
        const r = clampedRating;
        const full = Math.floor(r), half = r % 1 >= 0.5, empty = 5 - full - (half ? 1 : 0);
        return (<><svg width="0" height="0" className="absolute"><defs><linearGradient id="half-gradient"><stop offset="50%" stopColor="#facc15" /><stop offset="50%" stopColor="#e5e7eb" /></linearGradient></defs></svg>{[...Array(full)].map((_, i) => <Star key={`f-${i}`} size={20} fill="#facc15" stroke="#facc15" />)}{half && <Star key="h" size={20} fill="url(#half-gradient)" stroke="#facc15" />}{[...Array(Math.max(0, empty))].map((_, i) => <Star key={`e-${i}`} size={20} fill="#e5e7eb" stroke="#9ca3af" />)}</>);
    };
    
    const openLightbox = (index) => { setSelectedImageIndex(index); setIsLightboxOpen(true); };
    const closeLightbox = () => setIsLightboxOpen(false);
    const goToNextImage = () => setSelectedImageIndex(prev => (prev + 1) % allImages.length);
    const goToPrevImage = () => setSelectedImageIndex(prev => (prev - 1 + allImages.length) % allImages.length);
    const nextSlide = () => setCurrentSlide(prev => (prev === allImages.length - 1 ? 0 : prev + 1));
    const prevSlide = () => setCurrentSlide(prev => (prev === 0 ? allImages.length - 1 : prev - 1));
    const goToSlide = (index) => setCurrentSlide(index);
    const handleOpenProductModal = (product = null) => { setEditingProduct(product); setIsProductModalOpen(true); };
    const handleCloseProductModal = () => { setIsProductModalOpen(false); setEditingProduct(null); };
    const handleProductSave = () => { fetchLocationProducts(); };
    const confirmDeleteProduct = (productId) => { setConfirmState({ isOpen: true, title: 'ยืนยันการลบ', message: 'คุณแน่ใจหรือไม่ว่าต้องการลบของขึ้นชื่อนี้?', onConfirm: () => { handleDeleteProduct(productId); setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); } }); };
    const handleDeleteProduct = async (productId) => {
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        try {
            const response = await fetch(`${API_BASE_URL}/api/famous-products/${productId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || 'ไม่สามารถลบได้'); }
            setNotification({ message: 'ลบข้อมูลสำเร็จ', type: 'success' });
            handleProductSave();
        } catch (error) { setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' }); }
    };
    const confirmRequestDeletion = () => { setConfirmState({ isOpen: true, title: 'ส่งคำขอลบสถานที่', message: 'คุณแน่ใจหรือไม่? Admin จะทำการตรวจสอบคำขอของคุณก่อนดำเนินการลบ', onConfirm: () => { handleRequestDeletion(); setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); } }); };
    const handleRequestDeletion = async () => {
        setIsRequestingDelete(true);
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}/request-deletion`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            setNotification({ message: data.message, type: 'success' });
            setTimeout(() => { setCurrentPage(item.type === 'attraction' ? 'attractions' : 'foodshops'); }, 2000);
        } catch (error) { setNotification({ message: error.message, type: 'error' }); } 
        finally { setIsRequestingDelete(false); }
    };

    if (!item) { return <div className="flex justify-center items-center h-screen"><p className="text-xl dark:text-gray-300">กำลังโหลดข้อมูลสถานที่...</p></div>; }
    const isOwner = currentUser && currentUser.id === item.user_id;
    const itemRating = parseFloat(item.rating || 0);

    return (
        <>
            <ConfirmationModal isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} />
            {isLightboxOpen && <ImageLightbox images={allImages} selectedIndex={selectedImageIndex} onClose={closeLightbox} onNext={goToNextImage} onPrev={goToPrevImage} />}
            {isProductModalOpen && <ProductModal product={editingProduct} locationId={item.id} onClose={handleCloseProductModal} onSave={handleProductSave} setNotification={setNotification} handleAuthError={handleAuthError} />}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row lg:gap-12">
                    <main className="lg:w-2/3 w-full">
                        {item.status === 'pending_deletion' && (<div className="p-4 mb-6 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 rounded-r-lg"><p className="font-bold">สถานะ: รอการอนุมัติลบ</p><p>สถานที่นี้ถูกส่งคำขอลบแล้ว และกำลังรอการตรวจสอบจากผู้ดูแลระบบ</p></div>)}
                        <div className="p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl animate-fade-in-up">
                            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                                <button onClick={() => setCurrentPage(item.type === 'attraction' ? 'attractions' : 'foodshops')} className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition"><ChevronLeft size={20} className="mr-2" /> กลับไปยังรายการ</button>
                                <div className="flex items-center gap-2">
                                    {currentUser && (<button onClick={() => handleToggleFavorite(item.id)} className="flex items-center gap-2 px-4 py-2 border-2 rounded-full text-red-500 border-red-200 dark:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title={isFavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}><Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} /><span className="font-semibold">{isFavorite ? 'บันทึกแล้ว' : 'บันทึก'}</span></button>)}
                                    {isOwner && item.status === 'approved' && (<>
                                        <button onClick={() => handleEditItem(item)} className="flex items-center gap-2 px-4 py-2 border rounded-full text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Edit size={16} /> <span className="font-semibold">แก้ไข</span></button>
                                        <button onClick={confirmRequestDeletion} disabled={isRequestingDelete} className="flex items-center gap-2 px-4 py-2 border rounded-full text-red-600 border-red-200 dark:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"><Trash2 size={16} /> <span className="font-semibold">{isRequestingDelete ? 'กำลังส่งคำขอ...' : 'ร้องขอลบ'}</span></button>
                                    </>)}
                                </div>
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center leading-tight">{item.name}</h2>
                            <div className="mb-6 relative">
                                <div className="overflow-hidden rounded-xl shadow-lg aspect-w-16 aspect-h-9 bg-gray-200 dark:bg-gray-700">
                                    <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                        {allImages.map((img, index) => (<img key={index} src={img} alt={`${item.name} ${index + 1}`} className="w-full flex-shrink-0 object-cover cursor-pointer" onClick={() => openLightbox(index)} onError={(e) => { e.target.src = 'https://placehold.co/800x450/cccccc/333333?text=Image+Not+Found'; }} />))}
                                    </div>
                                </div>
                                {allImages.length > 1 && (<>
                                    <button onClick={prevSlide} className="absolute top-1/2 left-3 -translate-y-1/2 p-2 bg-white/50 rounded-full text-gray-800 hover:bg-white transition-colors"><ChevronLeft size={24} /></button>
                                    <button onClick={nextSlide} className="absolute top-1/2 right-3 -translate-y-1/2 p-2 bg-white/50 rounded-full text-gray-800 hover:bg-white transition-colors"><ChevronRight size={24} /></button>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">{allImages.map((_, index) => (<button key={index} onClick={() => goToSlide(index)} className={`w-3 h-3 rounded-full transition-colors ${currentSlide === index ? 'bg-white' : 'bg-white/50 hover:bg-white'}`}></button>))}</div>
                                </>)}
                            </div>
                            <div className="flex items-center justify-center mb-6 text-gray-700 dark:text-gray-300"><div className="flex items-center mr-4">{renderStars(itemRating)}<span className="ml-2 text-xl font-bold">{itemRating.toFixed(1)}</span></div><div className="flex items-center"><MessageSquare size={20} className="mr-2 text-blue-500" /><span className="text-lg">{reviews.length || 0} รีวิว</span></div></div>
                            <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-6">{item.fullDescription || item.description}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-200 mb-6"><div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm"><Clock size={24} className="mr-3 text-purple-600" /> <span className="font-semibold">เวลาทำการ:</span> <span className="ml-2">{item.hours || 'ไม่มีข้อมูล'}</span></div><div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm"><Phone size={24} className="mr-3 text-green-600" /> <span className="font-semibold">ติดต่อ:</span> <span className="ml-2">{item.contact || 'ไม่มีข้อมูล'}</span></div></div>
                            <div className="mt-8"><h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">ตำแหน่งบนแผนที่</h3><div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg"><p className="text-gray-600 dark:text-gray-300">ส่วนแสดงแผนที่ถูกปิดใช้งานชั่วคราว</p></div></div>
                            <button onClick={handleNavigate} className="w-full mt-8 bg-gradient-to-r from-teal-500 to-green-600 text-white py-4 px-6 rounded-full flex items-center justify-center space-x-3 hover:from-teal-600 hover:to-green-700 transition transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-300 shadow-lg font-bold text-xl"><MapPin size={24} /><span>นำทางด้วย Google Maps</span></button>
                            <hr className="my-8 border-t-2 border-gray-100 dark:border-gray-700" />
                            <div className="space-y-6">
                                <h3 className="text-3xl font-bold text-gray-800 dark:text-gray-100">รีวิวและความคิดเห็น</h3>
                                {currentUser && (<button onClick={() => setShowReviewForm(!showReviewForm)} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors">{showReviewForm ? 'ยกเลิกการเขียนรีวิว' : 'เขียนรีวิวของคุณ'}</button>)}
                                {showReviewForm && (<form onSubmit={handleReviewSubmit} className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 space-y-4 animate-fade-in"><div><label className="block text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">ให้คะแนนสถานที่นี้</label><StarRatingInput rating={newRating} setRating={setNewRating} /></div><div><label htmlFor="comment" className="block text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">ความคิดเห็นของคุณ</label><textarea id="comment" value={newComment} onChange={(e) => setNewComment(e.target.value)} rows="4" className="w-full p-3 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500" placeholder="เล่าประสบการณ์ของคุณ..."></textarea></div><div><label htmlFor="review-images" className="block text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">แนบรูปภาพ (สูงสุด 5 รูป)</label><input type="file" id="review-images" multiple accept="image/*" onChange={handleReviewImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0" /></div>{newReviewImages.length > 0 && (<div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{newReviewImages.map((image, index) => (<div key={index} className="relative group"><img src={URL.createObjectURL(image)} alt={`preview ${index}`} className="w-full h-20 object-cover rounded-lg" /><button type="button" onClick={() => handleRemoveReviewImage(index)} className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"><X size={16} /></button></div>))}</div>)}<button type="submit" disabled={isSubmittingReview} className="flex items-center justify-center px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400"><Send size={18} className="mr-2" />{isSubmittingReview ? 'กำลังส่ง...' : 'ส่งรีวิว'}</button></form>)}
                                <div className="space-y-0 -m-4">
                                    {reviews.map(review => (editingReview && editingReview.id === review.id ? (<div key={`edit-${review.id}`} className="bg-blue-50 dark:bg-gray-900/50 border-l-4 border-blue-400 p-4 my-4 rounded-r-lg shadow-md animate-fade-in"><div className="flex justify-between items-center mb-4"><h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center"><Edit size={20} className="mr-2 text-blue-600 dark:text-blue-400" />กำลังแก้ไขรีวิว</h4><button onClick={handleCancelEdit} className="p-1 text-gray-500 hover:text-red-600 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="ยกเลิกการแก้ไข"><X size={20} /></button></div><form onSubmit={handleUpdateReview} className="space-y-4"><div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">ให้คะแนนใหม่</label><StarRatingInput rating={editedRating} setRating={setEditedRating} /></div><div><label htmlFor={`edit-comment-${review.id}`} className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">แก้ไขความคิดเห็น</label><textarea id={`edit-comment-${review.id}`} value={editedComment} onChange={(e) => setEditedComment(e.target.value)} rows="3" className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-500" /></div><div><label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">จัดการรูปภาพ</label>{editedImages.length > 0 && (<div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2">{editedImages.map((image, index) => (<div key={index} className="relative group"><img src={image.type === 'new' ? URL.createObjectURL(image.data) : image.data} alt={`edit preview ${index}`} className="w-full h-20 object-cover rounded-lg" /><button type="button" onClick={() => handleRemoveEditedImage(index)} className="absolute top-0 right-0 -mt-2 -mr-2 bg-red-500 text-white rounded-full p-1 opacity-75 group-hover:opacity-100 transition-opacity"><X size={16} /></button></div>))}</div>)}{editedImages.length < 5 && (<div className="mt-2"><input type="file" multiple accept="image/*" onChange={handleEditImageChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200" /></div>)}</div><div className="flex space-x-2 pt-2"><button type="submit" className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors">บันทึกการเปลี่ยนแปลง</button><button type="button" onClick={handleCancelEdit} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors">ยกเลิก</button></div></form></div>) : (<ReviewCard key={review.id} review={review} currentUser={currentUser} onReviewDeleted={confirmDeleteReview} onEditClick={handleEditClick} />)))}
                                </div>
                            </div>
                        </div>
                    </main>
                    <aside className="lg:w-1/3 w-full mt-12 lg:mt-0 lg:sticky lg:top-8 self-start">
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10">
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-5">{item.category ? `สถานที่อื่นในหมวดหมู่ "${item.category}"` : 'สถานที่แนะนำ'}</h3>
                            {isSimilarLoading ? (<p className="text-gray-500 dark:text-gray-400">กำลังค้นหาสถานที่...</p>) : similarPlaces.length > 0 ? (<div className="space-y-4">{similarPlaces.map(place => (<div key={place.id} className="flex items-center gap-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors" onClick={() => handleItemClick(place)}><img src={place.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'} alt={place.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-200 dark:bg-gray-600" /><div className="overflow-hidden"><h5 className="font-bold text-gray-800 dark:text-gray-100 truncate">{place.name}</h5><p className="text-sm text-gray-500 dark:text-gray-400 truncate">{place.category}</p></div></div>))}</div>) : (<p className="text-gray-500 dark:text-gray-400 text-center p-4">ไม่พบสถานที่อื่นในหมวดหมู่นี้</p>)}
                        </div>
                        <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10">
                            <div className="flex justify-between items-center mb-5"><h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center"><Gift size={24} className="mr-3 text-amber-500" />ของขึ้นชื่อประจำที่นี่</h3>{currentUser && (<button onClick={() => handleOpenProductModal(null)} className="flex items-center text-sm bg-blue-500 text-white font-semibold py-1 px-3 rounded-full hover:bg-blue-600 transition-colors"><Plus size={16} className="mr-1" />เพิ่ม</button>)}</div>
                            {isLoadingProducts ? (<p className="text-gray-500 dark:text-gray-400">กำลังโหลดข้อมูล...</p>) : locationProducts.length > 0 ? (<div className="space-y-4">{locationProducts.map(product => (<div key={product.id} className="group relative flex items-center gap-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><img src={product.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'} alt={product.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-200 dark:bg-gray-600" /><div className="overflow-hidden flex-grow"><h5 className="font-bold text-gray-800 dark:text-gray-100">{product.name}</h5><p className="text-sm text-gray-500 dark:text-gray-400 truncate">{product.description}</p></div>{currentUser && (currentUser.id === product.user_id || currentUser.role === 'admin') && (<div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleOpenProductModal(product)} className="p-1.5 bg-white/50 dark:bg-gray-600/50 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50"><Edit size={14} /></button><button onClick={() => confirmDeleteProduct(product.id)} className="p-1.5 bg-white/50 dark:bg-gray-600/50 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50"><Trash2 size={14} /></button></div>)}</div>))}</div>) : (<p className="text-gray-500 dark:text-gray-400 text-center p-4">ยังไม่มีของขึ้นชื่อสำหรับสถานที่นี้</p>)}
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
};

export default DetailPage;

