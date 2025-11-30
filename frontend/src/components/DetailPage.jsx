import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    MapPin, Star, Clock, Phone, ChevronLeft, 
    X, Edit, Trash2, Heart, ChevronRight, Gift, Plus, 
    Image as ImageIcon, Save, AlertTriangle,
    MessageSquare, Send, User, CornerDownRight,
    MessageCircle, ChevronDown, ChevronUp, ThumbsUp, Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

// --- START: API URL Configuration ---
const getApiBaseUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://bangkok-guide.onrender.com';
};
const API_BASE_URL = getApiBaseUrl();
// --- END: API URL Configuration ---

// --- Helper Component: Avatar ---
const Avatar = ({ src, alt, size = "md", className = "" }) => {
    const sizeClasses = { xs: "w-6 h-6", sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };
    const baseClass = `${sizeClasses[size] || sizeClasses.md} rounded-full object-cover border-2 border-slate-700 shadow-sm shrink-0 ${className}`;

    if (src && src !== 'null' && src !== 'undefined') {
        return (
            <img 
                src={src} 
                alt={alt} 
                className={`${baseClass} bg-slate-800`}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
            />
        );
    }

    const gradients = ["from-pink-400 to-orange-400", "from-blue-400 to-indigo-500", "from-green-400 to-teal-500", "from-purple-400 to-pink-500", "from-yellow-400 to-orange-500", "from-teal-400 to-blue-500"];
    const randomGradient = gradients[alt ? alt.length % gradients.length : 0];

    return (
        <div className={`${baseClass} bg-gradient-to-br ${randomGradient} flex items-center justify-center text-white border-slate-700`}>
            <User size={size === 'xs' ? 12 : (size === 'sm' ? 14 : 20)} strokeWidth={2.5} />
        </div>
    );
};

// --- Helper: Parse Text with Mentions ---
const renderContentWithMentions = (text) => {
    if (!text) return null;
    const parts = text.split(/(@[\wก-๙.-]+(?: [\wก-๙.-]+)?)/g); 
    return parts.map((part, index) => {
        if (part.startsWith('@')) {
            return <span key={index} className="text-blue-400 font-semibold cursor-pointer hover:underline">{part}</span>;
        }
        return part;
    });
};

// --- Comment Grouping Logic ---
const groupComments = (comments) => {
    if (!comments || comments.length === 0) return [];
    const sorted = comments.map(c => ({ ...c, replies: [] })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const byId = new Map();
    sorted.forEach(c => byId.set(String(c.id), c));
    const roots = [];
    sorted.forEach(comment => {
        const parentId = comment.reply_to_id ? String(comment.reply_to_id) : null;
        if (parentId && byId.has(parentId)) {
            byId.get(parentId).replies.push(comment);
        } else {
            roots.push(comment);
        }
    });
    return roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); // Newest first
};

// --- Single Comment Item Component ---
const CommentItem = ({ comment, currentUser, onLike, onReply }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasReplies = comment.replies && comment.replies.length > 0;

    return (
        <div className="flex gap-4 animate-fade-in-up" id={`comment-${comment.id}`}>
            <Avatar src={comment.author_profile_image_url || comment.authorProfileImageUrl} alt={comment.author || "User"} />
            <div className="flex-1 min-w-0">
                <div className="bg-[#334155]/50 border border-slate-700 rounded-2xl px-4 py-3 relative group hover:border-slate-600 transition-all">
                    <div className="flex items-baseline justify-between mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-base truncate">{comment.author}</span>
                            {comment.author === 'Admin' && <span className="bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 font-semibold tracking-wider">ADMIN</span>}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{comment.created_at ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: th }) : 'เมื่อสักครู่'}</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed break-words">{renderContentWithMentions(comment.comment)}</p>
                </div>

                <div className="flex items-center gap-4 mt-1 ml-2 mb-2">
                    <button onClick={() => onLike(comment.id, comment.user_has_liked)} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${comment.user_has_liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-400'}`}>
                        <Heart size={14} fill={comment.user_has_liked ? "currentColor" : "none"} className={comment.user_has_liked ? "animate-pulse" : ""} />
                        <span>{comment.likes_count || 0} ถูกใจ</span>
                    </button>
                    <button onClick={() => onReply(comment)} className="text-xs text-slate-500 hover:text-blue-400 transition-colors font-medium flex items-center gap-1">
                        <MessageCircle size={14} /> ตอบกลับ
                    </button>
                </div>

                {hasReplies && (
                    <div className="mt-2">
                        {!isExpanded ? (
                            <button onClick={() => setIsExpanded(true)} className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors ml-2 bg-blue-500/10 px-3 py-1.5 rounded-full">
                                <CornerDownRight size={14} /> ดูการตอบกลับ {comment.replies.length} รายการ
                            </button>
                        ) : (
                            <div className="pl-4 sm:pl-8 relative space-y-4">
                                <div className="absolute left-0 top-0 bottom-4 w-[2px] bg-slate-700 rounded-full"></div>
                                <button onClick={() => setIsExpanded(false)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2 ml-2"><ChevronUp size={14} /> ซ่อนการตอบกลับ</button>
                                {comment.replies.map(reply => (
                                    <div key={reply.id} className="relative animate-fade-in" id={`comment-${reply.id}`}>
                                        <div className="flex gap-3">
                                            <Avatar src={reply.author_profile_image_url || reply.authorProfileImageUrl} alt={reply.author} size="sm" />
                                            <div className="flex-1 min-w-0">
                                                <div className="bg-[#334155]/30 border border-slate-700/50 rounded-2xl px-3 py-2">
                                                    <div className="flex items-baseline justify-between mb-1">
                                                        <span className="font-bold text-white text-sm">{reply.author}</span>
                                                        <span className="text-[10px] text-slate-500">{reply.created_at ? formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: th }) : ''}</span>
                                                    </div>
                                                    <p className="text-slate-300 text-xs leading-relaxed break-words">{renderContentWithMentions(reply.comment)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 ml-2">
                                                    <button onClick={() => onLike(reply.id, reply.user_has_liked)} className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${reply.user_has_liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-400'}`}>
                                                        <Heart size={12} fill={reply.user_has_liked ? "currentColor" : "none"} /> {reply.likes_count || 0}
                                                    </button>
                                                    <button onClick={() => onReply(comment)} className="text-[10px] text-slate-500 hover:text-blue-400 font-medium">ตอบกลับ</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- CommentSection Component ---
const CommentSection = ({ locationId, currentUser, onReviewChange, handleAuthError, setNotification, targetCommentId, clearTargetCommentId }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null); 
    const sectionRef = useRef(null);
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef(null);
    const [systemUsers, setSystemUsers] = useState([]);

    useEffect(() => {
        if (targetCommentId && comments.length > 0) {
            const element = document.getElementById(`comment-${targetCommentId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-[#1e293b]');
                setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2', 'ring-offset-[#1e293b]'), 3000);
                if (clearTargetCommentId) clearTargetCommentId();
            } else if (sectionRef.current) {
                sectionRef.current.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [targetCommentId, comments, clearTargetCommentId]);

    useEffect(() => {
        const fetchSystemUsers = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/users`); 
                if (response.ok) {
                    const data = await response.json();
                    setSystemUsers(Array.isArray(data) ? data.map(u => ({ name: u.displayName || u.display_name || u.username, username: u.username, avatar: u.profile_image_url || u.profileImageUrl || u.avatar, id: u.id })) : []);
                }
            } catch (error) {}
        };
        if (currentUser) fetchSystemUsers();
    }, [currentUser]);

    const fetchComments = async () => {
        try {
            const userIdQuery = currentUser ? `?userId=${currentUser.id}` : '';
            const response = await fetch(`${API_BASE_URL}/api/reviews/${locationId}${userIdQuery}`);
            const data = await response.json();
            const uniqueComments = Array.isArray(data) ? Array.from(new Map(data.map(item => [item.id, item])).values()) : [];
            setComments(uniqueComments);
        } catch (error) { console.error("Error fetching comments:", error); }
    };

    useEffect(() => { fetchComments(); }, [locationId, currentUser]);

    const organizedComments = useMemo(() => groupComments(comments), [comments]);

    const allMentionCandidates = useMemo(() => {
        const commentUsers = comments.map(c => ({ name: c.author, avatar: c.author_profile_image_url || c.authorProfileImageUrl, id: c.user_id })).filter(u => u.name);
        const combined = [...commentUsers, ...systemUsers];
        const uniqueMap = new Map();
        combined.forEach(user => {
            if (user.name && user.name !== currentUser?.username && user.name !== currentUser?.displayName) {
                if (!uniqueMap.has(user.name)) uniqueMap.set(user.name, user);
                else if (user.id && !uniqueMap.get(user.name).id) uniqueMap.set(user.name, user);
            }
        });
        return Array.from(uniqueMap.values());
    }, [comments, systemUsers, currentUser]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setNewComment(val);
        const selectionStart = e.target.selectionStart;
        setCursorPosition(selectionStart);
        const lastAtPos = val.lastIndexOf('@', selectionStart);
        if (lastAtPos !== -1 && lastAtPos < selectionStart) {
            const charBeforeAt = lastAtPos > 0 ? val[lastAtPos - 1] : ' ';
            if (charBeforeAt === ' ' || charBeforeAt === '\n') {
                const query = val.substring(lastAtPos + 1, selectionStart);
                if (!query.includes(' ')) { setShowMentionList(true); setMentionQuery(query); return; }
            }
        }
        setShowMentionList(false);
    };

    const insertMention = (name) => {
        const val = newComment;
        const lastAtPos = val.lastIndexOf('@', cursorPosition);
        if (lastAtPos !== -1) {
            const before = val.substring(0, lastAtPos);
            const after = val.substring(cursorPosition);
            setNewComment(`${before}@${name} ${after}`);
            setShowMentionList(false);
            if(inputRef.current) inputRef.current.focus();
        }
    };

    const handleReplyClick = (comment) => {
        // ✅ Check Login
        if (!currentUser) {
            if (setNotification) setNotification({ message: 'กรุณาเข้าสู่ระบบก่อนตอบกลับ', type: 'error' });
            return;
        }
        setReplyingTo(comment);
        setNewComment(`@${comment.author} `);
        if(inputRef.current) { inputRef.current.focus(); inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    };

    const handleCancelReply = () => { setReplyingTo(null); setNewComment(""); };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (newComment.trim()) handleSubmit(e); } };

    const handleLike = async (commentId, userLiked) => {
        // ✅ Check Login
        if (!currentUser) {
            if (setNotification) setNotification({ message: 'กรุณาเข้าสู่ระบบก่อนกดถูกใจ', type: 'error' });
            return;
        }
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: userLiked ? parseInt(c.likes_count) - 1 : parseInt(c.likes_count) + 1, user_has_liked: !userLiked } : c));
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE_URL}/api/reviews/${commentId}/toggle-like`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        } catch (error) { fetchComments(); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // ✅ Check Login
        if (!currentUser) {
            if (setNotification) setNotification({ message: 'กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น', type: 'error' });
            return;
        }
        if (!newComment.trim()) return;
        setIsLoading(true);

        const mentionedUserIds = [];
        allMentionCandidates.forEach(user => { if (user.id && newComment.includes(`@${user.name}`)) mentionedUserIds.push(user.id); });

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('comment', newComment);
            formData.append('rating', 5);
            if (replyingTo?.id) formData.append('reply_to_id', String(replyingTo.id));
            if (mentionedUserIds.length > 0) formData.append('mentionedUserIds', JSON.stringify(mentionedUserIds));

            const response = await fetch(`${API_BASE_URL}/api/reviews/${locationId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (response.ok) {
                setNewComment(""); setReplyingTo(null); setShowMentionList(false);
                fetchComments();
                if(onReviewChange) onReviewChange();
                if(setNotification) setNotification({ message: 'แสดงความคิดเห็นสำเร็จ', type: 'success' });
            }
        } catch (error) { console.error("Submit failed", error); } finally { setIsLoading(false); }
    };

    const filteredCandidates = allMentionCandidates.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));

    return (
        <div ref={sectionRef} className="bg-[#1e293b] rounded-2xl p-6 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">รีวิวและความคิดเห็น</h3>
            <div className="space-y-6 mb-8">
                <div className="flex items-center gap-2 text-blue-400 mb-4 font-semibold">
                    <MessageSquare size={20} /><span>ความคิดเห็น ({comments.length})</span>
                </div>
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-800/50 rounded-xl border border-slate-700 border-dashed">ยังไม่มีความคิดเห็น เป็นคนแรกที่แสดงความคิดเห็นสิ!</div>
                ) : (
                    organizedComments.map(rootComment => (
                        <CommentItem key={rootComment.id} comment={rootComment} currentUser={currentUser} onLike={handleLike} onReply={handleReplyClick} />
                    ))
                )}
            </div>

            <div className={`bg-[#334155] p-4 rounded-xl border ${replyingTo ? 'border-blue-500/50 ring-1 ring-blue-500/20' : 'border-slate-600'} relative transition-all duration-300`}>
                {replyingTo && (
                    <div className="flex items-center justify-between mb-3 bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20 animate-fade-in">
                        <div className="flex items-center gap-2 text-sm text-blue-300"><CornerDownRight size={16} /><span>กำลังตอบกลับ <b>{replyingTo.author}</b></span></div>
                        <button onClick={handleCancelReply} className="text-slate-400 hover:text-white bg-slate-700/50 p-1 rounded-full"><X size={14} /></button>
                    </div>
                )}
                {showMentionList && filteredCandidates.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl overflow-hidden z-30 animate-fade-in-up">
                        <div className="p-2 bg-slate-900/80 text-xs text-slate-400 font-semibold border-b border-slate-700">แนะนำ (Mention)</div>
                        <div className="max-h-48 overflow-y-auto">
                            {filteredCandidates.map((user, idx) => (
                                <button key={idx} onClick={() => insertMention(user.name)} className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-0">
                                    <Avatar src={user.avatar} alt={user.name} size="xs" />{user.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="flex gap-3 items-end">
                    <div className="hidden sm:block pb-1"><Avatar src={currentUser?.profileImageUrl} alt={currentUser?.username || "Me"} /></div>
                    <div className="flex-1 relative">
                        <textarea ref={inputRef} value={newComment} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={currentUser ? (replyingTo ? "พิมพ์ข้อความตอบกลับ..." : "แสดงความคิดเห็น... (พิมพ์ @ เพื่อกล่าวถึง)") : "กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น"} disabled={isLoading} rows={1} style={{ minHeight: '44px', maxHeight: '120px' }} className="w-full bg-slate-900/50 border border-slate-600 text-slate-200 text-sm rounded-2xl py-3 px-4 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500 shadow-inner resize-none overflow-hidden" onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }} />
                        <button type="submit" disabled={!newComment.trim() || isLoading} className="absolute right-2 bottom-2 p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center">
                            <Send size={16} className={isLoading ? "animate-spin" : "ml-0.5"} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

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
                        <div className="mt-2"><p className="text-sm text-gray-500 dark:text-gray-300">{message}</p></div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm" onClick={onConfirm}>ยืนยัน</button>
                    <button type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-500 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm" onClick={onClose}>ยกเลิก</button>
                </div>
            </div>
        </div>
    );
};

const ProductCard = ({ product, currentUser, onEditClick, onDeleteClick }) => {
    const canModify = currentUser && (String(currentUser.id) === String(product.user_id) || currentUser.role === 'admin');
    return (
        <div className="group relative flex items-center gap-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <img src={product.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'} alt={product.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-200 dark:bg-gray-600" onError={(e) => { e.target.src = 'https://placehold.co/100x100/cccccc/333333?text=Error'; }} />
            <div className="overflow-hidden flex-grow"><h5 className="font-bold text-gray-800 dark:text-gray-100">{product.name}</h5><p className="text-sm text-gray-500 dark:text-gray-400 truncate">{product.description}</p></div>
            {canModify && (
                <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditClick(product)} className="p-1.5 bg-white/50 dark:bg-gray-600/50 rounded-full text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50" title="แก้ไข"><Edit size={14} /></button>
                    <button onClick={() => onDeleteClick(product.id)} className="p-1.5 bg-white/50 dark:bg-gray-600/50 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="ลบ"><Trash2 size={14} /></button>
                </div>
            )}
        </div>
    );
};

const ProductModal = ({ product, locationId, onClose, onSave, setNotification, handleAuthError }) => {
    const [name, setName] = useState(product?.name || '');
    const [description, setDescription] = useState(product?.description || '');
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(product?.imageUrl || null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleImageFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) { setNotification({ message: 'กรุณากรอกชื่อของขึ้นชื่อ', type: 'error' }); return; }
        setIsSubmitting(true);
        const token = localStorage.getItem('token');
        if (!token) { handleAuthError(); setIsSubmitting(false); return; }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        if (imageFile) formData.append('image', imageFile);
        if (!product && locationId) formData.append('locationId', locationId);

        const isEditing = !!product;
        const url = isEditing ? `${API_BASE_URL}/api/famous-products/${product.id}` : `${API_BASE_URL}/api/famous-products`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            if (response.status === 401 || response.status === 403) { handleAuthError(); return; }
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
            setNotification({ message: isEditing ? 'อัปเดตข้อมูลสำเร็จ' : 'เพิ่มของขึ้นชื่อสำเร็จ', type: 'success' });
            onSave(); onClose();
        } catch (error) { setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' }); } finally { setIsSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{product ? 'แก้ไขของขึ้นชื่อ' : 'เพิ่มของขึ้นชื่อใหม่'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal"><X size={20} className="text-gray-600 dark:text-gray-300" /></button>
                </div>
                <form id="product-modal-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                    <div><label htmlFor="product-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ชื่อของขึ้นชื่อ <span className="text-red-500">*</span></label><input id="product-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500" required /></div>
                    <div><label htmlFor="product-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คำอธิบาย</label><textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"></textarea></div>
                    <div><label htmlFor="product-image" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">รูปภาพ</label><input id="product-image" type="file" accept="image/*" onChange={handleImageFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0" />{(previewUrl || product?.imageUrl) && <img src={previewUrl || product.imageUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg bg-gray-200 dark:bg-gray-600" />}</div>
                </form>
                <div className="p-4 border-t dark:border-gray-700 mt-auto flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 font-semibold">ยกเลิก</button>
                    <button type="submit" form="product-modal-form" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"><Save size={18} /> {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                </div>
            </div>
        </div>
    );
};

// --- Main Detail Page Component ---
const DetailPage = ({ item, setCurrentPage, handleItemClick, currentUser, favorites, handleToggleFavorite, handleEditItem, setNotification, handleAuthError, targetCommentId, clearTargetCommentId }) => {
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

    // ✅ Wrapper function for Favorites to check Auth
    const onFavoriteClick = () => {
        if (!currentUser) {
            setNotification({ message: 'กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', type: 'error' });
            return;
        }
        handleToggleFavorite(item.id);
    };

    useEffect(() => {
        if (item && item.category) {
            setIsSimilarLoading(true);
            const fetchSimilar = async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/locations/same-category?category=${encodeURIComponent(item.category)}&excludeId=${item.id}`);
                    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                    const data = await response.json();
                    setSimilarPlaces(data);
                } catch (error) { console.error("Failed to fetch similar places:", error); setSimilarPlaces([]); } finally { setIsSimilarLoading(false); }
            };
            fetchSimilar();
        }
    }, [item]);

    const fetchLocationProducts = useCallback(async () => {
        if (!item) return;
        setIsLoadingProducts(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}/famous-products`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to fetch famous products');
            const data = await response.json();
            setLocationProducts(data);
        } catch (error) { console.error(error); } finally { setIsLoadingProducts(false); }
    }, [item]);

    useEffect(() => { if(item?.id) fetchLocationProducts(); }, [item, fetchLocationProducts]);

    const allImages = useMemo(() => {
        if (!item) return [];
        const images = item.imageUrl ? [item.imageUrl] : [];
        if (item.detailImages && Array.isArray(item.detailImages)) images.push(...item.detailImages.filter(img => img));
        return [...new Set(images)];
    }, [item]);

    const isFavorite = useMemo(() => favorites && item && favorites.includes(item.id), [favorites, item]);

    useEffect(() => { window.scrollTo(0, 0); setCurrentSlide(0); }, [item]);

    const handleNavigate = () => {
        if (item.googleMapUrl) window.open(item.googleMapUrl, '_blank');
        else if (item.coords?.lat && item.coords?.lng) window.open(`https://www.google.com/maps?q=${item.coords.lat},${item.coords.lng}`, '_blank');
        else setNotification({ message: 'ไม่มีข้อมูลตำแหน่งสำหรับนำทาง', type: 'warning' });
    };

    const renderStars = (rating) => {
        const r = Math.max(0, Math.min(5, parseFloat(rating || 0)));
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
    
    // ✅ Auth Check for Product Modal
    const handleOpenProductModal = (product = null) => { 
        if (!currentUser) {
            setNotification({ message: 'กรุณาเข้าสู่ระบบก่อนเพิ่มของขึ้นชื่อ', type: 'error' });
            return;
        }
        setEditingProduct(product); setIsProductModalOpen(true); 
    };
    const handleCloseProductModal = () => { setIsProductModalOpen(false); setEditingProduct(null); };
    const handleProductSave = () => { fetchLocationProducts(); };
    const confirmDeleteProduct = (productId) => { setConfirmState({ isOpen: true, title: 'ยืนยันการลบ', message: 'คุณแน่ใจหรือไม่ว่าต้องการลบของขึ้นชื่อนี้?', onConfirm: () => { handleDeleteProduct(productId); setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); } }); };
    
    const handleDeleteProduct = async (productId) => {
        const token = localStorage.getItem('token');
        if (!token) return handleAuthError();
        try {
            const response = await fetch(`${API_BASE_URL}/api/famous-products/${productId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (response.status === 401 || response.status === 403) return handleAuthError();
            if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || 'ไม่สามารถลบได้'); }
            setNotification({ message: 'ลบข้อมูลสำเร็จ', type: 'success' });
            handleProductSave();
        } catch (error) { setNotification({ message: `เกิดข้อผิดพลาด: ${error.message}`, type: 'error' }); }
    };

    const confirmRequestDeletion = () => { setConfirmState({ isOpen: true, title: 'ส่งคำขอลบสถานที่', message: 'คุณแน่ใจหรือไม่? Admin จะทำการตรวจสอบคำขอของคุณก่อนดำเนินการลบ', onConfirm: () => { handleRequestDeletion(); setConfirmState({ isOpen: false, title: '', message: '', onConfirm: () => {} }); } }); };
    
    const handleRequestDeletion = async () => {
        // ✅ Auth Check
        if (!currentUser) {
            setNotification({ message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', type: 'error' });
            return;
        }
        setIsRequestingDelete(true);
        const token = localStorage.getItem('token');
        if (!token) { handleAuthError(); setIsRequestingDelete(false); return; }
        try {
            const response = await fetch(`${API_BASE_URL}/api/locations/${item.id}/request-deletion`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            
            if (response.status === 401 || response.status === 403) return handleAuthError();
            
            const data = await response.json();
            
            if (!response.ok) {
                // ✅ แปลงข้อความ Error เป็นภาษาไทย
                if (data.error === 'Already pending') {
                    throw new Error('คำขอลบนี้ถูกส่งไปแล้วและกำลังรอการตรวจสอบ');
                }
                throw new Error(data.error || 'เกิดข้อผิดพลาดในการส่งคำขอ');
            }

            // ✅ แสดงข้อความสำเร็จเป็นภาษาไทย
            setNotification({ message: 'ส่งคำขอลบเรียบร้อยแล้ว รอการตรวจสอบจากผู้ดูแลระบบ', type: 'success' });
            
            const isFoodShop = ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(item.category);
            const returnPage = isFoodShop ? 'foodshops' : 'attractions';
            setTimeout(() => { setCurrentPage(returnPage); }, 2000);
        } catch (error) { 
            setNotification({ message: error.message, type: 'error' }); 
        }
        finally { setIsRequestingDelete(false); }
    };

    if (!item) { return <div className="flex justify-center items-center h-screen"><p className="text-xl dark:text-gray-300">กำลังโหลดข้อมูลสถานที่...</p></div>; }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const isOwner = currentUser && item && String(currentUser.id) === String(item.user_id);
    const canModifyLocation = isAdmin || isOwner;
    const itemRating = parseFloat(item.rating || 0);

    return (
        <>
            <ConfirmationModal isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.onConfirm} title={confirmState.title} message={confirmState.message} />
            {isLightboxOpen && <ImageLightbox images={allImages} selectedIndex={selectedImageIndex} onClose={closeLightbox} onNext={goToNextImage} onPrev={goToPrevImage} />}
            {isProductModalOpen && <ProductModal product={editingProduct} locationId={item?.id} onClose={handleCloseProductModal} onSave={handleProductSave} setNotification={setNotification} handleAuthError={handleAuthError} />}
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col lg:flex-row lg:gap-12">
                    <main className="lg:w-2/3 w-full">
                        {item.status === 'pending_deletion' && (<div className="p-4 mb-6 bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 rounded-r-lg"><p className="font-bold">สถานะ: รอการอนุมัติลบ</p><p>สถานที่นี้ถูกส่งคำขอลบแล้ว และกำลังรอการตรวจสอบจากผู้ดูแลระบบ</p></div>)}
                        
                        <div className="p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl animate-fade-in-up relative overflow-visible z-10">
                            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                                <button onClick={() => { const isFoodShop = item && ['ร้านอาหาร', 'คาเฟ่', 'ตลาด'].includes(item.category); setCurrentPage(isFoodShop ? 'foodshops' : 'attractions'); }} className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition"><ChevronLeft size={20} className="mr-2" /> กลับไปยังรายการ</button>
                                <div className="flex items-center gap-2">
                                    <button onClick={onFavoriteClick} className="flex items-center gap-2 px-4 py-2 border-2 rounded-full text-red-500 border-red-200 dark:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title={isFavorite ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}><Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} /><span className="font-semibold">{isFavorite ? 'บันทึกแล้ว' : 'บันทึก'}</span></button>
                                    {canModifyLocation && (
                                        <>
                                            <button onClick={() => item && handleEditItem(item)} className="flex items-center gap-2 px-4 py-2 border rounded-full text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><Edit size={16} /><span className="font-semibold hidden sm:inline">แก้ไข</span></button>
                                            {item?.status !== 'pending_deletion' && (<button onClick={confirmRequestDeletion} disabled={isRequestingDelete} className="flex items-center gap-2 px-4 py-2 border rounded-full text-red-600 border-red-200 dark:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"><Trash2 size={16} /><span className="font-semibold hidden sm:inline">{isRequestingDelete ? 'กำลังส่ง...' : 'ร้องขอลบ'}</span></button>)}
                                        </>
                                    )}
                                </div>
                            </div>

                            <h2 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4 text-center leading-tight">{item?.name || 'Loading...'}</h2>
                            <div className="mb-6 relative">
                                <div className="overflow-hidden rounded-xl shadow-lg aspect-w-16 aspect-h-9 bg-gray-200 dark:bg-gray-700">
                                    <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                        {allImages.length > 0 ? (allImages.map((img, index) => (<img key={index} src={img} alt={`${item?.name || 'Image'} ${index + 1}`} className="w-full flex-shrink-0 object-cover cursor-pointer" onClick={() => openLightbox(index)} onError={(e) => { e.target.src = 'https://placehold.co/800x450/cccccc/333333?text=Image+Not+Found'; }} />))) : (<div className="w-full flex-shrink-0 flex items-center justify-center bg-gray-300 dark:bg-gray-700"><ImageIcon size={64} className="text-gray-500" /></div>)}
                                    </div>
                                </div>
                                {allImages.length > 1 && (<><button onClick={prevSlide} className="absolute top-1/2 left-3 -translate-y-1/2 p-2 bg-white/50 rounded-full text-gray-800 hover:bg-white transition-colors"><ChevronLeft size={24} /></button><button onClick={nextSlide} className="absolute top-1/2 right-3 -translate-y-1/2 p-2 bg-white/50 rounded-full text-gray-800 hover:bg-white transition-colors"><ChevronRight size={24} /></button><div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">{allImages.map((_, index) => (<button key={index} onClick={() => goToSlide(index)} className={`w-3 h-3 rounded-full transition-colors ${currentSlide === index ? 'bg-white' : 'bg-white/50 hover:bg-white'}`}></button>))}</div></>)}
                            </div>
                            
                            <div className="flex items-center justify-center mb-6 text-gray-700 dark:text-gray-300"><div className="flex items-center mr-4">{renderStars(itemRating)}<span className="ml-2 text-xl font-bold">{itemRating.toFixed(1)}</span></div></div>
                            <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed mb-6">{item?.fullDescription || item?.description || ''}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-700 dark:text-gray-200 mb-6">
                                <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm"><Clock size={24} className="mr-3 text-purple-600" /> <span className="font-semibold">เวลาทำการ:</span> <span className="ml-2">{item?.hours || 'ไม่มีข้อมูล'}</span></div>
                                <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm"><Phone size={24} className="mr-3 text-green-600" /> <span className="font-semibold">ติดต่อ:</span> <span className="ml-2">{item?.contact || 'ไม่มีข้อมูล'}</span></div>
                            </div>

                            <button onClick={handleNavigate} className="w-full mt-8 bg-gradient-to-r from-teal-500 to-green-600 text-white py-4 px-6 rounded-full flex items-center justify-center space-x-3 hover:from-teal-600 hover:to-green-700 transition transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-teal-300 shadow-lg font-bold text-xl"><MapPin size={24} /><span>นำทางด้วย Google Maps</span></button>
                            <hr className="my-8 border-t-2 border-gray-100 dark:border-gray-700" />
                            
                            <div className="relative z-20">
                                <CommentSection locationId={item.id} currentUser={currentUser} handleAuthError={handleAuthError} setNotification={setNotification} targetCommentId={targetCommentId} clearTargetCommentId={clearTargetCommentId} />
                            </div>
                        </div>
                    </main>

                    <aside className="lg:w-1/3 w-full mt-12 lg:mt-0 lg:sticky lg:top-8 self-start">
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10">
                            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-5">{item?.category ? `สถานที่อื่นในหมวดหมู่ "${item.category}"` : 'สถานที่แนะนำ'}</h3>
                            {isSimilarLoading ? (<p className="text-gray-500 dark:text-gray-400">กำลังค้นหาสถานที่...</p>) : similarPlaces.length > 0 ? (<div className="space-y-4">{similarPlaces.map(place => (<div key={place.id} className="flex items-center gap-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors" onClick={() => handleItemClick(place)}><img src={place.imageUrl || 'https://placehold.co/100x100/cccccc/333333?text=No+Image'} alt={place.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-gray-200 dark:bg-gray-600" /><div className="overflow-hidden"><h5 className="font-bold text-gray-800 dark:text-gray-100 truncate">{place.name}</h5><p className="text-sm text-gray-500 dark:text-gray-400 truncate">{place.category}</p></div></div>))}</div>) : (<p className="text-gray-500 dark:text-gray-400 text-center p-4">ไม่พบสถานที่อื่นในหมวดหมู่นี้</p>)}
                        </div>
                        <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10">
                            <div className="flex justify-between items-center mb-5"><h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center"><Gift size={24} className="mr-3 text-amber-500" />ของขึ้นชื่อประจำที่นี่</h3>
                            {/* ✅ Add Button with Auth Check inside handler */}
                            <button onClick={() => handleOpenProductModal(null)} className="flex items-center text-sm bg-blue-500 text-white font-semibold py-1 px-3 rounded-full hover:bg-blue-600 transition-colors"><Plus size={16} className="mr-1" />เพิ่ม</button></div>
                            {isLoadingProducts ? (<p className="text-gray-500 dark:text-gray-400">กำลังโหลดข้อมูล...</p>) : locationProducts.length > 0 ? (<div className="space-y-4">{locationProducts.map(product => (<ProductCard key={product.id} product={product} currentUser={currentUser} onEditClick={handleOpenProductModal} onDeleteClick={confirmDeleteProduct} />))}</div>) : (<p className="text-gray-500 dark:text-gray-400 text-center p-4">ยังไม่มีของขึ้นชื่อสำหรับสถานที่นี้</p>)}
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
};

export default DetailPage;