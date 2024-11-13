'use client'

// Function to generate asymmetric key pair for RSA encryption/decryption
export async function generateAsymmetricKeys() {

    let keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-384"
        },
        true,
        ["deriveKey"]);

    return keyPair;
}

// Function to derive a secret key from a string
export async function deriveSecretKeyFromString(keyMaterial: string) {
    const enc = new TextEncoder();

    let secretKey: CryptoKey | null = null;
    let error: any = null;
    try {
        secretKey = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(keyMaterial),
            "PBKDF2",
            false,
            ["deriveBits", "deriveKey"]
        );

    } catch (e: any) {
        error = e;
    }

    return { secretKey, error }
}

// Function to derive the wrap key to encrypt another key
export async function deriveWrapKey(secretKey: CryptoKey) {
    const enc = new TextEncoder();

    let wrapKey: CryptoKey | null = null;
    let error: any = null;
    try {
        wrapKey = await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode("jkh23909fskj309"),
                iterations: 100000,
                hash: "SHA-256",
            },
            secretKey,
            {
                name: "AES-CBC",
                length: 256
            },
            true,
            ["wrapKey", "unwrapKey"]
        );

    } catch (e: any) {
        error = e;
    }

    return { wrapKey, error }
}

// Function to wrap a key using a wrap key
export async function wrapSecretKey(secretKey: CryptoKey, wrapKey: CryptoKey) {
    let iv = window.crypto.getRandomValues(new Uint8Array(16));

    if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
        console.log(`Generated iv: ${iv}`);
    }
    let wrappedKey: ArrayBuffer | null = null;
    let error: any = null;
    try {
        wrappedKey = await window.crypto.subtle.wrapKey("pkcs8", secretKey, wrapKey, {
            name: "AES-CBC",
            iv,
        });
    } catch (e: any) {
        error = e;
    }

    return { wrappedKey, iv, error };
}

// Function to unwrap key using wrap key
export async function unwrapSecretKey(wrappedKey: ArrayBuffer, wrapKey: CryptoKey, iv: ArrayBuffer) {
    if (process.env.NEXT_PUBLIC_DEBUG?.charAt(0) == '1') {
        console.log("Attempting to unwrap key... The wrap key is: ", wrapKey);
    }
    let unwrappedKey: CryptoKey | null = null;
    let error: any = null;
    try {
        unwrappedKey = await window.crypto.subtle.unwrapKey(
            "pkcs8",
            wrappedKey,
            wrapKey,
            {
                name: "AES-CBC",
                iv
            },
            {
                name: "ECDH",
                namedCurve: "P-384"
            },
            true,
            ["deriveKey"]
        )
    } catch (e: any) {
        console.log(e);
        
        error = e;
    }

    return { unwrappedKey, error };
}

// Function to export key as JSON
export async function exportKeyAsJson(key: CryptoKey) {
    try {
        const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
        return exportedKey;
    } catch (e: any ){
        console.log(`Error while exporting key as JSON: ${e}`);
    }
}

// Function to import from JSON key to CrpytoKey
export async function importPublicCryptoKeyFromJson(key: JsonWebKey) {
    try {
        const importedKey = await window.crypto.subtle.importKey('jwk', key, {
            name: "ECDH",
            namedCurve: "P-384"
        },
            true,
            []);
    
        return importedKey;
    } catch (e: any ){
        console.log(`Error importing public crypto key from JSON: ${e}`);
    }
}

export async function importPrivateCryptoKeyFromJson(key: JsonWebKey) {
    try {
        const importedKey = await window.crypto.subtle.importKey('jwk', key, {
            name: "ECDH",
            namedCurve: "P-384"
        },
            true,
            ["deriveKey"]);
    
        return importedKey;
    } catch (e: any ){
        console.log(`Error importing private crypto key from JSON: ${e}`);
    }
}

export async function importSharedCryptoKeyFromJson(key: JsonWebKey) {
    try {
        const importedKey = await window.crypto.subtle.importKey('jwk', key, {
            name: "AES-GCM",
            length: 256,
        },
            true,
            ["encrypt", "decrypt"]);
    
        return importedKey;
    } catch (e: any ){
        console.log(`Error importing shared crypto key from JSON: ${e}`);
    }
}

// Function to get wrap key directly from password
// Essentially combines the secret key and wrap key derivation steps into a single function
export async function deriveWrapKeyFromString(keyMaterial: string) {
    const { secretKey } = await deriveSecretKeyFromString(keyMaterial);
    if (secretKey) {
        const { wrapKey } = await deriveWrapKey(secretKey);
        if (wrapKey) {
            return wrapKey;
        } else {
            return null;
        }
    } else {
        return null;
    }
}

// Function to generate a shared secret key using public and private keys
export const deriveSharedKey = async (publicKey: CryptoKey, privateKey: CryptoKey) => {
    const sharedKey = await window.crypto.subtle.deriveKey(
        {
            name: "ECDH",
            public: publicKey
        },
        privateKey,
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );

    return sharedKey;

}

// Function to encrypt a string using secret key
export const encryptString = async (str: string, publicKey: CryptoKey) => {
    const encodedString = new TextEncoder().encode(str);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedString = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv
        },
        publicKey,
        encodedString
    );

    return { encryptedString, iv };
}

// Function to decrypt an encryped string using secret key
export const decryptString = async (encryptedString: Uint8Array, privateKey: CryptoKey, iv: Uint8Array) => {
    const decryptedString = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv
        },
        privateKey,
        encryptedString
    );

    if (decryptedString) {
        return new TextDecoder().decode(decryptedString);
    }
}