import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup
} from 'firebase/auth';

const firebaseConfig = {
  projectId: "orbit-47436",
  appId: "1:332358648121:web:96faac13c526a582a328e8",
  storageBucket: "orbit-47436.firebasestorage.app",
  apiKey: "AIzaSyDEOWkX5vfkdibHzvfAGOsua8xAnkptn-8",
  authDomain: "orbit-47436.firebaseapp.com",
  messagingSenderId: "332358648121"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Scope Google authentication request to retrieve email & profile details
googleProvider.addScope('profile');
googleProvider.addScope('email');

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup
};
