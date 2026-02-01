// Video Review Player
// Premium Frame.io-style video player with timeline comments

(function () {
    'use strict';

    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('video');

    if (!videoId) {
        document.body.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <span>No video specified. Use ?video=ID in URL.</span>
      </div>
    `;
        return;
    }

    // DOM Elements
    const videoPlayer = document.getElementById('videoPlayer');
    const videoTitle = document.getElementById('videoTitle');
    const timeline = document.getElementById('timeline');
    const timelineProgress = document.getElementById('timelineProgress');
    const timelineMarkers = document.getElementById('timelineMarkers');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');
    const commentsList = document.getElementById('commentsList');
    const commentsStats = document.getElementById('commentsStats');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTimestamp = document.getElementById('modalTimestamp');
    const commenterName = document.getElementById('commenterName');
    const commentText = document.getElementById('commentText');
    const modalClose = document.getElementById('modalClose');
    const cancelComment = document.getElementById('cancelComment');
    const submitComment = document.getElementById('submitComment');

    // Video control elements
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    // State
    let videoData = null;
    let comments = [];
    let pendingTimestamp = 0;

    // Format seconds to MM:SS or HH:MM:SS
    function formatTime(seconds) {
        seconds = Math.floor(seconds);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    // Format relative time (e.g., "2 hours ago")
    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    // Get initials from name/ID
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.replace(/[<>@]/g, '').split(/[\s_-]+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }

    // Generate consistent color from name
    function getAvatarColor(name) {
        const colors = [
            'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
            'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // Fetch video data and comments
    async function loadVideoData() {
        try {
            const response = await fetch(`/api/video/${videoId}`);
            if (!response.ok) {
                throw new Error('Video not found');
            }
            const data = await response.json();
            videoData = data.video;
            comments = data.comments || [];

            // Update UI
            if (videoData.video_url) {
                // Extract filename from URL
                const urlPath = videoData.video_url.split('/').pop().split('?')[0];
                videoTitle.textContent = decodeURIComponent(urlPath) || `Video #${videoId}`;
                videoPlayer.src = videoData.video_url;
            } else {
                videoTitle.textContent = `Video #${videoId}`;
            }

            updateCommentsStats(data.status);
            renderComments();
            renderMarkers();
        } catch (err) {
            console.error('Failed to load video:', err);
            document.body.innerHTML = `
        <div class="loading">
          <div style="font-size: 48px; margin-bottom: 16px;">😕</div>
          <span>Error: ${err.message}</span>
        </div>
      `;
        }
    }

    // Update comments stats display
    function updateCommentsStats(status) {
        commentsStats.innerHTML = `
      <span class="stat open">${status.open} open</span>
      <span class="stat resolved">${status.resolved} resolved</span>
    `;
    }

    // Render comments list
    function renderComments() {
        if (comments.length === 0) {
            commentsList.innerHTML = `
        <div class="empty-comments">
          <div class="empty-comments-icon">💬</div>
          <p>No comments yet</p>
          <p>Click on the timeline to add your feedback</p>
        </div>
      `;
            return;
        }

        // Sort by timestamp
        const sorted = [...comments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

        commentsList.innerHTML = sorted.map(comment => {
            const initials = getInitials(comment.user_id);
            const avatarColor = getAvatarColor(comment.user_id);
            const timeAgo = formatRelativeTime(comment.created_at);
            const displayName = comment.user_id.replace(/[<>@]/g, '') || 'Reviewer';

            return `
        <div class="comment-card ${comment.resolved ? 'resolved' : ''}" 
             data-timestamp="${comment.timestamp_seconds}" 
             data-id="${comment.id}">
          <div class="comment-header">
            <span class="comment-timestamp">${formatTime(comment.timestamp_seconds)}</span>
            <span class="comment-meta">
              <span class="comment-id">#${comment.id}</span>
            </span>
          </div>
          <div class="comment-author">
            <div class="comment-avatar" style="background: ${avatarColor}">${initials}</div>
            <div class="comment-author-info">
              <span class="comment-author-name">${escapeHtml(displayName)}</span>
              <span class="comment-time-ago">${timeAgo}</span>
            </div>
          </div>
          <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
          <div class="comment-actions">
            ${comment.resolved
                    ? `<button class="comment-action-btn" data-action="unresolve">↩ Reopen</button>`
                    : `<button class="comment-action-btn resolve" data-action="resolve">✓ Resolve</button>`
                }
          </div>
        </div>
      `;
        }).join('');

        // Add click handlers
        commentsList.querySelectorAll('.comment-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't seek if clicking action button
                if (e.target.closest('.comment-action-btn')) return;

                const timestamp = parseInt(card.dataset.timestamp, 10);
                videoPlayer.currentTime = timestamp;
                videoPlayer.play();

                // Highlight the card briefly
                card.style.boxShadow = '0 0 0 2px var(--accent)';
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 1000);
            });
        });

        // Add action button handlers
        commentsList.querySelectorAll('.comment-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const card = btn.closest('.comment-card');
                const commentId = card.dataset.id;
                const action = btn.dataset.action;

                // Add loading state
                btn.textContent = '...';
                btn.disabled = true;

                try {
                    const response = await fetch(`/api/comments/${commentId}/${action}`, {
                        method: 'PATCH',
                    });
                    if (response.ok) {
                        await loadVideoData();
                    }
                } catch (err) {
                    console.error('Failed to update comment:', err);
                    btn.textContent = action === 'resolve' ? '✓ Resolve' : '↩ Reopen';
                    btn.disabled = false;
                }
            });
        });
    }

    // Render timeline markers
    function renderMarkers() {
        const duration = videoPlayer.duration || 1;

        timelineMarkers.innerHTML = comments.map(comment => {
            const position = (comment.timestamp_seconds / duration) * 100;
            const preview = comment.comment_text.substring(0, 40) + (comment.comment_text.length > 40 ? '...' : '');
            return `
        <div class="timeline-marker ${comment.resolved ? 'resolved' : ''}" 
             style="left: ${position}%"
             data-timestamp="${comment.timestamp_seconds}"
             title="${formatTime(comment.timestamp_seconds)}: ${escapeHtml(preview)}">
        </div>
      `;
        }).join('');

        // Add click handlers to markers
        timelineMarkers.querySelectorAll('.timeline-marker').forEach(marker => {
            marker.addEventListener('click', (e) => {
                e.stopPropagation();
                const timestamp = parseInt(marker.dataset.timestamp, 10);
                videoPlayer.currentTime = timestamp;
                videoPlayer.play();
            });
        });
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update video progress
    function updateProgress() {
        if (!videoPlayer.duration) return;

        const progress = (videoPlayer.currentTime / videoPlayer.duration) * 100;
        timelineProgress.style.width = `${progress}%`;
        currentTimeEl.textContent = formatTime(videoPlayer.currentTime);
    }

    // Timeline click handler
    function handleTimelineClick(e) {
        const rect = timeline.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = clickX / rect.width;
        const timestamp = Math.floor(percentage * videoPlayer.duration);

        // Pause video and open modal
        videoPlayer.pause();
        pendingTimestamp = timestamp;
        modalTimestamp.textContent = formatTime(timestamp);
        modalOverlay.classList.add('active');

        // Focus on name or text input
        if (!commenterName.value) {
            commenterName.focus();
        } else {
            commentText.focus();
        }
    }

    // Close modal
    function closeModal() {
        modalOverlay.classList.remove('active');
        commentText.value = '';
    }

    // Submit comment
    async function handleSubmitComment() {
        const name = commenterName.value.trim() || 'Reviewer';
        const text = commentText.value.trim();

        if (!text) {
            commentText.focus();
            commentText.style.borderColor = 'var(--warning)';
            setTimeout(() => {
                commentText.style.borderColor = '';
            }, 2000);
            return;
        }

        // Add loading state
        submitComment.textContent = 'Adding...';
        submitComment.disabled = true;

        try {
            const response = await fetch(`/api/video/${videoId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userName: name,
                    timestampSeconds: pendingTimestamp,
                    commentText: text,
                }),
            });

            if (response.ok) {
                closeModal();
                await loadVideoData();
                // Resume video
                videoPlayer.play();
            }
        } catch (err) {
            console.error('Failed to add comment:', err);
        } finally {
            submitComment.textContent = 'Add Comment';
            submitComment.disabled = false;
        }
    }

    // ================================================
    // Event Listeners
    // ================================================

    videoPlayer.addEventListener('timeupdate', updateProgress);
    videoPlayer.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(videoPlayer.duration);
        renderMarkers();
    });

    timeline.addEventListener('click', handleTimelineClick);
    modalClose.addEventListener('click', closeModal);
    cancelComment.addEventListener('click', closeModal);
    submitComment.addEventListener('click', handleSubmitComment);

    // Play/Pause button
    playPauseBtn.addEventListener('click', () => {
        if (videoPlayer.paused) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    });

    // Update play/pause icon based on video state
    videoPlayer.addEventListener('play', () => {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    });

    videoPlayer.addEventListener('pause', () => {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
    });

    // Volume control
    volumeSlider.addEventListener('input', (e) => {
        videoPlayer.volume = e.target.value;
        updateVolumeIcon();
    });

    volumeBtn.addEventListener('click', () => {
        videoPlayer.muted = !videoPlayer.muted;
        volumeSlider.value = videoPlayer.muted ? 0 : videoPlayer.volume;
        updateVolumeIcon();
    });

    function updateVolumeIcon() {
        const volumeOn = volumeBtn.querySelector('.volume-on');
        const volumeOff = volumeBtn.querySelector('.volume-off');
        if (videoPlayer.muted || videoPlayer.volume === 0) {
            volumeOn.style.display = 'none';
            volumeOff.style.display = 'block';
        } else {
            volumeOn.style.display = 'block';
            volumeOff.style.display = 'none';
        }
    }

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        const container = document.querySelector('.video-container');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    });

    // Click on video to play/pause
    videoPlayer.addEventListener('click', () => {
        if (videoPlayer.paused) {
            videoPlayer.play();
        } else {
            videoPlayer.pause();
        }
    });

    // Close modal on escape or click outside
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
        // Submit on Ctrl/Cmd + Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && modalOverlay.classList.contains('active')) {
            handleSubmitComment();
        }
    });

    // Keyboard shortcuts (when not in modal)
    document.addEventListener('keydown', (e) => {
        if (modalOverlay.classList.contains('active')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                if (videoPlayer.paused) {
                    videoPlayer.play();
                } else {
                    videoPlayer.pause();
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
                break;
            case 'ArrowRight':
                e.preventDefault();
                videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
                break;
            case 'KeyF':
                e.preventDefault();
                fullscreenBtn.click();
                break;
            case 'KeyM':
                e.preventDefault();
                volumeBtn.click();
                break;
        }
    });

    // ================================================
    // Initialize
    // ================================================
    loadVideoData();
})();
