import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { ref as dbRef, push, onValue, serverTimestamp, query, limitToLast, remove, set, update } from 'firebase/database';
import { Camera, CameraResultType } from '@capacitor/camera';
import { LogOut, Settings, Users, Image as ImageIcon, Send, Eye, EyeOff, ArrowRight, Trash2, Reply, X, Palette, User as UserIcon, Bell } from 'lucide-react';
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

interface OnlineUser { uid: string; displayName: string; photoURL: string; lastSeen: number; }
type Theme = 'dark' | 'light' | 'gold';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState('Member');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'chat' | 'settings' | 'group' | 'personal'>('chat');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        set(dbRef(db, `online/${currentUser.uid}`), {
          uid: currentUser.uid, displayName: currentUser.displayName, photoURL: currentUser.photoURL, lastSeen: serverTimestamp()
        });
        onValue(dbRef(db, `users/${currentUser.uid}`), (snap) => {
          if (snap.exists()) {
            setUserRole(snap.val().role || 'Member');
            setTheme(snap.val().theme || 'dark');
          }
          setLoading(false);
        });
        const interval = setInterval(() => {
          update(dbRef(db, `online/${currentUser.uid}`), { lastSeen: serverTimestamp() });
        }, 30000);
        return () => { clearInterval(interval); remove(dbRef(db, `online/${currentUser.uid}`)); };
      } else { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a] text-indigo-500 text-2xl font-black italic animate-pulse">DN CLAN...</div>;
  if (!user) return <AuthView />;

  return (
    <div className={cn("h-screen w-screen flex flex-col overflow-hidden", theme === 'dark' ? "bg-[#0a0a0a] text-white" : theme === 'light' ? "bg-white text-gray-900" : "bg-amber-950 text-amber-50")} dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} theme={theme} onNavigate={setCurrentView} />}
      {currentView === 'settings' && <SettingsView user={user} onNavigate={setCurrentView} theme={theme} />}
      {currentView === 'group' && <GroupView onNavigate={setCurrentView} userRole={userRole} theme={theme} />}
      {currentView === 'personal' && <PersonalSettingsView user={user} theme={theme} onNavigate={setCurrentView} onThemeChange={setTheme} />}
    </div>
  );
}

function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
      else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { displayName: name, photoURL: `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff` });
        await set(dbRef(db, `users/${res.user.uid}`), { role: 'Member', name: name, theme: 'dark' });
      }
    } catch (err: any) { setError("تأكد من البيانات"); }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="w-full max-w-sm space-y-8 text-center">
        <h1 className="text-6xl font-black text-indigo-500 italic">DN<span className="text-white">CLAN</span></h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && <input type="text" placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none text-white border border-white/5" required />}
          <input type="email" placeholder="البريد" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none text-white border border-white/5" required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-xl outline-none text-white border border-white/5" required />
          <button type="submit" className="w-full bg-indigo-600 p-4 rounded-xl font-bold">{isLogin ? 'دخول' : 'إنشاء حساب'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 text-sm">{isLogin ? 'حساب جديد؟' : 'عندك حساب؟'}</button>
      </div>
    </div>
  );
}
function ChatView({ user, userRole, theme, onNavigate }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const [showOnline, setShowOnline] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onValue(query(dbRef(db, 'messages'), limitToLast(50)), (snap) => {
      const data = snap.val();
      if (data) setMessages(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    onValue(dbRef(db, 'online'), (snap) => {
      const data = snap.val();
      if (data) setOnlineUsers(Object.values(data) as OnlineUser[]);
    });
  }, []);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    await push(dbRef(db, 'messages'), {
      text, uid: user.uid, displayName: user.displayName, photoURL: user.photoURL,
      role: userRole, createdAt: serverTimestamp(),
      replyTo: reply ? { text: reply.text, sender: reply.displayName } : null
    });
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

  const renderText = (msg: string) => msg.split(' ').map((w, i) => w.startsWith('@') ? <span key={i} className="text-indigo-400 font-bold">{w} </span> : w + ' ');

  return (
    <div className="flex flex-col h-full relative">
      <header className={cn("h-16 border-b flex items-center justify-between px-5 backdrop-blur-xl sticky top-0 z-50", theme === 'dark' ? "bg-[#111]/80 border-white/5" : "bg-white/80 border-gray-200")}>
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('personal')} className="p-2 bg-white/5 rounded-full"><UserIcon size={20}/></button>
          <button onClick={() => setShowOnline(!showOnline)} className="p-2 bg-white/5 rounded-full relative"><Users size={20}/>{onlineUsers.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>}</button>
        </div>
        <span className="font-black text-xl italic text-indigo-500">DN CLAN</span>
        <button onClick={() => onNavigate('group')} className="p-2 bg-white/5 rounded-full"><Settings size={20}/></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.uid === user.uid ? "items-end" : "items-start")}>
            <div className={cn("flex gap-2 max-w-[85%]", m.uid === user.uid ? "flex-row-reverse" : "flex-row")}>
              <img src={m.photoURL} className="w-9 h-9 rounded-full border border-indigo-500/30" alt="" />
              <div className={cn("p-3 rounded-2xl text-sm group relative shadow-lg", m.uid === user.uid ? "bg-indigo-600 rounded-tr-none" : "bg-[#1a1a1a] rounded-tl-none")}>
                <p className="text-[10px] font-bold mb-1 opacity-60">{m.displayName} • {m.role}</p>
                {m.replyTo && <div className="bg-black/20 p-2 rounded-lg mb-2 text-[10px] border-r-2 border-white/40 italic">{m.replyTo.sender}: {m.replyTo.text}</div>}
                {m.imageUrl && <img src={m.imageUrl} className="rounded-lg mb-2" />}
                {m.text && <p>{renderText(m.text)}</p>}
                <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Reply size={12} onClick={() => setReply(m)} />
                   {(userRole === 'Admin' || m.uid === user.uid) && <Trash2 size={12} className="text-red-400" onClick={() => remove(dbRef(db, `messages/${m.id}`))} />}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </main>

      <footer className="p-4">
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

function PersonalSettingsView({ user, theme, onNavigate, onThemeChange }: any) {
  const [name, setName] = useState(user.displayName || '');
  const save = async () => {
    await updateProfile(user, { displayName: name });
    await update(dbRef(db, `users/${user.uid}`), { name: name });
    onNavigate('chat');
  };
  const updatePic = async () => {
    const img = await Camera.getPhoto({ quality: 50, resultType: CameraResultType.Base64 });
    if (img.base64String) {
      const url = `data:image/jpeg;base64,${img.base64String}`;
      await updateProfile(user, { photoURL: url });
      await update(dbRef(db, `users/${user.uid}`), { photoURL: url });
    }
  };

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center gap-4"><ArrowRight onClick={() => onNavigate('chat')} /><h2 className="text-xl font-bold">بروفيلي</h2></header>
      <div className="flex flex-col items-center gap-4">
        <img src={user.photoURL} className="w-24 h-24 rounded-full border-4 border-indigo-500" onClick={updatePic} />
        <input value={name} onChange={e => setName(e.target.value)} className="bg-[#1a1a1a] p-3 rounded-xl w-full text-center outline-none" />
        <button onClick={save} className="bg-indigo-600 w-full p-3 rounded-xl font-bold">حفظ</button>
      </div>
      <div className="bg-[#111] p-4 rounded-xl space-y-4">
        <p className="text-sm font-bold opacity-50">تغيير الثيم</p>
        <div className="flex gap-2">
          {['dark', 'light', 'gold'].map(t => <button key={t} onClick={() => { onThemeChange(t); update(dbRef(db, `users/${user.uid}`), { theme: t }); }} className="flex-1 bg-white/5 p-2 rounded-lg text-xs uppercase">{t}</button>)}
        </div>
      </div>
      <button onClick={() => auth.signOut()} className="w-full text-red-500 p-4 font-bold">تسجيل الخروج</button>
    </div>
  );
}

function GroupView({ onNavigate }: any) {
  return (
    <div className="p-6"><ArrowRight onClick={() => onNavigate('chat')} /><div className="text-center mt-20"><Users size={64} className="mx-auto text-indigo-500 mb-4"/><h2 className="text-3xl font-black">DN E-SPORTS</h2><p className="text-gray-500 mt-2">إعدادات الكلان قيد التطوير...</p></div></div>
  );
}

function SettingsView({ onNavigate }: any) { return <div className="p-6"><ArrowRight onClick={() => onNavigate('chat')} /></div>; }
            
