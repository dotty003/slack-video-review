import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Video, Comment, VideoResponse } from './types';
import VideoPlayer from './components/VideoPlayer';
import CommentSidebar from './components/CommentSidebar';
import LoginScreen from './components/LoginScreen';
import * as api from './api';
import { getStreamUrl, hasValidToken } from './api';
import { Share } from 'lucide-react';

const App: React.FC = () => {
    // State
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const slackUserName = params.get('user_name');
            const slackUserId = params.get('user_id');
            const slackAvatar = params.get('avatar_url');

            if (slackUserName) {
                return {
                    id: slackUserId || `u-${Date.now()}`,
                    name: slackUserName,
                    avatarUrl: slackAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(slackUserName)}&background=FF5BA3&color=fff&bold=true`
                };
            }
        }
        return null;
    });

    const [videoId, _setVideoId] = useState<number | null>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('video');
            return id ? parseInt(id, 10) : null;
        }
        return null;
    });

    const [activeVideo, setActiveVideo] = useState<Video | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [status, setStatus] = useState({ open: 0, resolved: 0, total: 0 });
    const [currentTime, setCurrentTime] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);

    // Refs
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Load video data
    const loadVideoData = useCallback(async (_preservePlayback = false) => {
        if (!videoId) {
            setError('No video specified. Use ?video=ID in URL.');
            setLoading(false);
            return;
        }

        try {
            const data: VideoResponse = await api.getVideo(videoId);
            setActiveVideo(data.video);
            setComments(data.comments);
            setStatus(data.status);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load video');
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    useEffect(() => {
        loadVideoData();
    }, [loadVideoData]);

    // Video & Comment Interaction Handlers
    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
    };

    const handleSeek = (time: number, annotationUrl?: string | null) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.pause();
        }
        // Show annotation overlay if available
        setActiveAnnotation(annotationUrl || null);
    };

    const handleAddComment = async (text: string, attachmentUrl?: string, attachmentFilename?: string) => {
        if (!activeVideo || !currentUser || !videoId) return;

        const timestampSeconds = Math.floor(videoRef.current?.currentTime || 0);

        try {
            await api.addComment(
                videoId,
                currentUser.name,
                timestampSeconds,
                text,
                attachmentUrl,
                attachmentFilename
            );
            // Refresh comments
            await loadVideoData(true);
        } catch (err) {
            console.error('Failed to add comment:', err);
        }
    };

    const handleResolveComment = async (id: number) => {
        const comment = comments.find(c => c.id === id);
        if (!comment) return;

        try {
            if (comment.resolved) {
                await api.unresolveComment(id);
            } else {
                await api.resolveComment(id);
            }
            await loadVideoData(true);
        } catch (err) {
            console.error('Failed to toggle resolve:', err);
        }
    };

    const handleDeleteComment = async (id: number) => {
        try {
            await api.deleteComment(id);
            await loadVideoData(true);
        } catch (err) {
            console.error('Failed to delete comment:', err);
        }
    };

    // If no valid token, show auth error
    if (!hasValidToken()) {
        return (
            <div className="flex items-center justify-center h-screen bg-wondr-bg text-gray-500 font-sans">
                <div className="text-center max-w-md">
                    <div className="text-5xl mb-4">🔒</div>
                    <p className="text-lg font-medium text-gray-700">Authentication Required</p>
                    <p className="text-sm text-gray-400 mt-2">
                        This review link is invalid or has expired.<br />
                        Please request a new review link from Slack.
                    </p>
                </div>
            </div>
        );
    }

    // If no user is auto-detected, show manual login
    if (!currentUser) {
        return <LoginScreen onJoin={setCurrentUser} />;
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-wondr-bg text-gray-500 font-sans">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-32 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 w-48 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-wondr-bg text-gray-500 font-sans">
                <div className="text-center">
                    <div className="text-5xl mb-4">😕</div>
                    <p className="text-lg font-medium text-gray-700">{error}</p>
                    <p className="text-sm text-gray-400 mt-2">Check the URL and try again</p>
                </div>
            </div>
        );
    }

    if (!activeVideo) {
        return (
            <div className="flex items-center justify-center h-screen bg-wondr-bg text-gray-500 font-sans">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-32 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 w-48 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    // Extract title from video URL
    const videoTitle = activeVideo.video_name || `Video #${videoId}`;

    // --- Render ---
    return (
        <div className="flex flex-col h-screen bg-gray-50 text-slate-900 overflow-hidden font-sans selection:bg-[#9100BD]/20">
            {/* Global Header */}
            <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-50 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#9100BD] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md shadow-[#9100BD]/20">
                            P
                        </div>
                        <span className="font-bold text-xl tracking-tight text-[#9100BD]">PinPoint</span>
                    </div>
                    <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></div>
                    <h1 className="font-medium text-slate-700 text-sm truncate max-w-md hidden md:block">{videoTitle}</h1>
                </div>

                <div className="flex items-center gap-5">
                    <button
                        onClick={() => {
                            if (!videoId) return;
                            const params = new URLSearchParams(window.location.search);
                            const token = params.get('token') || '';
                            window.location.href = `/api/video/${videoId}/export/premiere?token=${encodeURIComponent(token)}`;
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-600 text-xs font-medium rounded-full transition-colors border border-gray-200/50"
                    >
                        <Share className="w-3.5 h-3.5" />
                        Export to Premiere
                    </button>

                    <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-semibold text-slate-800">{currentUser.name}</div>
                            <div className="text-[10px] text-slate-500">Reviewer</div>
                        </div>
                        <div className="relative">
                            <img src={currentUser.avatarUrl} alt="User" className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover" />
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                <div className="flex h-full flex-col md:flex-row">
                    {/* Player Area */}
                    <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                        <VideoPlayer
                            url={videoId ? getStreamUrl(videoId) : ''}
                            onTimeUpdate={handleTimeUpdate}
                            comments={comments}
                            videoRef={videoRef}
                            onAddComment={handleAddComment}
                            activeAnnotation={activeAnnotation}
                            onClearAnnotation={() => setActiveAnnotation(null)}
                        />
                    </div>

                    {/* Sidebar Area */}
                    <div className="h-1/3 md:h-full md:w-96 shrink-0 z-20">
                        <CommentSidebar
                            comments={comments}
                            currentTime={currentTime}
                            onSeek={handleSeek}
                            onAddComment={handleAddComment}
                            onResolveComment={handleResolveComment}
                            onDeleteComment={handleDeleteComment}
                            currentUser={currentUser}
                            status={status}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
