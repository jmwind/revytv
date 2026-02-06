// Settings page - Playlist management

const DEFAULT_PLAYLIST = [
    { id: 'spJ5dqXi6ro', title: 'Big mountain' }    
];

let playlist = [];
let dragIndex = null;
let currentTvToken = null;

function extractVideoId(input) {
    input = input.trim();
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function fetchVideoTitle(videoId) {
    try {
        const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.title || null;
    } catch {
        return null;
    }
}

async function loadPlaylist() {
    try {
        const token = await getAuthToken();
        const res = await fetch('/api/user', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Failed to load');
        const config = await res.json();
        playlist = config.playlist || [...DEFAULT_PLAYLIST];
        if (config.tvToken) {
            currentTvToken = config.tvToken;
        }
    } catch (e) {
        console.error('Failed to load playlist:', e.message);
        playlist = [...DEFAULT_PLAYLIST];
    }
    renderPlaylist();
}

async function savePlaylist() {
    try {
        const token = await getAuthToken();
        await fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playlist })
        });
    } catch (e) {
        console.error('Failed to save playlist:', e.message);
    }
}

function renderPlaylist() {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    if (playlist.length === 0) {
        container.innerHTML = '<div class="playlist-empty">No videos in playlist</div>';
        return;
    }

    container.innerHTML = playlist.map((video, index) => `
        <div class="playlist-item" draggable="true" data-index="${index}">
            <span class="playlist-drag-handle" title="Drag to reorder">&#x2630;</span>
            <span class="playlist-item-number">${index + 1}</span>
            <span class="playlist-item-title">${video.title}</span>
            <span class="playlist-item-id">${video.id}</span>
            <button class="playlist-item-remove" data-index="${index}" title="Remove">x</button>
        </div>
    `).join('');

    container.querySelectorAll('.playlist-item-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index, 10);
            removeVideo(index);
        });
    });

    setupDragAndDrop(container);
}

function setupDragAndDrop(container) {
    const items = container.querySelectorAll('.playlist-item');
    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            dragIndex = parseInt(item.dataset.index, 10);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            container.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('drag-over'));
            dragIndex = null;
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            container.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('drag-over'));
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const dropIndex = parseInt(item.dataset.index, 10);
            if (dragIndex === null || dragIndex === dropIndex) return;
            const [moved] = playlist.splice(dragIndex, 1);
            playlist.splice(dropIndex, 0, moved);
            renderPlaylist();
            savePlaylist();
        });
    });
}

async function addVideo() {
    const urlInput = document.getElementById('video-url-input');
    const titleInput = document.getElementById('video-title-input');
    const addBtn = document.getElementById('add-video-btn');
    const url = urlInput.value.trim();
    if (!url) return;

    const videoId = extractVideoId(url);
    if (!videoId) {
        urlInput.classList.add('input-error');
        setTimeout(() => urlInput.classList.remove('input-error'), 1500);
        return;
    }

    if (playlist.some(v => v.id === videoId)) {
        urlInput.classList.add('input-error');
        setTimeout(() => urlInput.classList.remove('input-error'), 1500);
        return;
    }

    let title = titleInput.value.trim();
    if (!title) {
        addBtn.disabled = true;
        addBtn.textContent = '...';
        title = await fetchVideoTitle(videoId) || videoId;
        addBtn.disabled = false;
        addBtn.textContent = 'Add';
    }

    playlist.push({ id: videoId, title });
    urlInput.value = '';
    titleInput.value = '';

    renderPlaylist();
    await savePlaylist();
}

async function removeVideo(index) {
    playlist.splice(index, 1);
    renderPlaylist();
    await savePlaylist();
}

async function resetPlaylist() {
    playlist = [...DEFAULT_PLAYLIST];
    renderPlaylist();
    await savePlaylist();
}

function getTvUrl(token) {
    const base = window.location.origin;
    return `${base}/tv?token=${token}`;
}

function renderTvToken() {
    const urlEl = document.getElementById('tv-token-url');
    const copyBtn = document.getElementById('tv-token-copy');
    const genBtn = document.getElementById('generate-token-btn');

    if (currentTvToken) {
        urlEl.textContent = getTvUrl(currentTvToken);
        copyBtn.style.display = '';
        genBtn.textContent = 'Regenerate';
    } else {
        urlEl.textContent = 'No link generated yet';
        copyBtn.style.display = 'none';
        genBtn.textContent = 'Generate Link';
    }
}

async function generateTvToken() {
    const genBtn = document.getElementById('generate-token-btn');
    genBtn.disabled = true;
    genBtn.textContent = '...';
    try {
        const token = await getAuthToken();
        const res = await fetch('/api/user', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('Failed to generate');
        const data = await res.json();
        currentTvToken = data.tvToken;
    } catch (e) {
        console.error('Failed to generate TV token:', e.message);
    }
    genBtn.disabled = false;
    renderTvToken();
}

function copyTvToken() {
    if (!currentTvToken) return;
    navigator.clipboard.writeText(getTvUrl(currentTvToken));
    const copyBtn = document.getElementById('tv-token-copy');
    copyBtn.textContent = 'Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
}

async function initSettings() {
    const isAuthed = await requireAuth('/settings.html');
    if (!isAuthed) return;

    await loadPlaylist();

    document.getElementById('playlist-form').style.display = '';
    document.getElementById('playlist-actions').style.display = '';
    document.getElementById('add-video-btn').addEventListener('click', addVideo);
    document.getElementById('video-url-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addVideo();
    });
    document.getElementById('video-title-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addVideo();
    });
    document.getElementById('reset-playlist-btn').addEventListener('click', resetPlaylist);

    // TV token section
    document.getElementById('tv-link-section').style.display = '';
    renderTvToken();
    document.getElementById('generate-token-btn').addEventListener('click', generateTvToken);
    document.getElementById('tv-token-copy').addEventListener('click', copyTvToken);
}

clerkReady.then(initSettings);
