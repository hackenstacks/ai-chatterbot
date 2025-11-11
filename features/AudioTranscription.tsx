
import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService.ts';
// FIX: Rename `encode` to `base64Encode` on import to avoid name collisions.
import { fileToBase64, formatBytes, encode as base64Encode } from '../utils/helpers.ts';
import FeatureLayout from './common/FeatureLayout.tsx';
import Spinner from '../components/Spinner.tsx';
import { dbService, StoredFile } from '../services/dbService.ts';
import { SaveIcon } from '../components/Icons.tsx';
import ErrorDisplay from '../components/ErrorDisplay.tsx';
import { parseError, FormattedError } from '../utils/errorUtils.ts';

interface AudioTranscriptionProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const AudioTranscription: React.FC<AudioTranscriptionProps> = ({ documents, setDocuments }) => {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<FormattedError | null>(null);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult('');
            setError(null);
            if (audioRef.current) {
                audioRef.current.src = URL.createObjectURL(selectedFile);
            }
        }
    };

    const handleTranscribe = async () => {
        if (!file) {
            setError(parseError(new Error('Please select an audio file.')));
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        try {
            const audioBase64 = await fileToBase64(file);
            const response = await GeminiService.transcribeAudio(audioBase64, file.type);
            setResult(response.text);
        } catch (err: any) {
            console.error(err);
            setError(parseError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveResult = async () => {
        if (!result) return;
        
        const defaultName = file ? `${file.name.split('.').slice(0, -1).join('.')}-transcript.txt` : "audio-transcript.txt";
        let fileName = prompt("Enter a name for the saved file:", defaultName);
        if (!fileName) return;

        if (documents.some(doc => doc.name === fileName)) {
            alert("A file with this name already exists in the library. Please choose a different name.");
            return;
        }
        
        const textEncoder = new TextEncoder();
        const contentBytes = textEncoder.encode(result);
        // FIX: Use renamed `base64Encode` function.
        const base64Data = base64Encode(contentBytes);
        
        const newFile: StoredFile = {
            name: fileName,
            type: 'text/plain',
            size: contentBytes.length,
            lastModified: Date.now(),
            isArchived: false,
            data: base64Data,
        };
        
        try {
            await dbService.addDocuments([newFile]);
            setDocuments(prev => [...prev, newFile]);
            alert(`'${fileName}' saved to File Library.`);
        } catch (error) {
            console.error("Failed to save file:", error);
            alert("Could not save the file to the library.");
        }
    };

    return (
        <FeatureLayout title="Audio Transcription" description="Upload an audio file and Gemini will transcribe the speech into text.">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                     <div className="w-full p-6 border-2 border-dashed border-slate-600 rounded-lg text-center">
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="audio-upload"
                        />
                        <label htmlFor="audio-upload" className="cursor-pointer text-blue-400 hover:text-blue-500 font-semibold">
                            {file ? 'Change audio file' : 'Choose an audio file'}
                        </label>
                        {file && <p className="text-sm text-slate-400 mt-2">{file.name} ({formatBytes(file.size)})</p>}
                    </div>

                    {file && (
                        <div className="mt-4">
                           <audio ref={audioRef} controls className="w-full" />
                        </div>
                    )}
                    
                    <button
                        onClick={handleTranscribe}
                        disabled={!file || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        {isLoading ? 'Transcribing...' : 'Transcribe Audio'}
                    </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 h-[60vh] overflow-y-auto flex flex-col">
                    <div className="flex-grow">
                        {isLoading && <div className="flex items-center justify-center h-full"><Spinner /></div>}
                        {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
                        {result && <p className="text-slate-200 whitespace-pre-wrap">{result}</p>}
                        {!isLoading && !result && !error && <div className="flex items-center justify-center h-full text-slate-500">Transcription will appear here.</div>}
                    </div>
                     {result && !isLoading && (
                        <div className="flex-shrink-0 pt-4 mt-4 border-t border-slate-700">
                            <button
                                onClick={handleSaveResult}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <SaveIcon />
                                Save Transcript to Library
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </FeatureLayout>
    );
};

export default AudioTranscription;
