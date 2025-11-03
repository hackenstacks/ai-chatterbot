import React, { useState, useEffect } from 'react';
import type { Persona } from '../../types';
import { XIcon, Wand2Icon } from '../../components/Icons';
import { GeminiService } from '../../services/geminiService';
import Spinner from '../../components/Spinner';

interface PersonaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (persona: Persona) => void;
  initialPersona: Persona;
}

type LoadingField = keyof Persona | 'avatar' | 'autofill' | null;

const PersonaConfigModal: React.FC<PersonaConfigModalProps> = ({ isOpen, onClose, onSave, initialPersona }) => {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [loadingField, setLoadingField] = useState<LoadingField>(null);
  const [avatarGenPrompt, setAvatarGenPrompt] = useState('A portrait of a character');
  const [autofillText, setAutofillText] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
      const loadVoices = () => {
          const availableVoices = window.speechSynthesis.getVoices();
          setVoices(availableVoices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      return () => {
          window.speechSynthesis.onvoiceschanged = null;
      };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPersona(initialPersona);
      setAvatarGenPrompt(`A portrait of ${initialPersona.role}, ${initialPersona.physicalTraits}, ${initialPersona.personalityTraits}`);
    }
  }, [isOpen, initialPersona]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPersona(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            setPersona(prev => ({...prev, avatarUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  }
  
  const handleAIAvatar = async () => {
    if (!avatarGenPrompt) return;
    setLoadingField('avatar');
    try {
        const images = await GeminiService.generateImage(avatarGenPrompt, "1:1");
        if(images.length > 0) {
            setPersona(prev => ({...prev, avatarUrl: `data:image/jpeg;base64,${images[0]}`}));
        }
    } catch (error) {
        console.error("Failed to generate avatar:", error);
    } finally {
        setLoadingField(null);
    }
  };

  const handleAiAssist = async (field: keyof Persona) => {
    setLoadingField(field);
    try {
        const suggestion = await GeminiService.getPersonaSuggestion(field, persona);
        setPersona(prev => ({ ...prev, [field]: suggestion }));
    } catch (error) {
        console.error(`Failed to get suggestion for ${field}:`, error);
    } finally {
        setLoadingField(null);
    }
  };
  
  const handleAutofill = async () => {
    if (!autofillText) return;
    setLoadingField('autofill');
     try {
        const suggestions = await GeminiService.createPersonaFromText(autofillText);
        setPersona(prev => ({ ...prev, ...suggestions }));
    } catch (error) {
        console.error(`Failed to autofill from description:`, error);
    } finally {
        setLoadingField(null);
    }
  }

  const handleSave = () => {
    onSave(persona);
    onClose();
  };
  
  const renderField = (field: keyof Persona, label: string, placeholder: string, isTextarea: boolean = false, rows: number = 3) => (
      <div>
        <label htmlFor={field} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <div className="flex items-center space-x-2">
          {isTextarea ? (
             <textarea
                id={field}
                name={field}
                value={persona[field] || ''}
                onChange={handleChange}
                placeholder={placeholder}
                rows={rows}
                className="flex-grow p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
             />
          ) : (
            <input
                type={field === 'avatarUrl' ? 'url' : 'text'}
                id={field}
                name={field}
                value={persona[field] || ''}
                onChange={handleChange}
                placeholder={placeholder}
                className="flex-grow p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          )}
          <button 
            onClick={() => handleAiAssist(field)}
            disabled={!!loadingField}
            className="p-2 bg-slate-700 hover:bg-blue-600 rounded-lg disabled:bg-slate-800 disabled:cursor-not-allowed"
            title={`AI Assist for ${label}`}
          >
            {loadingField === field ? <div className="w-6 h-6"><Spinner text=""/></div> : <Wand2Icon />}
          </button>
        </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white">Character Editor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close"><XIcon /></button>
        </header>
        <main className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="space-y-4 md:col-span-2 p-4 border border-slate-700 rounded-lg">
                <label htmlFor="autofill" className="block text-sm font-medium text-slate-300 mb-1">Auto-fill from Description</label>
                <div className="flex items-start space-x-2">
                    <textarea id="autofill" value={autofillText} onChange={e => setAutofillText(e.target.value)} placeholder="Paste a full character description here..." rows={3} className="flex-grow p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    <button onClick={handleAutofill} disabled={!!loadingField} className="p-2 bg-slate-700 hover:bg-blue-600 rounded-lg disabled:bg-slate-800 disabled:cursor-not-allowed" title="Use AI to fill fields from this text">
                        {loadingField === 'autofill' ? <div className="w-6 h-6"><Spinner text=""/></div> : <Wand2Icon />}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                 {renderField('role', 'Name', 'e.g., Captain Eva Rostova', false)}
                 <div>
                    <label htmlFor="voice" className="block text-sm font-medium text-slate-300 mb-1">Character Voice (for TTS)</label>
                    <select
                        id="voice"
                        name="voice"
                        value={persona.voice || ''}
                        onChange={handleChange}
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                        <option value="">Default Voice</option>
                        {voices.map(voice => (
                            <option key={voice.name} value={voice.name}>
                                {voice.name} ({voice.lang})
                            </option>
                        ))}
                    </select>
                 </div>
                 {renderField('personalityTraits', 'Personality', 'e.g., Stoic, pragmatic, fiercely loyal, dry wit', true)}
                 {renderField('physicalTraits', 'Appearance', 'e.g., Tall, athletic build, cybernetic left arm, short-cropped silver hair', true)}
                 {renderField('lore', 'Backstory / Lore', 'e.g., A former corporate soldier who went rogue after her squad was abandoned...', true, 4)}
            </div>

            <div className="space-y-4">
                 <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300">Avatar</p>
                    <div className="flex items-center gap-4">
                        <img src={persona.avatarUrl || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='} alt="Avatar Preview" className="w-24 h-24 rounded-full mx-auto bg-slate-700 object-cover" />
                        <div className="flex-grow space-y-2">
                            <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                            <label htmlFor="avatar-upload" className="w-full text-center block bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-lg text-sm cursor-pointer">Upload Image</label>
                            <div className="flex items-center space-x-2">
                                <input type="text" value={avatarGenPrompt} onChange={(e) => setAvatarGenPrompt(e.target.value)} placeholder="AI generation prompt..." className="flex-grow p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"/>
                                <button onClick={handleAIAvatar} disabled={!!loadingField} className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:bg-slate-800" title="Generate with AI">
                                     {loadingField === 'avatar' ? <div className="w-6 h-6"><Spinner text=""/></div> : <Wand2Icon />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                 {renderField('characterDescription', 'Greeting Message', 'e.g., The comms crackle to life. "State your business. Make it quick."', true)}
                 {renderField('scenario', 'Scenario', 'e.g., The user is a smuggler requesting passage through the captain\'s territory.', true)}
                 {renderField('systemPrompt', 'Core System Prompt (Advanced)', 'A foundational instruction for the AI. Often best left blank unless you have a specific need.', true, 4)}
            </div>
        </main>
        <footer className="p-6 border-t border-slate-800">
            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                Save Character
            </button>
        </footer>
      </div>
    </div>
  );
};

export default PersonaConfigModal;