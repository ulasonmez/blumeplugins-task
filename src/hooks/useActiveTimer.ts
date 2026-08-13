"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ActiveTimer } from "@/types/timeTracking";

interface UseActiveTimerResult {
    activeTimer: (ActiveTimer & { id: string }) | null;
    elapsedSeconds: number;
    isLoading: boolean;
}

export function useActiveTimer(uid: string | undefined): UseActiveTimerResult {
    const [activeTimer, setActiveTimer] = useState<(ActiveTimer & { id: string }) | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveTimer(null);
            setElapsedSeconds(0);
            setIsLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(
            doc(db, "activeTimers", uid),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as ActiveTimer;
                    setActiveTimer({ id: docSnap.id, ...data });
                } else {
                    setActiveTimer(null);
                    setElapsedSeconds(0);
                }
                setIsLoading(false);
            },
            (error) => {
                console.error("Error listening to active timer:", error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [uid]);

    useEffect(() => {
        if (!activeTimer?.startedAt) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setElapsedSeconds(0);
            return;
        }

        const calculateElapsed = () => {
            const now = Date.now();
            const startedAt = activeTimer.startedAt.toMillis();
            const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
            setElapsedSeconds(elapsed);
        };

        calculateElapsed();
        const intervalId = setInterval(calculateElapsed, 1000);

        return () => clearInterval(intervalId);
    }, [activeTimer]);

    return { activeTimer, elapsedSeconds, isLoading };
}
