import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Chat } from '@google/genai';
import { GeminiService } from '../services/geminiService';
import type { ChatMessage, Persona } from '../types';
import FeatureLayout from './common/FeatureLayout';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { SendIcon, TrashIcon, SettingsIcon } from '../components/Icons';
import Spinner from '../components/Spinner';
import Tooltip from '../components/Tooltip';
import { dbService } from '../services/dbService';
import PersonaConfigModal from './common/PersonaConfigModal';

const HISTORY_SUMMARY_THRESHOLD = 10;
const MESSAGES_TO_KEEP_AFTER_SUMMARY = 4;

const createDefaultPersona = (): Persona => ({
  id: crypto.randomUUID(),
  isActive: true,
  systemPrompt: '',
  role: 'Helpful Assistant',
  personalityTraits: 'Friendly, knowledgeable, concise',
  characterDescription: '',
  avatarUrl: '',
  scenario: '',
});


const ChatBot: React.FC = () => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [activePersona, setActivePersona] = useState<Persona>(createDefaultPersona());
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const constructSystemPrompt = useCallback((p: Persona): string => {
        let prompt = p.systemPrompt || "You are a helpful AI assistant.";
        if (p.role) prompt += `\nYour role is: ${p.role}.`;
        if (p.personalityTraits) prompt += `\nYour personality is: ${p.personalityTraits}.`;
        if (p.characterDescription) prompt += `\nYour background: ${p.characterDescription}.`;
        if (p.scenario) prompt += `\nThe current scenario is: ${p.scenario}.`;
        return prompt.trim();
    }, []);

    const initializeChat = useCallback(async () => {
        try {
            const [history, savedPersonas] = await Promise.all([
                dbService.getChatHistory(),
                dbService.getPersonas()
            ]);
            
            let currentPersona = savedPersonas.find(p => p.isActive);
            if (!currentPersona) {
                currentPersona = savedPersonas.length > 0 ? { ...savedPersonas[0], isActive: true } : createDefaultPersona();
                // FIX: Add type annotation to ensure type compatibility when pushing a new persona.
                const updatedPersonas: Persona[] = savedPersonas.map(p => ({ ...p, isActive: p.id === currentPersona!.id }));
                if (savedPersonas.length === 0) updatedPersonas.push(currentPersona);
                await dbService.savePersonas(updatedPersonas);
            }

            setActivePersona(currentPersona);
            setMessages(history);
            
            const systemInstruction = constructSystemPrompt(currentPersona);
            const chatInstance = GeminiService.createChatWithHistory(
                history.map(m => ({ role: m.role, parts: m.parts })),
                systemInstruction
            );
            setChat(chatInstance);
        } catch (error) {
            console.error("Failed to load chat history or persona:", error);
            const defaultPersona = createDefaultPersona();
            setActivePersona(defaultPersona);
            setChat(GeminiService.createChat(constructSystemPrompt(defaultPersona)));
        }
    }, [constructSystemPrompt]);

    useEffect(() => {
        initializeChat();
    }, [initializeChat]);
    
    useEffect(() => {
        // Do not save an empty initial message list
        if (messages.length > 0) {
            dbService.saveChatHistory(messages).catch(console.error);
        }
    }, [messages]);
    
    const handleSavePersona = async (newPersona: Persona) => {
        const allPersonas = await dbService.getPersonas();
        const updatedPersonas = allPersonas.map(p => p.id === newPersona.id ? newPersona : p);
        await dbService.savePersonas(updatedPersonas);
        setActivePersona(newPersona);

        // Re-initialize chat with new persona settings
        const systemInstruction = constructSystemPrompt(newPersona);
        const chatHistory = messages.map(m => ({ role: m.role, parts: m.parts }));
        const chatInstance = GeminiService.createChatWithHistory(chatHistory, systemInstruction);
        setChat(chatInstance);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !chat || isLoading || isSummarizing) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }] };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const result = await chat.sendMessageStream({ message: input });
            let text = '';
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: '' }] }]);

            for await (const chunk of result) {
                text += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].parts[0].text = text;
                    return newMessages;
                });
            }
        } catch (error) {
            console.error(error);
             setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage?.role === 'model' && lastMessage.parts[0].text === '') {
                     lastMessage.parts[0].text = 'Sorry, something went wrong. Please try again.';
                } else {
                    newMessages.push({ role: 'model', parts: [{ text: 'Sorry, something went wrong. Please try again.' }] });
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
            // We only take the most recent messages for the AI's "short-term" memory after the summary.
            const recentMessagesForContext = messages.slice(messages.length - MESSAGES_TO_KEEP_AFTER_SUMMARY);

            const newChatHistory = [
                { role: 'user' as const, parts: [{ text: `This is a summary of our conversation so far:\n\n${summary}\n\nPlease continue the conversation from here.` }] },
                { role: 'model' as const, parts: [{ text: "Understood. I have reviewed the summary and I'm ready to continue." }] },
                ...recentMessagesForContext.map(m => ({ role: m.role, parts: m.parts })),
            ];
            
            const systemInstruction = constructSystemPrompt(activePersona);
            const newChat = GeminiService.createChatWithHistory(newChatHistory, systemInstruction);
            setChat(newChat);

            // Add a notification for the user, but DO NOT change their visible history.
            const summaryNotification: ChatMessage = { role: 'model', parts: [{ text: `*For brevity, I've summarized our conversation for my own context. Your full history is still visible to you.*` }] };
            setMessages(prev => [...prev, summaryNotification]);
            
        } catch (error) {
            console.error("Failed to summarize conversation:", error);
            const errorNotification: ChatMessage = { role: 'model', parts: [{ text: `*_Failed to summarize our conversation for my context._` }] };
            setMessages(prev => [...prev, errorNotification]);
        } finally {
            setIsSummarizing(false);
        }
    }, [chat, messages, isLoading, constructSystemPrompt, activePersona]);
    
    const handleClearHistory = async () => {
        if (window.confirm("Are you sure you want to clear the entire chat history? This cannot be undone.")) {
            try {
                await dbService.clearChatHistory();
                setMessages([]);
                setChat(GeminiService.createChat(constructSystemPrompt(activePersona)));
            } catch (error) {
                console.error("Failed to clear chat history:", error);
            }
        }
    };

    useEffect(() => {
        if (messages.length >= HISTORY_SUMMARY_THRESHOLD && !isSummarizing && !isLoading) {
            // Check if the last message isn't already a summary notification to avoid loops
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
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && activePersona.avatarUrl && (
                                <img src={activePersona.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full" />
                            )}
                             {msg.role === 'model' && !activePersona.avatarUrl && (
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">{activePersona.role ? activePersona.role.charAt(0) : 'G'}</div>
                            )}
                            <div className={`p-4 rounded-xl max-w-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                <MarkdownRenderer content={msg.parts[0].text} />
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start items-start gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold">{activePersona.role ? activePersona.role.charAt(0) : 'G'}</div>
                            <div className="p-4 rounded-xl bg-slate-700">
                                <Spinner text="Gemini is typing..."/>
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="mt-6 flex items-center space-x-2">
                    <Tooltip text="Clear chat history. This cannot be undone.">
                        <button onClick={handleClearHistory} disabled={isLoading || isSummarizing || messages.length === 0} className="bg-slate-700 hover:bg-red-600/50 p-3 rounded-full transition-colors disabled:opacity-50"><TrashIcon /></button>
                    </Tooltip>
                    <Tooltip text="Configure the chatbot's persona and personality.">
                        <button onClick={() => setIsPersonaModalOpen(true)} disabled={isLoading || isSummarizing} className="bg-slate-700 hover:bg-blue-600/50 p-3 rounded-full transition-colors disabled:opacity-50"><SettingsIcon /></button>
                    </Tooltip>
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={isSummarizing ? "Summarizing..." : "Type your message..."} rows={1} className="flex-grow p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" disabled={isSummarizing} />
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
        </FeatureLayout>
    );
};

export default ChatBot;