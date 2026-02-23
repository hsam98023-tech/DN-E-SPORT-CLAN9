import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, User } from 'firebase/auth';
import { ref as dbRef, push, onValue, serverTimestamp, query, limitToLast, remove, set, update, get } from 'firebase/database';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Settings, Users, Image as ImageIcon, Send, ArrowRight, Trash2, Reply, X, User as UserIcon, LogOut, Info, Link as LinkIcon, MessageSquare } from 'lucide-react';
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
        const defaultAvatar = `https://ui-avatars.com/api/?name=${name}&background=6366f1&color=fff`;
        await updateProfile(res.user, { displayName: name, photoURL: defaultAvatar });
        await set(dbRef(db, `users/${res.user.uid}`), { 
          role: 'Member', name: name, bio: 'لاعب في كلان DN', photoURL: defaultAvatar 
        });
      }
    } catch (err) { alert("تأكد من البيانات"); }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-6 bg-black">
      <div className="w-full max-w-sm text-center space-y-8 animate-in fade-in duration-700">
        <h1 className="text-7xl font-black text-indigo-500 italic tracking-tighter">DN<span className="text-white">CLAN</span></h1>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && <input type="text" placeholder="الاسم الكامل" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl outline-none border border-white/5 focus:border-indigo-500 transition-all text-right" required />}
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl outline-none border border-white/5 focus:border-indigo-500 transition-all text-right" required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] p-4 rounded-2xl outline-none border border-white/5 focus:border-indigo-500 transition-all text-right" required />
          <button type="submit" className="w-full bg-indigo-600 p-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all uppercase">{isLogin ? 'دخول' : 'تسجيل'}</button>
        </form>
        <button onClick={() => setIsLogin(!isLogin)} className="text-indigo-400 font-medium text-sm">{isLogin ? 'إنشاء حساب جديد' : 'عندك حساب؟ ادخل'}</button>
      </div>
    </div>
  );
}function ChatView({ user, userRole, onNavigate }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Message | null>(null);
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
        uid: user.uid, displayName: user.displayName, photoURL: user.photoURL || '',
        role: userRole, createdAt: serverTimestamp()
      });
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-[#0a0a0a]" onClick={() => setActiveMenu(null)}>
      <header className="h-20 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl border-b border-white/5 z-50">
        <button onClick={() => onNavigate('group')} className="p-3 bg-white/5 rounded-full border border-white/5 shadow-lg"><Settings size={20}/></button>
        <div className="flex flex-col items-center">
          <span className="text-xl font-black italic text-indigo-500">DN CLAN</span>
          <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div><span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Global Chat</span></div>
        </div>
        <button onClick={() => onNavigate('personal')} className="p-3 bg-white/5 rounded-full border border-white/5 shadow-lg"><UserIcon size={20}/></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col", m.uid === user.uid ? "items-end" : "items-start")}>
            <div className={cn("flex gap-3 max-w-[85%]", m.uid === user.uid ? "flex-row-reverse" : "flex-row")}>
              {m.photoURL ? (
                <img src={m.photoURL} className="w-9 h-9 rounded-full self-end border border-white/10 object-cover" onError={(e) => (e.currentTarget.src = `https://ui-avatars.com/api/?name=${m.displayName}`)} />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-[10px] self-end">{m.displayName?.charAt(0)}</div>
              )}
              <div className="relative">
                <div 
                  onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id); }}
                  className={cn("p-3.5 rounded-[22px] shadow-2xl transition-all active:scale-95", m.uid === user.uid ? "bg-indigo-600 rounded-tr-none" : "bg-[#161616] border border-white/5 rounded-tl-none")}
                >
                  <p className="text-[9px] font-bold opacity-40 mb-1 uppercase">{m.displayName} • {m.role}</p>
                  {m.replyTo && <div className="bg-black/20 p-2 rounded-xl mb-2 text-[10px] border-r-2 border-indigo-300 italic">@{m.replyTo.sender}: {m.replyTo.text}</div>}
                  {m.imageUrl && <img src={m.imageUrl} className="rounded-xl mb-2 max-h-60 w-full object-cover" />}
                  {m.text && <p className="text-[14px] leading-relaxed break-words">{m.text}</p>}
                </div>
                {activeMenu === m.id && (
                  <div className={cn("absolute bottom-full mb-2 flex gap-1 animate-in zoom-in", m.uid === user.uid ? "right-0" : "left-0")}>
                    <button onClick={() => { setReply(m); setActiveMenu(null); }} className="bg-white text-black p-2.5 rounded-full shadow-2xl flex items-center gap-1.5 text-[9px] font-black uppercase"><Reply size={14}/> رد</button>
                    {(userRole === 'Admin' || m.uid === user.uid) && (
                      <button onClick={() => { remove(dbRef(db, `messages/${m.id}`)); setActiveMenu(null); }} className="bg-red-600 text-white p-2.5 rounded-full shadow-2xl flex items-center gap-1.5 text-[9px] font-black uppercase"><Trash2 size={14}/> حذف</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </main>
      <footer className="p-4 pb-10 bg-black/20 backdrop-blur-md">
        {reply && <div className="bg-indigo-600/30 p-3 mb-2 rounded-2xl text-[11px] flex justify-between border border-indigo-500/30"><span>الرد على <b>@{reply.displayName}</b></span><X size={16} onClick={() => setReply(null)}/></div>}
        <div className="bg-[#111] rounded-[30px] p-2 flex items-center border border-white/10">
          <button onClick={uploadImg} className="p-3 text-white/40"><ImageIcon size={22} /></button>
          <form onSubmit={sendMsg} className="flex-1 flex gap-2">
            <input value={text} onChange={e => setText(e.target.value)} className="flex-1 bg-transparent py-3 outline-none text-sm px-2 text-white text-right" placeholder="اكتب شيئاً..." />
            <button type="submit" className="p-3 bg-white rounded-full text-black hover:scale-110 active:scale-90 transition-all shadow-lg"><Send size={20} /></button>
          </form>
        </div>
      </footer>
    </div>
  );
}
function GroupView({ onNavigate, userRole, user }: any) {
  const [memberCount, setMemberCount] = useState(0);
  const [clanBio, setClanBio] = useState('...لا يوجد بيو حالياً');

  useEffect(() => {
    // جلب عدد المسجلين (التفاعلي)
    onValue(dbRef(db, 'users'), (snap) => {
      if (snap.exists()) setMemberCount(Object.keys(snap.val()).length);
    });
    // جلب بيو الأدمن كـ بيو للكلان (مثلاً)
    onValue(dbRef(db, `users/${user.uid}`), (snap) => {
      if (snap.exists()) setClanBio(snap.val().bio || '...لا يوجد بيو حالياً');
    });
  }, [user.uid]);

  const renderBio = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => 
      urlRegex.test(part) ? <a key={i} href={part} target="_blank" className="text-indigo-400 underline break-words">{part}</a> : part
    );
  };

  return (
    <div className="p-8 h-full bg-[#0a0a0a] flex flex-col">
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => onNavigate('chat')} className="p-2 bg-white/5 rounded-full border border-white/5 shadow-lg"><ArrowRight size={22}/></button>
        <h2 className="text-2xl font-black italic uppercase tracking-widest">Clan Info</h2>
      </header>
      <div className="flex-1 overflow-y-auto space-y-8">
        <div className="p-10 bg-indigo-600 rounded-[40px] border border-white/10 shadow-2xl relative flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-4"><Users size={40}/></div>
          <h3 className="text-4xl font-black italic mb-2">DN E-SPORTS</h3>
        </div>

        {/* خانة البيو الجديدة */}
        <div className="bg-[#111] p-6 rounded-[30px] border border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-widest"><Info size={14}/> Bio / News</div>
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{renderBio(clanBio)}</p>
        </div>

        <div className="flex justify-center">
          <div className="bg-[#111] p-6 rounded-3xl border border-white/5 text-center min-w-[150px]">
            <p className="text-[10px] text-white/30 font-bold uppercase mb-1">Members</p>
            <p className="text-3xl font-black italic text-indigo-500">{memberCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
function PersonalSettingsView({ user, onNavigate }: any) {
  const [name, setName] = useState(user.displayName || '');
  const [bio, setBio] = useState('');

  useEffect(() => {
    onValue(dbRef(db, `users/${user.uid}`), (snap) => {
      if (snap.exists()) setBio(snap.val().bio || '');
    });
  }, [user.uid]);

  const updateAvatar = async () => {
    const img = await Camera.getPhoto({ quality: 40, resultType: CameraResultType.Base64 });
    if (img.base64String) {
      const data = `data:image/jpeg;base64,${img.base64String}`;
      await updateProfile(user, { photoURL: data });
      await update(dbRef(db, `users/${user.uid}`), { photoURL: data });
      alert("تم تغيير الصورة، اضغط حفظ");
    }
  };

  const save = async () => {
    try {
      await updateProfile(user, { displayName: name });
      await update(dbRef(db, `users/${user.uid}`), { name, bio, photoURL: user.photoURL });
      
      // تحديث الرسائل القديمة
      onValue(query(dbRef(db, 'messages'), limitToLast(50)), (snap) => {
        const msgs = snap.val();
        if (msgs) {
          Object.keys(msgs).forEach(k => {
            if (msgs[k].uid === user.uid) update(dbRef(db, `messages/${k}`), { displayName: name, photoURL: user.photoURL });
          });
        }
      }, { onlyOnce: true });
      alert("تم الحفظ ✅");
      onNavigate('chat');
    } catch (err) { alert("خطأ"); }
  };
  return (
    <div className="p-8 space-y-8 flex flex-col h-full bg-black">
      <header className="flex items-center gap-4 border-b border-white/5 pb-6">
        <button onClick={() => onNavigate('chat')} className="p-2 bg-white/5 rounded-full border border-white/5"><ArrowRight size={22}/></button>
        <h2 className="text-2xl font-black italic uppercase">Settings</h2>
      </header>
      <div className="flex flex-col items-center gap-8 pt-6 overflow-y-auto scrollbar-hide">
        <div className="relative group cursor-pointer" onClick={updateAvatar}>
          <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-32 h-32 rounded-full border-4 border-indigo-600 shadow-2xl object-cover" />
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><UserIcon size={24}/></div>
        </div>
        <div className="w-full space-y-6 text-right">
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase font-black px-2 tracking-widest">Username</label>
            <input value={name} onChange={e => setName(e.target.value)} className="bg-[#111] p-4 rounded-2xl w-full border border-white/5 outline-none focus:border-indigo-600 font-bold text-right" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] text-white/30 uppercase font-black px-2 tracking-widest">Bio / WhatsApp Link</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="اكتب شيئاً أو حط رابط واتساب..." className="bg-[#111] p-4 rounded-2xl w-full border border-white/5 outline-none focus:border-indigo-600 text-sm h-32 resize-none text-right" />
          </div>
          <button onClick={save} className="bg-indigo-600 w-full p-4 rounded-2xl font-black italic shadow-lg uppercase active:scale-95 transition-all">Save Changes</button>
        </div>
      </div>
      <div className="flex-1"></div>
      <button onClick={() => auth.signOut()} className="w-full text-red-500 p-4 font-bold border border-red-500/10 rounded-2xl bg-red-500/5 flex items-center justify-center gap-2"><LogOut size={20}/> LOGOUT</button>
    </div>
  );
}

