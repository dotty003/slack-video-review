import React, { useState, useRef } from 'react';
import { Send, CheckCircle, Circle, Trash2, MessageSquare, Clock, Image as ImageIcon, X } from 'lucide-react';
import { Comment, User } from '../types';
import { formatTime, formatRelativeTime } from '../utils/formatters';

interface CommentSidebarProps {
    comments: Comment[];
    currentTime: number;
    onSeek: (time: number) => void;
    onAddComment: (text: string, attachmentUrl?: string) => void;
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
            onAddComment(newCommentText, attachment || undefined);
            setNewCommentText('');
            setAttachment(null);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
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
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(userId)}&background=6366f1&color=fff&bold=true`;
    };

    const activeCommentId = comments.reduce<number | null>((prev, curr) => {
        if (Math.abs(curr.timestamp_seconds - currentTime) < 2) {
            return curr.id;
        }
        return prev;
    }, null);

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-full md:w-96 shadow-xl z-30">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex flex-col gap-4 bg-white z-10">
                <div className="flex justify-between items-center">
                    <h2 className="text-gray-900 font-bold text-xl flex items-center gap-2">
                        Comments <span className="text-wondr-pink text-base font-medium">({status.total})</span>
                    </h2>
                    <div className="text-xs text-gray-500">
                        <span className="text-green-600">{status.resolved}</span> / {status.total} resolved
                    </div>
                </div>

                <div className="flex p-1 bg-gray-100 rounded-full">
                    {(['all', 'open', 'resolved'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-all capitalize ${filter === f
                                    ? 'bg-white text-wondr-pink shadow-sm ring-1 ring-black/5'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-wondr-bg/50">
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
                                className={`group relative flex flex-col p-4 rounded-wondr border transition-all duration-200 ${isActive
                                        ? 'bg-white border-wondr-pink ring-2 ring-wondr-pink/20 shadow-md'
                                        : 'bg-white border-gray-200 hover:border-wondr-lavender hover:shadow-sm'
                                    } ${comment.resolved ? 'opacity-60 bg-gray-50' : ''}`}
                            >
                                {/* Header Line */}
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2.5">
                                        <img
                                            src={getAvatarUrl(comment.user_id)}
                                            alt={comment.user_id}
                                            className="w-8 h-8 rounded-full ring-2 ring-gray-100"
                                        />
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-sm font-bold text-gray-900">{comment.user_id}</span>
                                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                                                {formatRelativeTime(comment.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onSeek(comment.timestamp_seconds)}
                                        className="flex items-center gap-1 text-wondr-blue hover:text-wondr-pink text-xs font-bold bg-wondr-lavender/30 hover:bg-wondr-lavender/50 px-2 py-1 rounded-full cursor-pointer transition-colors"
                                    >
                                        <Clock className="w-3 h-3" />
                                        {formatTime(comment.timestamp_seconds)}
                                    </button>
                                </div>

                                {/* Content */}
                                {comment.comment_text && (
                                    <p className={`text-sm mt-1 mb-3 leading-relaxed ${comment.resolved ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                        {comment.comment_text}
                                    </p>
                                )}

                                {/* Attachment */}
                                {comment.attachment_url && (
                                    <div className="mb-3 rounded-lg overflow-hidden border border-gray-100">
                                        <img
                                            src={comment.attachment_url}
                                            alt="Attachment"
                                            className="w-full h-auto object-cover max-h-48 cursor-pointer hover:scale-105 transition-transform"
                                            onClick={() => window.open(comment.attachment_url!, '_blank')}
                                        />
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center justify-end gap-2 mt-auto pt-2 border-t border-gray-100/50">
                                    <button
                                        onClick={() => onDeleteComment(comment.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete comment"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => onResolveComment(comment.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${comment.resolved
                                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                    >
                                        {comment.resolved ? (
                                            <>
                                                <CheckCircle className="w-3.5 h-3.5" /> Resolved
                                            </>
                                        ) : (
                                            <>
                                                <Circle className="w-3.5 h-3.5" /> Mark Resolved
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-5 bg-white border-t border-gray-200 shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.05)]">
                {/* Attachment Preview */}
                {attachment && (
                    <div className="mb-3 relative inline-block">
                        <img src={attachment} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-200 object-cover" />
                        <button
                            onClick={() => setAttachment(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Leave Feedback</span>
                        <span className="text-xs text-wondr-pink font-mono bg-wondr-lavender/20 px-2 py-0.5 rounded">@{formatTime(currentTime)}</span>
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            placeholder="Type your thoughts..."
                            className="w-full bg-gray-50 text-gray-900 rounded-xl pl-12 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-wondr-pink/50 placeholder-gray-400 border border-gray-200 transition-all"
                        />

                        {/* Image Upload Button */}
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
                            className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${attachment ? 'text-wondr-pink bg-wondr-pink/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                            title="Attach image"
                        >
                            <ImageIcon className="w-5 h-5" />
                        </button>

                        <button
                            type="submit"
                            disabled={!newCommentText.trim() && !attachment}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-wondr-pink rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-sm"
                        >
                            <Send className="w-5 h-5 ml-0.5 mt-0.5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CommentSidebar;
