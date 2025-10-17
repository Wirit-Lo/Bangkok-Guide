import React, { useState } from 'react';
import { Calculator, Info, DollarSign, XCircle, X } from 'lucide-react';

// <<< FIX 1 (CRITICAL): Create and include the Modal component in the same file >>>
const Modal = ({ message, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-6 text-center animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 mb-4">
                    <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">เกิดข้อผิดพลาด</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>
                <button 
                    onClick={onClose} 
                    className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                    ตกลง
                </button>
            </div>
        </div>
    );
};
// <<< END FIX 1 >>>


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
        'มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)-วัดพระศรีมหาธาตุวรมหาวิหาร': 5, // Bidirectional
        'วัดพระศรีมหาธาตุวรมหาวิหาร-เซ็นทรัลพลาซา รามอินทรา': 3,
        'เซ็นทรัลพลาซา รามอินทรา-วัดพระศรีมหาธาตุวรมหาวิหาร': 3,
        'มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)-เซ็นทรัลพลาซา รามอินทรา': 7,
        'เซ็นทรัลพลาซา รามอินทรา-มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)': 7,
        'วัดพระศรีมหาธาตุวรมหาวิหาร-ร้านอาหารบ้านหญิง': 2,
        'ร้านอาหารบ้านหญิง-วัดพระศรีมหาธาตุวรมหาวิหาร': 2,
        'มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)-คาเฟ่ลับบางเขน': 1,
        'คาเฟ่ลับบางเขน-มหาวิทยาลัยเกษตรศาสตร์ (บางเขน)': 1,
        'เซ็นทรัลพลาซา รามอินทรา-ตลาดนัดเลียบด่วนรามอินทรา': 10,
        'ตลาดนัดเลียบด่วนรามอินทรา-เซ็นทรัลพลาซา รามอินทรา': 10,
        'default': 5 // Default distance if route is not found
    };

    // <<< FIX 2 (BUG/UX): Changed to handleSubmit for form submission >>>
    const handleSubmit = (e) => {
        e.preventDefault(); // Prevent page reload

        if (!origin.trim() || !destination.trim()) {
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
                cost = Math.min(costs.bts.base + (distanceKm * 3), costs.bts.max);
                break;
            case 'bus':
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
    // <<< END FIX 2 >>>

    const closeModal = () => {
        setShowModal(false);
        setModalMessage('');
    };

    return (
        <div className="p-6 sm:p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl mx-auto animate-fade-in-up">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-8 text-center">
                <Calculator className="inline-block mr-3 text-orange-500" size={32} />
                คำนวณค่าใช้จ่ายในการเดินทาง
            </h2>
            
            {/* <<< FIX 2 (BUG/UX): Use form with onSubmit >>> */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="origin" className="block text-gray-700 dark:text-gray-300 text-base font-bold mb-2">
                        จุดเริ่มต้น:
                    </label>
                    <input
                        type="text"
                        id="origin"
                        className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-lg w-full py-3 px-4 text-gray-700 dark:text-white bg-white dark:bg-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-lg"
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        placeholder="เช่น วัดพระศรีมหาธาตุฯ"
                    />
                </div>
                <div>
                    <label htmlFor="destination" className="block text-gray-700 dark:text-gray-300 text-base font-bold mb-2">
                        จุดหมายปลายทาง:
                    </label>
                    <input
                        type="text"
                        id="destination"
                        // <<< FIX 2 (BUG/UX): Changed 'class' to 'className' >>>
                        className="shadow-sm appearance-none border border-gray-300 dark:border-gray-600 rounded-lg w-full py-3 px-4 text-gray-700 dark:text-white bg-white dark:bg-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-lg"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="เช่น มหาวิทยาลัยเกษตรศาสตร์"
                    />
                </div>
                <div>
                    <label htmlFor="transportMode" className="block text-gray-700 dark:text-gray-300 text-base font-bold mb-2">
                        วิธีการเดินทาง:
                    </label>
                    <select
                        id="transportMode"
                        className="shadow-sm border border-gray-300 dark:border-gray-600 rounded-lg w-full py-3 px-4 text-gray-700 dark:text-white bg-white dark:bg-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-lg"
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
                    type="submit" // Use type="submit" for form submission
                    className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-3.5 px-4 rounded-full flex items-center justify-center space-x-2 hover:from-green-600 hover:to-teal-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 shadow-lg font-semibold text-lg"
                >
                    <DollarSign size={22} />
                    <span>คำนวณค่าใช้จ่าย</span>
                </button>
            </form>
            {/* <<< END FIX 2 >>> */}

            {/* <<< FIX 3 (UI): Improved result display >>> */}
            {estimatedCost !== null && (
                <div className="mt-8 p-5 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-600 text-blue-800 dark:text-blue-200 rounded-r-lg shadow-md animate-fade-in-up">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                             <Info size={24} className="mr-3 text-blue-600 dark:text-blue-400" />
                             <p className="text-xl font-semibold">
                                ค่าใช้จ่ายโดยประมาณ:
                            </p>
                        </div>
                        <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{estimatedCost} <span className="text-lg font-medium">บาท</span></p>
                    </div>
                    <p className="text-sm mt-3 text-gray-600 dark:text-blue-300/80 pl-9">
                        *ค่าใช้จ่ายนี้เป็นเพียงการประมาณการ อาจแตกต่างจากค่าใช้จ่ายจริง
                    </p>
                </div>
            )}
            {/* <<< END FIX 3 >>> */}

            {/* Use the integrated Modal component */}
            {showModal && (
                <Modal message={modalMessage} onClose={closeModal} />
            )}
        </div>
    );
};

export default TravelCostCalculator;
