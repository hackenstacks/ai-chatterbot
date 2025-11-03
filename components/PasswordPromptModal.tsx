import React, { useState } from 'react';
import { XIcon } from './Icons';

interface PasswordPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (password: string) => void;
    title: string;
    description: string;
    buttonText: string;
}

const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({ isOpen, onClose, onSubmit, title, description, buttonText }) => {
    const [password, setPassword] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(password);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <XIcon />
                    </button>
                </header>
                <form onSubmit={handleSubmit}>
                    <main className="p-6 space-y-4">
                        <p className="text-slate-400">{description}</p>
                        <div>
                            <label htmlFor="modal-password" className="sr-only">Password</label>
                            <input
                                id="modal-password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                                autoFocus
                            />
                        </div>
                    </main>
                    <footer className="p-6 border-t border-slate-800">
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
                            {buttonText}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
};
export default PasswordPromptModal;
