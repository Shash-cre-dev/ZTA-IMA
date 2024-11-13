import app from "../config";
import { addUser } from "../database/usersdb";

import {
    getAuth,
    createUserWithEmailAndPassword,
    updateProfile
} from "firebase/auth";

const auth = getAuth(app);

export default async function signUp (name: string, email: string, password: string) {
    let result = null, error = null;
    try {
        result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, {
            displayName: name,
        });

        await addUser(result.user.uid, name, email);
    

    } catch(e: any) {
        error = e;
    }

    return { result, error };

}