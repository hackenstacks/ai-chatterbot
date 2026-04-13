import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/dbService.ts';
import { ApiConfig } from '../../types.ts';

interface ApiSelectorProps {
    onSelect?: (config: ApiConfig | null) => void;
}

const ApiSelector: React.FC<ApiSelectorProps> = ({ onSelect }) => {
    const [configs, setConfigs] = useState<ApiConfig[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        const loadConfigs = async () => {
            const loadedConfigs = await dbService.getApiConfigs();
            setConfigs(loadedConfigs);
            const active = await dbService.getActiveApiConfigId();
            setActiveId(active);
            if (onSelect) {
                const activeConfig = loadedConfigs.find(c => c.id === active) || null;
                onSelect(activeConfig);
            }
        };
        loadConfigs();
        
        // Listen for updates from Settings
        const handleUpdate = () => loadConfigs();
        window.addEventListener('apiConfigsUpdated', handleUpdate);
        return () => window.removeEventListener('apiConfigsUpdated', handleUpdate);
    }, [onSelect]);

    const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        const newActiveId = id === 'default' ? null : id;
        setActiveId(newActiveId);
        if (newActiveId) {
            await dbService.saveActiveApiConfigId(newActiveId);
        } else {
            await dbService.saveActiveApiConfigId('');
        }
        
        if (onSelect) {
            const activeConfig = configs.find(c => c.id === newActiveId) || null;
            onSelect(activeConfig);
        }
    };

    return (
        <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400">API:</label>
            <select 
                value={activeId || 'default'} 
                onChange={handleChange}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
            >
                <option value="default">Default System API</option>
                {configs.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>
                ))}
            </select>
        </div>
    );
};

export default ApiSelector;
