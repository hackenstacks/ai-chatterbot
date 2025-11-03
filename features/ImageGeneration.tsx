import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService';
import FeatureLayout from './common/FeatureLayout';
import Spinner from '../components/Spinner';
import { SaveIcon } from '../components/Icons';
import { dbService, StoredFile } from '../services/dbService';
import { base64ToBlob } from '../utils/helpers';

interface ImageGenerationProps {
    documents: StoredFile[];
    setDocuments: React.Dispatch<React.SetStateAction<StoredFile[]>>;
}

const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];
const styles = [
    { name: "None", keywords: "" },
    { name: "Photorealistic", keywords: "photorealistic, 8k, detailed, professional photography" },
    { name: "Cinematic", keywords: "cinematic, movie still, dramatic lighting, high detail" },
    { name: "Anime", keywords: "anime style, cel shaded, vibrant colors, detailed" },
    { name: "Digital Art", keywords: "digital painting, concept art, fantasy, intricate" },
    { name: "Cyberpunk", keywords: "cyberpunk, neon lighting, futuristic, dystopian" },
];

const ImageGeneration: React.FC<ImageGenerationProps> = ({ documents, setDocuments }) => {
    const [prompt, setPrompt] = useState<string>('A photorealistic image of a futuristic city on a distant planet, with flying cars and glowing skyscrapers.');
    const [negativePrompt, setNegativePrompt] = useState<string>('blurry, low quality, ugly, text, watermark');
    const [aspectRatio, setAspectRatio] = useState<string>("16:9");
    const [selectedStyle, setSelectedStyle] = useState<string>(styles[1].name);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleGenerate = async () => {
        if (!prompt) {
            setError('Please enter a prompt.');
            return;
        }
        setIsLoading(true);
        setError('');
        setGeneratedImages([]);
        try {
            const styleKeywords = styles.find(s => s.name === selectedStyle)?.keywords || "";
            const fullPrompt = `${prompt}${styleKeywords ? `, ${styleKeywords}` : ''}`;

            const imagesBase64 = await GeminiService.generateImage(fullPrompt, aspectRatio, negativePrompt);
            setGeneratedImages(imagesBase64);
        } catch (err: any) {
            console.error(err);
            setError('Failed to generate image. ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveImage = async (base64Data: string) => {
        let fileName = prompt("Enter a name for the saved image:", "generated-image.jpg");
        if (!fileName) return;

        if (!fileName.toLowerCase().endsWith('.jpg') && !fileName.toLowerCase().endsWith('.jpeg')) {
            fileName += '.jpg';
        }

        if (documents.some(doc => doc.name === fileName)) {
            alert("A file with this name already exists in the library. Please choose a different name.");
            return;
        }
        
        const mimeType = 'image/jpeg';
        const blob = base64ToBlob(base64Data, mimeType);
        
        const newFile: StoredFile = {
            name: fileName,
            type: mimeType,
            size: blob.size,
            lastModified: Date.now(),
            isArchived: false,
            data: base64Data,
        };
        
        try {
            await dbService.addDocuments([newFile]);
            setDocuments(prev => [...prev, newFile]);
            alert(`'${fileName}' saved to File Library.`);
        } catch (error) {
            console.error("Failed to save image:", error);
            alert("Could not save the image to the library.");
        }
    };

    return (
        <FeatureLayout title="Image Generation" description="Create stunning images from your text descriptions using the Imagen model.">
            <div className="flex flex-col h-full">
                <div className="w-full max-w-4xl mx-auto space-y-4">
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter a detailed prompt..."
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        rows={3}
                    />
                     <textarea
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="Enter a negative prompt (e.g., blurry, text, watermark)..."
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        rows={2}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <label htmlFor="style" className="block text-sm font-medium text-slate-300 mb-1">Style</label>
                             <div className="flex flex-wrap gap-2">
                                {styles.map(style => (
                                    <button
                                        key={style.name}
                                        onClick={() => setSelectedStyle(style.name)}
                                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                                            selectedStyle === style.name ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
                                        }`}
                                    >{style.name}</button>
                                ))}
                             </div>
                        </div>
                        <div>
                             <label htmlFor="aspect-ratio" className="block text-sm font-medium text-slate-300 mb-1">Aspect Ratio</label>
                            <select
                                id="aspect-ratio"
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                {aspectRatios.map(ar => <option key={ar} value={ar}>{ar}</option>)}
                            </select>
                        </div>
                    </div>
                     <button
                        onClick={handleGenerate}
                        disabled={!prompt || isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        {isLoading ? 'Generating...' : 'Generate Image'}
                    </button>
                </div>

                <div className="flex-grow mt-8 flex items-center justify-center bg-slate-800/50 rounded-lg p-4 min-h-[50vh]">
                    {isLoading && <Spinner text="Generating image... this can take a moment." />}
                    {error && <p className="text-red-400">{error}</p>}
                    {!isLoading && !error && generatedImages.length === 0 && (
                         <p className="text-slate-500">Your generated image will appear here.</p>
                    )}
                    {generatedImages.map((imageBase64, index) => (
                        <div key={index} className="relative group w-full h-full flex items-center justify-center">
                            <img
                                src={`data:image/jpeg;base64,${imageBase64}`}
                                alt={`Generated image for prompt: ${prompt}`}
                                className="max-w-full max-h-full object-contain rounded-lg"
                            />
                            <button
                                onClick={() => handleSaveImage(imageBase64)}
                                className="absolute bottom-4 bg-slate-900/60 backdrop-blur-sm hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2"
                            >
                                <SaveIcon /> Save to Library
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </FeatureLayout>
    );
};

export default ImageGeneration;