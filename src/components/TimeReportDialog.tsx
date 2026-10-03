"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatSavedDuration } from "@/lib/timeFormatting";

interface TimeReportDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    plugin: { id: string; name: string };
    members: Array<{ uid: string; displayName: string }>;
    todos: Array<{
        id: string;
        createdByUid: string;
        completed: boolean;
        totalTrackedSeconds?: number;
        timerTrackedSeconds?: number;
        manualTrackedSeconds?: number;
    }>;
}

export function TimeReportDialog({ isOpen, onOpenChange, plugin, members, todos }: TimeReportDialogProps) {
    if (!isOpen) return null;

    // Plugin totals
    const totalTrackedSeconds = todos.reduce((sum, t) => sum + (t.totalTrackedSeconds ?? 0), 0);
    const timerTrackedSeconds = todos.reduce((sum, t) => sum + (t.timerTrackedSeconds ?? 0), 0);
    const manualTrackedSeconds = todos.reduce((sum, t) => sum + (t.manualTrackedSeconds ?? 0), 0);
    const tasksWithTime = todos.filter(t => (t.totalTrackedSeconds ?? 0) > 0).length;
    const completedTasksWithoutTime = todos.filter(t => t.completed && (t.totalTrackedSeconds ?? 0) === 0).length;

    // Member calculations
    const memberStats = members.map(member => {
        const memberTodos = todos.filter(t => t.createdByUid === member.uid);
        const mTotal = memberTodos.reduce((sum, t) => sum + (t.totalTrackedSeconds ?? 0), 0);
        const mTimer = memberTodos.reduce((sum, t) => sum + (t.timerTrackedSeconds ?? 0), 0);
        const mManual = memberTodos.reduce((sum, t) => sum + (t.manualTrackedSeconds ?? 0), 0);
        const mTasksWithTime = memberTodos.filter(t => (t.totalTrackedSeconds ?? 0) > 0).length;
        const mCompletedWithoutTime = memberTodos.filter(t => t.completed && (t.totalTrackedSeconds ?? 0) === 0).length;
        const avg = mTasksWithTime > 0 ? Math.floor(mTotal / mTasksWithTime) : 0;
        
        return {
            uid: member.uid,
            name: member.displayName,
            total: mTotal,
            timer: mTimer,
            manual: mManual,
            tasksWithTime: mTasksWithTime,
            completedWithoutTime: mCompletedWithoutTime,
            avg,
            isFormer: false
        };
    });

    // Check for former members' tasks
    const activeMemberUids = new Set(members.map(m => m.uid));
    const formerMemberTodos = todos.filter(t => !activeMemberUids.has(t.createdByUid));
    
    if (formerMemberTodos.length > 0) {
        const fTotal = formerMemberTodos.reduce((sum, t) => sum + (t.totalTrackedSeconds ?? 0), 0);
        if (fTotal > 0) {
             const fTimer = formerMemberTodos.reduce((sum, t) => sum + (t.timerTrackedSeconds ?? 0), 0);
             const fManual = formerMemberTodos.reduce((sum, t) => sum + (t.manualTrackedSeconds ?? 0), 0);
             const fTasksWithTime = formerMemberTodos.filter(t => (t.totalTrackedSeconds ?? 0) > 0).length;
             const fCompletedWithoutTime = formerMemberTodos.filter(t => t.completed && (t.totalTrackedSeconds ?? 0) === 0).length;
             const fAvg = fTasksWithTime > 0 ? Math.floor(fTotal / fTasksWithTime) : 0;
             
             memberStats.push({
                 uid: "former_members",
                 name: "Eski Üyeler",
                 total: fTotal,
                 timer: fTimer,
                 manual: fManual,
                 tasksWithTime: fTasksWithTime,
                 completedWithoutTime: fCompletedWithoutTime,
                 avg: fAvg,
                 isFormer: true
             });
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="flex w-[calc(100vw-24px)] max-w-[960px] max-h-[min(90dvh,900px)] min-w-0 flex-col gap-3 overflow-hidden rounded-xl border-slate-600 bg-[#2b2b30] p-4 text-white sm:max-w-[960px] md:gap-4 md:p-6">
                <DialogHeader className="shrink-0 pr-8 text-left">
                    <DialogTitle className="text-lg leading-snug font-bold md:text-2xl">Çalışma Süreleri Raporu</DialogTitle>
                </DialogHeader>
                
                <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1 md:space-y-6 md:pr-2">
                    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
                        <div className="col-span-2 min-w-0 rounded-xl border border-[#2d936c]/40 bg-[#1e1e24] p-3 sm:col-span-1 sm:p-4">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">TOPLAM</span>
                            <span className="mt-1 block break-words text-lg leading-tight font-bold text-[#a8e6cf] md:text-2xl">{formatSavedDuration(totalTrackedSeconds)}</span>
                        </div>
                        <div className="min-w-0 rounded-xl border border-slate-700 bg-[#1e1e24] p-3 sm:p-4">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">SAYAÇ</span>
                            <span className="mt-1 block break-words text-base leading-tight font-medium md:text-2xl">{formatSavedDuration(timerTrackedSeconds)}</span>
                        </div>
                        <div className="min-w-0 rounded-xl border border-slate-700 bg-[#1e1e24] p-3 sm:p-4">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">MANUEL</span>
                            <span className="mt-1 block break-words text-base leading-tight font-medium md:text-2xl">{formatSavedDuration(manualTrackedSeconds)}</span>
                        </div>
                        <div className="min-w-0 rounded-xl border border-slate-700 bg-[#1e1e24] p-3 sm:p-4">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">SÜRELİ</span>
                            <span className="mt-1 block text-lg font-medium md:text-2xl">{tasksWithTime}</span>
                        </div>
                        <div className="min-w-0 rounded-xl border border-slate-700 bg-[#1e1e24] p-3 sm:p-4">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">SÜRESİZ</span>
                            <span className="mt-1 block text-lg font-medium text-amber-400 md:text-2xl">{completedTasksWithoutTime}</span>
                        </div>
                    </div>

                    <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                        {memberStats.map(stat => (
                            <div key={stat.uid} className="flex h-full min-w-0 flex-col rounded-xl border border-slate-700 bg-[#1e1e24] p-3 sm:p-4">
                                <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-slate-700/50 pb-3">
                                    <h3 className="min-w-0 break-words text-lg font-bold text-white">
                                        {stat.name}
                                        {stat.isFormer && <span className="ml-2 text-xs font-normal text-slate-500">(Kaldırılmış)</span>}
                                    </h3>
                                    <div className="min-w-0 text-right">
                                        <span className="block text-xs text-slate-400">Toplam</span>
                                        <span className="block break-words font-bold text-[#a8e6cf]">{formatSavedDuration(stat.total)}</span>
                                    </div>
                                </div>
                                
                                <div className="mt-auto grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 text-sm sm:gap-x-4">
                                    <div className="min-w-0">
                                        <span className="text-slate-400">Sayaç</span>
                                        <span className="block break-words font-medium leading-snug text-slate-200">{formatSavedDuration(stat.timer)}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-slate-400">Süreli</span>
                                        <span className="block font-medium text-slate-200">{stat.tasksWithTime}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-slate-400">Manuel</span>
                                        <span className="block break-words font-medium leading-snug text-slate-200">{formatSavedDuration(stat.manual)}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-slate-400">Süresiz</span>
                                        <span className="block font-medium text-amber-400/80">{stat.completedWithoutTime}</span>
                                    </div>
                                    <div className="col-span-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-slate-700/30 pt-2">
                                        <span className="text-xs text-slate-400">Görev Başı Ortalama</span>
                                        <span className="break-words font-medium text-slate-300">{formatSavedDuration(stat.avg)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
