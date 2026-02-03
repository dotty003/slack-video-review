import React, { useState } from 'react';
import { User } from '../types';

interface LoginScreenProps {
    onJoin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin }) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onJoin({
                id: `web-${Date.now()}`,
                name: name.trim(),
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=FF5BA3&color=fff&bold=true`,
            });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-wondr-lavender via-white to-wondr-bg flex items-center justify-center p-6">
            <div className="bg-white rounded-wondr shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-wondr-pink mb-2">WONDR Review</h1>
                    <p className="text-gray-500">Enter your name to start reviewing</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                            Your Name
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Creative Director"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-wondr-pink/50 focus:border-wondr-pink transition-all"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full py-3 bg-wondr-pink text-white font-bold rounded-xl hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-wondr-pink/20"
                    >
                        Join Review Session
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
