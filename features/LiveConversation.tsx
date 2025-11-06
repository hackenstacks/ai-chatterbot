
import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: import from @google/genai instead of @google/ai/generativelanguage
import { LiveServerMessage, LiveSession, FunctionDeclaration, Type, FunctionCall } from '@google/genai';
import { GeminiService } from '../services/geminiService';
import FeatureLayout from './common/FeatureLayout';
import { decode, decodeAudioData, createPcmBlob, fileToBase64, formatBytes, base64ToBlob, readFileContent, encode } from '../utils/helpers';
import { MicIcon, GlobeIcon, Volume2Icon, SaveIcon, PaperclipIcon, SendIcon, UploadIcon } from '../components/Icons';
import useGeolocation from '../hooks/useGeolocation';
import type { GroundingSource, Persona } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import Tooltip from '../components/Tooltip';
import { dbService, StoredFile } from '../services/dbService';
import { parseError, FormattedError } from '../utils/errorUtils';
import ErrorDisplay from '../components/ErrorDisplay';
import { LIVE_VOICES } from '../constants';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed' | 'reconnecting';
const MAX_RECONNECT_ATTEMPTS = 3;
const SUMMARY_THRESHOLD = 5; // Summarize after 5 turns (user + model)

interface SessionData {
    transcripts: { user: string, model: string }[];
    analysisResult: string | null;
    sources: GroundingSource[];
    generatedImageUrl: string | null;
    fileInfo?: {
        name: string;
        type: string;
        data: string; // base64
    };
}

interface LiveConversationProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const functionDeclarations: FunctionDeclaration[] = [
    {
        name: 'searchWeb',
        parameters: {
            type: Type.OBJECT,
            description: 'Search Google for recent and relevant information, including YouTube videos.',
            properties: {
                query: { type: Type.STRING, description: 'The search query.' },
                useMaps: { type: Type.BOOLEAN, description: 'Set to true to also search Google Maps. Requires user location.' }
            },
            required: ['query'],
        },
    },
    {
        name: 'browseWebsite',
        parameters: {
            type: Type.OBJECT,
            description: 'Reads the content of a specific website URL and provides a summary. Use the full URL including "https://".',
            properties: {
                url: { type: Type.STRING, description: 'The full URL of the website to browse.' },
            },
            required: ['url'],
        },
    },
    {
        name: 'generateImage',
        parameters: {
            type: Type.OBJECT,
            description: 'Generates an image based on a textual description.',
            properties: {
                prompt: { type: Type.STRING, description: 'A detailed description of the image to generate.' },
                style: { type: Type.STRING, description: 'The artistic style, e.g., "photorealistic", "anime", "cartoon".' },
                negativePrompt: { type: Type.STRING, description: 'A description of things to avoid in the image.' },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'listDocuments',
        parameters: {
            type: Type.OBJECT,
            description: 'List the documents available in the file library.',
            properties: {},
        },
    },
    {
        name: 'analyzeFile',
        parameters: {
            type: Type.OBJECT,
            description: 'Analyze the content of a file. Use fileName for documents in the library, or analyze the file uploaded in this chat.',
            properties: {
                prompt: { type: Type.STRING, description: 'A detailed question or instruction for the analysis.' },
                fileName: { type: Type.STRING, description: 'The name of the file from the file library to analyze.' },
            },
            required: ['prompt'],
        },
    },
    {
        name: 'createDocument',
        parameters: {
            type: Type.OBJECT,
            description: 'Creates a new text document with the given content and saves it to the file library.',
            properties: {
                fileName: { type: Type.STRING, description: 'The name of the file to create, e.g., "meeting-notes.txt".' },
                content: { type: Type.STRING, description: 'The text content to write into the file.' },
            },
            required: ['fileName', 'content'],
        },
    },
    {
        name: 'createCharacter',
        parameters: {
            type: Type.OBJECT,
            description: 'Creates a new character persona and saves it for future use in chats.',
            properties: {
                role: { type: Type.STRING, description: "The character's name or primary role." },
                personalityTraits: { type: Type.STRING, description: "A comma-separated list of key personality traits." },
                physicalTraits: { type: Type.STRING, description: "A summary of the character's physical appearance." },
                lore: { type: Type.STRING, description: "The character's background, history, or lore." },
                characterDescription: { type: Type.STRING, description: "A short greeting or first message from the character." },
                scenario: { type: Type.STRING, description: "The context or scenario for the conversation." },
            },
            required: ['role', 'personalityTraits', 'characterDescription'],
        },
    },
    {
        name: 'controlMediaPlayer',
        parameters: {
            type: Type.OBJECT,
            description: 'Controls the audio or video player. Can play, pause, stop, seek to a timestamp, or set volume.',
            properties: {
                action: {
                    type: Type.STRING,
                    description: 'The action to perform: "play", "pause", "stop", "seek", "setVolume".',
                    enum: ['play', 'pause', 'stop', 'seek', 'setVolume'],
                },
                timestamp: {
                    type: Type.NUMBER,
                    description: 'The time in seconds to seek to. Required only for the "seek" action.',
                },
                volume: {
                    type: Type.NUMBER,
                    description: 'The volume level from 0.0 to 1.0. Required only for the "setVolume" action.',
                }
            },
            required: ['action'],
        },
    },
];

const LiveConversation: React.FC<LiveConversationProps> = ({ documents, setDocuments }) => {
    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [isPaused, setIsPaused] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const [transcripts, setTranscripts] = useState<{ user: string, model: string }[]>([]);
    const [currentInterim, setCurrentInterim] = useState<{ user: string, model: string }>({ user: '', model: '' });
    const [file, setFile] = useState<File | null>(null); // For the main media player
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');
    const [imageInput, setImageInput] = useState<File | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
    const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingSource[]>([]);
    const [isProcessingTool, setIsProcessingTool] = useState(false);
    const [micGain, setMicGain] = useState(1.0);
    const [outputGain, setOutputGain] = useState(1.0);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [activePersonaId, setActivePersonaId] = useState<string>('default');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<FormattedError | null>(null);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
    const location = useGeolocation();
    const micGainNodeRef = useRef<GainNode | null>(null);
    const outputGainNodeRef = useRef<GainNode | null>(null);
    const transcriptEndRef = useRef<HTMLDivElement | null>(null);
    const isPausedRef = useRef(isPaused);
    const conversationSummaryRef = useRef<string | null>(null);

    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcripts, currentInterim]);

    useEffect(() => {
        dbService.getPersonas().then(setPersonas).catch(console.error);
    }, []);

    useEffect(() => {
        if (micGainNodeRef.current) {
            micGainNodeRef.current.gain.setValueAtTime(micGain, audioContextRef.current?.currentTime || 0);
        }
    }, [micGain]);

    useEffect(() => {
        if (outputGainNodeRef.current) {
            outputGainNodeRef.current.gain.setValueAtTime(outputGain, outputAudioContextRef.current?.currentTime || 0);
        }
    }, [outputGain]);

    const clearOutputs = () => {
        setAnalysisResult(null);
        setSources([]);
        setGeneratedImageUrl(null);
        setYoutubeVideoId(null);
        setError(null);
    };

    const handleStopConversation = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        
        scriptProcessorRef.current?.disconnect();
        scriptProcessorRef.current = null;
        
        micGainNodeRef.current?.disconnect();
        micGainNodeRef.current = null;

        outputGainNodeRef.current?.disconnect();
        outputGainNodeRef.current = null;
        
        audioContextRef.current?.close().catch(console.error);
        audioContextRef.current = null;
        
        outputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current = null;
        
        sourcesRef.current.forEach(source => source.stop());
        sourcesRef.current.clear();
        
        setConnectionState('idle');
        setIsPaused(false);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            clearOutputs();
            if (fileUrl) {
                URL.revokeObjectURL(fileUrl);
            }
            setFileUrl(URL.createObjectURL(selectedFile));
        }
    };
    
    const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type.startsWith('image/')) {
            setImageInput(selectedFile);
        }
    };
    
    const handleSendMessage = async () => {
        const session = await sessionPromiseRef.current;
        if (!session || (!textInput.trim() && !imageInput)) return;

        if (imageInput) {
            const base64Data = await fileToBase64(imageInput);
            session.sendRealtimeInput({
                media: { data: base64Data, mimeType: imageInput.type }
            });
            // Visually add to transcript
            setTranscripts(prev => [...prev, { user: `[Sent image: ${imageInput.name}] ${textInput}`, model:'' }]);
        }

        if (textInput.trim()) {
            // TTS hack: speak the text so the user's mic picks it up
            const utterance = new SpeechSynthesisUtterance(textInput);
            window.speechSynthesis.speak(utterance);
             if (!imageInput) { // if image is sent, text is attached to it
                setTranscripts(prev => [...prev, { user: textInput, model: '' }]);
            }
        }
        
        setTextInput('');
        setImageInput(null);
    };

    const handleSaveSession = async () => {
        if (transcripts.length === 0 && !analysisResult && !file && !generatedImageUrl) {
            alert("Nothing to save.");
            return;
        }

        const sessionData: SessionData = {
            transcripts,
            analysisResult,
            sources,
            generatedImageUrl,
        };

        if (file) {
            const fileData = await fileToBase64(file);
            sessionData.fileInfo = {
                name: file.name,
                type: file.type,
                data: fileData,
            };
        }

        const blob = new window.Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-live-session-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sessionFile = e.target.files?.[0];
        if (!sessionFile) return;

        handleStopConversation();
        setFile(null);
        setFileUrl(null);
        clearOutputs();

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const sessionData: SessionData = JSON.parse(event.target?.result as string);
                setTranscripts(sessionData.transcripts || []);
                setAnalysisResult(sessionData.analysisResult || null);
                setSources(sessionData.sources || []);
                setGeneratedImageUrl(sessionData.generatedImageUrl || null);

                if (sessionData.fileInfo) {
                    const { data, type, name } = sessionData.fileInfo;
                    const blob = base64ToBlob(data, type);
                    const restoredFile = new File([blob], name, { type });
                    setFile(restoredFile);
                    setFileUrl(URL.createObjectURL(restoredFile));
                }
            } catch (error) {
                console.error("Failed to load session:", error);
                alert("Invalid session file.");
            }
        };
        reader.readAsText(sessionFile);
        e.target.value = '';
    };

    const saveToLibrary = async (content: string, defaultName: string, type: 'text' | 'image') => {
        let fileName = prompt("Enter a name for the saved file:", defaultName);
        if (!fileName) return;

        if (documents.some(doc => doc.name === fileName)) {
            alert("A file with this name already exists in the library. Please choose a different name.");
            return;
        }

        let newFile: StoredFile;

        if (type === 'text') {
            const textEncoder = new TextEncoder();
            const contentBytes = textEncoder.encode(content);
            const base64Data = encode(contentBytes);
            newFile = {
                name: fileName,
                type: 'text/plain',
                size: contentBytes.length,
                lastModified: Date.now(),
                isArchived: false,
                data: base64Data,
            };
        } else { // image
            const base64Data = content.split(',')[1];
            const mimeType = 'image/jpeg';
            const blob = base64ToBlob(base64Data, mimeType);
            newFile = {
                name: fileName,
                type: mimeType,
                size: blob.size,
                lastModified: Date.now(),
                isArchived: false,
                data: base64Data,
            };
        }

        try {
            await dbService.addDocuments([newFile]);
            setDocuments(prev => [...prev, newFile]);
            alert(`'${fileName}' saved to File Library.`);
        } catch (error) {
            console.error("Failed to save file:", error);
            alert("Could not save the file to the library.");
        }
    };
    
    const handleSaveTranscript = () => {
        if (transcripts.length === 0) return;
        const formattedTranscript = transcripts.map(t => `You:\n${t.user}\n\nGemini:\n${t.model}`).join('\n\n---\n\n');
        saveToLibrary(formattedTranscript, `live-transcript-${new Date().toISOString()}.txt`, 'text');
    };

    const handleToolCall = async (functionCalls: FunctionCall[]) => {
        setIsProcessingTool(true);
        clearOutputs();
        const session = await sessionPromiseRef.current;
        if (!session) return;
        
        const activeDocuments = documents.filter(doc => !doc.isArchived);

        for (const fc of functionCalls) {
            const { name, args } = fc;
            let result: any = { status: 'error', message: 'Unknown function' };

            try {
                switch (name) {
                    case 'searchWeb':
                        const geo = (location.latitude && location.longitude) ? { latitude: location.latitude, longitude: location.longitude } : undefined;
                        const searchResponse = await GeminiService.groundedSearch(args.query, args.useMaps, geo);
                        const searchResultText = searchResponse.text;
                        const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
                        if (groundingChunks) {
                            const newSources: GroundingSource[] = groundingChunks.map((chunk: any) => ({
                                uri: chunk.web?.uri || chunk.maps?.uri || '#',
                                title: chunk.web?.title || chunk.maps?.title || 'Unknown Source',
                                type: chunk.web ? 'web' : 'maps'
                            })).filter((s: GroundingSource) => s.uri !== '#');
                            setSources(newSources);

                            const youtubeSource = newSources.find(s => s.uri.includes('youtube.com/watch'));
                            if (youtubeSource) {
                                try {
                                    const url = new URL(youtubeSource.uri);
                                    const videoId = url.searchParams.get('v');
                                    if (videoId) setYoutubeVideoId(videoId);
                                } catch (e) { console.error("Error parsing YouTube URL", e); }
                            }
                        }
                        setAnalysisResult(searchResultText);
                        result = { status: 'success', summary: searchResultText };
                        break;
                    
                    case 'browseWebsite':
                        const browseSummary = await GeminiService.browseWebsite(args.url);
                        setAnalysisResult(browseSummary);
                        result = { status: 'success', summary: browseSummary };
                        break;

                    case 'generateImage':
                        const fullPrompt = args.style ? `${args.prompt}, in the style of ${args.style}` : args.prompt;
                        const images = await GeminiService.generateImage(fullPrompt, "16:9", args.negativePrompt);
                        if (images.length > 0) {
                            setGeneratedImageUrl(`data:image/jpeg;base64,${images[0]}`);
                            result = { status: 'success', message: 'Image generated successfully.' };
                        } else {
                            result = { status: 'error', message: 'Image generation failed to return an image.' };
                        }
                        break;

                    case 'listDocuments':
                        if (activeDocuments.length === 0) {
                            result = { status: 'success', message: "The file library is currently empty." };
                        } else {
                            result = { status: 'success', files: activeDocuments.map(f => f.name) };
                        }
                        break;

                    case 'createDocument':
                        await saveToLibrary(args.content, args.fileName, 'text');
                        result = { status: 'success', message: `Document '${args.fileName}' saved to the library.` };
                        break;
                    
                    case 'createCharacter':
                        const newPersona: Persona = {
                            id: crypto.randomUUID(),
                            isActive: false, // Don't make it active immediately
                            role: args.role || 'New AI Character',
                            personalityTraits: args.personalityTraits || '',
                            physicalTraits: args.physicalTraits || '',
                            lore: args.lore || '',
                            characterDescription: args.characterDescription || '',
                            scenario: args.scenario || '',
                            systemPrompt: '', 
                            avatarUrl: '', 
                            voice: '',
                        };
                        const currentPersonas = await dbService.getPersonas();
                        if (currentPersonas.some(p => p.role === newPersona.role)) {
                            result = { status: 'error', message: `A character named ${newPersona.role} already exists.` };
                        } else {
                            const updatedPersonas = [...currentPersonas, newPersona];
                            await dbService.savePersonas(updatedPersonas);
                            setPersonas(updatedPersonas); // Update local state
                            result = { status: 'success', message: `Character ${newPersona.role} created successfully.` };
                        }
                        break;

                    case 'analyzeFile':
                        let fileToAnalyze: File | undefined = undefined;
                        let fileSource: StoredFile | undefined = undefined;
                        
                        if (args.fileName) {
                            fileSource = activeDocuments.find(doc => doc.name === args.fileName);
                            if (!fileSource) {
                                result = { status: 'error', message: `File "${args.fileName}" not found in the library.` };
                                break;
                            }
                            const blob = base64ToBlob(fileSource.data, fileSource.type);
                            fileToAnalyze = new File([blob], fileSource.name, {type: fileSource.type});

                        } else if (file) {
                            fileToAnalyze = file;
                        }

                        if (!fileToAnalyze) {
                           result = { status: 'error', message: 'No file specified or uploaded. Please ask the user to upload a file or specify one from the library.' };
                        } else {
                            let analysisText = '';
                            if (fileToAnalyze.type.startsWith('image/')) {
                                const base64 = await fileToBase64(fileToAnalyze);
                                analysisText = (await GeminiService.analyzeImage(args.prompt, base64, fileToAnalyze.type)).text;
                            } else if (fileToAnalyze.type.startsWith('video/')) {
                                const base64 = await fileToBase64(fileToAnalyze);
                                analysisText = (await GeminiService.analyzeVideo(args.prompt, base64, fileToAnalyze.type)).text;
                            } else if (fileToAnalyze.type.startsWith('audio/')) {
                                const base64 = await fileToBase64(fileToAnalyze);
                                analysisText = (await GeminiService.transcribeAudio(base64, fileToAnalyze.type)).text;
                            } else if (fileToAnalyze.type.startsWith('text/')) {
                                 const textContent = await readFileContent(fileToAnalyze);
                                 analysisText = (await GeminiService.analyzeDocument(textContent, args.prompt)).text;
                            } else {
                                analysisText = `Unsupported file type for analysis: ${fileToAnalyze.type}.`;
                            }
                            setAnalysisResult(analysisText);
                            result = { status: 'success', summary: analysisText };
                        }
                        break;
                    
                    case 'controlMediaPlayer':
                        if (mediaRef.current) {
                            switch(args.action) {
                                case 'play': mediaRef.current.play(); break;
                                case 'pause': mediaRef.current.pause(); break;
                                case 'stop':
                                    mediaRef.current.pause();
                                    mediaRef.current.currentTime = 0;
                                    break;
                                case 'seek':
                                    if (typeof args.timestamp === 'number') {
                                        mediaRef.current.currentTime = args.timestamp;
                                    }
                                    break;
                                case 'setVolume':
                                     if (typeof args.volume === 'number' && args.volume >= 0 && args.volume <= 1) {
                                        mediaRef.current.volume = args.volume;
                                    }
                                    break;
                            }
                            result = { status: 'success', action: args.action };
                        } else {
                            result = { status: 'error', message: 'No media is loaded.' };
                        }
                        break;
                }
            } catch (e: any) {
                console.error(`Error executing tool ${name}:`, e);
                setError(parseError(e));
                result = { status: 'error', message: e.message };
            }
            
            session.sendToolResponse({
                functionResponses: { id: fc.id, name: fc.name, response: { result } }
            });
        }
        setIsProcessingTool(false);
    };

    const handleStartConversation = useCallback(async (isRetry = false, customSystemInstruction?: string) => {
        if (!isRetry) {
            setReconnectAttempts(0);
            setTranscripts([]);
            setCurrentInterim({ user: '', model: '' });
            if (!customSystemInstruction) { // Don't clear summary if we are restarting with it
                 conversationSummaryRef.current = null;
            }
        }
        setConnectionState('connecting');
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;
            
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputAudioContext;

            const outputGainNode = outputAudioContext.createGain();
            outputGainNode.gain.value = outputGain;
            outputGainNodeRef.current = outputGainNode;
            outputGainNode.connect(outputAudioContext.destination);

            const activePersona = personas.find(p => p.id === activePersonaId);
            let voiceName = activePersona?.voice || await dbService.getVoicePreference() || 'Zephyr';
            if (!LIVE_VOICES.includes(voiceName)) {
                console.warn(`Stored voice "${voiceName}" is not valid. Defaulting to Zephyr.`);
                voiceName = 'Zephyr';
            }
            
            let systemInstruction = '';
            if (activePersona) {
                systemInstruction = [
                    activePersona.systemPrompt,
                    `Your name/role is: ${activePersona.role}.`,
                    `Your personality is: ${activePersona.personalityTraits}.`,
                    activePersona.physicalTraits ? `Your physical appearance: ${activePersona.physicalTraits}.` : '',
                    activePersona.lore ? `Your background/lore: ${activePersona.lore}.` : '',
                    activePersona.scenario ? `The current scenario is: ${activePersona.scenario}.` : ''
                ].filter(Boolean).join('\n');
            }
            
            const finalSystemInstruction = customSystemInstruction || (conversationSummaryRef.current ? `${conversationSummaryRef.current}\n\n${systemInstruction}` : systemInstruction);

            const sessionPromise = GeminiService.connectLive({
                onopen: () => {
                    setConnectionState('connected');
                    setReconnectAttempts(0);
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    const micGainNode = inputAudioContext.createGain();
                    micGainNode.gain.value = micGain;
                    micGainNodeRef.current = micGainNode;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        if (isPausedRef.current) return;
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(micGainNode);
                    micGainNode.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.toolCall) {
                        handleToolCall(message.toolCall.functionCalls);
                    }
                    if (message.serverContent?.inputTranscription) {
                        setCurrentInterim(prev => ({ ...prev, user: prev.user + message.serverContent.inputTranscription.text }));
                    }
                    if (message.serverContent?.outputTranscription) {
                        setCurrentInterim(prev => ({ ...prev, model: prev.model + message.serverContent.outputTranscription.text }));
                    }
                    if (message.serverContent?.turnComplete) {
                        setCurrentInterim(current => {
                            if (current.user || current.model) {
                                setTranscripts(prev => [...prev, current]);
                            }
                            return { user: '', model: '' };
                        });
                    }
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio && outputAudioContextRef.current && outputGainNodeRef.current) {
                        const ctx = outputAudioContextRef.current;
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputGainNodeRef.current);
                        source.addEventListener('ended', () => sourcesRef.current.delete(source));
                        source.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        sourcesRef.current.add(source);
                    }
                    if (message.serverContent?.interrupted) {
                        sourcesRef.current.forEach(source => source.stop());
                        sourcesRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e: ErrorEvent) => { 
                    console.error('Live session error:', e); 
                    setError(parseError(e));
                    setConnectionState('error'); 
                    handleStopConversation();
                },
                onclose: (e: CloseEvent) => {
                    if (e.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                        setConnectionState('reconnecting');
                        const nextAttempt = reconnectAttempts + 1;
                        setReconnectAttempts(nextAttempt);
                        setTimeout(() => handleStartConversation(true), 2000 * nextAttempt);
                    } else {
                        setConnectionState('closed');
                    }
                },
            }, voiceName, [{ functionDeclarations }], finalSystemInstruction);

            sessionPromiseRef.current = sessionPromise;

        } catch (error) {
            console.error("Failed to start conversation:", error);
            setError(parseError(error));
            setConnectionState('error');
        }
    }, [reconnectAttempts, handleStopConversation, documents, micGain, outputGain, personas, activePersonaId]);

    const summarizeAndRestart = useCallback(async () => {
        if (isSummarizing) return;
        
        setIsSummarizing(true);
        const currentTranscripts = transcripts;
        
        handleStopConversation();

        try {
            const conversationText = currentTranscripts.map(t => `User: ${t.user}\nModel: ${t.model}`).join('\n\n');
            const summary = await GeminiService.summarizeConversation([{ role: 'user', parts: [{ text: `Summarize this conversation: ${conversationText}` }] }]);
            conversationSummaryRef.current = `This is a summary of the conversation so far, continue from here:\n${summary}`;
            
            const summaryNotification = { user: '', model: `[System: I've summarized our conversation to maintain context.]` };
            setTranscripts(prev => [...prev, summaryNotification]);

            // Wait for UI to update before restarting
            setTimeout(() => {
                handleStartConversation(false);
                setIsSummarizing(false);
            }, 500);

        } catch (error) {
            console.error("Failed to summarize and restart:", error);
            setError(parseError(error));
            // If summarization fails, just restart without it
            handleStartConversation(false);
            setIsSummarizing(false);
        }
    }, [isSummarizing, transcripts, handleStopConversation, handleStartConversation]);

    useEffect(() => {
        if (transcripts.length > 0 && transcripts.length % SUMMARY_THRESHOLD === 0 && connectionState === 'connected' && !isSummarizing) {
            // Check if the last message is not the summary notification
            if (!transcripts[transcripts.length - 1].model.includes('System:')) {
                summarizeAndRestart();
            }
        }
    }, [transcripts, connectionState, summarizeAndRestart, isSummarizing]);
    
    useEffect(() => {
        return () => { handleStopConversation(); };
    }, [handleStopConversation]);

    const renderMedia = () => {
        if (!file || !fileUrl) return <p className="text-slate-500 text-center">Upload a file for temporary analysis.</p>;
        if (file.type.startsWith("image/")) return <img src={fileUrl} alt={file.name} className="max-h-full max-w-full object-contain rounded-lg" />;
        if (file.type.startsWith("video/")) return <video ref={mediaRef} src={fileUrl} controls className="w-full rounded-lg" />;
        if (file.type.startsWith("audio/")) return <audio ref={mediaRef} src={fileUrl} controls className="w-full" />;
        return <div className="text-center text-slate-300"> <p className="font-bold">{file.name}</p> <p className="text-sm">{formatBytes(file.size)}</p> d></div>;
    };
    
    const renderOutput = () => {
        if (isProcessingTool) return <p className="text-slate-400">Processing request...</p>;
        if (youtubeVideoId) return (
            <div className="aspect-video">
                <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="rounded-lg"
                ></iframe>
            </div>
        );
        if (generatedImageUrl) return (
            <div className="relative group">
                <img src={generatedImageUrl} alt="Generated by AI" className="max-w-full max-h-full object-contain rounded-lg mx-auto" />
                <button onClick={() => saveToLibrary(generatedImageUrl, 'generated-image.jpg', 'image')} className="absolute top-2 right-2 bg-slate-900/50 hover:bg-blue-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <SaveIcon />
                </button>
            </div>
        );
        if (analysisResult) return <MarkdownRenderer content={analysisResult} />;
        if (sources.length > 0) return null; // Rendered below
        return <p className="text-slate-500">Results from tools will appear here.</p>;
    }

    const isBusy = connectionState === 'connecting' || connectionState === 'reconnecting' || isSummarizing;

    return (
        <FeatureLayout title="Live Conversation" description="Speak with a multimodal Gemini assistant. Ask it to search, analyze files, and more.">
            <div className="grid md:grid-cols-2 gap-6 h-full overflow-hidden">
                <div className="flex flex-col space-y-4 overflow-hidden">
                    <div className="flex-shrink-0 flex flex-col gap-4">
                        <div className="flex items-center justify-center flex-wrap gap-2">
                            {connectionState !== 'connected' ? (
                                <Tooltip text="Start a live voice session with Gemini. Your browser will ask for microphone permission.">
                                    <button onClick={() => handleStartConversation()} disabled={isBusy} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-colors disabled:bg-slate-600">
                                        <MicIcon />
                                        <span>{isBusy ? 'Connecting...' : 'Start Conversation'}</span>
                                    </button>
                                </Tooltip>
                            ) : (
                                <div className="flex items-center space-x-2">
                                <Tooltip text="End the current voice conversation and disconnect from the AI.">
                                    <div className="relative">
                                        <button onClick={handleStopConversation} className="relative z-10 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-colors">
                                            <MicIcon />
                                            <span>Stop</span>
                                        </button>
                                        <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-green-500/50 animate-ping"></div>
                                    </div>
                                </Tooltip>
                                 <Tooltip text={isPaused ? "Resume sending audio to the AI." : "Temporarily pause sending audio to the AI."}>
                                        <button onClick={() => setIsPaused(!isPaused)} className={`font-bold py-2 px-4 rounded-lg flex items-center space-x-2 transition-colors ${isPaused ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-slate-600 hover:bg-slate-700'} text-white`}>
                                            <span>{isPaused ? "Resume" : "Pause"}</span>
                                        </button>
                                 </Tooltip>
                                </div>
                            )}
                            <div className='flex gap-2'>
                                <Tooltip text="Save the current session (transcript, media, and results) to a downloadable file.">
                                    <button onClick={handleSaveSession} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"><SaveIcon /></button>
                                </Tooltip>
                                <Tooltip text="Load a previously saved session file. This will end the current conversation.">
                                    <label htmlFor="load-live-session" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer">
                                        <input id="load-live-session" type="file" className="hidden" accept=".json" onChange={handleLoadSession} />
                                        <UploadIcon />
                                    </label>
                                </Tooltip>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/50 p-3 rounded-lg">
                             <div>
                                <select id="persona-select" value={activePersonaId} onChange={e => setActivePersonaId(e.target.value)} disabled={connectionState === 'connected'} className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50">
                                    <option value="default">Default Assistant</option>
                                    {personas.map(p => <option key={p.id} value={p.id}>{p.role}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center space-x-2 text-slate-300">
                                <Tooltip text="Adjust the sensitivity of your microphone."><MicIcon /></Tooltip>
                                <input type="range" id="mic-gain" min="0" max="2" step="0.1" value={micGain} onChange={e => setMicGain(parseFloat(e.target.value))} className="w-full" />
                            </div>
                             <div className="flex items-center space-x-2 text-slate-300">
                                <Tooltip text="Adjust the volume of the AI's spoken response."><Volume2Icon /></Tooltip>
                                <input type="range" id="output-gain" min="0" max="1.5" step="0.05" value={outputGain} onChange={e => setOutputGain(parseFloat(e.target.value))} className="w-full" />
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow bg-slate-800/50 rounded-lg p-4 flex items-center justify-center min-h-0">{renderMedia()}</div>
                    <div className="flex-shrink-0 space-y-2">
                        {imageInput && <p className="text-xs text-slate-400">Attached: {imageInput.name}</p>}
                        <div className="flex items-center space-x-2">
                            <input type="file" id="image-message-upload" className="hidden" accept="image/*" onChange={handleImageInputChange} disabled={connectionState !== 'connected'} />
                            <Tooltip text="Attach an image to your next message.">
                                <label htmlFor="image-message-upload" className={`p-3 rounded-full transition-colors ${connectionState !== 'connected' ? 'bg-slate-700 opacity-50' : 'bg-slate-700 hover:bg-blue-600/50 cursor-pointer'}`}>
                                    <PaperclipIcon />
                                </label>
                            </Tooltip>
                            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder="Type a message... AI will 'hear' it via TTS" rows={1} className="flex-grow p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" disabled={connectionState !== 'connected'} />
                             <Tooltip text="Send text and/or attached image. Your text will be spoken via TTS for the AI to hear." position="top">
                                <button onClick={handleSendMessage} disabled={connectionState !== 'connected' || (!textInput.trim() && !imageInput)} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white p-3 rounded-full transition-colors"><SendIcon /></button>
                            </Tooltip>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col space-y-4 h-full overflow-hidden">
                    <div className="flex-grow bg-slate-800/50 rounded-lg p-4 overflow-y-auto min-h-0">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-300">Analysis & Tool Results</h3>
                             {analysisResult && (
                                <button onClick={() => saveToLibrary(analysisResult, 'analysis-result.txt', 'text')} className="text-slate-400 hover:text-white p-1 rounded-full"><SaveIcon /></button>
                             )}
                        </div>
                        {renderOutput()}
                        {sources.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-slate-400">Sources:</h4>
                                <ul className="space-y-1 mt-1">{sources.map((s, i) => <li key={i} className="flex items-start space-x-2"><GlobeIcon /><a href={s.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm truncate">{s.title}</a></li>)}</ul>
                            </div>
                        )}
                    </div>
                    <div className="flex-grow bg-slate-800/50 rounded-lg p-4 overflow-y-auto min-h-0 flex flex-col">
                        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
                             <h3 className="text-lg font-semibold text-slate-300">Conversation Transcript</h3>
                             {transcripts.length > 0 && (
                                <button onClick={handleSaveTranscript} className="text-slate-400 hover:text-white p-1 rounded-full"><SaveIcon /></button>
                             )}
                        </div>
                        <div className="overflow-y-auto flex-grow">
                            {transcripts.map((t, i) => (
                                <div key={i} className="mb-3">
                                    <p className="text-blue-300 font-semibold">You:</p><p className="text-slate-300 ml-2">{t.user}</p>
                                    <p className="text-green-300 font-semibold mt-1">Gemini:</p><p className="text-slate-300 ml-2">{t.model}</p>
                                </div>
                            ))}
                            {(currentInterim.user || currentInterim.model) && (
                                <div>
                                {currentInterim.user && <p className="text-blue-300/70">You: <span className="text-slate-400 font-normal">{currentInterim.user}</span></p>}
                                {currentInterim.model && <p className="text-green-300/70 mt-1">Gemini: <span className="text-slate-400 font-normal">{currentInterim.model}</span></p>}
                                </div>
                            )}
                            {connectionState === 'idle' && !transcripts.length && <div className="text-slate-500">Press "Start Conversation" to begin.</div>}
                            <div ref={transcriptEndRef} />
                        </div>
                    </div>
                </div>
            </div>
             <div className="h-auto min-h-[4rem] text-center mt-2 px-4">
                 {error ? (
                    <ErrorDisplay error={error} onDismiss={() => setError(null)} />
                 ) : (
                    <>
                        {isSummarizing && <p className="text-yellow-400">Summarizing conversation to maintain context...</p>}
                        {connectionState === 'closed' && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS && <p className="text-red-400">Could not reconnect. Please check your connection and try again.</p>}
                        {connectionState === 'closed' && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && <p className="text-yellow-400">Connection closed.</p>}
                        {connectionState === 'reconnecting' && <p className="text-yellow-400">Connection lost. Reconnecting... (Attempt {reconnectAttempts})</p>}
                    </>
                 )}
            </div>
        </FeatureLayout>
    );
};

export default LiveConversation;