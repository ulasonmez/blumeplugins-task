"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TodoItem } from "./TodoItem";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserTodoSectionProps {
    pluginId: string;
    userId: string;
    userName: string;
    todos: any[];
    currentUserId: string;
    videoUrl: string;
}

export function UserTodoSection({ pluginId, userId, userName, todos, currentUserId, videoUrl }: UserTodoSectionProps) {
    const [newTodo, setNewTodo] = useState("");
    const [adding, setAdding] = useState(false);

    const isCurrentUser = userId === currentUserId;
    const total = todos.length;
    const done = todos.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodo.trim() || !isCurrentUser) return;

        setAdding(true);
        try {
            await addDoc(collection(db, "plugins", pluginId, "todos"), {
                text: newTodo.trim(),
                createdByUid: currentUserId,
                createdByName: userName, // Using prop userName which should match current user if isCurrentUser
                completed: false,
                createdAt: serverTimestamp(),
                completedAt: null,
            });
            setNewTodo("");
        } catch (error) {
            console.error("Error adding todo:", error);
        } finally {
            setAdding(false);
        }
    };



    // Removed isExpanded state - always expanded
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [notes, setNotes] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);

    // Fetch notes when dialog opens
    const handleOpenNotes = async () => {
        setIsNotesOpen(true);
        try {
            const noteDoc = await import("firebase/firestore").then(mod => mod.getDoc(mod.doc(db, "plugins", pluginId, "notes", userId)));
            if (noteDoc.exists()) {
                setNotes(noteDoc.data().content || "");
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
        }
    };

    const handleSaveNotes = async () => {
        if (!isCurrentUser) return;
        setSavingNotes(true);
        try {
            const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
            await setDoc(doc(db, "plugins", pluginId, "notes", userId), {
                content: notes,
                updatedAt: serverTimestamp(),
            });
            setIsNotesOpen(false);
        } catch (error) {
            console.error("Error saving notes:", error);
        } finally {
            setSavingNotes(false);
        }
    };

    return (
        <div className="bg-[#2b2b30] rounded-xl border border-slate-600 overflow-hidden flex flex-col h-full shadow-lg">
            <div className="p-4 flex items-center justify-between border-b border-slate-600 bg-[#2b2b30]">
                <div className="flex items-center gap-3">
                    <h4 className="font-bold text-xl text-white">{userName}</h4>
                    <Badge variant="secondary" className="bg-[#2d936c] text-white hover:bg-[#237a58]">
                        {done}/{total}
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[#a8e6cf]">{percent}%</span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-500 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-400 gap-2"
                        onClick={handleOpenNotes}
                    >
                        <StickyNote className="w-4 h-4" />
                        Notes
                    </Button>
                </div>
            </div>

            <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
                <DialogContent className="w-full max-w-4xl min-w-[50vw] h-[80vh] flex flex-col bg-[#2b2b30] border-slate-600 text-white overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>{userName}'s Notes</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 py-4">
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isCurrentUser ? "Write your work notes here..." : "No notes available."}
                            className="w-full h-full resize-none p-4 text-base bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500 field-sizing-fixed"
                            style={{ fieldSizing: "fixed" } as any}
                            disabled={!isCurrentUser}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsNotesOpen(false)} className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white">Close</Button>
                        {isCurrentUser && (
                            <Button onClick={handleSaveNotes} disabled={savingNotes} className="bg-[#2d936c] hover:bg-[#237a58] text-white">
                                {savingNotes ? "Saving..." : "Save Notes"}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-[#1e1e24]/30">
                <Progress value={percent} className="h-2 bg-slate-700" indicatorClassName="bg-[#2d936c]" />

                <div className="space-y-1">
                    {todos.map(todo => (
                        <TodoItem
                            key={todo.id}
                            pluginId={pluginId}
                            todo={todo}
                            currentUserId={currentUserId}
                            videoUrl={videoUrl}
                        />
                    ))}
                    {todos.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-2">No tasks yet</p>
                    )}
                </div>

                {isCurrentUser && (
                    <form onSubmit={handleAddTodo} className="flex gap-2 pt-2">
                        <Input
                            value={newTodo}
                            onChange={(e) => setNewTodo(e.target.value)}
                            placeholder="Add a task..."
                            className="h-10 text-sm bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500"
                        />
                        <Button type="submit" size="sm" className="h-10 w-10 p-0 bg-[#2d936c] hover:bg-[#237a58]" disabled={adding || !newTodo.trim()}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
}
