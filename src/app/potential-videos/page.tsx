"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PotentialVideo = {
    id: string;
    url: string;
    title?: string;
    order?: number;
    createdAt?: { toMillis?: () => number };
};

const getYouTubeId = (url: string) => {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
};

const getHost = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return url;
    }
};

const fetchTitle = async (url: string): Promise<string | null> => {
    try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return typeof data.title === "string" && data.title ? data.title : null;
    } catch {
        return null;
    }
};

const normalizeUrl = (value: string) => {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

function VideoCard({ video, onDelete }: { video: PotentialVideo; onDelete: (video: PotentialVideo) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: video.id });
    const videoId = getYouTubeId(video.url);
    const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            {...attributes}
            {...listeners}
            className={`group relative cursor-grab active:cursor-grabbing rounded-lg overflow-hidden ${isDragging ? "z-50 opacity-80 ring-2 ring-[#2d936c] scale-105" : ""}`}
            onClick={() => window.open(video.url, "_blank", "noopener,noreferrer")}
        >
            <div className="aspect-video bg-[#2b2b30] relative overflow-hidden">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(video); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-2 left-2 z-20 bg-black/70 hover:bg-red-600 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title="Sil"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt="" draggable={false} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">No Thumbnail</div>
                )}
            </div>
            <div className="p-3 bg-[#3c8558] group-hover:bg-[#34754d] transition-colors text-center">
                <p className="text-white text-sm font-medium line-clamp-2" title={video.title || video.url}>{video.title || getHost(video.url)}</p>
            </div>
        </div>
    );
}

export default function PotentialVideosPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [videos, setVideos] = useState<PotentialVideo[]>([]);
    const [url, setUrl] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const isSuperAdmin = user?.displayName === "Ulas";

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!u) router.push("/auth");
            else setUser(u);
            setLoading(false);
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!user) return;
        if (!isSuperAdmin) {
            router.replace("/");
            return;
        }
        const unsub = onSnapshot(collection(db, "potentialVideos"), (snap) => {
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PotentialVideo));
            data.sort((a, b) => {
                const oa = a.order ?? Number.MIN_SAFE_INTEGER;
                const ob = b.order ?? Number.MIN_SAFE_INTEGER;
                if (oa !== ob) return oa - ob;
                return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
            });
            setVideos(data);
        }, (err) => {
            console.error("Error fetching potential videos:", err);
            setError("Videolar yüklenemedi.");
        });
        return () => unsub();
    }, [user, isSuperAdmin, router]);

    // Başlığı olmayan (eski) videolar için başlığı bir kez çekip kaydet
    const [triedTitles] = useState(() => new Set<string>());
    useEffect(() => {
        if (!isSuperAdmin) return;
        videos.filter((v) => !v.title && !triedTitles.has(v.id)).forEach(async (v) => {
            triedTitles.add(v.id);
            const title = await fetchTitle(v.url);
            if (title) updateDoc(doc(db, "potentialVideos", v.id), { title }).catch(() => {});
        });
    }, [videos, isSuperAdmin, triedTitles]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim() || submitting) return;
        setSubmitting(true);
        setError("");
        try {
            const normalized = normalizeUrl(url);
            new URL(normalized);
            // Yeni video listenin başına gelsin
            const minOrder = videos.reduce((min, v) => Math.min(min, v.order ?? 0), 0);
            const title = await fetchTitle(normalized);
            await addDoc(collection(db, "potentialVideos"), {
                url: normalized,
                ...(title ? { title } : {}),
                order: minOrder - 1,
                createdAt: serverTimestamp(),
            });
            setUrl("");
        } catch (err) {
            console.error("Error adding potential video:", err);
            setError("Geçerli bir link girin.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (video: PotentialVideo) => {
        if (!confirm("Bu video silinsin mi?")) return;
        try {
            await deleteDoc(doc(db, "potentialVideos", video.id));
        } catch (err) {
            console.error("Error deleting potential video:", err);
            setError("Silinemedi.");
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = videos.findIndex((v) => v.id === active.id);
        const newIndex = videos.findIndex((v) => v.id === over.id);
        const reordered = arrayMove(videos, oldIndex, newIndex);
        setVideos(reordered);
        try {
            const batch = writeBatch(db);
            reordered.forEach((v, index) => batch.update(doc(db, "potentialVideos", v.id), { order: index }));
            await batch.commit();
        } catch (err) {
            console.error("Error reordering potential videos:", err);
            setError("Sıralama kaydedilemedi.");
        }
    };

    if (loading || !user || !isSuperAdmin) {
        return <div className="flex items-center justify-center min-h-screen bg-[#1e1e24] text-white">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-[#1e1e24] text-white font-sans overflow-x-hidden">
            <header className="py-8 px-4 flex flex-col items-center gap-4 relative">
                <Link href="/" className="lg:absolute lg:top-8 lg:left-8 flex items-center gap-2 text-slate-400 hover:text-[#a8e6cf] transition-colors">
                    <ArrowLeft className="w-5 h-5" /> Ana sayfa
                </Link>
                <h1 className="text-4xl md:text-5xl text-[#a8e6cf] tracking-wider drop-shadow-md text-center">Potansiyel Videolar</h1>
            </header>

            <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 border-b border-slate-700 pb-4">
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://youtube.com/..."
                        className="bg-[#2b2b30] border-slate-600 text-white placeholder:text-slate-500 text-base"
                    />
                    <Button type="submit" disabled={submitting || !url.trim()} className="bg-[#2d936c] hover:bg-[#237a58] text-white sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" /> {submitting ? "Ekleniyor..." : "Ekle"}
                    </Button>
                </form>
                {error && <p className="text-red-400 text-sm">{error}</p>}

                {videos.length === 0 ? (
                    <div className="text-center py-10 bg-[#2b2b30] rounded-lg border border-dashed border-slate-600">
                        <p className="text-slate-400">Henüz video yok. Bir link ekle!</p>
                    </div>
                ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={videos.map((v) => v.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {videos.map((video) => (
                                    <VideoCard key={video.id} video={video} onDelete={handleDelete} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}
            </main>
        </div>
    );
}
