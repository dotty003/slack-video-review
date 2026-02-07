import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, PenTool, Eraser, Square, Circle, Undo, MessageSquarePlus, X, Check, Maximize } from 'lucide-react';
import { formatTime } from '../utils/formatters';
import { Comment } from '../types';

interface VideoPlayerProps {
    url: string;
    onTimeUpdate: (time: number) => void;
    comments: Comment[];
    videoRef: React.RefObject<HTMLVideoElement | null>;
    onAddComment: (text: string, attachmentUrl?: string, attachmentFilename?: string) => void;
}

type AnnotationTool = 'pen' | 'rect' | 'circle';
type AnnotationColor = '#FF5BA3' | '#0000EE' | '#FFFFFF' | '#FACC15';

interface Shape {
    tool: AnnotationTool;
    color: string;
    points: { x: number; y: number }[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, onTimeUpdate, comments, videoRef, onAddComment }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Annotation State
    const [isAnnotating, setIsAnnotating] = useState(false);
    const [currentTool, setCurrentTool] = useState<AnnotationTool>('pen');
    const [currentColor, setCurrentColor] = useState<AnnotationColor>('#FF5BA3');
    const [annotations, setAnnotations] = useState<Shape[]>([]);
    const [currentShape, setCurrentShape] = useState<Shape | null>(null);

    // Popup Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [commentText, setCommentText] = useState('');

    const controlsTimeoutRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- Video Logic ---

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            if (isAnnotating) setIsAnnotating(false);
            videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        setProgress((current / total) * 100);
        onTimeUpdate(current);
    };

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!videoRef.current) return;
        const seekTime = (Number(e.target.value) / 100) * duration;
        videoRef.current.currentTime = seekTime;
        setProgress(Number(e.target.value));
        setAnnotations([]);
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        if (!isAnnotating && !showSaveModal) {
            controlsTimeoutRef.current = window.setTimeout(() => {
                if (isPlaying) setShowControls(false);
            }, 2000);
        }
    };

    const toggleMute = () => {
        if (!videoRef.current) return;
        videoRef.current.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const skip = (seconds: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime += seconds;
        setAnnotations([]);
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
        };
    }, [videoRef]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showSaveModal) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    skip(-5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    skip(5);
                    break;
                case 'KeyM':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'KeyF':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, isMuted, showSaveModal]);

    // --- Annotation Logic ---

    const toggleAnnotationMode = () => {
        const newState = !isAnnotating;
        setIsAnnotating(newState);
        if (newState && videoRef.current) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        if (!newState) {
            setAnnotations([]);
        }
    };

    const getCanvasCoords = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e: React.MouseEvent) => {
        if (!isAnnotating) return;
        const { x, y } = getCanvasCoords(e);

        if (currentTool === 'pen') {
            setCurrentShape({ tool: 'pen', color: currentColor, points: [{ x, y }] });
        } else {
            setCurrentShape({ tool: currentTool, color: currentColor, points: [], start: { x, y }, end: { x, y } });
        }
    };

    const draw = (e: React.MouseEvent) => {
        if (!isAnnotating || !currentShape) return;
        const { x, y } = getCanvasCoords(e);

        if (currentShape.tool === 'pen') {
            setCurrentShape({
                ...currentShape,
                points: [...currentShape.points, { x, y }]
            });
        } else {
            setCurrentShape({
                ...currentShape,
                end: { x, y }
            });
        }
    };

    const endDrawing = () => {
        if (!isAnnotating || !currentShape) return;
        setAnnotations([...annotations, currentShape]);
        setCurrentShape(null);
    };

    const undoAnnotation = () => {
        setAnnotations(annotations.slice(0, -1));
    };

    const clearAnnotations = () => {
        setAnnotations([]);
    };

    // --- Screenshot & Save Logic ---

    const handleCaptureAndOpenModal = () => {
        if (!videoRef.current || !canvasRef.current || !containerRef.current) return;

        const displayWidth = canvasRef.current.width;
        const displayHeight = canvasRef.current.height;

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = displayWidth;
        resultCanvas.height = displayHeight;
        const ctx = resultCanvas.getContext('2d');
        if (!ctx) return;

        // Draw black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Try to draw video frame
        try {
            const videoRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
            const containerRatio = displayWidth / displayHeight;
            let drawW = displayWidth;
            let drawH = displayHeight;
            let offsetX = 0;
            let offsetY = 0;

            if (videoRatio > containerRatio) {
                drawH = displayWidth / videoRatio;
                offsetY = (displayHeight - drawH) / 2;
            } else {
                drawW = displayHeight * videoRatio;
                offsetX = (displayWidth - drawW) / 2;
            }

            ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
            resultCanvas.toDataURL(); // Test if tainted
        } catch {
            console.warn("Could not capture video frame (CORS). Saving annotation only.");
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, displayWidth, displayHeight);
        }

        // Draw annotations
        ctx.drawImage(canvasRef.current, 0, 0);

        setScreenshot(resultCanvas.toDataURL('image/png'));
        setShowSaveModal(true);
    };

    const confirmSaveComment = () => {
        if (screenshot) {
            // For annotation screenshots, generate a timestamped filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            onAddComment(commentText, screenshot, `annotation-${timestamp}.png`);
        }
        setShowSaveModal(false);
        setScreenshot(null);
        setCommentText('');
        setAnnotations([]);
        setIsAnnotating(false);
        setShowControls(true);
    };

    const cancelSaveComment = () => {
        setShowSaveModal(false);
        setScreenshot(null);
        setCommentText('');
    };

    // Render Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;

        const renderShape = (shape: Shape) => {
            ctx.strokeStyle = shape.color;
            ctx.beginPath();
            if (shape.tool === 'pen') {
                if (shape.points.length < 2) return;
                ctx.moveTo(shape.points[0].x, shape.points[0].y);
                for (let i = 1; i < shape.points.length; i++) {
                    ctx.lineTo(shape.points[i].x, shape.points[i].y);
                }
            } else if (shape.tool === 'rect' && shape.start && shape.end) {
                ctx.rect(shape.start.x, shape.start.y, shape.end.x - shape.start.x, shape.end.y - shape.start.y);
            } else if (shape.tool === 'circle' && shape.start && shape.end) {
                const radius = Math.sqrt(Math.pow(shape.end.x - shape.start.x, 2) + Math.pow(shape.end.y - shape.start.y, 2));
                ctx.arc(shape.start.x, shape.start.y, radius, 0, 2 * Math.PI);
            }
            ctx.stroke();
        };

        annotations.forEach(renderShape);
        if (currentShape) renderShape(currentShape);
    }, [annotations, currentShape, isAnnotating]);


    return (
        <div
            ref={containerRef}
            className="relative w-full h-full bg-black group overflow-hidden flex items-center justify-center font-sans"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
        >
            <video
                ref={videoRef}
                src={url}
                crossOrigin="anonymous"
                className="max-h-full max-w-full shadow-2xl"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onClick={togglePlay}
            />

            {/* Annotation Canvas */}
            {isAnnotating && (
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full z-10 cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                />
            )}

            {/* Annotation Toolbar */}
            {isAnnotating && !showSaveModal && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-4 shadow-xl z-30 animate-in slide-in-from-top-4 duration-300">
                    {/* Tools */}
                    <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
                        <button onClick={() => setCurrentTool('pen')} className={`p-2 rounded-full transition-colors ${currentTool === 'pen' ? 'bg-wondr-pink text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <PenTool className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentTool('rect')} className={`p-2 rounded-full transition-colors ${currentTool === 'rect' ? 'bg-wondr-pink text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <Square className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentTool('circle')} className={`p-2 rounded-full transition-colors ${currentTool === 'circle' ? 'bg-wondr-pink text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <Circle className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Colors */}
                    <div className="flex items-center gap-2 border-r border-gray-300 pr-3">
                        {(['#FF5BA3', '#0000EE', '#FFFFFF', '#FACC15'] as AnnotationColor[]).map(c => (
                            <button
                                key={c}
                                onClick={() => setCurrentColor(c)}
                                className={`w-6 h-6 rounded-full border-2 ${currentColor === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-110'} transition-transform`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 border-r border-gray-300 pr-3">
                        <button onClick={undoAnnotation} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full" title="Undo">
                            <Undo className="w-5 h-5" />
                        </button>
                        <button onClick={clearAnnotations} className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-full" title="Clear All">
                            <Eraser className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Add to Comment Button */}
                    <button
                        onClick={handleCaptureAndOpenModal}
                        className="flex items-center gap-2 px-4 py-2 bg-wondr-blue text-white rounded-full font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
                        title="Save Annotation to Comment"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                        Add Comment
                    </button>
                </div>
            )}

            {/* Save Modal Popup */}
            {showSaveModal && screenshot && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-wondr shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-900">Add Annotation Comment</h3>
                            <button onClick={cancelSaveComment} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto">
                            <div className="mb-4 rounded-lg overflow-hidden border border-gray-200 bg-black">
                                <img src={screenshot} alt="Annotation Preview" className="w-full h-auto object-contain max-h-48" />
                            </div>

                            <label className="block text-sm font-bold text-gray-700 mb-2">Your Comment</label>
                            <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Describe your feedback..."
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-wondr-pink/50 focus:outline-none resize-none h-24 text-sm"
                                autoFocus
                            />
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={cancelSaveComment}
                                className="px-4 py-2 text-gray-600 font-semibold text-sm hover:bg-gray-200 rounded-full transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSaveComment}
                                className="px-5 py-2 bg-wondr-pink text-white font-bold text-sm rounded-full hover:bg-pink-600 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Post Comment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay controls */}
            <div
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-20 pb-6 px-8 transition-opacity duration-300 z-20 ${showControls && !showSaveModal ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                {/* Timeline */}
                <div className="relative w-full h-2 bg-gray-600/50 rounded-full mb-6 cursor-pointer group/timeline">
                    {/* Comment Markers */}
                    {comments.map((comment) => (
                        <div
                            key={comment.id}
                            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white z-20 hover:scale-150 transition-transform shadow-sm ${comment.resolved ? 'bg-green-500' : 'bg-wondr-pink'
                                }`}
                            style={{ left: `${(comment.timestamp_seconds / duration) * 100}%` }}
                            title={comment.comment_text}
                        />
                    ))}

                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={progress}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                        disabled={isAnnotating}
                    />
                    {/* Visual Progress */}
                    <div
                        className="absolute top-0 left-0 h-full bg-wondr-pink rounded-full pointer-events-none shadow-[0_0_10px_rgba(255,91,163,0.5)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Button Controls */}
                <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-6">
                        <button onClick={togglePlay} className="hover:text-wondr-pink transition-colors transform hover:scale-110 duration-200">
                            {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                        </button>

                        <div className="flex items-center gap-2 text-sm font-bold font-mono tracking-wider text-gray-200">
                            <span>{formatTime((progress / 100) * duration || 0)}</span>
                            <span className="text-gray-500">/</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Annotation Toggle */}
                        <button
                            onClick={toggleAnnotationMode}
                            className={`p-2 rounded-full transition-all duration-300 ${isAnnotating ? 'bg-wondr-pink text-white scale-110' : 'hover:bg-white/10 text-gray-300 hover:text-white'}`}
                            title="Annotate Frame"
                        >
                            <PenTool className="w-5 h-5" />
                        </button>

                        <div className="w-px h-6 bg-gray-600/50 mx-2"></div>

                        <button onClick={() => skip(-5)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Rewind 5s">
                            <SkipBack className="w-6 h-6" />
                        </button>
                        <button onClick={() => skip(5)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Forward 5s">
                            <SkipForward className="w-6 h-6" />
                        </button>

                        <div className="w-px h-6 bg-gray-600/50 mx-2"></div>

                        <button onClick={toggleMute} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white">
                            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                        </button>

                        <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-300 hover:text-white" title="Fullscreen">
                            <Maximize className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Center Play Button (only when paused and controls showing and NOT annotating) */}
            {!isPlaying && showControls && !isAnnotating && !showSaveModal && (
                <button
                    onClick={togglePlay}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-wondr-pink/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-wondr-pink transition-all group-hover:scale-110 shadow-xl shadow-wondr-pink/20 z-10"
                >
                    <Play className="w-10 h-10 text-white ml-2 fill-current" />
                </button>
            )}
        </div>
    );
};

export default VideoPlayer;
