import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  onAuthStateChanged, 
  User
} from 'firebase/auth';
import { 
  ref as dbRef, 
  push, 
  onValue, 
  serverTimestamp, 
  query, 
  orderByChild,
  limitToLast,
  remove,
  set
} from 'firebase/database';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { 
  LogOut, 
  Settings, 
  Users, 
  Image as ImageIcon, 
  Smile, 
  Send, 
  ArrowRight,
  Trash2,
  Reply,
  X,
  Eye,
  EyeOff,
  MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  imageUrl?: string;
  role?: string;
  replyTo?: {
    text: string;
    sender: string;
  };
}

// --- Component App ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('Member');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'chat' | 'settings' | 'group'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onValue(dbRef(db, `users/${currentUser.uid}/role`), (snap) => {
          setUserRole(snap.exists() ? snap.val() : 'Member');
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0a0a0a]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div></div>;

  if (!user) return <AuthView />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0f0f0f] text-white overflow-hidden" dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} onNavigate={setCurrentView} />}
      {currentView === 'settings' && <SettingsView user={user} onNavigate={setCurrentView} />}
      {currentView === 'group' && <GroupView onNavigate={setCurrentView} />}
    </div>
  );
}

// --- Chat View (النسخة الكاملة مع الأسماء والصور) ---
function ChatView({ user, userRole, onNavigate }: { user: User; userRole: string; onNavigate: (v: 'chat' | 'settings' | 'group') => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const msgQuery = query(dbRef(db, 'messages'), orderByChild('createdAt'), limitToLast(50));
    return onValue(msgQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a, b) => a.createdAt - b.createdAt);
        setMessages(list);
      }
    });
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handlePickImage = async () => {
    try {
      const image = await Camera.getPhoto({ quality: 50, resultType: CameraResultType.Base64, source: CameraSource.Photos });
      if (image.base64String) {
        await push(dbRef(db, 'messages'), {
          text: '',
          imageUrl: `data:image/jpeg;base64,${image.base64String}`,
          uid: user.uid,
          displayName: user.displayName || 'مستخدم', // دابا السمية غطلع
          photoURL: user.photoURL || '',
          role: userRole,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const payload: any = {
      text: newMessage,
      uid: user.uid,
      displayName: user.displayName || 'مستخدم',
      photoURL: user.photoURL || '',
      role: userRole,
      createdAt: serverTimestamp()
    };
    if (replyingTo) payload.replyTo = { text: replyingTo.text || 'صورة', sender: replyingTo.displayName };
    setNewMessage('');
    setReplyingTo(null);
    await push(dbRef(db, 'messages'), payload);
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header مع زر الإعدادات والكلان */}
      <div className="h-14 bg-[#1a1a1a] flex items-center justify-between px-4 border-b border-white/5 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('group')} className="text-gray-400 hover:text-white"><Users size={24} /></button>
          <h1 className="text-xl font-black text-indigo-500 italic">DN CLAN</h1>
        </div>
        <button onClick={() => onNavigate('settings')} className="text-gray-400 hover:text-white"><Settings size={24} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          const isMe = msg.uid === user.uid;
          return (
            <div key={msg.id} className={cn("flex w-full gap-2", isMe ? "justify-start" : "justify-end flex-row-reverse")}>
              <img src={msg.photoURL || `https://ui-avatars.com/api/?name=${msg.displayName}`} className="w-8 h-8 rounded-full mt-1" />
              <div className={cn("max-w-[80%]", isMe ? "items-start" : "items-end")}>
                <span className="text-[10px] text-gray-500 mb-1 block px-2">{msg.displayName} {msg.role === 'Admin' && '⭐'}</span>
                <div className={cn("p-3 rounded-2xl", isMe ? "bg-indigo-600 rounded-br-none" : "bg-[#222] rounded-bl-none shadow-xl")}>
                   {msg.imageUrl && <img src={msg.imageUrl} className="rounded-lg max-h-64 mb-2" />}
                   {msg.text && <p className="text-sm leading-relaxed">{msg.text}</p>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#141414]">
        <form onSubmit={handleSend} className="flex items-center gap-2 bg-[#252525] rounded-full px-4 py-1">
          <button type="button" onClick={handlePickImage} className="text-gray-400"><ImageIcon size={22} /></button>
          <input className="flex-1 bg-transparent h-10 outline-none text-sm" placeholder="اكتب رسالة..." value={newMessage} onChange={e=>setNewMessage(e.target.value)} />
          <button type="submit" className="text-indigo-500"><Send size={22} /></button>
        </form>
      </div>
    </div>
  );
}

// --- Views الأخرى (Settings & Group) لضمان عدم اختفائها ---
function SettingsView({ user, onNavigate }: { user: User, onNavigate: (v: 'chat') => void }) {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
       <div className="h-14 bg-[#1a1a1a] flex items-center px-4 gap-4">
          <button onClick={() => onNavigate('chat')}><ArrowRight /></button>
          <h1 className="font-bold">إعدادات الملف الشخصي</h1>
       </div>
       <div className="p-8 flex flex-col items-center gap-4">
          <img src={user.photoURL || ''} className="w-24 h-24 rounded-full border-2 border-indigo-500" />
          <h2 className="text-xl font-bold">{user.displayName}</h2>
          <button onClick={() => auth.signOut()} className="mt-10 bg-red-600 px-6 py-2 rounded-lg flex items-center gap-2"><LogOut size={18}/> تسجيل الخروج</button>
       </div>
    </div>
  );
}

function GroupView({ onNavigate }: { onNavigate: (v: 'chat') => void }) {
  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
       <div className="h-14 bg-[#1a1a1a] flex items-center px-4 gap-4">
          <button onClick={() => onNavigate('chat')}><ArrowRight /></button>
          <h1 className="font-bold">بروفيل الكلان</h1>
       </div>
       <div className="p-10 text-center text-gray-500">
          <Users size={60} className="mx-auto mb-4 opacity-20" />
          <p>هنا ستظهر معلومات الكلان والأعضاء قريباً.</p>
       </div>
    </div>
  );
}

// --- Auth View (نفس الكود السابق) ---
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { 
          displayName: name,
          photoURL: `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff`
        });
        await set(dbRef(db, `users/${res.user.uid}/role`), 'Member');
      }
    } catch (err) { alert("حدث خطأ في الدخول"); }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-6">
      <h1 className="text-6xl font-black text-indigo-500 mb-12 italic">DN</h1>
      <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
        {!isLogin && <input className="w-full bg-[#1a1a1a] p-4 rounded-xl border border-white/5 outline-none" placeholder="الاسم الشخصي" onChange={e=>setName(e.target.value)} />}
        <input className="w-full bg-[#1a1a1a] p-4 rounded-xl border border-white/5 outline-none" placeholder="البريد الإلكتروني" onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full bg-[#1a1a1a] p-4 rounded-xl border border-white/5 outline-none" placeholder="كلمة المرور" onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-indigo-600 p-4 rounded-xl font-bold text-lg mt-4">{isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-8 text-gray-500 underline">{isLogin ? 'ليس لديك حساب؟ أنشئ واحداً' : 'لديك حساب؟ ادخل من هنا'}</button>
    </div>
  );
}
