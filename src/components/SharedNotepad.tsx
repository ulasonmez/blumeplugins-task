"use client";

import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPen } from "lucide-react";

export function SharedNotepad() {
    const [content, setContent] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load initial data and subscribe to changes
    useEffect(() => {
        if (!isOpen) return;

        const docRef = doc(db, "system", "shared_notepad");

        // Create document if it doesn't exist
        const ensureDocExists = async () => {
            const snap = await getDoc(docRef);
            if (!snap.exists()) {
                await setDoc(docRef, { content: "" });
            }
        };
        ensureDocExists();

        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                // Only update if we are not currently typing (simple conflict avoidance)
                // Ideally we'd use a more complex OT/CRDT but for a simple shared notepad this might suffice
                // or we just update it. Let's update it but maybe check if focused?
                // Actually for a simple "everyone edits" real-time, just taking the latest is standard for simple apps,
                // but it might overwrite local changes if typing fast.
                // Let's just set content. The user will see updates.
                const newContent = doc.data().content || "";
                // To avoid cursor jumping or overwriting active typing, we could check difference
                // But for now let's just sync.
                if (document.activeElement !== textareaRef.current) {
                    setContent(newContent);
                } else {
                    // If user is typing, we might have a conflict. 
                    // For this simple request, we will prioritize local edits but maybe show a "remote changes" indicator?
                    // Or simpler: just let the debounce save overwrite. 
                    // Actually, if we don't update while typing, we miss other's edits.
                    // Let's try to be smart: if the content is vastly different, update. 
                    // For now, let's just update state. React might handle the cursor okay if we are careful.
                    // Actually, setting value on a focused textarea often moves cursor to end.
                    // Let's rely on the debounce save to push changes, and only pull if we are not the one saving?
                    // No, that's hard to track.

                    // Let's stick to: Update local state from DB only if it's different.
                    if (newContent !== content) {
                        // If the difference is just what we typed, don't overwrite?
                        // This is hard without a library like Yjs.
                        // Let's just accept that last write wins and we might overwrite each other.
                        // We will NOT update the text area from DB if the user is typing (focused) to prevent interruptions.
                        // This means you won't see other's changes while you type, until you blur or stop.
                        // That's a fair trade-off for a simple feature.
                    }
                }
            }
        });

        return () => unsubscribe();
    }, [isOpen]);

    // Separate effect for non-focused updates to avoid stale closures if we used the callback above
    useEffect(() => {
        if (!isOpen) return;
        const docRef = doc(db, "system", "shared_notepad");
        const unsubscribe = onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const newContent = doc.data().content || "";
                // Only update if the textarea is NOT focused, OR if the content is empty (initial load)
                if (document.activeElement !== textareaRef.current || content === "") {
                    setContent(newContent);
                }
            }
        });
        return () => unsubscribe();
    }, [isOpen]);


    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        setIsSaving(true);

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(async () => {
            try {
                await setDoc(doc(db, "system", "shared_notepad"), {
                    content: newContent,
                    lastUpdated: new Date()
                }, { merge: true });
                setIsSaving(false);
            } catch (error) {
                console.error("Error saving note:", error);
                setIsSaving(false);
            }
        }, 1000); // 1 second debounce
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-transparent" title="Shared Notepad">
                    <NotebookPen className="w-6 h-6" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[90vw] max-w-none h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Shared Notepad</span>
                        <span className="text-xs font-normal text-slate-400 mr-8">
                            {isSaving ? "Saving..." : "All changes saved"}
                        </span>
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 mt-4 min-h-0">
                    <Textarea
                        ref={textareaRef}
                        value={content}
                        onChange={handleChange}
                        className="w-full h-full bg-[#1e1e24] border-slate-600 resize-none text-lg leading-relaxed p-4 focus-visible:ring-1 focus-visible:ring-[#2d936c]"
                        placeholder="Type something here... Everyone can see this."
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
