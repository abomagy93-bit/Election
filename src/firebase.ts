import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import config from "../firebase-applet-config.json";

export const app = initializeApp(config);
export const db = getFirestore(app);
