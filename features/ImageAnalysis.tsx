
import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService.ts';
import { fileToBase64, formatBytes, encode } from '../utils/helpers.ts';
import FeatureLayout from './common/FeatureLayout.tsx';
import Spinner from '../components/Spinner.tsx';
import MarkdownRenderer from '../components/MarkdownRenderer.tsx';
import { dbService, StoredFile } from '../services/dbService.ts';
import { SaveIcon } from '../components/Icons.tsx';
import ErrorDisplay from '../components/ErrorDisplay.tsx';
import { parseError, FormattedError } from '../utils/errorUtils.ts';

interface ImageAnalysisProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const ImageAnalysis: React.FC<ImageAnalysisProps> = ({ documents, setDocuments }) => {
    const [file, setFile] = useState<File | null>(null);
    const [prompt, setPrompt] = useState<string>('What is in this image?');
    const [result, setResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<FormattedError | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult('');
            setError(null);
        }
    };

    const handleAnalyze = async () => {
        if (!file || !prompt) {
            setError(parseError(new Error('Please select an image and enter a prompt.')));
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        try {
            const imageBase64 = await fileToBase64(file);
            const response = await GeminiService.analyzeImage(prompt, imageBase64, file.type);
            setResult(response.text);
        } catch (err: any) {
            console.error("Image analysis failed:", err);
            setError(parseError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveResult = async () => {
        if (!result) return;
        
        let fileName = prompt("Enter a name for the saved file:", "image-analysis-result.txt");
        if (!fileName) return;

        if (documents.some(doc => doc.name === fileName)) {
            alert("A file with this name already exists in the library. Please choose a different name.");
            return;
        }
        
        const textEncoder = new TextEncoder();
        const contentBytes = textEncoder.encode(result);
        const base64Data = encode(contentBytes);
        
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
        <FeatureLayout title="Image Analysis" description="Upload an image and ask Gemini to describe or analyze it.">
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., What is in this image?"
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        rows={3}
                    />
                    <div className="w-full p-6 border-2 border-dashed border-slate-600 rounded-lg text-center">
                        <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                            id="image-upload"
                        />
                        <label htmlFor="image-upload" className="cursor-pointer text-blue-400 hover:text-blue-500 font-semibold">
                            {file ? 'Change image' : 'Choose an image'}
                        </label>
                        {file && <p className="text-sm text-slate-400 mt-2">{file.name} ({formatBytes(file.size)})</p>}
                    </div>

                    {file && (
                        <div className="mt-4">
                            <img src={URL.createObjectURL(file)} alt="Preview" className="max-w-full max-h-64 rounded-lg mx-auto" />
                        </div>
                    )}
                    
                    <button
                        onClick={handleAnalyze}
                        disabled={!file || !prompt || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        {isLoading ? 'Analyzing...' : 'Analyze Image'}
                    </button>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4 h-[60vh] overflow-y-auto flex flex-col">
                    <div className="flex-grow">
                        {isLoading && <div className="flex items-center justify-center h-full"><Spinner /></div>}
                        {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
                        {result && <MarkdownRenderer content={result} />}
                        {!isLoading && !result && !error && <div className="flex items-center justify-center h-full text-slate-500">Analysis results will appear here.</div>}
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

export default ImageAnalysis;