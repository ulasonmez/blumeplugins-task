"use client";

import { useEffect, useState } from "react";

type ToastMessage = {
  id: number;
  message: string;
};

let toastId = 0;
let listeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];

export function toast(message: string) {
  const id = ++toastId;
  toasts = [...toasts, { id, message }];
  listeners.forEach((listener) => listener(toasts));

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((listener) => listener(toasts));
  }, 3000);
}

export function Toaster() {
  const [currentToasts, setCurrentToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (newToasts: ToastMessage[]) => setCurrentToasts(newToasts);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {currentToasts.map((t) => (
        <div
          key={t.id}
          className="bg-slate-800 text-white border border-slate-700 rounded-md px-4 py-2 shadow-lg text-sm pointer-events-auto transition-all animate-in slide-in-from-bottom-5"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
