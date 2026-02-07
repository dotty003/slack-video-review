import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Video, Comment, VideoResponse } from './types';
import VideoPlayer from './components/VideoPlayer';
import CommentSidebar from './components/CommentSidebar';
import LoginScreen from './components/LoginScreen';
import * as api from './api';

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

    const [videoId, setVideoId] = useState<number | null>(() => {
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

    // Refs
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Load video data
    const loadVideoData = useCallback(async (preservePlayback = false) => {
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

    const handleSeek = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.play();
        }
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
    const videoTitle = activeVideo.video_url
        ? decodeURIComponent(activeVideo.video_url.split('/').pop()?.split('?')[0] || `Video #${videoId}`)
        : `Video #${videoId}`;

    // --- Render ---
    return (
        <div className="flex flex-col h-screen bg-wondr-bg text-wondr-dark overflow-hidden font-sans">
            {/* Global Header */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-8 shrink-0 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-2xl tracking-tight text-wondr-pink">WONDR Review</span>
                    </div>
                    <span className="h-6 w-px bg-gray-200 mx-2 hidden md:block"></span>
                    <div className="hidden md:flex flex-col justify-center">
                        <span className="text-sm font-semibold text-gray-900 leading-none truncate max-w-xs">{videoTitle}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* User Profile Mini */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-600 hidden sm:block">{currentUser.name}</span>
                        <img src={currentUser.avatarUrl} alt="User" className="w-10 h-10 rounded-full ring-2 ring-wondr-lavender" />
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                <div className="flex h-full flex-col md:flex-row">
                    {/* Player Area */}
                    <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                        <VideoPlayer
                            url={activeVideo.video_url}
                            onTimeUpdate={handleTimeUpdate}
                            comments={comments}
                            videoRef={videoRef}
                            onAddComment={handleAddComment}
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
