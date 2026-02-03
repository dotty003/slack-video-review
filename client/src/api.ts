import { VideoResponse, Comment } from './types';

const API_BASE = '/api';

/**
 * Fetch video data and comments
 */
export async function getVideo(videoId: number): Promise<VideoResponse> {
    const response = await fetch(`${API_BASE}/video/${videoId}?_t=${Date.now()}`);
    if (!response.ok) {
        throw new Error('Video not found');
    }
    return response.json();
}

/**
 * Add a comment to a video
 */
export async function addComment(
    videoId: number,
    userName: string,
    timestampSeconds: number,
    commentText: string,
    attachmentUrl?: string | null
): Promise<{ success: boolean; comment: Comment }> {
    const response = await fetch(`${API_BASE}/video/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName,
            timestampSeconds,
            commentText,
            attachmentUrl,
        }),
    });
    if (!response.ok) {
        throw new Error('Failed to add comment');
    }
    return response.json();
}

/**
 * Resolve a comment
 */
export async function resolveComment(commentId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/comments/${commentId}/resolve`, {
        method: 'PATCH',
    });
    if (!response.ok) {
        throw new Error('Failed to resolve comment');
    }
    return response.json();
}

/**
 * Unresolve a comment
 */
export async function unresolveComment(commentId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/comments/${commentId}/unresolve`, {
        method: 'PATCH',
    });
    if (!response.ok) {
        throw new Error('Failed to unresolve comment');
    }
    return response.json();
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/comments/${commentId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete comment');
    }
    return response.json();
}
