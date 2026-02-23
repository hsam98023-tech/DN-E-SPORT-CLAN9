import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { ref as dbRef, push, onValue, serverTimestamp, query, limitToLast, remove, set, update } from 'firebase/database';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Settings, Users, Image as ImageIcon, Send, ArrowRight, Trash2, Reply, X, User as UserIcon, LogOut, Info } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string; text: string; uid: string; displayName: string; photoURL: string; createdAt: number; imageUrl?: string; role?: string;
  replyTo?: { text: string; sender: string; };
}

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

  if (loading) return <div className="h-screen w-screen flex items-center justify-center bg-black text-indigo-500 font-black italic animate-pulse">DN CLAN...</div>;
  if (!user) return <AuthView />;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0a0a0a] text-white font-sans" dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} onNavigate={setCurrentView} />}
      {currentView === 'personal' && <PersonalSettingsView user={user} onNavigate={setCurrentView} />}
      {currentView === 'group' && <GroupView userRole={userRole} onNavigate={setCurrentView} user={user} />}
    </div>
  );
}
function ChatView({ user, userRole, onNavigate }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(dbRef(db, 'messages'), limitToLast(40));
    return onValue(q, (snap) => {
      const data = snap.val();
      if (data) setMessages(Object.keys(data).map(k => ({ id: k, ...data[k] })));
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, []);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    await push(dbRef(db, 'messages'), {
      text, uid: user.uid, displayName: user.displayName, photoURL: user.photoURL || '',
      role: userRole, createdAt: serverTimestamp()
    });
    setText('');
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]" onClick={() => setActiveMenu(null)}>
      <header className="h-20 flex items-center justify-between px-6 bg-black/40 border-b border-white/5 z-50">
        <button onClick={() => onNavigate('group')} className="p-3 bg-white/5 rounded-full"><Settings size={20}/></button>
        <span className="text-xl font-black italic text-indigo-500">DN CLAN</span>
        <button onClick={() => onNavigate('personal')} className="p-3 bg-white/5 rounded-full"><UserIcon size={20}/></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.uid === user.uid ? "items-end" : "items-start")}>
            <div className={cn("flex gap-3 max-w-[85%]", m.uid === user.uid ? "flex-row-reverse" : "flex-row")}>
              {/* حل الدوائر الكحلة */}
              <img 
                src={m.photoURL || `https://ui-avatars.com/api/?name=${m.displayName}&background=6366f1&color=fff`} 
                className="w-10 h-10 rounded-full object-cover border border-white/10" 
                onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${m.displayName}`)}
              />
              <div className="relative">
                <div 
                  onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id); }}
                  className={cn("p-3.5 rounded-[22px]", m.uid === user.uid ? "bg-indigo-600 rounded-tr-none" : "bg-[#161616] border border-white/5 rounded-tl-none")}
                >
                  <p className="text-[9px] font-bold opacity-40 mb-1 uppercase tracking-tighter">{m.displayName} • {m.role}</p>
                  <p className="text-[14px] leading-relaxed break-words">{m.text}</p>
                </div>
                {activeMenu === m.id && (userRole === 'Admin' || m.uid === user.uid) && (
                  <button onClick={() => remove(dbRef(db, `messages/${m.id}`))} className="absolute -top-8 left-0 bg-red-600 p-2 rounded-full"><Trash2 size={12}/></button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </main>

      <footer className="p-4 pb-10">
        <form onSubmit={sendMsg} className="bg-[#111] rounded-[30px] p-2 flex items-center border border-white/10">
          <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-transparent py-3 outline-none text-sm px-4 text-white text-right" placeholder="اكتب شيئاً..." />
          <button type="submit" className="p-3 bg-white rounded-full text-black"><Send size={20}/></button>
        </form>
      </footer>
    </div>
  );
}
function GroupView({ onNavigate, user }: any) {
  const [memberCount, setMemberCount] = useState(0);
  const [bio, setBio] = useState('لاعب في كلان DN');

  useEffect(() => {
    onValue(dbRef(db, 'users'), (snap) => { if (snap.exists()) setMemberCount(Object.keys(snap.val()).length); });
    onValue(dbRef(db, `users/${user.uid}`), (snap) => { if (snap.exists()) setBio(snap.val().bio || 'مرحباً في كلان DN'); });
  }, [user.uid]);

  return (
    <div className="p-8 h-full bg-[#0a0a0a] flex flex-col text-right">
      <header className="flex items-center gap-4 mb-10 text-white">
        <button onClick={() => onNavigate('chat')} className="p-2 bg-white/5 rounded-full"><ArrowRight size={22}/></button>
        <h2 className="text-2xl font-black italic uppercase">Clan Info</h2>
      </header>
      <div className="p-10 bg-indigo-600 rounded-[40px] text-center mb-6">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Users size={32}/></div>
        <h3 className="text-3xl font-black italic">DN E-SPORTS</h3>
      </div>
      <div className="bg-[#111] p-6 rounded-[30px] border border-white/5 mb-6">
        <div className="flex items-center justify-end gap-2 text-indigo-400 font-bold text-xs mb-2">ABOUT <Info size={14}/></div>
        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{bio}</p>
      </div>
      <div className="flex justify-center">
        <div className="bg-[#111] p-6 rounded-3xl border border-white/5 text-center px-10">
          <p className="text-[10px] text-white/30 font-bold mb-1">MEMBERS</p>
          <p className="text-3xl font-black italic text-indigo-500">{memberCount}</p>
        </div>
      </div>
    </div>
  );
}

function PersonalSettingsView({ user, onNavigate }: any) {
  const [name, setName] = useState(user.displayName || '');
  const [bio, setBio] = useState('');

  useEffect(() => {
    onValue(dbRef(db, `users/${user.uid}`), (snap) => { if (snap.exists()) setBio(snap.val().bio || ''); });
  }, [user.uid]);

  const save = async () => {
    await updateProfile(user, { displayName: name });
    await update(dbRef(db, `users/${user.uid}`), { name, bio });
    alert("تم الحفظ ✅"); onNavigate('chat');
  };

  return (
    <div className="p-8 h-full bg-black flex flex-col text-right">
      <h2 className="text-2xl font-black italic mb-10 text-center uppercase">Settings</h2>
      <div className="space-y-6 flex-1">
        <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 outline-none text-right" placeholder="الاسم" />
        <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 outline-none text-right h-32 resize-none" placeholder="اكتب بيو جديد..." />
        <button onClick={save} className="w-full bg-indigo-600 p-4 rounded-2xl font-black italic active:scale-95 transition-all">Save Profile</button>
      </div>
      <button onClick={() => auth.signOut()} className="w-full text-red-500 p-4 font-bold border border-red-500/10 rounded-2xl mb-6">LOGOUT</button>
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
        await updateProfile(res.user, { displayName: name });
        await set(dbRef(db, `users/${res.user.uid}`), { role: 'Member', name, bio: 'مرحباً بي في كلان DN' });
      }
    } catch (err) { alert("خطأ في البيانات"); }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-black">
      <h1 className="text-7xl font-black text-indigo-500 italic mb-8">DN<span className="text-white">CLAN</span></h1>
      <form onSubmit={handleAuth} className="w-full max-w-sm space-y-4">
        {!isLogin && <input type="text" placeholder="الاسم الكامل" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 text-right" required />}
        <input type="email" placeholder="البريد" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 text-right" required />
        <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl border border-white/5 text-right" required />
        <button className="w-full bg-indigo-600 p-4 rounded-2xl font-black">{isLogin ? 'DOUKHOUL' : 'TASJIL'}</button>
      </form>
      <button onClick={() => setIsLogin(!isLogin)} className="mt-6 text-indigo-400 text-sm font-bold">{isLogin ? 'Create Account' : 'Login'}</button>
    </div>
  );
}
