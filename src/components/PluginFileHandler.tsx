"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, FileDown, Trash2, FileArchive, Loader2 } from "lucide-react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { format } from "date-fns";

interface PluginFileHandlerProps {
    pluginId: string;
    isMember: boolean;
    currentUserId: string;
}

interface PluginFile {
    id: string;
    name: string;
    url: string;
    uploadedBy: string;
    uploadedAt: any;
    size: number;
    path: string;
}

export function PluginFileHandler({ pluginId, isMember, currentUserId }: PluginFileHandlerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<PluginFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !pluginId) return;

        const q = query(collection(db, "plugins", pluginId, "files"), orderBy("uploadedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PluginFile));
            setFiles(filesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, pluginId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.zip')) {
            alert("Only .zip files are allowed.");
            return;
        }

        setUploading(true);
        try {
            const storagePath = `plugins/${pluginId}/files/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            await addDoc(collection(db, "plugins", pluginId, "files"), {
                name: file.name,
                url: downloadURL,
                path: storagePath,
                uploadedBy: currentUserId,
                uploadedAt: serverTimestamp(),
                size: file.size
            });

        } catch (error) {
            console.error("Error uploading file:", error);
            alert("Failed to upload file.");
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleDelete = async (file: PluginFile) => {
        if (!confirm("Are you sure you want to delete this file?")) return;

        try {
            const storageRef = ref(storage, file.path);
            await deleteObject(storageRef);
            await deleteDoc(doc(db, "plugins", pluginId, "files", file.id));
        } catch (error) {
            console.error("Error deleting file:", error);
            alert("Failed to delete file.");
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!isMember) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700 w-full md:w-auto">
                    <FileArchive className="w-4 h-4 mr-2" />
                    Files
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2b2b30] border-slate-600 text-white w-[95vw] max-w-2xl rounded-lg">
                <DialogHeader>
                    <DialogTitle>Plugin Files</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Upload Section */}
                    <div className="flex items-center gap-4 p-4 border border-dashed border-slate-600 rounded-lg bg-[#1e1e24]/50">
                        <Input
                            type="file"
                            accept=".zip"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                            disabled={uploading}
                        />
                        <Label
                            htmlFor="file-upload"
                            className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${uploading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-[#2d936c] hover:bg-[#237a58] text-white'}`}
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                            {uploading ? "Uploading..." : "Upload .zip"}
                        </Label>
                        <span className="text-sm text-slate-400">
                            Only .zip files containing JSON and PNG are allowed.
                        </span>
                    </div>

                    {/* File List */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8 text-slate-500">Loading files...</div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">No files uploaded yet.</div>
                        ) : (
                            files.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-3 bg-[#1e1e24] rounded border border-slate-700 hover:border-slate-600 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-slate-800 rounded">
                                            <FileArchive className="w-5 h-5 text-[#a8e6cf]" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate text-slate-200">{file.name}</span>
                                            <span className="text-xs text-slate-500">
                                                {formatFileSize(file.size)} • {file.uploadedAt?.toDate ? format(file.uploadedAt.toDate(), 'MMM d, yyyy HH:mm') : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <a
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-400 hover:text-[#a8e6cf] hover:bg-slate-800 rounded transition-colors"
                                            title="Download"
                                        >
                                            <FileDown className="w-4 h-4" />
                                        </a>
                                        {file.uploadedBy === currentUserId && (
                                            <button
                                                onClick={() => handleDelete(file)}
                                                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
