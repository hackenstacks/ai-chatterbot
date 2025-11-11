
import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService.ts';
import FeatureLayout from './common/FeatureLayout.tsx';
import Spinner from '../components/Spinner.tsx';
import MarkdownRenderer from '../components/MarkdownRenderer.tsx';
import { dbService, StoredFile } from '../services/dbService.ts';
import { SaveIcon } from '../components/Icons.tsx';
import { encode } from '../utils/helpers.ts';
import ErrorDisplay from '../components/ErrorDisplay.tsx';
import { parseError, FormattedError } from '../utils/errorUtils.ts';

interface ComplexReasoningProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const ComplexReasoning: React.FC<ComplexReasoningProps> = ({ documents, setDocuments }) => {
    const [prompt, setPrompt] = useState<string>('Explain the concept of quantum entanglement to a high school student, including an analogy to help with understanding.');
    const [result, setResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<FormattedError | null>(null);

    const handleQuery = async () => {
        if (!prompt) {
            setError(parseError(new Error('Please enter a prompt.')));
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult('');
        try {
            const response = await GeminiService.complexReasoning(prompt);
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
        
        let fileName = prompt("Enter a name for the saved file:", "reasoning-result.txt");
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
        <FeatureLayout title="Complex Reasoning" description="Leverage Gemini Pro with Thinking Mode to solve difficult problems and answer complex questions.">
            <div className="max-w-4xl mx-auto space-y-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter a complex prompt..."
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    rows={5}
                />
                <button
                    onClick={handleQuery}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                    {isLoading ? 'Thinking...' : 'Submit Query'}
                </button>

                <div className="bg-slate-800/50 rounded-lg p-4 min-h-[50vh] mt-6">
                    {isLoading && <div className="flex items-center justify-center h-full"><Spinner text="Thinking... this may take some time for complex queries." /></div>}
                    {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}
                    {result && (
                         <div>
                            <div className="flex justify-between items-start">
                                <MarkdownRenderer content={result} />
                                <button onClick={handleSaveResult} title="Save Result to Library" className="text-slate-400 hover:text-white p-2 rounded-full flex-shrink-0"><SaveIcon /></button>
                            </div>
                        </div>
                    )}
                    {!isLoading && !result && !error && <div className="flex items-center justify-center h-full text-slate-500">The model's reasoning will appear here.</div>}
                </div>
            </div>
        </FeatureLayout>
    );
};

export default ComplexReasoning;