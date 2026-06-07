import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import config from "../firebase-applet-config.json";

export const app = initializeApp(config);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  databaseId: config.firestoreDatabaseId
});
