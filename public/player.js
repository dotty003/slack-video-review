// Video Review Player
// Frame.io-style video player with timeline comments

(function () {
    'use strict';

    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('video');

    if (!videoId) {
        document.body.innerHTML = '<div class="loading">No video specified. Use ?video=ID in URL.</div>';
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
            videoTitle.textContent = videoData.video_url ?
                decodeURIComponent(videoData.video_url.split('/').pop().split('?')[0]) :
                `Video #${videoId}`;

            // Set video source
            if (videoData.video_url) {
                videoPlayer.src = videoData.video_url;
            }

            updateCommentsStats(data.status);
            renderComments();
            renderMarkers();
        } catch (err) {
            console.error('Failed to load video:', err);
            document.body.innerHTML = `<div class="loading">Error: ${err.message}</div>`;
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
          <p>Click on the timeline to add feedback</p>
        </div>
      `;
            return;
        }

        // Sort by timestamp
        const sorted = [...comments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

        commentsList.innerHTML = sorted.map(comment => `
      <div class="comment-card ${comment.resolved ? 'resolved' : ''}" data-timestamp="${comment.timestamp_seconds}" data-id="${comment.id}">
        <div class="comment-header">
          <span class="comment-timestamp">${formatTime(comment.timestamp_seconds)}</span>
          <span class="comment-id">#${comment.id}</span>
        </div>
        <div class="comment-author">${comment.user_id}</div>
        <div class="comment-text">${escapeHtml(comment.comment_text)}</div>
        <div class="comment-actions">
          ${comment.resolved
                ? `<button class="comment-action-btn" data-action="unresolve">Reopen</button>`
                : `<button class="comment-action-btn resolve" data-action="resolve">✓ Resolve</button>`
            }
        </div>
      </div>
    `).join('');

        // Add click handlers
        commentsList.querySelectorAll('.comment-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't seek if clicking action button
                if (e.target.closest('.comment-action-btn')) return;

                const timestamp = parseInt(card.dataset.timestamp, 10);
                videoPlayer.currentTime = timestamp;
                videoPlayer.play();
            });
        });

        // Add action button handlers
        commentsList.querySelectorAll('.comment-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const card = btn.closest('.comment-card');
                const commentId = card.dataset.id;
                const action = btn.dataset.action;

                try {
                    const response = await fetch(`/api/comments/${commentId}/${action}`, {
                        method: 'PATCH',
                    });
                    if (response.ok) {
                        // Reload to refresh state
                        await loadVideoData();
                    }
                } catch (err) {
                    console.error('Failed to update comment:', err);
                }
            });
        });
    }

    // Render timeline markers
    function renderMarkers() {
        const duration = videoPlayer.duration || 1;

        timelineMarkers.innerHTML = comments.map(comment => {
            const position = (comment.timestamp_seconds / duration) * 100;
            return `
        <div class="timeline-marker ${comment.resolved ? 'resolved' : ''}" 
             style="left: ${position}%"
             data-timestamp="${comment.timestamp_seconds}"
             title="${formatTime(comment.timestamp_seconds)}: ${escapeHtml(comment.comment_text.substring(0, 50))}...">
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

        // Open add comment modal
        pendingTimestamp = timestamp;
        modalTimestamp.textContent = formatTime(timestamp);
        modalOverlay.classList.add('active');
        commentText.focus();
    }

    // Close modal
    function closeModal() {
        modalOverlay.classList.remove('active');
        commenterName.value = '';
        commentText.value = '';
    }

    // Submit comment
    async function handleSubmitComment() {
        const name = commenterName.value.trim() || 'Reviewer';
        const text = commentText.value.trim();

        if (!text) {
            commentText.focus();
            return;
        }

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
            }
        } catch (err) {
            console.error('Failed to add comment:', err);
        }
    }

    // Event Listeners
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
    });

    volumeBtn.addEventListener('click', () => {
        videoPlayer.muted = !videoPlayer.muted;
        volumeSlider.value = videoPlayer.muted ? 0 : videoPlayer.volume;
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.querySelector('.video-container').requestFullscreen();
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

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
        // Submit on Ctrl/Cmd + Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && modalOverlay.classList.contains('active')) {
            handleSubmitComment();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Space to play/pause (if not in modal)
        if (e.code === 'Space' && !modalOverlay.classList.contains('active')) {
            e.preventDefault();
            if (videoPlayer.paused) {
                videoPlayer.play();
            } else {
                videoPlayer.pause();
            }
        }
        // Arrow keys to seek
        if (e.code === 'ArrowLeft' && !modalOverlay.classList.contains('active')) {
            videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
        }
        if (e.code === 'ArrowRight' && !modalOverlay.classList.contains('active')) {
            videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
        }
    });

    // Initialize
    loadVideoData();
})();
