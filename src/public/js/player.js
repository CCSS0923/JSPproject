// src/public/js/player.js
// Waveform 롤백 (1200 샘플) 및 클릭 탐색 기능 복구 완료

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

let isSeeking = false;

// 1. 페이지 로드 및 라우터 이동 감지
window.addEventListener("DOMContentLoaded", () => {
    // 만약 현재 페이지가 index.html이라면 초기화 실행
    if (document.getElementById("waveform")) {
        initPlayerPage();
    }
});

// Router.js에서 페이지 교체 후 발생하는 이벤트
window.addEventListener('tracksLoaded', () => {
    if (document.getElementById("waveform")) {
        initPlayerPage();
    }
});

function initPlayerPage() {
    if (!window.globalPlayer) return;
    
    // 요소 찾기
    cacheElements();
    
    // 이벤트 연결 (중복 방지 처리 포함)
    bindEvents();

    // 데이터가 있으면 UI 즉시 갱신
    if (window.GlobalTracks && window.GlobalTracks.length > 0) {
        // 인덱스 안전 장치
        if(!window.GlobalTracks[GP.currentTrackIndex]) {
            GP.currentTrackIndex = 0;
        }
        
        buildTracklist();
        syncUIFromPlayer();
        
        // [핵심] 웨이브폼 그리기 (데이터가 있는 경우)
        if (canvas) {
            const currentSrc = window.GlobalTracks[GP.currentTrackIndex].audioSrc;
            loadWaveform(currentSrc);
            
            // 리사이즈 이벤트 재등록 방지
            window.removeEventListener("resize", handleResize);
            window.addEventListener("resize", handleResize);
        }
    }
}

function handleResize() {
    resizeCanvas();
    if (waveformData) drawBaseWaveform(waveformData);
}

// -----------------------
// 요소 캐싱
// -----------------------
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

  // 볼륨 슬라이더 초기화
  if (volumeSlider && GP && GP.audio) {
    volumeSlider.value = GP.audio.volume * 100;
    updateVolumeIcon();
  }
}

// -----------------------
// 이벤트 바인딩
// -----------------------
function bindEvents() {
    // 버튼 이벤트 (onclick으로 중복 바인딩 방지)
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

    // [복구됨] Waveform 클릭 시 탐색 기능
    if (canvas) {
        canvas.onclick = (event) => {
            if (!GP.audio.duration) return;
            const rect = canvas.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const clickRatio = clickX / rect.width;
            
            // 오디오 시간 이동
            GP.audio.currentTime = clickRatio * GP.audio.duration;
            
            // UI 즉시 업데이트 (반응성 향상)
            updateTimeAndProgress();
        };
    }
}

// -----------------------
// UI 동기화
// -----------------------
function syncUIFromPlayer() {
    const tracks = window.GlobalTracks;
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
}

// -----------------------
// 시간 및 파형 업데이트 (매초 호출됨)
// -----------------------
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
    
    // 파형 위에 진행상황 덧그리기
    if (canvas && waveformData) {
        drawBaseWaveform(waveformData); // 베이스 다시 그림 (초기화)
        drawProgressWaveform(waveformData, cur / dur); // 진행된 부분 덧그림
    }
}
window.updatePlayerUI = updateTimeAndProgress; // globalPlayer에서 호출 가능하도록 전역 노출

// -----------------------
// Waveform 로직 (롤백됨)
// -----------------------
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

async function calculateWaveformData(audioURL, samples = 1200) { // [복구] 100 -> 1200
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

    // 절대 경로 변환
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
  ctx.fillStyle = "#eee"; // 기본 색상

  data.forEach((value, i) => {
    // [디자인 복구] 높이 비율 및 여백 조정
    const barHeight = value * height * 1.5; 
    const x = i * barWidth;
    const y = height - barHeight; 
    
    // barWidth * 0.8 (간격 20% 확보)
    ctx.fillRect(x, y, barWidth * 0.8, barHeight);
  });
}

function drawProgressWaveform(data, progress) {
  if (!canvas || !ctx || !data) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  
  const barWidth = width / data.length;
  const progressIndex = Math.floor(data.length * progress);
  
  ctx.fillStyle = "#ff5500"; // 진행 색상 (오렌지)

  for (let i = 0; i < progressIndex; i++) {
    const barHeight = data[i] * height * 1.5;
    const x = i * barWidth;
    const y = height - barHeight;
    ctx.fillRect(x, y, barWidth * 0.8, barHeight);
  }
}

// -----------------------
// 유틸리티
// -----------------------
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
  const tracks = window.GlobalTracks || [];

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
        // 트랙 변경 시 즉시 파형 로드
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