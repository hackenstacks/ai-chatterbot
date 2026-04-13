
import Dexie, { Table } from 'dexie';
import { ChatMessage, Persona, Memory, ApiConfig } from '../types.ts';
import { cryptoService } from './cryptoService.ts';

const DB_NAME = 'GeminiAIStudioDB';
const DB_VERSION = 7; // Increment for Dexie migration

export interface StoredFile {
    name: string;
    type: string;
    size: number;
    lastModified: number;
    isArchived: boolean;
    data: string; // base64 encoded
}

interface EncryptedRecord {
    id: string;
    encryptedPayload: string;
}

class AppDatabase extends Dexie {
    files!: Table<EncryptedRecord, string>;
    chatHistory!: Table<EncryptedRecord, string>;
    settings!: Table<EncryptedRecord, string>;
    memories!: Table<EncryptedRecord, string>;

    constructor() {
        super(DB_NAME);
        this.version(DB_VERSION).stores({
            files: 'id',
            chatHistory: 'id',
            settings: 'id',
            memories: 'id'
        });
    }
}

const db = new AppDatabase();

const CHAT_HISTORY_KEY = 'current_chat';
const PERSONAS_KEY = 'chatbot_personas';
const VOICE_PREF_KEY = 'voice_preference';
const API_CONFIGS_KEY = 'api_configs';
const ACTIVE_API_CONFIG_KEY = 'active_api_config_id';

export const dbService = {
  async addDocuments(files: StoredFile[]): Promise<void> {
    const encryptedFiles = await Promise.all(
        files.map(async (file) => ({
            id: file.name,
            encryptedPayload: await cryptoService.encrypt(file)
        }))
    );
    await db.files.bulkPut(encryptedFiles);
  },

  async getDocuments(): Promise<StoredFile[]> {
    const encryptedRecords = await db.files.toArray();
    const decryptedFiles: StoredFile[] = [];
    for (const record of encryptedRecords) {
        try {
            const decrypted = await cryptoService.decrypt<StoredFile>(record.encryptedPayload);
            decryptedFiles.push(decrypted);
        } catch (error) {
            console.error(`Could not decrypt file ${record.id}:`, error);
        }
    }
    return decryptedFiles;
  },

  async removeDocument(fileName: string): Promise<void> {
    await db.files.delete(fileName);
  },
  
  async updateDocument(file: StoredFile): Promise<void> {
    const encryptedPayload = await cryptoService.encrypt(file);
    await db.files.put({ id: file.name, encryptedPayload });
  },

  async saveChatHistory(messages: ChatMessage[]): Promise<void> {
    const encryptedPayload = await cryptoService.encrypt(messages);
    await db.chatHistory.put({ id: CHAT_HISTORY_KEY, encryptedPayload });
  },

  async getChatHistory(): Promise<ChatMessage[]> {
    const record = await db.chatHistory.get(CHAT_HISTORY_KEY);
    if (record && record.encryptedPayload) {
        try {
            return await cryptoService.decrypt<ChatMessage[]>(record.encryptedPayload);
        } catch (error) {
            console.error("Could not decrypt chat history:", error);
            return [];
        }
    }
    return [];
  },

  async clearChatHistory(): Promise<void> {
    await db.chatHistory.delete(CHAT_HISTORY_KEY);
  },
  
  async savePersonas(personas: Persona[]): Promise<void> {
    const encryptedPayload = await cryptoService.encrypt(personas);
    await db.settings.put({ id: PERSONAS_KEY, encryptedPayload });
  },

  async getPersonas(): Promise<Persona[]> {
    const record = await db.settings.get(PERSONAS_KEY);
    if (record && record.encryptedPayload) {
        try {
            return await cryptoService.decrypt<Persona[]>(record.encryptedPayload);
        } catch (error) {
            console.error("Could not decrypt personas:", error);
            return [];
        }
    }
    return [];
  },

  async saveVoicePreference(voiceName: string): Promise<void> {
      const encryptedPayload = await cryptoService.encrypt(voiceName);
      await db.settings.put({ id: VOICE_PREF_KEY, encryptedPayload });
  },

  async getVoicePreference(): Promise<string | null> {
      const record = await db.settings.get(VOICE_PREF_KEY);
      if (record && record.encryptedPayload) {
          try {
              return await cryptoService.decrypt<string>(record.encryptedPayload);
          } catch (error) {
              console.error("Could not decrypt voice preference:", error);
              return null;
          }
      }
      return null;
  },
  
  async saveSetting<T>(key: string, value: T): Promise<void> {
      const encryptedPayload = await cryptoService.encrypt(value);
      await db.settings.put({ id: key, encryptedPayload });
  },

  async getSetting<T>(key: string): Promise<T | null> {
      const record = await db.settings.get(key);
      if (record && record.encryptedPayload) {
          try {
              return await cryptoService.decrypt<T>(record.encryptedPayload);
          } catch (error) {
              console.error(`Could not decrypt setting "${key}":`, error);
              return null;
          }
      }
      return null;
  },

  async getApiConfigs(): Promise<ApiConfig[]> {
      const configs = await this.getSetting<ApiConfig[]>(API_CONFIGS_KEY);
      return configs || [];
  },

  async saveApiConfigs(configs: ApiConfig[]): Promise<void> {
      await this.saveSetting(API_CONFIGS_KEY, configs);
  },

  async getActiveApiConfigId(): Promise<string | null> {
      return await this.getSetting<string>(ACTIVE_API_CONFIG_KEY);
  },

  async saveActiveApiConfigId(id: string): Promise<void> {
      await this.saveSetting(ACTIVE_API_CONFIG_KEY, id);
  },

  async addMemory(memory: Memory): Promise<void> {
      const encryptedPayload = await cryptoService.encrypt(memory);
      await db.memories.put({ id: memory.id, encryptedPayload });
  },

  async getMemories(): Promise<Memory[]> {
      const encryptedRecords = await db.memories.toArray();
      const decryptedMemories: Memory[] = [];
      for (const record of encryptedRecords) {
          try {
              const decrypted = await cryptoService.decrypt<Memory>(record.encryptedPayload);
              decryptedMemories.push(decrypted);
          } catch (error) {
              console.error("Could not decrypt memory:", error);
          }
      }
      return decryptedMemories;
  },

  async clearAllData(): Promise<void> {
      await Promise.all([
          db.files.clear(),
          db.chatHistory.clear(),
          db.settings.clear(),
          db.memories.clear()
      ]);
  },

  async getAllDataForBackup(): Promise<object> {
      const [files, chatHistory, personas, voicePreference, accessibleFiles, memories] = await Promise.all([
          this.getDocuments(),
          this.getChatHistory(),
          this.getPersonas(),
          this.getVoicePreference(),
          this.getSetting('accessibleFiles'),
          this.getMemories(),
      ]);
      return { files, chatHistory, personas, voicePreference, accessibleFiles, memories };
  },

  async importAndOverwriteAllData(data: any): Promise<void> {
      const { files, chatHistory, personas, voicePreference, accessibleFiles, memories } = data;
      
      await this.clearAllData();

      // Now save the new data. These functions will re-encrypt with the current session key.
      if (files && Array.isArray(files) && files.length > 0) await this.addDocuments(files);
      if (chatHistory && Array.isArray(chatHistory) && chatHistory.length > 0) await this.saveChatHistory(chatHistory);
      if (personas && Array.isArray(personas) && personas.length > 0) await this.savePersonas(personas);
      if (voicePreference) await this.saveVoicePreference(voicePreference);
      if (accessibleFiles) await this.saveSetting('accessibleFiles', accessibleFiles);
      if (memories && Array.isArray(memories) && memories.length > 0) {
          for (const m of memories) {
              await this.addMemory(m);
          }
      }
  }
};
