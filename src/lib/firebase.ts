import { initializeFirestore } from "firebase/firestore";
import { app, auth } from "@/lib/firebaseAuth";

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export { app, auth, db };
