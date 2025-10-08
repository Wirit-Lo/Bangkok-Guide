import React, { useState } from 'react';
import { Calculator, Info, DollarSign, XCircle } from 'lucide-react';
import Modal from './Modal'; // Import Modal component

const TravelCostCalculator = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [transportMode, setTransportMode] = useState('car');
  const [estimatedCost, setEstimatedCost] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Mock costs per mode (simplified)
  const costs = {
    car: { base: 50, perKm: 5 }, // Baht
    bts: { base: 16, max: 59 },
    bus: { base: 8, max: 25 },
    motorcycle: { base: 20, perKm: 10 }
  };

  // Mock distances (for demonstration, in a real app, use a distance matrix API)
  const mockDistances = {
    'วัดพระศรีมหาธาตุวรมหาวิหาร-มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)': 5,
    'วัดพระศรีมหาธาตุวรมหาวิหาร-เซ็นทรัลพลาซา รามอินทรา': 3,
    'มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)-เซ็นทรัลพลาซา รามอินทรา': 7,
    'วัดพระศรีมหาธาตุวรมหาวิหาร-ร้านอาหารบ้านหญิง': 2,
    'มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)-คาเฟ่ลับบางเขน': 1,
    'เซ็นทรัลพลาซา รามอินทรา-ตลาดนัดเลียบด่วนรามอินทรา': 10,
    'default': 5 // ระยะทางเริ่มต้นหากไม่พบเส้นทางที่ระบุ
  };

  const calculateCost = () => {
    if (!origin || !destination) {
      setModalMessage("กรุณากรอกจุดเริ่มต้นและจุดหมายปลายทางให้ครบถ้วน");
      setShowModal(true);
      return;
    }

    let distanceKm = mockDistances[`${origin}-${destination}`] || mockDistances.default;

    let cost = 0;
    switch (transportMode) {
      case 'car':
        cost = costs.car.base + (distanceKm * costs.car.perKm);
        break;
      case 'bts':
        // ค่า BTS ซับซ้อนกว่านี้ ใช้ช่วงง่ายๆ สำหรับจำลอง
        cost = Math.min(costs.bts.base + (distanceKm * 3), costs.bts.max);
        break;
      case 'bus':
        // ค่ารถเมล์มักจะคงที่หรือเป็นขั้นบันได
        cost = Math.min(costs.bus.base + (distanceKm * 1), costs.bus.max);
        break;
      case 'motorcycle':
        cost = costs.motorcycle.base + (distanceKm * costs.motorcycle.perKm);
        break;
      default:
        cost = 0;
    }
    setEstimatedCost(cost.toFixed(2));
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMessage('');
  };

  return (
    <div className="p-8 bg-white rounded-2xl shadow-xl max-w-2xl mx-auto animate-fade-in-up">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 text-center">
        <Calculator className="inline-block mr-3 text-orange-500" size={32} />
        คำนวณค่าใช้จ่ายในการเดินทาง
      </h2>
      <div className="space-y-6">
        <div>
          <label htmlFor="origin" className="block text-gray-700 text-base font-bold mb-2">
            จุดเริ่มต้น:
          </label>
          <input
            type="text"
            id="origin"
            className="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-lg"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="เช่น วัดพระศรีมหาธาตุฯ"
          />
        </div>
        <div>
          <label htmlFor="destination" className="block text-gray-700 text-base font-bold mb-2">
            จุดหมายปลายทาง:
          </label>
          <input
            type="text"
            id="destination"
            class="shadow-sm appearance-none border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-lg"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="เช่น มหาวิทยาลัยเกษตรศาสตร์"
          />
        </div>
        <div>
          <label htmlFor="transportMode" className="block text-gray-700 text-base font-bold mb-2">
            วิธีการเดินทาง:
          </label>
          <select
            id="transportMode"
            className="shadow-sm border border-gray-300 rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 bg-white text-lg"
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value)}
          >
            <option value="car">รถยนต์ส่วนตัว</option>
            <option value="bts">รถไฟฟ้า BTS</option>
            <option value="bus">รถเมล์</option>
            <option value="motorcycle">วินมอเตอร์ไซค์</option>
          </select>
        </div>
        <button
          onClick={calculateCost}
          className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-3.5 px-4 rounded-full flex items-center justify-center space-x-2 hover:from-green-600 hover:to-teal-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 shadow-lg font-semibold text-lg"
        >
          <DollarSign size={22} />
          <span>คำนวณค่าใช้จ่าย</span>
        </button>
      </div>

      {estimatedCost !== null && (
        <div className="mt-8 p-5 bg-blue-50 border-l-4 border-blue-600 text-blue-800 rounded-lg shadow-md animate-fade-in-up">
          <p className="text-xl font-semibold flex items-center">
            <Info size={24} className="mr-3 text-blue-600" />
            ค่าใช้จ่ายโดยประมาณ: <span className="ml-2 text-3xl font-bold text-blue-700">{estimatedCost}</span> บาท
          </p>
          <p className="text-sm mt-3 text-gray-600">
            *ค่าใช้จ่ายนี้เป็นเพียงการประมาณการ อาจแตกต่างจากค่าใช้จ่ายจริงขึ้นอยู่กับปัจจัยต่างๆ
          </p>
        </div>
      )}

      {/* Custom Modal สำหรับแจ้งเตือน */}
      {showModal && (
        <Modal message={modalMessage} onClose={closeModal} />
      )}
    </div>
  );
};

export default TravelCostCalculator;