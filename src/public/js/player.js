// src/public/js/player.js

const GP = window.globalPlayer;

let canvas, ctx;
let waveformData = null;
let playPauseBtn, footerPlayPauseBtn;
let currentTimeSpan, durationTimeSpan;
let artistNameEl, trackTitleEl, albumCoverEl;
let tracklistContainer;
let progressBar, volumeSlider;
let footerCurrentTime, footerDurationTime;
let volumeIcon;
let likeBtn; 

let isSeeking = false;

window.addEventListener("DOMContentLoaded", () => {
    if (hasPlayerElements()) {
        initPlayerPage();
    }
});

window.addEventListener('tracksLoaded', () => {
    if (hasPlayerElements()) {
        initPlayerPage();
    }
});

function hasPlayerElements() {
    return document.getElementById("waveform") || document.getElementById("footer-play-pause-btn");
}

function initPlayerPage() {
    if (!window.globalPlayer) return;
    
    cacheElements();
    bindEvents();

    if (window.GlobalTracks && window.GlobalTracks.length > 0) {
        if(!window.GlobalTracks[GP.currentTrackIndex]) {
            GP.currentTrackIndex = 0;
        }
        
        buildTracklist();
        syncUIFromPlayer();
        
        if (canvas) {
            const currentSrc = window.GlobalTracks[GP.currentTrackIndex].audioSrc;
            loadWaveform(currentSrc);
            
            window.removeEventListener("resize", handleResize);
            window.addEventListener("resize", handleResize);
        }
    }
}

function handleResize() {
    resizeCanvas();
    if (waveformData) drawBaseWaveform(waveformData);
}

function cacheElements() {
  canvas = document.getElementById("waveform");
  if (canvas) {
    ctx = canvas.getContext("2d");
    resizeCanvas();
  }

  playPauseBtn = document.getElementById("play-pause-btn");
  artistNameEl = document.getElementById("artist-name");
  trackTitleEl = document.getElementById("track-title");
  albumCoverEl = document.getElementById("album-cover");
  currentTimeSpan = document.getElementById("current-time");
  durationTimeSpan = document.getElementById("duration-time");
  
  tracklistContainer = document.getElementById("tracklist");

  footerPlayPauseBtn = document.getElementById("footer-play-pause-btn");
  progressBar = document.getElementById("progress-bar");
  volumeSlider = document.getElementById("volume-slider");
  footerCurrentTime = document.getElementById("footer-current-time");
  footerDurationTime = document.getElementById("footer-duration-time");
  volumeIcon = document.querySelector(".volume-icon");
  likeBtn = document.getElementById("like-btn"); 

  if (volumeSlider && GP && GP.audio) {
    volumeSlider.value = GP.audio.volume * 100;
    updateVolumeIcon();
  }
}

function bindEvents() {
    if (playPauseBtn) playPauseBtn.onclick = () => { GP.togglePlay(); updatePlayIcons(); };
    if (footerPlayPauseBtn) footerPlayPauseBtn.onclick = () => { GP.togglePlay(); updatePlayIcons(); };

    if (volumeSlider) {
        volumeSlider.oninput = (e) => {
            const v = e.target.value / 100;
            GP.setVolume(v);
            updateVolumeIcon();
        };
    }
    
    if (progressBar) {
        progressBar.oninput = (e) => {
            isSeeking = true;
            const displayTime = (e.target.value / 100) * GP.audio.duration;
            if (footerCurrentTime) footerCurrentTime.textContent = formatTime(displayTime);
        };
        progressBar.onchange = (e) => {
            isSeeking = false;
            if (!isNaN(GP.audio.duration)) {
                GP.audio.currentTime = (e.target.value / 100) * GP.audio.duration;
            }
        };
    }

    if (canvas) {
        canvas.onclick = (event) => {
            if (!GP.audio.duration) return;
            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickRatio = clickX / rect.width;
            
            GP.audio.currentTime = clickRatio * GP.audio.duration;
            updateTimeAndProgress();
        };
    }

    if (likeBtn) {
        likeBtn.onclick = toggleLike;
    }
}

function syncUIFromPlayer() {
    const tracks = (GP.tracks && GP.tracks.length) ? GP.tracks : window.GlobalTracks;
    if (!tracks || !tracks.length) return;

    const idx = GP.currentTrackIndex;
    const track = tracks[idx];

    if (artistNameEl) artistNameEl.textContent = track.artist;
    if (trackTitleEl) trackTitleEl.textContent = track.title;
    
    if (albumCoverEl) {
        albumCoverEl.src = track.albumCover;
        albumCoverEl.onerror = () => { albumCoverEl.src = '../assets/albumart.jpg'; };
    }

    if (tracklistContainer) highlightActiveTrack(idx);

    updatePlayIcons();
    updateVolumeIcon();

    checkLikeStatus(track.id);
}

function updateTimeAndProgress() {
    if (!GP.audio.duration) return;
    const cur = GP.audio.currentTime;
    const dur = GP.audio.duration;

    if (!isSeeking && progressBar) {
        const percent = (cur / dur) * 100;
        progressBar.value = isNaN(percent) ? 0 : percent;
    }

    if (currentTimeSpan) currentTimeSpan.textContent = formatTime(cur);
    if (durationTimeSpan) durationTimeSpan.textContent = formatTime(dur);
    if (footerCurrentTime) footerCurrentTime.textContent = formatTime(cur);
    if (footerDurationTime) footerDurationTime.textContent = formatTime(dur);
    
    if (canvas && waveformData) {
        drawBaseWaveform(waveformData);
        drawProgressWaveform(waveformData, cur / dur);
    }
}
window.updatePlayerUI = updateTimeAndProgress;

async function checkLikeStatus(trackId) {
    if(!likeBtn) return;
    
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (!profile || !profile.id) {
        // 비로그인 시 초기화
        likeBtn.classList.remove("liked");
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/api/likes/check?userId=${profile.id}&trackId=${trackId}`);
        const data = await res.json();
        updateLikeBtnUI(data.liked);
    } catch(e) { console.error(e); }
}

async function toggleLike() {
    const profile = JSON.parse(localStorage.getItem('profile'));
    if (!profile || !profile.id) return alert("로그인이 필요합니다.");
    
    const trackId = window.GlobalTracks[window.globalPlayer.currentTrackIndex].id;

    try {
        const res = await fetch('http://localhost:3000/api/likes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: profile.id, trackId })
        });
        const data = await res.json();
        if(res.ok) {
            updateLikeBtnUI(data.liked);
        }
    } catch(e) { console.error(e); }
}

// [수정] 좋아요 UI 업데이트: 클래스 토글 방식
function updateLikeBtnUI(isLiked) {
    if(!likeBtn) return;
    if (isLiked) {
        likeBtn.classList.add("liked");
    } else {
        likeBtn.classList.remove("liked");
    }
}

// --- Waveform & Canvas Utils ---

function resizeCanvas() {
  if (!canvas || !ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
}

async function calculateWaveformData(audioURL, samples = 1200) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const response = await fetch(audioURL);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);
        
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            const blockStart = i * blockSize;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize);
        }
        audioCtx.close();
        return filteredData;
    } catch (err) {
        console.error("Waveform Error:", err);
        return null;
    }
}

async function loadWaveform(audioSrc) {
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    waveformData = null;

    const targetUrl = new URL(audioSrc, document.baseURI).href;
    waveformData = await calculateWaveformData(targetUrl);
    if (waveformData) {
        drawBaseWaveform(waveformData);
    }
}

function drawBaseWaveform(data) {
  if (!canvas || !ctx || !data) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  
  const barWidth = width / data.length;
  ctx.fillStyle = "#eee"; 

  data.forEach((value, i) => {
    const barHeight = value * height * 1.5; 
    const x = i * barWidth;
    const y = height - barHeight; 
    ctx.fillRect(x, y, barWidth * 0.8, barHeight);
  });
}

function drawProgressWaveform(data, progress) {
  if (!canvas || !ctx || !data) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const barWidth = width / data.length;
  const progressIndex = Math.floor(data.length * progress);
  ctx.fillStyle = "#ff5500"; 

  for (let i = 0; i < progressIndex; i++) {
    const barHeight = data[i] * height * 1.5;
    const x = i * barWidth;
    const y = height - barHeight;
    ctx.fillRect(x, y, barWidth * 0.8, barHeight);
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function highlightActiveTrack(activeIdx) {
  if (!tracklistContainer) return;
  const items = tracklistContainer.querySelectorAll(".track-item");
  items.forEach((el, idx) => {
    el.classList.toggle("active", idx === activeIdx);
  });
}

function buildTracklist() {
  if (!tracklistContainer) return;
  tracklistContainer.innerHTML = "";
  const tracks = (GP.tracks && GP.tracks.length) ? GP.tracks : (window.GlobalTracks || []);

  tracks.forEach((track, idx) => {
    const div = document.createElement("div");
    div.className = "track-item";
    if (idx === GP.currentTrackIndex) div.classList.add("active");

    div.innerHTML = `
      <img src="${track.albumCover}" onerror="this.src='../assets/albumart.jpg'" />
      <div class="track-details">
        <div class="title">${track.title}</div>
        <div class="artist">${track.artist}</div>
      </div>
      <div class="play-icon">▶</div>
    `;

    div.onclick = () => {
      if (idx !== GP.currentTrackIndex) {
        GP.setTrack(idx);
        if(canvas) loadWaveform(tracks[idx].audioSrc);
        syncUIFromPlayer();
      } else {
        GP.togglePlay();
      }
      updatePlayIcons();
    };
    tracklistContainer.appendChild(div);
  });
}

function updatePlayIcons() {
    const isPlaying = !GP.audio.paused;
    if (playPauseBtn) {
        const p = playPauseBtn.querySelector(".play");
        const s = playPauseBtn.querySelector(".pause");
        if(p) p.style.display = isPlaying ? "none" : "inline";
        if(s) s.style.display = isPlaying ? "inline" : "none";
    }
    if (footerPlayPauseBtn) {
        const p = footerPlayPauseBtn.querySelector(".play");
        const s = footerPlayPauseBtn.querySelector(".pause");
        if(p) p.style.display = isPlaying ? "none" : "inline";
        if(s) s.style.display = isPlaying ? "inline" : "none";
    }
}

function updateVolumeIcon() {
    if (!volumeIcon || !GP.audio) return;
    volumeIcon.textContent = GP.audio.volume === 0 ? "🔇" : "🔊";
}
