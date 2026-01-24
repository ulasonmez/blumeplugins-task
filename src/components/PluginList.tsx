"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PluginCard } from "./PluginCard";
import { User } from "firebase/auth";

interface PluginListProps {
    currentUser: User;
    plugins: any[];
}

export function PluginList({ currentUser, plugins }: PluginListProps) {
    // Internal fetching removed

    // Loading handled by parent or assumed loaded for now

    if (plugins.length === 0) {
        return (
            <div className="text-center py-10 bg-[#2b2b30] rounded-lg border border-dashed border-slate-600">
                <p className="text-slate-400">No plugins found. Add one to get started!</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plugins.map(plugin => (
                <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    currentUser={currentUser}
                />
            ))}
        </div>
    );
}
