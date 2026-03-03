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
import { Plus, StickyNote, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface UserTodoSectionProps {
    pluginId: string;
    userId: string;
    userName: string;
    todos: any[];
    currentUserId: string;
    currentUserName?: string;
    videoUrl: string;
    className?: string;
}

export function UserTodoSection({ pluginId, userId, userName, todos, currentUserId, currentUserName, videoUrl, className }: UserTodoSectionProps) {
    const [newTodo, setNewTodo] = useState("");
    const [adding, setAdding] = useState(false);

    // Copy Dialog state
    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
    const [selectedTodosToCopy, setSelectedTodosToCopy] = useState<string[]>([]);
    const [copyingTodos, setCopyingTodos] = useState(false);

    // Todo Notes State
    const [selectedTodo, setSelectedTodo] = useState<any>(null);
    const [isTodoNotesOpen, setIsTodoNotesOpen] = useState(false);
    const [todoNotes, setTodoNotes] = useState("");
    const [savingTodoNotes, setSavingTodoNotes] = useState(false);

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
                notes: "",
            });
            setNewTodo("");
        } catch (error) {
            console.error("Error adding todo:", error);
        } finally {
            setAdding(false);
        }
    };

    const handleOpenTodoNotes = (todo: any) => {
        setSelectedTodo(todo);
        setTodoNotes(todo.notes || "");
        setIsTodoNotesOpen(true);
    };

    const handleSaveTodoNotes = async () => {
        if (!selectedTodo || !isCurrentUser) return;
        setSavingTodoNotes(true);
        try {
            const { doc, updateDoc } = await import("firebase/firestore");
            await updateDoc(doc(db, "plugins", pluginId, "todos", selectedTodo.id), {
                notes: todoNotes,
            });
            setIsTodoNotesOpen(false);
            setSelectedTodo(null);
        } catch (error) {
            console.error("Error saving todo notes:", error);
        } finally {
            setSavingTodoNotes(false);
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

    const handleToggleCopySelection = (todoId: string) => {
        if (selectedTodosToCopy.includes(todoId)) {
            setSelectedTodosToCopy(selectedTodosToCopy.filter(id => id !== todoId));
        } else {
            setSelectedTodosToCopy([...selectedTodosToCopy, todoId]);
        }
    };

    const handleSelectAllToCopy = () => {
        if (selectedTodosToCopy.length === todos.length) {
            setSelectedTodosToCopy([]);
        } else {
            setSelectedTodosToCopy(todos.map(t => t.id));
        }
    };

    const handleCopySelectedTodos = async () => {
        if (selectedTodosToCopy.length === 0) return;
        setCopyingTodos(true);
        try {
            const todosToCopy = todos.filter(t => selectedTodosToCopy.includes(t.id));
            const promises = todosToCopy.map(todo =>
                addDoc(collection(db, "plugins", pluginId, "todos"), {
                    text: todo.text,
                    createdByUid: currentUserId,
                    createdByName: currentUserName || "Member",
                    completed: false,
                    createdAt: serverTimestamp(),
                    completedAt: null,
                    notes: "",
                })
            );
            await Promise.all(promises);
            setIsCopyDialogOpen(false);
            setSelectedTodosToCopy([]);
        } catch (error) {
            console.error("Error copying todos:", error);
        } finally {
            setCopyingTodos(false);
        }
    };

    return (
        <div className={cn("bg-[#2b2b30] rounded-xl border border-slate-600 overflow-hidden flex flex-col h-full shadow-lg", className)}>
            <div className="p-4 flex items-center justify-between border-b border-slate-600 bg-[#2b2b30]">
                <div className="flex items-center gap-3">
                    <h4 className="font-bold text-xl text-white">{userName}</h4>
                    <Badge variant="secondary" className="bg-[#2d936c] text-white hover:bg-[#237a58]">
                        {done}/{total}
                    </Badge>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-[#a8e6cf]">{percent}%</span>
                    {!isCurrentUser && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-slate-500 text-slate-300 hover:text-white hover:bg-slate-700 hover:border-slate-400 shrink-0"
                            onClick={() => {
                                setSelectedTodosToCopy(todos.map(t => t.id));
                                setIsCopyDialogOpen(true);
                            }}
                            title="Copy Tasks"
                        >
                            <Copy className="w-4 h-4" />
                        </Button>
                    )}
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

            {/* Todo Item Notes Dialog */}
            <Dialog open={isTodoNotesOpen} onOpenChange={setIsTodoNotesOpen}>
                <DialogContent className="w-full max-w-md bg-[#2b2b30] border-slate-600 text-white">
                    <DialogHeader>
                        <DialogTitle>{isCurrentUser ? "Task Notes" : "View Task Notes"}</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Textarea
                            value={todoNotes}
                            onChange={(e) => setTodoNotes(e.target.value)}
                            placeholder={isCurrentUser ? "Add notes for this task..." : "No notes available."}
                            className="bg-[#1e1e24] border-slate-600 text-white min-h-[150px]"
                            disabled={!isCurrentUser}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsTodoNotesOpen(false)}
                            className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                            {isCurrentUser ? "Cancel" : "Close"}
                        </Button>
                        {isCurrentUser && (
                            <Button
                                onClick={handleSaveTodoNotes}
                                disabled={savingTodoNotes}
                                className="bg-[#2d936c] hover:bg-[#237a58] text-white"
                            >
                                {savingTodoNotes ? "Saving..." : "Save"}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Copy Todos Dialog */}
            <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                <DialogContent className="w-full max-w-md bg-[#2b2b30] border-slate-600 text-white max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Copy Tasks from {userName}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-2">
                        {todos.length === 0 ? (
                            <p className="text-slate-400 text-center py-4 text-sm">No tasks available to copy.</p>
                        ) : (
                            todos.map(todo => (
                                <div
                                    key={todo.id}
                                    className="flex items-start gap-3 p-3 bg-[#1e1e24] rounded-lg border border-slate-700 cursor-pointer hover:border-slate-500 transition-colors"
                                    onClick={() => handleToggleCopySelection(todo.id)}
                                >
                                    <Checkbox
                                        checked={selectedTodosToCopy.includes(todo.id)}
                                        onCheckedChange={() => handleToggleCopySelection(todo.id)}
                                        className="mt-1"
                                    />
                                    <span className={cn("text-sm", todo.completed && "line-through text-slate-500")}>
                                        {todo.text}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-600 shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAllToCopy}
                            className="text-slate-300 hover:text-white"
                        >
                            {selectedTodosToCopy.length === todos.length && todos.length > 0 ? "Deselect All" : "Select All"}
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsCopyDialogOpen(false)}
                                className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCopySelectedTodos}
                                disabled={selectedTodosToCopy.length === 0 || copyingTodos}
                                className="bg-[#2d936c] hover:bg-[#237a58] text-white"
                            >
                                {copyingTodos ? "Copying..." : `Copy (${selectedTodosToCopy.length})`}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex-1 p-2 md:p-4 space-y-4 overflow-y-auto bg-[#1e1e24]/30">
                <Progress value={percent} className="h-2 bg-slate-700" indicatorClassName="bg-[#2d936c]" />

                <div className="space-y-1">
                    {todos.map(todo => (
                        <TodoItem
                            key={todo.id}
                            pluginId={pluginId}
                            todo={todo}
                            currentUserId={currentUserId}
                            videoUrl={videoUrl}
                            onOpenNotes={handleOpenTodoNotes}
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
