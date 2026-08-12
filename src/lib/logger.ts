import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type LogAction = 
    | "added_todo" 
    | "completed_todo" 
    | "uncompleted_todo" 
    | "deleted_todo" 
    | "entered_page";

export const logPluginAction = async (
    pluginId: string,
    action: LogAction,
    details: string,
    uid: string,
    userName: string
) => {
    try {
        await addDoc(collection(db, "plugins", pluginId, "logs"), {
            action,
            details,
            uid,
            userName,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to log plugin action:", error);
    }
};
