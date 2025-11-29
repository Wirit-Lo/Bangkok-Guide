import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';

// ใช้แบบ CDN เพื่อความชัวร์ใน Environment นี้
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://fsbfiefjtyejfzgisjco.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JD-RR-99MGcWZ768Gewbeg_8NclU-Tx';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 🔧 URL ของ Server Backend ---
const BACKEND_URL = 'http://localhost:5000'; 

const LoginPage = ({ onAuthSuccess, setNotification }) => {
  // ⚡ OPTIMIZATION: เช็ค URL ทันทีที่โหลด Component เพื่อตั้งค่า Loading State ตั้งแต่เริ่ม
  const isRedirecting = window.location.hash.includes('access_token') || 
                        window.location.search.includes('code=');

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // ✅ เริ่มต้น loading ตามสถานะ URL ทันที
  const [loading, setLoading] = useState(isRedirecting);
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState(isRedirecting ? 'กำลังยืนยันตัวตน...' : '');
  
  // Ref ป้องกันการทำงานซ้ำ
  const processingRef = useRef(false);

  // --- ฟังก์ชันช่วยจัดการเมื่อ Login สำเร็จ ---
  const finalizeLogin = (user, token) => {
    setStatusMessage("เข้าสู่ระบบสำเร็จ!");
    
    // 1. บันทึก Token ปัจจุบัน
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));

    // 2. ⭐ บันทึกลงรายการสลับบัญชี (saved_users) ⭐
    try {
        const savedUsersStr = localStorage.getItem('saved_users');
        let savedUsers = savedUsersStr ? JSON.parse(savedUsersStr) : [];
        
        savedUsers = savedUsers.filter(u => u.id !== user.id && u.username !== user.username);
        
        const userToSave = { 
            ...user, 
            token, 
            lastLogin: new Date().toISOString() 
        }; 
        savedUsers.unshift(userToSave);
        
        if (savedUsers.length > 5) savedUsers.pop();
        localStorage.setItem('saved_users', JSON.stringify(savedUsers));
    } catch (e) {
        console.error("Error saving to account list:", e);
    }

    // 3. เปลี่ยนหน้าทันที!
    if (onAuthSuccess) {
        onAuthSuccess(user, token);
    } else {
        window.location.href = '/dashboard';
    }
  };

  // --- 1. Logic Social Login ---
  const handleSocialLogin = async (provider) => {
    if (processingRef.current) return;
    setLoading(true);
    setStatusMessage(`กำลังไปที่ ${provider}...`);
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: provider.toLowerCase(),
            options: { 
                redirectTo: window.location.origin,
                skipBrowserRedirect: false,
                queryParams: {
                    prompt: 'select_account',
                    access_type: 'offline'
                }
            }
        });
        if (error) throw error;
    } catch (err) {
        console.error("Social Login Error:", err);
        alert(`เกิดข้อผิดพลาด: ${err.message}`);
        setLoading(false);
        setStatusMessage('');
    }
  };

  // --- 2. Logic ส่งข้อมูลไป Backend (แบบ Fire & Forget) ---
  const syncWithBackend = async (session) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
        // 🚀 FAST TRACK: ไม่รอ Backend ตอบกลับ
        // สร้าง User Object จากข้อมูล Supabase โดยตรงเลย
        const socialUser = {
            id: session.user.id,
            email: session.user.email,
            username: session.user.user_metadata.full_name || session.user.user_metadata.name || session.user.email.split('@')[0],
            photoUrl: session.user.user_metadata.avatar_url,
            provider: session.user.app_metadata.provider || 'social'
        };

        // เตรียม Payload ส่งหลังบ้าน
        const userPayload = {
            email: socialUser.email,
            displayName: socialUser.username,
            photoUrl: socialUser.photoUrl,
            provider: socialUser.provider
        };
        
        // ⚡ ส่งข้อมูลไป Backend แบบ Background Process (ไม่ใส่ await)
        // ใช้ keepalive: true เพื่อให้ request ทำงานต่อแม้หน้าเว็บจะถูก redirect ไปแล้ว
        fetch(`${BACKEND_URL}/api/auth/social-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userPayload),
            keepalive: true 
        }).catch(err => console.error("Background Sync Error:", err));

        // ✅ เข้าสู่ระบบทันทีโดยใช้ Token จาก Supabase
        finalizeLogin(socialUser, session.access_token);

    } catch (err) {
        console.error("Critical Error:", err);
        // ถ้า Supabase พังจริงๆ ถึงค่อย Logout
        processingRef.current = false;
        await supabase.auth.signOut();
        setLoading(false);
        setStatusMessage('');
        window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // --- 3. ตรวจสอบสถานะการ Login (Fast Track) ---
  useEffect(() => {
    if (!isRedirecting) {
        const clearOldSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
                // Clear session เพื่อความสะอาด แต่ไม่ต้อง await นาน
                supabase.auth.signOut();
                localStorage.removeItem('token');
            }
        };
        clearOldSession();
        return;
    }

    // กรณีมี Redirect Code: รอจับ Session แล้ว Sync ทันที
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            syncWithBackend(session);
        }
    });

    return () => authListener.subscription.unsubscribe();
  }, [isRedirecting]);

  // --- 4. Logic Login ปกติ (Manual) ---
  const handleManualLogin = async () => {
    if (!username || !password) {
        alert("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
        return;
    }

    setLoading(true);
    setStatusMessage("กำลังตรวจสอบ...");
    const endpoint = isRegisterMode ? '/api/register' : '/api/login';
    
    try {
        const response = await fetch(`${BACKEND_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Server Error');

        if (!isRegisterMode) {
            finalizeLogin(data.user, data.token);
        } else {
            alert('สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ');
            setIsRegisterMode(false);
            setLoading(false);
            setStatusMessage('');
        }

    } catch (err) {
        alert(err.message);
        setLoading(false);
        setStatusMessage('');
    }
  };

  // --- ⚡ Render Loading State ---
  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] bg-gray-50 dark:bg-gray-900">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl flex flex-col items-center max-w-sm w-full animate-fade-in">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                    <div className="relative bg-white dark:bg-gray-700 rounded-full p-4">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    {statusMessage}
                </h3>
                <p className="text-gray-500 text-sm text-center">
                    กำลังเชื่อมต่อกับระบบ...
                </p>
            </div>
        </div>
    );
  }

  // --- Components ---
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

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4 relative">
      <div className="w-full max-w-4xl flex flex-col md:flex-row bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Image Section */}
        <div className="hidden md:block md:w-1/2">
          <img
            src="https://images.unsplash.com/photo-1528543606781-2f6e6857f318?q=80&w=1965&auto=format&fit=crop"
            alt="Travel background"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Form Section */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center relative">
          
          <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                  {isRegisterMode ? 'สร้างบัญชีใหม่' : 'ยินดีต้อนรับกลับ'}
              </h2>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {isRegisterMode ? 'กรอกรายละเอียดเพื่อสมัครสมาชิก' : 'เข้าสู่ระบบเพื่อจัดการการเดินทางของคุณ'}
              </p>
          </div>

          <div className="mt-6 space-y-6">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="w-full pl-12 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button
              onClick={handleManualLogin}
              disabled={loading}
              className="w-full flex justify-center items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg cursor-pointer active:scale-95"
            >
              {loading && <Loader2 className="animate-spin mr-2" size={20} />}
              {isRegisterMode ? <UserPlus size={20} className={loading ? "hidden" : "mr-2"} /> : <LogIn size={20} className={loading ? "hidden" : "mr-2"} />}
              {isRegisterMode ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
            </button>
          </div>

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
              <span className="font-semibold text-white">ดำเนินการต่อด้วย Facebook</span>
            </button>
          </div>

          <p className="mt-8 text-sm text-center text-gray-600 dark:text-gray-400">
            <button type="button" onClick={() => setIsRegisterMode(!isRegisterMode)} className="ml-1 font-semibold text-blue-600 hover:underline">
              {isRegisterMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;