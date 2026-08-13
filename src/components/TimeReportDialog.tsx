"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDurationShort } from "@/lib/timeFormatting";

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
            <DialogContent className="w-full max-w-4xl bg-[#2b2b30] border-slate-600 text-white max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Çalışma Süreleri Raporu</DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-[#1e1e24] p-3 rounded-lg border border-slate-700 flex flex-col">
                            <span className="text-xs text-slate-400">Toplam Aktif Çalışma</span>
                            <span className="text-lg font-bold text-[#a8e6cf]">{formatDurationShort(totalTrackedSeconds)}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-3 rounded-lg border border-slate-700 flex flex-col">
                            <span className="text-xs text-slate-400">Sayaçla Kaydedilen</span>
                            <span className="text-lg font-medium">{formatDurationShort(timerTrackedSeconds)}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-3 rounded-lg border border-slate-700 flex flex-col">
                            <span className="text-xs text-slate-400">Manuel Girilen</span>
                            <span className="text-lg font-medium">{formatDurationShort(manualTrackedSeconds)}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-3 rounded-lg border border-slate-700 flex flex-col">
                            <span className="text-xs text-slate-400">Süreli Task</span>
                            <span className="text-lg font-medium">{tasksWithTime}</span>
                        </div>
                        <div className="bg-[#1e1e24] p-3 rounded-lg border border-slate-700 flex flex-col">
                            <span className="text-xs text-slate-400">Süresiz Tamamlanan</span>
                            <span className="text-lg font-medium text-amber-400">{completedTasksWithoutTime}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-700 bg-[#1e1e24]">
                        <table className="w-full text-sm text-left text-slate-300">
                            <thead className="text-xs text-slate-400 uppercase bg-[#2b2b30] border-b border-slate-700">
                                <tr>
                                    <th className="px-4 py-3">Üye</th>
                                    <th className="px-4 py-3 text-right">Toplam Süre</th>
                                    <th className="px-4 py-3 text-right">Sayaç</th>
                                    <th className="px-4 py-3 text-right">Manuel</th>
                                    <th className="px-4 py-3 text-right">Süreli Task</th>
                                    <th className="px-4 py-3 text-right">Süresiz Tam.</th>
                                    <th className="px-4 py-3 text-right">Ortalama</th>
                                </tr>
                            </thead>
                            <tbody>
                                {memberStats.map(stat => (
                                    <tr key={stat.uid} className="border-b border-slate-700/50 hover:bg-[#2b2b30]/50">
                                        <td className="px-4 py-3 font-medium text-white">
                                            {stat.name}
                                            {stat.isFormer && <span className="ml-2 text-xs text-slate-500">(Kaldırılmış)</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-[#a8e6cf]">{formatDurationShort(stat.total)}</td>
                                        <td className="px-4 py-3 text-right">{formatDurationShort(stat.timer)}</td>
                                        <td className="px-4 py-3 text-right">{formatDurationShort(stat.manual)}</td>
                                        <td className="px-4 py-3 text-right">{stat.tasksWithTime}</td>
                                        <td className="px-4 py-3 text-right text-amber-400/80">{stat.completedWithoutTime}</td>
                                        <td className="px-4 py-3 text-right text-slate-400">{formatDurationShort(stat.avg)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
