import {
    getFirestore,
    collection,
    getDoc,
    setDoc,
    doc,
    where,
    query,
    getDocs,
} from "firebase/firestore";
import app from "../config";
import { v4 as uuidv4 } from "uuid";


const db = getFirestore(app);

export const addUser = async (userId: string, fullName: string, email: string) => {
    let error = null, docRef = null;
    try {
        docRef = await setDoc(doc(db, "users", userId), {
            userId,
            fullName,
            email,
        });
    } catch (e: any) {
        error = e;
    }

    return { docRef, error }
}

export const getUserFromEmail = async (email: string) => {
    const q = query(collection(db, "users"), where("email", "==", email));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        return querySnapshot.docs[0].data();

    } catch (e: any) {
        return e;
    }

}

export type userConnectionType = {
    userId: string,
    fullName: string,
    sessionId: string
}

export const getUserConnections = async (uid: string) => {
    let connections: userConnectionType[] = [];

    try {
        const docRef = collection(db, "users", uid, "connections");
        const docSnap = await getDocs(docRef);

        docSnap.forEach((doc) => {
            connections.push(doc.data() as userConnectionType);
        })

    } catch (e: any) {
        console.log(e);
    }

    return connections;

}

export const createSession = async (uid1: string, uid2: string) => {

    const sessionId = uuidv4();
    const userName1 = await getUserDisplayName(uid1);
    const userName2 = await getUserDisplayName(uid2);

    // Add the session to each user's connections 
    // Document ID is the uid of the other user
    try {
        const newConnection1: userConnectionType = {
            userId: uid2,
            sessionId: sessionId,
            fullName: userName2,
        }

        const newConnection2: userConnectionType = {
            userId: uid1,
            sessionId: sessionId,
            fullName: userName1,
        }

        await setDoc(doc(db, `users`, uid1, "connections", uid2), newConnection1);

        await setDoc(doc(db, "users", uid2, "connections", uid1), newConnection2);



        return newConnection1;
    } catch (e: any) {
        console.log(e);
    }

}

export const getUserDisplayName = async (uid: string) => {
    let displayName: string = "";

    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            displayName = docSnap.data().fullName;
        }
    } catch (e: any) {
        console.log(e);
    }

    return displayName;
}
