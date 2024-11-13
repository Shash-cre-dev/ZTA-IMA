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
import signUp from "@/firebase/auth/signup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/authContext";
import { addKeysToDb } from "@/firebase/database/keymanagementdb";
import {
	deriveSecretKeyFromString,
	generateAsymmetricKeys,
	deriveWrapKey,
	wrapSecretKey,
	exportKeyAsJson
} from "@/utils/cryptoFunctions";
import signOutUser from "@/firebase/auth/signout";

const page = () => {
	const [showAlert, setShowAlert] = React.useState<boolean>();

	async function handleFormSubmit(formData: FormData) {

		const rawFormData = {
			name: formData.get('name') as string,
			email: formData.get('email') as string,
			password: formData.get('password') as string
		}

		// Generate encryption keys
		const keyPair = await generateAsymmetricKeys();

		// Derive secret from the password
		const deriveSecretKeyRes = await deriveSecretKeyFromString(rawFormData.password);

		if (deriveSecretKeyRes.error) {

		}

		// Derive wrap key for encrypting the private key
		if (deriveSecretKeyRes.secretKey) {
			const deriveWrapKeyRes = await deriveWrapKey(deriveSecretKeyRes.secretKey);

			if (deriveWrapKeyRes.wrapKey) {
				if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
					console.log(`Wrap key is: ${deriveWrapKeyRes.wrapKey}`);
				}
				// Encrypt the private key using the wrap key
				const wrapSecretKeyRes = await wrapSecretKey(keyPair.privateKey, deriveWrapKeyRes.wrapKey);

				if (wrapSecretKeyRes.wrappedKey) {
					// Sign up the user using Firebase
					const signUpRes = await signUp(
						rawFormData.name,
						rawFormData.email,
						rawFormData.password
					);

					if (signUpRes.error && signUpRes.error.code == "auth/email-already-in-use") {
						setShowAlert(true);
						setTimeout(() => {setShowAlert(false)}, 5000);
						return;
					}

					if (signUpRes.result?.user) {
						// Add the keys to the database

						// Export public key as JSON
						const exportedPublicKey = await exportKeyAsJson(keyPair.publicKey);
						if (!exportedPublicKey) {
							return;
						}

						// Convert iv to string
						const ivAsString = wrapSecretKeyRes.iv.toString();

						const addKeysError = await addKeysToDb(
							signUpRes.result.user.uid,
							exportedPublicKey,
							wrapSecretKeyRes.wrappedKey,
							ivAsString
						);

						if (!addKeysError) {
							await signOutUser();
							window.location.href = '/login';
						}

						if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
							if (!addKeysError) {
								console.log("Added keys successfully");
							} else {
								console.log(`Error while adding the keys to database: ${addKeysError}`);
							}
						}
					}
				}

			} else {
				if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
					console.log(`Error while encrypting private key: ${deriveWrapKeyRes.error}`)
				}
			}
		} else {
			if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
				console.log(`Error while deriving secret key: ${deriveSecretKeyRes.error}`);
			}
		}
	}

	return (
		<div className="flex flex-col items-center justify-center w-screen h-screen">
			<Alert variant="destructive" className="absolute top-1 w-fit" hidden={!showAlert}>
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>
					Email is already in use
				</AlertDescription>
			</Alert>
			<Card className="w-80">
				<CardHeader>
					<CardTitle>Sign Up</CardTitle>
				</CardHeader>
				<CardContent>
					<form action={handleFormSubmit}>
						<div className="w-full flex flex-col items-center gap-2">

							<div className="flex flex-col w-full gap-2 my-2">
								<Label htmlFor="name">Name</Label>
								<Input type="text" name="name" required />
							</div>

							<div className="flex flex-col w-full gap-2 my-2">
								<Label htmlFor="email">Email</Label>
								<Input type="text" name="email" required />
							</div>

							<div className="flex flex-col w-full gap-2 my-2">
								<Label htmlFor="password">Password</Label>
								<Input type="password" name="password" required />
							</div>

							<Button type="submit">Sign Up</Button>
						</div>
					</form>
					<p className="text-center text-sm w-full">
						<Link href='/login'>Already have an account? Login</Link>
					</p>

				</CardContent>
			</Card>
		</div>
	)
}

export default page