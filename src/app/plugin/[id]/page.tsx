"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, orderBy, onSnapshot, setDoc, serverTimestamp, getDocs, where, updateDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Users, UserPlus, ShieldAlert, ScrollText, CheckCircle2, Circle, Trash2, LogIn, Plus } from "lucide-react";
import { logPluginAction } from "@/lib/logger";
import { UserTodoSection } from "@/components/UserTodoSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
    const [logs, setLogs] = useState<any[]>([]);
    const [isLogsOpen, setIsLogsOpen] = useState(false);

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
            const isUserAdmin = user.displayName === "Ulas" || user.displayName === "Emir";
            const isUserMember = !!memberRecord || isUserAdmin;
            setIsMember(isUserMember);
            setIsOwner(memberRecord?.role === "owner" || isUserAdmin);

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

        // Listen to todos (only if member)
        let unsubscribeTodos = () => { };
        let unsubscribeLogs = () => { };

        if (isMember) {
            const q = query(collection(db, "plugins", id as string, "todos"), orderBy("createdAt", "asc"));
            unsubscribeTodos = onSnapshot(q, (snapshot) => {
                const todosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTodos(todosData);
            }, (error) => {
                console.error("Error fetching todos:", error);
            });
            
            const logsQ = query(collection(db, "plugins", id as string, "logs"), orderBy("timestamp", "desc"));
            unsubscribeLogs = onSnapshot(logsQ, (snapshot) => {
                const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLogs(logsData);
            }, (error) => {
                console.error("Error fetching logs:", error);
            });
        } else {
            setTodos([]);
            setLogs([]);
        }

        return () => {
            unsubscribeMembers();
            unsubscribeTodos();
            unsubscribeLogs();
        };
    }, [id, router, user, plugin?.createdByUid, isMember]); // Added isMember dependency

    // Log page entry
    useEffect(() => {
        if (!id || !user || !isMember) return;
        
        const sessionKey = `plugin_visited_${id}_${user.uid}`;
        if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, "true");
            logPluginAction(
                id as string,
                "entered_page",
                "Viewed the plugin page",
                user.uid,
                user.displayName || "Anonymous"
            );
        }
    }, [id, user, isMember]);

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
            setAddMemberError("Failed to add user. Ensure username is correct.");
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (memberUid: string) => {
        if (!isOwner) return;
        if (confirm("Are you sure you want to remove this member?")) {
            try {
                await deleteDoc(doc(db, "plugins", id as string, "members", memberUid));
            } catch (error) {
                console.error("Error removing member:", error);
                alert("Failed to remove member. You might not have permission.");
            }
        }
    };

    const handleUpdateDate = async (field: 'startDate' | 'endDate', value: string) => {
        if (!plugin || !id) return;

        try {
            const docRef = doc(db, "plugins", id as string);
            await updateDoc(docRef, {
                [field]: value
            });
            setPlugin((prev: any) => ({ ...prev, [field]: value }));
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
        }
    };

    const calculateDuration = () => {
        if (!plugin?.startDate) return null;

        const start = new Date(plugin.startDate);
        const end = plugin.endDate ? new Date(plugin.endDate) : new Date();

        // Reset times to midnight for accurate day calculation
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (plugin.endDate) {
            return `Took ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        } else {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} running`;
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

    // Calculate progress based on members
    // Each member contributes equally to the total progress (100% / members.length)
    let totalProgressSum = 0;
    const activeMembersCount = members.length;

    if (activeMembersCount > 0) {
        members.forEach(member => {
            const memberTodosList = memberTodos[member.uid] || [];
            const memberTotal = memberTodosList.length;
            const memberCompleted = memberTodosList.filter(t => t.completed).length;

            if (memberTotal > 0) {
                totalProgressSum += (memberCompleted / memberTotal);
            } else {
                // If a member has no todos, they contribute 0 to the progress
                totalProgressSum += 0;
            }
        });
    }

    const progressPercentage = activeMembersCount > 0
        ? Math.round((totalProgressSum / activeMembersCount) * 100)
        : 0;
        
    const groupedLogs = logs.reduce((groups: any, log: any) => {
        if (!log.timestamp) return groups;
        
        const date = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        const dateString = new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
        
        if (!groups[dateString]) {
            groups[dateString] = [];
        }
        groups[dateString].push(log);
        return groups;
    }, {});
    
    const getLogIcon = (action: string) => {
        switch (action) {
            case "added_todo": return <Plus className="w-4 h-4 text-blue-400" />;
            case "completed_todo": return <CheckCircle2 className="w-4 h-4 text-green-400" />;
            case "uncompleted_todo": return <Circle className="w-4 h-4 text-slate-400" />;
            case "deleted_todo": return <Trash2 className="w-4 h-4 text-red-400" />;
            case "entered_page": return <LogIn className="w-4 h-4 text-yellow-400" />;
            default: return <ScrollText className="w-4 h-4 text-slate-400" />;
        }
    };
    
    const getLogActionText = (action: string) => {
        switch (action) {
            case "added_todo": return "added a task";
            case "completed_todo": return "completed a task";
            case "uncompleted_todo": return "uncompleted a task";
            case "deleted_todo": return "deleted a task";
            case "entered_page": return "viewed the page";
            default: return "performed an action";
        }
    };

    return (
        <div className="h-[100dvh] overflow-hidden bg-[#1e1e24] text-white p-4 md:p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-6 shrink-0">
                <Button variant="ghost" onClick={() => router.push("/")} className="text-slate-400 hover:text-white p-0 md:p-4 shrink-0">
                    <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="hidden md:inline ml-1">Back</span>
                </Button>
                <h1 className="text-lg md:text-3xl font-bold text-[#a8e6cf] truncate flex-1 min-w-0">{plugin.name}</h1>
                <a
                    href={plugin.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-[#2d936c] shrink-0"
                >
                    <ExternalLink className="w-4 h-4 md:w-6 md:h-6" />
                </a>
                <div className="flex items-center gap-2 shrink-0">
                    <Progress value={progressPercentage} className="w-16 md:w-32 h-2 bg-slate-700" indicatorClassName="bg-[#2d936c]" />
                    <span className="text-xs font-medium text-slate-400 w-7 text-right">{progressPercentage}%</span>
                </div>
                
                <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 shrink-0 px-2 md:px-3">
                            <ScrollText className="w-4 h-4" />
                            <span className="hidden md:inline ml-2">Logs</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[95vw] max-w-2xl rounded-lg h-[80vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Activity Logs</DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 overflow-y-auto space-y-6 mt-4 pr-2">
                            {Object.keys(groupedLogs).length === 0 ? (
                                <p className="text-slate-400 text-center py-4 text-sm">No activity logs yet.</p>
                            ) : (
                                Object.keys(groupedLogs).map(dateStr => (
                                    <div key={dateStr} className="space-y-3">
                                        <div className="sticky top-0 bg-[#2b2b30]/95 backdrop-blur py-1 z-10 border-b border-slate-700">
                                            <h4 className="text-sm font-bold text-[#a8e6cf]">{dateStr}</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {groupedLogs[dateStr].map((log: any) => (
                                                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg bg-[#1e1e24] border border-slate-700/50">
                                                    <div className="mt-0.5 p-1.5 bg-[#2b2b30] rounded-md border border-slate-700 shadow-sm">
                                                        {getLogIcon(log.action)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between gap-2">
                                                            <p className="text-sm">
                                                                <span className="font-semibold text-slate-200">{log.userName}</span>
                                                                <span className="text-slate-400 mx-1">{getLogActionText(log.action)}</span>
                                                            </p>
                                                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                                {log.timestamp ? new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp)) : ''}
                                                            </span>
                                                        </div>
                                                        {log.details && log.action !== "entered_page" && (
                                                            <p className="text-sm text-slate-300 mt-1 truncate max-w-full italic border-l-2 border-slate-600 pl-2">"{log.details}"</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
                
                <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 shrink-0 px-2 md:px-3">
                            <Users className="w-4 h-4" />
                            <span className="hidden md:inline ml-2">{members.length} Members</span>
                        </Button>
                    </DialogTrigger>
                        <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[95vw] max-w-lg rounded-lg">
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
                                            {isOwner && member.role !== 'owner' && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => handleRemoveMember(member.uid)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-7 px-2"
                                                >
                                                    Remove
                                                </Button>
                                            )}
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
                                                className="bg-[#1e1e24] border-slate-600 text-base"
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

            {/* Date Range Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:w-fit gap-2 sm:gap-3 mb-3 md:mb-4 bg-[#2b2b30] p-2 md:p-3 rounded-lg border border-slate-700 shrink-0">
                <div className="flex items-center gap-2">
                    <Label htmlFor="startDate" className="text-sm font-medium text-slate-400 whitespace-nowrap w-10">Start:</Label>
                    <Input
                        type="date"
                        id="startDate"
                        value={plugin.startDate || ""}
                        onChange={(e) => handleUpdateDate('startDate', e.target.value)}
                        className="bg-[#1e1e24] border-slate-600 text-sm h-9 flex-1 sm:w-36 sm:flex-none [color-scheme:dark]"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="endDate" className="text-sm font-medium text-slate-400 whitespace-nowrap w-10">End:</Label>
                    <Input
                        type="date"
                        id="endDate"
                        value={plugin.endDate || ""}
                        onChange={(e) => handleUpdateDate('endDate', e.target.value)}
                        className="bg-[#1e1e24] border-slate-600 text-sm h-9 flex-1 sm:w-36 sm:flex-none [color-scheme:dark]"
                    />
                </div>
                {plugin.startDate && (
                    <Badge variant="outline" className="bg-[#2d936c]/10 text-[#a8e6cf] border-[#2d936c]/30 px-2 py-1 text-xs whitespace-nowrap self-start sm:self-auto">
                        {calculateDuration()}
                    </Badge>
                )}
            </div>

            {/* Todos Sections - Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 min-h-0 overflow-y-auto pr-2 auto-rows-[70dvh] md:auto-rows-[calc(100dvh-14rem)]">
                {members.map(member => (
                    <UserTodoSection
                        key={member.uid}
                        pluginId={plugin.id}
                        userId={member.uid}
                        userName={member.displayName}
                        todos={memberTodos[member.uid] || []}
                        currentUserId={user.uid}
                        currentUserName={user.displayName || "Anonymous"}
                        videoUrl={plugin.videoUrl}
                    />
                ))}
            </div>

        </div >
    );
}
