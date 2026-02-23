import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAK2_yEZjnQlh1kecTT4YhXqnypmbIvauU',
  authDomain: 'dn--clan.firebaseapp.com',
  databaseURL: 'https://dn--clan-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'dn--clan',
  storageBucket: 'dn--clan.firebasestorage.app',
  messagingSenderId: '512950012763',
  appId: '1:512950012763:web:73ec664e3c6051a53ce87e'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
