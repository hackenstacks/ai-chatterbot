import React, { useState, useEffect } from 'react';
import { ApiConfig } from '../../types.ts';

interface ApiConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: ApiConfig) => void;
    initialConfig?: ApiConfig | null;
}

const PROVIDERS = [
    'gemini', 'openai', 'claude', 'groq', 'mistral', 'huggingface', 'aihorde', 'pollinations', 'imagerouter', 'custom'
];

const ApiConfigModal: React.FC<ApiConfigModalProps> = ({ isOpen, onClose, onSave, initialConfig }) => {
    const [config, setConfig] = useState<Partial<ApiConfig>>({
        provider: 'gemini',
        name: '',
        endpointUrl: '',
        apiKey: '',
        model: '',
        imageModel: '',
        videoModel: '',
        ttsModel: '',
        embeddingModel: ''
    });

    useEffect(() => {
        if (initialConfig) {
            setConfig(initialConfig);
        } else {
            setConfig({
                provider: 'gemini',
                name: '',
                endpointUrl: '',
                apiKey: '',
                model: '',
                imageModel: '',
                videoModel: '',
                ttsModel: '',
                embeddingModel: ''
            });
        }
    }, [initialConfig, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!config.name || !config.provider) {
            alert("Name and Provider are required.");
            return;
        }
        onSave({
            id: config.id || crypto.randomUUID(),
            name: config.name,
            provider: config.provider,
            endpointUrl: config.endpointUrl || '',
            apiKey: config.apiKey || '',
            model: config.model || '',
            imageModel: config.imageModel || '',
            videoModel: config.videoModel || '',
            ttsModel: config.ttsModel || '',
            embeddingModel: config.embeddingModel || ''
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-6">{initialConfig ? 'Edit API Config' : 'New API Config'}</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                        <input 
                            type="text" 
                            value={config.name} 
                            onChange={e => setConfig({...config, name: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="e.g., My OpenAI Key"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Provider</label>
                        <select 
                            value={config.provider} 
                            onChange={e => setConfig({...config, provider: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                        >
                            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">API Key (Optional for some)</label>
                        <input 
                            type="password" 
                            value={config.apiKey} 
                            onChange={e => setConfig({...config, apiKey: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="sk-..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Endpoint URL (Optional)</label>
                        <input 
                            type="text" 
                            value={config.endpointUrl} 
                            onChange={e => setConfig({...config, endpointUrl: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="https://api.openai.com/v1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Default/Chat Model (Optional)</label>
                        <input 
                            type="text" 
                            value={config.model} 
                            onChange={e => setConfig({...config, model: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="gpt-4o"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Image Model (Optional)</label>
                        <input 
                            type="text" 
                            value={config.imageModel} 
                            onChange={e => setConfig({...config, imageModel: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="dall-e-3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Video Model (Optional)</label>
                        <input 
                            type="text" 
                            value={config.videoModel} 
                            onChange={e => setConfig({...config, videoModel: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="sora"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">TTS Model (Optional)</label>
                        <input 
                            type="text" 
                            value={config.ttsModel} 
                            onChange={e => setConfig({...config, ttsModel: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="tts-1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Embedding Model (Optional)</label>
                        <input 
                            type="text" 
                            value={config.embeddingModel} 
                            onChange={e => setConfig({...config, embeddingModel: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="text-embedding-3-small"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">Save</button>
                </div>
            </div>
        </div>
    );
};

export default ApiConfigModal;
