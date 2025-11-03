import React, { useState, useEffect } from 'react';
import { cryptoService } from '../services/cryptoService';

interface AuthProps {
    onLoginSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
    const [isSetup, setIsSetup] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    useEffect(() => {
        setIsSetup(cryptoService.isSetup());
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const success = await cryptoService.login(password);
        if (success) {
            onLoginSuccess();
        } else {
            setError('Incorrect password. Please try again.');
            setIsLoading(false);
        }
    };

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            await cryptoService.setup(password);
            onLoginSuccess();
        } catch (err: any) {
            setError(err.message);
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        if (window.confirm("ARE YOU SURE?\n\nThis will permanently delete all your data (files, chat history, settings) and cannot be undone. You will be asked to create a new password.")) {
            cryptoService.reset();
            window.location.reload();
        }
    };

    const renderLoginForm = () => (
        <form onSubmit={handleLogin} className="space-y-6">
            <h1 className="text-3xl font-bold text-center text-white">Welcome Back</h1>
            <p className="text-slate-400 text-center">Enter your password to unlock your AI Studio.</p>
            <div>
                <label htmlFor="password-login" className="sr-only">Password</label>
                <input
                    id="password-login"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                {isLoading ? 'Unlocking...' : 'Unlock'}
            </button>
            <div className="text-center">
                <button type="button" onClick={handleReset} className="text-sm text-slate-500 hover:text-red-400">
                    Forgot Password? Reset Application
                </button>
            </div>
        </form>
    );
    
    const renderSetupForm = () => (
        <form onSubmit={handleSetup} className="space-y-4">
             <h1 className="text-3xl font-bold text-center text-white">Create Your Password</h1>
             <p className="text-slate-400 text-center">This password protects all your local data. It cannot be recovered if lost.</p>
             <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
                <strong>Important:</strong> Your password is the only key to your data. We cannot recover it for you. Losing your password means losing access to all your files and chats permanently.
             </div>
             <div>
                <label htmlFor="password-setup" className="sr-only">Password</label>
                <input
                    id="password-setup"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong password (min 8 characters)"
                    required
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
             <div>
                <label htmlFor="password-confirm" className="sr-only">Confirm Password</label>
                <input
                    id="password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>
             <button type="submit" disabled={isLoading} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                 {isLoading ? 'Securing...' : 'Create Password & Start'}
             </button>
        </form>
    );

    return (
        <div className="flex items-center justify-center h-screen bg-slate-900">
            <div className="w-full max-w-md p-8 bg-slate-950 rounded-2xl shadow-lg border border-slate-800">
                {isSetup ? renderLoginForm() : renderSetupForm()}
                {error && <p className="mt-4 text-center text-red-400">{error}</p>}
            </div>
        </div>
    );
};

export default Auth;
