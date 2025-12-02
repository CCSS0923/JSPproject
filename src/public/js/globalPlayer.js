// src/public/js/globalPlayer.js

// 전역 상태 초기화
window.GlobalTracks = window.GlobalTracks || [];
window.isPlaylistMode = window.isPlaylistMode || false;
window.PLAYLIST_SESSION_KEY = "active_playlist_tracks"; // [추가] 세션 키 정의

// ============================================================
// 1. 인증(Auth) 및 네비게이션 바 관리 (유지)
// ============================================================
window.renderAuth = function() {
    const p = JSON.parse(localStorage.getItem('profile'));
    const area = document.getElementById('authArea');
    if (!area) return;

    const uploadBtnHtml = `<button class="upload-btn" onclick="location.href='upload.html'">Upload</button>`;
    const moreBtnHtml = `<button class="more-btn">•••</button>`;

    if (p) {
        area.innerHTML = `
            ${uploadBtnHtml}
            ${moreBtnHtml}
            <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="location.href='mypage.html'">
                <img src="${p.img}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;background:#eee;border:1px solid #bbb;" alt="프로필" />
                <span style="font-size:16px;color:#fff;font-weight:bold;">${p.name}</span>
            </div>
            <button onclick="logout()" style="margin-left:8px;padding:5px 16px;border-radius:5px;background:#444;color:#fff;border:none;cursor:pointer;">Logout</button>
        `;
    } else {
        const returnPage = '/html/home.html';
        const loginUrl = `/html/login.html?returnTo=${encodeURIComponent(returnPage)}`;
        area.innerHTML = `
            ${uploadBtnHtml}
            ${moreBtnHtml}
            <button class="sign-in-btn" onclick="location.href='${loginUrl}'">Sign in</button>
            <button class="create-account-btn" onclick="location.href='/html/signup.html'">Create account</button>`;
    }
};

window.logout = function() {
    localStorage.removeItem('profile');
    window.renderAuth();
    location.reload();
};

// ============================================================
// 2-a. 헤더 검색창 (홈/메인 공통)
// ============================================================
window.initHeaderSearch = function() {
    const searchInput = document.getElementById('header-track-search');
    const resultsBox = document.getElementById('header-search-results');
    if (!searchInput || !resultsBox) return;

    // 이미 초기화된 경우 중복 바인딩 방지
    if (searchInput.dataset.searchBound === 'true') return;
    searchInput.dataset.searchBound = 'true';

    let cachedTracks = (window.GlobalTracks && window.GlobalTracks.length) ? window.GlobalTracks : null;

    const hideResults = () => {
        resultsBox.style.display = 'none';
    };

    const renderResults = (tracks) => {
        resultsBox.innerHTML = '';
        if (!tracks || tracks.length === 0) {
            hideResults();
            return;
        }
        resultsBox.style.display = 'block';

        tracks.slice(0, 12).forEach(track => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <img src="${track.albumCover}" onerror="this.src='../assets/albumart.jpg'">
                <div style="flex:1">
                    <div>${track.title}</div>
                    <div style="font-size:12px; color:#aaa;">${track.artist}</div>
                </div>
                <button>Play</button>
            `;
            div.onclick = (e) => {
                e.preventDefault();
                playFromSearch(track);
            };
            resultsBox.appendChild(div);
        });
    };

    const ensureTracks = async () => {
        if (cachedTracks && cachedTracks.length) return cachedTracks;
        if (window.GlobalTracks && window.GlobalTracks.length) {
            cachedTracks = window.GlobalTracks;
            return cachedTracks;
        }
        try {
            const res = await fetch('http://localhost:3000/api/tracks');
            if (res.ok) {
                const data = await res.json();
                window.GlobalTracks = data;
                cachedTracks = data;
                return data;
            }
        } catch (err) {
            console.error('검색용 곡 로드 실패:', err);
        }
        return [];
    };

    const playFromSearch = (track) => {
        hideResults();
        searchInput.value = `${track.title} - ${track.artist}`;
        window.isPlaylistMode = false;

        const startPlayback = () => {
            const idx = window.GlobalTracks.findIndex(t => t.id === track.id);
            if (window.globalPlayer && idx !== -1) {
                window.globalPlayer.tracks = window.GlobalTracks;
                window.globalPlayer.setTrack(idx);
            }
            if (typeof navigate === 'function') {
                navigate('/html/index.html');
            } else {
                window.location.href = '/html/index.html';
            }
        };

        if (!window.GlobalTracks || window.GlobalTracks.length === 0) {
            fetchTracks(true).then(startPlayback).catch(startPlayback);
        } else {
            startPlayback();
        }
    };

    searchInput.addEventListener('input', async (e) => {
        const val = e.target.value.trim().toLowerCase();
        if (val.length < 1) { hideResults(); return; }

        const tracks = await ensureTracks();
        const filtered = tracks.filter(t =>
            (t.title || '').toLowerCase().includes(val) ||
            (t.artist || '').toLowerCase().includes(val)
        );
        renderResults(filtered);
    });

    document.addEventListener('click', (e) => {
        if (resultsBox.style.display === 'none') return;
        if (!resultsBox.contains(e.target) && e.target !== searchInput) {
            hideResults();
        }
    });
};


// ============================================================
// 2. 홈(Home) 화면 렌더링 로직 (유지)
// ============================================================
window.renderHomeTracks = async function(tracks) {
    if (!document.getElementById('new-uploads-container')) return;

    window.isPlaylistMode = false;

    const playedList = JSON.parse(localStorage.getItem('played_tracks') || '[]');
    const profile = JSON.parse(localStorage.getItem('profile'));

    const newUploads = tracks.filter(t => !playedList.includes(t.id));
    renderSection('new-uploads-container', newUploads, true);

    const recentContainer = document.getElementById('recent-container');
    if (recentContainer) {
        if (profile && profile.id) {
            recentContainer.innerHTML = '<div style="padding: 20px; color: #888;">최근 재생 기록을 불러오는 중...</div>';
            renderRecentPlays(profile.id);
        } else {
            recentContainer.innerHTML = '<div style="padding: 20px; color: #888;">로그인 후 이용 가능합니다.</div>';
        }
    }

    if (profile && profile.id) {
        try {
            const res = await fetch(`http://localhost:3000/api/users/${profile.id}/likes`);
            const likedTracks = await res.json();
            renderSection('liked-container', likedTracks.slice(0, 5), false);
        } catch(e) {
            console.error("좋아요 로드 실패", e);
            const el = document.getElementById('liked-container');
            if(el) el.innerHTML = '<div style="padding:20px;">로드 실패</div>';
        }
    } else {
        const el = document.getElementById('liked-container');
        if(el) el.innerHTML = '<div style="padding:20px; color:#888;">로그인 후 이용 가능합니다.</div>';
    }

    const playlistContainer = document.getElementById('playlist-container');
    if (playlistContainer) {
        if (profile && profile.id) {
            try {
                const res = await fetch(`http://localhost:3000/api/users/${profile.id}/playlists`);
                const myPlaylists = await res.json();

                let html = `
                <a class="card" href="javascript:void(0)" onclick="createNewPlaylist()">
                    <div class="card-cover" style="background:#333; display:flex; align-items:center; justify-content:center; font-size:40px; border:2px dashed #555;">+</div>
                    <div class="card-title">Create New</div>
                    <div class="card-artist">Make your own mix</div>
                </a>`;

                myPlaylists.forEach(pl => {
                    html += `
                    <a class="card" href="/html/playlist.html?id=${pl.id}">
                        <div class="card-cover">
                            <img src="${pl.cover || '../assets/albumart.jpg'}" alt="${pl.title}" onerror="this.src='../assets/albumart.jpg'" />
                        </div>
                        <div class="card-title">${pl.title}</div>
                        <div class="card-artist">By ${profile.name}</div>
                    </a>`;
                });
                playlistContainer.innerHTML = html;
            } catch (e) {
                playlistContainer.innerHTML = '<div style="padding:20px;">Error loading playlists</div>';
            }
        } else {
            playlistContainer.innerHTML = '<div style="padding:20px; color:#888;">로그인 후 이용 가능합니다.</div>';
        }
    }

    const followingContainer = document.getElementById('following-container');
    if (followingContainer) {
        if (profile && profile.id) {
            followingContainer.innerHTML = '<div style="padding: 20px; color: #888;">팔로우 아티스트를 불러오는 중...</div>';
            renderHomeFollowing(profile.id);
        } else {
            followingContainer.innerHTML = '<div style="padding:20px; color:#888;">로그인 후 이용 가능합니다.</div>';
        }
    }

    const popularContainer = document.getElementById('popular-artists-container');
    if (popularContainer) {
        popularContainer.innerHTML = '<div style="padding: 20px; color: #888;">Loading popular artists...</div>';
        renderPopularArtists();
    }
};

// [Helper] 섹션 렌더링 함수
function renderSection(containerId, trackList, showDeleteBtn) { /* ... 기존 코드 유지 ... */ }
function renderSection(containerId, trackList, showDeleteBtn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; 

    if (!trackList || trackList.length === 0) {
        container.innerHTML = '<div style="padding:10px; color:#aaa;">표시할 곡이 없습니다.</div>';
        return;
    }

    trackList.forEach((track) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        if (showDeleteBtn) {
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '✕';
            delBtn.style.position = 'absolute';
            delBtn.style.top = '5px';
            delBtn.style.right = '5px';
            delBtn.style.background = 'rgba(0,0,0,0.7)';
            delBtn.style.color = 'white';
            delBtn.style.border = 'none';
            delBtn.style.borderRadius = '50%';
            delBtn.style.width = '24px';
            delBtn.style.height = '24px';
            delBtn.style.cursor = 'pointer';
            delBtn.style.zIndex = '10';
            delBtn.title = "삭제하기";
            
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.deleteTrack(track.id);
            };
            wrapper.appendChild(delBtn);
        }

        const card = document.createElement('a');
        card.className = 'card';
        card.href = '/html/index.html'; 
        
        card.onclick = (e) => {
            e.preventDefault(); 
            
            window.isPlaylistMode = false;

            fetchTracks(true).then(() => {
                const targetIndex = window.GlobalTracks.findIndex(t => t.id === track.id);
                
                if (window.globalPlayer && targetIndex !== -1) {
                    window.globalPlayer.tracks = window.GlobalTracks;
                    window.globalPlayer.setTrack(targetIndex);
                }
                if (typeof navigate === 'function') {
                    navigate('/html/index.html');
                } else {
                    window.location.href = '/html/index.html';
                }
            });
        };

        card.innerHTML = `
            <div class="card-cover">
                <img src="${track.albumCover}" alt="${track.title}" onerror="this.src='../assets/albumart.jpg'" />
            </div>
            <div class="card-title">${track.title}</div>
            <div class="card-artist">${track.artist}</div>
        `;
        
        wrapper.appendChild(card);
        container.appendChild(wrapper);
    });
}

async function renderRecentPlays(userId) {
    const container = document.getElementById('recent-container');
    if (!container) return;

    try {
        const res = await fetch(`http://localhost:3000/api/users/${userId}/recent-plays`);
        if (!res.ok) throw new Error('Failed to load recent plays');
        const recentTracks = await res.json();

        if (!recentTracks || recentTracks.length === 0) {
            container.innerHTML = '<div style="padding: 20px; color: #888;">최근 재생한 곡이 없습니다.</div>';
            return;
        }

        renderSection('recent-container', recentTracks, false);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding: 20px; color: #e66;">최근 재생 목록을 불러오지 못했습니다.</div>';
    }
}

async function renderHomeFollowing(userId) {
    const container = document.getElementById('following-container');
    if (!container) return;

    try {
        const res = await fetch(`http://localhost:3000/api/users/${userId}/following`);
        if (!res.ok) throw new Error('Failed to load following');
        const list = await res.json();

        if (!list || !list.length) {
            container.innerHTML = '<div style="padding:20px; color:#888;">팔로우한 아티스트가 없습니다.</div>';
            return;
        }

        container.innerHTML = '';
        list.forEach(item => {
            const card = document.createElement('a');
            card.className = 'card';
            card.href = '#';
            card.onclick = (e) => {
                e.preventDefault();
                openArtistTracks(item.artist);
            };
            card.innerHTML = `
                <div class="card-cover">
                    <img src="${item.albumCover}" alt="${item.artist}" onerror="this.src='../assets/default_profile.jpg'" />
                </div>
                <div class="card-title">${item.artist}</div>
                <div class="card-artist">Following</div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        container.innerHTML = '<div style="padding:20px; color:#e66;">팔로잉 목록을 불러오지 못했습니다.</div>';
    }
}

function openArtistTracks(artist) {
    // 홈 섹션이 비어 있지 않도록 항상 트랙 재로딩 후 렌더
    window.isPlaylistMode = false;
    fetchTracks(true).then(() => {
        if (typeof window.renderHomeTracks === 'function') {
            window.renderHomeTracks(window.GlobalTracks);
        }
        if (typeof window.showArtistTracks === 'function') {
            window.showArtistTracks(artist);
        } else if (typeof navigate === 'function') {
            navigate('/html/index.html');
        } else {
            window.location.href = '/html/index.html';
        }
    }).catch((err) => {
        console.error(err);
        if (typeof window.showArtistTracks === 'function') {
            window.showArtistTracks(artist);
        }
    });
}

async function renderPopularArtists() {
    const container = document.getElementById('popular-artists-container');
    if (!container) return;

    try {
        const res = await fetch('http://localhost:3000/api/artists/popular?limit=8');
        if (!res.ok) throw new Error('failed to load popular artists');
        const artists = await res.json();

        if (!artists || artists.length === 0) {
            container.innerHTML = '<div style="padding: 20px; color: #888;">아직 재생된 아티스트가 없습니다.</div>';
            return;
        }

        container.innerHTML = '';
        artists.forEach(artist => {
            const card = document.createElement('a');
            card.className = 'card';
            card.href = '/html/index.html';
            card.onclick = (e) => {
                e.preventDefault();
                window.isPlaylistMode = false;
                fetchTracks(true).then(() => {
                    const idx = window.GlobalTracks.findIndex(t => t.artist === artist.artist);
                    if (window.globalPlayer && idx !== -1) {
                        window.globalPlayer.tracks = window.GlobalTracks;
                        window.globalPlayer.setTrack(idx);
                    }
                navigate('/html/index.html');
            });
        };

            card.innerHTML = `
                <div class="card-cover">
                    <img src="${artist.albumCover}" alt="${artist.artist}" onerror="this.src='../assets/albumart.jpg'" />
                </div>
                <div class="card-title">${artist.artist}</div>
                <div class="card-artist">Total plays: ${artist.totalPlays}</div>
            `;

            container.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div style="padding: 20px; color: #e66;">인기 아티스트를 불러오지 못했습니다.</div>';
    }
}

window.createNewPlaylist = async function() {
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (!profile) return alert('로그인이 필요합니다.');
    const title = prompt('새로운 플레이리스트 이름을 입력하세요:');
    if (!title) return;

    try {
        const res = await fetch('http://localhost:3000/api/playlists', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId: profile.id, title })
        });
        if (res.ok) {
            const data = await res.json();
            location.href = `/html/playlist.html?id=${data.id}`;
        } else {
            alert('생성 실패');
        }
    } catch (e) {
        console.error(e);
        alert('오류 발생');
    }
};

window.deletePlaylist = async function(id) {
    if(!confirm('플레이리스트를 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`http://localhost:3000/api/playlists/${id}`, { method: 'DELETE' });
        if(res.ok) {
            alert('플레이리스트가 삭제되었습니다.');
            location.href = '/html/home.html';
        } else {
            alert('삭제 실패');
        }
    } catch(e) {
        console.error(e);
        alert('오류 발생');
    }
};

window.deleteTrack = async function(id) {
    if(!confirm('정말로 이 곡을 삭제하시겠습니까?')) return;
    try {
        const res = await fetch(`http://localhost:3000/api/tracks/${id}`, { method: 'DELETE' });
        if(res.ok) {
            alert('삭제되었습니다.');
            location.reload(); 
        } else {
            alert('삭제 실패');
        }
    } catch(e) {
        console.error(e);
        alert('오류 발생');
    }
};


// ============================================================
// 3. 플레이리스트(Playlist) 상세 페이지 로직 (핵심 수정)
// ============================================================
window.initPlaylistPage = function() {
    const playlistTitle = document.getElementById('playlist-title');
    if (!playlistTitle) return;

    // [중요] 플레이리스트 페이지 진입 시 fetchTracks의 간섭을 막기 위해 플래그 설정
    window.isPlaylistMode = true;

    if (typeof window.renderAuth === 'function') window.renderAuth();
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (!profile) { alert('로그인이 필요합니다.'); location.href = '/html/login.html'; return; }

    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('id');
    let currentPlaylistTracks = [];

    const searchInput = document.getElementById('track-search');
    const resultsBox = document.getElementById('search-results');
    const deleteBtn = document.getElementById('delete-playlist-btn');
    if (deleteBtn) {
        deleteBtn.onclick = () => deletePlaylist(playlistId);
    }

    const loadPlaylistData = async () => {
        try {
            // [중요] 데이터 로드 시점까지 페이지 전환 방지
            const res = await fetch(`http://localhost:3000/api/playlists/${playlistId}`);
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();

            document.getElementById('playlist-title').textContent = data.title;
            document.getElementById('playlist-meta').textContent = `${data.tracks.length} tracks · Created by ${profile.name}`;
            const coverEl = document.querySelector('.playlist-cover-large');
            if (coverEl) {
                const cover = data.cover || (data.tracks[0] && data.tracks[0].albumCover) || '../assets/albumart.jpg';
                coverEl.innerHTML = `<img src="${cover}" alt="${data.title}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.src='../assets/albumart.jpg'"/>`;
            }
            
            currentPlaylistTracks = data.tracks;
            renderPlaylistTracks(data.tracks);
            
        } catch (err) {
            console.error(err);
            alert('플레이리스트를 불러올 수 없습니다.');
            location.href = 'home.html';
        }
    };

    const renderPlaylistTracks = (tracks) => {
        const container = document.getElementById('playlist-tracks');
        container.innerHTML = '';

        if (tracks.length === 0) {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:#888;">아직 곡이 없습니다.<br>위 검색창을 통해 곡을 추가해보세요!</div>';
            return;
        }

        tracks.forEach((track, index) => {
            const div = document.createElement('div');
            div.className = 'track-item';
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px; flex:1; pointer-events:none;">
                    <span style="color:#888; width:20px;">${index + 1}</span>
                    <img src="${track.albumCover}" onerror="this.src='../assets/albumart.jpg'" style="width:40px; height:40px; border-radius:4px;">
                    <div>
                        <div style="color:#fff; font-weight:500;">${track.title}</div>
                        <div style="color:#aaa; font-size:13px;">${track.artist}</div>
                    </div>
                </div>
                <button class="delete-track-btn" style="background:none; border:none; color:#666; font-size:18px; cursor:pointer; padding:5px; pointer-events:auto;">✕</button>
            `;
            
            const delBtn = div.querySelector('.delete-track-btn');
            delBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); 
                removeTrack(track.id);
            };

            // [핵심 수정] 새로운 페이지로 이동하며 세션 생성
            div.onclick = (e) => {
                e.preventDefault(); // 기본 동작(화면 전환) 방지
                if(e.target === delBtn || delBtn.contains(e.target)) return;

                // 1. 현재 플레이리스트의 곡 목록을 세션 저장소에 저장 (새로운 세션 생성 준비)
                sessionStorage.setItem(window.PLAYLIST_SESSION_KEY, JSON.stringify(currentPlaylistTracks));
                
                // 2. 플레이어의 인덱스 저장
                sessionStorage.setItem('currentTrackIndexOnPlaylist', index); 

                // 3. SPA 라우팅이 아닌, 새로운 페이지로 강제 이동 (새로운 세션 생성)
                window.location.href = `playlist_player.html`;
            };
            container.appendChild(div);
        });
    };

    if (searchInput) {
        searchInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            if (val.length < 1) { resultsBox.style.display = 'none'; return; }

            fetch('http://localhost:3000/api/tracks')
                .then(res => res.json())
                .then(allTracks => {
                    const filtered = allTracks.filter(t => 
                        t.title.toLowerCase().includes(val) || t.artist.toLowerCase().includes(val)
                    );
                    renderSearchResults(filtered);
                });
        };
    }

    const renderSearchResults = (tracks) => {
        resultsBox.innerHTML = '';
        if (tracks.length === 0) {
            resultsBox.style.display = 'none';
            return;
        }
        resultsBox.style.display = 'block';

        tracks.forEach(track => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <img src="${track.albumCover}" onerror="this.src='../assets/albumart.jpg'">
                <div style="flex:1">
                    <div>${track.title}</div>
                    <div style="font-size:12px; color:#aaa;">${track.artist}</div>
                </div>
                <button>Add</button>
            `;
            div.onclick = (e) => {
                e.preventDefault();
                addToPlaylist(track.id);
            };
            resultsBox.appendChild(div);
        });
    };

    const addToPlaylist = async (trackId) => {
        try {
            const res = await fetch(`http://localhost:3000/api/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ trackId })
            });
            if (res.ok) {
                searchInput.value = '';
                resultsBox.style.display = 'none';
                loadPlaylistData(); 
            } else {
                const d = await res.json();
                alert(d.message === 'Already in playlist' ? '이미 추가된 곡입니다.' : '추가 실패');
            }
        } catch (e) { console.error(e); }
    };

    const removeTrack = async (trackId) => {
        if(!confirm('삭제하시겠습니까?')) return;
        try {
            await fetch(`http://localhost:3000/api/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
            loadPlaylistData();
        } catch(e) { console.error(e); }
    };

    loadPlaylistData();
};


// ============================================================
// 4. 전역 플레이어(Global Player) 객체
// ============================================================
// forceUpdate = true일 경우에만 서버에서 전체 트랙 목록을 다시 가져오도록 합니다.
async function fetchTracks(forceUpdate = false) {
  // [핵심] 플레이리스트 모드이고 강제 업데이트가 아니면, 서버에서 데이터를 가져와 덮어쓰지 않음
  if (window.isPlaylistMode && !forceUpdate) return;

  try {
    const res = await fetch('http://localhost:3000/api/tracks');
    if (!res.ok) throw new Error('트랙 로드 실패');
    const data = await res.json();
    
    window.GlobalTracks = data;
    
    if (window.globalPlayer) {
      if (window.globalPlayer.tracks.length === 0 || forceUpdate) {
          window.globalPlayer.tracks = data;
          if (!forceUpdate) window.globalPlayer.restoreState();
      }
    }

    if (typeof window.renderHomeTracks === 'function') {
      window.renderHomeTracks(data);
    }
    if (typeof window.renderAuth === 'function') {
      window.renderAuth();
    }
    
    window.dispatchEvent(new Event('tracksLoaded'));

  } catch (err) {
    console.error("트랙 로드 오류:", err);
  }
}

if (!window.globalPlayer) {
  const audio = new Audio();
  const KEY_PREFIX = "gp_";

  const gp = {
    audio,
    tracks: [],
    currentTrackIndex: 0,
    initialized: false,

    init() {
      if (this.initialized) return;
      this.audio.crossOrigin = "anonymous";
      this.addListeners();
      this.initialized = true;
      
      // [핵심 추가] 독립된 플레이어 세션 로드 체크
      this.loadPlaylistSession();
    },
    
    loadPlaylistSession() {
        const playlistTracksRaw = sessionStorage.getItem(window.PLAYLIST_SESSION_KEY);
        const startIndex = sessionStorage.getItem('currentTrackIndexOnPlaylist');
        
        if (playlistTracksRaw) {
            try {
                const tracks = JSON.parse(playlistTracksRaw);
                if (tracks.length > 0) {
                    this.tracks = tracks;
                    window.GlobalTracks = tracks;
                    this.currentTrackIndex = parseInt(startIndex) || 0;
                    window.isPlaylistMode = true;
                    window.dispatchEvent(new Event('tracksLoaded'));

                    // 플레이어 초기 세팅 (자동재생 없이 소스만 바인딩)
                    if (!this.audio.src && this.tracks[this.currentTrackIndex]) {
                        this.audio.src = this.tracks[this.currentTrackIndex].audioSrc;
                        this.audio.currentTime = 0;
                        this.saveState();
                    }
                    
                    // 세션 데이터 사용 후 제거
                    sessionStorage.removeItem(window.PLAYLIST_SESSION_KEY);
                    sessionStorage.removeItem('currentTrackIndexOnPlaylist');
                }
            } catch(e) {
                console.error("Failed to parse playlist session:", e);
            }
        }
    },
    

    addListeners() {
      ["timeupdate", "play", "pause", "ended", "volumechange"].forEach((evt) => {
        this.audio.addEventListener(evt, () => {
            this.saveState();
            if (typeof window.updatePlayerUI === 'function') {
                window.updatePlayerUI();
            }
        });
      });
      
      window.addEventListener("beforeunload", () => {
        this.saveState();
      });
    },

    saveState() {
      sessionStorage.setItem(KEY_PREFIX + "trackIndex", this.currentTrackIndex);
      sessionStorage.setItem(KEY_PREFIX + "currentTime", this.audio.currentTime);
      sessionStorage.setItem(KEY_PREFIX + "isPlaying", !this.audio.paused);
      sessionStorage.setItem(KEY_PREFIX + "volume", this.audio.volume);
      sessionStorage.setItem(KEY_PREFIX + "isPlaylistMode", window.isPlaylistMode);
    },

    restoreState() {
      window.isPlaylistMode = sessionStorage.getItem(KEY_PREFIX + "isPlaylistMode") === 'true';
      
      if (this.tracks.length === 0) return;

      const idx = parseInt(sessionStorage.getItem(KEY_PREFIX + "trackIndex"));
      const time = parseFloat(sessionStorage.getItem(KEY_PREFIX + "currentTime"));
      const vol = parseFloat(sessionStorage.getItem(KEY_PREFIX + "volume"));
      const wasPlaying = sessionStorage.getItem(KEY_PREFIX + "isPlaying") === 'true';

      if (!isNaN(idx) && this.tracks[idx]) {
        this.currentTrackIndex = idx;
      } else {
        this.currentTrackIndex = 0;
      }

      const targetSrc = new URL(this.tracks[this.currentTrackIndex].audioSrc, document.baseURI).href;
      if (!this.audio.src || this.audio.src !== targetSrc) {
        this.audio.src = this.tracks[this.currentTrackIndex].audioSrc;
        if (!isNaN(time)) this.audio.currentTime = time;
      } else {
        if (!isNaN(time) && Math.abs(this.audio.currentTime - time) > 1) {
            this.audio.currentTime = time;
        }
      }

      this.audio.volume = !isNaN(vol) ? vol : 0.25;

      if (wasPlaying) {
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log("자동 재생 차단됨:", error);
          });
        }
      }
    },

    setTrack(index) {
      if (!this.tracks[index]) return;
      
      const trackId = this.tracks[index].id;
      
      const playedList = JSON.parse(localStorage.getItem('played_tracks') || '[]');
      if (!playedList.includes(trackId)) {
          playedList.push(trackId);
          localStorage.setItem('played_tracks', JSON.stringify(playedList));
      }

      this.recordPlay(trackId);

      this.currentTrackIndex = index;
      this.audio.src = this.tracks[index].audioSrc;
      this.audio.currentTime = 0;
      this.audio.play().catch(e => console.log(e));
      this.saveState();
    },

    togglePlay() {
      if (!this.tracks.length) return;
      if (this.audio.paused) {
        this.audio.play().catch(e => console.log(e));
      } else {
        this.audio.pause();
      }
      this.saveState();
    },

    setVolume(v) {
      this.audio.volume = v;
      this.saveState();
    },

    async recordPlay(trackId) {
        const profile = JSON.parse(localStorage.getItem('profile'));
        const userId = profile ? profile.id : null;

        try {
            await fetch('http://localhost:3000/api/play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId, userId })
            });
        } catch (err) {
            console.error('Failed to record play:', err);
        }
    }
  };

  window.globalPlayer = gp;
  gp.init();
}

// 헤더 검색창 초기화 (페이지 로드 시 1회)
document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.initHeaderSearch === 'function') {
        window.initHeaderSearch();
    }
});
window.addEventListener('tracksLoaded', () => {
    if (typeof window.initHeaderSearch === 'function') {
        window.initHeaderSearch();
    }
});

// 초기 실행
fetchTracks();
