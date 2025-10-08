import React from 'react';
import ItemCard from './ItemCard';

const HomePage = ({ attractions, foodShops, handleItemClick }) => {
  // Combine all items into a single array for display
  const allItems = [...attractions, ...foodShops];

  return (
    <div className="p-8 bg-white rounded-2xl shadow-xl text-center animate-fade-in-up">
      <h2 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-6 leading-tight">
        <span className="text-blue-600">ยินดีต้อนรับ</span> สู่ <span className="text-purple-600">บางเขน ทราเวลไกด์!</span>
      </h2>
      <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-3xl mx-auto animate-fade-in-up delay-100">
        ค้นพบสถานที่ท่องเที่ยวที่น่าสนใจ, ร้านอาหารอร่อย, และร้านค้าเก๋ๆ ในเขตบางเขน
        พร้อมวางแผนการเดินทางและคำนวณค่าใช้จ่ายได้อย่างง่ายดาย เพื่อประสบการณ์ที่น่าจดจำ
      </p>

      {/* New Grid layout for cards */}
      <h3 className="text-2xl font-bold text-left text-gray-800 mb-6">สถานที่แนะนำในเขตบางเขน</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {allItems.map(item => (
          <ItemCard key={item.id} item={item} handleItemClick={handleItemClick} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
