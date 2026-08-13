"use client";

import { useEffect, useState } from "react";
import { formatRunningDuration } from "@/lib/timeFormatting";
import { pauseTimer, completeTodoWithTimerCheck, stopAndAddManualTime } from "@/lib/timeTracking";
import { Button } from "@/components/ui/button";
import { Pause, CheckCircle2, ChevronRight, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/components/Toaster";

interface ActiveTimerBarProps {
    currentUserId: string;
    currentUserName: string;
    activeTimer: any;
    elapsedSeconds: number;
    currentPluginId: string;
}

export function ActiveTimerBar({
    currentUserId,
    currentUserName,
    activeTimer,
    elapsedSeconds,
    currentPluginId
}: ActiveTimerBarProps) {
    const router = useRouter();
    const [actionLoading, setActionLoading] = useState(false);
    const [recoveryOpen, setRecoveryOpen] = useState(false);
    
    // Recovery states
    const [recoveryType, setRecoveryType] = useState<"stop_now" | "custom_time" | "cancel" | null>(null);
    const [customDate, setCustomDate] = useState("");
    const [customTime, setCustomTime] = useState("");

    const isLongTimer = elapsedSeconds > 8 * 3600; // > 8 hours

    useEffect(() => {
        if (isLongTimer && !recoveryOpen && activeTimer) {
             setRecoveryOpen(true);
        }
    }, [isLongTimer, activeTimer, recoveryOpen]);

    if (!activeTimer) return null;

    const handlePause = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            await pauseTimer(currentUserId);
        } catch (e: any) {
            toast(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleComplete = async () => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            await completeTodoWithTimerCheck(
                currentUserId, 
                activeTimer.pluginId, 
                activeTimer.todoId, 
                activeTimer.todoText, 
                currentUserName
            );
        } catch (e: any) {
            toast(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const navigateToTask = () => {
        if (activeTimer.pluginId !== currentPluginId) {
            router.push(`/plugin/${activeTimer.pluginId}`);
        } else {
             // Scroll to task if in same plugin, basic implementation
             const el = document.getElementById(`todo-${activeTimer.todoId}`);
             if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    };

    const handleRecoverySubmit = async () => {
        if (!recoveryType || actionLoading) return;
        setActionLoading(true);

        try {
            if (recoveryType === "stop_now") {
                 await stopAndAddManualTime(currentUserId, activeTimer.pluginId, activeTimer.todoId, Date.now());
            } else if (recoveryType === "cancel") {
                 await stopAndAddManualTime(currentUserId, activeTimer.pluginId, activeTimer.todoId, Date.now(), true);
            } else if (recoveryType === "custom_time") {
                 if (!customDate || !customTime) throw new Error("Tarih ve saat seçiniz.");
                 const endDateTime = new Date(`${customDate}T${customTime}`);
                 if (isNaN(endDateTime.getTime())) throw new Error("Geçersiz tarih.");
                 
                 const startedAt = activeTimer.startedAt.toMillis();
                 if (endDateTime.getTime() <= startedAt) throw new Error("Bitiş zamanı başlangıçtan önce olamaz.");
                 
                 await stopAndAddManualTime(currentUserId, activeTimer.pluginId, activeTimer.todoId, endDateTime.getTime());
            }
            setRecoveryOpen(false);
        } catch (e: any) {
            toast(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const formatRecoveryTime = () => {
        const h = Math.floor(elapsedSeconds / 3600);
        const m = Math.floor((elapsedSeconds % 3600) / 60);
        return `${h} saat ${m} dakika`;
    };

    return (
        <>
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#2b2b30] border border-[#2d936c]/50 rounded-full shadow-lg shadow-black/50 px-4 py-2 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
                <div className="flex flex-col">
                    <span className="text-[10px] text-[#a8e6cf] font-medium uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Çalışılıyor
                    </span>
                    <button onClick={navigateToTask} className="text-sm font-semibold text-white hover:underline text-left truncate max-w-[150px] md:max-w-[250px]">
                        {activeTimer.todoText}
                    </button>
                    {activeTimer.pluginId !== currentPluginId && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]">{activeTimer.pluginName}</span>
                    )}
                </div>

                <div className="flex flex-col items-center justify-center mx-4">
                    <div className="text-xl font-mono text-amber-400 font-medium leading-none">
                        {formatRunningDuration((activeTimer.baseTrackedSeconds ?? 0) + elapsedSeconds)}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1">
                        Bu oturum: {formatRunningDuration(elapsedSeconds)}
                    </span>
                </div>

                <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400"
                        onClick={handlePause}
                        disabled={actionLoading}
                    >
                        <Pause className="w-4 h-4 mr-1" />
                        <span className="hidden md:inline">Duraklat</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 bg-[#2d936c]/10 text-[#2d936c] hover:bg-[#2d936c]/20 hover:text-[#237a58]"
                        onClick={handleComplete}
                        disabled={actionLoading}
                    >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        <span className="hidden md:inline">Tamamla</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-white md:hidden"
                        onClick={navigateToTask}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <Dialog open={recoveryOpen} onOpenChange={(open) => {
                // If they close it without deciding, they are implicitly choosing to keep running
                if (!open) setRecoveryOpen(false);
            }}>
                <DialogContent className="bg-[#2b2b30] border-amber-500/50 text-white w-[95vw] max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle className="w-5 h-5" />
                            Unutulan Sayaç Kurtarma
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <p className="text-sm text-slate-300">
                            Bu sayaç <strong>{formatRecoveryTime()}</strong>dır çalışıyor. Durdurmayı unutmuş olabilirsiniz.
                        </p>
                        
                        <div className="space-y-2">
                            <Button 
                                variant={recoveryType === "stop_now" ? "default" : "outline"}
                                className={cn("w-full justify-start border-slate-600", recoveryType === "stop_now" && "bg-amber-600 hover:bg-amber-700")}
                                onClick={() => setRecoveryType("stop_now")}
                            >
                                Şimdi durdur (Geçen tüm süreyi kaydet)
                            </Button>
                            
                            <div className="space-y-2">
                                <Button 
                                    variant={recoveryType === "custom_time" ? "default" : "outline"}
                                    className={cn("w-full justify-start border-slate-600", recoveryType === "custom_time" && "bg-[#2d936c] hover:bg-[#237a58]")}
                                    onClick={() => setRecoveryType("custom_time")}
                                >
                                    Bitiş zamanını seç
                                </Button>
                                {recoveryType === "custom_time" && (
                                    <div className="flex gap-2 p-3 bg-[#1e1e24] rounded-md border border-slate-700 animate-in slide-in-from-top-2">
                                        <input 
                                            type="date" 
                                            value={customDate}
                                            onChange={e => setCustomDate(e.target.value)}
                                            className="bg-[#2b2b30] border-slate-600 rounded px-2 py-1 text-sm flex-1 [color-scheme:dark]" 
                                        />
                                        <input 
                                            type="time" 
                                            value={customTime}
                                            onChange={e => setCustomTime(e.target.value)}
                                            className="bg-[#2b2b30] border-slate-600 rounded px-2 py-1 text-sm flex-1 [color-scheme:dark]" 
                                        />
                                    </div>
                                )}
                            </div>

                            <Button 
                                variant={recoveryType === "cancel" ? "default" : "outline"}
                                className={cn("w-full justify-start border-slate-600", recoveryType === "cancel" && "bg-red-600 hover:bg-red-700")}
                                onClick={() => setRecoveryType("cancel")}
                            >
                                Kaydı iptal et (Süreyi sil)
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-between mt-6">
                        <Button variant="ghost" onClick={() => setRecoveryOpen(false)} className="text-slate-400 hover:text-white">
                            Çalışmaya devam ediyorum
                        </Button>
                        <Button 
                            onClick={handleRecoverySubmit} 
                            disabled={!recoveryType || actionLoading}
                            className="bg-white text-black hover:bg-slate-200"
                        >
                            Uygula
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
