"use client";

import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPen, Pencil, Eye } from "lucide-react";
import { LinkifiedText } from "@/components/LinkifiedText";

export function SharedNotepad() {
    const [content, setContent] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
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
            } else {
                const initialText = snap.data()?.content || "";
                setContent(initialText);
                setIsEditing(!initialText.trim());
            }
        };
        ensureDocExists();
    }, [isOpen]);

    // Effect for real-time updates when not actively typing
    useEffect(() => {
        if (!isOpen) return;
        const docRef = doc(db, "system", "shared_notepad");
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const newContent = docSnap.data().content || "";
                // Only update if the textarea is NOT focused or content is empty
                if (document.activeElement !== textareaRef.current || content === "") {
                    setContent(newContent);
                }
            }
        });
        return () => unsubscribe();
    }, [isOpen, content]);

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
            <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[90vw] max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 pb-3 border-b border-slate-700">
                    <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xl font-bold">Shared Notepad</span>
                        <div className="flex items-center gap-3 mr-8">
                            <span className="text-xs font-normal text-slate-400">
                                {isSaving ? "Kaydediliyor..." : "Otomatik kaydedildi"}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsEditing(!isEditing)}
                                className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 gap-1.5 h-8 text-xs"
                            >
                                {isEditing ? (
                                    <>
                                        <Eye className="w-3.5 h-3.5" />
                                        Önizle
                                    </>
                                ) : (
                                    <>
                                        <Pencil className="w-3.5 h-3.5" />
                                        Düzenle
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 mt-3 min-h-0 overflow-hidden">
                    {isEditing ? (
                        <Textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleChange}
                            autoFocus
                            className="w-full h-full bg-[#1e1e24] border-slate-600 resize-none text-base md:text-lg leading-relaxed p-4 focus-visible:ring-1 focus-visible:ring-[#2d936c]"
                            placeholder="Buraya bir şeyler yazın... Linkleriniz mavi ve tıklanabilir olarak görüntülenecektir."
                        />
                    ) : (
                        <div className="w-full h-full bg-[#1e1e24] border border-slate-600 rounded-md p-4 md:p-6 overflow-y-auto text-base md:text-lg leading-relaxed">
                            {content.trim() ? (
                                <LinkifiedText text={content} />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                                    <p className="italic">Henüz not eklenmedi.</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                        className="border-slate-600 text-slate-300 hover:text-white"
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-1" /> Not Yaz
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


