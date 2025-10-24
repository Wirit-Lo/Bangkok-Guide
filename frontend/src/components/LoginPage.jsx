import React, { useState } from 'react';
import { User, Lock, LogIn, UserPlus, Loader, Eye, EyeOff } from 'lucide-react';

// --- ⭐⭐⭐ ลบบรรทัดนี้ทิ้งไปแล้ว ⭐⭐⭐ ---
// const API_BASE_URL = 'http://localhost:5000'; // Use the one passed from App.jsx or defined globally

// --- ไอคอนสำหรับ Social Login (SVG) ---
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.222 0-9.618-3.518-11.184-8.259l-6.571 4.819A20 20 0 0 0 24 44z"></path>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.082 5.571l6.19 5.238C42.012 36.49 44 30.61 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
  </svg>
);

const FacebookIcon = () => (
  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
    {/* Corrected SVG Path */}
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v7.046C18.343 21.128 22 16.991 22 12z" />
  </svg>
);

// Assume API_BASE_URL is available globally or passed down (now removed local definition)
const LoginPage = ({ onAuthSuccess, setNotification, API_BASE_URL }) => { // Accept API_BASE_URL as prop if needed
  // Use API_BASE_URL directly in fetch calls
  const apiUrl = API_BASE_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5000'); // Ensure apiUrl uses the correct source


  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegisterMode ? '/api/register' : '/api/login';

    if (isRegisterMode && password !== confirmPassword) {
      setLoading(false);
      setNotification({ message: 'รหัสผ่านใหม่ไม่ตรงกัน', type: 'error' });
      return;
    }

    try {
      // Use the apiUrl variable defined above
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
      } else {
          // Handle non-JSON responses (like plain text or HTML error pages)
          const textData = await response.text();
          console.error("Received non-JSON response:", response.status, textData);
          setNotification({ message: `เกิดข้อผิดพลาดจาก Server (${response.status})`, type: 'error' });
          throw new Error(`Server responded with status ${response.status}`);
      }


      if (!response.ok) {
        setNotification({ message: data.error || `เกิดข้อผิดพลาด: ${response.statusText}`, type: 'error' });
        throw new Error(data.error || `เกิดข้อผิดพลาด: ${response.statusText}`);
      }

      if (!isRegisterMode) { // Login Success
        if (data.user && data.token) {
          onAuthSuccess(data.user, data.token);
        } else {
          console.error('Login response missing user or token:', data);
          setNotification({ message: 'การตอบกลับจากเซิร์ฟเวอร์ไม่สมบูรณ์ (Login)', type: 'error' });
        }
      } else { // Register Success
        setNotification({ message: 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ', type: 'success' });
        setIsRegisterMode(false); // Switch back to login view
        // Clear fields after successful registration
        setUsername(''); // Optional: Clear username too, or keep it for convenience
        setPassword('');
        setConfirmPassword('');
      }

    } catch (err) {
      console.error('Authentication Error:', err);
      // Avoid setting generic error state if notification was already set
      if (!notification.message) {
          setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'); // Provide a fallback message
          setNotification({ message: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ', type: 'error'});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    // Placeholder - Social login logic would go here
    setNotification({ message: `การลงชื่อเข้าใช้ด้วย ${provider} ยังไม่เปิดใช้งาน`, type: 'error' });
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">

        {/* --- Left Image Section --- */}
        <div className="hidden md:block md:w-1/2">
          <img
            src="https://images.unsplash.com/photo-1528543606781-2f6e6857f318?q=80&w=1965&auto=format&fit=crop"
            alt="Travel background"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/800x600/cccccc/ffffff?text=Image+Not+Found"; }} // Placeholder on error
          />
        </div>

        {/* --- Right Form Section --- */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
          <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                  {isRegisterMode ? 'สร้างบัญชีใหม่' : 'ยินดีต้อนรับกลับ'}
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {isRegisterMode ? 'กรอกรายละเอียดเพื่อสมัครสมาชิก' : 'เข้าสู่ระบบเพื่อจัดการการเดินทางของคุณ'}
              </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {/* Username Input */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้"
                required
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            {/* Password Input */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
                className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Confirm Password Input (only in register mode) */}
            {isRegisterMode && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                <input
                  type={showPassword ? 'text' : 'password'} // Use same showPassword state
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="ยืนยันรหัสผ่าน"
                  required
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                 {/* Optional: Add show/hide button here too if desired */}
              </div>
            )}

            {/* Error Message Display */}
            {error && <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-indigo-500/50"
            >
              {loading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : (isRegisterMode ? <UserPlus size={20} className="mr-2" /> : <LogIn size={20} className="mr-2" />)}
              {loading ? 'กำลังดำเนินการ...' : (isRegisterMode ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ')}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            <span className="mx-4 text-gray-400 dark:text-gray-500 text-sm">หรือ</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-4">
            <button onClick={() => handleSocialLogin('Google')} className="w-full flex items-center justify-center py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <GoogleIcon />
              <span className="font-semibold text-gray-700 dark:text-gray-200">ดำเนินการต่อด้วย Google</span>
            </button>
            <button onClick={() => handleSocialLogin('Facebook')} className="w-full flex items-center justify-center py-3 bg-[#1877F2] text-white rounded-lg hover:bg-[#166fe5] transition-colors">
              <FacebookIcon />
              <span className="font-semibold">ดำเนินการต่อด้วย Facebook</span>
            </button>
          </div>

          {/* Toggle Register/Login View */}
          <p className="mt-8 text-sm text-center text-gray-600 dark:text-gray-400">
            {isRegisterMode ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}
            <button type="button" onClick={() => {setIsRegisterMode(!isRegisterMode); setError('');}} className="ml-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">
              {isRegisterMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </p>
        </div>

      </div>

    </div>
  );
};

export default LoginPage;
