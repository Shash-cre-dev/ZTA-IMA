import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    DocumentSnapshot,
    Bytes
} from "firebase/firestore";
import app from "../config";


const db = getFirestore(app);

export const getBytes = (arrBuf: ArrayBuffer):Bytes => {
    return Bytes.fromUint8Array(new Uint8Array(arrBuf));
}

export const bytesToArray = (bytesData: Bytes):Uint8Array => {
    return bytesData.toUint8Array();
}

export const addKeysToDb = async (userId: string, publicKey: Object, privateKey: ArrayBuffer, iv: string) => {
    if (process.env.DEBUG) {
        console.log("Adding keys to database");
    }
    const privKeyAsBytes = getBytes(privateKey);
    let error = null;
    try {
        const docRef = await setDoc(doc(db, "keys", userId), {
            userId,
            publicKey,
            privateKey: privKeyAsBytes,
            iv
        })
    } catch (e: any) {
        error = e;
    }

    return error;
};

export const getKeysFromUserId = async (userId: string) => {
    let error: any = null;
    let docRef: DocumentSnapshot | null = null;
    try {
        docRef = await getDoc(doc(db, "keys", userId));
    } catch(e: any) {
        error = e;
    }

    return { docRef, error };

}

// Get public key of a user
export const getPublicKeyFromUserId = async (userId: string) => {
    try {
        const docRef = await getDoc(doc(db, "keys", userId));
        if (docRef.data()) {
            return docRef.data()?.publicKey;
        }
    } catch (e: any) {
        console.log(`Error fetching public key: ${e}`);
    }
}