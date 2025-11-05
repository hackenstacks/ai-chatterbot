import React from 'react';
import { XIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpContent = [
    {
      title: '🗣️ Live Conversation',
      content: 'Engage in a real-time voice conversation with Gemini. You can ask it to <strong>generate images</strong>, <strong>browse websites</strong> by URL, <strong>search the web</strong>, analyze uploaded files, or control media playback. Just speak your requests clearly!'
    },
    {
      title: '💬 Chat Bot',
      content: 'Have a classic text-based chat with your own personalized AI. Click the <strong>settings icon ⚙️</strong> in the chat input area to configure the AI\'s persona, including its role, personality, and even an avatar. You can even import character cards from other popular formats!'
    },
    {
      title: '🧠 Complex Reasoning',
      content: 'Tackle difficult problems that require advanced reasoning. This mode uses <strong>Gemini 2.5 Pro with "Thinking Mode"</strong> enabled, giving it more time and resources to think through complex prompts before answering.'
    },
    {
      title: '🌐 Grounded Search',
      content: 'Get up-to-date answers from the web. This feature grounds Gemini\'s responses in real-time information from <strong>Google Search</strong>. You can also enable <strong>Google Maps</strong> to get location-based results. All sources are cited for your review.'
    },
    {
      title: '🖼️ Image Analysis',
      content: 'Upload an image and ask questions about it. Gemini can describe what\'s in the image, identify objects, read text, and more.'
    },
    {
      title: '🎨 Image Generation',
      content: 'Create unique images from text prompts using the powerful <strong>Imagen 4.0 model</strong>. You can add <strong>negative prompts</strong> (what to avoid) and select from various preset styles to guide the generation process for better results.'
    },
    {
      title: '📹 Video Analysis',
      content: 'Upload a short video file. Gemini can summarize the video, describe scenes, and answer questions about its content. <strong>Note:</strong> For this demo, please use videos under 10MB due to browser limitations.'
    },
    {
      title: '🎤 Audio Transcription',
      content: 'Upload an audio file and Gemini will transcribe the spoken words into text. Great for meeting notes or voice memos.'
    },
    {
      title: '📂 File Library',
      content: 'This is your personal, encrypted file cabinet. Upload documents, images, audio, or video files here, and they become persistently available for the AI to access and analyze in other features. You can also <strong>archive files</strong> to hide them from the active view.'
    },
    {
        title: '⚙️ Settings & Personas',
        content: 'Manage your application data and AI characters. You can <strong>export a full, encrypted backup</strong> of your library and chats. You can also create new characters from scratch, or import them from <strong>TavernAI character cards</strong> (.json or .png)!'
    },
    {
        title: '🔐 Security',
        content: 'Your privacy is paramount. All your data—files, chat history, and personas—is <strong>encrypted using the Web Crypto API</strong> with a password you create. This data is stored exclusively in your browser\'s IndexedDB and is never sent to any server. If you forget your password, your data cannot be recovered.'
    }
];


const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 transition-opacity duration-300" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-6 border-b border-slate-800 flex-shrink-0">
          <h2 id="help-modal-title" className="text-2xl font-bold text-white">Application Guide</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close help modal">
            <XIcon />
          </button>
        </header>
        <main className="p-8 overflow-y-auto space-y-8">
          <p className="text-slate-400">Welcome to the AI Studio! This guide provides an overview of each feature available in the application.</p>
          {helpContent.map(item => (
            <div key={item.title}>
              <h3 className="text-xl font-semibold text-brand-primary mb-2" dangerouslySetInnerHTML={{ __html: item.title }}></h3>
              <p className="text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.content }}></p>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default HelpModal;