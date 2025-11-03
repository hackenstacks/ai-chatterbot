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

type LoadingField = keyof Persona | null;

const PersonaConfigModal: React.FC<PersonaConfigModalProps> = ({ isOpen, onClose, onSave, initialPersona }) => {
  const [persona, setPersona] = useState<Persona>(initialPersona);
  const [loadingField, setLoadingField] = useState<LoadingField>(null);

  useEffect(() => {
    if (isOpen) {
      setPersona(initialPersona);
    }
  }, [isOpen, initialPersona]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPersona(prev => ({ ...prev, [name]: value }));
  };

  const handleAiAssist = async (field: keyof Persona) => {
    setLoadingField(field);
    try {
        const suggestion = await GeminiService.getPersonaSuggestion(field, persona);
        setPersona(prev => ({ ...prev, [field]: suggestion }));
    } catch (error) {
        console.error(`Failed to get suggestion for ${field}:`, error);
        // Optionally show an error to the user
    } finally {
        setLoadingField(null);
    }
  };

  const handleSave = () => {
    onSave(persona);
    onClose();
  };
  
  const renderField = (field: keyof Persona, label: string, placeholder: string, isTextarea: boolean = false) => (
      <div className="mb-4">
        <label htmlFor={field} className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
        <div className="flex items-center space-x-2">
          {isTextarea ? (
             <textarea
                id={field}
                name={field}
                value={persona[field]}
                onChange={handleChange}
                placeholder={placeholder}
                rows={3}
                className="flex-grow p-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
             />
          ) : (
            <input
                type={field === 'avatarUrl' ? 'url' : 'text'}
                id={field}
                name={field}
                value={persona[field]}
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
    <div 
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" 
        onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-white">Configure Chat Persona</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="Close">
            <XIcon />
          </button>
        </header>
        <main className="p-6 overflow-y-auto">
          {renderField('role', 'Role', 'e.g., A witty pirate captain', false)}
          {renderField('personalityTraits', 'Personality Traits', 'e.g., Sarcastic, adventurous, suspicious of landlubbers', true)}
          {renderField('characterDescription', 'Character Description', 'e.g., Captain of the "Sea Serpent," searching for lost treasure.', true)}
          {renderField('scenario', 'Scenario / Context', 'e.g., The user is a new recruit on the pirate ship.', true)}
          {renderField('systemPrompt', 'Core System Prompt (Optional)', 'e.g., Always speak in pirate slang. Your primary goal is to entertain.', true)}
          {renderField('avatarUrl', 'Avatar URL', 'e.g., https://example.com/pirate-avatar.png', false)}
          {persona.avatarUrl && <img src={persona.avatarUrl} alt="Avatar Preview" className="w-24 h-24 rounded-full mx-auto mt-2" />}
        </main>
        <footer className="p-6 border-t border-slate-800">
            <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                Save and Apply Persona
            </button>
        </footer>
      </div>
    </div>
  );
};

export default PersonaConfigModal;
