"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserTodoSection } from "./UserTodoSection";
import { User } from "firebase/auth";

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

    return (
        <>
            <div
                className="group relative cursor-pointer flex flex-col h-full"
                onClick={() => router.push(`/plugin/${plugin.id}`)}
            >
                {/* Badge */}
                {/* Badge Removed */}

                {/* Thumbnail */}
                <div className="aspect-video bg-[#2b2b30] overflow-hidden rounded-t-lg relative">
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
                <div className="bg-[#3c8558] p-4 rounded-b-lg flex-1 flex items-center justify-center text-center shadow-lg group-hover:bg-[#34754d] transition-colors">
                    <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow-sm">
                        {plugin.name}
                    </h3>
                </div>
            </div>
        </>
    );
}
