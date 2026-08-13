"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { TimeEntry } from "@/types/timeTracking";
import { formatDurationClock, formatDurationShort } from "@/lib/timeFormatting";
import { addManualTime, deleteTimeEntry } from "@/lib/timeTracking";
import { Trash2 } from "lucide-react";

interface TimeDetailsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    pluginId: string;
    todoId: string;
    todoText: string;
    currentUserId: string;
    currentUserName: string;
    isOwner: boolean;
    totalTrackedSeconds: number;
    timerTrackedSeconds: number;
    manualTrackedSeconds: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    firstStartedAt: any;
}

export function TimeDetailsDialog({
    isOpen,
    onOpenChange,
    pluginId,
    todoId,
    todoText,
    currentUserId,
    currentUserName,
    isOwner,
    totalTrackedSeconds,
    timerTrackedSeconds,
    manualTrackedSeconds,
    firstStartedAt
}: TimeDetailsDialogProps) {
    const [entries, setEntries] = useState<(TimeEntry & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAddingManual, setIsAddingManual] = useState(false);
    const [manualHours, setManualHours] = useState("");
    const [manualMinutes, setManualMinutes] = useState("");
    const [manualNote, setManualNote] = useState("");
    const [submittingManual, setSubmittingManual] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        const q = query(
            collection(db, "plugins", pluginId, "todos", todoId, "timeEntries"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeEntry & { id: string }));
            setEntries(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, pluginId, todoId]);

    const handleAddManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const h = parseInt(manualHours || "0", 10);
        const m = parseInt(manualMinutes || "0", 10);

        if (isNaN(h) || isNaN(m) || h < 0 || m < 0) {
            setError("Geçerli pozitif sayılar giriniz.");
            return;
        }

        const totalSeconds = (h * 3600) + (m * 60);

        if (totalSeconds <= 0) {
            setError("Süre 0'dan büyük olmalıdır.");
            return;
        }
        
        if (totalSeconds > 24 * 3600) {
             setError("Tek seferde 24 saatten fazla süre giremezsiniz.");
             return;
        }

        setSubmittingManual(true);
        try {
            await addManualTime(currentUserId, currentUserName, pluginId, todoId, totalSeconds, manualNote);
            setIsAddingManual(false);
            setManualHours("");
            setManualMinutes("");
            setManualNote("");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Hata oluştu.";
            setError(msg);
        } finally {
            setSubmittingManual(false);
        }
    };

    const formatTimestamp = (ts: { toDate?: () => Date } | null | undefined | string | number | Date) => {
        if (!ts) return "-";
        const d = (ts as { toDate?: () => Date }).toDate ? (ts as { toDate?: () => Date }).toDate!() : new Date(ts as string | number | Date);
        return new Intl.DateTimeFormat('tr-TR', { 
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
        }).format(d);
    };

    const handleDeleteEntry = async (entry: TimeEntry & { id: string }) => {
        if (!isOwner) return;
        if (entry.status === 'running') {
            alert("Çalışan bir süreyi silemezsiniz. Lütfen önce durdurun.");
            return;
        }
        if (!window.confirm("Bu zaman kaydını silmek istediğinize emin misiniz?")) return;
        
        try {
            await deleteTimeEntry(currentUserId, pluginId, todoId, entry.id);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Hata oluştu.";
            alert(msg);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-md bg-[#2b2b30] border-slate-600 text-white max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Çalışma Süresi Detayları</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    <div className="bg-[#1e1e24] p-3 rounded-lg border border-slate-700 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Toplam:</span>
                            <span className="font-bold text-white">{formatDurationShort(totalTrackedSeconds)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Sayaç:</span>
                            <span>{formatDurationShort(timerTrackedSeconds)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Manuel:</span>
                            <span>{formatDurationShort(manualTrackedSeconds)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">İlk başlama:</span>
                            <span>{formatTimestamp(firstStartedAt)}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                        <h4 className="text-sm font-semibold text-slate-300">Zaman Geçmişi</h4>
                        {isOwner && !isAddingManual && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs border-slate-600 text-slate-300 hover:text-white"
                                onClick={() => setIsAddingManual(true)}
                            >
                                + Süre Ekle
                            </Button>
                        )}
                    </div>

                    {isAddingManual && (
                        <form onSubmit={handleAddManualSubmit} className="bg-[#1e1e24] p-3 rounded-lg border border-slate-600 space-y-3">
                            <h5 className="text-sm font-medium">Manuel Süre Ekle</h5>
                            <div className="flex gap-2">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-slate-400">Saat</Label>
                                    <Input 
                                        type="number" 
                                        min="0"
                                        value={manualHours}
                                        onChange={(e) => setManualHours(e.target.value)}
                                        className="h-8 bg-[#2b2b30] border-slate-600"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-slate-400">Dakika</Label>
                                    <Input 
                                        type="number" 
                                        min="0"
                                        value={manualMinutes}
                                        onChange={(e) => setManualMinutes(e.target.value)}
                                        className="h-8 bg-[#2b2b30] border-slate-600"
                                        placeholder="30"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-400">Not (İsteğe bağlı)</Label>
                                <Input 
                                    value={manualNote}
                                    onChange={(e) => setManualNote(e.target.value)}
                                    className="h-8 bg-[#2b2b30] border-slate-600"
                                    placeholder="örn: Dünkü çalışma"
                                />
                            </div>
                            {error && <p className="text-red-400 text-xs">{error}</p>}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7"
                                    onClick={() => setIsAddingManual(false)}
                                >
                                    İptal
                                </Button>
                                <Button 
                                    type="submit" 
                                    size="sm" 
                                    className="h-7 bg-[#2d936c] hover:bg-[#237a58]"
                                    disabled={submittingManual}
                                >
                                    {submittingManual ? "Ekleniyor..." : "Kaydet"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {loading ? (
                        <p className="text-xs text-slate-500 text-center">Yükleniyor...</p>
                    ) : entries.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center">Geçmiş bulunmuyor.</p>
                    ) : (
                        <div className="space-y-2">
                            {entries.map(entry => (
                                <div key={entry.id} className="bg-[#1e1e24] p-2 rounded border border-slate-700/50 text-sm flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-slate-300">
                                            {formatTimestamp(entry.startedAt || entry.createdAt)}
                                            {entry.endedAt && entry.startedAt ? ` - ${new Intl.DateTimeFormat('tr-TR', {hour: '2-digit', minute: '2-digit'}).format(entry.endedAt.toDate ? entry.endedAt.toDate() : new Date(entry.endedAt as any))}` : ""}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {entry.source === 'timer' ? 'Sayaç' : entry.source === 'manual' ? 'Manuel' : 'Kurtarma'}
                                            {entry.note ? ` · ${entry.note}` : ''}
                                            {entry.status === 'running' ? ' · Çalışıyor' : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-medium text-[#a8e6cf]">
                                            {entry.status === 'running' ? "..." : formatDurationShort(entry.durationSeconds)}
                                        </span>
                                        {isOwner && entry.status !== 'running' && (
                                            <button 
                                                onClick={() => handleDeleteEntry(entry)}
                                                className="text-slate-500 hover:text-red-400 p-1"
                                                title="Sil"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="flex justify-end pt-3 border-t border-slate-700 shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-500 text-slate-300 hover:bg-slate-700">
                        Kapat
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
