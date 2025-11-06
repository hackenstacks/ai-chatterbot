
import React, { useState, useEffect } from 'react';
import type { Feature, FeatureId } from './types';
import {
  MessageSquareIcon,
  ImageIcon,
  VideoIcon,
  MicIcon,
  GlobeIcon,
  BrainCircuitIcon,
  SparklesIcon,
  RadioTowerIcon,
  FilesIcon,
  HelpCircleIcon,
  SettingsIcon
} from './components/Icons';
import LiveConversation from './features/LiveConversation';
import ChatBot from './features/ChatBot';
import ImageAnalysis from './features/ImageAnalysis';
import ImageGeneration from './features/ImageGeneration';
import VideoAnalysis from './features/VideoAnalysis';
import AudioTranscription from './features/AudioTranscription';
import FileLibrary from './features/FileLibrary';
import GroundingSearch from './features/GroundingSearch';
import ComplexReasoning from './features/ComplexReasoning';
import Settings from './features/Settings';
import Tooltip from './components/Tooltip';
import HelpModal from './components/HelpModal';
import { dbService, StoredFile } from './services/dbService';
import Auth from './components/Auth';
import Spinner from './components/Spinner';


const features: Feature[] = [
  { id: 'live', name: 'Live Conversation', description: 'Speak with Gemini in real-time.', icon: <RadioTowerIcon />, component: LiveConversation },
  { id: 'chat', name: 'Chat', description: 'Have a text-based conversation.', icon: <MessageSquareIcon />, component: ChatBot },
  { id: 'reasoning', name: 'Complex Reasoning', description: 'Tackle complex problems with Thinking Mode.', icon: <BrainCircuitIcon />, component: ComplexReasoning },
  { id: 'grounding', name: 'Grounded Search', description: 'Get up-to-date answers from the web & maps.', icon: <GlobeIcon />, component: GroundingSearch },
  { id: 'image-analysis', name: 'Image Analysis', description: 'Understand the content of your images.', icon: <ImageIcon />, component: ImageAnalysis },
  { id: 'image-gen', name: 'Image Generation', description: 'Create stunning visuals from text.', icon: <SparklesIcon />, component: ImageGeneration },
  { id: 'video-analysis', name: 'Video Analysis', description: 'Extract insights from video files.', icon: <VideoIcon />, component: VideoAnalysis },
  { id: 'audio-transcription', name: 'Audio Transcription', description: 'Transcribe spoken words from audio files.', icon: <MicIcon />, component: AudioTranscription },
  { id: 'file-library', name: 'File Library', description: 'Manage and archive your encrypted local files.', icon: <FilesIcon />, component: FileLibrary },
  { id: 'settings', name: 'Settings', description: 'Manage application settings and data.', icon: <SettingsIcon />, component: Settings },
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeFeature, setActiveFeature] = useState<FeatureId>('live');
  const [documents, setDocuments] = useState<StoredFile[]>([]);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  useEffect(() => {
    // This effect simply moves past the initial "checking" state.
    // The Auth component itself is responsible for determining if it should
    // show a login or a setup form.
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const loadDocuments = async () => {
      try {
        const storedDocs = await dbService.getDocuments();
        setDocuments(storedDocs);
      } catch (error) {
        console.error("Failed to load documents from DB:", error);
      }
    };
    loadDocuments();
  }, [isAuthenticated]);


  if (isCheckingAuth) {
    return (
      <div className="flex flex-col h-screen bg-slate-900 text-slate-100 items-center justify-center">
        <Spinner text="Initializing Secure Session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
      <nav className="w-16 md:w-64 bg-slate-950 p-2 md:p-4 flex flex-col space-y-2 border-r border-slate-800 transition-all duration-300 overflow-y-auto">
        <div className="flex items-center space-x-2 mb-6 md:px-2 flex-shrink-0">
            <svg className="w-8 h-8 text-brand-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.85 3.12L12.85 3.12C12.44 2.45 11.56 2.45 11.15 3.12L3.19 16.88C2.78 17.55 3.22 18.4 3.96 18.4H20.04C20.78 18.4 21.22 17.55 20.81 16.88L12.85 3.12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path><path d="M7 18.4L12 10.4L17 18.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          <h1 className="text-xl font-bold hidden md:block">AI Studio</h1>
        </div>
        <div className="flex-grow">
        {features.map(feature => (
          <Tooltip key={feature.id} text={feature.description} position="top">
            <button
              onClick={() => setActiveFeature(feature.id)}
              className={`flex items-center space-x-3 p-2 rounded-lg transition-colors w-full text-left mb-1 ${
                activeFeature === feature.id
                  ? 'bg-blue-600/30 text-white'
                  : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <div className="w-6 h-6 flex-shrink-0">{feature.icon}</div>
              <span className="hidden md:inline">{feature.name}</span>
            </button>
          </Tooltip>
        ))}
        </div>
        <div className="flex-shrink-0">
            <Tooltip text="Open a detailed guide on how to use all application features." position="top">
                 <button
                    onClick={() => setIsHelpModalOpen(true)}
                    className="flex items-center space-x-3 p-2 rounded-lg transition-colors w-full text-left hover:bg-slate-800 text-slate-400"
                >
                    <div className="w-6 h-6 flex-shrink-0"><HelpCircleIcon /></div>
                    <span className="hidden md:inline">Help</span>
                </button>
            </Tooltip>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {features.map(feature => {
            const props: any = { key: feature.id };
            const isActive = activeFeature === feature.id;
            
            // Pass shared document state to all features that might need to read or write to the library.
            if (['live', 'file-library', 'image-analysis', 'image-gen', 'video-analysis', 'audio-transcription', 'grounding', 'reasoning', 'chat', 'settings'].includes(feature.id)) {
                props.documents = documents;
                props.setDocuments = setDocuments;
            }
            
            return (
              <div key={feature.id} className="w-full h-full" style={{ display: isActive ? 'block' : 'none' }}>
                {React.createElement(feature.component, props)}
              </div>
            );
        })}
      </main>

      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
    </div>
  );
};

export default App;
