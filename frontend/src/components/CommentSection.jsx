import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageSquare, Send, MoreHorizontal, User, Trash2, Edit, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://bangkok-guide.onrender.com';

// --- Helper Component: Avatar ---
// ถ้ามีรูปใช้รูป ถ้าไม่มีใช้ดีไซน์ Gradient เหมือนในภาพ
const Avatar = ({ src, alt, size = "md" }) => {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-12 h-12"
    };

    if (src) {
        return (
            <img 
                src={src} 
                alt={alt} 
                className={`${sizeClasses[size]} rounded-full object-cover border-2 border-slate-700 shadow-sm`}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
        );
    }

    // ดีไซน์ Placeholder แบบในรูป (Gradient ส้ม-ชมพู หรือ ฟ้า-ม่วง สุ่มตามความยาวชื่อ)
    const gradients = [
        "from-pink-400 to-orange-400",
        "from-blue-400 to-indigo-500",
        "from-green-400 to-teal-500",
        "from-purple-400 to-pink-500"
    ];
    const randomGradient = gradients[alt ? alt.length % gradients.length : 0];

    return (
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${randomGradient} flex items-center justify-center text-white shadow-md border-2 border-slate-700 shrink-0`}>
            <User size={size === 'sm' ? 14 : 20} strokeWidth={2.5} />
        </div>
    );
};

// --- Helper: Parse Text with Mentions ---
// เปลี่ยนข้อความ @Name ให้เป็นสีฟ้า
const renderContentWithMentions = (text) => {
    if (!text) return null;
    // Regex จับคำที่ขึ้นต้นด้วย @ ตามด้วยตัวอักษร
    const parts = text.split(/(@[\wก-๙]+)/g);
    
    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            return <span key={index} className="text-blue-400 font-semibold cursor-pointer hover:underline">{part}</span>;
        }
        return part;
    });
};

export const CommentSection = ({ locationId, currentUser, onReviewChange }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    // Mention Logic
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef(null);

    // ดึงรายชื่อคนที่มีในคอมเมนต์เพื่อทำ List @Mention
    const uniqueUsers = [...new Set(comments.map(c => c.author))].filter(u => u !== currentUser?.username);

    useEffect(() => {
        fetchComments();
    }, [locationId]);

    const fetchComments = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${locationId}/comments`); // ปรับ Endpoint ตาม Backend จริง
            // Mock Data สำหรับทดสอบหาก Backend ยังไม่พร้อม หรือใช้ Endpoint รีวิวแทน
            if (!response.ok) {
                // Fallback: ดึงรีวิวมาแสดงแทนคอมเมนต์ในตัวอย่างนี้
                const reviewRes = await fetch(`${API_BASE_URL}/api/reviews/${locationId}`);
                const data = await reviewRes.json();
                setComments(data);
            } else {
                const data = await response.json();
                setComments(data);
            }
        } catch (error) {
            console.error("Error fetching comments:", error);
        }
    };

    // --- Handle Input Change for Mentions ---
    const handleInputChange = (e) => {
        const val = e.target.value;
        setNewComment(val);
        
        const selectionStart = e.target.selectionStart;
        setCursorPosition(selectionStart);

        // Logic ตรวจจับเครื่องหมาย @
        const lastAtPos = val.lastIndexOf('@', selectionStart);
        if (lastAtPos !== -1 && lastAtPos < selectionStart) {
            const query = val.substring(lastAtPos + 1, selectionStart);
            if (!query.includes(' ')) { // ถ้ายังไม่มีวรรค แสดงว่ากำลังพิมพ์ชื่อ
                setShowMentionList(true);
                setMentionQuery(query);
                return;
            }
        }
        setShowMentionList(false);
    };

    const insertMention = (name) => {
        const val = newComment;
        const lastAtPos = val.lastIndexOf('@', cursorPosition);
        const before = val.substring(0, lastAtPos);
        const after = val.substring(cursorPosition);
        const newValue = `${before}@${name} ${after}`;
        
        setNewComment(newValue);
        setShowMentionList(false);
        
        // Focus กลับไปที่ Input
        setTimeout(() => {
            if(inputRef.current) inputRef.current.focus();
        }, 100);
    };

    // --- Handle Actions ---
    const handleLike = async (commentId, currentLikes, userLiked) => {
        if (!currentUser) return alert("กรุณาเข้าสู่ระบบ");
        
        // Optimistic Update (อัปเดตหน้าจอทันทีไม่ต้องรอ Server)
        setComments(prev => prev.map(c => {
            if (c.id === commentId) {
                return {
                    ...c,
                    likes_count: userLiked ? parseInt(c.likes_count) - 1 : parseInt(c.likes_count) + 1,
                    user_has_liked: !userLiked
                };
            }
            return c;
        }));

        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/reviews/${commentId}/toggle-like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error("Like failed", error);
            fetchComments(); // Revert if failed
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;

        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            // สมมติว่าใช้ Endpoint สร้างรีวิว/คอมเมนต์เดียวกัน
            const formData = new FormData();
            formData.append('comment', newComment);
            formData.append('rating', 5); // Default rating for comment only
            
            const response = await fetch(`${API_BASE_URL}/api/reviews/${locationId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                setNewComment("");
                fetchComments();
                if(onReviewChange) onReviewChange();
            }
        } catch (error) {
            console.error("Submit failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 text-slate-200">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
                รีวิวและความคิดเห็น
            </h3>

            {/* --- Comment List --- */}
            <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2 text-blue-400 mb-4 font-semibold">
                    <MessageSquare size={20} />
                    <span>ความคิดเห็น ({comments.length})</span>
                </div>

                {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/50 rounded-xl">
                        ยังไม่มีความคิดเห็น เป็นคนแรกที่แสดงความคิดเห็นสิ!
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition-all group">
                            <div className="flex gap-4">
                                {/* Avatar */}
                                <Avatar 
                                    src={comment.author_profile_image_url || comment.authorProfileImageUrl} 
                                    alt={comment.author || "User"} 
                                />

                                <div className="flex-1">
                                    {/* Header: Name & Time */}
                                    <div className="flex items-baseline justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-base">
                                                {comment.author}
                                            </span>
                                            {/* Badge Admin Example */}
                                            {comment.author === 'Admin' && (
                                                <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-500/30">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {comment.created_at ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: th }) : 'เมื่อสักครู่'}
                                        </span>
                                    </div>

                                    {/* Content */}
                                    <p className="text-slate-300 mt-1 text-sm leading-relaxed">
                                        {renderContentWithMentions(comment.comment)}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex items-center gap-4 mt-3">
                                        <button 
                                            onClick={() => handleLike(comment.id, comment.likes_count, comment.user_has_liked)}
                                            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${comment.user_has_liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-400'}`}
                                        >
                                            <Heart size={16} fill={comment.user_has_liked ? "currentColor" : "none"} />
                                            <span>{comment.likes_count || 0} ถูกใจ</span>
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setNewComment(`@${comment.author} `);
                                                if(inputRef.current) inputRef.current.focus();
                                            }}
                                            className="text-xs text-slate-500 hover:text-blue-400 transition-colors font-medium"
                                        >
                                            ตอบกลับ
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* --- Input Section (Sticky Bottom style in design) --- */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative">
                {/* Mention Popover */}
                {showMentionList && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-20">
                        <div className="p-2 bg-slate-900/50 text-xs text-slate-400 font-semibold border-b border-slate-700">แนะนำ</div>
                        {uniqueUsers
                            .filter(u => u.toLowerCase().includes(mentionQuery.toLowerCase()))
                            .map((user, idx) => (
                            <button
                                key={idx}
                                onClick={() => insertMention(user)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                            >
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-[10px] text-white">
                                    {user[0]}
                                </div>
                                {user}
                            </button>
                        ))}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex gap-3 items-start">
                    {/* Current User Avatar */}
                    <div className="hidden sm:block">
                        <Avatar 
                            src={currentUser?.profileImageUrl} 
                            alt={currentUser?.username || "Me"} 
                        />
                    </div>
                    
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newComment}
                            onChange={handleInputChange}
                            placeholder={currentUser ? "แสดงความคิดเห็น... (พิมพ์ @ เพื่อกล่าวถึง)" : "กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น"}
                            disabled={!currentUser || isLoading}
                            className="w-full bg-slate-900/50 border border-slate-700 text-slate-200 text-sm rounded-full py-3 px-5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                        />
                        <button 
                            type="submit"
                            disabled={!newComment.trim() || isLoading}
                            className="absolute right-2 top-1.5 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20"
                        >
                            <Send size={16} className={isLoading ? "animate-spin" : "ml-0.5"} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};