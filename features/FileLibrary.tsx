
import React, { useState } from 'react';
import FeatureLayout from './common/FeatureLayout.tsx';
import { formatBytes, fileToBase64, encode } from '../utils/helpers.ts';
import { FileTextIcon, ArchiveIcon, TrashIcon } from '../components/Icons.tsx';
import { dbService, StoredFile } from '../services/dbService.ts';

interface FileLibraryProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const FileLibrary: React.FC<FileLibraryProps> = ({ documents, setDocuments }) => {
    const [view, setView] = useState<'active' | 'archived'>('active');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        // FIX: Explicitly cast Array.from(files) to File[] to resolve type 'unknown' errors when accessing file properties.
        const newFiles = Array.from(files) as File[];
        try {
            const filesToStore: StoredFile[] = await Promise.all(newFiles.map(async (file) => {
                let base64Data = await fileToBase64(file);
                let fileType = file.type;
                let fileName = file.name;

                // Lorebook Detection & Conversion
                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        const text = await file.text();
                        const json = JSON.parse(text);
                        if (json.entries && Array.isArray(json.entries)) {
                            let loreText = `[WORLD INFO / LOREBOOK: ${fileName}]\n`;
                            json.entries.forEach((entry: any) => {
                                if (entry.enabled === false) return;
                                loreText += `\n--- ${entry.name || 'Entry'} ---\nKeys: ${entry.keys?.join(', ') || 'Global'}\n${entry.content || ''}\n`;
                            });
                            const contentBytes = new TextEncoder().encode(loreText);
                            base64Data = encode(contentBytes);
                            fileType = 'text/plain';
                            fileName = fileName.replace('.json', '.txt');
                            if (!fileName.includes('(Lore)')) fileName = fileName.replace('.txt', ' (Lore).txt');
                        }
                    } catch (e) { console.warn("JSON parse failed during lorebook check."); }
                }

                return {
                    name: fileName,
                    type: fileType,
                    size: file.size,
                    lastModified: file.lastModified,
                    isArchived: false,
                    data: base64Data,
                };
            }));
            await dbService.addDocuments(filesToStore);
            setDocuments(prev => [...prev, ...filesToStore]);
        } catch (error) { alert("Failed to save files."); }
    };
    
    const handleRemoveDocument = async (name: string) => {
        if (!window.confirm(`Delete "${name}"?`)) return;
        await dbService.removeDocument(name);
        setDocuments(prev => prev.filter(f => f.name !== name));
    };

    const handleArchiveToggle = async (file: StoredFile) => {
        const updated = { ...file, isArchived: !file.isArchived };
        await dbService.updateDocument(updated);
        setDocuments(prev => prev.map(f => f.name === file.name ? updated : f));
    };
    
    const displayed = documents.filter(doc => view === 'active' ? !doc.isArchived : doc.isArchived);

    return (
        <FeatureLayout title="File Library" description="Upload lorebooks, images, or docs for AI reference.">
            <div className="max-w-4xl mx-auto">
                <div className="w-full p-8 border-2 border-dashed border-slate-600 rounded-lg text-center mb-8 bg-slate-800/50 hover:border-blue-500 transition-colors">
                    <input type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,.mp4,.mp3,.wav,.json" onChange={handleFileChange} className="hidden" id="lib-upload" multiple />
                    <label htmlFor="lib-upload" className="cursor-pointer">
                        <FileTextIcon />
                        <p className="mt-2 font-semibold">Click to upload Lorebooks (.json) or Media</p>
                    </label>
                </div>
                <div className="flex border-b border-slate-700 mb-4">
                    <button onClick={() => setView('active')} className={`py-2 px-4 font-semibold ${view === 'active' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}>Active</button>
                    <button onClick={() => setView('archived')} className={`py-2 px-4 font-semibold ${view === 'archived' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}>Archived</button>
                </div>
                <ul className="space-y-3">
                    {displayed.map(doc => (
                        <li key={doc.name} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                            <div className="flex items-center space-x-4 overflow-hidden">
                                <FileTextIcon />
                                <div className="truncate">
                                    <p className="font-semibold text-slate-200 truncate">{doc.name}</p>
                                    <p className="text-xs text-slate-400">{formatBytes(doc.size)}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <button onClick={() => handleArchiveToggle(doc)} className="text-slate-400 hover:text-white p-2" title="Archive"><ArchiveIcon /></button>
                                <button onClick={() => handleRemoveDocument(doc.name)} className="text-slate-400 hover:text-red-500 p-2" title="Delete"><TrashIcon /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </FeatureLayout>
    );
};
export default FileLibrary;
