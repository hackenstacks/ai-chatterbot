
import React from 'react';
import { XIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpContent = [
    {
      title: '🗣️ Live Conversation',
      content: `Engage in a real-time, low-latency voice conversation with Gemini.
        <ul class="list-disc list-inside mt-2 space-y-1">
            <li>Click <strong>'Start Conversation'</strong> to activate your microphone.</li>
            <li>Speak naturally to issue commands or ask questions.</li>
            <li><strong>Tool Use:</strong> Ask the AI to perform complex actions like <em>"Search the web for the weather in London,"</em> <em>"Generate an image of a red panda,"</em> or <em>"Analyze the video I uploaded and tell me what it's about."</em></li>
            <li>Use the <strong>Pause/Resume</strong> button to temporarily stop sending audio without ending the session.</li>
            <li>You can upload a media file (video, audio, image) for the AI to analyze and control during the conversation.</li>
        </ul>`
    },
    {
      title: '💬 Chat Bot',
      content: `Have a classic text-based chat with your own personalized AI.
        <ul class="list-disc list-inside mt-2 space-y-1">
            <li>Use the <strong>Settings icon ⚙️</strong> to configure the AI's persona, including its role, personality, voice, and avatar.</li>
            <li>Use the <strong>Paperclip icon 📎</strong> to grant the AI temporary access to specific files from your library for contextual conversations.</li>
            <li>The AI can use tools in chat. For example, if you ask it to "draw a picture," it may use the image generation tool automatically.</li>
            <li>You can also use a slash command: type <strong>/imagine a red sports car</strong> to directly generate an image.</li>
        </ul>`
    },
    {
      title: '🧠 Complex Reasoning',
      content: 'Tackle difficult problems that require advanced reasoning. This mode uses <strong>Gemini 2.5 Pro with "Thinking Mode"</strong> enabled, giving it more time and resources to think through complex prompts before answering. It\'s ideal for logic puzzles, coding problems, or in-depth analysis of a topic.'
    },
    {
      title: '🌐 Grounded Search',
      content: 'Get up-to-date answers from the web. This feature grounds Gemini\'s responses in real-time information from <strong>Google Search</strong>. For location-based queries like "Find coffee shops near me," enable the <strong>Google Maps</strong> option. All sources are cited for your review.'
    },
    {
      title: '🖼️ Image Analysis',
      content: 'Upload an image and ask questions about it. Gemini can describe what\'s in the image, identify objects, read text, analyze emotions, and more. Try asking specific questions like <em>"What type of architecture is this?"</em> or <em>"Translate the text on this sign."</em>'
    },
    {
      title: '🎨 Image Generation',
      content: `Create unique images from text prompts using the powerful <strong>Imagen 4.0 model</strong>.
        <ul class="list-disc list-inside mt-2 space-y-1">
            <li>Write a detailed description of what you want to see.</li>
            <li>Use the <strong>Style presets</strong> to guide the artistic direction (e.g., Photorealistic, Anime).</li>
            <li>Use the <strong>Negative Prompt</strong> field to specify things you want to avoid, such as "blurry, text, watermark, extra fingers."</li>
            <li>Experiment with different <strong>Aspect Ratios</strong> to get the perfect composition for your image.</li>
        </ul>`
    },
    {
      title: '📹 Video Analysis',
      content: 'Upload a short video file. Gemini can summarize the video, describe scenes, identify objects and actions, and answer questions about its content. <strong>Note:</strong> For this demo, please use videos under 10MB due to browser performance limitations.'
    },
    {
      title: '🎤 Audio Transcription',
      content: 'Upload an audio file (e.g., MP3, WAV) and Gemini will transcribe the spoken words into text. This is great for converting meeting notes, voice memos, or interviews into a written format.'
    },
    {
      title: '📂 File Library',
      content: 'This is your personal, encrypted file cabinet. Upload documents, images, audio, or video files here. Once in the library, they become persistently available for the AI to access and analyze in other features like Chat and Live Conversation. You can <strong>archive files</strong> to hide them from the active view without deleting them.'
    },
    {
        title: '⚙️ Settings & Personas',
        content: `Manage your application data and AI characters.
        <ul class="list-disc list-inside mt-2 space-y-1">
            <li><strong>Character Management:</strong> Create new AI personas from scratch, or import them from <strong>TavernAI character cards</strong> (.json or .png). Edit, delete, and set the active character for the Chat Bot.</li>
            <li><strong>Voice Preference:</strong> Select the default voice for Gemini in the Live Conversation feature.</li>
            <li><strong>Data Backup:</strong> Export a full, encrypted backup of your library, chats, and personas. You can restore from this file on any device running this app.</li>
        </ul>`
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
              <div className="text-slate-300 leading-relaxed prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: item.content }}></div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
};

export default HelpModal;
