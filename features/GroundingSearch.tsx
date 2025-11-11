
import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService.ts';
import useGeolocation from '../hooks/useGeolocation.ts';
import FeatureLayout from './common/FeatureLayout.tsx';
import Spinner from '../components/Spinner.tsx';
import MarkdownRenderer from '../components/MarkdownRenderer.tsx';
import { GlobeIcon, SaveIcon } from '../components/Icons.tsx';
import type { GroundingSource } from '../types.ts';
import { dbService, StoredFile } from '../services/dbService.ts';
import { encode } from '../utils/helpers.ts';
import ErrorDisplay from '../components/ErrorDisplay.tsx';
import { parseError, FormattedError } from '../utils/errorUtils.ts';

interface GroundingSearchProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const GroundingSearch: React.FC<GroundingSearchProps> = ({ documents, setDocuments }) => {
    const [prompt, setPrompt] = useState<string>('Who won the latest F1 Grand Prix?');
    const [useMaps, setUseMaps] = useState<boolean>(false);
    const [result, setResult] = useState<string>('');
    const [sources, setSources] = useState<GroundingSource[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<FormattedError | null>(null);
    const location = useGeolocation();

    const handleSearch = async () => {
        if (!prompt) {
            setError(parseError(new Error('Please enter a prompt.')));
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        setSources([]);
        
        const geo = (location.latitude && location.longitude) ? { latitude: location.latitude, longitude: location.longitude } : undefined;

        try {
            const response = await GeminiService.groundedSearch(prompt, useMaps, geo);
            setResult(response.text);
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                 const newSources: GroundingSource[] = groundingChunks.map((chunk: any) => ({
                    uri: chunk.web?.uri || chunk.maps?.uri || '#',
                    title: chunk.web?.title || chunk.maps?.title || 'Unknown Source',
                    type: chunk.web ? 'web' : 'maps'
                })).filter(s => s.uri !== '#');
                setSources(newSources);
            }
        } catch (err: any) {
            console.error(err);
            setError(parseError(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveResult = async () => {
        if (!result) return;
        
        let fileName = prompt("Enter a name for the saved file:", "grounded-search-result.txt");
        if (!fileName) return;

        if (documents.some(doc => doc.name === fileName)) {
            alert("A file with this name already exists in the library. Please choose a different name.");
            return;
        }
        
        const fullContent = `${result}\n\nSources:\n${sources.map(s => `- ${s.title}: ${s.uri}`).join('\n')}`;
        const textEncoder = new TextEncoder();
        const contentBytes = textEncoder.encode(fullContent);
        // FIX: Replaced aliased `base64Encode` with direct `encode` call to resolve typing issue.
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
        <FeatureLayout title="Grounded Search" description="Get up-to-date answers grounded in real-time information from Google Search and Maps.">
            <div className="max-w-4xl mx-auto space-y-4">
                 <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={3}
                />
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="use-maps"
                            checked={useMaps}
                            onChange={(e) => setUseMaps(e.target.checked)}
                            className="h-4 w-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor="use-maps" className="text-slate-300">Use Google Maps (requires location)</label>
                    </div>
                     <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>
                 {useMaps && location.error && <p className="text-sm text-yellow-400">Could not get location: {location.error}</p>}

                <div className="bg-slate-800/50 rounded-lg p-4 min-h-[50vh] mt-6">
                    {isLoading && <div className="flex items-center justify-center h-full"><Spinner /></div>}
                    {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
                    {result && (
                        <div>
                            <div className="flex justify-between items-start">
                                <MarkdownRenderer content={result} />
                                <button onClick={handleSaveResult} title="Save Result to Library" className="text-slate-400 hover:text-white p-2 rounded-full flex-shrink-0"><SaveIcon /></button>
                            </div>
                            {sources.length > 0 && (
                                <div className="mt-6 border-t border-slate-700 pt-4">
                                    <h3 className="text-lg font-semibold text-slate-300 mb-2">Sources:</h3>
                                    <ul className="space-y-2">
                                        {sources.map((source, index) => (
                                            <li key={index} className="flex items-start space-x-2">
                                                <GlobeIcon />
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                    {source.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                     {!isLoading && !result && !error && <div className="flex items-center justify-center h-full text-slate-500">Search results will appear here.</div>}
                </div>
            </div>
        </FeatureLayout>
    );
};

export default GroundingSearch;