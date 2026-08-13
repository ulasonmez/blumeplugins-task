"use client";

import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { PluginCard } from "./PluginCard";

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PluginListProps {
    currentUser: User;
    plugins: Record<string, unknown>[];
    isAdmin?: boolean;
    onReorder?: (plugins: Record<string, unknown>[]) => void;
}

function SortablePluginItem({ plugin, currentUser, isAdmin }: { plugin: Record<string, unknown>, currentUser: User, isAdmin: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: plugin.id, disabled: !isAdmin });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`h-full w-full transition-shadow ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "z-50 shadow-2xl rounded-lg bg-[#1e1e24] ring-2 ring-[#2d936c] scale-105 opacity-80 relative" : ""}`}
        >
            <PluginCard
                plugin={plugin}
                currentUser={currentUser}
                isAdmin={isAdmin}
            />
        </div>
    );
}

export function PluginList({ currentUser, plugins, isAdmin = false, onReorder }: PluginListProps) {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMounted(true);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Ensures normal clicks on buttons inside the card still work
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = plugins.findIndex((p) => p.id === active.id);
            const newIndex = plugins.findIndex((p) => p.id === over.id);

            const newPlugins = arrayMove(plugins, oldIndex, newIndex);
            if (onReorder) {
                onReorder(newPlugins);
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={plugins.map((p) => p.id)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plugins.map((plugin) => (
                        <SortablePluginItem
                            key={plugin.id}
                            plugin={plugin}
                            currentUser={currentUser}
                            isAdmin={isAdmin}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
