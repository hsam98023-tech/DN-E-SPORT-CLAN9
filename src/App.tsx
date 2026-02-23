import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { ref as dbRef, push, onValue, serverTimestamp, query, orderByChild, limitToLast, remove, set } from 'firebase/database';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { LogOut, Settings, Users, Image as ImageIcon, Smile, Send, Eye, EyeOff, MoreVertical, ArrowRight, Trash2, Reply, X, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string; text: string; uid: string; displayName: string; photoURL: string; createdAt: number; imageUrl?: string; role?: string;
  replyTo?: { text: string; sender: string; };
}

type Theme = 'dark' | 'light' | 'gold';
interface ThemeContextType { theme: Theme; setTheme: (theme: Theme) => void; }
const ThemeContext = React.createContext<ThemeContextType>({ theme: 'dark', setTheme: () => {}, });
export const useTheme = () => React.useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('app-theme') as Theme) || 'dark');
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    if (theme === 'dark') { document.documentElement.removeAttribute('data-theme'); } 
    else { document.documentElement.setAttribute('data-theme', theme); }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export default function App() { return <ThemeProvider><MainApp /></ThemeProvider>; }

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('Member');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'chat' | 'settings' | 'group'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onValue(dbRef(db, `users/${currentUser.uid}/role`), (snapshot) => {
          setUserRole(snapshot.exists() ? snapshot.val() : 'Member');
          setLoading(false);
        });
      } else { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#0f0f0f] text-indigo-500"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div></div>;
  if (!user) return <AuthView />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f0f] text-white overflow-hidden" dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} onNavigate={setCurrentView} />}
      {currentView === 'settings' && <SettingsView user={user} onNavigate={setCurrentView} />}
      {currentView === 'group' && <GroupView onNavigate={setCurrentView} />}
    </div>
  );
}

function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
      else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: displayName || 'User', photoURL: `https://ui-avatars.com/api/?name=${displayName}&background=5865F2&color=fff` });
        await set(dbRef(db, `users/${res.user.uid}/role`), 'Member');
      }
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0f0f0f] p-6 text-white" dir="rtl">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-6xl font-black text-indigo-500 text-center">DN<span className="text-white block text-4xl">CLAN</span></h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-[#1a1a1a] p-3 rounded-lg outline-none border border-white/10" placeholder="اسم العرض" required />}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#1a1a1a] p-3 rounded-lg outline-none border border-white/10" placeholder="البريد الإلكتروني" required />
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-[#1a1a1a] p-3 rounded-lg outline-none border border-white/10" placeholder="كلمة المرور" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-3 text-gray-400">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 p-3 rounded-lg font-bold">{isLogin ? 'دخول' : 'إنشاء حساب'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="w-full text-indigo-400 text-sm">{isLogin ? 'إنشاء حساب جديد' : 'لديك حساب؟ دخول'}</button>
      </div>
    </div>
  );
}
