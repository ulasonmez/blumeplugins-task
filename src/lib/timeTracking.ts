import { collection, doc, runTransaction, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logPluginAction } from "./logger";
import { ActiveTimer, TimeEntry } from "@/types/timeTracking";

export async function startTimer(
    uid: string,
    userName: string,
    pluginId: string,
    pluginName: string,
    todoId: string,
    todoText: string
) {
    await runTransaction(db, async (transaction) => {
        const activeTimerRef = doc(db, "activeTimers", uid);
        const activeTimerDoc = await transaction.get(activeTimerRef);

        if (activeTimerDoc.exists()) {
            const data = activeTimerDoc.data() as ActiveTimer;
            if (data.pluginId === pluginId && data.todoId === todoId) {
                // Idempotent: Already running this timer
                return;
            }
            
            const nowMs = Timestamp.now().toMillis();
            const startedAtMs = data.startedAt.toMillis();
            
            // Check if > 8 hours or different day
            const startDate = new Date(startedAtMs);
            const nowDate = new Date(nowMs);
            const isDifferentDay = startDate.getDate() !== nowDate.getDate() || 
                                   startDate.getMonth() !== nowDate.getMonth() || 
                                   startDate.getFullYear() !== nowDate.getFullYear();
                                   
            if (nowMs - startedAtMs > 8 * 3600 * 1000 || isDifferentDay) {
                throw new Error(`Başka bir task ("${data.todoText}") üzerinde çok uzun süredir veya dünden açık kalan bir sayaç var. Lütfen ekranın altındaki uyarıyı kullanarak onu kapatın veya kurtarın.`);
            }

            // Auto-pause old timer logic
            const oldTodoRef = doc(db, "plugins", data.pluginId, "todos", data.todoId);
            const oldTodoDoc = await transaction.get(oldTodoRef);
            
            if (oldTodoDoc.exists()) {
                const oldTimeEntryRef = doc(db, "plugins", data.pluginId, "todos", data.todoId, "timeEntries", data.timeEntryId);
                const oldTimeEntryDoc = await transaction.get(oldTimeEntryRef);
                const oldNow = Timestamp.now();
                let oldDuration = 0;
                
                if (oldTimeEntryDoc.exists()) {
                    const oldTimeEntryData = oldTimeEntryDoc.data() as TimeEntry;
                    if (oldTimeEntryData.startedAt) {
                        oldDuration = Math.max(0, Math.floor((oldNow.toMillis() - oldTimeEntryData.startedAt.toMillis()) / 1000));
                    }
                    transaction.update(oldTimeEntryRef, {
                        status: "completed",
                        endedAt: oldNow,
                        durationSeconds: oldDuration,
                        updatedAt: oldNow
                    });
                }
                
                const oldTodoData = oldTodoDoc.data();
                transaction.update(oldTodoRef, {
                    timerTrackedSeconds: (oldTodoData.timerTrackedSeconds ?? 0) + oldDuration,
                    totalTrackedSeconds: (oldTodoData.totalTrackedSeconds ?? 0) + oldDuration,
                    timeEntryCount: (oldTodoData.timeEntryCount ?? 0) + 1,
                    lastTrackedAt: oldNow
                });
            }
            // we will overwrite the activeTimerRef below anyway!
        }

        const todoRef = doc(db, "plugins", pluginId, "todos", todoId);
        const todoDoc = await transaction.get(todoRef);
        
        if (!todoDoc.exists()) {
            throw new Error("Task bulunamadı.");
        }

        const todoData = todoDoc.data();
        if (todoData.createdByUid !== uid) {
            throw new Error("Yalnızca kendi taskınızda sayaç başlatabilirsiniz.");
        }

        const timeEntryRef = doc(collection(db, "plugins", pluginId, "todos", todoId, "timeEntries"));
        
        const startedAt = Timestamp.now();
        
        const timeEntry: TimeEntry = {
            userId: uid,
            userName,
            source: "timer",
            status: "running",
            startedAt,
            endedAt: null,
            durationSeconds: 0,
            createdAt: startedAt,
            updatedAt: startedAt,
        };

        transaction.set(timeEntryRef, timeEntry);

        const activeTimer: ActiveTimer = {
            userId: uid,
            pluginId,
            pluginName,
            todoId,
            todoText,
            timeEntryId: timeEntryRef.id,
            startedAt,
            createdAt: startedAt,
        };

        transaction.set(activeTimerRef, activeTimer);

        if (!todoData.firstStartedAt) {
            transaction.update(todoRef, {
                firstStartedAt: serverTimestamp() // Keeping this as serverTimestamp as it's just an audit field
            });
        }
    });
    
    // Log outside transaction as it uses serverTimestamp which is fine, but logger helper uses addDoc.
    try { await logPluginAction(pluginId, "started_todo_timer", todoText, uid, userName); } catch(e) { console.error(e); }
}

export async function pauseTimer(uid: string) {
    let completedTodoData: { pluginId: string, todoText: string } | null = null;

    await runTransaction(db, async (transaction) => {
        const activeTimerRef = doc(db, "activeTimers", uid);
        const activeTimerDoc = await transaction.get(activeTimerRef);

        if (!activeTimerDoc.exists()) {
            throw new Error("Aktif sayaç bulunamadı.");
        }

        const activeTimer = activeTimerDoc.data() as ActiveTimer;
        
        const todoRef = doc(db, "plugins", activeTimer.pluginId, "todos", activeTimer.todoId);
        const todoDoc = await transaction.get(todoRef);
        
        if (!todoDoc.exists()) {
            // Task deleted but timer remained. Just clear timer.
            transaction.delete(activeTimerRef);
            throw new Error("Task bulunamadı. Sayaç silindi.");
        }

        const timeEntryRef = doc(db, "plugins", activeTimer.pluginId, "todos", activeTimer.todoId, "timeEntries", activeTimer.timeEntryId);
        const timeEntryDoc = await transaction.get(timeEntryRef);

        const now = Timestamp.now();
        let durationSeconds = 0;
        
        if (timeEntryDoc.exists()) {
            const timeEntryData = timeEntryDoc.data() as TimeEntry;
            if (timeEntryData.startedAt) {
                 durationSeconds = Math.max(0, Math.floor((now.toMillis() - timeEntryData.startedAt.toMillis()) / 1000));
            }
            
            transaction.update(timeEntryRef, {
                status: "completed",
                endedAt: now,
                durationSeconds,
                updatedAt: now
            });
        } else {
             // Entry doesn't exist, maybe it was deleted.
             durationSeconds = Math.max(0, Math.floor((now.toMillis() - activeTimer.startedAt.toMillis()) / 1000));
             const entry: TimeEntry = {
                userId: uid,
                userName: "Unknown", // Can't fetch from here easily, but we'll recover what we can
                source: "timer",
                status: "completed",
                startedAt: activeTimer.startedAt,
                endedAt: now,
                durationSeconds,
                createdAt: activeTimer.startedAt,
                updatedAt: now,
             };
             transaction.set(timeEntryRef, entry);
        }

        const todoData = todoDoc.data();
        const timerTrackedSeconds = (todoData.timerTrackedSeconds ?? 0) + durationSeconds;
        const totalTrackedSeconds = (todoData.totalTrackedSeconds ?? 0) + durationSeconds;
        const timeEntryCount = (todoData.timeEntryCount ?? 0) + 1;

        transaction.update(todoRef, {
            timerTrackedSeconds,
            totalTrackedSeconds,
            timeEntryCount,
            lastTrackedAt: now
        });

        transaction.delete(activeTimerRef);
        
        completedTodoData = {
            pluginId: activeTimer.pluginId,
            todoText: activeTimer.todoText
        };
    });
    
    if (completedTodoData) {
        try { await logPluginAction(completedTodoData.pluginId, "paused_todo_timer", completedTodoData.todoText, uid, "Kullanıcı"); } catch(e) { console.error(e); }
    }
}

export async function stopAndAddManualTime(
    uid: string, 
    pluginId: string, 
    todoId: string, 
    endTimeMillis: number,
    isCancel: boolean = false
) {
    await runTransaction(db, async (transaction) => {
        const activeTimerRef = doc(db, "activeTimers", uid);
        const activeTimerDoc = await transaction.get(activeTimerRef);

        if (!activeTimerDoc.exists()) {
            return; // Already stopped
        }

        const activeTimer = activeTimerDoc.data() as ActiveTimer;
        
        if (activeTimer.pluginId !== pluginId || activeTimer.todoId !== todoId) {
             throw new Error("Active timer mismatch");
        }

        const todoRef = doc(db, "plugins", pluginId, "todos", todoId);
        const todoDoc = await transaction.get(todoRef);
        const timeEntryRef = doc(db, "plugins", pluginId, "todos", todoId, "timeEntries", activeTimer.timeEntryId);
        
        const now = Timestamp.now();
        
        if (isCancel) {
            transaction.delete(timeEntryRef);
            transaction.delete(activeTimerRef);
            return; // Cancelled
        }
        
        const endedAt = Timestamp.fromMillis(endTimeMillis);
        const durationSeconds = Math.max(0, Math.floor((endTimeMillis - activeTimer.startedAt.toMillis()) / 1000));
        
        if (todoDoc.exists()) {
            transaction.update(timeEntryRef, {
                status: "completed",
                endedAt,
                durationSeconds,
                updatedAt: now,
                source: "recovery"
            });
            
            const todoData = todoDoc.data();
            const timerTrackedSeconds = (todoData.timerTrackedSeconds ?? 0) + durationSeconds;
            const totalTrackedSeconds = (todoData.totalTrackedSeconds ?? 0) + durationSeconds;
            const timeEntryCount = (todoData.timeEntryCount ?? 0) + 1;

            transaction.update(todoRef, {
                timerTrackedSeconds,
                totalTrackedSeconds,
                timeEntryCount,
                lastTrackedAt: now
            });
        } else {
             transaction.delete(timeEntryRef);
        }
        
        
        transaction.delete(activeTimerRef);
    });
    
    if (isCancel) {
         try { await logPluginAction(pluginId, "discarded_running_timer", "Süre iptal edildi", uid, "Sistem"); } catch(e) { console.error(e); }
    } else {
         try { await logPluginAction(pluginId, "recovered_long_timer", "Süre kurtarıldı", uid, "Sistem"); } catch(e) { console.error(e); }
    }
}

export async function addManualTime(
    uid: string,
    userName: string,
    pluginId: string,
    todoId: string,
    durationSeconds: number,
    note?: string
) {
    if (durationSeconds <= 0) throw new Error("Süre pozitif olmalıdır.");

    await runTransaction(db, async (transaction) => {
        const todoRef = doc(db, "plugins", pluginId, "todos", todoId);
        const todoDoc = await transaction.get(todoRef);
        
        if (!todoDoc.exists()) {
            throw new Error("Task bulunamadı.");
        }
        
        const todoData = todoDoc.data();
        if (todoData.createdByUid !== uid) {
            throw new Error("Yalnızca kendi taskınıza manuel süre ekleyebilirsiniz.");
        }

        const timeEntryRef = doc(collection(db, "plugins", pluginId, "todos", todoId, "timeEntries"));
        
        const now = Timestamp.now();
        
        const timeEntry: TimeEntry = {
            userId: uid,
            userName,
            source: "manual",
            status: "completed",
            startedAt: null,
            endedAt: now,
            durationSeconds,
            note: note || "",
            createdAt: now,
            updatedAt: now,
        };

        transaction.set(timeEntryRef, timeEntry);

        const manualTrackedSeconds = (todoData.manualTrackedSeconds ?? 0) + durationSeconds;
        const totalTrackedSeconds = (todoData.totalTrackedSeconds ?? 0) + durationSeconds;
        const timeEntryCount = (todoData.timeEntryCount ?? 0) + 1;

        transaction.update(todoRef, {
            manualTrackedSeconds,
            totalTrackedSeconds,
            timeEntryCount,
            lastTrackedAt: now
        });
    });
    
    try { await logPluginAction(pluginId, "added_manual_time", "Manuel süre eklendi", uid, userName); } catch(e) { console.error(e); }
}

export async function completeTodoWithTimerCheck(
    uid: string,
    pluginId: string,
    todoId: string,
    todoText: string,
    userName: string
) {
    await runTransaction(db, async (transaction) => {
        const activeTimerRef = doc(db, "activeTimers", uid);
        const activeTimerDoc = await transaction.get(activeTimerRef);
        
        const todoRef = doc(db, "plugins", pluginId, "todos", todoId);
        const todoDoc = await transaction.get(todoRef);
        
        if (!todoDoc.exists()) throw new Error("Task bulunamadı.");
        
        const now = Timestamp.now();
        let durationSeconds = 0;
        let closedTimer = false;
        
        if (activeTimerDoc.exists()) {
            const activeTimer = activeTimerDoc.data() as ActiveTimer;
            // If the active timer belongs to this task, close it
            if (activeTimer.pluginId === pluginId && activeTimer.todoId === todoId) {
                const timeEntryRef = doc(db, "plugins", pluginId, "todos", todoId, "timeEntries", activeTimer.timeEntryId);
                const timeEntryDoc = await transaction.get(timeEntryRef);
                
                if (timeEntryDoc.exists()) {
                    const timeEntryData = timeEntryDoc.data() as TimeEntry;
                     if (timeEntryData.startedAt) {
                         durationSeconds = Math.max(0, Math.floor((now.toMillis() - timeEntryData.startedAt.toMillis()) / 1000));
                     }
                     
                     transaction.update(timeEntryRef, {
                        status: "completed",
                        endedAt: now,
                        durationSeconds,
                        updatedAt: now
                     });
                }
                
                transaction.delete(activeTimerRef);
                closedTimer = true;
            }
        }
        
        const todoData = todoDoc.data();
        
        const updates: Record<string, unknown> = {
            completed: true,
            completedAt: serverTimestamp(), // Use server time for completion to keep legacy behavior consistent
        };
        
        if (closedTimer) {
            updates.timerTrackedSeconds = (todoData.timerTrackedSeconds ?? 0) + durationSeconds;
            updates.totalTrackedSeconds = (todoData.totalTrackedSeconds ?? 0) + durationSeconds;
            updates.timeEntryCount = (todoData.timeEntryCount ?? 0) + 1;
            updates.lastTrackedAt = now;
        }
        
        transaction.update(todoRef, updates);
    });
    
    try { await logPluginAction(pluginId, "completed_todo", todoText, uid, userName); } catch(e) { console.error(e); }
}

// For deleting time entries if necessary
export async function deleteTimeEntry(
    uid: string,
    pluginId: string,
    todoId: string,
    entryId: string
) {
    await runTransaction(db, async (transaction) => {
        const todoRef = doc(db, "plugins", pluginId, "todos", todoId);
        const timeEntryRef = doc(db, "plugins", pluginId, "todos", todoId, "timeEntries", entryId);
        
        const timeEntryDoc = await transaction.get(timeEntryRef);
        if (!timeEntryDoc.exists()) {
             throw new Error("Kayıt bulunamadı.");
        }
        
        const timeEntryData = timeEntryDoc.data() as TimeEntry;
        if (timeEntryData.status === "running") {
             throw new Error("Çalışan bir sayacı silemezsiniz.");
        }
        
        const durationSeconds = timeEntryData.durationSeconds;
        const source = timeEntryData.source;
        
        const todoDoc = await transaction.get(todoRef);
        if (!todoDoc.exists()) return;
        
        const todoData = todoDoc.data();
        
        transaction.delete(timeEntryRef);
        
        const updates: Record<string, unknown> = {
             timeEntryCount: Math.max(0, (todoData.timeEntryCount ?? 0) - 1),
             totalTrackedSeconds: Math.max(0, (todoData.totalTrackedSeconds ?? 0) - durationSeconds)
        };
        
        if (source === "timer" || source === "recovery") {
             updates.timerTrackedSeconds = Math.max(0, (todoData.timerTrackedSeconds ?? 0) - durationSeconds);
        } else if (source === "manual") {
             updates.manualTrackedSeconds = Math.max(0, (todoData.manualTrackedSeconds ?? 0) - durationSeconds);
        }
        
        transaction.update(todoRef, updates);
    });
    try { await logPluginAction(pluginId, "deleted_time_entry", "Zaman kaydı silindi", uid, "Sistem"); } catch(e) { console.error(e); }
}

import { getDocs, query, limit, deleteDoc } from "firebase/firestore";

export async function deleteTodoSafely(
    uid: string,
    userName: string,
    pluginId: string,
    todoId: string,
    todoText: string
) {
    const timeEntriesRef = collection(db, "plugins", pluginId, "todos", todoId, "timeEntries");
    
    while (true) {
        const q = query(timeEntriesRef, limit(490));
        const entriesSnapshot = await getDocs(q);
        
        if (entriesSnapshot.empty) {
            break;
        }
        
        const batch = writeBatch(db);
        entriesSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
    }
    
    // Yalnızca timeEntry'ler temizlendikten sonra task'ı sil
    const todoRef = doc(db, "plugins", pluginId, "todos", todoId);
    await deleteDoc(todoRef);
    
    try { await logPluginAction(pluginId, "deleted_todo", todoText, uid, userName); } catch(e) { console.error(e); }
}
