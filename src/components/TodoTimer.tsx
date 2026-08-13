"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { startTimer, pauseTimer, addManualTime } from "@/lib/timeTracking";
import { formatDurationShort, formatDurationClock } from "@/lib/timeFormatting";
import { TimeDetailsDialog } from "./TimeDetailsDialog";

interface TodoTimerProps {
    todo: {
        id: string;
        text: string;
        completed: boolean;
        totalTrackedSeconds?: number;
        timerTrackedSeconds?: number;
        manualTrackedSeconds?: number;
        firstStartedAt?: unknown;
    };
    pluginId: string;
    pluginName: string;
    currentUserId: string;
    currentUserName: string;
    activeTimer: { userId: string; pluginId: string; todoId: string; timeEntryId: string; startedAt: { toMillis: () => number } } | null;
    elapsedSeconds: number;
    isOwner: boolean;
}

export function TodoTimer({
    todo,
    pluginId,
    pluginName,
    currentUserId,
    currentUserName,
    activeTimer,
    elapsedSeconds,
    isOwner
}: TodoTimerProps) {
    const [actionLoading, setActionLoading] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const isThisTimerActive = activeTimer && activeTimer.pluginId === pluginId && activeTimer.todoId === todo.id;
    
    const totalTrackedSeconds = (todo.totalTrackedSeconds ?? 0) + (isThisTimerActive ? elapsedSeconds : 0);
    const hasTime = totalTrackedSeconds > 0;

    const handleToggleTimer = async () => {
        if (!isOwner || actionLoading) return;
        setActionLoading(true);

        try {
            if (isThisTimerActive) {
                await pauseTimer(currentUserId);
            } else {
                await startTimer(
                    currentUserId,
                    currentUserName,
                    pluginId,
                    pluginName,
                    todo.id,
                    todo.text
                );
            }
        } catch (error: unknown) {
             const msg = error instanceof Error ? error.message : "Bir hata oluştu.";
             alert(msg);
        } finally {
            setActionLoading(false);
        }
    };

    const handleQuickAdd = async (seconds: number) => {
        if (!isOwner || actionLoading) return;
        setActionLoading(true);
        try {
            await addManualTime(currentUserId, currentUserName, pluginId, todo.id, seconds, "Hızlı ekleme");
            setIsPopoverOpen(false);
        } catch (error: unknown) {
             const msg = error instanceof Error ? error.message : "Bir hata oluştu.";
             alert(msg);
        } finally {
            setActionLoading(false);
        }
    };

    // If completed and no time tracked, show quick add option
    if (todo.completed && !hasTime && isOwner) {
        return (
            <div className="relative">
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] text-slate-400 hover:text-[#a8e6cf] px-1 py-0"
                    onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                >
                    + Süre Ekle
                </Button>
                
                {isPopoverOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 p-2 bg-[#2b2b30] border border-slate-600 rounded-md shadow-xl z-50">
                        <div className="space-y-1">
                            <p className="text-xs text-slate-400 mb-2 px-1">Görev süresiz tamamlandı.</p>
                            <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs" onClick={() => handleQuickAdd(15 * 60)}>15 dakika</Button>
                            <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs" onClick={() => handleQuickAdd(30 * 60)}>30 dakika</Button>
                            <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs" onClick={() => handleQuickAdd(60 * 60)}>1 saat</Button>
                            <Button variant="ghost" size="sm" className="w-full justify-start h-7 text-xs" onClick={() => {setIsPopoverOpen(false); setIsDetailsOpen(true);}}>Özel Süre</Button>
                        </div>
                    </div>
                )}

                <TimeDetailsDialog
                    isOpen={isDetailsOpen}
                    onOpenChange={setIsDetailsOpen}
                    pluginId={pluginId}
                    todoId={todo.id}
                    todoText={todo.text}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    isOwner={isOwner}
                    totalTrackedSeconds={todo.totalTrackedSeconds ?? 0}
                    timerTrackedSeconds={todo.timerTrackedSeconds ?? 0}
                    manualTrackedSeconds={todo.manualTrackedSeconds ?? 0}
                    firstStartedAt={todo.firstStartedAt}
                />
            </div>
        );
    }

    if (todo.completed && !hasTime) return null;

    return (
        <div className="flex items-center gap-2">
            {!todo.completed && isOwner && (
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-6 w-6 rounded-full shrink-0",
                        isThisTimerActive ? "bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 hover:text-amber-400" : "bg-slate-700/50 text-slate-300 hover:bg-[#2d936c]/20 hover:text-[#2d936c]"
                    )}
                    onClick={handleToggleTimer}
                    disabled={actionLoading}
                    title={isThisTimerActive ? "Duraklat" : "Başlat"}
                >
                    {isThisTimerActive ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                </Button>
            )}
            
            {(hasTime || isThisTimerActive) && (
                <button
                    onClick={() => setIsDetailsOpen(true)}
                    className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-slate-700/50 transition-colors cursor-pointer",
                        isThisTimerActive ? "text-amber-400 bg-amber-500/10" : "text-slate-400"
                    )}
                    title="Çalışma süresi detayları"
                >
                    {isThisTimerActive ? (
                        <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-0.5" />
                            {formatDurationClock(elapsedSeconds)}
                        </>
                    ) : (
                        <>
                            <Clock className="w-3 h-3" />
                            {formatDurationShort(totalTrackedSeconds)}
                        </>
                    )}
                </button>
            )}

            <TimeDetailsDialog
                isOpen={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
                pluginId={pluginId}
                todoId={todo.id}
                todoText={todo.text}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                isOwner={isOwner}
                totalTrackedSeconds={todo.totalTrackedSeconds ?? 0}
                timerTrackedSeconds={todo.timerTrackedSeconds ?? 0}
                manualTrackedSeconds={todo.manualTrackedSeconds ?? 0}
                firstStartedAt={todo.firstStartedAt}
            />
        </div>
    );
}
