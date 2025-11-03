import { encode, decode } from '../utils/helpers';

// In-memory keys for the current session
let dataEncryptionKey: CryptoKey | null = null;
let signingKeyPair: CryptoKeyPair | null = null;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Constants for stored auth metadata
const AUTH_METADATA_KEY = 'gemini-auth-metadata';
const DB_NAME = 'GeminiAIStudioDB'; // To delete the DB on reset

interface AuthMetadata {
    salt: string; // base64
    signingKeyIv: string; // base64
    encryptedSigningKey: string; // base64, JWK format of the private key
    publicSignKey: JsonWebKey;
}

// --- Key Derivation ---

// Derives a key from a password using PBKDF2.
const deriveKey = async (passwordKey: CryptoKey, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> => {
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 250000,
            hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        true,
        usage
    );
};

// Imports the user's password as a base key for derivation.
const importPasswordKey = (password: string): Promise<CryptoKey> => {
    return window.crypto.subtle.importKey(
        'raw',
        textEncoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
};


// --- Public API ---

export const cryptoService = {
    isSetup(): boolean {
        return localStorage.getItem(AUTH_METADATA_KEY) !== null;
    },

    async setup(password: string): Promise<void> {
        if (this.isSetup()) {
            throw new Error("Application is already set up.");
        }

        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const signingKeyIv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const passwordKey = await importPasswordKey(password);
        
        // Derive a key specifically for encrypting the signing key
        const keyEncryptionKey = await deriveKey(passwordKey, salt, ['encrypt', 'decrypt']);
        
        // Generate the key pair for signing data
        const newSigningKeyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );

        const privateSignKeyJwk = await window.crypto.subtle.exportKey('jwk', newSigningKeyPair.privateKey);

        // Encrypt the private signing key
        const encryptedSigningKey = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: signingKeyIv },
            keyEncryptionKey,
            textEncoder.encode(JSON.stringify(privateSignKeyJwk))
        );
        
        const publicSignKeyJwk = await window.crypto.subtle.exportKey('jwk', newSigningKeyPair.publicKey);
        
        const metadata: AuthMetadata = {
            salt: encode(salt),
            signingKeyIv: encode(signingKeyIv),
            encryptedSigningKey: encode(new Uint8Array(encryptedSigningKey)),
            publicSignKey: publicSignKeyJwk,
        };
        
        localStorage.setItem(AUTH_METADATA_KEY, JSON.stringify(metadata));

        // Also log in to populate in-memory keys
        await this.login(password);
    },
    
    async login(password: string): Promise<boolean> {
        const metadataString = localStorage.getItem(AUTH_METADATA_KEY);
        if (!metadataString) {
            return false;
        }

        try {
            const metadata: AuthMetadata = JSON.parse(metadataString);
            const salt = decode(metadata.salt);
            const signingKeyIv = decode(metadata.signingKeyIv);
            const encryptedSigningKey = decode(metadata.encryptedSigningKey);
            
            const passwordKey = await importPasswordKey(password);
            
            // Re-derive the key used to encrypt the signing key
            const keyEncryptionKey = await deriveKey(passwordKey, salt, ['decrypt']);

            // Attempt to decrypt the private signing key
            const decryptedSigningKeyBytes = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: signingKeyIv },
                keyEncryptionKey,
                encryptedSigningKey
            );
            
            const privateSignKeyJwk: JsonWebKey = JSON.parse(textDecoder.decode(decryptedSigningKeyBytes));

            // If decryption succeeds, the password is correct. Now load keys into memory.
            const privateSignKey = await window.crypto.subtle.importKey('jwk', privateSignKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
            const publicSignKey = await window.crypto.subtle.importKey('jwk', metadata.publicSignKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
            
            signingKeyPair = { privateKey: privateSignKey, publicKey: publicSignKey };

            // Derive the separate key for data encryption
            dataEncryptionKey = await deriveKey(passwordKey, salt, ['encrypt', 'decrypt']);

            return true;
        } catch (error) {
            console.error("Login failed (likely wrong password):", error);
            this.logout();
            return false;
        }
    },

    logout(): void {
        dataEncryptionKey = null;
        signingKeyPair = null;
    },

    async encrypt(data: any): Promise<string> {
        if (!dataEncryptionKey || !signingKeyPair) {
            throw new Error("Not authenticated. Cannot encrypt data.");
        }

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const dataString = JSON.stringify(data);
        const encodedData = textEncoder.encode(dataString);

        const encryptedContent = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            dataEncryptionKey,
            encodedData
        );

        // Sign the encrypted content (ciphertext)
        const signature = await window.crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            signingKeyPair.privateKey,
            encryptedContent
        );
        
        return JSON.stringify({
            iv: encode(iv),
            ciphertext: encode(new Uint8Array(encryptedContent)),
            signature: encode(new Uint8Array(signature)),
        });
    },

    async decrypt<T>(encryptedPayloadJSON: string): Promise<T> {
        if (!dataEncryptionKey || !signingKeyPair) {
            throw new Error("Not authenticated. Cannot decrypt data.");
        }

        const payload = JSON.parse(encryptedPayloadJSON);
        const { iv: ivBase64, ciphertext: ciphertextBase64, signature: signatureBase64 } = payload;
        
        if (!ivBase64 || !ciphertextBase64 || !signatureBase64) {
            throw new Error("Invalid encrypted data format.");
        }

        const iv = decode(ivBase64);
        const ciphertext = decode(ciphertextBase64);
        const signature = decode(signatureBase64);

        // Verify the signature first
        const isValid = await window.crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            signingKeyPair.publicKey,
            signature,
            ciphertext
        );

        if (!isValid) {
            throw new Error("Data integrity check failed. The data may have been tampered with.");
        }

        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            dataEncryptionKey,
            ciphertext
        );
        
        const decodedString = textDecoder.decode(decryptedContent);
        return JSON.parse(decodedString) as T;
    },

    async encryptBackup(data: object, password: string): Promise<string> {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const passwordKey = await importPasswordKey(password);
        const backupEncryptionKey = await deriveKey(passwordKey, salt, ['encrypt']);

        const dataString = JSON.stringify(data);
        const encryptedBackup = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            backupEncryptionKey,
            textEncoder.encode(dataString)
        );

        return JSON.stringify({
            salt: encode(salt),
            iv: encode(iv),
            encryptedData: encode(new Uint8Array(encryptedBackup)),
        });
    },

    async decryptBackup<T>(encryptedBackupJSON: string, password: string): Promise<T> {
        const payload = JSON.parse(encryptedBackupJSON);
        const { salt: saltBase64, iv: ivBase64, encryptedData: encryptedDataBase64 } = payload;

        const salt = decode(saltBase64);
        const iv = decode(ivBase64);
        const encryptedData = decode(encryptedDataBase64);

        const passwordKey = await importPasswordKey(password);
        const backupEncryptionKey = await deriveKey(passwordKey, salt, ['decrypt']);

        const decryptedContent = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            backupEncryptionKey,
            encryptedData
        );

        return JSON.parse(textDecoder.decode(decryptedContent)) as T;
    },
    
    reset(): void {
        this.logout();
        localStorage.removeItem(AUTH_METADATA_KEY);
        indexedDB.deleteDatabase(DB_NAME); // This will wipe all user data
    }
};