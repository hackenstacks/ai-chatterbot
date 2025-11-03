import React from 'react';
import { XIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpContent = [
    {
      title: 'Live Conversation',
      content: 'Engage in a real-time voice conversation with Gemini. You can now ask it to generate images, browse websites by URL, search the web, analyze uploaded files, or control media playback. Announce your requests clearly.'
    },
    {
      title: 'Chat',
      content: 'Have a classic text-based chat with your own personalized AI. Click the settings icon in the chat input area to configure the AI\'s persona, including its role, personality, and even an avatar. Your custom persona and chat history are saved securely in your browser.'
    },
    {
      title: 'Complex Reasoning',
      content: 'Tackle difficult problems that require advanced reasoning. This mode uses Gemini Pro with "Thinking Mode" enabled, giving it more time and resources to think through complex prompts before answering.'
    },
    {
      title: 'Grounded Search',
      content: 'Get up-to-date answers from the web. This feature grounds Gemini\'s responses in real-time information from Google Search. You can also enable Google Maps to get location-based results. All sources are cited.'
    },
    {
      title: 'Image Analysis',
      content: 'Upload an image and ask questions about it. Gemini can describe what\'s in the image, identify objects, read text, and more.'
    },
    {
      title: 'Image Generation',
      content: 'Create unique images from text prompts using the Imagen model. You can now add negative prompts (what to avoid) and select from various preset styles to guide the generation process for better results.'
    },
    {
      title: 'Video Analysis',
      content: 'Upload a short video file. Gemini can summarize the video, describe scenes, and answer questions about its content. Note: For this demo, please use videos under 10MB.'
    },
    {
      title: 'Audio Transcription',
      content: 'Upload an audio file and Gemini will transcribe the spoken words into text.'
    },
    {
      title: 'File Library',
      content: 'This is your personal, encrypted file cabinet. Upload documents, images, audio, or video files here, and they become persistently available for the AI to access and analyze in other features, like the Live Conversation. You can also archive files to hide them from the active view.'
    },
    {
        title: 'Settings',
        content: 'Manage your application data. You can export a full, encrypted backup of your file library and chat history. This creates a downloadable file that you can use to restore your data on any browser or machine using the import function.'
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
              <h3 className="text-xl font-semibold text-brand-primary mb-2">{item.title}</h3>
              <p className="text-slate-300 leading-relaxed">{item.content}</p>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default HelpModal;