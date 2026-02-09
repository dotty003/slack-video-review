// Types matching backend data model

export interface User {
    id: string;
    name: string;
    avatarUrl: string;
}

export interface Comment {
    id: number;
    video_id: number;
    user_id: string;
    timestamp_seconds: number;
    comment_text: string;
    attachment_url?: string | null;
    attachment_filename?: string | null;
    resolved: number;
    created_at: string;
}

export interface Video {
    id: number;
    channel_id: string;
    message_ts: string;
    thread_ts?: string;
    uploader_id: string;
    video_url: string;
    video_name?: string;
    video_type?: string;
    created_at: string;
}

export interface VideoResponse {
    video: Video;
    comments: Comment[];
    status: {
        open: number;
        resolved: number;
        total: number;
    };
}
