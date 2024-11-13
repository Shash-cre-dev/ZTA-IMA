'use client'

import app from "../config";
import { getAuth, signOut } from "firebase/auth";

const auth = getAuth(app);

export default async function signOutUser() {
    let error:any = null;
    try {
        await signOut(auth);
        window.localStorage.clear();
    } catch(e: any) {
        error = e;
    }

    return error;
}