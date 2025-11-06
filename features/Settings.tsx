
import React, { useState, useEffect } from 'react';
import FeatureLayout from './common/FeatureLayout';
import { dbService } from '../services/dbService';
import { cryptoService } from '../services/cryptoService';
import { DownloadIcon, UploadIcon, EditIcon, TrashIcon, ShareIcon } from '../components/Icons';
import { Persona } from '../types';
import PersonaConfigModal from './common/PersonaConfigModal';
import PasswordPromptModal from '../components/PasswordPromptModal';
import { LIVE_VOICES } from '../constants';

// Helper to find and parse character JSON from a PNG's tEXt chunk
const findJsonInPng = (arrayBuffer: ArrayBuffer): string | null => {
    const dataView = new DataView(arrayBuffer);
    // Check for PNG signature
    if (dataView.getUint32(0) !== 0x89504E47 || dataView.getUint32(4) !== 0x0D0A1A0A) {
        console.error("Not a valid PNG file.");
        return null;
    }

    let offset = 8;
    while (offset < dataView.byteLength) {
        const length = dataView.getUint32(offset);
        const type = new TextDecoder().decode(new Uint8Array(arrayBuffer, offset + 4, 4));

        if (type === 'tEXt') {
            const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);
            const textDecoder = new TextDecoder('latin1'); // Use latin1 to handle null bytes correctly
            const text = textDecoder.decode(chunkData);
            
            // TavernAI cards store data in a 'chara' keyword tEXt chunk
            if (text.startsWith('chara\0')) {
                const base64Data = text.substring(6); // 6 is length of "chara" + null terminator
                try {
                    // The data is base64 encoded JSON
                    return atob(base64Data);
                } catch (e) {
                    console.error("Failed to decode base64 data from tEXt chunk", e);
                }
            }
        }

        if (type === 'IEND') {
            break; // End of chunks
        }
        
        // Move to the next chunk: 4 bytes for length, 4 for type, data length, 4 for CRC
        offset += 12 + length; 
    }

    return null;
};


const Settings: React.FC = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('Zephyr');
    const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [passwordModalConfig, setPasswordModalConfig] = useState<any>({});


    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [savedPersonas, savedVoice] = await Promise.all([
                    dbService.getPersonas(),
                    dbService.getVoicePreference()
                ]);
                setPersonas(savedPersonas);
                if (savedVoice) {
                    setSelectedVoice(savedVoice);
                }
            } catch (e: any) {
                setError(`Failed to load settings: ${e.message}`);
            }
        };
        loadSettings();
    }, []);

    const handleExport = () => {
        setPasswordModalConfig({
            title: "Set Backup Password",
            description: "This password will be required to decrypt and import your backup file. Do not lose it.",
            buttonText: "Encrypt & Export",
            onSubmit: async (password: string) => {
                if (!password) {
                    setError("Password cannot be empty.");
                    return;
                }
                setIsExporting(true);
                setError(null);
                setSuccess(null);
                try {
                    const dataToBackup = await dbService.getAllDataForBackup();
                    const encryptedBackup = await cryptoService.encryptBackup(dataToBackup, password);
                    
                    const blob = new Blob([encryptedBackup], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `gemini-ai-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    setSuccess('Backup encrypted and downloaded!');
                } catch (e: any) {
                    console.error("Export failed:", e);
                    setError(`Export failed: ${e.message}`);
                } finally {
                    setIsExporting(false);
                    setIsPasswordModalOpen(false);
                }
            }
        });
        setIsPasswordModalOpen(true);
    };

    const handleImportRequest = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const encryptedContent = e.target?.result as string;

            setPasswordModalConfig({
                title: "Enter Backup Password",
                description: "Enter the password used to encrypt this backup file.",
                buttonText: "Decrypt & Import",
                onSubmit: async (password: string) => {
                    if (!password) {
                        setError("Password cannot be empty.");
                        return;
                    }
                    if (!window.confirm("Importing data will overwrite all current files and chat settings. This cannot be undone. Are you sure you want to continue?")) {
                       setIsPasswordModalOpen(false);
                       return;
                    }

                    setIsImporting(true);
                    setError(null);
                    setSuccess(null);
                    try {
                        const decryptedData = await cryptoService.decryptBackup(encryptedContent, password);
                        await dbService.importAndOverwriteAllData(decryptedData);
                        setSuccess('Import successful! The application will now reload.');
                        setTimeout(() => window.location.reload(), 2000);
                    } catch (err: any) {
                        console.error("Import failed:", err);
                        setError("Import failed. Please check the backup file and password and try again.");
                    } finally {
                        setIsImporting(false);
                        setIsPasswordModalOpen(false);
                    }
                }
            });
            setIsPasswordModalOpen(true);
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    };

    const handleVoiceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVoice = e.target.value;
        setSelectedVoice(newVoice);
        setError(null);
        try {
            await dbService.saveVoicePreference(newVoice);
        } catch (e: any) {
            setError(`Failed to save voice preference: ${e.message}`);
        }
    };

    const handleAddNewPersona = () => {
        setEditingPersona({
            id: crypto.randomUUID(),
            role: 'New Character',
            personalityTraits: '',
            physicalTraits: '',
            lore: '',
            characterDescription: '',
            scenario: '',
            systemPrompt: '',
            avatarUrl: '',
        });
        setIsPersonaModalOpen(true);
    };

    const handleEditPersona = (persona: Persona) => {
        setEditingPersona(persona);
        setIsPersonaModalOpen(true);
    };

    const handleSavePersona = async (personaToSave: Persona) => {
        const isNew = !personas.some(p => p.id === personaToSave.id);
        const updatedPersonas = isNew ? [...personas, personaToSave] : personas.map(p => p.id === personaToSave.id ? personaToSave : p);
        
        if (updatedPersonas.length === 1) {
            updatedPersonas[0].isActive = true;
        }

        setPersonas(updatedPersonas);
        await dbService.savePersonas(updatedPersonas);
        window.dispatchEvent(new CustomEvent('personasUpdated'));
        setIsPersonaModalOpen(false);
        setEditingPersona(null);
    };

    const handleDeletePersona = async (personaId: string) => {
        if (!window.confirm("Are you sure you want to delete this character?")) return;

        const personaToDelete = personas.find(p => p.id === personaId);
        const updatedPersonas = personas.filter(p => p.id !== personaId);

        if (personaToDelete?.isActive && updatedPersonas.length > 0) {
            updatedPersonas[0].isActive = true;
        }

        setPersonas(updatedPersonas);
        await dbService.savePersonas(updatedPersonas);
        window.dispatchEvent(new CustomEvent('personasUpdated'));
    };

    const handleSetActive = async (personaId: string) => {
        const updatedPersonas = personas.map(p => ({
            ...p,
            isActive: p.id === personaId,
        }));
        setPersonas(updatedPersonas);
        await dbService.savePersonas(updatedPersonas);
        window.dispatchEvent(new CustomEvent('personasUpdated'));
    };
    
    const handleExportPersonas = () => {
        const dataString = JSON.stringify(personas, null, 2);
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-personas-backup.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportCharacter = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        setSuccess(null);

        try {
            let newPersona: Partial<Persona> | null = null;
            let fileContent: string | null = null;

            if (file.name.toLowerCase().endsWith('.json')) {
                fileContent = await file.text();
            } else if (file.name.toLowerCase().endsWith('.png')) {
                const buffer = await file.arrayBuffer();
                fileContent = findJsonInPng(buffer);
                if (!fileContent) {
                    throw new Error("Could not find character data in PNG file. The file may not be a valid character card.");
                }
            } else {
                throw new Error("Unsupported file type. Please use .json or .png character cards.");
            }

            if (fileContent) {
                const data = JSON.parse(fileContent);
                // Check for TavernAI format
                if (data.name || data.char_name) {
                    newPersona = {
                        role: data.name || data.char_name || '',
                        characterDescription: data.first_mes || data.char_greeting || '',
                        personalityTraits: data.personality || data.char_persona || '',
                        scenario: data.scenario || '',
                        lore: data.description || '',
                    };
                } else if (Array.isArray(data)) {
                    // It's a bulk export from this app
                    const importedPersonas = data as Persona[];
                    const combined = [...personas];
                    let newCount = 0;
                    importedPersonas.forEach(p => {
                        if (p.id && p.role && !combined.some(existing => existing.id === p.id)) {
                             combined.push({ ...p, isActive: false });
                             newCount++;
                        }
                    });
                     setPersonas(combined);
                     await dbService.savePersonas(combined);
                     window.dispatchEvent(new CustomEvent('personasUpdated'));
                     setSuccess(`${newCount} new characters imported successfully!`);
                     return; // Early exit for bulk import
                }
                else {
                    newPersona = data; // Assume it's our format for a single persona
                }
            }


            if (newPersona) {
                const completePersona: Persona = {
                    id: crypto.randomUUID(),
                    isActive: false,
                    role: newPersona.role || 'Imported Character',
                    personalityTraits: newPersona.personalityTraits || '',
                    physicalTraits: newPersona.physicalTraits || '',
                    lore: newPersona.lore || '',
                    characterDescription: newPersona.characterDescription || '',
                    scenario: newPersona.scenario || '',
                    systemPrompt: newPersona.systemPrompt || '',
                    avatarUrl: newPersona.avatarUrl || '',
                };

                if (!personas.some(p => p.role === completePersona.role)) {
                    await handleSavePersona(completePersona);
                    setSuccess(`Character "${completePersona.role}" imported successfully!`);
                } else {
                    setError(`A character named "${completePersona.role}" already exists.`);
                }
            }
        } catch (err: any) {
            setError(`Import failed: ${err.message}`);
        } finally {
            event.target.value = '';
        }
    };


    const handleSharePersona = async (persona: Persona) => {
        try {
            const signature = await cryptoService.sign(persona);
            const publicKey = await cryptoService.getPublicSigningKey();
            
            const shareablePayload = {
                persona,
                signature, // base64
                publicKey, // JWK
            };
    
            const dataString = JSON.stringify(shareablePayload, null, 2);
            const blob = new Blob([dataString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const safeRoleName = persona.role.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            a.href = url;
            a.download = `persona-${safeRoleName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            console.error("Failed to share persona:", e);
            setError(`Failed to create shareable persona file: ${e.message}`);
        }
    };

    return (
        <FeatureLayout title="Settings" description="Manage your application data, chatbot personas, and voice preferences.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col h-96">
                    <h2 className="text-xl font-bold mb-3 text-white">Character Management</h2>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {personas.length > 0 ? personas.map(p => (
                            <div key={p.id} onClick={() => handleEditPersona(p)} className={`p-3 rounded-lg flex items-center justify-between cursor-pointer group ${p.isActive ? 'bg-blue-900/50 ring-1 ring-blue-500' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                                <div className="flex items-center space-x-3">
                                    {p.avatarUrl ? <img src={p.avatarUrl} alt={p.role} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center font-bold">{p.role.charAt(0)}</div>}
                                    <div>
                                        <p className="font-semibold">{p.role}</p>
                                        <p className="text-xs text-slate-400 truncate max-w-xs">{p.personalityTraits}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    {!p.isActive && <button onClick={() => handleSetActive(p.id)} className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded">Apply</button>}
                                    <button onClick={() => handleSharePersona(p)} className="p-2 hover:bg-slate-600 rounded" title="Share Persona"><ShareIcon/></button>
                                    <button onClick={() => handleDeletePersona(p.id)} className="p-2 hover:bg-red-600 rounded" title="Delete Persona"><TrashIcon/></button>
                                </div>
                            </div>
                        )) : <p className="text-slate-500 text-center mt-8">No characters created yet.</p>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={handleAddNewPersona} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-sm">Create New</button>
                        <button onClick={handleExportPersonas} disabled={personas.length === 0} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-3 rounded-lg text-sm disabled:opacity-50">Export All</button>
                        <input type="file" id="import-character" accept=".json,.png" onChange={handleImportCharacter} className="hidden" />
                        <label htmlFor="import-character" className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-3 rounded-lg text-sm cursor-pointer text-center">Import</label>
                    </div>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col h-96">
                    <h2 className="text-xl font-bold mb-3 text-white">Live Conversation Voice</h2>
                    <p className="text-slate-400 mb-6">Choose the voice Gemini will use during live conversations.</p>
                    <select value={selectedVoice} onChange={handleVoiceChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        {LIVE_VOICES.map(voice => <option key={voice} value={voice}>{voice}</option>)}
                    </select>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col h-96">
                    <h2 className="text-xl font-bold mb-3 text-white">Data Backup & Restore</h2>
                    <p className="text-slate-400 mb-6">
                        Export all your application data into a single, password-protected file.
                        You can import this file later to restore your application state.
                    </p>
                    <div className="flex-grow" />
                    {error && <p className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4">{error}</p>}
                    {success && <p className="bg-green-900/50 text-green-300 p-3 rounded-md mb-4">{success}</p>}

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleExport}
                            disabled={isExporting || isImporting}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <DownloadIcon />
                            {isExporting ? 'Exporting...' : 'Export All Data'}
                        </button>
                        
                        <input
                            type="file"
                            id="import-file"
                            accept=".json"
                            onChange={handleImportRequest}
                            className="hidden"
                            disabled={isImporting || isExporting}
                        />
                        <label
                            htmlFor="import-file"
                            className={`flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${isImporting || isImporting ? 'cursor-not-allowed bg-slate-600' : 'cursor-pointer'}`}
                        >
                            <UploadIcon />
                            {isImporting ? 'Importing...' : 'Import All Data'}
                        </label>
                    </div>
                </div>
            </div>
            {isPersonaModalOpen && editingPersona && (
                 <PersonaConfigModal
                    isOpen={isPersonaModalOpen}
                    onClose={() => setIsPersonaModalOpen(false)}
                    initialPersona={editingPersona}
                    onSave={handleSavePersona}
                 />
            )}
            <PasswordPromptModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                {...passwordModalConfig}
            />
        </FeatureLayout>
    );
};

export default Settings;
