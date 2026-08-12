"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { collection, onSnapshot, query, orderBy, doc, writeBatch, deleteDoc, updateDoc } from "firebase/firestore";
import { ArrowLeft, ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine, Edit2, Trash2, Plus } from "lucide-react";
import Link from "next/link";
import { regenerateRoleplayModsJson } from "@/app/actions/roleplayMods";

interface RoleplayMod {
  id: string;
  title: string;
  videoUrl: string;
  version: string;
  badge: string;
  order: number;
}

export default function RoleplayModsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<RoleplayMod[]>([]);
  
  // Add form state
  const [addTitle, setAddTitle] = useState("");
  const [addLink, setAddLink] = useState("");
  const [addBadge, setAddBadge] = useState("");
  const [addNote, setAddNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Edit form state
  const [editItem, setEditItem] = useState<RoleplayMod | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editBadge, setEditBadge] = useState("");
  const [editNote, setEditNote] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Global loading state for mutations
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
      } else {
        const isAdmin = currentUser.displayName === "Ulas" || currentUser.displayName === "Emir";
        if (!isAdmin) {
          router.push("/");
        } else {
          setUser(currentUser);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, "roleplayMods"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleplayMod));
      setVideos(videosData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching roleplay mods:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding || isMutating) return;

    const title = addTitle.trim();
    const link = addLink.trim();
    const badge = addBadge.trim();
    const note = addNote.trim();

    if (!title || !link) return;

    setIsAdding(true);
    setIsMutating(true);
    
    try {
      const { doc: firestoreDoc, collection } = await import("firebase/firestore");
      const newRef = firestoreDoc(collection(db, "roleplayMods"));
      
      const newOrder = videos.length > 0 ? Math.max(...videos.map(v => v.order)) + 1 : 0;
      
      const batch = writeBatch(db);
      batch.set(newRef, {
        title,
        videoUrl: link,
        badge,
        version: note,
        order: newOrder
      });
      
      await batch.commit();

      await regenerateRoleplayModsJson();
      fetch('/roleplay-mods.json').catch(e => {});

      setAddTitle("");
      setAddLink("");
      setAddBadge("");
      setAddNote("");
    } catch (error) {
      console.error("Error adding video:", error);
      alert("Failed to add video. Please try again.");
    } finally {
      setIsAdding(false);
      setIsMutating(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || isEditing || isMutating) return;

    const title = editTitle.trim();
    const link = editLink.trim();
    const badge = editBadge.trim();
    const note = editNote.trim();

    if (!title || !link) return;

    setIsEditing(true);
    setIsMutating(true);

    try {
      const docRef = doc(db, "roleplayMods", editItem.id);
      await updateDoc(docRef, {
        title,
        videoUrl: link,
        badge,
        version: note
      });
      
      await regenerateRoleplayModsJson();
      fetch('/roleplay-mods.json').catch(e => {});

      setEditItem(null);
    } catch (error) {
      console.error("Error updating video:", error);
      alert("Failed to update video.");
    } finally {
      setIsEditing(false);
      setIsMutating(false);
    }
  };

  const openEditModal = (video: RoleplayMod) => {
    setEditItem(video);
    setEditTitle(video.title);
    setEditLink(video.videoUrl);
    setEditBadge(video.badge || "");
    setEditNote(video.version || "");
  };

  const handleDelete = async (id: string, title: string) => {
    if (isMutating) return;
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    setIsMutating(true);
    try {
      // Create new list without the deleted item, then normalize orders
      const remaining = videos.filter(v => v.id !== id);
      const batch = writeBatch(db);
      
      batch.delete(doc(db, "roleplayMods", id));
      
      remaining.forEach((v, index) => {
        if (v.order !== index) {
          batch.update(doc(db, "roleplayMods", v.id), { order: index });
        }
      });
      
      await batch.commit();

      await regenerateRoleplayModsJson();
      fetch('/roleplay-mods.json').catch(e => {});
    } catch (error) {
      console.error("Error deleting video:", error);
      alert("Failed to delete video.");
    } finally {
      setIsMutating(false);
    }
  };

  const handleReorder = async (currentIndex: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (isMutating) return;
    
    let newVideos = [...videos];
    const [item] = newVideos.splice(currentIndex, 1);
    
    if (direction === 'up') {
      newVideos.splice(currentIndex - 1, 0, item);
    } else if (direction === 'down') {
      newVideos.splice(currentIndex + 1, 0, item);
    } else if (direction === 'top') {
      newVideos.unshift(item);
    } else if (direction === 'bottom') {
      newVideos.push(item);
    }
    
    setIsMutating(true);
    try {
      const batch = writeBatch(db);
      newVideos.forEach((v, index) => {
        batch.update(doc(db, "roleplayMods", v.id), { order: index });
      });
      await batch.commit();

      await regenerateRoleplayModsJson();
      fetch('/roleplay-mods.json').catch(e => {});
    } catch (error) {
      console.error("Error reordering:", error);
      alert("Failed to reorder videos.");
    } finally {
      setIsMutating(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#1e1e24] flex items-center justify-center text-white">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1e1e24] text-white font-sans">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-700 pb-4">
          <Link href="/">
            <Button variant="ghost" className="text-slate-400 hover:text-white p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-[#a8e6cf]">Roleplay Mods Admin</h1>
        </div>

        {/* Add Form */}
        <div className="bg-[#2b2b30] p-6 rounded-lg border border-slate-700 space-y-6">
          <h2 className="text-xl font-bold text-white mb-4">Add Roleplay Mod Video</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-title">Title</Label>
                <Input
                  id="add-title"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  className="bg-[#1e1e24] border-slate-600"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-link">Link</Label>
                <Input
                  id="add-link"
                  value={addLink}
                  onChange={(e) => setAddLink(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="bg-[#1e1e24] border-slate-600"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-badge">Badge</Label>
                <Input
                  id="add-badge"
                  value={addBadge}
                  onChange={(e) => setAddBadge(e.target.value)}
                  className="bg-[#1e1e24] border-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-note">Note / README</Label>
                <Input
                  id="add-note"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  className="bg-[#1e1e24] border-slate-600"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isAdding || isMutating} className="bg-[#2d936c] hover:bg-[#237a58]">
                {isAdding ? "Adding..." : "Add Video"}
              </Button>
            </div>
          </form>
        </div>

        {/* Management Table */}
        <div className="bg-[#2b2b30] rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-xl font-bold text-white">Roleplay Mods ({videos.length})</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#1e1e24] border-b border-slate-700 text-sm text-slate-400">
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Link</th>
                  <th className="p-4 font-medium">Note / README</th>
                  <th className="p-4 font-medium">Badge</th>
                  <th className="p-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {videos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No Roleplay Mods added yet.
                    </td>
                  </tr>
                ) : (
                  videos.map((video, index) => (
                    <tr key={video.id} className="border-b border-slate-700/50 hover:bg-[#1e1e24]/50 group">
                      <td className="p-4 font-medium">{video.title}</td>
                      <td className="p-4 text-slate-400">
                        <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#a8e6cf] truncate block max-w-[200px]">
                          {video.videoUrl}
                        </a>
                      </td>
                      <td className="p-4 text-slate-400 truncate max-w-[200px]">{video.version}</td>
                      <td className="p-4 text-slate-400">{video.badge}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={index === 0 || isMutating}
                            onClick={() => handleReorder(index, 'top')}
                            title="Move to Top"
                          >
                            <ArrowUpToLine className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={index === 0 || isMutating}
                            onClick={() => handleReorder(index, 'up')}
                            title="Move Up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={index === videos.length - 1 || isMutating}
                            onClick={() => handleReorder(index, 'down')}
                            title="Move Down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={index === videos.length - 1 || isMutating}
                            onClick={() => handleReorder(index, 'bottom')}
                            title="Move to Bottom"
                          >
                            <ArrowDownToLine className="w-4 h-4" />
                          </Button>
                          <div className="w-px h-6 bg-slate-700 mx-1"></div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={isMutating}
                            onClick={() => openEditModal(video)}
                            title="Edit"
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={isMutating}
                            onClick={() => handleDelete(video.id, video.title)}
                            title="Delete"
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="bg-[#2b2b30] border-slate-600 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Roleplay Mod Video</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-[#1e1e24] border-slate-600"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-link">Link</Label>
              <Input
                id="edit-link"
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                className="bg-[#1e1e24] border-slate-600"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-badge">Badge</Label>
              <Input
                id="edit-badge"
                value={editBadge}
                onChange={(e) => setEditBadge(e.target.value)}
                className="bg-[#1e1e24] border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Note / README</Label>
              <Input
                id="edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="bg-[#1e1e24] border-slate-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditItem(null)} className="text-slate-400">
                Cancel
              </Button>
              <Button type="submit" disabled={isEditing || isMutating} className="bg-[#2d936c] hover:bg-[#237a58]">
                {isEditing ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
