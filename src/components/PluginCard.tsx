"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, CheckCircle } from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserTodoSection } from "./UserTodoSection";
import { User } from "firebase/auth";
import { cn } from "@/lib/utils";

interface PluginCardProps {
    plugin: {
        id: string;
        name: string;
        videoUrl: string;
        description?: string;
        createdByName: string;
    };
    currentUser: User;
}

export function PluginCard({ plugin, currentUser }: PluginCardProps) {
    const router = useRouter();
    const [todos, setTodos] = useState<any[]>([]);

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
        const q = query(collection(db, "plugins", plugin.id, "todos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTodos(todosData);
        });
        return () => unsubscribe();
    }, [plugin.id]);

    const userGroups: Record<string, any[]> = {};
    userGroups[currentUser.uid] = [];

    todos.forEach(todo => {
        if (!userGroups[todo.createdByUid]) {
            userGroups[todo.createdByUid] = [];
        }
        userGroups[todo.createdByUid].push(todo);
    });

    const getUserName = (uid: string) => {
        if (uid === currentUser.uid) return currentUser.displayName || "Me";
        const todo = todos.find(t => t.createdByUid === uid);
        return todo ? todo.createdByName : "Unknown User";
    };

    const total = todos.length;
    const completed = todos.filter(t => t.completed).length;
    const isCompleted = total > 0 && total === completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
        <div
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

                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={plugin.name}
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
    );
}
