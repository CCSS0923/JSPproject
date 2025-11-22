// src/public/js/globalPlayer.js

window.GlobalTracks = [];

async function fetchTracks() {
  try {
    const res = await fetch('http://localhost:3000/api/tracks');
    if (!res.ok) throw new Error('트랙 로드 실패');
    const data = await res.json();
    
    window.GlobalTracks = data;
    
    if (window.globalPlayer) {
      window.globalPlayer.tracks = data;
      // 데이터 로드 후 상태 복원
      window.globalPlayer.restoreState();
    }

    if (typeof renderHomeTracks === 'function') {
      renderHomeTracks(data);
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
    },

    addListeners() {
      ["timeupdate", "play", "pause", "ended", "volumechange"].forEach((evt) => {
        this.audio.addEventListener(evt, () => {
            this.saveState();
            // [추가] 현재 페이지에 플레이어 UI 업데이트 함수가 있으면 호출 (index.html용)
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
    },

    restoreState() {
      if (this.tracks.length === 0) return;

      const idx = parseInt(sessionStorage.getItem(KEY_PREFIX + "trackIndex"));
      const time = parseFloat(sessionStorage.getItem(KEY_PREFIX + "currentTime"));
      const vol = parseFloat(sessionStorage.getItem(KEY_PREFIX + "volume"));
      const wasPlaying = sessionStorage.getItem(KEY_PREFIX + "isPlaying") === 'true';

      // [수정] 트랙 인덱스 복구 (기본값 0)
      if (!isNaN(idx) && this.tracks[idx]) {
        this.currentTrackIndex = idx;
      } else {
        this.currentTrackIndex = 0;
      }

      // 소스 설정 (현재 소스와 다를 때만 변경하여 불필요한 로딩 방지)
      const targetSrc = new URL(this.tracks[this.currentTrackIndex].audioSrc, document.baseURI).href;
      // 오디오 src가 비어있거나 다를 때만 할당
      if (!this.audio.src || this.audio.src !== targetSrc) {
        this.audio.src = this.tracks[this.currentTrackIndex].audioSrc;
        // 소스가 바뀌었으므로 시간도 복구해야 함
        if (!isNaN(time)) this.audio.currentTime = time;
      } else {
        // 소스가 같다면(이미 로드됨) 시간만 복구 (약간의 오차 허용)
        if (!isNaN(time) && Math.abs(this.audio.currentTime - time) > 1) {
            this.audio.currentTime = time;
        }
      }

      // [수정] 볼륨 복구 (저장된 값이 없으면 기본값 0.25 = 25%)
      this.audio.volume = !isNaN(vol) ? vol : 0.25;

      // [수정] 이전 페이지에서 '재생 중'이었던 경우에만 이어서 재생
      // 페이지 이동 시 브라우저 정책에 의해 자동 재생이 막힐 수 있음
      if (wasPlaying) {
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log("자동 재생 차단됨 (사용자 인터랙션 필요):", error);
          });
        }
      }
    },

    // [수정] 트랙 변경 함수
    setTrack(index) {
      if (!this.tracks[index]) return;
      
      // 만약 같은 곡을 다시 선택한 경우 -> 처음부터 재생할지, 그냥 둘지 결정
      // 여기서는 '명시적 호출'이므로 처음부터 재생으로 처리 (Home에서 제어함)
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
    }
  };

  window.globalPlayer = gp;
  gp.init();
}

fetchTracks();