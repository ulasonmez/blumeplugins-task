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
            <DialogContent className="w-[calc(100vw-32px)] max-w-[960px] sm:max-w-[960px] bg-[#2b2b30] border-slate-600 text-white max-h-[90vh] flex flex-col p-4 md:p-6">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-xl md:text-2xl font-bold">Çalışma Süreleri Raporu</DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto pr-1 md:pr-2 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="bg-[#1e1e24] p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">TOPLAM</span>
                            <span className="text-xl md:text-2xl font-bold text-[#a8e6cf] mt-1 whitespace-nowrap">{formatSavedDuration(totalTrackedSeconds)}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">SAYAÇ</span>
                            <span className="text-xl md:text-2xl font-medium mt-1 whitespace-nowrap">{formatSavedDuration(timerTrackedSeconds)}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">MANUEL</span>
                            <span className="text-xl md:text-2xl font-medium mt-1 whitespace-nowrap">{formatSavedDuration(manualTrackedSeconds)}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">SÜRELİ</span>
                            <span className="text-xl md:text-2xl font-medium mt-1 whitespace-nowrap">{tasksWithTime}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                            <span className="text-xs font-bold text-slate-400 tracking-wider">SÜRESİZ</span>
                            <span className="text-xl md:text-2xl font-medium text-amber-400 mt-1 whitespace-nowrap">{completedTasksWithoutTime}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {memberStats.map(stat => (
                            <div key={stat.uid} className="bg-[#1e1e24] rounded-xl border border-slate-700 p-4 flex flex-col h-full min-w-0">
                                <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700/50">
                                    <h3 className="font-bold text-lg text-white truncate mr-2">
                                        {stat.name}
                                        {stat.isFormer && <span className="ml-2 text-xs font-normal text-slate-500">(Kaldırılmış)</span>}
                                    </h3>
                                    <div className="text-right shrink-0">
                                        <span className="block text-xs text-slate-400">Toplam</span>
                                        <span className="font-bold text-[#a8e6cf] whitespace-nowrap">{formatSavedDuration(stat.total)}</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-auto">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Sayaç</span>
                                        <span className="font-medium text-slate-200">{formatSavedDuration(stat.timer)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Süreli</span>
                                        <span className="font-medium text-slate-200">{stat.tasksWithTime}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Manuel</span>
                                        <span className="font-medium text-slate-200">{formatSavedDuration(stat.manual)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Süresiz</span>
                                        <span className="font-medium text-amber-400/80">{stat.completedWithoutTime}</span>
                                    </div>
                                    <div className="flex justify-between items-center col-span-2 pt-2 mt-1 border-t border-slate-700/30">
                                        <span className="text-slate-400 text-xs">Görev Başı Ortalama</span>
                                        <span className="font-medium text-slate-300">{formatSavedDuration(stat.avg)}</span>
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
