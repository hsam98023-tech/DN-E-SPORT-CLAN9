import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { ref as dbRef, push, onValue, serverTimestamp, query, limitToLast, remove, set, update } from 'firebase/database';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Settings, Users, Image as ImageIcon, Send, ArrowRight, Trash2, Reply, X, User as UserIcon, LogOut, Camera as CameraIcon } from 'lucide-react';
import { format } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string; text: string; uid: string; displayName: string; photoURL: string; createdAt: number; imageUrl?: string; role?: string;
  replyTo?: { text: string; sender: string; };
}

interface ClanStats { members: number; level: number; points: number; }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState('Member');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'chat' | 'group' | 'personal'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onValue(dbRef(db, `users/${currentUser.uid}`), (snap) => {
          if (snap.exists()) setUserRole(snap.val().role || 'Member');
          setLoading(false);
        });
      } else { setLoading(false); }
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a] text-indigo-500 font-black italic animate-pulse">DN CLAN...</div>;
  if (!user) return <AuthView />;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f0c13] text-white font-sans" dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} onNavigate={setCurrentView} />}
      {currentView === 'personal' && <PersonalSettingsView user={user} onNavigate={setCurrentView} />}
      {currentView === 'group' && <GroupView onNavigate={setCurrentView} userRole={userRole} />}
    </div>
  );
}
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
      else {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(res.user, { 
          displayName: name, 
          photoURL: `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff` 
        });
        await set(dbRef(db, `users/${res.user.uid}`), { role: 'Member', name: name });
      }
    } catch (err) { alert("تأكد من البريد وكلمة المرور"); }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
      <div className="w-full max-w-sm space-y-8 text-center animate-in fade-in zoom-in duration-500">
        <h1 className="text-7xl font-black text-indigo-500 italic tracking-tighter">DN<span className="text-white">CLAN</span></h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && <input type="text" placeholder="الاسم الكامل" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-2xl outline-none text-white border border-white/5 focus:border-indigo-500 transition-all" required />}
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-2xl outline-none text-white border border-white/5 focus:border-indigo-500 transition-all" required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#1a1a1a] p-4 rounded-2xl outline-none text-white border border-white/5 focus:border-indigo-500 transition-all" required />
          <button type="submit" className="w-full bg-indigo-600 p-4 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">{isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 font-medium">{isLogin ? 'ليس لديك حساب؟ سجل الآن' : 'لديك حساب؟ ادخل من هنا'}</button>
      </div>
    </div>
  );
}
function ChatView({ user, userRole, onNavigate }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(dbRef(db, 'messages'), limitToLast(50));
    return onValue(q, (snap) => {
      const data = snap.val();
      if (data) setMessages(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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

  return (
    <div className="flex flex-col h-full relative">
      <header className="h-20 flex items-center justify-between px-6 backdrop-blur-xl bg-black/40 border-b border-white/5 z-50">
        <button onClick={() => onNavigate('personal')} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5">
          <UserIcon size={22} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xl font-black italic tracking-tighter text-indigo-500">DN CLAN</span>
          <span className="text-[9px] text-white/30 uppercase tracking-[0.2em]">Global Chat</span>
        </div>
        <button onClick={() => onNavigate('group')} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all border border-white/5">
          <Settings size={22} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col animate-in slide-in-from-bottom-2", m.uid === user.uid ? "items-end" : "items-start")}>
            <div className={cn("flex gap-3 max-w-[85%]", m.uid === user.uid ? "flex-row-reverse" : "flex-row")}>
              <img src={m.photoURL} className="w-10 h-10 rounded-full border-2 border-indigo-500/20 shadow-xl" alt="" />
              <div className="group relative">
                <div className={cn("p-4 rounded-[22px] shadow-2xl", m.uid === user.uid ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white/10 border border-white/5 rounded-tl-none backdrop-blur-sm")}>
                  <p className="text-[10px] font-bold mb-1 opacity-50 uppercase tracking-wider">{m.displayName} • {m.role}</p>
                  {m.replyTo && <div className="bg-black/30 p-2 rounded-xl mb-3 text-[11px] border-r-4 border-indigo-400 text-white/70 italic">@{m.replyTo.sender}: {m.replyTo.text}</div>}
                  {m.imageUrl && <img src={m.imageUrl} className="rounded-xl mb-2 max-h-72 w-full object-cover shadow-inner" />}
                  {m.text && <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                </div>
                <div className="flex gap-4 mt-1.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => setReply(m)} className="text-[10px] font-bold flex items-center gap-1 text-white/40 hover:text-indigo-400 transition-colors"><Reply size={12}/> رد</button>
                   {(userRole === 'Admin' || m.uid === user.uid) && (
                     <button onClick={() => remove(dbRef(db, `messages/${m.id}`))} className="text-[10px] font-bold flex items-center gap-1 text-white/40 hover:text-red-500 transition-colors"><Trash2 size={12}/> حذف</button>
                   )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </main>

      <footer className="p-4 pb-10 backdrop-blur-md">
        {reply && <div className="bg-indigo-600/20 p-3 mb-2 rounded-2xl text-xs flex justify-between items-center border border-indigo-500/20 animate-in slide-in-from-bottom-4"><span>الرد على <b className="text-indigo-400">@{reply.displayName}</b></span><X size={18} className="p-1 bg-white/10 rounded-full cursor-pointer" onClick={() => setReply(null)}/></div>}
        <div className="bg-white/5 rounded-[30px] p-2 flex items-center border border-white/10 shadow-inner">
          <button onClick={uploadImg} className="p-3 text-white/40 hover:text-white transition-colors"><ImageIcon size={24} /></button>
          <form onSubmit={sendMsg} className="flex-1 flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-transparent py-3 outline-none text-sm px-2 text-white placeholder:text-white/20" placeholder="اكتب رسالتك هنا..." />
            <button type="submit" className="p-3 bg-white rounded-full text-black shadow-xl hover:scale-110 active:scale-90 transition-all"><Send size={22} /></button>
          </form>
        </div>
      </footer>
    </div>
  );
}
function PersonalSettingsView({ user, onNavigate }: any) {
  const [name, setName] = useState(user.displayName || '');
  
  const save = async () => {
    await updateProfile(user, { displayName: name });
    await update(dbRef(db, `users/${user.uid}`), { name: name });
    alert("تم الحفظ بنجاح");
    onNavigate('chat');
  };

  const updateAvatar = async () => {
    const img = await Camera.getPhoto({ quality: 50, resultType: CameraResultType.Base64 });
    if (img.base64String) {
      const url = `data:image/jpeg;base64,${img.base64String}`;
      await updateProfile(user, { photoURL: url });
      await update(dbRef(db, `users/${user.uid}`), { photoURL: url });
    }
  };

  return (
    <div className="p-8 space-y-8 flex flex-col h-full bg-[#0a0a0a]">
      <header className="flex items-center gap-4">
        <button onClick={() => onNavigate('chat')} className="p-2 bg-white/5 rounded-full border border-white/5"><ArrowRight size={22}/></button>
        <h2 className="text-2xl font-black italic uppercase tracking-widest">Profile</h2>
      </header>
      <div className="flex flex-col items-center gap-8 pt-12">
        <div className="relative group cursor-pointer" onClick={updateAvatar}>
          <img src={user.photoURL} className="w-36 h-36 rounded-full border-4 border-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.3)] group-hover:opacity-70 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><CameraIcon size={30}/></div>
        </div>
        <div className="w-full space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-white/30 uppercase font-bold px-2 tracking-widest">Username</label>
            <input value={name} onChange={e => setName(e.target.value)} className="bg-white/5 p-4 rounded-2xl w-full text-center border border-white/5 outline-none focus:border-indigo-500/50 transition-all font-bold" />
          </div>
          <button onClick={save} className="bg-indigo-600 w-full p-4 rounded-2xl font-black italic shadow-lg shadow-indigo-600/20">SAVE CHANGES</button>
        </div>
      </div>
      <div className="flex-1"></div>
      <button onClick={() => auth.signOut()} className="w-full text-red-500 p-4 font-bold border border-red-500/10 rounded-2xl bg-red-500/5 flex items-center justify-center gap-2"><LogOut size={20}/> LOGOUT</button>
    </div>
  );
}

function GroupView({ onNavigate, userRole }: any) {
  const stats: ClanStats = { members: 12, level: 45, points: 2850 };

  return (
    <div className="p-8 h-full flex flex-col bg-[#0f0c13]">
      <header className="flex items-center gap-4 mb-12">
        <button onClick={() => onNavigate('chat')} className="p-2 bg-white/5 rounded-full border border-white/5"><ArrowRight size={22}/></button>
        <h2 className="text-2xl font-black italic uppercase tracking-widest">Clan Info</h2>
      </header>
      <div className="flex-1 space-y-8">
        <div className="p-10 bg-indigo-600/10 rounded-[40px] border border-indigo-500/20 shadow-2xl flex flex-col items-center">
          <div className="w-24 h-24 bg-indigo-600 rounded-[30px] flex items-center justify-center shadow-lg mb-6 rotate-3">
             <Users size={45} className="text-white -rotate-3" />
          </div>
          <h3 className="text-3xl font-black italic mb-2">DN E-SPORTS</h3>
          <p className="text-indigo-400 text-sm font-bold tracking-widest uppercase">Elite Gaming Community</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Members', val: stats.members },
            { label: 'Level', val: stats.level },
            { label: 'Points', val: stats.points }
          ].map((s, i) => (
            <div key={i} className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
              <p className="text-[9px] text-white/30 uppercase font-bold mb-1">{s.label}</p>
              <p className="text-lg font-black italic text-indigo-400">{s.val}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/5 p-6 rounded-[30px] border border-white/5">
           <h4 className="text-xs font-black uppercase text-white/40 mb-4">Clan Rules</h4>
           <ul className="text-xs space-y-3 text-white/60 italic">
              <li>• Respect all clan members.</li>
              <li>• No spamming in global chat.</li>
              <li>• Be active in weekly tournaments.</li>
           </ul>
        </div>
      </div>
    </div>
  );
}
