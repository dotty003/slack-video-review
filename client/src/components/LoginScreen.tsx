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
                avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=9100BD&color=fff&bold=true`,
            });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 via-white to-gray-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-10 h-10 bg-[#9100BD] rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md shadow-[#9100BD]/20">
                            P
                        </div>
                        <span className="font-bold text-2xl tracking-tight text-[#9100BD]">PinPoint</span>
                    </div>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9100BD]/50 focus:border-[#9100BD] transition-all"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full py-3 bg-[#9100BD] text-white font-bold rounded-xl hover:bg-[#7a00a0] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#9100BD]/20"
                    >
                        Join Review Session
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
