import { VideoResponse, Comment, Video, User } from './types';

// Extract token from URL query params (set once on page load)
const urlParams = new URLSearchParams(window.location.search);
const REVIEW_TOKEN = urlParams.get('token') || '';
const VIDEO_ID = urlParams.get('video') || '';

const API_BASE = '/api';

/**
 * Build query string with auth token
 */
function authParams(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({
        token: REVIEW_TOKEN,
        _t: Date.now().toString(),
        ...extra,
    });
    return params.toString();
}

/**
 * Build query string for comment endpoints (need videoId)
 */
function commentAuthParams(extra: Record<string, string> = {}): string {
    const params = new URLSearchParams({
        token: REVIEW_TOKEN,
        videoId: VIDEO_ID,
        ...extra,
    });
    return params.toString();
}

/**
 * Fetch video data and comments
 */
export async function getVideo(videoId: number): Promise<VideoResponse> {
    const response = await fetch(`${API_BASE}/video/${videoId}?${authParams()}`);
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('This review link has expired or is invalid. Please request a new link from Slack.');
        }
        throw new Error('Video not found');
    }
    return response.json();
}

/**
 * Get the authenticated video stream URL
 */
export function getStreamUrl(videoId: number): string {
    return `${API_BASE}/video/${videoId}/stream?token=${encodeURIComponent(REVIEW_TOKEN)}`;
}

/**
 * Add a comment to a video
 */
export async function addComment(
    videoId: number,
    userName: string,
    timestampSeconds: number,
    commentText: string,
    attachmentUrl?: string | null,
    attachmentFilename?: string | null
): Promise<{ success: boolean; comment: Comment }> {
    const response = await fetch(`${API_BASE}/video/${videoId}/comments?token=${encodeURIComponent(REVIEW_TOKEN)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userName,
            timestampSeconds,
            commentText,
            attachmentUrl,
            attachmentFilename,
        }),
    });
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Session expired. Please request a new review link from Slack.');
        }
        throw new Error('Failed to add comment');
    }
    return response.json();
}

/**
 * Resolve a comment
 */
export async function resolveComment(commentId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/comments/${commentId}/resolve?${commentAuthParams()}`, {
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
    const response = await fetch(`${API_BASE}/comments/${commentId}/unresolve?${commentAuthParams()}`, {
        method: 'PATCH',
    });
    if (!response.ok) {
        throw new Error('Failed to unresolve comment');
    }
    return response.json();
}

/**
 * Fetch workspace users for @mentions
 */
export async function fetchWorkspaceUsers(teamId: string): Promise<{ users: User[] }> {
    const response = await fetch(`${API_BASE}/workspaces/${teamId}/users?token=${encodeURIComponent(REVIEW_TOKEN)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch workspace users');
    }
    return response.json();
}

/**
 * Update the status of a video
 */
export async function updateVideoStatus(
    videoId: number,
    userName: string,
    status: 'pending' | 'approved' | 'rejected'
): Promise<{ success: boolean; video: Video }> {
    const response = await fetch(`${API_BASE}/video/${videoId}/status?token=${encodeURIComponent(REVIEW_TOKEN)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, status }),
    });
    if (!response.ok) {
        throw new Error('Failed to update status');
    }
    return response.json();
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/comments/${commentId}?${commentAuthParams()}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete comment');
    }
    return response.json();
}

/**
 * Check if the current session has a valid token
 */
export function hasValidToken(): boolean {
    return REVIEW_TOKEN.length > 0 && VIDEO_ID.length > 0;
}
