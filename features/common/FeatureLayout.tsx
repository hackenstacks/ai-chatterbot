
import React from 'react';
import ApiSelector from './ApiSelector.tsx';

interface FeatureLayoutProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

const FeatureLayout: React.FC<FeatureLayoutProps> = ({ title, description, children }) => {
    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 md:p-8 overflow-y-auto">
            <header className="mb-6 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-white">{title}</h1>
                    <p className="text-slate-400 mt-1">{description}</p>
                </div>
                <div className="mt-2 md:mt-0">
                    <ApiSelector />
                </div>
            </header>
            <div className="flex-grow">
                {children}
            </div>
        </div>
    );
};

export default FeatureLayout;
