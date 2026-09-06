"use client";

import { useState, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TodoItem } from "./TodoItem";
import { addDoc, collection, serverTimestamp, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, StickyNote, Copy, Pencil, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { logPluginAction } from "@/lib/logger";
import { formatSavedDuration } from "@/lib/timeFormatting";
import { LinkifiedText } from "@/components/LinkifiedText";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";

export function sortTodos<T extends { order?: number; createdAt?: unknown }>(todoList: T[]): T[] {
    return [...todoList].sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : null;
        const orderB = typeof b.order === "number" ? b.order : null;
        if (orderA !== null && orderB !== null) {
            return orderA - orderB;
        }
        if (orderA !== null) return -1;
        if (orderB !== null) return 1;

        const getMillis = (val: unknown): number => {
            if (!val) return 0;
            const maybeObj = val as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
            if (typeof maybeObj.toMillis === "function") return maybeObj.toMillis();
            if (typeof maybeObj.toDate === "function") return maybeObj.toDate().getTime();
            if (typeof maybeObj.seconds === "number") return maybeObj.seconds * 1000;
            if (val instanceof Date) return val.getTime();
            return 0;
        };
        return getMillis(a.createdAt) - getMillis(b.createdAt);
    });
}

interface UserTodoSectionProps {
    pluginId: string;
    userId: string;
    userName: string;
    todos: Array<{
        id: string;
        text: string;
        completed: boolean;
        completedAt?: unknown;
        createdAt?: unknown;
        createdByUid: string;
        notes?: string;
        totalTrackedSeconds?: number;
        timerTrackedSeconds?: number;
        manualTrackedSeconds?: number;
        firstStartedAt?: unknown;
        order?: number;
    }>;
    currentUserId: string;
    currentUserName?: string;
    videoUrl: string;
    className?: string;
    activeTimer?: { userId: string; pluginId: string; todoId: string; timeEntryId: string; startedAt: { toMillis: () => number } } | null;
    elapsedSeconds?: number;
}

export function UserTodoSection({ pluginId, userId, userName, todos, currentUserId, currentUserName, videoUrl, className, activeTimer, elapsedSeconds }: UserTodoSectionProps) {
    const [newTodo, setNewTodo] = useState("");
    const [adding, setAdding] = useState(false);

    // Copy Dialog state
    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
    const [selectedTodosToCopy, setSelectedTodosToCopy] = useState<string[]>([]);
    const [copyingTodos, setCopyingTodos] = useState(false);

    // Todo Notes State
    const [selectedTodo, setSelectedTodo] = useState<{ id: string; notes?: string } | null>(null);
    const [isTodoNotesOpen, setIsTodoNotesOpen] = useState(false);
    const [todoNotes, setTodoNotes] = useState("");
    const [isEditingTodoNotes, setIsEditingTodoNotes] = useState(false);
    const [savingTodoNotes, setSavingTodoNotes] = useState(false);

    const isCurrentUser = userId === currentUserId;
    const dndId = useId();
    const [isMounted, setIsMounted] = useState(false);
    const [items, setItems] = useState(() => sortTodos(todos));
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!isDragging) {
            setItems(sortTodos(todos));
        }
    }, [todos, isDragging]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = () => {
        setIsDragging(true);
    };

    const handleDragCancel = () => {
        setIsDragging(false);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setIsDragging(false);
        const { active, over } = event;
        if (!over || active.id === over.id || !isCurrentUser) return;

        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);

        try {
            const batch = writeBatch(db);
            let hasChanges = false;
            newItems.forEach((item, index) => {
                if (item.order !== index) {
                    hasChanges = true;
                    const todoRef = doc(db, "plugins", pluginId, "todos", item.id);
                    batch.update(todoRef, { order: index });
                }
            });

            if (hasChanges) {
                await batch.commit();
            }
        } catch (error) {
            console.error("Error updating todo order:", error);
            setItems(sortTodos(todos));
        }
    };

    const total = items.length;
    const done = items.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    // Scope active timer duration to this specific user AND this specific plugin
    const isTimerForThisPluginAndUser = Boolean(
        activeTimer &&
        activeTimer.userId === userId &&
        activeTimer.pluginId === pluginId
    );
    const totalTrackedSeconds = items.reduce((sum, t) => sum + (t.totalTrackedSeconds ?? 0), 0) + (isTimerForThisPluginAndUser ? (elapsedSeconds ?? 0) : 0);
    const completedWithoutTimeCount = items.filter(t => t.completed && (t.totalTrackedSeconds ?? 0) === 0).length;

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
                order: items.length,
            });
            
            // Log the action
            await logPluginAction(pluginId, "added_todo", newTodo.trim(), currentUserId, currentUserName || "Anonymous");
            
            setNewTodo("");
        } catch (error) {
            console.error("Error adding todo:", error);
        } finally {
            setAdding(false);
        }
    };

    const handleOpenTodoNotes = (todo: { id: string; notes?: string }) => {
        setSelectedTodo(todo);
        setTodoNotes(todo.notes || "");
        setIsEditingTodoNotes(!todo.notes?.trim());
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
            setIsEditingTodoNotes(false);
            if (selectedTodo) {
                selectedTodo.notes = todoNotes;
            }
        } catch (error) {
            console.error("Error saving todo notes:", error);
        } finally {
            setSavingTodoNotes(false);
        }
    };

    // Personal Notes State
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [notes, setNotes] = useState("");
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [savingNotes, setSavingNotes] = useState(false);

    // Fetch notes when dialog opens
    const handleOpenNotes = async () => {
        setIsNotesOpen(true);
        try {
            const noteDoc = await import("firebase/firestore").then(mod => mod.getDoc(mod.doc(db, "plugins", pluginId, "notes", userId)));
            if (noteDoc.exists()) {
                const content = noteDoc.data().content || "";
                setNotes(content);
                setIsEditingNotes(!content.trim() && isCurrentUser);
            } else {
                setNotes("");
                setIsEditingNotes(isCurrentUser);
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
            setIsEditingNotes(false);
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
            const todosToCopy = items.filter(t => selectedTodosToCopy.includes(t.id));
            const promises = todosToCopy.map((todo, idx) =>
                addDoc(collection(db, "plugins", pluginId, "todos"), {
                    text: todo.text,
                    createdByUid: currentUserId,
                    createdByName: currentUserName || "Member",
                    completed: false,
                    createdAt: serverTimestamp(),
                    completedAt: null,
                    notes: "",
                    order: items.length + idx,
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
        <div className={cn("bg-[#2b2b30] rounded-xl border border-slate-600 overflow-hidden flex flex-col shadow-lg", className)}>
            <div className="p-4 flex items-center justify-between border-b border-slate-600 bg-[#2b2b30]">
                <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                        <h4 className="font-bold text-xl text-white">{userName}</h4>
                        {totalTrackedSeconds > 0 && (
                            <span className="text-xs text-slate-400">
                                ⏱ Toplam: {formatSavedDuration(totalTrackedSeconds)}
                                {completedWithoutTimeCount > 0 && ` · Süresiz: ${completedWithoutTimeCount}`}
                            </span>
                        )}
                    </div>
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

            {/* Personal Notes Dialog */}
            <Dialog open={isNotesOpen} onOpenChange={setIsNotesOpen}>
                <DialogContent className="w-full max-w-4xl min-w-[50vw] h-[85vh] flex flex-col bg-[#2b2b30] border-slate-600 text-white overflow-hidden">
                    <DialogHeader className="shrink-0 pb-3 border-b border-slate-700">
                        <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xl font-bold">{userName}&apos;un Notları</span>
                            {isCurrentUser && (
                                <div className="mr-8">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEditingNotes(!isEditingNotes)}
                                        className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
                                    >
                                        {isEditingNotes ? (
                                            <>
                                                <Eye className="w-3.5 h-3.5" />
                                                Önizle
                                            </>
                                        ) : (
                                            <>
                                                <Pencil className="w-3.5 h-3.5" />
                                                Düzenle
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 mt-2 min-h-0 overflow-hidden">
                        {isCurrentUser && isEditingNotes ? (
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                autoFocus
                                placeholder="Buraya kişisel çalışma notlarınızı yazın... Linkleriniz mavi ve tıklanabilir olarak görüntülenecektir."
                                className="w-full h-full resize-none p-4 text-base bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-[#2d936c]"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#1e1e24] border border-slate-600 rounded-md p-4 md:p-6 overflow-y-auto text-base leading-relaxed">
                                {notes.trim() ? (
                                    <LinkifiedText text={notes} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                                        <p className="italic">Henüz not eklenmedi.</p>
                                        {isCurrentUser && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsEditingNotes(true)}
                                                className="border-slate-600 text-slate-300 hover:text-white"
                                            >
                                                <Pencil className="w-3.5 h-3.5 mr-1" /> Not Yaz
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-700 shrink-0">
                        <Button variant="outline" onClick={() => setIsNotesOpen(false)} className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white">Kapat</Button>
                        {isCurrentUser && isEditingNotes && (
                            <Button onClick={handleSaveNotes} disabled={savingNotes} className="bg-[#2d936c] hover:bg-[#237a58] text-white">
                                {savingNotes ? "Kaydediliyor..." : "Notu Kaydet"}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Todo Item Notes Dialog */}
            <Dialog open={isTodoNotesOpen} onOpenChange={setIsTodoNotesOpen}>
                <DialogContent className="w-full max-w-lg bg-[#2b2b30] border-slate-600 text-white flex flex-col max-h-[85vh]">
                    <DialogHeader className="shrink-0 pb-3 border-b border-slate-700">
                        <DialogTitle className="flex items-center justify-between">
                            <span>{isCurrentUser ? "Görev Notları" : `${userName} Görev Notları`}</span>
                            {isCurrentUser && (
                                <div className="mr-8">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEditingTodoNotes(!isEditingTodoNotes)}
                                        className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
                                    >
                                        {isEditingTodoNotes ? (
                                            <>
                                                <Eye className="w-3.5 h-3.5" />
                                                Önizle
                                            </>
                                        ) : (
                                            <>
                                                <Pencil className="w-3.5 h-3.5" />
                                                Düzenle
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-2 flex-1 min-h-[160px] max-h-[50vh] overflow-y-auto">
                        {isCurrentUser && isEditingTodoNotes ? (
                            <Textarea
                                value={todoNotes}
                                onChange={(e) => setTodoNotes(e.target.value)}
                                autoFocus
                                placeholder="Bu görev için not ekleyin... Linkler mavi ve tıklanabilir olacaktır."
                                className="bg-[#1e1e24] border-slate-600 text-white min-h-[160px] h-full resize-none p-3 text-sm focus-visible:ring-1 focus-visible:ring-[#2d936c]"
                            />
                        ) : (
                            <div className="bg-[#1e1e24] border border-slate-600 rounded-md p-4 min-h-[160px] text-sm leading-relaxed overflow-y-auto">
                                {todoNotes.trim() ? (
                                    <LinkifiedText text={todoNotes} />
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-slate-500 gap-2">
                                        <p className="italic">Bu görev için henüz not girilmedi.</p>
                                        {isCurrentUser && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsEditingTodoNotes(true)}
                                                className="border-slate-600 text-slate-300 hover:text-white text-xs"
                                            >
                                                <Pencil className="w-3 h-3 mr-1" /> Not Ekle
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-700 shrink-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsTodoNotesOpen(false)}
                            className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                            {isCurrentUser && isEditingTodoNotes ? "İptal" : "Kapat"}
                        </Button>
                        {isCurrentUser && isEditingTodoNotes && (
                            <Button
                                onClick={handleSaveTodoNotes}
                                disabled={savingTodoNotes}
                                className="bg-[#2d936c] hover:bg-[#237a58] text-white"
                            >
                                {savingTodoNotes ? "Kaydediliyor..." : "Kaydet"}
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

            <div className="overflow-y-auto bg-[#1e1e24]/30">
                <div className="p-2 md:p-4 space-y-3">
                    <Progress value={percent} className="h-2 bg-slate-700" indicatorClassName="bg-[#2d936c]" />

                    {isMounted && isCurrentUser ? (
                        <DndContext
                            id={dndId}
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragCancel={handleDragCancel}
                        >
                            <SortableContext
                                items={items.map((t) => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-1">
                                    {items.map(todo => (
                                        <TodoItem
                                            key={todo.id}
                                            pluginId={pluginId}
                                            todo={todo}
                                            currentUserId={currentUserId}
                                            currentUserName={currentUserName}
                                            videoUrl={videoUrl}
                                            onOpenNotes={handleOpenTodoNotes}
                                            activeTimer={activeTimer}
                                            elapsedSeconds={elapsedSeconds}
                                        />
                                    ))}
                                    {items.length === 0 && (
                                        <p className="text-xs text-slate-400 italic text-center py-2">No tasks yet</p>
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div className="space-y-1">
                            {items.map(todo => (
                                <TodoItem
                                    key={todo.id}
                                    pluginId={pluginId}
                                    todo={todo}
                                    currentUserId={currentUserId}
                                    currentUserName={currentUserName}
                                    videoUrl={videoUrl}
                                    onOpenNotes={handleOpenTodoNotes}
                                    activeTimer={activeTimer}
                                    elapsedSeconds={elapsedSeconds}
                                />
                            ))}
                            {items.length === 0 && (
                                <p className="text-xs text-slate-400 italic text-center py-2">No tasks yet</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isCurrentUser && (
                <div className="shrink-0 p-2 md:p-3 border-t border-slate-700 bg-[#2b2b30]">
                    <form onSubmit={handleAddTodo} className="flex gap-2">
                        <Input
                            value={newTodo}
                            onChange={(e) => setNewTodo(e.target.value)}
                            placeholder="Add a task..."
                            className="h-9 text-sm bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500"
                        />
                        <Button type="submit" size="sm" className="h-9 w-9 p-0 bg-[#2d936c] hover:bg-[#237a58] shrink-0" disabled={adding || !newTodo.trim()}>
                            <Plus className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
