// src/public/js/library.js
// 라이브러리 탭 전용 초기화 및 렌더링

window.initLibraryPage = async function() {
    const main = document.querySelector('.main-content');
    if (!main) return;

    const profile = JSON.parse(localStorage.getItem('profile'));
    if (!profile || !profile.id) {
        main.innerHTML = `<div style="padding:20px; color:#ccc;">로그인이 필요합니다.</div>`;
        return;
    }

    const path = location.pathname;
    if (path.endsWith('/likes.html')) {
        await renderLikesPage(profile.id);
    } else if (path.endsWith('/playlists.html')) {
        await renderPlaylistsPage(profile.id);
    } else if (path.endsWith('/history.html')) {
        await renderHistoryPage(profile.id);
    } else if (path.endsWith('/albums.html')) {
        await renderAlbumsPage(profile.id);
    } else if (path.endsWith('/following.html')) {
        await renderFollowingPage(profile.id);
    } else {
        await renderOverview(profile.id);
    }
};

function renderPlaceholder(containerId, msg) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div style="padding:20px; color:#888;">${msg}</div>`;
}

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed');
    return res.json();
}

function renderTrackRow(containerId, tracks) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!tracks || !tracks.length) {
        container.innerHTML = `<div style="padding:20px; color:#888;">표시할 항목이 없습니다.</div>`;
        return;
    }

    tracks.forEach(track => {
        const card = document.createElement('a');
        card.className = 'album-link';
        card.href = '/html/index.html';
        card.onclick = (e) => {
            e.preventDefault();
            window.isPlaylistMode = false;
            fetchTracks(true).then(() => {
                const idx = window.GlobalTracks.findIndex(t => t.id === track.id);
                if (window.globalPlayer && idx !== -1) {
                    window.globalPlayer.tracks = window.GlobalTracks;
                    window.globalPlayer.setTrack(idx);
                }
                if (typeof navigate === 'function') navigate('/html/index.html');
                else window.location.href = '/html/index.html';
            });
        };

        card.innerHTML = `
            <div class="album-cover-container">
                <img src="${track.albumCover}" alt="${track.title}" class="album-cover-img" onerror="this.src='../assets/albumart.jpg'"/>
                <div class="album-overlay"><span class="play-btn">▶</span></div>
            </div>
            <div class="album-caption">${track.title}</div>
            <div class="album-artist">${track.artist}</div>
        `;
        container.appendChild(card);
    });
}

function renderPlaylistRow(containerId, playlists, ownerName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!playlists || !playlists.length) {
        container.innerHTML = `<div style="padding:20px; color:#888;">플레이리스트가 없습니다.</div>`;
        return;
    }

    playlists.forEach(pl => {
        const card = document.createElement('a');
        card.className = 'album-link';
        card.href = `/html/playlist.html?id=${pl.id}`;
        card.innerHTML = `
            <div class="album-cover-container">
                <img src="${pl.cover || '../assets/albumart.jpg'}" alt="${pl.title}" class="album-cover-img" onerror="this.src='../assets/albumart.jpg'"/>
            </div>
            <div class="album-caption">${pl.title}</div>
            <div class="album-artist">${ownerName ? 'By ' + ownerName : ''}</div>
        `;
        container.appendChild(card);
    });
}

async function renderLikesPage(userId) {
    try {
        const likes = await fetchJson(`http://localhost:3000/api/users/${userId}/likes`);
        renderTrackRow('library-likes-list', likes);
    } catch (e) {
        renderPlaceholder('library-likes-list', '좋아요 목록을 불러오지 못했습니다.');
        console.error(e);
    }
}

async function renderPlaylistsPage(userId) {
    try {
        const playlists = await fetchJson(`http://localhost:3000/api/users/${userId}/playlists`);
        const profile = JSON.parse(localStorage.getItem('profile'));
        renderPlaylistRow('library-playlists-list', playlists, profile ? profile.name : '');
    } catch (e) {
        renderPlaceholder('library-playlists-list', '플레이리스트를 불러오지 못했습니다.');
        console.error(e);
    }
}

async function renderHistoryPage(userId) {
    try {
        const history = await fetchJson(`http://localhost:3000/api/users/${userId}/recent-plays`);
        renderTrackRow('library-history-list', history);
    } catch (e) {
        renderPlaceholder('library-history-list', '재생 기록을 불러오지 못했습니다.');
        console.error(e);
    }
}

async function renderOverview(userId) {
    const profile = JSON.parse(localStorage.getItem('profile'));
    try {
        const [recent, likes, playlists, albums, following] = await Promise.all([
            fetchJson(`http://localhost:3000/api/users/${userId}/recent-plays`),
            fetchJson(`http://localhost:3000/api/users/${userId}/likes`),
            fetchJson(`http://localhost:3000/api/users/${userId}/playlists`),
            fetchJson(`http://localhost:3000/api/users/${userId}/albums`),
            fetchJson(`http://localhost:3000/api/users/${userId}/following`)
        ]);
        renderTrackRow('library-overview-recent', recent);
        renderTrackRow('library-overview-likes', likes.slice(0, 10));
        renderPlaylistRow('library-overview-playlists', playlists, profile ? profile.name : '');
        renderAlbumRow('library-overview-albums', albums);
        renderFollowingRow('library-overview-following', following);
    } catch (e) {
        console.error(e);
        renderPlaceholder('library-overview-recent', '최근 재생을 불러오지 못했습니다.');
        renderPlaceholder('library-overview-likes', '좋아요를 불러오지 못했습니다.');
        renderPlaceholder('library-overview-playlists', '플레이리스트를 불러오지 못했습니다.');
        renderPlaceholder('library-overview-albums', '앨범을 불러오지 못했습니다.');
        renderPlaceholder('library-overview-following', '팔로잉을 불러오지 못했습니다.');
    }
}

function renderAlbumRow(containerId, albums) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!albums || !albums.length) {
        container.innerHTML = `<div style="padding:20px; color:#888;">앨범이 없습니다.</div>`;
        return;
    }

    albums.forEach(al => {
        const card = document.createElement('a');
        card.className = 'album-link';
        card.href = '/html/index.html';
        card.onclick = (e) => {
            e.preventDefault();
            window.isPlaylistMode = false;
            fetchTracks(true).then(() => {
                const idx = window.GlobalTracks.findIndex(t => t.id === al.sampleTrackId);
                if (window.globalPlayer && idx !== -1) {
                    window.globalPlayer.tracks = window.GlobalTracks;
                    window.globalPlayer.setTrack(idx);
                }
                if (typeof navigate === 'function') navigate('/html/index.html');
                else window.location.href = '/html/index.html';
            });
        };
        card.innerHTML = `
            <div class="album-cover-container">
                <img src="${al.albumCover}" alt="${al.album}" class="album-cover-img" onerror="this.src='../assets/albumart.jpg'"/>
            </div>
            <div class="album-caption">${al.album}</div>
            <div class="album-artist">${al.artist}</div>
        `;
        container.appendChild(card);
    });
}

function renderFollowingRow(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!list || !list.length) {
        container.innerHTML = `<div style="padding:20px; color:#888;">팔로우한 아티스트가 없습니다.</div>`;
    }

    const grid = document.createElement('div');
    grid.style.display = 'flex';
    grid.style.gap = '16px';
    grid.style.flexWrap = 'wrap';

    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <div class="user-avatar">
                <img src="${item.albumCover}" alt="${item.artist}" onerror="this.src='../assets/default_profile.jpg'"/>
            </div>
            <div class="user-name">${item.artist}</div>
            <button class="sign-in-btn" data-artist="${item.artist}">Unfollow</button>
        `;

        card.querySelector('.user-avatar').onclick = () => showArtistTracks(item.artist);

        const btn = card.querySelector('button');
        btn.onclick = async (e) => {
            e.preventDefault();
            const profile = JSON.parse(localStorage.getItem('profile'));
            if (!profile) return alert('로그인이 필요합니다.');
            try {
                await fetch('http://localhost:3000/api/follow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: profile.id, artist: item.artist })
                });
                renderFollowingPage(profile.id);
            } catch (err) { console.error(err); }
        };
        grid.appendChild(card);
    });
    container.appendChild(grid);

    renderFollowingSuggestions(container, list.map(i => i.artist));
}

async function renderFollowingSuggestions(container, excludeList = []) {
    try {
        const res = await fetch('http://localhost:3000/api/artists/popular?limit=10');
        if (!res.ok) throw new Error('failed to load suggestions');
        const data = await res.json();
        if (!data || !data.length) return;
        const filtered = data.filter(a => !excludeList.includes(a.artist));
        if (!filtered.length) return;

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '16px';
        wrapper.style.marginTop = '10px';
        const title = document.createElement('div');
        title.style.color = '#aaa';
        title.style.margin = '10px 0 6px';
        title.textContent = '추천 아티스트';
        container.appendChild(title);

        filtered.forEach(artist => {
            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `
                <div class="user-avatar">
                    <img src="${artist.albumCover}" alt="${artist.artist}" onerror="this.src='../assets/default_profile.jpg'"/>
                </div>
                <div class="user-name">${artist.artist}</div>
                <button class="sign-in-btn" data-artist="${artist.artist}">Follow</button>
            `;
            card.querySelector('.user-avatar').onclick = () => showArtistTracks(artist.artist);
            const btn = card.querySelector('button');
            btn.onclick = async (e) => {
                e.preventDefault();
                const profile = JSON.parse(localStorage.getItem('profile'));
                if (!profile) return alert('로그인이 필요합니다.');
                try {
                    await fetch('http://localhost:3000/api/follow', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: profile.id, artist: artist.artist })
                    });
                    renderFollowingPage(profile.id);
                } catch (err) { console.error(err); }
            };
            wrapper.appendChild(card);
        });
        container.appendChild(wrapper);
    } catch (e) {
        console.error(e);
    }
}

async function renderAlbumsPage(userId) {
    try {
        const albums = await fetchJson(`http://localhost:3000/api/users/${userId}/albums`);
        renderAlbumRow('library-albums-list', albums);
    } catch (e) {
        renderPlaceholder('library-albums-list', '앨범을 불러오지 못했습니다.');
        console.error(e);
    }
}

async function renderFollowingPage(userId) {
    try {
        const list = await fetchJson(`http://localhost:3000/api/users/${userId}/following`);
        renderFollowingRow('library-following-list', list);
    } catch (e) {
        renderPlaceholder('library-following-list', '팔로잉을 불러오지 못했습니다.');
        console.error(e);
    }
}

// 아티스트 트랙 목록 모달
async function showArtistTracks(artist) {
    try {
        const tracks = await fetchJson('http://localhost:3000/api/tracks');
        const filtered = tracks.filter(t => (t.artist || '').toLowerCase() === artist.toLowerCase());
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = '0'; overlay.style.top = '0';
        overlay.style.right = '0'; overlay.style.bottom = '0';
        overlay.style.background = 'rgba(0,0,0,0.6)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '1000';

        const modal = document.createElement('div');
        modal.style.background = '#111';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.maxHeight = '70vh';
        modal.style.width = '420px';
        modal.style.overflowY = 'auto';
        modal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="color:#fff;font-weight:700;">${artist} Tracks</div>
            <button id="artist-modal-close" style="background:#333;color:#fff;border:none;padding:4px 8px;cursor:pointer;">Close</button>
        </div>`;

        const list = document.createElement('div');
        if (!filtered.length) {
            list.innerHTML = `<div style="color:#aaa;padding:10px;">트랙이 없습니다.</div>`;
        } else {
            filtered.forEach(track => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.gap = '10px';
                item.style.alignItems = 'center';
                item.style.padding = '8px';
                item.style.borderBottom = '1px solid #222';
                item.innerHTML = `
                    <img src="${track.albumCover}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;" onerror="this.src='../assets/albumart.jpg'"/>
                    <div style="flex:1;">
                        <div style="color:#fff;font-weight:600;">${track.title}</div>
                        <div style="color:#aaa;font-size:12px;">${track.album || ''}</div>
                    </div>
                    <button style="background:#ff5500;border:none;color:#fff;padding:6px 10px;border-radius:4px;cursor:pointer;">Play</button>
                `;
                item.querySelector('button').onclick = (e) => {
                    e.preventDefault();
                    window.isPlaylistMode = false;
                    fetchTracks(true).then(() => {
                        const idx = window.GlobalTracks.findIndex(t => t.id === track.id);
                        if (window.globalPlayer && idx !== -1) {
                            window.globalPlayer.tracks = window.GlobalTracks;
                            window.globalPlayer.setTrack(idx);
                        }
                        if (typeof navigate === 'function') navigate('/html/index.html');
                        else window.location.href = '/html/index.html';
                    });
                    document.body.removeChild(overlay);
                };
                list.appendChild(item);
            });
        }
        modal.appendChild(list);
        overlay.appendChild(modal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
        modal.querySelector('#artist-modal-close').onclick = () => document.body.removeChild(overlay);
        document.body.appendChild(overlay);
    } catch (e) {
        console.error(e);
        alert('아티스트 트랙을 불러오지 못했습니다.');
    }
}
