"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Pencil, Trash2 } from "lucide-react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PluginCardProps {
    plugin: {
        id: string;
        name: string;
        videoUrl: string;
        description?: string;
        createdByName: string;
    };
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    prioritizeThumbnail?: boolean;
}

type ProgressTodo = {
    createdByUid: string;
    completed: boolean;
};

export function PluginCard({ plugin, isAdmin = false, isSuperAdmin = false, prioritizeThumbnail = false }: PluginCardProps) {
    const router = useRouter();
    const cardRef = useRef<HTMLDivElement>(null);
    const [todos, setTodos] = useState<ProgressTodo[]>([]);
    const [members, setMembers] = useState<{ uid: string }[]>([]);
    
    // Edit Dialog State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editName, setEditName] = useState(plugin.name);
    const [editUrl, setEditUrl] = useState(plugin.videoUrl);
    const [submitting, setSubmitting] = useState(false);

    // Extract YouTube ID
    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const videoId = getYouTubeId(plugin.videoUrl);
    const thumbnailUrl = videoId
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        : null;

    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;

        const subscribeToProgress = () => {
            const todosQuery = query(collection(db, "plugins", plugin.id, "todos"), orderBy("createdAt", "asc"));
            const unsubscribeTodos = onSnapshot(todosQuery, (snapshot) => {
                setTodos(snapshot.docs.map(doc => doc.data() as ProgressTodo));
            });
            const unsubscribeMembers = onSnapshot(collection(db, "plugins", plugin.id, "members"), (snapshot) => {
                setMembers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
            });
            return () => {
                unsubscribeTodos();
                unsubscribeMembers();
            };
        };

        if (typeof IntersectionObserver === "undefined") {
            return subscribeToProgress();
        }

        let unsubscribe: (() => void) | undefined;
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some(entry => entry.isIntersecting) || unsubscribe) return;
            observer.disconnect();
            unsubscribe = subscribeToProgress();
        }, { rootMargin: "300px 0px" });
        observer.observe(card);

        return () => {
            observer.disconnect();
            observer.takeRecords();
            unsubscribe?.();
        };
    }, [plugin.id]);

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await updateDoc(doc(db, "plugins", plugin.id), {
                name: editName,
                videoUrl: editUrl,
            });
            setIsEditOpen(false);
        } catch (error) {
            console.error("Error updating plugin:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this plugin?")) {
            try {
                await deleteDoc(doc(db, "plugins", plugin.id));
            } catch (error) {
                console.error("Error deleting plugin:", error);
            }
        }
    };

    const memberTodos: Record<string, ProgressTodo[]> = {};
    members.forEach(m => {
        memberTodos[m.uid] = [];
    });

    todos.forEach(todo => {
        if (memberTodos[todo.createdByUid]) {
            memberTodos[todo.createdByUid].push(todo);
        }
    });

    let totalProgressSum = 0;
    let membersWithTasksCount = 0;

    members.forEach(member => {
        const memberTodosList = memberTodos[member.uid] || [];
        const memberTotal = memberTodosList.length;
        const memberCompleted = memberTodosList.filter(t => t.completed).length;

        if (memberTotal > 0) {
            totalProgressSum += (memberCompleted / memberTotal);
            membersWithTasksCount++;
        }
    });

    const progress = membersWithTasksCount > 0
        ? Math.round((totalProgressSum / membersWithTasksCount) * 100)
        : 0;

    const total = todos.length;
    // isCompleted is true if progress is 100%
    const isCompleted = total > 0 && progress === 100;

    return (
        <>
            <div
                ref={cardRef}
                className={cn(
                    "group relative cursor-pointer flex flex-col h-full transition-all duration-300 rounded-lg overflow-hidden border border-transparent",
                    isCompleted
                        ? "opacity-80 hover:opacity-100 bg-[#1e2320] border-[#2d936c]/30"
                        : "" // Normal state handled by children or defaults
                )}
                onClick={() => router.push(`/plugin/${plugin.id}`)}
            >
                {/* Thumbnail */}
                <div className="aspect-video bg-[#2b2b30] overflow-hidden relative">
                    {/* Status Overlay */}
                    {isCompleted && (
                        <div className="absolute top-2 right-2 z-10 bg-[#2d936c] text-white p-1 rounded-full shadow-lg">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                    )}

                    {/* Admin Actions Overlay */}
                    {(isAdmin || isSuperAdmin) && (
                        <div className="absolute top-2 left-2 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsEditOpen(true); }}
                                className="bg-black/70 hover:bg-black text-white p-1.5 rounded transition-colors"
                                title="Edit Plugin"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleDelete}
                                className="bg-black/70 hover:bg-red-600 text-white p-1.5 rounded transition-colors"
                                title="Delete Plugin"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={plugin.name}
                            loading={prioritizeThumbnail ? "eager" : "lazy"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                            No Thumbnail
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={cn(
                    "p-4 flex-1 flex flex-col items-center justify-center text-center shadow-lg transition-colors",
                    isCompleted
                        ? "bg-[#235c45] group-hover:bg-[#2d936c]"
                        : "bg-[#3c8558] group-hover:bg-[#34754d]"
                )}>
                    <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow-sm mb-1">
                        {plugin.name}
                    </h3>
                    {total > 0 && (
                        <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            isCompleted ? "bg-[#a8e6cf] text-[#1e2320]" : "bg-black/20 text-white/80"
                        )}>
                            {progress}% Done
                        </span>
                    )}
                </div>
            </div>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[95vw] max-w-lg rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Plugin</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Plugin Name</Label>
                            <Input
                                id="name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                                className="bg-[#1e1e24] border-slate-600 text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="video">Video URL</Label>
                            <Input
                                id="video"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                placeholder="https://youtube.com/..."
                                required
                                className="bg-[#1e1e24] border-slate-600 text-base"
                            />
                        </div>
                        <Button type="submit" className="w-full bg-[#2d936c] hover:bg-[#237a58]" disabled={submitting}>
                            {submitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
