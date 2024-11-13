import {
    getFirestore,
    collection,
    addDoc,
    query,
    Timestamp,
    orderBy,
    Bytes
} from "firebase/firestore";
import app from "../config";
import { encryptString } from "@/utils/cryptoFunctions";
import { getBytes, bytesToArray } from "./keymanagementdb";
const db = getFirestore(app);

// Type for session messages
export type sessionMessage = {
    userId: string,
    message: string
}

// Function to send an encrypted message
export const sendMessage = async (sessionId: string, userId: string, message: string, sharedKey: CryptoKey) => {
    // Encrypt the message using public key
    const { encryptedString, iv } = await encryptString(message, sharedKey);

    // Send message data to API
    const fd:FormData = new FormData();
    fd.append('userId', userId);
    fd.append('sessionId', sessionId);
    fd.append('message', new Blob([encryptedString]));
    fd.append('iv', new Blob([iv]));

    const res = await fetch("https://message-service-dot-zta-im.el.r.appspot.com/sendMessage", {
        method: 'POST',
        body: fd
    });
    
    return res.status;

    // NOTE: The Below code is no longer required since the addition of messages to database is handled by a saparate service 
    // try {
    //     const docRef = await addDoc(collection(db, "sessions", sessionId, "messages"), {
    //         userId,
    //         message: messageInBytes,
    //         iv: ivAsBytes,
    //         time: Timestamp.now()       
    //     });
    // } catch(e) {
    //     console.log(e);
    // }
};


// Get messages from the session
export const getSessionMessages = async (sessionId: string) => {
    // console.log(sessionId);
    let error;
    let sessionQuery;
    try {
        sessionQuery =  query(collection(db, "sessions", sessionId, "messages"), orderBy("time"));
        
    } catch(e: any) {
        console.log(e);
        error = e;
    }

    return { sessionQuery, error }
}