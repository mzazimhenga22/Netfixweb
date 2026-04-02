// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB4GOl2RKNTna6anAJKkLjr43A_F4Vv1yE",
  authDomain: "movieflixreactnative.firebaseapp.com",
  projectId: "movieflixreactnative",
  storageBucket: "movieflixreactnative.firebasestorage.app",
  messagingSenderId: "792382812631",
  appId: "1:792382812631:web:f7cf50db59d6f06db5db92",
  measurementId: "G-1JFSNMPBNP"
};

// Initialize Firebase (SSR safe)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics safely on the client
let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, analytics };
