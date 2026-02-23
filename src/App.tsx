import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase'; // تمت إزالة storage لأننا لن نحتاجه
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
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'; // إضافة مكتبة الكاميرا
import { 
  LogOut, 
  Settings, 
  Users, 
  Image as ImageIcon, 
  Smile, 
  Send, 
  Eye,
  EyeOff,
  MoreVertical,
  ArrowRight,
  Trash2,
  Reply,
  X,
  Palette
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
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

type Theme = 'dark' | 'light' | 'gold';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
});

export const useTheme = () => React.useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app-theme') as Theme) || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// --- Main App Component ---
export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('Member');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'chat' | 'settings' | 'group'>('chat');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const roleRef = dbRef(db, `users/${currentUser.uid}/role`);
        onValue(roleRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserRole(snapshot.val());
          } else {
            setUserRole('Member');
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-deep text-text-main" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-deep text-text-main overflow-hidden" dir="rtl">
      {currentView === 'chat' && <ChatView user={user} userRole={userRole} onNavigate={setCurrentView} />}
      {currentView === 'settings' && <SettingsView user={user} onNavigate={setCurrentView} />}
      {currentView === 'group' && <GroupView onNavigate={setCurrentView} />}
    </div>
  );
}

// --- Auth View ---
function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: displayName || 'مستخدم جديد',
          photoURL: `https://ui-avatars.com/api/?name=${displayName || 'User'}&background=5865F2&color=fff`
        });
        
        await set(dbRef(db, `users/${userCredential.user.uid}/role`), 'Member');
        await auth.currentUser?.reload();
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ ما');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg-deep p-6" dir="rtl">
      <div className="w-full max-w-md flex flex-col items-center space-y-12">
        <div className="flex flex-col items-center">
          <h1 className="text-6xl font-black text-primary tracking-tighter flex flex-col items-center leading-none">
            <span className="text-primary text-7xl">DN</span>
            <span className="text-white text-5xl mt-[-5px]">CLAN</span>
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {!isLogin && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-main">اسم العرض</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-transparent border-b border-text-muted/30 text-text-main px-2 py-2 outline-none focus:border-primary transition-colors text-[16px]" placeholder="اسم العرض" required={!isLogin} />
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-text-main">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent border-b border-text-muted/30 text-text-main px-2 py-2 outline-none focus:border-primary transition-colors text-[16px]" placeholder="البريد الإلكتروني" required />
          </div>

          <div className="space-y-2 relative">
            <label className="text-sm font-semibold text-text-main">كلمة المرور</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent border-b border-text-muted/30 text-text-main px-2 py-2 outline-none focus:border-primary transition-colors text-[16px]" placeholder="كلمة المرور" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading} className="w-full bg-primary hover:bg-indigo-600 text-white font-semibold py-3 rounded-md transition-colors mt-8 disabled:opacity-50">
            {loading ? 'جاري التحميل...' : isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </button>
        </form>

        <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline text-sm font-medium">
          {isLogin ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
        </button>
      </div>
    </div>
  );
}

// --- Message Item Component ---
function MessageItem({ msg, isMe, showAvatar, onReply, onDelete, currentUserRole }: { msg: Message; isMe: boolean; showAvatar: boolean; onReply: (msg: Message) => void; onDelete: (id: string) => void; currentUserRole: string }) {
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.displayName || 'User')}&background=5865F2&color=fff`;

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = fallbackAvatar;
  };

  const getRoleBadge = (role?: string) => {
    if (role === 'Admin') return <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">Admin</span>;
    if (role === 'Veteran') return <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded ml-1">Veteran</span>;
    return null;
  };

  const canDelete = isMe || currentUserRole === 'Admin';

  return (
    <div className={cn("flex w-full group", isMe ? "justify-start" : "justify-end")}>
      <div className={cn("flex max-w-[80%] items-start space-x-2 space-x-reverse", isMe ? "flex-row" : "flex-row-reverse")}>
        
        <div className="w-10 h-10 shrink-0 mt-1">
          {showAvatar && !isMe && (
            <img src={msg.photoURL || fallbackAvatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" onError={handleImageError} />
          )}
        </div>
        
        <div className={cn("flex flex-col", isMe ? "items-start" : "items-end")}>
          {showAvatar && !isMe && (
            <div className="flex items-center mb-1 ml-2">
              <span className="text-xs text-text-muted">{msg.displayName}</span>
              {getRoleBadge(msg.role)}
            </div>
          )}
          {showAvatar && isMe && (
            <div className="flex items-center mb-1 mr-2">
              {getRoleBadge(msg.role)}
              <span className="text-xs text-text-muted">{msg.displayName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!isMe && (
              <div className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                {canDelete && <button onClick={() => onDelete(msg.id)} className="text-text-muted hover:text-red-500 p-1"><Trash2 size={16} /></button>}
                <button onClick={() => onReply(msg)} className="text-text-muted hover:text-text-main p-1"><Reply size={16} /></button>
              </div>
            )}
            
            <div className={cn("px-4 py-2 rounded-2xl relative", isMe ? "bg-primary text-bubble-right-text rounded-br-sm" : "bg-bubble-left text-text-main rounded-bl-sm")}>
              {msg.replyTo && (
                <div className="mb-2 pl-2 pr-2 border-r-2 border-white/30 text-sm opacity-80 bg-black/10 py-1 rounded flex flex-col items-start">
                  <span className="font-semibold text-[10px]">{msg.replyTo.sender}</span>
                  <span className="truncate max-w-[150px] text-xs">{msg.replyTo.text}</span>
                </div>
              )}
              
              {/* عرض الصورة إن وجدت */}
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="uploaded" className="max-w-full rounded-md mb-2 max-h-48 object-contain" />
              )}
              {msg.text && <p className="break-words whitespace-pre-wrap">{msg.text}</p>}
              <div className="text-[10px] text-white/60 mt-1 text-right">
                {msg.createdAt ? format(new Date(msg.createdAt), 'h:mm a', { locale: ar }) : ''}
              </div>
            </div>

            {isMe && (
              <div className="opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                <button onClick={() => onDelete(msg.id)} className="text-text-muted hover:text-red-500 p-1"><Trash2 size={16} /></button>
                <button onClick={() => onReply(msg)} className="text-text-muted hover:text-text-main p-1"><Reply size={16} /></button>
              </div>
            )}
          </div>
        </div>
        
        <div className="w-10 h-10 shrink-0 mt-1">
          {showAvatar && isMe && (
            <img src={msg.photoURL || fallbackAvatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" onError={handleImageError} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Chat View ---
function ChatView({ user, userRole, onNavigate }: { user: User; userRole: string; onNavigate: (view: 'chat' | 'settings' | 'group') => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesRef = query(dbRef(db, 'messages'), orderByChild('createdAt'), limitToLast(100));
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => a.createdAt - b.createdAt);
        setMessages(msgList);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleDeleteMessage = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
      try {
        await remove(dbRef(db, `messages/${id}`));
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() && !uploading) return;

    const text = newMessage;
    setNewMessage('');
    const currentReply = replyingTo;
    setReplyingTo(null);

    try {
      const payload: any = {
        text,
        uid: user.uid,
        displayName: user.displayName || 'مستخدم',
        photoURL: user.photoURL || '',
        role: userRole,
        createdAt: serverTimestamp()
      };

      if (currentReply) {
        payload.replyTo = {
          text: currentReply.text || 'صورة',
          sender: currentReply.displayName
        };
      }

      await push(dbRef(db, 'messages'), payload);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  // رفع الصورة بواسطة Base64 لتجاوز حدود Storage
  const handleImageUpload = async () => {
    try {
      setUploading(true);
      const image = await Camera.getPhoto({
        quality: 50, // جودة 50 لتقليل حجم البيانات
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos
      });

      if (image.base64String) {
        const base64Data = `data:image/jpeg;base64,${image.base64String}`;
        
        await push(dbRef(db, 'messages'), {
          text: '',
          imageUrl: base64Data, // نرسل الصورة كنص مباشرة في الرسالة
          uid: user.uid,
          displayName: user.displayName || 'مستخدم',
          photoURL: user.photoURL || '',
          role: userRole,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("خطأ في اختيار الصورة:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg-main">
      {/* Header */}
      <div className="h-14 bg-bg-header flex items-center justify-between px-4 shadow-md z-10 shrink-0">
        <div className="flex items-center space-x-4 space-x-reverse">
          <button onClick={() => onNavigate('group')} className="text-text-muted hover:text-text-main">
            <Users size={24} />
          </button>
          <div className="flex items-center space-x-2 space-x-reverse">
            <h1 className="text-xl font-black text-primary tracking-tighter flex items-center leading-none">
              <span className="text-primary">DN</span>
              <span className="text-white ml-1">CLAN</span>
            </h1>
            <span className="text-text-muted mx-2">|</span>
            <h2 className="font-bold text-sm">الدردشة العامة</h2>
          </div>
        </div>
        <div className="flex items-center space-x-3 space-x-reverse">
          <button onClick={() => onNavigate('settings')} className="text-text-muted hover:text-text-main">
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.uid === user.uid;
          const showAvatar = index === 0 || messages[index - 1].uid !== msg.uid;
          
          return (
            <MessageItem 
              key={msg.id} 
              msg={msg} 
              isMe={isMe} 
              showAvatar={showAvatar} 
              onReply={setReplyingTo}
              onDelete={handleDeleteMessage}
              currentUserRole={userRole}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-bg-main p-4 shrink-0 flex flex-col gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {replyingTo && (
          <div className="bg-bg-header px-4 py-2 flex items-center justify-between border-r-4 border-primary rounded-md">
            <div className="flex flex-col">
              <span className="text-xs text-primary font-semibold">الرد على {replyingTo.displayName}</span>
              <span className="text-sm text-text-muted truncate max-w-[200px]">{replyingTo.text || 'صورة'}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-text-muted hover:text-text-main p-1">
              <X size={18} />
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center bg-bg-header rounded-full px-4 py-2">
          <button type="button" className="text-text-muted hover:text-text-main p-2 shrink-0">
            <Smile size={24} />
          </button>
          
          <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="اكتب رسالة..." className="flex-1 bg-transparent text-text-main outline-none px-2 text-[16px]" />
          
          <button type="button" onClick={handleImageUpload} className="text-text-muted hover:text-text-main p-2 shrink-0" disabled={uploading}>
            {uploading ? <div className="animate-spin w-5 h-5 border-2 border-primary rounded-full"></div> : <ImageIcon size={24} />}
          </button>
          
          <button type="submit" disabled={!newMessage.trim() && !uploading} className="text-primary disabled:text-text-muted p-2 shrink-0">
            <Send size={24} />
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Settings View ---
function SettingsView({ user, onNavigate }: { user: User; onNavigate: (view: 'chat' | 'settings' | 'group') => void }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="h-full flex flex-col bg-bg-main w-full p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => onNavigate('chat')} className="text-text-muted hover:text-text-main">
          <ArrowRight size={28} />
        </button>
        <h2 className="text-xl font-bold">الإعدادات</h2>
        <div className="w-7"></div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="Profile" className="w-24 h-24 rounded-full mb-4 border-2 border-primary object-cover" />
        <h3 className="text-2xl font-bold">{user.displayName}</h3>
        <p className="text-text-muted">{user.emai
