'use client'

import React from "react";
import ClipLoader from "react-spinners/ClipLoader";
import {
    getAuth,
    onAuthStateChanged,
    User
} from "firebase/auth";

import app from "@/firebase/config";

const auth = getAuth(app);

type AuthContextType = {
    user: User | null;
    loggedInNow: boolean;
    setLoggedInNow: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AuthContext = React.createContext<AuthContextType>({user: null, loggedInNow: false, setLoggedInNow:() => {}});

export const useAuthContext = () => React.useContext(AuthContext);


type Props = {
    children: React.ReactNode
}


export const AuthContextProvider = ({
    children
}: Props) => {
    const [user, setUser] = React.useState<User|null>(null);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [loggedInNow, setLoggedInNow] = React.useState<boolean>(false);
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user) {
                setUser(user);
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    },[]);

    return (
        <AuthContext.Provider value={{user: user, loggedInNow: loggedInNow, setLoggedInNow}}>
            {
                loading?<div className="w-screen h-screen flex items-center justify-center">
                    <ClipLoader />
                </div>:children
            }
            
        </AuthContext.Provider>
    );
}