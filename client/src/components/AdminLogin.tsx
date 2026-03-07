import React, { useState } from 'react';

interface AdminLoginProps {
    onLogin: (secret: string) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
    const [secret, setSecret] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!secret.trim()) {
            setError('Please enter the admin secret');
            return;
        }
        onLogin(secret);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-900 text-slate-100 font-sans p-4">
            <div className="w-full max-w-sm bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 p-8 transform transition-all">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#9100BD]/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#9100BD]/30 shadow-[0_0_15px_rgba(145,0,189,0.3)]">
                        <span className="text-3xl text-[#9100BD]">🛡️</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
                    <p className="text-slate-400 text-sm mt-2">Enter the master secret to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <input
                            type="password"
                            value={secret}
                            onChange={(e) => {
                                setSecret(e.target.value);
                                setError('');
                            }}
                            placeholder="Admin Secret"
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9100BD] text-slate-200 placeholder-slate-500 transition-all font-mono shadow-inner"
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                                <span className="inline-block w-1 h-1 bg-red-400 rounded-full"></span>
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={!secret}
                        className="w-full bg-gradient-to-r from-[#9100BD] to-[#b300eb] hover:from-[#7a00a0] hover:to-[#9100BD] text-white py-3 rounded-xl font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-[#9100BD]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Access Dashboard
                    </button>

                    <div className="text-center pt-4">
                        <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Return to App</a>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
