import React, { useState } from 'react';
import { User, Lock, LogIn, Eye, EyeOff } from 'lucide-react';

// --- Social Icons ---
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
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v7.046C18.343 21.128 22 16.991 22 12z" />
  </svg>
);

// --- Utils ---
const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));

const LoginPage = ({ onAuthSuccess, setNotification }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');   // ช่องเดียว: รองรับทั้ง username หรืออีเมล แต่จะส่งเป็น 'username'
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const USE_COOKIES = false; // ถ้า backend ใช้ cookie-session ให้เปลี่ยนเป็น true และเปิด credentials ด้านล่าง

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLoginView ? '/api/login' : '/api/register';

    const id = username.trim();
    const payload =
      isLoginView
        // 🔴 สำหรับ login: backend ต้องการ { username, password } เสมอ
        ? { username: id, password: password.trim() }
        // 🟡 สำหรับ register: เดาว่าต้องมี username + password ขั้นต่ำ (ถ้ามีอีเมลเดี๋ยวค่อยเพิ่มภายหลัง)
        : { username: id, password: password.trim() };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(USE_COOKIES ? { credentials: 'include' } : {}),
        body: JSON.stringify(compact(payload)),
      });

      if (!res.ok) {
        let msg = '';
        try {
          const j = await res.json();
          msg = j?.error || j?.message || '';
        } catch {
          msg = await res.text();
        }
        // เฉพาะ 400 ของคุณ: “กรุณากรอกชื่อผู้ใช้และรหัสผ่าน”
        const finalMsg = `${msg || res.statusText} (${res.status})`;
        setError(finalMsg);
        setNotification?.({ type: 'error', message: finalMsg });
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (isLoginView) {
        if (data?.user && (data?.token || USE_COOKIES)) {
          onAuthSuccess?.(data.user, data.token ?? null);
          setNotification?.({
            type: 'success',
            message: `ยินดีต้อนรับ ${data.user?.displayName || data.user?.username || ''}`,
          });
        } else {
          const m = 'รูปแบบผลลัพธ์จากเซิร์ฟเวอร์ไม่ถูกต้อง';
          setError(m);
          setNotification?.({ type: 'error', message: m });
        }
      } else {
        setNotification?.({ type: 'success', message: data?.message || 'สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ' });
        setIsLoginView(true);
      }
    } catch (err) {
      const m = `เครือข่ายล้มเหลว: ${err.message}`;
      console.error('Login/Register Error:', err);
      setError(m);
      setNotification?.({ type: 'error', message: m });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    setNotification?.({ type: 'error', message: `การลงชื่อเข้าใช้ด้วย ${provider} ยังไม่เปิดใช้งาน` });
    // window.location.href = `${API_BASE_URL}/auth/${provider}` // ถ้า backend รองรับ
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        {/* Left */}
        <div className="hidden md:block md:w-1/2">
          <img
            src="https://images.unsplash.com/photo-1528543606781-2f6e6857f318?q=80&w=1965&auto=format&fit=crop"
            alt="Scenic travel destination"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
              {isLoginView ? 'ยินดีต้อนรับกลับ' : 'สร้างบัญชีใหม่'}
            </h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {isLoginView ? 'เข้าสู่ระบบเพื่อจัดการการเดินทางของคุณ' : 'เข้าร่วมชุมชนนักเดินทางของเรา'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="username-login" className="sr-only">ชื่อผู้ใช้หรืออีเมล</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20}/>
                <input
                  id="username-login"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ชื่อผู้ใช้ หรือ อีเมล (ระบบจะส่งเป็น username)"
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password-login" className="sr-only">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20}/>
                <input
                  id="password-login"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  required
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoComplete={isLoginView ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-blue-500/50"
            >
              <LogIn className="mr-2" />
              {loading ? 'กำลังดำเนินการ...' : (isLoginView ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก')}
            </button>
          </form>

          <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            <span className="mx-4 text-gray-400 dark:text-gray-500 text-sm">หรือ</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
          </div>

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

          <p className="mt-8 text-sm text-center text-gray-600 dark:text-gray-400">
            {isLoginView ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'}
            <button onClick={() => setIsLoginView(!isLoginView)} className="ml-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              {isLoginView ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
