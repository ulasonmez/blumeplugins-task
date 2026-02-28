"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { PluginList } from "@/components/PluginList";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDoc, collection, serverTimestamp, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { Plus, LogOut, Youtube } from "lucide-react";

import { SharedNotepad } from "@/components/SharedNotepad";
import Link from "next/link";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newPluginName, setNewPluginName] = useState("");
  const [newPluginVideo, setNewPluginVideo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [hasYoutubersAccess, setHasYoutubersAccess] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "plugins"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pluginsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlugins(pluginsData);
    }, (error) => {
      console.error("Error fetching plugins:", error);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/auth");
      } else {
        setUser(currentUser);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    if (user.displayName === "Ulas") {
      setHasYoutubersAccess(true);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "youtubers_members", user.uid), (snap) => {
      setHasYoutubersAccess(snap.exists());
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth");
  };

  const handleAddPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPluginName || !newPluginVideo) return;

    setSubmitting(true);
    try {
      const pluginRef = await addDoc(collection(db, "plugins"), {
        name: newPluginName,
        videoUrl: newPluginVideo,
        description: null,
        createdByUid: user.uid,
        createdByName: user.displayName,
        createdAt: serverTimestamp(),
      });

      // Add creator as owner in members subcollection
      const { setDoc, doc } = await import("firebase/firestore");
      await setDoc(doc(db, "plugins", pluginRef.id, "members", user.uid), {
        displayName: user.displayName,
        role: "owner",
        joinedAt: serverTimestamp(),
      });
      setIsAddOpen(false);
      setNewPluginName("");
      setNewPluginVideo("");
    } catch (error) {
      console.error("Error adding plugin:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#1e1e24] text-white font-sans overflow-x-hidden">
      {/* Header */}
      <header className="py-8 px-4 flex flex-col items-center gap-6 relative">
        <h1 className="text-5xl font-minecraft text-[#a8e6cf] tracking-wider drop-shadow-md text-center">
          Blume Plugins
        </h1>

        {/* User Profile - Responsive */}
        <div className="flex items-center gap-4 mt-2 lg:absolute lg:top-8 lg:right-8 lg:mt-0">
          {hasYoutubersAccess && (
            <Link href="/youtubers">
              <Button variant="ghost" size="icon" title="YouTubers" className="text-slate-400 hover:text-white hover:bg-transparent">
                <Youtube className="w-6 h-6" />
              </Button>
            </Link>
          )}
          <SharedNotepad />
          <span className="text-xl lg:text-2xl font-bold text-white">{user.displayName}</span>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout" className="text-slate-400 hover:text-white hover:bg-transparent">
            <LogOut className="w-6 h-6" />
          </Button>
        </div>

        {/* Filters Removed */}
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Stats and Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-700 pb-4">
          <h2 className="text-xl text-slate-300 font-medium w-full md:w-auto text-center md:text-left">
            {filteredPlugins.length} Plugins
          </h2>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#2b2b30] border-slate-600 text-white placeholder:text-slate-500 w-full md:w-64 text-base"
            />
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2d936c] hover:bg-[#237a58] text-white w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[95vw] max-w-lg rounded-lg">
                <DialogHeader>
                  <DialogTitle>Add New Plugin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddPlugin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Plugin Name</Label>
                    <Input
                      id="name"
                      value={newPluginName}
                      onChange={(e) => setNewPluginName(e.target.value)}
                      required
                      className="bg-[#1e1e24] border-slate-600 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="video">Video URL</Label>
                    <Input
                      id="video"
                      value={newPluginVideo}
                      onChange={(e) => setNewPluginVideo(e.target.value)}
                      placeholder="https://youtube.com/..."
                      required
                      className="bg-[#1e1e24] border-slate-600 text-base"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#2d936c] hover:bg-[#237a58]" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Plugin"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <div className="flex items-center gap-2">
              {/* User info moved to header */}
            </div>
          </div>
        </div>

        <PluginList currentUser={user} plugins={filteredPlugins} />
      </main>
    </div>
  );
}
