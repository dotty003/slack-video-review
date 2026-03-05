import React, { useState, useRef } from 'react';
import { Send, Check, Trash2, MessageSquare, Clock, Paperclip, X } from 'lucide-react';
import { Comment, User } from '../types';
import { formatTime, formatRelativeTime } from '../utils/formatters';

interface CommentSidebarProps {
    comments: Comment[];
    currentTime: number;
    onSeek: (time: number, annotationUrl?: string | null) => void;
    onAddComment: (text: string, attachmentUrl?: string, attachmentFilename?: string) => void;
    onResolveComment: (id: number) => void;
    onDeleteComment: (id: number) => void;
    currentUser: User;
    status: { open: number; resolved: number; total: number };
}

const CommentSidebar: React.FC<CommentSidebarProps> = ({
    comments,
    currentTime,
    onSeek,
    onAddComment,
    onResolveComment,
    onDeleteComment,
    currentUser,
    status,
}) => {
    const [newCommentText, setNewCommentText] = useState('');
    const [attachment, setAttachment] = useState<string | null>(null);
    const [attachmentFilename, setAttachmentFilename] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredComments = comments
        .filter((c) => {
            if (filter === 'open') return c.resolved === 0;
            if (filter === 'resolved') return c.resolved === 1;
            return true;
        })
        .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newCommentText.trim() || attachment) {
            onAddComment(newCommentText, attachment || undefined, attachmentFilename || undefined);
            setNewCommentText('');
            setAttachment(null);
            setAttachmentFilename(null);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachmentFilename(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAttachment(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getAvatarUrl = (userId: string) => {
        if (userId === currentUser.id) {
            return currentUser.avatarUrl;
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(userId)}&background=9100BD&color=fff&bold=true`;
    };

    const activeCommentId = comments.reduce<number | null>((prev, curr) => {
        if (Math.abs(curr.timestamp_seconds - currentTime) < 2) {
            return curr.id;
        }
        return prev;
    }, null);

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-full md:w-96 shadow-xl z-30 relative">
            {/* Sidebar Header */}
            <div className="p-5 border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-slate-800">Comments</h2>
                        <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">{status.total}</span>
                    </div>
                    {status.resolved > 0 && (
                        <div className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md border border-green-100">
                            <Check className="w-3 h-3" />
                            {status.resolved} Resolved
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 rounded-lg">
                    {(['all', 'open', 'resolved'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filter === f
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {filteredComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3 opacity-60">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-sm font-medium">No comments found</p>
                    </div>
                ) : (
                    filteredComments.map((comment) => {
                        const isActive = activeCommentId === comment.id;

                        return (
                            <div
                                key={comment.id}
                                className={`group relative bg-white rounded-xl p-4 border transition-all duration-200 hover:shadow-md ${isActive
                                        ? 'border-[#9100BD]/30 shadow-md ring-1 ring-[#9100BD]/10'
                                        : 'border-gray-100 shadow-sm hover:border-gray-200'
                                    } ${comment.resolved ? 'opacity-75 bg-gray-50' : ''}`}
                            >
                                {/* Active Indicator Bar */}
                                {isActive && (
                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#9100BD] rounded-r-full"></div>
                                )}

                                <div className="flex items-start justify-between mb-2 pl-1">
                                    <div className="flex items-center gap-2.5">
                                        <img
                                            src={getAvatarUrl(comment.user_id)}
                                            alt={comment.user_id}
                                            className="w-6 h-6 rounded-full object-cover"
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800">{comment.user_id}</span>
                                                <span className="text-[10px] text-slate-400 font-normal">
                                                    {formatRelativeTime(comment.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const isAnnotation = comment.attachment_filename?.startsWith('annotation-');
                                                onSeek(comment.timestamp_seconds, isAnnotation ? comment.attachment_url : null);
                                            }}
                                            className="flex items-center gap-1 text-[10px] font-mono font-medium text-[#9100BD] bg-[#9100BD]/5 px-1.5 py-0.5 rounded border border-[#9100BD]/10 cursor-pointer hover:bg-[#9100BD]/10 transition-colors"
                                        >
                                            <Clock className="w-3 h-3" />
                                            {formatTime(comment.timestamp_seconds)}
                                        </button>
                                        {comment.resolved === 1 && (
                                            <div className="text-green-500">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                {comment.comment_text && (
                                    <p className={`text-sm leading-relaxed pl-1 ${comment.resolved ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                        {comment.comment_text}
                                    </p>
                                )}

                                {/* Attachment */}
                                {comment.attachment_url && (
                                    <div className="mt-2 mb-1 rounded-lg overflow-hidden border border-gray-100 relative group/attachment">
                                        <img
                                            src={comment.attachment_url}
                                            alt="Attachment"
                                            className="w-full h-auto object-cover max-h-48"
                                        />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const link = document.createElement('a');
                                                link.href = comment.attachment_url!;
                                                link.download = comment.attachment_filename || `attachment-${comment.id}.png`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                            }}
                                            className="absolute bottom-2 right-2 px-3 py-1.5 bg-[#9100BD] text-white text-xs font-bold rounded-full shadow-lg opacity-0 group-hover/attachment:opacity-100 hover:bg-[#7a00a0] transition-all flex items-center gap-1"
                                            title="Download attachment"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                                            </svg>
                                            Download
                                        </button>
                                    </div>
                                )}

                                {/* Actions - show on hover */}
                                <div className="flex items-center justify-end mt-3 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onDeleteComment(comment.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                                        title="Delete comment"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onResolveComment(comment.id)}
                                        className="text-xs text-slate-400 hover:text-[#9100BD] font-medium flex items-center gap-1 transition-colors"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        {comment.resolved ? 'Unresolve' : 'Resolve'}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200 z-20">
                {/* Attachment Preview */}
                {attachment && (
                    <div className="mb-3 relative inline-block">
                        <img src={attachment} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-200 object-cover" />
                        <button
                            onClick={() => {
                                setAttachment(null);
                                setAttachmentFilename(null);
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-[#9100BD]/20 focus-within:border-[#9100BD]/50 transition-all">
                        <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-mono font-medium text-[#9100BD] bg-[#9100BD]/10 px-1.5 py-0.5 rounded">
                                {formatTime(currentTime)}
                            </span>
                            <span className="text-xs text-gray-400">Commenting on current frame</span>
                        </div>
                        <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Leave a comment..."
                            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-slate-800 placeholder:text-slate-400 p-1"
                        />
                        <div className="flex items-center justify-between mt-1 px-1">
                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-1 rounded transition-colors ${attachment ? 'text-[#9100BD] bg-[#9100BD]/10' : 'text-slate-400 hover:text-slate-600 hover:bg-gray-200'
                                        }`}
                                    title="Attach image"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={!newCommentText.trim() && !attachment}
                                className="bg-[#9100BD] hover:bg-[#7a00a0] text-white p-2 rounded-lg transition-colors shadow-md shadow-[#9100BD]/20 flex items-center gap-2 text-xs font-semibold pr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-3.5 h-3.5" />
                                Send
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CommentSidebar;
