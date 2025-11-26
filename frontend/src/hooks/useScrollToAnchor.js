import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useScrollToAnchor = () => {
  const location = useLocation();

  useEffect(() => {
    // ดึงค่าจาก Query Params
    const params = new URLSearchParams(location.search);
    const reviewId = params.get('scrollToReview');
    const commentId = params.get('scrollToComment');

    // รอให้หน้าโหลด DOM เสร็จสักครู่
    const timer = setTimeout(() => {
      let elementId = null;
      if (commentId) elementId = `comment-${commentId}`; 
      else if (reviewId) elementId = `review-${reviewId}`;

      if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
          // สั่งให้เลื่อนหน้าจอไปหา
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // ทำ Highlight ชั่วคราว
          element.classList.add('ring-4', 'ring-blue-500', 'bg-blue-100', 'transition-all', 'duration-500');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-500', 'bg-blue-100', 'transition-all', 'duration-500');
          }, 3000);
        }
      }
    }, 800); // Delay เล็กน้อยเผื่อโหลดข้อมูล

    return () => clearTimeout(timer);
  }, [location.search]); // ทำงานทุกครั้งที่ URL เปลี่ยน
};