
import React, { useState } from 'react';
import FeatureLayout from './common/FeatureLayout';
import { formatBytes, fileToBase64, base64ToBlob } from '../utils/helpers';
import { FileTextIcon, ArchiveIcon, TrashIcon } from '../components/Icons';
import { dbService, StoredFile } from '../services/dbService';

interface FileLibraryProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const FileLibrary: React.FC<FileLibraryProps> = ({ documents, setDocuments }) => {
    const [view, setView] = useState<'active' | 'archived'>('active');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newFiles = Array.from(files);
            // FIX: Explicitly type `doc` as StoredFile. The compiler was incorrectly inferring it as `unknown`, causing an error when accessing `doc.name`.
            const existingFileNames = new Set(documents.map((doc: StoredFile) => doc.name));
            // FIX: Explicitly type `nf` as File. The compiler was incorrectly inferring it as `unknown`, causing an error when accessing `nf.name`.
            const uniqueNewFiles = newFiles.filter((nf: File) => !existingFileNames.has(nf.name));

            if (uniqueNewFiles.length > 0) {
                try {
                    // FIX: Explicitly type `file` as File. The compiler was incorrectly inferring it as `unknown`, causing errors on property access and function arguments.
                    const filesToStore: StoredFile[] = await Promise.all(uniqueNewFiles.map(async (file: File) => ({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        lastModified: file.lastModified,
                        isArchived: false,
                        data: await fileToBase64(file),
                    })));

                    await dbService.addDocuments(filesToStore);
                    setDocuments(prev => [...prev, ...filesToStore]);
                } catch (error) {
                    console.error("Failed to add files to DB:", error);
                    alert("Could not save all files. Please try again.");
                }
            }
        }
    };
    
    const handleRemoveDocument = async (fileName: string) => {
        if (!window.confirm(`Are you sure you want to permanently delete "${fileName}"? This cannot be undone.`)) return;
        try {
            await dbService.removeDocument(fileName);
            setDocuments(prev => prev.filter(file => file.name !== fileName));
        } catch (error) {
            console.error(`Failed to remove document ${fileName}:`, error);
            alert("Could not remove document. Please try again.");
        }
    };

    const handleArchiveToggle = async (file: StoredFile) => {
        try {
            const updatedFile = { ...file, isArchived: !file.isArchived };
            await dbService.updateDocument(updatedFile);
            setDocuments(prev => prev.map(f => f.name === file.name ? updatedFile : f));
        } catch (error) {
            console.error(`Failed to archive/unarchive document ${file.name}:`, error);
            alert("Could not update document status. Please try again.");
        }
    };
    
    const displayedDocuments = documents.filter(doc => view === 'active' ? !doc.isArchived : doc.isArchived);

    return (
        <FeatureLayout
            title="File Library"
            description="Manage your files here. They are encrypted and stored locally, and available for the AI to analyze in other features."
        >
            <div className="max-w-4xl mx-auto">
                <div className="w-full p-8 border-2 border-dashed border-slate-600 rounded-lg text-center mb-8 bg-slate-800/50 hover:border-blue-500 transition-colors">
                    <input
                        type="file"
                        accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,.mp4,.mpeg,.mp3,.wav"
                        onChange={handleFileChange}
                        className="hidden"
                        id="file-library-upload"
                        multiple
                    />
                    <label htmlFor="file-library-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center">
                            <FileTextIcon />
                            <p className="mt-2 text-lg font-semibold text-slate-300">Click to upload or drag and drop</p>
                            <p className="text-sm text-slate-500">Documents, Images, Audio, or Video files</p>
                        </div>
                    </label>
                </div>

                <div>
                    <div className="flex border-b border-slate-700 mb-4">
                        <button onClick={() => setView('active')} className={`py-2 px-4 font-semibold ${view === 'active' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}>Active</button>
                        <button onClick={() => setView('archived')} className={`py-2 px-4 font-semibold ${view === 'archived' ? 'text-white border-b-2 border-blue-500' : 'text-slate-400'}`}>Archived</button>
                    </div>

                    {displayedDocuments.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">
                            {view === 'active' ? 'No active files. Upload a file to get started.' : 'No files have been archived.'}
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {displayedDocuments.map(doc => (
                                <li key={doc.name} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                                    <div className="flex items-center space-x-4 overflow-hidden">
                                        <FileTextIcon />
                                        <div className="overflow-hidden">
                                            <p className="font-semibold text-slate-200 truncate">{doc.name}</p>
                                            <p className="text-sm text-slate-400">{formatBytes(doc.size)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4 flex-shrink-0">
                                        <button
                                            onClick={() => handleArchiveToggle(doc)}
                                            className="text-slate-400 hover:text-yellow-400 font-semibold transition-colors p-2"
                                            title={doc.isArchived ? 'Unarchive' : 'Archive'}
                                        >
                                            <ArchiveIcon />
                                        </button>
                                        <button
                                            onClick={() => handleRemoveDocument(doc.name)}
                                            className="text-slate-400 hover:text-red-500 font-semibold transition-colors p-2"
                                            title="Delete Permanently"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </FeatureLayout>
    );
};

export default FileLibrary;