'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ArrowLeft, Loader2, Search, Mail, Send, MessageCircle, CheckCheck, Plus, X, Link as LinkIcon, Globe, ShieldAlert, Download } from 'lucide-react';
import Link from 'next/link';

interface Youtuber {
    id: string;
    url: string;
    name: string;
    photoUrl: string;
    email: string;
    country: string;
    mailStatus: string;
    createdAt: number;
}

export default function MailPage() {
    const [user, setUser] = useState<User | null>(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [youtubers, setYoutubers] = useState<Youtuber[]>([]);
    const [loading, setLoading] = useState(true);

    // Tab state
    const [activeTab, setActiveTab] = useState<'sent' | 'responded'>('sent');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [modalSearch, setModalSearch] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Auth & Access check
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                window.location.href = '/auth';
            } else {
                setUser(currentUser);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        const isUserUlas = user.displayName === 'Ulas';

        if (isUserUlas) {
            setHasAccess(true);
        } else {
            const memberDocRef = doc(db, "youtubers_members", user.uid);
            const unsubscribe = onSnapshot(memberDocRef, (docSnap) => {
                setHasAccess(docSnap.exists());
            });
            return () => unsubscribe();
        }
    }, [user]);

    // Fetch youtubers
    useEffect(() => {
        if (!hasAccess) {
            if (user) setLoading(false);
            return;
        }

        const q = query(collection(db, 'youtubers'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as Youtuber[];
            setYoutubers(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [hasAccess, user]);

    // Computed lists
    const sentList = youtubers.filter(y => y.mailStatus === 'sent');
    const respondedList = youtubers.filter(y => y.mailStatus === 'responded');
    const foundList = youtubers.filter(y => y.email && y.email.trim() !== '' && (!y.mailStatus || y.mailStatus === ''));

    // Current tab items with search
    const currentTabItems = (activeTab === 'sent' ? sentList : respondedList).filter(y => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (y.name || '').toLowerCase().includes(q) || (y.email || '').toLowerCase().includes(q);
    });

    // Modal source items (what to show in add modal)
    const modalSourceItems = (activeTab === 'sent' ? foundList : sentList).filter(y => {
        if (!modalSearch.trim()) return true;
        const q = modalSearch.toLowerCase();
        return (y.name || '').toLowerCase().includes(q) || (y.email || '').toLowerCase().includes(q);
    });

    const openAddModal = () => {
        setSelectedIds(new Set());
        setModalSearch('');
        setShowAddModal(true);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === modalSourceItems.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(modalSourceItems.map(y => y.id)));
        }
    };

    const handleAddSelected = async () => {
        if (selectedIds.size === 0) return;
        setIsUpdating(true);

        try {
            const newStatus = activeTab === 'sent' ? 'sent' : 'responded';
            const promises = Array.from(selectedIds).map(id => {
                const ref = doc(db, 'youtubers', id);
                return setDoc(ref, { mailStatus: newStatus }, { merge: true });
            });
            await Promise.all(promises);
            setShowAddModal(false);
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Error updating mail status:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    // Remove from current status (revert)
    const removeFromStatus = async (id: string) => {
        try {
            const ref = doc(db, 'youtubers', id);
            if (activeTab === 'sent') {
                await setDoc(ref, { mailStatus: '' }, { merge: true });
            } else {
                // Dönüş Alındı -> back to sent
                await setDoc(ref, { mailStatus: 'sent' }, { merge: true });
            }
        } catch (error) {
            console.error('Error removing status:', error);
        }
    };

    const decodeHTML = (str: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    };

    const handleCopyMailSent = () => {
        const header = 'First Name,E-Mail';

        // Deduplicate by email
        const emailMap = new Map<string, Youtuber[]>();
        sentList.forEach(y => {
            const email = (y.email || '').trim().toLowerCase();
            if (!email) return;
            if (!emailMap.has(email)) emailMap.set(email, []);
            emailMap.get(email)!.push(y);
        });

        const duplicates: { email: string, youtubers: Youtuber[] }[] = [];
        const uniqueRows: string[] = [];

        emailMap.forEach((group, email) => {
            const first = group[0];
            const name = decodeHTML((first.name || '')).trim().replace(/,/g, ' ');
            const cleanEmail = (first.email || '').trim().replace(/,/g, ' ');
            uniqueRows.push(`${name},${cleanEmail}`);

            if (group.length > 1) {
                duplicates.push({ email, youtubers: group });
            }
        });

        // Show alert for duplicates
        if (duplicates.length > 0) {
            const msg = duplicates.map(d => {
                const names = d.youtubers.map(y => `  • ${decodeHTML(y.name)} (${y.url})`).join('\n');
                return `📧 ${d.email}:\n${names}`;
            }).join('\n\n');
            alert(`Aşağıdaki YouTuber'lar aynı mail adresine sahip olduğu için bire indirildi:\n\n${msg}`);
        }

        const csvContent = [header, ...uniqueRows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mail_gonderildi_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading || !user) {
        return <div className="min-h-screen bg-[#1e1e24] flex flex-col items-center justify-center space-y-4 text-white">
            <Loader2 className="w-10 h-10 animate-spin text-[#2d936c]" />
            <p className="text-slate-400 font-medium">Yükleniyor...</p>
        </div>;
    }

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-[#1e1e24] text-white p-6 flex flex-col items-center justify-center space-y-6">
                <ShieldAlert className="w-16 h-16 text-red-500" />
                <h1 className="text-3xl font-bold text-[#a8e6cf]">Erişim Engellendi</h1>
                <p className="text-slate-400 text-center max-w-md">Bu sayfaya giriş yetkiniz bulunmuyor.</p>
                <Link href="/">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-500 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition">
                        <ArrowLeft className="w-4 h-4" /> Ana Sayfaya Dön
                    </button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#1e1e24] flex flex-col font-sans text-white">
            {/* Header */}
            <div className="bg-[#1e1e24] border-b border-slate-700 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap justify-between items-center h-16 gap-3">
                        <div className="flex items-center gap-4">
                            <Link href="/youtubers" className="text-slate-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-2">
                                <Mail className="w-5 h-5 text-[#6366f1]" />
                                <h1 className="text-xl font-bold text-[#a8e6cf] tracking-wide">Mail Yönetimi</h1>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col">

                {/* Tabs + Add button */}
                <div className="flex flex-wrap gap-3 mb-6 items-center">
                    <div className="flex gap-1 bg-[#2b2b30] p-1.5 rounded-xl border border-slate-700 shadow-sm">
                        <button
                            onClick={() => { setActiveTab('sent'); setSearchQuery(''); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${activeTab === 'sent' ? 'bg-blue-600/20 text-blue-400 shadow ring-1 ring-blue-600/50' : 'bg-transparent text-slate-400 hover:text-blue-400 hover:bg-blue-600/10'}`}
                        >
                            <Send className="w-3.5 h-3.5" />
                            Mail Gönderildi <span className="ml-1 opacity-70 text-xs">({sentList.length})</span>
                        </button>
                        <button
                            onClick={() => { setActiveTab('responded'); setSearchQuery(''); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${activeTab === 'responded' ? 'bg-purple-600/20 text-purple-400 shadow ring-1 ring-purple-600/50' : 'bg-transparent text-slate-400 hover:text-purple-400 hover:bg-purple-600/10'}`}
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Dönüş Alındı <span className="ml-1 opacity-70 text-xs">({respondedList.length})</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {activeTab === 'sent' && sentList.length > 0 && (
                            <button
                                onClick={handleCopyMailSent}
                                className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white text-sm font-medium rounded-lg hover:bg-[#2563eb] transition shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                Copy YouTubers
                            </button>
                        )}
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2d936c] text-white text-sm font-medium rounded-lg hover:bg-[#237a58] transition shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Ekle
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-6 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Ara (isim, email)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-[#2b2b30] border border-slate-700 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-[#2d936c] focus:border-[#2d936c] outline-none transition-shadow"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Grid */}
                {currentTabItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 border-2 border-dashed border-slate-700 rounded-2xl bg-[#2b2b30]/50">
                        {activeTab === 'sent' ? <Send className="w-16 h-16 mb-4 text-slate-600" /> : <MessageCircle className="w-16 h-16 mb-4 text-slate-600" />}
                        <p className="text-xl font-medium text-slate-300 mb-2">
                            {activeTab === 'sent' ? 'Mail gönderilen YouTuber yok' : 'Dönüş alınan YouTuber yok'}
                        </p>
                        <p className="text-sm text-slate-500">
                            &quot;Ekle&quot; butonuna tıklayarak {activeTab === 'sent' ? 'Bulundu listesinden' : 'Mail gönderildi listesinden'} ekleyebilirsiniz.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {currentTabItems.map((youtuber) => (
                            <div
                                key={youtuber.id}
                                className="bg-[#2b2b30] border border-slate-700 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
                            >
                                {/* Photo */}
                                <a
                                    href={youtuber.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block aspect-video bg-[#1e1e24] relative overflow-hidden flex items-center justify-center"
                                >
                                    {youtuber.photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={youtuber.photoUrl}
                                            alt=""
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-[#2b2b30] flex flex-col items-center justify-center text-slate-500 p-4">
                                            <LinkIcon className="w-8 h-8 mb-2 opacity-50" />
                                            <span className="text-xs font-medium text-center truncate w-full opacity-70">{youtuber.url}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Status badge */}
                                    <div className={`absolute top-3 left-3 rounded-full p-1.5 shadow-md ${activeTab === 'sent' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}`}>
                                        {activeTab === 'sent' ? <Send className="w-3.5 h-3.5" /> : <CheckCheck className="w-3.5 h-3.5" />}
                                    </div>
                                </a>

                                {/* Content */}
                                <div className="p-4 flex flex-col flex-1 bg-[#2b2b30]">
                                    <h3 className="font-semibold text-slate-200 line-clamp-1 leading-snug mb-2" title={youtuber.name}>
                                        {youtuber.name}
                                    </h3>

                                    <div className="w-full flex flex-col gap-1.5 text-sm">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-medium">
                                            <span className="truncate max-w-[150px]">{youtuber.email}</span>
                                        </div>
                                        {youtuber.country && youtuber.country.trim() !== '' && (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 font-medium">
                                                <Globe className="w-3 h-3" />
                                                <span className="truncate max-w-[150px]">{youtuber.country}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Remove action */}
                                    <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-end">
                                        <button
                                            onClick={() => removeFromStatus(youtuber.id)}
                                            className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1.5 rounded-md transition"
                                            title={activeTab === 'sent' ? 'Bulundu\'ya geri al' : 'Mail Gönderildi\'ye geri al'}
                                        >
                                            <X className="w-3.5 h-3.5" /> Kaldır
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div
                        className="bg-[#2b2b30] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-700">
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {activeTab === 'sent' ? 'Bulundu Listesinden Ekle' : 'Mail Gönderildi Listesinden Ekle'}
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">
                                    {activeTab === 'sent'
                                        ? 'Email adresi bulunan ve henüz mail gönderilmemiş YouTuber\'ları seçin.'
                                        : 'Mail gönderilmiş YouTuber\'ları dönüş alındı olarak işaretlemek için seçin.'}
                                </p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white transition p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Search */}
                        <div className="px-5 pt-4 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Ara (isim, email)..."
                                    value={modalSearch}
                                    onChange={(e) => setModalSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#1e1e24] border border-slate-600 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:ring-2 focus:ring-[#2d936c] outline-none transition-shadow"
                                />
                            </div>
                        </div>

                        {/* Select All */}
                        <div className="px-5 py-2 flex items-center justify-between">
                            <button
                                onClick={toggleSelectAll}
                                className="text-sm text-slate-400 hover:text-white transition flex items-center gap-2"
                            >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${selectedIds.size === modalSourceItems.length && modalSourceItems.length > 0 ? 'bg-[#2d936c] border-[#2d936c]' : 'border-slate-600'}`}>
                                    {selectedIds.size === modalSourceItems.length && modalSourceItems.length > 0 && <CheckCheck className="w-3 h-3 text-white" />}
                                </div>
                                Tümünü Seç ({modalSourceItems.length})
                            </button>
                            {selectedIds.size > 0 && (
                                <span className="text-sm text-[#2d936c] font-medium">{selectedIds.size} seçili</span>
                            )}
                        </div>

                        {/* Modal List */}
                        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1.5 min-h-0">
                            {modalSourceItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                    <Search className="w-10 h-10 mb-3 opacity-50" />
                                    <p className="text-sm">
                                        {activeTab === 'sent' ? 'Eklenecek YouTuber bulunamadı.' : 'Mail gönderilmiş YouTuber bulunamadı.'}
                                    </p>
                                </div>
                            ) : (
                                modalSourceItems.map((youtuber) => (
                                    <div
                                        key={youtuber.id}
                                        onClick={() => toggleSelect(youtuber.id)}
                                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition border ${selectedIds.has(youtuber.id)
                                            ? 'bg-[#2d936c]/10 border-[#2d936c]/50 ring-1 ring-[#2d936c]/30'
                                            : 'bg-[#1e1e24] border-slate-700 hover:border-slate-600'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${selectedIds.has(youtuber.id) ? 'bg-[#2d936c] border-[#2d936c]' : 'border-slate-600'}`}>
                                            {selectedIds.has(youtuber.id) && <CheckCheck className="w-3.5 h-3.5 text-white" />}
                                        </div>

                                        {/* Photo */}
                                        {youtuber.photoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={youtuber.photoUrl}
                                                alt=""
                                                className="w-10 h-10 rounded-lg object-cover shrink-0"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-[#2b2b30] flex items-center justify-center shrink-0">
                                                <LinkIcon className="w-4 h-4 text-slate-500" />
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-200 truncate">{youtuber.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{youtuber.email}</p>
                                        </div>

                                        {/* Country */}
                                        {youtuber.country && (
                                            <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded shrink-0">{youtuber.country}</span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-5 border-t border-slate-700 flex items-center justify-between gap-3">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleAddSelected}
                                disabled={selectedIds.size === 0 || isUpdating}
                                className="flex items-center gap-2 px-5 py-2 bg-[#2d936c] text-white text-sm font-medium rounded-lg hover:bg-[#237a58] transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {isUpdating ? 'Ekleniyor...' : `Ekle (${selectedIds.size})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
