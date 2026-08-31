"use client";

import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPen, PenLine, Eye, Columns } from "lucide-react";
import { LinkifiedText } from "@/components/LinkifiedText";

export function SharedNotepad() {
    const [content, setContent] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");
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
            <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[90vw] max-w-none h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0 pb-3 border-b border-slate-700">
                    <DialogTitle className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-bold">Shared Notepad</span>
                            <div className="flex items-center bg-[#1e1e24] p-1 rounded-lg border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("edit")}
                                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                        viewMode === "edit"
                                            ? "bg-[#2d936c] text-white shadow-sm"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <PenLine className="w-3.5 h-3.5" />
                                    Düzenle
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("preview")}
                                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                        viewMode === "preview"
                                            ? "bg-[#2d936c] text-white shadow-sm"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    Önizleme (Linkler)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("split")}
                                    className={`hidden md:flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                        viewMode === "split"
                                            ? "bg-[#2d936c] text-white shadow-sm"
                                            : "text-slate-400 hover:text-white"
                                    }`}
                                >
                                    <Columns className="w-3.5 h-3.5" />
                                    Yan Yana
                                </button>
                            </div>
                        </div>
                        <span className="text-xs font-normal text-slate-400 mr-8">
                            {isSaving ? "Kaydediliyor..." : "Tüm değişiklikler kaydedildi"}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 mt-3 min-h-0 overflow-hidden">
                    {viewMode === "edit" && (
                        <Textarea
                            ref={textareaRef}
                            value={content}
                            onChange={handleChange}
                            className="w-full h-full bg-[#1e1e24] border-slate-600 resize-none text-base md:text-lg leading-relaxed p-4 focus-visible:ring-1 focus-visible:ring-[#2d936c]"
                            placeholder="Buraya bir şeyler yazın... Herkes bu notu görebilir. Eklediğiniz tüm linkler mavi ve tıklanabilir olacaktır."
                        />
                    )}

                    {viewMode === "preview" && (
                        <div className="w-full h-full bg-[#1e1e24] border border-slate-600 rounded-md p-4 overflow-y-auto text-base md:text-lg leading-relaxed">
                            {content.trim() ? (
                                <LinkifiedText text={content} />
                            ) : (
                                <p className="text-slate-500 italic">Henüz not eklenmedi.</p>
                            )}
                        </div>
                    )}

                    {viewMode === "split" && (
                        <div className="grid grid-cols-2 gap-3 h-full">
                            <div className="flex flex-col h-full min-h-0">
                                <span className="text-xs text-slate-400 font-medium mb-1 pl-1">Düzenleme</span>
                                <Textarea
                                    ref={textareaRef}
                                    value={content}
                                    onChange={handleChange}
                                    className="w-full flex-1 bg-[#1e1e24] border-slate-600 resize-none text-sm md:text-base leading-relaxed p-4 focus-visible:ring-1 focus-visible:ring-[#2d936c]"
                                    placeholder="Buraya bir şeyler yazın..."
                                />
                            </div>
                            <div className="flex flex-col h-full min-h-0">
                                <span className="text-xs text-slate-400 font-medium mb-1 pl-1">Canlı Önizleme & Mavi Linkler</span>
                                <div className="w-full flex-1 bg-[#1e1e24] border border-slate-600 rounded-md p-4 overflow-y-auto text-sm md:text-base leading-relaxed">
                                    {content.trim() ? (
                                        <LinkifiedText text={content} />
                                    ) : (
                                        <p className="text-slate-500 italic">Önizleme için metin girin.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}


