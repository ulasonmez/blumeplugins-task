"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserTodoSection } from "./UserTodoSection";
import { User } from "firebase/auth";

interface PluginCardAccordionProps {
    plugin: {
        id: string;
        name: string;
        videoUrl: string;
        description?: string;
    };
    currentUser: User;
}

export function PluginCardAccordion({ plugin, currentUser }: PluginCardAccordionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [todos, setTodos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch todos only when expanded or initially to show some stats? 
    // Requirement: "Progress recalculates instantly". So we should probably fetch always or when in view.
    // For MVP, let's fetch always for simplicity, or just when expanded?
    // If we fetch only when expanded, we can't show summary progress on the card if we wanted to.
    // But the design doesn't explicitly ask for summary progress on the collapsed card.
    // However, "Realtime sync for both users" implies we should probably listen.
    // Let's listen always for now to ensure data is fresh.

    useEffect(() => {
        const q = query(collection(db, "plugins", plugin.id, "todos"), orderBy("createdAt", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTodos(todosData);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [plugin.id]);

    // Group todos by user
    // We need to identify "users". The requirement says "Two user sections".
    // We can dynamically find users from the todos.
    // Also we should always show the CURRENT user's section even if empty.
    // And maybe show other users who have todos.

    const userGroups: Record<string, any[]> = {};

    // Initialize current user group
    userGroups[currentUser.uid] = [];

    todos.forEach(todo => {
        if (!userGroups[todo.createdByUid]) {
            userGroups[todo.createdByUid] = [];
        }
        userGroups[todo.createdByUid].push(todo);
    });

    // We also need the display names. The todos store createdByName.
    // For the current user, we know the name.
    // For others, we can get it from their todos.

    const getUserName = (uid: string) => {
        if (uid === currentUser.uid) return currentUser.displayName || "Me";
        const todo = todos.find(t => t.createdByUid === uid);
        return todo ? todo.createdByName : "Unknown User";
    };

    return (
        <Card className="overflow-hidden">
            <div className="p-4 flex items-center justify-between bg-white">
                <div className="flex flex-col gap-1">
                    <a
                        href={plugin.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-bold text-slate-800 hover:text-blue-600 hover:underline flex items-center gap-2"
                    >
                        {plugin.name}
                        <ExternalLink className="w-4 h-4 opacity-50" />
                    </a>
                    {plugin.description && (
                        <p className="text-sm text-slate-500">{plugin.description}</p>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(!isOpen)}
                    className="shrink-0"
                >
                    {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </Button>
            </div>

            {isOpen && (
                <div className="border-t bg-slate-50 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.keys(userGroups).map(uid => (
                            <UserTodoSection
                                key={uid}
                                pluginId={plugin.id}
                                userId={uid}
                                userName={getUserName(uid)}
                                todos={userGroups[uid]}
                                currentUserId={currentUser.uid}
                                videoUrl={plugin.videoUrl}
                            />
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}
