"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt: Timestamp;
}

interface PluginChatProps {
    pluginId: string;
    currentUserId: string;
    currentUserName: string;
}

export function PluginChat({ pluginId, currentUserId, currentUserName }: PluginChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Refs for state accessed inside closure
    const isOpenRef = useRef(isOpen);
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        isOpenRef.current = isOpen;
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    useEffect(() => {
        const q = query(collection(db, "plugins", pluginId, "messages"), orderBy("createdAt", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);

            if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;
                return;
            }

            // Handle unread count
            if (!isOpenRef.current) {
                // If closed, increment unread for new messages
                const newMessagesCount = snapshot.docChanges().filter(c => c.type === 'added').length;
                if (newMessagesCount > 0) {
                    setUnreadCount(prev => prev + newMessagesCount);
                }
            }
        }, (error) => {
            console.error("Error fetching messages:", error);
        });

        return () => unsubscribe();
    }, [pluginId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const messageToSend = newMessage.trim();

        if (!messageToSend) return;

        // Optimistic clear
        setNewMessage("");

        try {
            await addDoc(collection(db, "plugins", pluginId, "messages"), {
                text: messageToSend,
                senderId: currentUserId,
                senderName: currentUserName,
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error sending message:", error);
            // Optional: Restore message on error? For now, we just log.
            // setNewMessage(messageToSend); 
        }
    };

    const formatTime = (timestamp: Timestamp) => {
        if (!timestamp) return "";
        const date = timestamp.toDate();
        return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(date);
    };

    return (
        <div className={cn("fixed bottom-4 right-4 z-50 flex flex-col items-end transition-all duration-300", isOpen ? "w-80" : "w-auto")}>
            {/* Header / Toggle Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="bg-[#2d936c] hover:bg-[#237a58] text-white p-3 rounded-t-lg shadow-lg cursor-pointer flex items-center justify-between w-full transition-colors"
            >
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-bold">Chat</span>
                    {!isOpen && unreadCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center ml-1 animate-pulse">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>

            {/* Chat Body */}
            {isOpen && (
                <div className="w-full h-96 bg-[#1e1e24] border-x border-b border-slate-600 shadow-2xl flex flex-col rounded-b-lg">
                    {/* Messages Area */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent"
                    >
                        {messages.length === 0 && (
                            <p className="text-center text-slate-500 text-sm mt-10">No messages yet. Say hi!</p>
                        )}

                        {messages.map((msg) => {
                            const isMe = msg.senderId === currentUserId;
                            return (
                                <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-xs text-slate-400 font-medium">{msg.senderName}</span>
                                        <span className="text-[10px] text-slate-600">{formatTime(msg.createdAt)}</span>
                                    </div>
                                    <div
                                        className={cn(
                                            "px-3 py-2 rounded-lg text-sm max-w-[85%] break-words",
                                            isMe
                                                ? "bg-[#2d936c] text-white rounded-tr-none"
                                                : "bg-[#2b2b30] text-slate-200 border border-slate-600 rounded-tl-none"
                                        )}
                                    >
                                        {msg.text}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-3 bg-[#2b2b30] border-t border-slate-600 flex gap-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500 text-sm focus-visible:ring-[#2d936c]"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={!newMessage.trim()}
                            className="bg-[#2d936c] hover:bg-[#237a58] text-white shrink-0"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            )}
        </div>
    );
}
