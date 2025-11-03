
import React from 'react';

interface FeatureLayoutProps {
    title: string;
    description: string;
    children: React.ReactNode;
}

const FeatureLayout: React.FC<FeatureLayoutProps> = ({ title, description, children }) => {
    return (
        <div className="flex flex-col h-full bg-slate-900 p-4 md:p-8 overflow-y-auto">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-white">{title}</h1>
                <p className="text-slate-400 mt-1">{description}</p>
            </header>
            <div className="flex-grow">
                {children}
            </div>
        </div>
    );
};

export default FeatureLayout;
