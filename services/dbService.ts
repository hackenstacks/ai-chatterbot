
import { ChatMessage, Persona } from '../types.ts';
import { cryptoService } from './cryptoService.ts';

const DB_NAME = 'GeminiAIStudioDB';
const DB_VERSION = 3; // Incremented version for new store
const FILE_STORE = 'files';
const CHAT_STORE = 'chatHistory';
const SETTINGS_STORE = 'app_settings';

let dbInstance: IDBDatabase | null = null;

export interface StoredFile {
    name: string;
    type: string;
    size: number;
    lastModified: number;
    isArchived: boolean;
    data: string; // base64 encoded
}


const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(CHAT_STORE)) {
        db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
      }
       if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      }
    };
  });
};

const CHAT_HISTORY_KEY = 'current_chat';
const PERSONAS_KEY = 'chatbot_personas';
const VOICE_PREF_KEY = 'voice_preference';

export const dbService = {
  async addDocuments(files: StoredFile[]): Promise<void> {
    const encryptedFiles = await Promise.all(
        files.map(async (file) => ({
            name: file.name,
            encryptedPayload: await cryptoService.encrypt(file)
        }))
    );

    const db = await openDB();
    const transaction = db.transaction(FILE_STORE, 'readwrite');
    const store = transaction.objectStore(FILE_STORE);
    
    for (const file of encryptedFiles) {
        store.put(file);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getDocuments(): Promise<StoredFile[]> {
    const db = await openDB();
    const transaction = db.transaction(FILE_STORE, 'readonly');
    const store = transaction.objectStore(FILE_STORE);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const encryptedRecords = request.result as { name: string, encryptedPayload: string }[];
        const decryptedFiles: StoredFile[] = [];
        for (const record of encryptedRecords) {
            try {
                const decrypted = await cryptoService.decrypt<StoredFile>(record.encryptedPayload);
                decryptedFiles.push(decrypted);
            } catch (error) {
                console.error(`Could not decrypt file ${record.name}:`, error);
            }
        }
        resolve(decryptedFiles);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async removeDocument(fileName: string): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(FILE_STORE, 'readwrite');
    const store = transaction.objectStore(FILE_STORE);
    store.delete(fileName);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  
  async updateDocument(file: StoredFile): Promise<void> {
    const encryptedPayload = await cryptoService.encrypt(file);
    const db = await openDB();
    const transaction = db.transaction(FILE_STORE, 'readwrite');
    const store = transaction.objectStore(FILE_STORE);
    store.put({ name: file.name, encryptedPayload });
     return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async saveChatHistory(messages: ChatMessage[]): Promise<void> {
    const encryptedPayload = await cryptoService.encrypt(messages);
    const db = await openDB();
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    store.put({ id: CHAT_HISTORY_KEY, encryptedPayload });
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async getChatHistory(): Promise<ChatMessage[]> {
    const db = await openDB();
    const transaction = db.transaction(CHAT_STORE, 'readonly');
    const store = transaction.objectStore(CHAT_STORE);
    const request = store.get(CHAT_HISTORY_KEY);
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        if (request.result && request.result.encryptedPayload) {
            try {
                const decrypted = await cryptoService.decrypt<ChatMessage[]>(request.result.encryptedPayload);
                resolve(decrypted);
            } catch (error) {
                console.error("Could not decrypt chat history:", error);
                resolve([]);
            }
        } else {
            resolve([]);
        }
      };
      request.onerror = () => reject(request.error);
    });
  },

  async clearChatHistory(): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(CHAT_STORE, 'readwrite');
    const store = transaction.objectStore(CHAT_STORE);
    store.delete(CHAT_HISTORY_KEY);
     return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },
  
  async savePersonas(personas: Persona[]): Promise<void> {
    const encryptedPayload = await cryptoService.encrypt(personas);
    const db = await openDB();
    const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = transaction.objectStore(SETTINGS_STORE);
    store.put({ id: PERSONAS_KEY, encryptedPayload });
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
  },

  async getPersonas(): Promise<Persona[]> {
    const db = await openDB();
    const transaction = db.transaction(SETTINGS_STORE, 'readonly');
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(PERSONAS_KEY);
    return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
            if (request.result && request.result.encryptedPayload) {
                try {
                    const decrypted = await cryptoService.decrypt<Persona[]>(request.result.encryptedPayload);
                    resolve(decrypted);
                } catch (error) {
                    console.error("Could not decrypt personas:", error);
                    resolve([]);
                }
            } else {
                resolve([]);
            }
        };
        request.onerror = () => reject(request.error);
    });
  },

  async saveVoicePreference(voiceName: string): Promise<void> {
      const encryptedPayload = await cryptoService.encrypt(voiceName);
      const db = await openDB();
      const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = transaction.objectStore(SETTINGS_STORE);
      store.put({ id: VOICE_PREF_KEY, encryptedPayload });
      return new Promise((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
      });
  },

  async getVoicePreference(): Promise<string | null> {
      const db = await openDB();
      const transaction = db.transaction(SETTINGS_STORE, 'readonly');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get(VOICE_PREF_KEY);
      return new Promise((resolve, reject) => {
          request.onsuccess = async () => {
              if (request.result && request.result.encryptedPayload) {
                  try {
                      const decrypted = await cryptoService.decrypt<string>(request.result.encryptedPayload);
                      resolve(decrypted);
                  } catch (error) {
                      console.error("Could not decrypt voice preference:", error);
                      resolve(null);
                  }
              } else {
                  resolve(null);
              }
          };
          request.onerror = () => reject(request.error);
      });
  },
  
  async saveSetting<T>(key: string, value: T): Promise<void> {
      const encryptedPayload = await cryptoService.encrypt(value);
      const db = await openDB();
      const transaction = db.transaction(SETTINGS_STORE, 'readwrite');
      const store = transaction.objectStore(SETTINGS_STORE);
      store.put({ id: key, encryptedPayload });
      return new Promise((resolve, reject) => {
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
      });
  },

  async getSetting<T>(key: string): Promise<T | null> {
      const db = await openDB();
      const transaction = db.transaction(SETTINGS_STORE, 'readonly');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get(key);
      return new Promise((resolve, reject) => {
          request.onsuccess = async () => {
              if (request.result && request.result.encryptedPayload) {
                  try {
                      const decrypted = await cryptoService.decrypt<T>(request.result.encryptedPayload);
                      resolve(decrypted);
                  } catch (error) {
                      console.error(`Could not decrypt setting "${key}":`, error);
                      resolve(null);
                  }
              } else {
                  resolve(null);
              }
          };
          request.onerror = () => reject(request.error);
      });
  },

  async clearAllData(): Promise<void> {
      const db = await openDB();
      const transaction = db.transaction([FILE_STORE, CHAT_STORE, SETTINGS_STORE], 'readwrite');
      const fileStore = transaction.objectStore(FILE_STORE);
      const chatStore = transaction.objectStore(CHAT_STORE);
      const settingsStore = transaction.objectStore(SETTINGS_STORE);

      await Promise.all([
          new Promise<void>((res, rej) => { const r = fileStore.clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
          new Promise<void>((res, rej) => { const r = chatStore.clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
          new Promise<void>((res, rej) => { const r = settingsStore.clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }),
      ]);
  },

  async getAllDataForBackup(): Promise<object> {
      const [files, chatHistory, personas, voicePreference, accessibleFiles] = await Promise.all([
          this.getDocuments(),
          this.getChatHistory(),
          this.getPersonas(),
          this.getVoicePreference(),
          this.getSetting('accessibleFiles'),
      ]);
      return { files, chatHistory, personas, voicePreference, accessibleFiles };
  },

  async importAndOverwriteAllData(data: any): Promise<void> {
      const { files, chatHistory, personas, voicePreference, accessibleFiles } = data;
      
      await this.clearAllData();

      // Now save the new data. These functions will re-encrypt with the current session key.
      if (files && Array.isArray(files) && files.length > 0) await this.addDocuments(files);
      if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) await this.saveChatHistory(chatHistory);
      if (personas && Array.isArray(personas) && personas.length > 0) await this.savePersonas(personas);
      if (voicePreference) await this.saveVoicePreference(voicePreference);
      if (accessibleFiles) await this.saveSetting('accessibleFiles', accessibleFiles);
  }
};