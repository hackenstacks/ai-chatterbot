
import React, { useState, useEffect } from 'react';
import FeatureLayout from './common/FeatureLayout.tsx';
import { dbService } from '../services/dbService.ts';
import { cryptoService } from '../services/cryptoService.ts';
import { DownloadIcon, UploadIcon, EditIcon, TrashIcon, ShareIcon } from '../components/Icons.tsx';
import { Persona } from '../types.ts';
import PersonaConfigModal from './common/PersonaConfigModal.tsx';
import PasswordPromptModal from '../components/PasswordPromptModal.tsx';
import { LIVE_VOICES } from '../constants.ts';

const findJsonInPng = (arrayBuffer: ArrayBuffer): string | null => {
    const dataView = new DataView(arrayBuffer);
    if (dataView.getUint32(0) !== 0x89504E47) return null;

    let offset = 8;
    const decoderLatin1 = new TextDecoder('latin1');
    while (offset < dataView.byteLength) {
        const length = dataView.getUint32(offset);
        const type = new TextDecoder().decode(new Uint8Array(arrayBuffer, offset + 4, 4));
        if (type === 'tEXt') {
            const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);
            const text = decoderLatin1.decode(chunkData);
            const splitIndex = text.indexOf('\0');
            if (splitIndex > -1) {
                const keyword = text.substring(0, splitIndex);
                if (keyword === 'chara') return atob(text.substring(splitIndex + 1));
            }
        }
        if (type === 'IEND') break;
        offset += 12 + length; 
    }
    return null;
};

const processLorebook = (characterBook: any): string => {
    if (!characterBook || !characterBook.entries) return '';
    let loreText = '\n\n[World Info / Lorebook]:\n';
    characterBook.entries.forEach((entry: any) => {
        if (entry.enabled === false) return;
        loreText += `\n--- ${entry.name || 'Entry'} ---\nKeywords: ${entry.keys?.join(', ') || ''}\n${entry.content || ''}\n`;
    });
    return loreText;
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
        dbService.getPersonas().then(setPersonas);
        dbService.getVoicePreference().then(v => v && setSelectedVoice(v));
    }, []);

    const handleExport = () => {
        setPasswordModalConfig({
            title: "Set Backup Password",
            description: "Required to decrypt your backup file.",
            buttonText: "Export",
            onSubmit: async (pw: string) => {
                const data = await dbService.getAllDataForBackup();
                const encrypted = await cryptoService.encryptBackup(data, pw);
                const blob = new Blob([encrypted], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `gemini-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                setIsPasswordModalOpen(false);
            }
        });
        setIsPasswordModalOpen(true);
    };

    const handleImportRequest = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setPasswordModalConfig({
                title: "Enter Password",
                description: "Password for the backup file.",
                buttonText: "Import",
                onSubmit: async (pw: string) => {
                    try {
                        const data = await cryptoService.decryptBackup(content, pw);
                        await dbService.importAndOverwriteAllData(data);
                        window.location.reload();
                    } catch (err) { setError("Import failed: Incorrect password."); }
                    setIsPasswordModalOpen(false);
                }
            });
            setIsPasswordModalOpen(true);
        };
        reader.readAsText(file);
    };

    const handleSavePersona = async (p: Persona) => {
        const updated = personas.some(existing => existing.id === p.id) 
            ? personas.map(e => e.id === p.id ? p : e) 
            : [...personas, p];
        if (updated.length === 1) updated[0].isActive = true;
        setPersonas(updated);
        await dbService.savePersonas(updated);
        window.dispatchEvent(new CustomEvent('personasUpdated'));
    };

    const handleDeletePersona = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm("Delete this character?")) return;
        const updated = personas.filter(p => p.id !== id);
        if (personas.find(p => p.id === id)?.isActive && updated.length > 0) updated[0].isActive = true;
        setPersonas(updated);
        await dbService.savePersonas(updated);
        window.dispatchEvent(new CustomEvent('personasUpdated'));
    };

    const handleSetActive = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const updated = personas.map(p => ({ ...p, isActive: p.id === id }));
        setPersonas(updated);
        await dbService.savePersonas(updated);
        window.dispatchEvent(new CustomEvent('personasUpdated'));
    };

    const handleImportCharacter = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null); setSuccess(null);
        try {
            let fileContent = '';
            if (file.name.endsWith('.json')) fileContent = await file.text();
            else if (file.name.endsWith('.png')) {
                const json = findJsonInPng(await file.arrayBuffer());
                if (!json) throw new Error("No character data in PNG.");
                fileContent = json;
            }
            const data = JSON.parse(fileContent);
            if (!data) throw new Error("Empty character file.");

            let imported: Partial<Persona> = {};
            if (data.spec === 'chara_card_v2' && data.data) {
                const d = data.data;
                imported = {
                    role: d.name,
                    characterDescription: d.first_mes,
                    personalityTraits: d.personality,
                    scenario: d.scenario,
                    lore: (d.description || '') + processLorebook(d.character_book),
                    systemPrompt: d.mes_example
                };
            } else if (data.name || data.char_name) {
                imported = {
                    role: data.name || data.char_name,
                    characterDescription: data.first_mes || data.char_greeting,
                    personalityTraits: data.personality || data.char_persona,
                    scenario: data.scenario || data.world_scenario,
                    lore: data.description || '',
                    systemPrompt: data.mes_example || data.example_dialogue
                };
            } else {
                throw new Error("Unknown character card format.");
            }

            if (!imported.role) throw new Error("Character card missing name.");

            const complete: Persona = {
                id: crypto.randomUUID(),
                isActive: false,
                role: imported.role,
                personalityTraits: imported.personalityTraits || '',
                physicalTraits: imported.physicalTraits || '',
                lore: imported.lore || '',
                characterDescription: imported.characterDescription || '',
                scenario: imported.scenario || '',
                systemPrompt: imported.systemPrompt || '',
                avatarUrl: '',
                voice: ''
            };
            await handleSavePersona(complete);
            setSuccess(`Imported "${complete.role}"`);
        } catch (err: any) { setError(err.message); }
        event.target.value = '';
    };

    return (
        <FeatureLayout title="Settings" description="Manage characters and data.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col h-[500px]">
                    <h2 className="text-xl font-bold mb-3 text-white">Characters</h2>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-2">
                        {personas.map(p => (
                            <div key={p.id} onClick={() => { setEditingPersona(p); setIsPersonaModalOpen(true); }} className={`p-3 rounded-lg flex items-center justify-between cursor-pointer group ${p.isActive ? 'bg-blue-900/50 ring-1 ring-blue-500' : 'bg-slate-700/50 hover:bg-slate-700'}`}>
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className="w-10 h-10 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center font-bold">
                                        {p.avatarUrl ? <img src={p.avatarUrl} className="w-full h-full rounded-full object-cover" /> : p.role.charAt(0)}
                                    </div>
                                    <div className="truncate">
                                        <p className="font-semibold truncate">{p.role}</p>
                                        <p className="text-xs text-slate-400 truncate">{p.personalityTraits || 'No traits set'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    {!p.isActive && <button onClick={(e) => handleSetActive(e, p.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Set</button>}
                                    <button onClick={(e) => handleDeletePersona(e, p.id)} className="p-2 hover:bg-red-600 rounded"><TrashIcon/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => { setEditingPersona({ id: crypto.randomUUID(), role: 'New Hero', personalityTraits: '', physicalTraits: '', lore: '', characterDescription: '', scenario: '', systemPrompt: '', avatarUrl: '', voice: '' }); setIsPersonaModalOpen(true); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm">Create</button>
                        <input type="file" id="import-char" className="hidden" accept=".json,.png" onChange={handleImportCharacter} />
                        <label htmlFor="import-char" className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm text-center cursor-pointer">Import Card</label>
                    </div>
                    {success && <p className="text-green-400 text-xs mt-2">{success}</p>}
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>
                <div className="bg-slate-800/50 rounded-lg p-6 flex flex-col h-[500px]">
                    <h2 className="text-xl font-bold mb-3 text-white">Preferences & Backup</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Live Voice</label>
                            <select value={selectedVoice} onChange={(e) => { setSelectedVoice(e.target.value); dbService.saveVoicePreference(e.target.value); }} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3">
                                {LIVE_VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="pt-4 border-t border-slate-700 flex gap-4">
                            <button onClick={handleExport} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><DownloadIcon/> Export All</button>
                            <input type="file" id="import-all" className="hidden" accept=".json" onChange={handleImportRequest} />
                            <label htmlFor="import-all" className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer"><UploadIcon/> Import All</label>
                        </div>
                    </div>
                </div>
            </div>
            {isPersonaModalOpen && editingPersona && (
                <PersonaConfigModal isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} initialPersona={editingPersona} onSave={handleSavePersona} />
            )}
            <PasswordPromptModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} {...passwordModalConfig} />
        </FeatureLayout>
    );
};
export default Settings;
