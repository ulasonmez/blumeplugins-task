"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ActiveTimer } from "@/types/timeTracking";

export function useActiveTimer(uid: string | undefined, pluginId: string): ActiveTimer | null {
    const [result, setResult] = useState<{ uid: string; pluginId: string; timer: ActiveTimer | null } | null>(null);

    useEffect(() => {
        if (!uid || !pluginId) return;

        const timerRef = doc(db, "activeTimers", `${uid}_${pluginId}`);
        const legacyTimerRef = doc(db, "activeTimers", uid);
        let unsubscribeLegacy: (() => void) | undefined;

        const unsubscribe = onSnapshot(timerRef, (snapshot) => {
            if (snapshot.exists()) {
                unsubscribeLegacy?.();
                unsubscribeLegacy = undefined;
                setResult({ uid, pluginId, timer: snapshot.data() as ActiveTimer });
                return;
            }
            if (unsubscribeLegacy) return;

            setResult({ uid, pluginId, timer: null });
            unsubscribeLegacy = onSnapshot(legacyTimerRef, (legacySnapshot) => {
                const legacy = legacySnapshot.data() as ActiveTimer | undefined;
                setResult({ uid, pluginId, timer: legacy?.pluginId === pluginId ? legacy : null });
            }, (error) => {
                console.error("Error listening to legacy active timer:", error);
            });
        }, (error) => {
            unsubscribeLegacy?.();
            setResult({ uid, pluginId, timer: null });
            console.error("Error listening to active timer:", error);
        });

        return () => {
            unsubscribe();
            unsubscribeLegacy?.();
        };
    }, [uid, pluginId]);

    return result?.uid === uid && result?.pluginId === pluginId ? result.timer : null;
}

export function useElapsedSeconds(startedAt: Pick<Timestamp, "toMillis"> | undefined): number {
    const startMillis = startedAt?.toMillis();
    const [clock, setClock] = useState<{ startMillis: number; seconds: number } | null>(null);

    useEffect(() => {
        if (startMillis === undefined) return;

        const tick = () => {
            setClock({ startMillis, seconds: Math.max(0, Math.floor((Date.now() - startMillis) / 1000)) });
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [startMillis]);

    return clock && clock.startMillis === startMillis ? clock.seconds : 0;
}
