'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, query, orderBy, deleteDoc, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ArrowLeft, Plus, Loader2, Search, Trash2, Mail, Link as LinkIcon, Users, UserPlus, ShieldAlert, Download, Globe, Send, MessageCircle, CheckCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function YoutubersPage() {
    const [user, setUser] = useState<User | null>(null);
    const [isUlas, setIsUlas] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [members, setMembers] = useState<{ uid: string, displayName?: string }[]>([]);

    const [youtubers, setYoutubers] = useState<Youtuber[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [filter, setFilter] = useState<'all' | 'found' | 'empty'>('all');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    // Bulk add state
    const [showBulkAdd, setShowBulkAdd] = useState(false);
    const [bulkInput, setBulkInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [failedLinks, setFailedLinks] = useState<{ url: string, reason: string }[]>([]);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editEmail, setEditEmail] = useState('');
    const [editCountry, setEditCountry] = useState('');

    // Member management state
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [newMemberName, setNewMemberName] = useState("");
    const [addingMember, setAddingMember] = useState(false);
    const [addMemberError, setAddMemberError] = useState("");

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
        setIsUlas(isUserUlas);

        // Listen to YouTubers members collection
        let unsubscribeMembers = () => { };

        if (isUserUlas) {
            setHasAccess(true);
            const membersQ = query(collection(db, "youtubers_members"));
            unsubscribeMembers = onSnapshot(membersQ, (snapshot) => {
                const membersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as { uid: string, displayName?: string }));
                setMembers(membersData);
            });
        } else {
            const memberDocRef = doc(db, "youtubers_members", user.uid);
            unsubscribeMembers = onSnapshot(memberDocRef, (docSnap) => {
                setHasAccess(docSnap.exists());
            });
        }

        return () => unsubscribeMembers();
    }, [user]);

    // Fetch youtubers on mount (only if access is granted)
    useEffect(() => {
        if (!hasAccess) {
            if (user) setLoading(false);
            return;
        }

        const q = query(collection(db, 'youtubers'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Youtuber[];
            setYoutubers(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [hasAccess, user]);

    // Filtered list
    const filteredYoutubers = youtubers.filter(y => {
        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchesName = (y.name || '').toLowerCase().includes(q);
            const matchesEmail = (y.email || '').toLowerCase().includes(q);
            const matchesCountry = (y.country || '').toLowerCase().includes(q);
            if (!matchesName && !matchesEmail && !matchesCountry) return false;
        }

        // Tab filter
        if (filter === 'all') return true;
        if (filter === 'found') return y.email && y.email.trim() !== '' && (!y.mailStatus || y.mailStatus === '');
        if (filter === 'empty') return !y.email || y.email.trim() === '';
        return true;
    });

    // Counts for filter tabs
    const countAll = youtubers.length;
    const countFound = youtubers.filter(y => y.email && y.email.trim() !== '' && (!y.mailStatus || y.mailStatus === '')).length;
    const countEmpty = youtubers.filter(y => !y.email || y.email.trim() === '').length;


    const handleBulkAdd = async () => {
        if (!bulkInput.trim()) return;

        setIsProcessing(true);
        setFailedLinks([]); // reset earlier errors

        // Split by lines and remove empty lines and white spaces
        const lines = bulkInput.split('\n').map(line => line.trim()).filter(line => line !== '');

        // 1. Filter out URLs that already exist in our state to prevent duplicates
        const existingUrls = new Set(youtubers.map(y => y.url.toLowerCase()));
        const newUrls: string[] = [];
        const duplicates: string[] = [];

        for (const line of lines) {
            if (existingUrls.has(line.toLowerCase())) {
                duplicates.push(line);
            } else {
                newUrls.push(line);
            }
        }

        const currentFailures = duplicates.map(url => ({
            url,
            reason: 'Zaten ekli'
        }));

        if (newUrls.length === 0) {
            if (currentFailures.length > 0) {
                setFailedLinks(currentFailures);
            }
            setIsProcessing(false);
            return;
        }

        try {
            const res = await fetch('/api/youtuber-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: newUrls })
            });

            const data = await res.json();

            if (data.results) {
                const batchPromises = data.results.map(async (result: { status: string, url: string, name?: string, photoUrl?: string, email?: string, country?: string }) => {
                    if (result.status === 'success') {
                        const newDocRef = doc(collection(db, 'youtubers'));
                        return setDoc(newDocRef, {
                            url: result.url,
                            name: result.name || result.url,
                            photoUrl: result.photoUrl || '',
                            email: result.email || '',
                            country: result.country || '',
                            mailStatus: '',
                            createdAt: Date.now()
                        });
                    } else {
                        currentFailures.push({
                            url: result.url,
                            reason: 'Bilgiler alınamadı veya geçersiz link'
                        });
                    }
                });

                await Promise.all(batchPromises);

                setBulkInput('');
                if (currentFailures.length > 0) {
                    setFailedLinks(currentFailures);
                } else {
                    setShowBulkAdd(false);
                }
            }
        } catch (error) {
            console.error('Error adding youtubers:', error);
            alert('Bir hata oluştu. Linkleri kontrol edip tekrar deneyin.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim()) return;

        setAddingMember(true);
        setAddMemberError("");

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("displayName", "==", newMemberName.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setAddMemberError("Kullanıcı bulunamadı.");
                setAddingMember(false);
                return;
            }

            const userToAdd = querySnapshot.docs[0];
            const userData = userToAdd.data();

            if (members.find(m => m.uid === userToAdd.id)) {
                setAddMemberError("Kullanıcı zaten üye.");
                setAddingMember(false);
                return;
            }

            await setDoc(doc(db, "youtubers_members", userToAdd.id), {
                displayName: userData.displayName,
                joinedAt: serverTimestamp(),
            });

            setNewMemberName("");
        } catch (error) {
            console.error("Error adding member:", error);
            setAddMemberError("Kullanıcı eklenemedi.");
        } finally {
            setAddingMember(false);
        }
    };

    const saveEmail = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const ref = doc(db, 'youtubers', id);
            await setDoc(ref, { email: editEmail }, { merge: true });
            setEditingId(null);
        } catch (error) {
            console.error('Error saving email:', error);
        }
    };

    const decodeHTML = (str: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    };

    const handleCopyYoutubers = () => {
        const header = 'First Name,E-Mail';

        // Deduplicate by email
        const emailMap = new Map<string, Youtuber[]>();
        filteredYoutubers.forEach(y => {
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
        a.download = `youtubers_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const deleteYoutuber = async (id: string, name: string) => {
        if (!confirm(`"${name}" kanalını silmek istediğinize emin misiniz?`)) return;
        try {
            await deleteDoc(doc(db, 'youtubers', id));
        } catch (error) {
            console.error('Error deleting youtuber:', error);
        }
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
                <p className="text-slate-400 text-center max-w-md">
                    Bu sayfaya giriş yetkiniz bulunmuyor.
                </p>
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
                            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl font-bold text-[#a8e6cf] tracking-wide">YouTubers</h1>
                        </div>

                        <div className="flex items-center gap-3">
                            {isUlas && (
                                <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 hidden sm:flex">
                                            <Users className="w-4 h-4 mr-2" />
                                            Üyeler ({members.length})
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[95vw] max-w-lg rounded-lg">
                                        <DialogHeader>
                                            <DialogTitle>Üyeleri Yönet</DialogTitle>
                                        </DialogHeader>

                                        <div className="space-y-6 mt-4">
                                            {/* Member List */}
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {members.map(member => (
                                                    <div key={member.uid} className="flex items-center justify-between p-2 bg-[#1e1e24] rounded border border-slate-700">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-slate-200">{member.displayName}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {members.length === 0 && <p className="text-sm text-slate-500">Henüz üye eklenmedi.</p>}
                                            </div>

                                            {/* Add Member (Owner only) */}
                                            {isUlas && (
                                                <div className="space-y-3 pt-4 border-t border-slate-700">
                                                    <h4 className="text-sm font-medium text-slate-400">Yeni Üye Ekle</h4>
                                                    <form onSubmit={handleAddMember} className="flex gap-2">
                                                        <Input
                                                            placeholder="Kullanıcı adı girin..."
                                                            value={newMemberName}
                                                            onChange={(e) => setNewMemberName(e.target.value)}
                                                            className="bg-[#1e1e24] border-slate-600 text-base"
                                                        />
                                                        <Button type="submit" className="bg-[#2d936c] hover:bg-[#237a58] text-white" disabled={addingMember}>
                                                            {addingMember ? "Ekleniyor..." : <UserPlus className="w-4 h-4" />}
                                                        </Button>
                                                    </form>
                                                    {addMemberError && <p className="text-red-400 text-sm">{addMemberError}</p>}
                                                </div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )}

                            <Link href="/youtubers/mail">
                                <button
                                    className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] text-white font-medium rounded-lg hover:bg-[#4f46e5] transition shadow-sm"
                                >
                                    <Mail className="w-4 h-4" />
                                    <span>Mail</span>
                                </button>
                            </Link>

                            <button
                                onClick={handleCopyYoutubers}
                                className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white font-medium rounded-lg hover:bg-[#2563eb] transition shadow-sm"
                                title="Tüm YouTuber bilgilerini CSV olarak indir"
                            >
                                <Download className="w-4 h-4" />
                                <span>Copy YouTubers</span>
                            </button>

                            <button
                                onClick={() => setShowBulkAdd(!showBulkAdd)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#2d936c] text-white font-medium rounded-lg hover:bg-[#237a58] transition shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Toplu Ekle</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col">

                {/* Bulk Add Section */}
                {showBulkAdd && (
                    <div className="mb-8 bg-[#2b2b30] p-6 rounded-xl border border-slate-700 shadow-sm transition-all">
                        <h2 className="text-lg font-semibold text-white mb-2">Toplu Kanal Ekle</h2>
                        <p className="text-sm text-slate-400 mb-4">Her satıra bir YouTube kanalı linki yapıştırın (Örn: 150 linki alt alta yapıştırabilirsiniz).</p>
                        <textarea
                            className="w-full h-48 p-4 bg-[#1e1e24] border border-slate-600 rounded-lg focus:ring-2 focus:ring-[#2d936c] focus:border-[#2d936c] mb-4 text-sm font-mono text-slate-200 shadow-inner resize-none"
                            placeholder="https://youtube.com/@mkbhd&#10;https://youtube.com/@mrbeast"
                            value={bulkInput}
                            onChange={(e) => setBulkInput(e.target.value)}
                            disabled={isProcessing}
                        />

                        {failedLinks.length > 0 && (
                            <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                                <p className="font-semibold mb-2">Bazı linkler eklenemedi:</p>
                                <ul className="list-disc pl-5 space-y-1 max-h-32 overflow-y-auto">
                                    {failedLinks.map((f, i) => (
                                        <li key={i}>{f.url} <span className="opacity-75">({f.reason})</span></li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowBulkAdd(false)}
                                className="px-4 py-2 text-gray-700 font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                                disabled={isProcessing}
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleBulkAdd}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 font-medium text-white rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
                                disabled={isProcessing || !bulkInput.trim()}
                            >
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                <span>{isProcessing ? 'İşleniyor...' : 'Ekle'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Search Bar */}
                <div className="mb-6 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="YouTuber ara (isim, email, ülke)..."
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

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-8 items-center">
                    {/* Left filters */}
                    <div className="flex gap-1 bg-[#2b2b30] p-1.5 rounded-xl border border-slate-700 shadow-sm">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'all' ? 'bg-[#1e1e24] text-white shadow ring-1 ring-slate-600' : 'bg-transparent text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                        >
                            Hepsi <span className="ml-1 opacity-70 text-xs">({countAll})</span>
                        </button>
                        <button
                            onClick={() => setFilter('found')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'found' ? 'bg-green-600/20 text-green-400 shadow ring-1 ring-green-600/50' : 'bg-transparent text-slate-400 hover:text-green-400 hover:bg-green-600/10'
                                }`}
                        >
                            Bulundu <span className="ml-1 opacity-70 text-xs">({countFound})</span>
                        </button>
                        <button
                            onClick={() => setFilter('empty')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'empty' ? 'bg-amber-500/20 text-amber-400 shadow ring-1 ring-amber-500/50' : 'bg-transparent text-slate-400 hover:text-amber-400 hover:bg-amber-500/10'
                                }`}
                        >
                            Boş <span className="ml-1 opacity-70 text-xs">({countEmpty})</span>
                        </button>
                    </div>


                </div>

                {/* Grid */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-[#2d936c]" />
                        <p className="text-slate-400 font-medium animate-pulse">Kanallar yükleniyor...</p>
                    </div>
                ) : filteredYoutubers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 border-2 border-dashed border-slate-700 rounded-2xl bg-[#2b2b30]/50">
                        <Search className="w-16 h-16 mb-4 text-slate-600" />
                        <p className="text-xl font-medium text-slate-300 mb-2">Gösterilecek kanal yok</p>
                        <p className="text-sm text-slate-500">Filtreyi değiştirin veya &quot;Toplu Ekle&quot; ile yeni kanallar ekleyin.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                        {filteredYoutubers.map((youtuber) => (
                            <div
                                key={youtuber.id}
                                className={`bg-[#2b2b30] border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col ${editingId === youtuber.id ? 'ring-2 ring-[#2d936c] border-[#2d936c]' : 'border-slate-700'
                                    }`}
                            >
                                {/* Photo (Link to channel) */}
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
                                            alt="" // purely decorative, name is below
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-[#2b2b30] flex flex-col items-center justify-center text-slate-500 p-4">
                                            <LinkIcon className="w-8 h-8 mb-2 opacity-50" />
                                            <span className="text-xs font-medium text-center truncate w-full opacity-70">{youtuber.url}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Status Indicator over image */}
                                    {(youtuber.email && youtuber.email.trim() !== '') && (
                                        <div className="absolute top-3 left-3 bg-green-500 text-white rounded-full p-1.5 shadow-md">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </a>

                                {/* Content */}
                                <div className="p-4 flex flex-col flex-1 bg-[#2b2b30]">
                                    {/* Name Toggle */}
                                    <div
                                        onClick={() => {
                                            if (editingId === youtuber.id) {
                                                setEditingId(null);
                                            } else {
                                                setEditingId(youtuber.id);
                                                setEditEmail(youtuber.email);
                                                setEditCountry(youtuber.country || '');
                                            }
                                        }}
                                        className="flex-1 flex flex-col w-full text-left outline-none cursor-pointer group/title"
                                    >
                                        <h3 className="font-semibold text-slate-200 group-hover/title:text-[#a8e6cf] transition-colors line-clamp-1 leading-snug mb-2" title={youtuber.name}>
                                            {youtuber.name}
                                        </h3>

                                        {/* Status Badge */}
                                        <div className="w-full flex flex-col gap-1.5 text-sm">
                                            {(youtuber.email && youtuber.email.trim() !== '') ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 font-medium">
                                                    <span className="truncate max-w-[150px]">{youtuber.email}</span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 font-medium">
                                                    Bilgi eksik
                                                </span>
                                            )}
                                            {youtuber.country && youtuber.country.trim() !== '' && (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 font-medium">
                                                    <Globe className="w-3 h-3" />
                                                    <span className="truncate max-w-[150px]">{youtuber.country}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Edit Section */}
                                    {editingId === youtuber.id && (
                                        <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col gap-3 animate-in slide-in-from-top-2">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">İletişim Bilgisi / Not</label>
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Örn: test@mail.com veya notunuz..."
                                                className="w-full px-3 py-2 text-sm bg-[#1e1e24] border border-slate-600 text-slate-200 rounded-lg focus:ring-2 focus:ring-[#2d936c] focus:border-[#2d936c] outline-none transition-shadow"
                                                value={editEmail}
                                                onChange={(e) => setEditEmail(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEmail(youtuber.id, e as any);
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                                                    className="flex-1 py-1.5 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 transition"
                                                >
                                                    İptal
                                                </button>
                                                <button
                                                    onClick={(e) => saveEmail(youtuber.id, e)}
                                                    className="flex-1 py-1.5 text-sm font-medium text-white bg-[#2d936c] rounded-lg hover:bg-[#237a58] transition"
                                                >
                                                    Kaydet
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Card actions */}
                                    <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-end gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteYoutuber(youtuber.id, youtuber.name);
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1.5 rounded-md transition"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Sil
                                        </button>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
