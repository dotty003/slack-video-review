import React, { useState, useEffect } from 'react';
import { AdminVideo } from '../types';
import * as api from '../api';
import { formatRelativeTime } from '../utils/formatters';

interface AdminDashboardProps {
    secret: string;
    onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ secret, onLogout }) => {
    const [videos, setVideos] = useState<AdminVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const data = await api.fetchAdminVideos(secret);
                setVideos(data.videos);
            } catch (err) {
                console.error('Failed to load dashboard:', err);
                setError('Failed to load dashboard data. Check your connection or secret.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [secret]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#9100BD] rounded-lg flex items-center justify-center text-white font-bold opacity-90 shadow-md">
                            P
                        </div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight">
                            Admin Dashboard
                        </h1>
                    </div>

                    <button
                        onClick={onLogout}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-800">All Reviews</h2>
                    <p className="text-slate-500 mt-1">Manage and track the status of all video review links.</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64 bg-white rounded-xl shadow-sm border border-slate-200">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9100BD]"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <span className="text-red-500">⚠️</span>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Video Content</th>
                                        <th scope="col" className="px-6 py-4 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Uploader / Team</th>
                                        <th scope="col" className="px-6 py-4 text-center font-semibold text-slate-600 uppercase tracking-wider text-xs">Status</th>
                                        <th scope="col" className="px-6 py-4 text-center font-semibold text-slate-600 uppercase tracking-wider text-xs">Comments</th>
                                        <th scope="col" className="px-6 py-4 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {videos.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                No videos found in the database.
                                            </td>
                                        </tr>
                                    ) : (
                                        videos.map((video) => (
                                            <tr key={video.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-slate-900 group-hover:text-[#9100BD] transition-colors">
                                                            {video.video_name || `Video #${video.id}`}
                                                        </span>
                                                        <span className="text-slate-500 text-xs mt-1">
                                                            {formatRelativeTime(video.created_at)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-700 font-mono text-xs">{video.uploader_id}</span>
                                                        <span className="text-slate-400 text-[10px] mt-1 line-clamp-1 max-w-[150px]" title={video.channel_id}>
                                                            {video.channel_id}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${video.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        video.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                        {video.status === 'approved' ? 'Approved' :
                                                            video.status === 'rejected' ? 'Changes Req' : 'Pending'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center items-center gap-1.5">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-medium text-xs border border-slate-200 shadow-sm" title="Total Comments">
                                                            {video.total_comments || 0}
                                                        </div>
                                                        {video.open_comments > 0 && (
                                                            <div className="flex items-center justify-center min-w-[32px] h-8 rounded-full bg-red-100 text-red-700 font-bold text-xs px-2 border border-red-200 shadow-sm" title="Open Comments">
                                                                {video.open_comments} open
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <a
                                                        href={`/review?video=${video.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center px-3 py-1.5 font-medium text-white transition-all duration-200 bg-[#9100BD] border border-transparent rounded-lg shadow-sm hover:bg-[#7a00a0] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#9100BD] text-xs"
                                                    >
                                                        Review →
                                                    </a>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminDashboard;
