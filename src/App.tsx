import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; // قمنا بإزالة storage
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
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'; // إضافة Capacitor Camera
import { 
  Smile, 
  Send, 
  Image as ImageIcon,
  MoreVertical,
  ArrowRight,
  Trash2,
  Reply,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- مساعد التنسيق ---
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- الأنواع ---
interface Message {
  id: string;
  text: string;
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  imageUrl?: string; // سنستخدم هذا لتخزين Base64
  role?: string;
  replyTo?: {
    text: string;
    sender: string;
  };
}

// --- المكون الرئيسي ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('Member');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const roleRef = dbRef(db, `users/${currentUser.uid}/role`);
        onValue(roleRef, (snapshot) => {
          setUserRole(snapshot.exists() ? snapshot.val() : 'Member');
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0a0a0a]"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div></div>;

  return user ? <ChatView user={user} userRole={userRole} /> : <AuthView />;
}

// --- عرض الدردشة (النسخة المعدلة لإرسال الصور) ---
function ChatView({ user, userRole }: { user: User; userRole: string }) {
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

  // دالة إرسال الصورة كـ Base64 (مجانية وغير محدودة)
  const handlePickImage = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 60, // جودة متوسطة لتوفير المساحة
        allowEditing: false,
        resultType: CameraResultType.Base64, // تحويل الصورة لنص
        source: CameraSource.Photos // فتح المعرض
      });

      if (image.base64String) {
        const base64Data = `data:image/jpeg;base64,${image.base64String}`;
        
        await push(dbRef(db, 'messages'), {
          text: '',
          imageUrl: base64Data, // تخزين الصورة كـ String في قاعدة البيانات مباشرة
          uid: user.uid,
          displayName: user.displayName || 'مستخدم',
          photoURL: user.photoURL || '',
          role: userRole,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("فشل إرسال الصورة:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
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

    if (replyingTo) {
      payload.replyTo = { text: replyingTo.text || 'صورة', sender: replyingTo.displayName };
    }

    setNewMessage('');
    setReplyingTo(null);
    await push(dbRef(db, 'messages'), payload);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-white" dir="rtl">
      {/* Header */}
      <div className="h-16 bg-[#1a1a1a] flex items-center justify-between px-4 border-b border-white/5">
        <h1 className="text-2xl font-black text-indigo-500">DN CLAN</h1>
        <button onClick={() => auth.signOut()} className="text-gray-400 hover:text-white"><ArrowRight /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={msg.id} className={cn("flex flex-col", msg.uid === user.uid ? "items-start" : "items-end")}>
             <div className={cn("max-w-[85%] p-3 rounded-2xl", msg.uid === user.uid ? "bg-indigo-600 rounded-br-none" : "bg-[#2a2a2a] rounded-bl-none")}>
                {msg.replyTo && <div className="text-[10px] opacity-50 border-r-2 pr-2 mb-1">{msg.replyTo.sender}: {msg.replyTo.text}</div>}
                {msg.imageUrl && <img src={msg.imageUrl} alt="chat" className="rounded-lg mb-1 max-h-60" />}
                {msg.text && <p className="text-sm">{msg.text}</p>}
                <span className="text-[9px] opacity-40 block mt-1">
                   {msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm') : ''}
                </span>
             </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-[#1a1a1a]">
        {replyingTo && <div className="bg-gray-800 p-2 rounded mb-2 flex justify-between text-xs"><span>رد على: {replyingTo.displayName}</span><X size={14} onClick={()=>setReplyingTo(null)}/></div>}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-[#2a2a2a] rounded-full px-4 py-2">
          <button type="button" onClick={handlePickImage} className="text-gray-400 hover:text-indigo-500">
            <ImageIcon size={24} />
          </button>
          <input 
            className="flex-1 bg-transparent outline-none text-sm h-10" 
            placeholder="اكتب شيئاً..." 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="text-indigo-500"><Send size={24} /></button>
        </form>
      </div>
    </div>
  );
}

// --- Auth View (نفس الكود الخاص بك مع تبسيط) ---
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
        await updateProfile(res.user, { displayName: name });
        await set(dbRef(db, `users/${res.user.uid}/role`), 'Member');
      }
    } catch (err) { alert("خطأ في المصادقة"); }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0a0a0a] p-6 text-white" dir="rtl">
      <h1 className="text-5xl font-black text-indigo-500 mb-8 italic">DN CLAN</h1>
      <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
        {!isLogin && <input className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none border border-white/5" placeholder="الاسم" onChange={e=>setName(e.target.value)} />}
        <input className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none border border-white/5" placeholder="الايميل" onChange={e=>setEmail(e.target.value)} />
        <input type="password" className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none border border-white/5" placeholder="كلمة المرور" onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-indigo-600 p-4 rounded-xl font-bold mt-4">{isLogin ? 'دخول' : 'تسجيل'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-6 text-gray-500 text-sm">{isLogin ? 'إنشاء حساب جديد' : 'لديك حساب؟ دخول'}</button>
    </div>
  );
}
