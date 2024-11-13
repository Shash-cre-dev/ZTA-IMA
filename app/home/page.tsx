'use client'
import React from "react";
import { useAuthContext } from "@/context/authContext";
import { useRouter } from "next/navigation";
import {
	Menubar,
	MenubarMenu,
	MenubarItem,
	MenubarContent,
	MenubarTrigger
} from "@/components/ui/menubar";
import { Button } from "@/components/ui/button";
import signOutUser from "@/firebase/auth/signout";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import MessageBlock from "@/components/messageBlock";
import {
	Card,
	CardTitle,
	CardHeader,
} from "@/components/ui/card";
import {
	getUserFromEmail,
	getUserConnections,
	userConnectionType,
	createSession
} from "@/firebase/database/usersdb";
import { sendMessage, sessionMessage, getSessionMessages } from "@/firebase/database/messagesdb";
import { onSnapshot, QuerySnapshot } from "firebase/firestore";
import { deriveSharedKey, importSharedCryptoKeyFromJson } from "@/utils/cryptoFunctions";
import { decryptString } from "@/utils/cryptoFunctions";
import { bytesToArray, getPublicKeyFromUserId } from "@/firebase/database/keymanagementdb";
import { importPublicCryptoKeyFromJson, importPrivateCryptoKeyFromJson, exportKeyAsJson } from "@/utils/cryptoFunctions";
import PulseLoader from "react-spinners/PulseLoader";
import Image from "next/image";

const page = () => {

	const { user, loggedInNow, setLoggedInNow } = useAuthContext();

	const router = useRouter();

	const [connections, setConnections] = React.useState<userConnectionType[]>([]);
	const [selectedUser, setSelectedUser] = React.useState<number | null>(null);
	const [sessionMessages, setSessionMessages] = React.useState<sessionMessage[][]>([]);
	const [dialogOpen, setDialogOpen] = React.useState<boolean>(false);
	const [userNotFound, setUserNotFound] = React.useState<boolean>(false);
	const [loadingMessages, setLoadingMessages] = React.useState<boolean>(true);
	const [showChatWindow, setShowChatWindow] = React.useState<boolean>(true);
	const [isLargeScreen, setIsLargeScreen] = React.useState<boolean>(true);
	// const [updateCount, setUpdateCount] = React.useState<number>(0);

	const messagesList = document.getElementById('messages-list');
	const messageForm = document.getElementById('message-form') as HTMLFormElement;
	React.useEffect(() => {
		if (user == null) router.push("/login");
	}, [user])

	React.useEffect(() => {
		if (loggedInNow) {
			alert(`Welcome, ${user?.displayName}`);
			setLoggedInNow(false);
		}
	}, [loggedInNow])

	React.useEffect(() => {
		if (window.screen.width < 768) {
			setIsLargeScreen(false);
			setShowChatWindow(false);
		}
		updateConnections();
	}, []);

	React.useEffect(() => {
		setLoadingMessages(true);
		setTimeout(() => {
			updateMessages();
			setLoadingMessages(false);
		}, 2000);
	}, [connections]);

	React.useEffect(() => {
		updateScroll();
		if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
			console.log(sessionMessages);
		}

	}, [sessionMessages, selectedUser]);

	function updateScroll() {
		if (messagesList) {
			messagesList.scrollTop = messagesList.scrollHeight;
		}
	}

	window.addEventListener("resize", () => {
		if (window.screen.width < 768) {
			setIsLargeScreen(false);
		} else {
			setIsLargeScreen(true);
		}
	});

	async function handleSignOut() {
		const error = await signOutUser();
		if (error) {
			alert('An error occured while signing out');
		}
		window.location.href = '/login';
	}

	async function handleNewChat(formData: FormData) {
		const searchedUser = await getUserFromEmail(formData.get('userEmail') as string);
		if (!searchedUser) {
			setUserNotFound(true);
			return;
		}

		if (user) {
			const newConnection = await createSession(user?.uid, searchedUser.userId);

			if (newConnection) {
				// setConnections([...connections, newConnection]);
				setLoadingMessages(true);
				await updateConnections();
			}
			setDialogOpen(false);
		}

	}

	async function handleSendMessage(formData: FormData) {
		const message = formData.get("message") as string;

		if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
			console.log(selectedUser, user, message)
		}

		if (selectedUser != null && user) {

			// Get the shared key for the session
			const sharedKeyFromStorage = window.localStorage.getItem(connections[selectedUser].sessionId);
			if (!sharedKeyFromStorage) {
				return;
			}
			const sharedKey = await importSharedCryptoKeyFromJson(JSON.parse(sharedKeyFromStorage));

			if (!sharedKey) return;

			const res = await sendMessage(connections[selectedUser].sessionId, user?.uid, message, sharedKey);

			messageForm.reset();
			if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
				console.log(res);
			}

		}

		if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
			console.log("message sent");
		}
	}

	// Function to handle closeing of dialog box
	function handleDialogClose(open: boolean) {
		setDialogOpen(open);
		setUserNotFound(false);
	}

	async function updateConnections() {
		if (!user) {
			return;
		}
		const fetchedConnections = await getUserConnections(user.uid);
		// For each connection, derive the session key
		fetchedConnections.forEach(async (con) => {

			// If the session key exists, return
			if (window.localStorage.getItem(con.sessionId)) {
				return;
			}

			let publicKey = null;
			let privateKey = null;

			// Fetch the public key of the other user
			const publicKeyAsJwk = await getPublicKeyFromUserId(con.userId);
			publicKey = await importPublicCryptoKeyFromJson(publicKeyAsJwk);

			// If the private key exists in the local storage, convert it into JSON
			const privateKeyFromStorage = window.localStorage.getItem(user.uid);
			if (privateKeyFromStorage) {
				const privateKeyAsJson = JSON.parse(privateKeyFromStorage);
				privateKey = await importPrivateCryptoKeyFromJson(privateKeyAsJson);
			}

			// If public key and private are not null, derive the shared key
			if (publicKey && privateKey) {
				const sharedKey = await deriveSharedKey(publicKey, privateKey);

				// Convert the shared key to JSON to store in local storage
				const sharedKeyAsJson = await exportKeyAsJson(sharedKey);

				if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
					console.log(`Shared key for user ${con.fullName}: ${sharedKeyAsJson}`);
				}
				localStorage.setItem(con.sessionId, JSON.stringify(sharedKeyAsJson));

			}
		});
		setConnections([...fetchedConnections]);
	}

	async function updateMessages() {

		if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
			console.log("Updaing messages");
		}

		connections.forEach(async (connection, index) => {

			if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
				console.log("Updating messages for ", connection.fullName);
			}

			const res = await getSessionMessages(connection.sessionId);
			const sharedKeyFromStorage = window.localStorage.getItem(connection.sessionId);

			if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
				console.log(`Shared key: ${sharedKeyFromStorage}`);
			}

			if (!sharedKeyFromStorage) {
				return;
			}
			const sharedKey = await importSharedCryptoKeyFromJson(JSON.parse(sharedKeyFromStorage));
			if (!sharedKey) return;

			if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
				console.log(`Session query: ${res.sessionQuery}, error: ${res.error}`);
			}

			if (res.sessionQuery) {
				if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
					console.log(`Session query: ${res.sessionQuery}`);
				}
				const unsubscribe = onSnapshot(res.sessionQuery, async (querySnapshot: QuerySnapshot) => {

					if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
						console.log(querySnapshot.docs);
					}

					let currentSessionMessages = sessionMessages;
					if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
						console.log(`Current messages before updation: ${currentSessionMessages}`);
					}

					// For each session, decrypt the messages
					currentSessionMessages[index] = await Promise.all(querySnapshot.docs.map(async (doc) => {
						const encryptedMessage = bytesToArray(doc.data().message);
						const iv = bytesToArray(doc.data().iv);
						const decryptedMessage = await decryptString(encryptedMessage, sharedKey, iv);
						if (!decryptedMessage) {
							return { userId: doc.data().userID, message: "could not decrypt message" };
						}
						const newMessage: sessionMessage = { userId: doc.data().userId, message: decryptedMessage };
						return newMessage;
					}));

					if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
						console.log(`Current messages after updation: ${currentSessionMessages}`)
					}

					setSessionMessages([...currentSessionMessages]);
				});
			}
		});


	}

	function handleSelectUser(index: number) {
		setShowChatWindow(true);
		setSelectedUser(index);
	}

	function handleBack() {
		setSelectedUser(null);
		setShowChatWindow(false);
	}



	return (
		<div className="w-screen relative">
			{/* Navigation Bar */}
			<div className="w-full h-16 bg-orange-500 flex items-center px-5 text-white justify-between border">
				<h1 className="font-bold text-xl">Chats</h1>
				{/* User name */}
				<Menubar className="bg-transparent border-none">
					<MenubarMenu>
						<MenubarTrigger>
							<div className="flex gap-2 text-lg">
								<Image src="/assets/icons/user-icon-white.png" height={30} width={30} alt="user-icon-white" />
								{user?.displayName}
							</div>
						</MenubarTrigger>
						<MenubarContent>
							<MenubarItem onClick={handleSignOut}>Sign Out</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>

			</div>

			{
				loadingMessages ? (
					<div className="flex w-full h-[calc(100vh-4rem)] items-center justify-center">
						<PulseLoader />
					</div>
				) : (
					<div className="flex w-full h-[calc(100vh-4rem)]">
						{/* Connnections list */}
						<div id="connections-list" className={isLargeScreen ? `w-[25rem] bg-gray-100` : showChatWindow ? `hidden` : `w-full bg-gray-100`}>
							<Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
								<DialogTrigger className="bg-black text-white p-3 m-2 rounded-md">
									<div className="flex gap-2">
										<Image src="/assets/icons/chat-icon.png" height={20} width={20} alt="chat-icon" />
										New Chat
									</div>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>

										<DialogTitle>New Chat</DialogTitle>
										<DialogDescription>
											Enter the email address of the person
										</DialogDescription>
									</DialogHeader>

									<form action={handleNewChat}>
										<div className="flex flex-col gap-3 items-center">
											<Input name="userEmail" type="text" />
											<Button type="submit" className="w-fit">Chat</Button>
										</div>
									</form>
									<span className="text-red-500 text-center" hidden={!userNotFound}>No user with the entered email address was found</span>
								</DialogContent>
							</Dialog>
							<div className="flex flex-col mt-3 w-full">
								{connections.map((c, index) => {
									if (selectedUser == index) {
										return (
											<Card key={index} onClick={() => handleSelectUser(index)} className="bg-orange-100 rounded-none">
												<CardHeader>
													<div className="flex gap-2">
														<Image src="/assets/icons/user-icon.png" height={35} width={35} alt="user-icon" />
														<CardTitle className="text-lg">{c.fullName}</CardTitle>
													</div>
												</CardHeader>
											</Card>
										);
									} else {
										return (
											<Card key={index} onClick={() => handleSelectUser(index)} className="rounded-none bg-transparent text-black border border-stone-600">
												<CardHeader >
													<div className="flex gap-2">
														<Image src="/assets/icons/user-icon.png" height={35} width={35} alt="user-icon" />
														<CardTitle className="text-lg">{c.fullName}</CardTitle>
													</div>
												</CardHeader>
											</Card>

										)
									}
								}

								)}
							</div>
						</div>

						{/* Chat window */}
						<div id="chat-window" className={isLargeScreen || showChatWindow ? `w-full h-full flex flex-col gap-2 relative border` : `hidden`}>

							{/* User name and back button */}
							<div className="w-full bg-gray-100 p-5 text-xl font-semibold flex justify-between">
								{selectedUser != null ? connections[selectedUser].fullName : "No user selected"}
								<button className={isLargeScreen ? `hidden` : `bg-black p-2 rounded-md`} onClick={handleBack}>
									<Image src="/assets/icons/back-icon.png" width={20} height={20} alt="back-icon" />
								</button>
							</div>

							{/* Messages list */}
							<div id="messages-list" className="w-full h-[calc(70vh)] flex flex-col gap-2 relative overflow-scroll no-scrollbar">
								{selectedUser != null ? sessionMessages[selectedUser].map((message, index) => {
									if (message.userId == user?.uid) {
										return (
											<MessageBlock key={index} message={message.message} direction="right" />
										);
									}
									return (
										<MessageBlock key={index} message={message.message} direction="left" />
									)

								}) : null}
							</div>


							{/* Form to send message */}
							<form id="message-form" action={handleSendMessage} className="absolute flex bottom-2 right-2 mx-auto w-3/4 gap-2">
								<Input type="text" placeholder="Type your message here" name="message" className="rounded-full" />
								<Button type="submit" className="rounded-full">
									<div className="flex gap-2 px-3 py-2">
										Send
										<Image src="/assets/icons/send-icon.png" height={20} width={20} alt="send-icon" />
									</div>
								</Button>
							</form>

						</div>
					</div>
				)
			}


		</div>
	)
}

export default page