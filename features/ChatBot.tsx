
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chat, FunctionCall, Part } from '@google/genai';
import { GeminiService } from '../services/geminiService';
import type { ChatMessage, Persona } from '../types';
import FeatureLayout from './common/FeatureLayout';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { SendIcon, TrashIcon, SettingsIcon, PaperclipIcon, MicIcon, Volume2Icon, VolumeOffIcon, SparklesIcon, SaveIcon, UploadIcon } from '../components/Icons';
import Spinner from '../components/Spinner';
import Tooltip from '../components/Tooltip';
import { dbService, StoredFile } from '../services/dbService';
import PersonaConfigModal from './common/PersonaConfigModal';
import FileAccessModal from './common/FileAccessModal';
import { encode, fileToBase64, base64ToBlob } from '../utils/helpers';
import { parseError } from '../utils/errorUtils';


const HISTORY_SUMMARY_THRESHOLD = 10;
const MESSAGES_TO_KEEP_AFTER_SUMMARY = 4;

const createDefaultPersona = (): Persona => ({
  id: crypto.randomUUID(),
  isActive: true,
  systemPrompt: '',
  role: 'Helpful Assistant',
  personalityTraits: 'Friendly, knowledgeable, concise',
  physicalTraits: '',
  lore: '',
  characterDescription: '',
  avatarUrl: '',
  scenario: '',
  voice: '',
});

interface ChatBotProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

interface SessionData {
    messages: ChatMessage[];
    persona: Persona;
    accessibleFiles: string[];
}

const ChatBot: React.FC<ChatBotProps> = ({ documents, setDocuments }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [activePersona, setActivePersona] = useState<Persona>(createDefaultPersona());
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const [accessibleFiles, setAccessibleFiles] = useState<string[]>([]);
    const [isFileModalOpen, setIsFileModalOpen] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null); // SpeechRecognition
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const constructSystemPrompt = useCallback((p: Persona, files: string[]): string => {
        let prompt = p.systemPrompt || `You are a helpful AI assistant.`;
        if (p.role) prompt += `\nYour name/role is: ${p.role}.`;
        if (p.personalityTraits) prompt += `\nYour personality is: ${p.personalityTraits}.`;
        if (p.physicalTraits) prompt += `\nYour physical appearance: ${p.physicalTraits}.`;
        if (p.lore) prompt += `\nYour background/lore: ${p.lore}.`;
        if (p.characterDescription) prompt += `\nStart your first message with: ${p.characterDescription}`;
        if (p.scenario) prompt += `\nThe current scenario is: ${p.scenario}.`;
        if (files.length > 0) {
            prompt += `\n\n[SYSTEM NOTICE]: You have been granted access to the following files from the user's library. You can analyze them when asked:\n- ${files.join('\n- ')}`;
          }
        return prompt.trim();
    }, []);
    
    const initializeChatState = useCallback(async () => {
        try {
            const [history, savedPersonas, savedFileAccess] = await Promise.all([
                dbService.getChatHistory(),
                dbService.getPersonas(),
                dbService.getSetting<string[]>('accessibleFiles')
            ]);
            
            let currentPersona = savedPersonas.find(p => p.isActive);
            if (!currentPersona) {
                currentPersona = savedPersonas.length > 0 ? { ...savedPersonas[0], isActive: true } : createDefaultPersona();
                const updatedPersonas: Persona[] = savedPersonas.map(p => ({ ...p, isActive: p.id === currentPersona!.id }));
                if (savedPersonas.length === 0) updatedPersonas.push(currentPersona);
                await dbService.savePersonas(updatedPersonas);
            }

            setActivePersona(currentPersona);
            setMessages(history);
            setAccessibleFiles(savedFileAccess || []);
            
        } catch (error) {
            console.error("Failed to load chat history or persona:", error);
            setActivePersona(createDefaultPersona());
        }
    }, []);

    useEffect(() => {
        initializeChatState();
    }, [initializeChatState]);

    useEffect(() => {
        if (activePersona) {
            const systemInstruction = constructSystemPrompt(activePersona, accessibleFiles);
            const chatHistory = messages.map(m => ({ role: m.role, parts: m.parts }));
            const newChat = GeminiService.createChatWithHistory(chatHistory, systemInstruction);
            setChat(newChat);
        }
    }, [activePersona, accessibleFiles, messages, constructSystemPrompt]);
    
    useEffect(() => {
        if (messages.length > 0) {
            dbService.saveChatHistory(messages).catch(console.error);
        }
    }, [messages]);

    useEffect(() => {
        dbService.saveSetting('accessibleFiles', accessibleFiles).catch(console.error);
    }, [accessibleFiles]);

    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (isTtsEnabled && lastMessage?.role === 'model' && lastMessage.parts[0].text && !isLoading) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(lastMessage.parts[0].text);
            if (activePersona.voice) {
                const voice = window.speechSynthesis.getVoices().find(v => v.name === activePersona.voice);
                if (voice) {
                    utterance.voice = voice;
                }
            }
            window.speechSynthesis.speak(utterance);
        }
    }, [messages, isTtsEnabled, activePersona.voice, isLoading]);
    
    const handleSavePersona = async (newPersona: Persona) => {
        const allPersonas = await dbService.getPersonas();
        const updatedPersonas = allPersonas.map(p => p.id === newPersona.id ? newPersona : p);
        if (!updatedPersonas.some(p => p.id === newPersona.id)) {
            updatedPersonas.push(newPersona);
        }
        await dbService.savePersonas(updatedPersonas);
        setActivePersona(newPersona);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleFunctionCalls = async (functionCalls: FunctionCall[]) => {
        for (const call of functionCalls) {
            if (call.name === 'generateImage' && call.args) {
                setIsLoading(true);
                try {
                    const fullPrompt = call.args.style
                        ? `${call.args.prompt}, in the style of ${call.args.style}`
                        : call.args.prompt;
                    const images = await GeminiService.generateImage(fullPrompt, "1:1");
                    if (images.length > 0) {
                        const imageUrl = `data:image/jpeg;base64,${images[0]}`;
                        setMessages(prev => [...prev, { role: 'model', parts: [{ text: '' }], imageUrl }]);
                    }
                } catch (error) {
                    console.error("Image generation tool failed:", error);
                    setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I couldn't generate the image right now." }] }]);
                } finally {
                    setIsLoading(false);
                }
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !chat || isLoading || isSummarizing) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }] };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        // Check for file context
        const messageParts: Part[] = [{ text: currentInput }];
        const filesToAttach = documents.filter(doc => accessibleFiles.includes(doc.name) && currentInput.toLowerCase().includes(doc.name.toLowerCase()));
        
        for (const file of filesToAttach) {
            if (file.type.startsWith('image/')) {
                messageParts.push({
                    inlineData: {
                        mimeType: file.type,
                        data: file.data
                    }
                });
            } else if (file.type.startsWith('text/')) {
                try {
                    const textContent = atob(file.data); // data is base64
                    messageParts.push({ text: `\n\n[Content of ${file.name}]:\n${textContent}` });
                } catch (e) { console.error(`Failed to decode text file ${file.name}`, e); }
            }
        }

        if (currentInput.toLowerCase().startsWith('/imagine ')) {
            try {
                const prompt = currentInput.substring(8).trim();
                const images = await GeminiService.generateImage(prompt, "1:1");
                if (images.length > 0) {
                    const imageUrl = `data:image/jpeg;base64,${images[0]}`;
                    setMessages(prev => [...prev, { role: 'model', parts: [{text: ''}], imageUrl }]);
                }
            } catch (error) {
                console.error("Image generation command failed:", error);
                setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Sorry, I couldn't generate an image with that prompt." }] }]);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        try {
            const result = await chat.sendMessageStream({ message: messageParts });
            let text = '';
            let accumulatedFunctionCalls: FunctionCall[] = [];
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

            for await (const chunk of result) {
                text += chunk.text;
                if (chunk.functionCalls) {
                    accumulatedFunctionCalls.push(...chunk.functionCalls);
                }
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].parts[0].text = text;
                    return newMessages;
                });
            }

            if (accumulatedFunctionCalls.length > 0) {
                handleFunctionCalls(accumulatedFunctionCalls);
            }

        } catch (error) {
            console.error(error);
            const formattedError = parseError(error);
            const errorMessage = `**Error:** ${formattedError.message} (Code: ${formattedError.code || 'N/A'})`;
             setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === 'model' && lastMessage.parts[0].text === '') {
                     lastMessage.parts[0].text = errorMessage;
                } else {
                    newMessages.push({ role: 'model', parts: [{ text: errorMessage }] });
                }
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const summarizeHistory = useCallback(async () => {
        if (!chat || messages.length < HISTORY_SUMMARY_THRESHOLD || isLoading) return;

        setIsSummarizing(true);
        try {
            const historyToSummarize = await chat.getHistory();
            if (historyToSummarize.length === 0) {
                setIsSummarizing(false); return;
            }
            
            const summary = await GeminiService.summarizeConversation(historyToSummarize);
            const recentMessagesForContext = messages.slice(messages.length - MESSAGES_TO_KEEP_AFTER_SUMMARY);

            const newChatHistory = [
                { role: 'user' as const, parts: [{ text: `This is a summary of our conversation so far:\n\n${summary}\n\nPlease continue the conversation from here.` }] },
                { role: 'model' as const, parts: [{ text: "Understood. I have reviewed the summary and I'm ready to continue." }] },
                ...recentMessagesForContext.map(m => ({ role: m.role, parts: m.parts.map(p => ({ text: p.text })) })),
            ];
            
            const systemInstruction = constructSystemPrompt(activePersona, accessibleFiles);
            const newChat = GeminiService.createChatWithHistory(newChatHistory, systemInstruction);
            setChat(newChat);

            const summaryNotification: ChatMessage = { role: 'model', parts: [{ text: `*For brevity, I've summarized our conversation for my own context. Your full history is still visible to you.*` }] };
            setMessages(prev => [...prev, summaryNotification]);
            
        } catch (error) {
            console.error("Failed to summarize conversation:", error);
            const errorNotification: ChatMessage = { role: 'model', parts: [{ text: `*_Failed to summarize our conversation for my context._` }] };
            setMessages(prev => [...prev, errorNotification]);
        } finally {
            setIsSummarizing(false);
        }
    }, [chat, messages, isLoading, constructSystemPrompt, activePersona, accessibleFiles]);
    
    const handleClearHistory = async () => {
        if (window.confirm("Are you sure you want to clear the entire chat history? This cannot be undone.")) {
            try {
                await dbService.clearChatHistory();
                setMessages([]);
                 const systemInstruction = constructSystemPrompt(activePersona, accessibleFiles);
                setChat(GeminiService.createChat(systemInstruction));
            } catch (error) {
                console.error("Failed to clear chat history:", error);
            }
        }
    };

    const handleSaveMessage = async (content: string) => {
        if (!content) return;
        let fileName = prompt("Enter a name for the saved file:", `chat-response-${new Date().toISOString()}.txt`);
        if (!fileName) return;

        if (documents.some(doc => doc.name === fileName)) {
            alert("A file with this name already exists in the library. Please choose a different name.");
            return;
        }

        const textEncoder = new TextEncoder();
        const contentBytes = textEncoder.encode(content);
        const base64Data = encode(contentBytes);
        
        const newFile: StoredFile = {
            name: fileName,
            type: 'text/plain',
            size: contentBytes.length,
            lastModified: Date.now(),
            isArchived: false,
            data: base64Data,
        };
        
        try {
            await dbService.addDocuments([newFile]);
            setDocuments(prev => [...prev, newFile]);
            alert(`'${fileName}' saved to File Library.`);
        } catch (error) {
            console.error("Failed to save file:", error);
            alert("Could not save the file to the library.");
        }
    };


    const handleToggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Speech recognition is not supported in this browser.");
                return;
            }
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.onstart = () => setIsListening(true);
            recognitionRef.current.onend = () => setIsListening(false);
            recognitionRef.current.onerror = (event: any) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
            };
            recognitionRef.current.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                setInput(prev => prev + finalTranscript);
            };
            recognitionRef.current.start();
        }
    };

    const handleSaveSession = () => {
        const sessionData: SessionData = {
            messages,
            persona: activePersona,
            accessibleFiles,
        };
        const blob = new window.Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-chat-session-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const sessionData: SessionData = JSON.parse(event.target?.result as string);
                setMessages(sessionData.messages || []);
                setActivePersona(sessionData.persona || createDefaultPersona());
                setAccessibleFiles(sessionData.accessibleFiles || []);
                // Persona will be saved as active on the next interaction
            } catch (error) {
                console.error("Failed to load session:", error);
                alert("Invalid session file.");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    useEffect(() => {
        if (messages.length >= HISTORY_SUMMARY_THRESHOLD && !isSummarizing && !isLoading) {
            const lastMessageText = messages[messages.length-1]?.parts[0]?.text || '';
            if(!lastMessageText.includes("summarized our conversation")) {
                summarizeHistory();
            }
        }
    }, [messages, isSummarizing, isLoading, summarizeHistory]);


    return (
        <FeatureLayout title="Chat Bot" description="Engage in a conversation with your personalized Gemini assistant.">
            <div className="flex flex-col h-full max-w-4xl mx-auto">
                <div className="flex-grow overflow-y-auto pr-4 space-y-6">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && activePersona.avatarUrl && (
                                <img src={activePersona.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
                            )}
                             {msg.role === 'model' && !activePersona.avatarUrl && (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">{activePersona.role ? activePersona.role.charAt(0) : 'G'}</div>
                            )}
                            <div className={`p-4 rounded-xl max-w-lg relative ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                {msg.imageUrl ? (
                                    <img src={msg.imageUrl} alt="Generated by AI" className="rounded-lg" />
                                ) : (
                                    <MarkdownRenderer content={msg.parts[0].text} />
                                )}
                                 {msg.role === 'model' && msg.parts[0].text && !isLoading && (
                                    <button onClick={() => handleSaveMessage(msg.parts[0].text)} className="absolute -top-2 -right-2 bg-slate-800 p-1.5 rounded-full text-slate-400 hover:bg-blue-600 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Save to Library">
                                        <SaveIcon />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && !messages[messages.length - 1]?.imageUrl && (
                        <div className="flex justify-start items-start gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">{activePersona.role ? activePersona.role.charAt(0) : 'G'}</div>
                            <div className="p-4 rounded-xl bg-slate-700">
                                <Spinner text="Gemini is typing..."/>
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                {accessibleFiles.length > 0 && (
                    <div className="mt-2 text-xs text-slate-400">
                        <span className="font-semibold">Context files:</span> {accessibleFiles.join(', ')}
                    </div>
                )}
                <div className="mt-2 flex items-center space-x-2">
                    <Tooltip text="Save Chat Session">
                        <button onClick={handleSaveSession} disabled={isLoading || isSummarizing || messages.length === 0} className="bg-slate-700 hover:bg-blue-600/50 p-3 rounded-full transition-colors disabled:opacity-50"><SaveIcon /></button>
                    </Tooltip>
                    <Tooltip text="Load Chat Session">
                        <label htmlFor="load-chat-session" className={`bg-slate-700 hover:bg-blue-600/50 p-3 rounded-full transition-colors cursor-pointer ${isLoading || isSummarizing ? 'opacity-50' : ''}`}>
                            <input id="load-chat-session" type="file" className="hidden" accept=".json" onChange={handleLoadSession} disabled={isLoading || isSummarizing}/>
                            <UploadIcon /> 
                        </label>
                    </Tooltip>
                    <Tooltip text="Clear chat history. This cannot be undone.">
                        <button onClick={handleClearHistory} disabled={isLoading || isSummarizing || messages.length === 0} className="bg-slate-700 hover:bg-red-600/50 p-3 rounded-full transition-colors disabled:opacity-50"><TrashIcon /></button>
                    </Tooltip>
                    <Tooltip text="Configure the chatbot's persona and personality.">
                        <button onClick={() => setIsPersonaModalOpen(true)} disabled={isLoading || isSummarizing} className="bg-slate-700 hover:bg-blue-600/50 p-3 rounded-full transition-colors disabled:opacity-50"><SettingsIcon /></button>
                    </Tooltip>
                     <Tooltip text="Grant AI access to files from your library for this chat session.">
                        <button onClick={() => setIsFileModalOpen(true)} disabled={isLoading || isSummarizing} className="bg-slate-700 hover:bg-blue-600/50 p-3 rounded-full transition-colors disabled:opacity-50"><PaperclipIcon /></button>
                    </Tooltip>
                    
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={isSummarizing ? "Summarizing..." : "Type your message..."} rows={1} className="flex-grow p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" disabled={isSummarizing} />
                    <Tooltip text="Use Voice Input">
                        <button onClick={handleToggleListening} disabled={isLoading || isSummarizing} className={`p-3 rounded-full transition-colors disabled:opacity-50 ${isListening ? 'bg-red-600 animate-pulse' : 'bg-slate-700 hover:bg-blue-600/50'}`}><MicIcon /></button>
                    </Tooltip>
                    <Tooltip text={isTtsEnabled ? "Disable Character Voice" : "Enable Character Voice"}>
                        <button onClick={() => setIsTtsEnabled(prev => !prev)} className="bg-slate-700 hover:bg-blue-600/50 p-3 rounded-full transition-colors">
                            {isTtsEnabled ? <Volume2Icon /> : <VolumeOffIcon />}
                        </button>
                    </Tooltip>
                    <Tooltip text="Send your message to the chatbot. You can also press Enter (without Shift) to send." position="top">
                        <button onClick={handleSend} disabled={isLoading || !input.trim() || isSummarizing} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white p-3 rounded-full transition-colors"><SendIcon /></button>
                    </Tooltip>
                </div>
            </div>
            <PersonaConfigModal 
                isOpen={isPersonaModalOpen}
                onClose={() => setIsPersonaModalOpen(false)}
                initialPersona={activePersona}
                onSave={handleSavePersona}
            />
            <FileAccessModal
                isOpen={isFileModalOpen}
                onClose={() => setIsFileModalOpen(false)}
                availableFiles={documents.filter(d => !d.isArchived)}
                selectedFiles={accessibleFiles}
                onSelectionChange={setAccessibleFiles}
            />
        </FeatureLayout>
    );
};

export default ChatBot;
