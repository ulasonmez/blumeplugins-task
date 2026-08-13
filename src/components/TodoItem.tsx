"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, StickyNote, Pencil } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logPluginAction } from "@/lib/logger";
import { completeTodoWithTimerCheck, deleteTodoSafely } from "@/lib/timeTracking";
import { cn } from "@/lib/utils";
import { TodoTimer } from "./TodoTimer";
import { toast } from "@/components/Toaster";

interface TodoItemProps {
    pluginId: string;
    todo: {
        id: string;
        text: string;
        completed: boolean;
        completedAt?: unknown;
        createdByUid: string;
        notes?: string;
        totalTrackedSeconds?: number;
        timerTrackedSeconds?: number;
        manualTrackedSeconds?: number;
        firstStartedAt?: unknown;
    };
    currentUserId: string;
    currentUserName?: string;
    videoUrl: string;
    onOpenNotes: (todo: { id: string; notes?: string }) => void;
    activeTimer?: { userId: string; pluginId: string; todoId: string; timeEntryId: string; startedAt: { toMillis: () => number } } | null;
    elapsedSeconds?: number;
}

export function TodoItem({ pluginId, todo, currentUserId, currentUserName, videoUrl, onOpenNotes, activeTimer, elapsedSeconds }: TodoItemProps) {
    const isOwner = todo.createdByUid === currentUserId;
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(todo.text);
    const [savingEdit, setSavingEdit] = useState(false);

    const handleToggle = async () => {
        if (!isOwner || toggling) return;
        setToggling(true);
        try {
            if (!todo.completed) {
                // When completing, safely check if timer is running and stop it
                await completeTodoWithTimerCheck(currentUserId, pluginId, todo.id, todo.text, currentUserName || "Anonymous");
            } else {
                // When reopening, just reopen
                await updateDoc(doc(db, "plugins", pluginId, "todos", todo.id), {
                    completed: false,
                    completedAt: null,
                });
                await logPluginAction(
                    pluginId, 
                    "uncompleted_todo", 
                    todo.text, 
                    currentUserId, 
                    currentUserName || "Anonymous"
                );
            }
        } catch (error) {
            console.error("Error toggling todo:", error);
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        if (!isOwner || deleting) return;
        
        if (activeTimer && activeTimer.todoId === todo.id) {
            toast("Bu görevde şu an çalışan bir sayacınız var. Lütfen önce sayacı durdurun.");
            return;
        }

        const hasTimeEntries = (todo.totalTrackedSeconds ?? 0) > 0;
        if (hasTimeEntries) {
            const confirmed = window.confirm("Bu göreve kaydedilmiş çalışma süreleri var. Görevi sildiğinizde bu süreler de silinecektir. Devam etmek istiyor musunuz?");
            if (!confirmed) return;
        } else {
            const confirmed = window.confirm("Görevi silmek istediğinize emin misiniz?");
            if (!confirmed) return;
        }

        setDeleting(true);
        try {
            await deleteTodoSafely(
                currentUserId,
                currentUserName || "Anonymous",
                pluginId,
                todo.id,
                todo.text
            );
        } catch (error) {
            console.error("Error deleting todo:", error);
            toast("Görev silinirken hata oluştu.");
        } finally {
            setDeleting(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editText.trim() || savingEdit) return;
        setSavingEdit(true);
        try {
            await updateDoc(doc(db, "plugins", pluginId, "todos", todo.id), {
                text: editText.trim()
            });
            setIsEditing(false);
        } catch (error) {
            console.error("Error update todo text:", error);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSaveEdit();
        } else if (e.key === "Escape") {
            setIsEditing(false);
            setEditText(todo.text);
        }
    };

    // Timecode parsing
    const renderText = (text: string) => {
        // Regex for mm:ss or m:ss
        const regex = /\b(\d{1,2}):([0-5]\d)\b/g;
        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add text before match
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }

            // Add clickable timecode
            const timeString = match[0];
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const totalSeconds = minutes * 60 + seconds;

            parts.push(
                <button
                    key={match.index}
                    onClick={() => {
                        // Construct URL with timestamp
                        const url = new URL(videoUrl);
                        url.searchParams.set("t", totalSeconds.toString());
                        window.open(url.toString(), "_blank");
                    }}
                    className="text-blue-600 underline hover:text-blue-800 font-medium mx-1"
                >
                    {timeString}
                </button>
            );

            lastIndex = regex.lastIndex;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts.length > 0 ? parts : text;
    };

    return (
        <div className={cn("p-2 rounded-md bg-[#2b2b30] hover:bg-[#323238] transition-colors group border border-transparent hover:border-slate-600 min-h-[40px]", 
            todo.completed && "bg-black/20",
            (activeTimer && activeTimer.todoId === todo.id) && "border-[#2d936c]/50 bg-[#2d936c]/5"
        )}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
                    <Checkbox
                        checked={todo.completed}
                        onCheckedChange={handleToggle}
                        disabled={!isOwner || toggling}
                        className={cn("mt-1 sm:mt-0 h-4 w-4 shrink-0 border-slate-400 bg-slate-800/50 data-[state=checked]:bg-[#2d936c] data-[state=checked]:border-[#2d936c]", !isOwner && "opacity-50 cursor-not-allowed")}
                    />

                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <input
                                autoFocus
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleSaveEdit}
                                className="w-full bg-[#1e1e24] text-white border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                            />
                        ) : (
                            <span
                                className={cn("text-sm font-medium text-slate-200 break-words whitespace-normal leading-tight", todo.completed && "line-through text-slate-500")}
                                onDoubleClick={() => {
                                    if (isOwner) {
                                        setIsEditing(true);
                                        setEditText(todo.text);
                                    }
                                }}
                            >
                                {renderText(todo.text)}
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 justify-end sm:shrink-0 pl-6 sm:pl-0 mt-1 sm:mt-0">
                    <TodoTimer 
                        todo={todo}
                        pluginId={pluginId}
                        pluginName="" // handled upper
                        currentUserId={currentUserId}
                        currentUserName={currentUserName || "Anonymous"}
                        activeTimer={activeTimer || null}
                        elapsedSeconds={elapsedSeconds || 0}
                        isOwner={isOwner}
                    />

                    <div className="flex gap-1 shrink-0">
                        {isOwner && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-yellow-400"
                                onClick={() => {
                                    setIsEditing(true);
                                    setEditText(todo.text);
                                }}
                            >
                                <Pencil className="w-3 h-3" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-blue-400"
                            onClick={() => onOpenNotes(todo)}
                        >
                            <StickyNote className={cn("w-3 h-3", todo.notes ? "fill-current text-blue-400" : "")} />
                        </Button>

                        {isOwner && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-500"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {Boolean(todo.completed) && Boolean(todo.completedAt) && (
                <div className="pl-6 mt-0.5">
                    <span className="text-[10px] text-slate-500">
                        {(() => {
                            try {
                                const completedAt = todo.completedAt as { toDate?: () => Date };
                                const date = completedAt.toDate ? completedAt.toDate() : new Date(todo.completedAt as string | number | Date);
                                return new Intl.DateTimeFormat('tr-TR', {
                                    day: 'numeric',
                                    month: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                }).format(date);
                            } catch (e) {
                                return "";
                            }
                        })()}
                    </span>
                </div>
            )}
        </div>
    );
}
