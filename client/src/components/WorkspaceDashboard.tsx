import React, { useState, useEffect } from 'react';
import { AdminVideo } from '../types';
import * as api from '../api';
import { formatRelativeTime } from '../utils/formatters';
import { ArrowLeft, Play, MessageSquare, Plus, Clock } from 'lucide-react';

interface WorkspaceDashboardProps {
    videoId: number;
    teamName: string;
    onClose: () => void;
    onSelectVideo: (videoId: number, token?: string) => void;
}

const WorkspaceDashboard: React.FC<WorkspaceDashboardProps> = ({
    videoId,
    teamName,
    onClose,
    onSelectVideo
}) => {
    const [videos, setVideos] = useState<AdminVideo[]>([]);
    const [actualTeamName, setActualTeamName] = useState(teamName);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const data = await api.fetchWorkspaceVideos(videoId);
                setVideos(data.videos);
                if (data.teamName) {
                    setActualTeamName(data.teamName);
                }
            } catch (err) {
                console.error('Failed to load workspace videos:', err);
                setError('Failed to load workspace videos. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [videoId]);

    return (
        <div className="absolute inset-0 z-50 bg-[#0A0A0A] flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-[#0A0A0A] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                        title="Back to Player"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-[#9100BD] to-[#60007A] rounded-lg flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(145,0,189,0.3)]">
                            {actualTeamName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-white font-medium tracking-wide text-sm">{actualTeamName}</h1>
                            <p className="text-white/40 text-xs">Video Workspace</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
                <div className="max-w-5xl mx-auto block">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-semibold text-white tracking-tight">All Reviews</h2>
                            <p className="text-white/50 text-sm mt-1">Manage and track video approvals for {actualTeamName}.</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-64 bg-white/5 rounded-2xl border border-white/10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9100BD]"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                            <p className="text-red-400">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm"
                            >
                                Retry
                            </button>
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-white/10 text-center px-4">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <Play className="w-6 h-6 text-white/30" />
                            </div>
                            <h3 className="text-white font-medium text-lg">No videos found</h3>
                            <p className="text-white/50 text-sm mt-2 max-w-sm">
                                There are no videos currently being reviewed in this workspace. Upload a video in Slack to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {videos.map((video) => (
                                <div
                                    key={video.id}
                                    onClick={() => onSelectVideo(video.id, video.token)}
                                    className={`group flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 cursor-pointer ${video.id === videoId
                                        ? 'bg-white/10 border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
                                        : 'bg-white/5 border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="relative flex-shrink-0">
                                            <div className="w-16 h-16 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-[#9100BD]/50 transition-colors overflow-hidden">
                                                <Play className={`w-6 h-6 ${video.id === videoId ? 'text-[#9100BD]' : 'text-white/30 group-hover:text-white/70'} transition-colors ml-1`} />
                                            </div>
                                            {video.id === videoId && (
                                                <div className="absolute -top-2 -right-2 w-4 h-4 bg-[#9100BD] rounded-full border-2 border-[#0A0A0A]" />
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className={`font-medium transition-colors ${video.id === videoId ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                                                    {video.video_name || `Video #${video.id}`}
                                                </h3>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${video.status === 'approved' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                    video.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                        'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                    }`}>
                                                    {video.status === 'approved' ? 'Approved' :
                                                        video.status === 'rejected' ? 'Changes Req' : 'Reviewing'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-white/40">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatRelativeTime(video.created_at)}
                                                </span>
                                                <span className="flex items-center gap-1.5 line-clamp-1 max-w-[150px]" title={video.channel_id}>
                                                    #{video.channel_id.substring(0, 15)}...
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-end">
                                                <span className="text-white/70 text-sm font-medium flex items-center gap-1.5">
                                                    <MessageSquare className="w-4 h-4 text-white/40" />
                                                    {video.total_comments || 0}
                                                </span>
                                                <span className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">Total</span>
                                            </div>

                                            {video.open_comments > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-amber-400 text-sm font-bold">
                                                        {video.open_comments}
                                                    </span>
                                                    <span className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">Open</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end opacity-40">
                                                    <span className="text-white/50 text-sm font-medium">0</span>
                                                    <span className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">Open</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pl-6 border-l border-white/10 hidden sm:block">
                                            <div className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${video.id === videoId
                                                ? 'bg-white/10 text-white cursor-default'
                                                : 'bg-[#9100BD] hover:bg-[#7a00a0] text-white'
                                                }`}>
                                                {video.id === videoId ? 'Current' : 'Review'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default WorkspaceDashboard;
