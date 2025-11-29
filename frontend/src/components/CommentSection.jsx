import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Heart, MessageSquare, Send, User, CornerDownRight, ChevronUp, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://bangkok-guide.onrender.com';

// --- Helper: Group Comments (จัดกลุ่มแม่-ลูก) ---
const groupComments = (comments) => {
    if (!comments || comments.length === 0) return [];
    // เรียงตามเวลาเก่า -> ใหม่
    const sorted = comments.map(c => ({ ...c, replies: [] })).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const byId = new Map(sorted.map(c => [String(c.id), c]));
    const roots = [];

    sorted.forEach(comment => {
        const parentId = comment.reply_to_id || comment.replyToId || comment.parent_id;
        if (parentId && byId.has(String(parentId))) {
            byId.get(String(parentId)).replies.push(comment);
        } else {
            roots.push(comment);
        }
    });
    // เรียง Root ใหม่สุดอยู่บน
    return roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

// --- Sub-Component: Single Comment Item ---
const CommentItem = ({ comment, currentUser, onLike, onReply }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const hasReplies = comment.replies && comment.replies.length > 0;

    return (
        <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 mb-4">
            <div className="flex gap-4">
                {/* Avatar Display Logic */}
                <div className="shrink-0">
                    {comment.author_profile_image_url ? (
                        <img src={comment.author_profile_image_url} alt={comment.author} className="w-10 h-10 rounded-full border-2 border-slate-600" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold border-2 border-slate-600">
                            <User size={20} />
                        </div>
                    )}
                </div>

                <div className="flex-1">
                    <div className="flex justify-between items-baseline">
                        <span className="font-bold text-white">{comment.author}</span>
                        <span className="text-xs text-slate-500">{comment.created_at ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: th }) : ''}</span>
                    </div>
                    <p className="text-slate-300 text-sm mt-1">{comment.comment}</p>

                    <div className="flex gap-4 mt-2">
                        <button onClick={() => onLike(comment.id, comment.user_has_liked)} className={`text-xs flex items-center gap-1 ${comment.user_has_liked ? 'text-pink-500' : 'text-slate-500 hover:text-pink-400'}`}>
                            <Heart size={14} fill={comment.user_has_liked ? "currentColor" : "none"} /> {comment.likes_count || 0}
                        </button>
                        <button onClick={() => onReply(comment)} className="text-xs text-slate-500 hover:text-blue-400">ตอบกลับ</button>
                    </div>

                    {/* Nested Replies Section */}
                    {hasReplies && (
                        <div className="mt-3 ml-2 border-l-2 border-slate-700 pl-4">
                            {!isExpanded ? (
                                <button onClick={() => setIsExpanded(true)} className="text-xs text-blue-400 flex items-center gap-1">
                                    <CornerDownRight size={12} /> ดู {comment.replies.length} การตอบกลับ
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <button onClick={() => setIsExpanded(false)} className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                                        <ChevronUp size={12} /> ซ่อน
                                    </button>
                                    {comment.replies.map(reply => (
                                        <div key={reply.id} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white shrink-0">
                                                {reply.author[0]}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex gap-2 items-baseline">
                                                    <span className="font-bold text-sm text-white">{reply.author}</span>
                                                    <span className="text-[10px] text-slate-500">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true, locale: th })}</span>
                                                </div>
                                                <p className="text-xs text-slate-300">{reply.comment}</p>
                                                <div className="flex gap-3 mt-1">
                                                    <button onClick={() => onLike(reply.id, reply.user_has_liked)} className={`text-[10px] flex gap-1 ${reply.user_has_liked ? 'text-pink-500' : 'text-slate-500'}`}>
                                                        <Heart size={10} /> {reply.likes_count}
                                                    </button>
                                                    <button onClick={() => onReply(comment)} className="text-[10px] text-slate-500 hover:text-blue-400">ตอบกลับ</button>
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
        </div>
    );
};

export const CommentSection = ({ locationId, currentUser, onReviewChange }) => {
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    
    // ✅ เพิ่ม State สำคัญ: เก็บ ID ของคอมเมนต์ที่กำลังตอบกลับ
    const [replyingTo, setReplyingTo] = useState(null); 
    const inputRef = useRef(null);

    // Fetch Comments (เหมือนเดิม แต่รองรับข้อมูลที่ต้องนำมาจัดกลุ่ม)
    const fetchComments = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/reviews/${locationId}`); // ใช้ Endpoint หลักที่รวมรีวิวทั้งหมด
            if (response.ok) {
                const data = await response.json();
                setComments(data);
            }
        } catch (error) { console.error("Error fetching comments:", error); }
    };

    useEffect(() => { fetchComments(); }, [locationId]);

    // ✅ ใช้ useMemo จัดกลุ่มคอมเมนต์เพื่อแสดงผล
    const organizedComments = useMemo(() => groupComments(comments), [comments]);

    const handleReplyClick = (comment) => {
        setReplyingTo(comment); // ✅ เก็บ ID ไว้
        setNewComment(`@${comment.author} `);
        if(inputRef.current) {
            inputRef.current.focus();
            inputRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !currentUser) return;
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('comment', newComment);
            formData.append('rating', 5);
            
            // ✅ ส่ง reply_to_id ไปให้ Backend ถ้าระบบจำค่า replyingTo ได้
            if (replyingTo && replyingTo.id) {
                formData.append('reply_to_id', String(replyingTo.id));
            }

            const response = await fetch(`${API_BASE_URL}/api/reviews/${locationId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                setNewComment("");
                setReplyingTo(null); // ✅ Reset ค่า
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
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">รีวิวและความคิดเห็น</h3>
            
            <div className="space-y-4 mb-8">
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">ยังไม่มีความคิดเห็น</div>
                ) : (
                    // ✅ Render เฉพาะ Root comments (คอมเมนต์แม่) แล้วให้ Component จัดการลูกเอง
                    organizedComments.map(root => (
                        <CommentItem 
                            key={root.id} 
                            comment={root} 
                            currentUser={currentUser} 
                            onLike={() => {}} // ใส่ Logic Like ตามต้องการ
                            onReply={handleReplyClick} 
                        />
                    ))
                )}
            </div>

            {/* Input Box */}
            <div className={`bg-slate-800 p-4 rounded-xl border ${replyingTo ? 'border-blue-500/50' : 'border-slate-700'} relative`}>
                {/* ✅ แสดงสถานะว่ากำลังตอบกลับใคร */}
                {replyingTo && (
                    <div className="flex items-center justify-between mb-2 text-xs text-blue-300 bg-blue-500/10 p-2 rounded">
                        <span>กำลังตอบกลับคุณ <b>{replyingTo.author}</b></span>
                        <button onClick={() => { setReplyingTo(null); setNewComment(""); }}><X size={14}/></button>
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <div className="flex-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={currentUser ? (replyingTo ? "พิมพ์ข้อความตอบกลับ..." : "แสดงความคิดเห็น...") : "กรุณาเข้าสู่ระบบ"}
                            disabled={!currentUser || isLoading}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-full py-2 px-4 focus:border-blue-500 outline-none text-sm"
                        />
                    </div>
                    <button type="submit" disabled={!newComment.trim() || isLoading} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-500">
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};