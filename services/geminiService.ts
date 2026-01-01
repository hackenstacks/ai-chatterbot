
import { GoogleGenAI, Type, Modality, Chat, GenerateContentResponse, LiveServerMessage, FunctionDeclaration, Content } from '@google/genai';
import { Persona } from '../types.ts';

const getAi = (): GoogleGenAI => {
    if (!process.env.API_KEY) {
        console.error("API_KEY environment variable not set.");
        throw new Error("API key is missing.");
    }
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
        description: 'Generates an image based on a textual description.',
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

// Helper to calculate cosine similarity between two vectors
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const GeminiService = {
    createChat: (systemInstruction?: string): Chat => {
        return getAi().chats.create({
            model: 'gemini-3-flash-preview',
            config: { 
                ...(systemInstruction && { systemInstruction }),
                tools: chatTools,
            },
        });
    },

    createChatWithHistory: (history: Content[], systemInstruction?: string): Chat => {
        return getAi().chats.create({
            model: 'gemini-3-flash-preview',
            history: history,
            config: { 
                ...(systemInstruction && { systemInstruction }),
                tools: chatTools,
            },
        });
    },

    getEmbedding: async (text: string): Promise<number[]> => {
        const response = await getAi().models.embedContent({
            model: 'text-embedding-004',
            contents: text,
        });
        return response.embedding?.values || [];
    },

    getPersonaSuggestion: async (field: keyof Persona, currentPersona: Partial<Persona>): Promise<string> => {
        // FIX: Exclude avatarUrl (base64) and internal IDs to prevent exceeding token limits.
        const { avatarUrl, id, isActive, voice, ...relevantContext } = currentPersona;

        const personaContext = Object.entries(relevantContext)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}: ${String(value).substring(0, 5000)}`) // Safety truncate
            .join(', ');
        
        const prompt = `Based on the following partial persona, suggest a creative value for "${field}".\n\nContext: ${personaContext || 'No details yet.'}`;
        
        const response = await getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        
        return response.text.trim();
    },

    createPersonaFromText: async (description: string): Promise<Partial<Persona>> => {
        const prompt = `Extract character attributes into JSON:\n\n${description}`;

        const response = await getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        role: { type: Type.STRING },
                        personalityTraits: { type: Type.STRING },
                        physicalTraits: { type: Type.STRING },
                        lore: { type: Type.STRING },
                        characterDescription: { type: Type.STRING },
                        scenario: { type: Type.STRING },
                    }
                }
            }
        });
        
        return JSON.parse(response.text.trim());
    },

    summarizeConversation: async (history: Content[]): Promise<string> => {
        const conversationText = history
            .map(c => `${c.role}: ${c.parts.map(p => ('text' in p) ? p.text : '').join('')}`)
            .join('\n\n');

        const response = await getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Create a detailed working summary of this conversation to serve as long-term memory. Capture key events, user preferences, and the current state of the narrative:\n\n${conversationText}`,
        });

        return response.text;
    },

    analyzeImage: async (prompt: string, imageBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { data: imageBase64, mimeType } }, { text: prompt }] },
        });
    },

    generateImage: async (prompt: string, aspectRatio: string, negativePrompt?: string): Promise<string[]> => {
        const response = await getAi().models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: `${prompt}${negativePrompt ? ` (avoid: ${negativePrompt})` : ''}` }] },
            config: { imageConfig: { aspectRatio: aspectRatio as any } }
        });
        const images: string[] = [];
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) images.push(part.inlineData.data);
        }
        return images;
    },

    analyzeVideo: async (prompt: string, videoBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [{ inlineData: { data: videoBase64, mimeType } }, { text: prompt }] },
        });
    },

    transcribeAudio: async (audioBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [{ inlineData: { data: audioBase64, mimeType } }, { text: 'Transcribe this audio:' }] },
        });
    },

    analyzeDocument: async (text: string, prompt: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `${prompt}\n\nContent:\n${text}`,
        });
    },

    groundedSearch: async (prompt: string, useMaps: boolean, location?: {latitude: number, longitude: number}): Promise<GenerateContentResponse> => {
        const tools: any[] = [{ googleSearch: {} }];
        if (useMaps) tools.push({ googleMaps: {} });

        return getAi().models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools,
                ...(useMaps && location && { toolConfig: { retrievalConfig: { latLng: location } } }),
            },
        });
    },
    
    browseWebsite: async (url: string): Promise<string> => {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const summaryResponse = await getAi().models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Summarize this content:\n\n${textContent.substring(0, 10000)}`
            });
            return summaryResponse.text;
        } catch (error: any) {
            return `Failed to browse ${url}: ${error.message}`;
        }
    },

    complexReasoning: async (prompt: string): Promise<GenerateContentResponse> => {
        return getAi().models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 32768 } },
        });
    },

    connectLive: (callbacks: LiveCallbacks, voiceName: string, tools?: { functionDeclarations: FunctionDeclaration[] }[], customSystemInstruction?: string) => {
        return getAi().live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks,
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' } } },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: customSystemInstruction,
                ...(tools && { tools }),
            },
        });
    }
};
