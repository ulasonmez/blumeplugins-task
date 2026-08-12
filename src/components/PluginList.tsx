"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PluginCard } from "./PluginCard";
import { User } from "firebase/auth";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface PluginListProps {
    currentUser: User;
    plugins: any[];
    isAdmin?: boolean;
    onReorder?: (plugins: any[]) => void;
}

export function PluginList({ currentUser, plugins, isAdmin = false, onReorder }: PluginListProps) {
    // Determine if we are rendering on client
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (plugins.length === 0) {
        return (
            <div className="text-center py-10 bg-[#2b2b30] rounded-lg border border-dashed border-slate-600">
                <p className="text-slate-400">No plugins found. Add one to get started!</p>
            </div>
        );
    }

    if (!isMounted) {
        return null;
    }

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        if (result.source.index === result.destination.index) return;

        const items = Array.from(plugins);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        if (onReorder) {
            onReorder(items);
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="plugins" direction="horizontal">
                {(provided) => (
                    <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        {plugins.map((plugin, index) => (
                            <Draggable 
                                key={plugin.id} 
                                draggableId={plugin.id} 
                                index={index} 
                                isDragDisabled={!isAdmin}
                            >
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                    >
                                        <PluginCard
                                            plugin={plugin}
                                            currentUser={currentUser}
                                            isAdmin={isAdmin}
                                        />
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}
