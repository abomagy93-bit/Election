/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Loader2, Radio, CheckCircle2, User, Link as LinkIcon, AlertCircle, Play, Pause, Volume2, Download } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generate a simplified string for ID (strip spaces and lowercase)
const generateNameId = (name: string) => {
  return name.trim().toLowerCase().replace(/\\s+/g, '_');
};

type VoteChoice = "مقاطع" | "غير مقاطع";

interface VoteRecord {
  id: string;
  name: string;
  nameId: string;
  vote: VoteChoice;
  createdAt: any;
}

export default function App() {
  const [name, setName] = useState('');
  const [selectedVote, setSelectedVote] = useState<VoteChoice | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorLine, setErrorLine] = useState('');
  const [hasVoted, setHasVoted] = useState(() => {
    return localStorage.getItem('votedState') === 'true';
  });
  const [savedUserName, setSavedUserName] = useState(() => {
    return localStorage.getItem('voterName') || '';
  });
  
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [isLoadingVotes, setIsLoadingVotes] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Error playing audio:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'votes'), orderBy('createdAt', 'desc'));
    const unsubscribeSnapshot = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const docsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'مجهول',
          nameId: data.nameId || '',
          vote: data.vote || '-',
          createdAt: data.createdAt, // can be null while pending
          isPending: doc.metadata.hasPendingWrites
        };
      }) as (VoteRecord & { isPending: boolean })[];
      setVotes(docsData);
      setIsLoadingVotes(false);
    }, (error) => {
      console.error("Error fetching votes:", error);
      setIsLoadingVotes(false);
    });

    return () => unsubscribeSnapshot();
  }, []);

  const handleVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorLine('يجب إدخال الاسم بالكامل.');
      return;
    }
    if (name.trim().length < 3) {
      setErrorLine('الاسم يجب أن يكون 3 أحرف على الأقل.');
      return;
    }
    if (!selectedVote) {
      setErrorLine('يرجى اختيار موقفك من المقاطعة.');
      return;
    }

    const nameId = generateNameId(name);
    
    // Client-side duplication check (Backend rules also block this)
    const alreadyVoted = votes.some(v => v.nameId === nameId);
    if (alreadyVoted) {
      setErrorLine('عذراً، هذا الاسم قام بالتصويت من قبل.');
      return;
    }

    setIsSubmitting(true);
    setErrorLine('');

    try {
      await addDoc(collection(db, 'votes'), {
        name: name.trim(),
        nameId: nameId,
        vote: selectedVote,
        createdAt: serverTimestamp()
      });
      setHasVoted(true);
      setSavedUserName(name.trim());
      localStorage.setItem('votedState', 'true');
      localStorage.setItem('voterName', name.trim());
    } catch (error: any) {
      console.error("Voting error", error);
      if (error.code === 'permission-denied') {
        setErrorLine('عذراً، لا يمكن التصويت بنفس الاسم لقد قمت بالتصويت مسبقا.');
      } else {
        setErrorLine(`حدث خطأ أثناء الحفظ. (السبب: ${error.message || 'خطأ غير معروف'})`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const boycottingCount = votes.filter(v => v.vote === "مقاطع").length;
  const notBoycottingCount = votes.filter(v => v.vote === "غير مقاطع").length;
  const totalVotes = votes.length;
  const boycottingPercent = totalVotes > 0 ? Math.round((boycottingCount / totalVotes) * 100) : 0;
  const notBoycottingPercent = totalVotes > 0 ? 100 - boycottingPercent : 0;

  const exportToCSV = () => {
    // Add BOM for UTF-8 to work correctly with Excel
    const BOM = "\uFEFF";
    
    let csvContent = BOM + "م,الاسم,الموقف,التاريخ\n";
    
    votes.forEach((v, idx) => {
      const dateStr = v.isPending ? 'جاري الإرسال' : (v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'الآن');
      const row = [
        idx + 1,
        `"${v.name}"`,
        `"${v.vote}"`,
        `"${dateStr}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `نتائج_الاستفتاء_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden" dir="rtl">
      
      {/* Hidden Audio Element for Quran stream */}
      <audio ref={audioRef} src="https://stream.radiojar.com/8s5u5tpdtwzuv" preload="none" />

      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 text-center sm:text-right">استفتاء المشاركة في انتخابات مجلس إدارة أرض جمعية الإسكان جوار أكاديمية مصر السلاب</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleAudio}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors border",
              isPlaying 
                ? "bg-indigo-50 leading-none text-indigo-700 border-indigo-200 hover:bg-indigo-100" 
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            )}
            title="إذاعة القرآن الكريم من القاهرة"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>إيقاف الإذاعة</span>
                <span className="flex h-3 w-3 relative ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 ml-1" />
                <span>إذاعة القرآن الكريم</span>
              </>
            )}
          </button>
          
          <a href="https://Quran-fm.netlify.app" target="_blank" rel="noreferrer" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-5 py-2 rounded-full text-sm font-medium transition-colors border border-emerald-200 flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2 .712V17a1 1 0 001 1z"></path></svg>
            موقع أهل القرآن
          </a>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-4 md:p-8 gap-8 overflow-y-auto lg:overflow-hidden">
        
        {/* Left Column */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 shrink-0 lg:overflow-y-auto pb-4">
          
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-700 mb-6 border-r-4 border-indigo-500 pr-3">تسجيل موقفك الانتخابي</h2>
            
            {!hasVoted ? (
              <form onSubmit={handleVote} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-600 mb-2 italic">الاسم الكامل (لضمان الشفافية)</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 outline-none transition-all placeholder:text-slate-400"
                    placeholder="أدخل اسمك الثلاثي"
                    required
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-600">حدد خيار المشاركة:</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="cursor-pointer group">
                      <input 
                        type="radio" 
                        name="voteChoice" 
                        value="مقاطع"
                        checked={selectedVote === "مقاطع"}
                        onChange={(e) => setSelectedVote(e.target.value as VoteChoice)}
                        className="hidden peer"
                      />
                      <div className="flex flex-col items-center justify-center p-4 border-2 border-slate-100 rounded-xl peer-checked:border-rose-500 peer-checked:bg-rose-50 transition-all">
                        <span className="text-2xl mb-1">🚫</span>
                        <span className="text-sm font-bold text-slate-600 peer-checked:text-rose-700">مقاطع</span>
                      </div>
                    </label>
                    <label className="cursor-pointer group">
                      <input 
                        type="radio" 
                        name="voteChoice" 
                        value="غير مقاطع"
                        checked={selectedVote === "غير مقاطع"}
                        onChange={(e) => setSelectedVote(e.target.value as VoteChoice)}
                        className="hidden peer"
                      />
                      <div className="flex flex-col items-center justify-center p-4 border-2 border-slate-100 rounded-xl peer-checked:border-emerald-500 peer-checked:bg-emerald-50 transition-all">
                        <span className="text-2xl mb-1">🗳️</span>
                        <span className="text-sm font-bold text-slate-600 peer-checked:text-emerald-700">غير مقاطع</span>
                      </div>
                    </label>
                  </div>
                </div>

                {errorLine && (
                  <div className="bg-red-50 text-rose-700 p-3 flex rounded-lg border border-red-100">
                    <span className="font-medium text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errorLine}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !name || !selectedVote}
                  className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 disabled:opacity-50 disabled:bg-slate-600 flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> جاري الحفظ...</>
                  ) : (
                    <>تأكيد التصويت</>
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">تم تسجيل تصويتك بنجاح!</h2>
                {savedUserName && <p className="text-lg text-indigo-700 font-semibold mb-2">{savedUserName}</p>}
                <p className="text-slate-500 text-sm">شكراً لمشاركتك في هذا الاستفتاء.</p>
              </div>
            )}
            
            <p className="mt-4 text-[10px] text-slate-400 text-center leading-relaxed">
              * يتم التحقق تقنياً منعاً للتكرار وضمان نزاهة النتائج.
            </p>
          </section>

          <section className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-medium opacity-80 mb-4">إحصائيات فورية</h3>
            <div className="flex justify-between items-end mb-2">
              <span className="text-3xl font-bold">{totalVotes}</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">إجمالي المشاركين</span>
            </div>
            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden flex">
              <div className="h-full bg-rose-400 transition-all duration-500 ease-out" style={{ width: `${boycottingPercent}%` }}></div>
              <div className="h-full bg-emerald-400 transition-all duration-500 ease-out" style={{ width: `${notBoycottingPercent}%` }}></div>
            </div>
            <div className="flex justify-between mt-3 text-xs font-mono">
              <span className="text-rose-200">مقاطع: {boycottingPercent}%</span>
              <span className="text-emerald-200">مشارك: {notBoycottingPercent}%</span>
            </div>
          </section>

        </div>

        {/* Right Column */}
        <div className="w-full lg:w-2/3 flex flex-col flex-1 min-h-[400px]">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-semibold text-slate-700">جدول المشاركين (سجل دائم)</h2>
              <div className="flex gap-2">
                <button 
                  onClick={exportToCSV}
                  disabled={votes.length === 0}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border border-indigo-200 disabled:opacity-50"
                  title="تصدير النتائج كملف إكسيل CSV"
                >
                  <Download className="w-4 h-4" />
                  تصدير CSV
                </button>
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-md text-xs font-mono select-all"># {new Date().getFullYear()}-VOTE</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto relative">
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-4 font-semibold w-16">#</th>
                    <th className="p-4 font-semibold">اسم المشارك</th>
                    <th className="p-4 font-semibold">الموقف الانتخابي</th>
                    <th className="p-4 font-semibold text-left">التوقيت</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-600">
                  {isLoadingVotes ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center">
                        <div className="flex justify-center items-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mr-2" />
                          <span>جاري تحميل البيانات...</span>
                        </div>
                      </td>
                    </tr>
                  ) : votes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-slate-500">
                        لا يوجد مشاركات حتى الآن. كن أول من يشارك!
                      </td>
                    </tr>
                  ) : (
                    votes.map((v, idx) => (
                      <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono text-slate-400">{(idx + 1).toString().padStart(3, '0')}</td>
                        <td className="p-4 font-medium">{v.name}</td>
                        <td className="p-4">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-semibold",
                            v.vote === "مقاطع" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                          )}>
                            {v.vote}
                          </span>
                        </td>
                        <td className="p-4 text-left text-slate-400 text-xs font-mono" dir="ltr">
                            {v.isPending ? (
                              <span className="text-amber-500 font-bold text-[10px]">🔄 جاري...</span>
                            ) : (
                              v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'الآن'
                            )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
              
            {/* Bottom gradient overlay to indicate scrollable content */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10"></div>
          </div>
        </div>

      </main>

      <footer className="bg-white border-t border-slate-200 px-4 md:px-8 py-3 flex flex-col sm:flex-row justify-between items-center shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-slate-500">النظام يعمل بكفاءة - قواعد البيانات محمية ضد الحذف</span>
        </div>
        <div className="text-xs font-semibold text-slate-400">
          تم التطوير بواسطة <span className="text-indigo-600">كريم عشماوي</span>
        </div>
      </footer>
    </div>
  );
}

