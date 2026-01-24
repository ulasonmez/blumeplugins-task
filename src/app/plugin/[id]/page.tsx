"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, orderBy, onSnapshot, setDoc, serverTimestamp, getDocs, where } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Users, UserPlus, ShieldAlert } from "lucide-react";
import { UserTodoSection } from "@/components/UserTodoSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PluginChat } from "@/components/PluginChat";

export default function PluginDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [plugin, setPlugin] = useState<any>(null);
    const [todos, setTodos] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMember, setIsMember] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    // Member management state
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [newMemberName, setNewMemberName] = useState("");
    const [addingMember, setAddingMember] = useState(false);
    const [addMemberError, setAddMemberError] = useState("");

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push("/auth");
            } else {
                setUser(currentUser);
            }
        });
        return () => unsubscribe();
    }, [router]);

    useEffect(() => {
        if (!id || !user) return;

        const fetchPlugin = async () => {
            const docRef = doc(db, "plugins", id as string);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setPlugin({ id: docSnap.id, ...docSnap.data() });
            } else {
                router.push("/");
            }
        };

        fetchPlugin();

        // Listen to members
        const membersQ = query(collection(db, "plugins", id as string, "members"));
        const unsubscribeMembers = onSnapshot(membersQ, async (snapshot) => {
            const membersData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
            setMembers(membersData);

            // Check membership
            const memberRecord = membersData.find(m => m.uid === user.uid);
            const isUserMember = !!memberRecord;
            setIsMember(isUserMember);
            setIsOwner(memberRecord?.role === "owner");

            // Legacy migration: If no members exist but user is creator, add them as owner
            if (membersData.length === 0 && plugin && plugin.createdByUid === user.uid) {
                console.log("Migrating legacy plugin: Adding creator as owner");
                await setDoc(doc(db, "plugins", id as string, "members", user.uid), {
                    displayName: user.displayName,
                    role: "owner",
                    joinedAt: serverTimestamp(),
                });
            }

            setLoading(false);
        });

        // Listen to todos (only if member, but we can listen anyway and filter in UI or let rules fail)
        // Ideally we only listen if isMember is true to avoid permission errors if rules are strict
        // But for now let's keep it simple and handle the "not member" state in UI
        const q = query(collection(db, "plugins", id as string, "todos"), orderBy("createdAt", "asc"));
        const unsubscribeTodos = onSnapshot(q, (snapshot) => {
            const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTodos(todosData);
        }, (error) => {
            // Ignore permission errors if not member
            if (error.code !== 'permission-denied') {
                console.error("Error fetching todos:", error);
            }
        });

        return () => {
            unsubscribeMembers();
            unsubscribeTodos();
        };
    }, [id, router, user, plugin?.createdByUid]); // Added plugin.createdByUid dependency for migration check

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim()) return;

        setAddingMember(true);
        setAddMemberError("");

        try {
            // Find user by displayName
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("displayName", "==", newMemberName.trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setAddMemberError("User not found.");
                setAddingMember(false);
                return;
            }

            const userToAdd = querySnapshot.docs[0];
            const userData = userToAdd.data();

            // Check if already a member
            if (members.find(m => m.uid === userToAdd.id)) {
                setAddMemberError("User is already a member.");
                setAddingMember(false);
                return;
            }

            // Add to members subcollection
            await setDoc(doc(db, "plugins", id as string, "members", userToAdd.id), {
                displayName: userData.displayName,
                role: "member",
                joinedAt: serverTimestamp(),
            });

            setNewMemberName("");
            // Keep dialog open to add more
        } catch (error) {
            console.error("Error adding member:", error);
            setAddMemberError("Failed to add member.");
        } finally {
            setAddingMember(false);
        }
    };

    if (loading || !user || !plugin) {
        return <div className="min-h-screen bg-[#1e1e24] flex items-center justify-center text-white">Loading...</div>;
    }

    // Access Denied View
    if (!isMember) {
        return (
            <div className="min-h-screen bg-[#1e1e24] text-white p-6 flex flex-col items-center justify-center space-y-6">
                <ShieldAlert className="w-16 h-16 text-red-500" />
                <h1 className="text-3xl font-bold text-[#a8e6cf]">Access Restricted</h1>
                <p className="text-slate-400 text-center max-w-md">
                    This plugin's workspace is private. You must be a member to view or contribute to the tasks.
                </p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => router.push("/")} className="border-slate-500 text-slate-300 hover:text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                    </Button>
                    {/* Future: Add "Request Access" button */}
                </div>
            </div>
        );
    }

    // Group todos by user (only for members)
    // We only show sections for users who are MEMBERS.
    // If a non-member created a todo (e.g. before they were removed), it might be hidden or shown under "Unknown".
    // Let's iterate over MEMBERS to create sections.

    const memberTodos: Record<string, any[]> = {};
    members.forEach(m => {
        memberTodos[m.uid] = [];
    });

    todos.forEach(todo => {
        if (memberTodos[todo.createdByUid]) {
            memberTodos[todo.createdByUid].push(todo);
        } else {
            // Handle todos from users who are no longer members?
            // For now, maybe just ignore them or add them if we want to see history.
            // Let's stick to showing only current members' active panels as per requirement "UI da sadece onları render eder"
        }
    });

    // Extract YouTube ID
    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    return (
        <div className="min-h-screen bg-[#1e1e24] text-white p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.push("/")} className="text-slate-400 hover:text-white">
                        <ArrowLeft className="w-6 h-6 mr-2" /> Back
                    </Button>
                    <h1 className="text-3xl font-bold text-[#a8e6cf]">{plugin.name}</h1>
                    <a
                        href={plugin.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-[#2d936c]"
                    >
                        <ExternalLink className="w-6 h-6" />
                    </a>
                </div>

                <div className="flex items-center gap-2">
                    <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700">
                                <Users className="w-4 h-4 mr-2" />
                                {members.length} Members
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#2b2b30] border-slate-600 text-white">
                            <DialogHeader>
                                <DialogTitle>Manage Members</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-6 mt-4">
                                {/* Member List */}
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {members.map(member => (
                                        <div key={member.uid} className="flex items-center justify-between p-2 bg-[#1e1e24] rounded border border-slate-700">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{member.displayName}</span>
                                                {member.role === 'owner' && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/50">Owner</Badge>}
                                            </div>
                                            {/* Future: Remove member button (if owner) */}
                                        </div>
                                    ))}
                                </div>

                                {/* Add Member (Owner only) */}
                                {isOwner && (
                                    <div className="space-y-3 pt-4 border-t border-slate-700">
                                        <h4 className="text-sm font-medium text-slate-400">Add New Member</h4>
                                        <form onSubmit={handleAddMember} className="flex gap-2">
                                            <Input
                                                placeholder="Enter username..."
                                                value={newMemberName}
                                                onChange={(e) => setNewMemberName(e.target.value)}
                                                className="bg-[#1e1e24] border-slate-600"
                                            />
                                            <Button type="submit" className="bg-[#2d936c] hover:bg-[#237a58]" disabled={addingMember}>
                                                {addingMember ? "Adding..." : <UserPlus className="w-4 h-4" />}
                                            </Button>
                                        </form>
                                        {addMemberError && <p className="text-red-400 text-sm">{addMemberError}</p>}
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Todos Sections - Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-0">
                {members.map(member => (
                    <UserTodoSection
                        key={member.uid}
                        pluginId={plugin.id}
                        userId={member.uid}
                        userName={member.displayName}
                        todos={memberTodos[member.uid] || []}
                        currentUserId={user.uid}
                        videoUrl={plugin.videoUrl}
                    />
                ))}
            </div>

            {/* Chat Widget */}
            <PluginChat
                pluginId={plugin.id}
                currentUserId={user.uid}
                currentUserName={user.displayName || "Anonymous"}
            />
        </div>
    );
}
