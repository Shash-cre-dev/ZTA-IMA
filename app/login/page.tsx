'use client'

import React from "react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import signIn from "@/firebase/auth/signin";
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/context/authContext";
import { unwrapSecretKey, deriveWrapKeyFromString, exportKeyAsJson } from "@/utils/cryptoFunctions";
import { getKeysFromUserId, bytesToArray } from "@/firebase/database/keymanagementdb";
const page = () => {
	const router = useRouter();
	const { user, setLoggedInNow } = useAuthContext();

	// Create state to store the password for setting up the keys
	const [userPassword, setUserPassword] = React.useState<string>("");
	const [showAlert, setShowAlert] = React.useState<boolean>();
	// Run the save keys function after the user state has changed
	React.useEffect(() => {
		saveKeys();
	}, [user, userPassword])

	// Function to save user keys after successful login
	async function saveKeys() {
		if (user && userPassword != "") {
			// Check if the private key is in local storage
			if (window.localStorage.getItem(user.uid)) {
				setLoggedInNow(true)
				window.location.href = "/home";
				return;
			}
			// Get the keys for the user from the database
			const { docRef, error } = await getKeysFromUserId(user.uid);
			const privateKeyAsBytes = docRef?.data()?.privateKey;

			// Convert IV to typed array
			let iv = new Uint8Array((docRef?.data()?.iv).split(',').map((x: string) => parseInt(x)));

			if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
				console.log(`iv: ${(iv.length)}, ${iv}`);
			}

			// Get the wrap key using password
			const wrapKey = await deriveWrapKeyFromString(userPassword);

			// Unwrap the private key
			if (privateKeyAsBytes && iv && wrapKey) {
				const { unwrappedKey, error } = await unwrapSecretKey(
					bytesToArray(privateKeyAsBytes).buffer,
					wrapKey,
					iv
				);
				if (error) {
					if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
						console.log(`Error while unwrapping: ${error}`)
					}
				} else {
					// Save the private key to local storage
					if (unwrappedKey) {
						const exportedPrivateKey = await exportKeyAsJson(unwrappedKey)
						window.localStorage.setItem(user.uid, JSON.stringify(exportedPrivateKey));
						if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
							console.log(`Unwrapped private key: ${unwrappedKey}`);
						}
						setLoggedInNow(true)
						window.location.href = "/home";
					}
				}
			}
		}
	}

	// Function to handle login form submittion
	async function handleFormSubmit(formData: FormData) {
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		setUserPassword(password);
		const { error } = await signIn(email, password);
		if (error && error.code == 'auth/invalid-credential') {
			setShowAlert(true);
			setTimeout(() => {setShowAlert(false)}, 5000);
		}
	}

	return (
		<div className="flex flex-col items-center justify-center w-screen h-screen">
			<Alert variant="destructive" className="absolute top-1 w-fit" hidden={!showAlert}>
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>
					Invalid email or password
				</AlertDescription>
			</Alert>
			<Card className="w-80">
				<CardHeader>
					<CardTitle>Login</CardTitle>
				</CardHeader>
				<CardContent>
					<form action={handleFormSubmit}>
						<div className="w-full flex flex-col items-center gap-2">
							<div className="w-full flex flex-col gap-2 my-2">
								<Label htmlFor="email">Email</Label>
								<Input type="text" name="email" required />
							</div>
							<div className="w-full flex flex-col gap-2 my-2">
								<Label htmlFor="password">Password</Label>
								<Input type="password" name="password" required />
							</div>
							<Button type="submit">Login</Button>
						</div>
					</form>
					<p className="text-center text-sm"><Link href='/signup'>Create an account</Link></p>

				</CardContent>
			</Card>
		</div>
	)
}

export default page