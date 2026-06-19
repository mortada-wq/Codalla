import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, PhoneAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCP6Dmwkye9OJSq7qohkKd2eclTrrCQq2o',
  authDomain: 'yallasahib.firebaseapp.com',
  projectId: 'yallasahib',
  storageBucket: 'yallasahib.firebasestorage.app',
  messagingSenderId: '124854453769',
  appId: '1:124854453769:web:6f8ffb95dd347826011ad8',
  measurementId: 'G-EC85WMCEQ6',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
export const phoneProvider = new PhoneAuthProvider(auth);
