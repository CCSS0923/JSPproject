// player.js
// globalPlayer(audio)와 각 페이지 UI를 연결하는 컨트롤러

const GP = window.globalPlayer;
const tracks = window.GlobalTracks || [];

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

window.addEventListener("DOMContentLoaded", () => {
  if (!GP || !tracks.length) return;
  GP.init();

  cacheElements();
  bindEvents();
  syncUIFromPlayer();
  buildTracklist();
  if (canvas) {
    loadWaveform(tracks[GP.currentTrackIndex].audioSrc);
    window.addEventListener("resize", () => {
      resizeCanvas();
      if (waveformData) drawBaseWaveform(waveformData);
    });
  }
});

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
  footerPlayPauseBtn = document.getElementById("footer-play-pause-btn");

  currentTimeSpan = document.getElementById("current-time");
  durationTimeSpan = document.getElementById("duration-time");

  artistNameEl = document.getElementById("artist-name");
  trackTitleEl = document.getElementById("track-title");
  albumCoverEl = document.getElementById("album-cover");
  tracklistContainer = document.getElementById("tracklist");

  progressBar = document.getElementById("progress-bar");
  volumeSlider = document.getElementById("volume-slider");
  footerCurrentTime = document.getElementById("footer-current-time");
  footerDurationTime = document.getElementById("footer-duration-time");

  volumeIcon = document.querySelector(".volume-icon");

  // 초기 볼륨 슬라이더
  if (volumeSlider) {
    volumeSlider.value = (GP.audio.volume || 0.8) * 100;
  }
}

// -----------------------
// 이벤트 바인딩
// -----------------------
function bindEvents() {
  // 메인 플레이 버튼
  if (playPauseBtn) {
    playPauseBtn.onclick = () => {
      GP.togglePlay();
      updatePlayIcons();
    };
  }

  // footer 플레이 버튼
  if (footerPlayPauseBtn) {
    footerPlayPauseBtn.onclick = () => {
      GP.togglePlay();
      updatePlayIcons();
    };
  }

  // 볼륨 조절
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const v = e.target.value / 100;
      GP.setVolume(v);
      updateVolumeIcon();
    });
  }

  // 음소거 토글
  if (volumeIcon) {
    volumeIcon.addEventListener("click", () => {
      if (GP.audio.volume > 0) {
        sessionStorage.setItem("gp_prevVolume", GP.audio.volume);
        GP.setVolume(0);
        if (volumeSlider) volumeSlider.value = 0;
      } else {
        const prev = parseFloat(sessionStorage.getItem("gp_prevVolume"));
        const v = !isNaN(prev) ? prev : 0.8;
        GP.setVolume(v);
        if (volumeSlider) volumeSlider.value = v * 100;
      }
      updateVolumeIcon();
    });
  }

  // 진행바
  if (progressBar) {
    progressBar.addEventListener("input", (e) => {
      isSeeking = true;
      const displayTime = (e.target.value / 100) * GP.audio.duration;
      if (footerCurrentTime) footerCurrentTime.textContent = formatTime(displayTime);
    });

    progressBar.addEventListener("change", (e) => {
      isSeeking = false;
      if (!isNaN(GP.audio.duration)) {
        GP.audio.currentTime = (e.target.value / 100) * GP.audio.duration;
      }
    });
  }

  // 웨이브폼 클릭으로 탐색
  if (canvas) {
    canvas.addEventListener("click", (event) => {
      if (!GP.audio.duration) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickRatio = clickX / rect.width;
      GP.audio.currentTime = clickRatio * GP.audio.duration;
    });
  }

  // 오디오 이벤트
  GP.audio.addEventListener("timeupdate", () => {
    updateTimeAndProgress();
    if (canvas && waveformData && GP.audio.duration) {
      drawBaseWaveform(waveformData);
      const progress = GP.audio.currentTime / GP.audio.duration;
      drawProgressWaveform(waveformData, progress);
    }
  });

  GP.audio.addEventListener("loadedmetadata", () => {
    if (durationTimeSpan) durationTimeSpan.textContent = formatTime(GP.audio.duration);
    if (footerDurationTime) footerDurationTime.textContent = formatTime(GP.audio.duration);
  });

  GP.audio.addEventListener("play", updatePlayIcons);
  GP.audio.addEventListener("pause", updatePlayIcons);
}

// -----------------------
// 트랙리스트
// -----------------------
function buildTracklist() {
  if (!tracklistContainer) return;
  tracklistContainer.innerHTML = "";

  tracks.forEach((track, idx) => {
    const div = document.createElement("div");
    div.classList.add("track-item");
    if (idx === GP.currentTrackIndex) div.classList.add("active");

    div.innerHTML = `
      <img src="${track.albumCover}" alt="앨범 커버" />
      <div class="track-details">
        <div class="title">${track.title}</div>
        <div class="artist">${track.artist}</div>
      </div>
      <div class="play-icon">▶</div>
    `;

    div.onclick = () => {
      if (idx !== GP.currentTrackIndex) {
        GP.setTrack(idx);
        highlightActiveTrack(idx);
        if (canvas) {
          loadWaveform(tracks[idx].audioSrc);
        }
        syncUIFromPlayer();
      } else {
        GP.togglePlay();
      }
      updatePlayIcons();
    };

    tracklistContainer.appendChild(div);
  });
}

function highlightActiveTrack(activeIdx) {
  if (!tracklistContainer) return;
  const items = tracklistContainer.querySelectorAll(".track-item");
  items.forEach((el, idx) => {
    el.classList.toggle("active", idx === activeIdx);
  });
}

// -----------------------
// UI 동기화
// -----------------------
function syncUIFromPlayer() {
  const idx = GP.currentTrackIndex;
  const track = tracks[idx];

  if (artistNameEl) artistNameEl.textContent = track.artist;
  if (trackTitleEl) trackTitleEl.textContent = track.title;
  if (albumCoverEl) albumCoverEl.src = track.albumCover;

  if (tracklistContainer) highlightActiveTrack(idx);

  updatePlayIcons();
  updateTimeAndProgress();

  updateVolumeIcon();

  if (canvas && track.audioSrc) {
    loadWaveform(track.audioSrc);
  }
}

function updatePlayIcons() {
  const isPlaying = !GP.audio.paused;

  if (playPauseBtn) {
    const p = playPauseBtn.querySelector(".play");
    const s = playPauseBtn.querySelector(".pause");
    if (p && s) {
      p.style.display = isPlaying ? "none" : "inline";
      s.style.display = isPlaying ? "inline" : "none";
    }
  }
  if (footerPlayPauseBtn) {
    const p = footerPlayPauseBtn.querySelector(".play");
    const s = footerPlayPauseBtn.querySelector(".pause");
    if (p && s) {
      p.style.display = isPlaying ? "none" : "inline";
      s.style.display = isPlaying ? "inline" : "none";
    }
  }
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
}

function updateVolumeIcon() {
  if (!volumeIcon) return;
  if (GP.audio.volume === 0) {
    volumeIcon.textContent = "🔇";
  } else {
    volumeIcon.textContent = "🔊";
  }
}

// -----------------------
// 웨이브폼
// -----------------------
function resizeCanvas() {
  if (!canvas || !ctx) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
}

async function calculateWaveformData(audioURL, samples = 1200) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    console.error("파형 계산 중 오류:", err);
    return null;
  }
}

async function loadWaveform(src) {
  if (!canvas || !ctx) return;
  waveformData = await calculateWaveformData(src);
  if (waveformData) {
    drawBaseWaveform(waveformData);
  }
}

function drawBaseWaveform(data) {
  if (!canvas || !ctx || !data) return;  // ★ 추가

  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, width, height);

  const barWidth = width / data.length;
  ctx.fillStyle = "#555";

  data.forEach((value, i) => {
    const barHeight = value * height * 0.9;
    const x = i * barWidth;
    const y = height - barHeight;
    ctx.fillRect(x, y, barWidth * 0.92, barHeight);
  });
}

function drawProgressWaveform(data, progress) {
  if (!canvas || !ctx || !data) return;  // ★ 추가

  const width = canvas.width / (window.devicePixelRatio || 1);
  const height = canvas.height / (window.devicePixelRatio || 1);

  const barWidth = width / data.length;
  const progressIndex = Math.floor(data.length * progress);

  ctx.fillStyle = "#ff5500";

  for (let i = 0; i < progressIndex; i++) {
    const barHeight = data[i] * height * 0.9;
    const x = i * barWidth;
    const y = height - barHeight;
    ctx.fillRect(x, y, barWidth * 0.92, barHeight);
  }
}

// -----------------------
// 유틸
// -----------------------
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

