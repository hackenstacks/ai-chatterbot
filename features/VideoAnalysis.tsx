
import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService.ts';
// FIX: Rename `encode` to `base64Encode` on import to avoid name collisions.
import { fileToBase64, formatBytes, encode as base64Encode } from '../utils/helpers.ts';
import FeatureLayout from './common/FeatureLayout.tsx';
import Spinner from '../components/Spinner.tsx';
import MarkdownRenderer from '../components/MarkdownRenderer.tsx';
import { dbService, StoredFile } from '../services/dbService.ts';
import { SaveIcon } from '../components/Icons.tsx';
import ErrorDisplay from '../components/ErrorDisplay.tsx';
import { parseError, FormattedError } from '../utils/errorUtils.ts';

interface VideoAnalysisProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const VideoAnalysis: React.FC<VideoAnalysisProps> = ({ documents, setDocuments }) => {
    const [file, setFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState<string>('Summarize this video.');
    const [result, setResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<FormattedError | null>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult('');
            setError(null);
             if (videoRef.current) {
                videoRef.current.src = URL.createObjectURL(selectedFile);
            }
        }
    };

    const handleAnalyze = async () => {
        if (!file || !prompt) {
            setError(parseError(new Error('Please select a video and enter a prompt.')));
            return;
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit for client-side demo
            setError(parseError(new Error('File is too large. Please upload a video under 10MB for this demo.')));
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        try {
            const videoBase64 = await fileToBase64(file);
            const response = await GeminiService.analyzeVideo(prompt, videoBase64, file.type);
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
        
        let fileName = prompt("Enter a name for the saved file:", "video-analysis-result.txt");
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
        <FeatureLayout title="Video Analysis" description="Upload a short video (<10MB) and let Gemini Pro provide insights.">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., Summarize this video."
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        rows={3}
                    />
                    <div className="w-full p-6 border-2 border-dashed border-slate-600 rounded-lg text-center">
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="hidden"
                            id="video-upload"
                        />
                        <label htmlFor="video-upload" className="cursor-pointer text-blue-400 hover:text-blue-500 font-semibold">
                            {file ? 'Change video' : 'Choose a video'}
                        </label>
                        {file && <p className="text-sm text-slate-400 mt-2">{file.name} ({formatBytes(file.size)})</p>}
                    </div>

                    {file && (
                        <div className="mt-4 bg-black rounded-lg">
                            <video ref={videoRef} controls className="max-w-full max-h-64 rounded-lg mx-auto" />
                        </div>
                    )}
                    
                    <button
                        onClick={handleAnalyze}
                        disabled={!file || !prompt || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        {isLoading ? 'Analyzing...' : 'Analyze Video'}
                    </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 h-[60vh] overflow-y-auto flex flex-col">
                    <div className="flex-grow">
                        {isLoading && <div className="flex items-center justify-center h-full"><Spinner /></div>}
                        {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
                        {result && <MarkdownRenderer content={result} />}
                        {!isLoading && !result && !error && <div className="flex items-center justify-center h-full text-slate-500">Video analysis results will appear here.</div>}
                    </div>
                    {result && !isLoading && (
                        <div className="flex-shrink-0 pt-4 mt-4 border-t border-slate-700">
                            <button
                                onClick={handleSaveResult}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <SaveIcon />
                                Save Result to Library
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </FeatureLayout>
    );
};

export default VideoAnalysis;
