// FIX: import from @google/genai instead of @google/ai/generativelanguage
import { GoogleGenAI, Type, Modality, Chat, GenerateContentResponse, GroundingChunk, LiveServerMessage, FunctionDeclaration, Content } from '@google/genai';
import { Persona } from '../types';

const getAi = (): GoogleGenAI => {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        throw new Error("API key is missing.");
    }
    // Always create a new instance to avoid issues with stale API keys.
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

type LiveCallbacks = {
    onopen?: () => void;
    onmessage?: (message: LiveServerMessage) => void;
    onerror?: (e: ErrorEvent) => void;
    onclose?: (e: CloseEvent) => void;
};

const imageGenerationTool: FunctionDeclaration = {
    name: 'generateImage',
    parameters: {
        type: Type.OBJECT,
        description: 'Generates an image based on a textual description, often used when the user asks to "draw", "create", "imagine", or "generate" an image.',
        properties: {
            prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' },
            style: { type: Type.STRING, description: 'The artistic style, e.g., "photorealistic", "anime", "cartoon".' },
        },
        required: ['prompt'],
    },
};

const chatTools: { functionDeclarations: FunctionDeclaration[] }[] = [
    { functionDeclarations: [imageGenerationTool] }
];

export const GeminiService = {
    createChat: (systemInstruction?: string): Chat => {
        return getAi().chats.create({
            model: 'gemini-2.5-flash',
            config: { 
                ...(systemInstruction && { systemInstruction }),
                tools: chatTools,
            },
        });
    },

    createChatWithHistory: (history: Content[], systemInstruction?: string): Chat => {
        return getAi().chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: { 
                ...(systemInstruction && { systemInstruction }),
                tools: chatTools,
            },
        });
    },

    getPersonaSuggestion: async (field: keyof Persona, currentPersona: Partial<Persona>): Promise<string> => {
        const personaContext = Object.entries(currentPersona)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        
        const prompt = `Based on the following partial chatbot persona, generate a creative suggestion for the "${field}" field. The suggestion should be a single, concise string.
        
        Current Persona: ${personaContext || 'No details yet.'}
        
        Generate a suggestion for: ${field}`;
        
        const response = await getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        
        return response.text.trim();
    },

    createPersonaFromText: async (description: string): Promise<Partial<Persona>> => {
        const prompt = `Analyze the following character description and extract the key attributes into the specified JSON format. If a field is not mentioned, leave it as an empty string.

Character Description:
---
${description}
---

Fill out the following JSON object based on the description:
`;

        const response = await getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        role: { type: Type.STRING, description: "The character's name or primary role." },
                        personalityTraits: { type: Type.STRING, description: "A comma-separated list of key personality traits." },
                        physicalTraits: { type: Type.STRING, description: "A summary of the character's physical appearance." },
                        lore: { type: Type.STRING, description: "The character's background, history, or lore." },
                        characterDescription: { type: Type.STRING, description: "A short greeting or first message from the character." },
                        scenario: { type: Type.STRING, description: "The context or scenario for the conversation." },
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    },

    summarizeConversation: async (history: Content[]): Promise<string> => {
        const conversationText = history
            .map(c => `${c.role}: ${c.parts.map(p => ('text' in p) ? p.text : '').join('')}`)
            .join('\n\n');

        if (!conversationText.trim()) {
            return "No conversation to summarize.";
        }

        const prompt = `Summarize the following conversation concisely. Focus on key information, decisions, and any unresolved topics that might be important for the next part of the conversation. The summary should be from a neutral, third-person perspective.\n\n---\n\n${conversationText}`;
        
        const response = await getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    },

    analyzeImage: async (prompt: string, imageBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType,
            },
        };
        const textPart = { text: prompt };

        return getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
        });
    },

    generateImage: async (prompt: string, aspectRatio: string, negativePrompt?: string): Promise<string[]> => {
        const config: any = {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        };

        if (negativePrompt) {
            config.negativePrompt = negativePrompt;
        }

        const response = await getAi().models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config,
        });
        return response.generatedImages.map(img => img.image.imageBytes);
    },

    analyzeVideo: async (prompt: string, videoBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
        const videoPart = {
            inlineData: {
                data: videoBase64,
                mimeType,
            },
        };
        const textPart = { text: prompt };

        return getAi().models.generateContent({
            model: 'gemini-2.5-pro',
            contents: { parts: [videoPart, textPart] },
        });
    },

    transcribeAudio: async (audioBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
        const audioPart = {
            inlineData: {
                data: audioBase64,
                mimeType,
            },
        };
        const textPart = { text: 'Transcribe the following audio:' };

        return getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] },
        });
    },

    analyzeDocument: async (text: string, prompt: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${prompt}\n\nDocument content:\n${text}`,
        });
    },

    groundedSearch: async (prompt: string, useMaps: boolean, location?: {latitude: number, longitude: number}): Promise<GenerateContentResponse> => {
        const tools: any[] = [{ googleSearch: {} }];
        const toolConfig: any = {};
        
        if (useMaps) {
            tools.push({ googleMaps: {} });
            if (location) {
                toolConfig.retrievalConfig = {
                    latLng: location,
                }
            }
        }

        return getAi().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools,
                ...(Object.keys(toolConfig).length > 0 && { toolConfig }),
            },
        });
    },
    
    browseWebsite: async (url: string): Promise<string> => {
        try {
            // NOTE: This fetch is subject to CORS policies and will fail for many websites.
            // A server-side proxy would be required for a robust implementation.
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch website. Status: ${response.status}`);
            }
            const html = await response.text();
             // Basic text extraction, removing scripts, styles, and tags.
            const textContent = html.replace(/<style[^>]*>.*<\/style>/gs, '')
                                    .replace(/<script[^>]*>.*<\/script>/gs, '')
                                    .replace(/<[^>]+>/g, ' ')
                                    .replace(/\s\s+/g, ' ')
                                    .trim();

            if (textContent.length < 100) {
                return "Could not extract sufficient readable content from the website.";
            }

            // Summarize the extracted text.
            const summaryResponse = await getAi().models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Summarize the following website content concisely:\n\n${textContent.substring(0, 30000)}`
            });
            return summaryResponse.text;
        } catch (error: any) {
            console.error(`Error browsing website ${url}:`, error);
            if (error.message.includes('Failed to fetch')) {
                return `I was unable to access that website. This is often due to web security restrictions (CORS). I cannot access every page directly.`;
            }
            return `An error occurred while trying to browse the website: ${error.message}`;
        }
    },

    complexReasoning: async (prompt: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                thinkingConfig: {
                    thinkingBudget: 32768,
                },
            },
        });
    },

    connectLive: (callbacks: LiveCallbacks, voiceName: string, tools?: { functionDeclarations: FunctionDeclaration[] }[], customSystemInstruction?: string) => {
        const toolInstructions = `You are a friendly and helpful AI assistant with multiple tools. Be conversational and announce your actions.

Your Capabilities:
- File Library: Use 'listDocuments' to see available files. Use 'analyzeFile' to read and understand a file from the library or one the user has just uploaded. Use 'createDocument' to create a new text file and save it to the library.
- Web & Maps Search: Use 'searchWeb' for recent information or location-based queries. You can search for YouTube videos for the user.
- Web Browsing: Use 'browseWebsite' with a full URL to read a specific webpage. Inform the user if you cannot access it due to security restrictions.
- Image Generation: Use 'generateImage' to create an image based on the user's description. You can include a style and things to avoid (negative prompt).
- Character Creation: Use 'createCharacter' to design a new AI persona from a description, which can then be used in chats.
- Media Player: Use 'controlMediaPlayer' to play, pause, stop, seek, or change the volume of a video or audio file the user has uploaded.`;
        
        const finalSystemInstruction = customSystemInstruction
            ? `${customSystemInstruction}\n\n[System Capabilities]\n${toolInstructions}`
            : toolInstructions;

        return getAi().live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks,
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: finalSystemInstruction,
                ...(tools && { tools }),
            },
        });
    }
};
