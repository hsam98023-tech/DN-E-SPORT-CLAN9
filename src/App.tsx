import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { ref as dbRef, push, onValue, serverTimestamp, query, limitToLast, remove, set } from 'firebase/database';
import { Camera, CameraResultType } from '@capacitor/camera';
import { LogOut, Settings, Users, Image as ImageIcon, Send, Eye, EyeOff, ArrowRight, Trash2, Reply, X, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Message {
  id: string; text: string; uid: string; displayName: string; photoURL: string; createdAt: number; imageUrl?: string; role?: string;
  replyTo?: { text: string; sender: string; };
}

// --- Main App ---
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState('Member');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'chat' | 'settings' | 'group'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onValue(dbRef(db, `users/${currentUser.uid}/role`), (snap) => {
          if (snap.exists()) setUserRole(snap.val());
          setLoading(false); // كيدخلك واخا تعطلات الداتابيز
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a] text-indigo-500 text-2xl font-black italic animate-pulse">DN CLAN...</div>;
  if (!user) return <AuthView />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden" dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} onNavigate={setCurrentView} />}
      {currentView === 'settings' && <SettingsView user={user} onNavigate={setCurrentView} />}
      {currentView === 'group' && <GroupView onNavigate={setCurrentView} />}
    </div>
  );
}

// --- Auth View (Login/Register) ---
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

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
        await set(dbRef(db, `users/${res.user.uid}`), { role: 'Member', name: name });
      }
    } catch (err: any) { setError("تأكد من المعلومات المحفوظة"); }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="w-full max-w-sm space-y-8 text-center">
        <h1 className="text-6xl font-black text-indigo-500 italic">DN<span className="text-white">CLAN</span></h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && <input type="text" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none border border-white/5" required />}
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none border border-white/5" required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none border border-white/5" required />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-indigo-600 p-4 rounded-xl font-bold text-lg">{isLogin ? 'دخول' : 'إنشاء حساب'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 text-sm">{isLogin ? 'حساب جديد؟' : 'عندك حساب؟'}</button>
      </div>
    </div>
  );
}

// --- Chat View (The Main Hub) ---
function ChatView({ user, userRole, onNavigate }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onValue(query(dbRef(db, 'messages'), limitToLast(50)), (snap) => {
      const data = snap.val();
      if (data) setMessages(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    const msgData = {
      text, uid: user.uid, displayName: user.displayName, photoURL: user.photoURL,
      role: userRole, createdAt: serverTimestamp(),
      replyTo: reply ? { text: reply.text, sender: reply.displayName } : null
    };
    await push(dbRef(db, 'messages'), msgData);
    setText(''); setReply(null);
  };

  const uploadImg = async () => {
    const img = await Camera.getPhoto({ quality: 40, resultType: CameraResultType.Base64 });
    if (img.base64String) {
      await push(dbRef(db, 'messages'), {
        text: '', imageUrl: `data:image/jpeg;base64,${img.base64String}`,
        uid: user.uid, displayName: user.displayName, photoURL: user.photoURL,
        role: userRole, createdAt: serverTimestamp()
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="h-16 bg-[#111] border-b border-white/5 flex items-center justify-between px-5">
        <Users className="text-gray-400" onClick={() => onNavigate('group')} />
        <span className="font-black text-xl italic text-indigo-500">DN CLAN</span>
        <Settings className="text-gray-400" onClick={() => onNavigate('settings')} />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.uid === user.uid ? "items-end" : "items-start")}>
            <div className={cn("flex gap-2 max-w-[85%]", m.uid === user.uid ? "flex-row-reverse" : "flex-row")}>
              <img src={m.photoURL} className="w-9 h-9 rounded-full border border-indigo-500/30" alt="" />
              <div className={cn("p-3 rounded-2xl text-sm group relative", m.uid === user.uid ? "bg-indigo-600 rounded-tr-none" : "bg-[#1a1a1a] rounded-tl-none")}>
                <p className="text-[10px] font-bold mb-1 opacity-70">{m.displayName} • {m.role}</p>
                {m.replyTo && <div className="bg-black/20 p-2 rounded-lg mb-2 text-[11px] border-r-2 border-white/40 italic">{m.replyTo.sender}: {m.replyTo.text}</div>}
                {m.imageUrl && <img src={m.imageUrl} className="rounded-lg mb-2 max-w-full" />}
                {m.text && <p className="leading-relaxed">{m.text}</p>}
                <div className="flex items-center justify-between mt-1 gap-4">
                  <span className="text-[9px] opacity-40">{m.createdAt ? format(new Date(m.createdAt), 'HH:mm') : ''}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Reply size={14} className="text-white/60" onClick={() => setReply(m)} />
                    {(userRole === 'Admin' || m.uid === user.uid) && <Trash2 size={14} className="text-red-400" onClick={() => remove(dbRef(db, `messages/${m.id}`))} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </main>

      <footer className="p-4 bg-[#0a0a0a]">
        {reply && <div className="bg-indigo-500/10 p-2 mb-2 rounded-lg text-xs flex justify-between">الرد على {reply.displayName} <X size={14} onClick={() => setReply(null)}/></div>}
        <form onSubmit={sendMsg} className="flex items-center bg-[#161616] rounded-2xl px-4 border border-white/5 shadow-2xl">
          <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-transparent py-4 outline-none text-sm" placeholder="رسالة..." />
          <ImageIcon className="text-gray-400 mx-2" onClick={uploadImg} />
          <button type="submit" className="text-indigo-500"><Send size={24} /></button>
        </form>
      </footer>
    </div>
  );
}

// --- Settings View ---
function SettingsView({ user, onNavigate }: any) {
  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-4"><ArrowRight onClick={() => onNavigate('chat')} /> <h2 className="text-2xl font-black">الإعدادات</h2></div>
      <div className="flex flex-col items-center gap-4 py-8 bg-[#111] rounded-3xl border border-white/5">
        <img src={user.photoURL} className="w-28 h-28 rounded-full border-4 border-indigo-500 shadow-xl" />
        <div className="text-center">
          <p className="text-2xl font-bold">{user.displayName}</p>
          <p className="text-indigo-400 font-mono text-sm tracking-widest">{user.email}</p>
        </div>
      </div>
      <button onClick={() => auth.signOut()} className="w-full bg-red-500/10 text-red-500 p-5 rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-transform"><LogOut size={24} /> تسجيل الخروج</button>
    </div>
  );
}

// --- Group View ---
function GroupView({ onNavigate }: any) {
  return (
    <div className="p-6 h-full flex flex-col">
      <ArrowRight onClick={() => onNavigate('chat')} className="mb-10" />
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-32 h-32 bg-indigo-500/20 rounded-full flex items-center justify-center shadow-2xl border border-indigo-500/20"><Users size={64} className="text-indigo-500" /></div>
        <h2 className="text-4xl font-black italic">DN E-SPORTS</h2>
        <p className="text-gray-500 max-w-xs leading-loose">قريباً: لائحة الأعضاء، الرتب، التحديات، وإحصائيات الكلان مباشرة في التطبيق.</p>
        <div className="flex gap-4">
          <div className="bg-[#111] px-6 py-3 rounded-2xl border border-white/5"><p className="text-indigo-500 font-bold">50+</p><p className="text-[10px] text-gray-400">عضو</p></div>
          <div className="bg-[#111] px-6 py-3 rounded-2xl border border-white/5"><p className="text-indigo-500 font-bold">lvl 10</p><p className="text-[10px] text-gray-400">المستوى</p></div>
        </div>
      </div>
    </div>
  );
}
