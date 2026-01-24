"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AuthPage() {
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !password.trim()) return;

        setLoading(true);
        setError("");

        try {
            // Deterministic credential generation for email
            const normalizedName = name.trim().toLowerCase()
                .replace(/\s+/g, '.')
                .replace(/[ğüşıöç]/g, (c) => {
                    const map: Record<string, string> = { 'ğ': 'g', 'ü': 'u', 'ş': 's', 'ı': 'i', 'ö': 'o', 'ç': 'c' };
                    return map[c] || c;
                });

            const email = `${normalizedName}@plugin-tasks.local`;

            if (isRegistering) {
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    const user = userCredential.user;

                    // Update profile
                    await updateProfile(user, { displayName: name.trim() });

                    // Create user doc
                    await setDoc(doc(db, "users", user.uid), {
                        displayName: name.trim(),
                        email: email,
                        createdAt: serverTimestamp(),
                    });
                } catch (err: any) {
                    if (err.code === 'auth/email-already-in-use') {
                        throw new Error("This username is already taken. Please try another one or log in.");
                    }
                    throw err;
                }
            } else {
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                } catch (err: any) {
                    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                        throw new Error("Invalid username or password.");
                    }
                    throw err;
                }
            }

            router.push("/");
        } catch (err: any) {
            // Only log unknown errors to avoid Next.js error overlay for expected auth errors
            if (err.message !== "Invalid username or password." && err.message !== "This username is already taken. Please try another one or log in.") {
                console.error(err);
            }
            setError(err.message || "Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1e1e24] p-4">
            <Card className="w-full max-w-md bg-[#2b2b30] border-slate-600 text-white shadow-xl">
                <CardHeader className="space-y-2">
                    <CardTitle className="text-2xl text-[#a8e6cf] tracking-wide text-center">
                        {isRegistering ? "Create Account" : "Welcome Back"}
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-center">
                        {isRegistering ? "Enter your details to get started" : "Enter your credentials to continue"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Username</label>
                                <Input
                                    placeholder="e.g. johndoe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={loading}
                                    required
                                    className="bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500 h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-300">Password</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                    className="bg-[#1e1e24] border-slate-600 text-white placeholder:text-slate-500 h-11"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm flex items-center gap-2 bg-red-900/20 p-3 rounded-md border border-red-900/50">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-[#2d936c] hover:bg-[#237a58] text-white font-bold h-11" disabled={loading}>
                            {loading ? "Please wait..." : (isRegistering ? "Sign Up" : "Sign In")}
                        </Button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegistering(!isRegistering);
                                    setError("");
                                }}
                                className="text-sm text-slate-400 hover:text-[#a8e6cf] transition-colors hover:underline"
                            >
                                {isRegistering ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
