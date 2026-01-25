"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, StickyNote } from "lucide-react";
import { doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

interface TodoItemProps {
    pluginId: string;
    todo: {
        id: string;
        text: string;
        completed: boolean;
        completedAt?: any; // Using any to handle both Firestore Timestamp and Date
        createdByUid: string;
        notes?: string;
    };
    currentUserId: string;
    videoUrl: string;
    onOpenNotes: (todo: any) => void;
}

export function TodoItem({ pluginId, todo, currentUserId, videoUrl, onOpenNotes }: TodoItemProps) {
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
            await updateDoc(doc(db, "plugins", pluginId, "todos", todo.id), {
                completed: !todo.completed,
                completedAt: !todo.completed ? serverTimestamp() : null,
            });
        } catch (error) {
            console.error("Error toggling todo:", error);
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        if (!isOwner || deleting) return;
        // Removed confirmation
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "plugins", pluginId, "todos", todo.id));
        } catch (error) {
            console.error("Error deleting todo:", error);
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
        <div className={cn("flex items-center gap-3 p-3 rounded-md bg-[#2b2b30] hover:bg-[#323238] transition-colors group mb-2 border border-transparent hover:border-slate-600", todo.completed && "opacity-60 bg-[#25252b]")}>
            <Checkbox
                checked={todo.completed}
                onCheckedChange={handleToggle}
                disabled={!isOwner || toggling}
                className={cn("border-slate-500 data-[state=checked]:bg-[#2d936c] data-[state=checked]:border-[#2d936c]", !isOwner && "opacity-50 cursor-not-allowed")}
            />

            <div className="flex-1 min-w-0">
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => {
                                // Optional: save on blur or just cancel? Let's save on blur for better UX
                                handleSaveEdit();
                            }}
                            className="flex-1 bg-[#1e1e24] text-white border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                        />
                    </div>
                ) : (
                    <span
                        className={cn("block text-base font-medium text-slate-200 break-words", todo.completed && "line-through text-slate-500")}
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

            {todo.completed && todo.completedAt && (
                <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                    {(() => {
                        try {
                            // Handle Firestore Timestamp
                            const date = todo.completedAt.toDate ? todo.completedAt.toDate() : new Date(todo.completedAt);
                            return new Intl.DateTimeFormat('tr-TR', {
                                day: 'numeric',
                                month: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }).format(date);
                        } catch (e) {
                            return "";
                        }
                    })()}
                </span>
            )}

            <div className={cn("flex gap-1 transition-opacity", isOwner ? "opacity-0 group-hover:opacity-100" : "opacity-100")}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-blue-400"
                    onClick={() => onOpenNotes(todo)}
                >
                    <StickyNote className={cn("w-4 h-4", todo.notes ? "fill-current text-blue-400" : "")} />
                </Button>

                {isOwner && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={handleDelete}
                        disabled={deleting}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
