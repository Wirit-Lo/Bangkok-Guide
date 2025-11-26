import React from 'react';
import { useNavigate } from 'react-router-dom';

export const NotificationDropdown = ({ notifications, onClose }) => {
  const navigate = useNavigate();

  const handleNotificationClick = async (notification) => {
    // 1. อ่านข้อมูลจาก Payload ที่ Backend ส่งมา
    const { locationId, reviewId, commentId } = notification.payload || {};

    // ตรวจสอบว่ามี locationId หรือไม่ เพื่อทำการ Redirect
    if (locationId) {
      // 2. สร้าง URL พร้อม Query Parameters เพื่อบอกหน้าปลายทางว่าให้เลื่อนไปไหน
      let targetUrl = `/locations/${locationId}`;
      const params = new URLSearchParams();

      if (reviewId) params.append('scrollToReview', reviewId);
      if (commentId) params.append('scrollToComment', commentId);

      if (params.toString()) {
        targetUrl += `?${params.toString()}`;
      }

      // 3. ไปยังหน้าปลายทาง
      navigate(targetUrl);
      
      // 4. (Optional) ตรงนี้คุณอาจจะเรียก API เพื่อ Mark as Read ที่ Backend เพิ่มเติม
      // await markAsRead(notification.id); 
    }
    
    // ปิด Dropdown เมื่อคลิกแล้ว
    if (onClose) onClose();
  };

  const getNotificationText = (type) => {
    switch (type) {
      case 'new_like': return 'กดถูกใจรีวิวของคุณ';
      case 'new_comment_like': return 'กดถูกใจความคิดเห็นของคุณ';
      case 'new_reply': return 'ตอบกลับรีวิวของคุณ';
      case 'mention': return 'กล่าวถึงคุณในความคิดเห็น';
      case 'new_review': return 'รีวิวสถานที่ของคุณ';
      case 'new_location': return 'เพิ่มสถานที่ใหม่';
      default: return 'มีการแจ้งเตือนใหม่';
    }
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl overflow-hidden z-50 border border-gray-200">
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">การแจ้งเตือน</h3>
        <span className="text-xs text-blue-500 cursor-pointer hover:underline">ล้างทั้งหมด</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">ไม่มีการแจ้งเตือน</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <img 
                  src={notif.actor_profile_image_url || "https://via.placeholder.com/40"} 
                  alt="avatar" 
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  onError={(e) => {e.target.src = "https://via.placeholder.com/40"}} // Fallback image
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-800 line-clamp-2">
                    <span className="font-bold">{notif.actor_name}</span> {getNotificationText(notif.type)}
                  </p>
                  {notif.payload?.commentSnippet && (
                    <p className="text-xs text-gray-500 mt-1 italic">"{notif.payload.commentSnippet}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {notif.created_at ? new Date(notif.created_at).toLocaleString('th-TH') : 'เมื่อสักครู่'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};