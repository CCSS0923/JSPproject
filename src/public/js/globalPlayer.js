// globalPlayer.js
// 모든 페이지에서 공유할 전역 오디오 플레이어 + 상태 저장

const GlobalTracks = [
  {
    id: 1,
    title: "Kairikibear - Darling Dance",
    artist: "Kairikibear",
    album: "Darling Dance 앨범",
    audioSrc: "../assets/달링 댄스.mp3",
    albumCover: "../assets/albumart.jpg"
  },
  {
    id: 2,
    title: "두번째 곡 예시",
    artist: "artist 2",
    album: "앨범 2",
    audioSrc: "../assets/sample2.mp3",
    albumCover: "../assets/sample2_album.jpg"
  }
];

window.GlobalTracks = GlobalTracks;

if (!window.globalPlayer) {
  const audio = new Audio();
  const KEY_PREFIX = "gp_";

  const gp = {
    audio,
    tracks: GlobalTracks,
    currentTrackIndex: 0,
    initialized: false,

    init() {
      if (this.initialized) return;
      this.audio.crossOrigin = "anonymous";
      this.restoreState();
      this.addListeners();
      this.initialized = true;
    },

    addListeners() {
      ["timeupdate", "play", "pause", "ended"].forEach((evt) => {
        this.audio.addEventListener(evt, () => this.saveState());
      });
    },

    saveState() {
      sessionStorage.setItem(KEY_PREFIX + "trackIndex", this.currentTrackIndex);
      sessionStorage.setItem(KEY_PREFIX + "currentTime", this.audio.currentTime);
      sessionStorage.setItem(KEY_PREFIX + "isPlaying", this.audio.paused ? "0" : "1");
      sessionStorage.setItem(KEY_PREFIX + "volume", this.audio.volume);
    },

    restoreState() {
      const idx = parseInt(sessionStorage.getItem(KEY_PREFIX + "trackIndex"));
      const time = parseFloat(sessionStorage.getItem(KEY_PREFIX + "currentTime"));
      const vol = parseFloat(sessionStorage.getItem(KEY_PREFIX + "volume"));
      const isPlaying = sessionStorage.getItem(KEY_PREFIX + "isPlaying");

      if (!isNaN(idx) && this.tracks[idx]) {
        this.currentTrackIndex = idx;
      } else {
        this.currentTrackIndex = 0;
      }

      this.audio.src = this.tracks[this.currentTrackIndex].audioSrc;

      if (!isNaN(time)) {
        this.audio.currentTime = time;
      }
      this.audio.volume = !isNaN(vol) ? vol : 0.8;

      if (isPlaying === "1") {
        this.audio.play().catch(() => {});
      }
    },

    setTrack(index) {
      if (!this.tracks[index]) return;
      this.currentTrackIndex = index;
      this.audio.src = this.tracks[index].audioSrc;
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {});
      this.saveState();
    },

    togglePlay() {
      if (this.audio.paused) {
        this.audio.play().catch(() => {});
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
}

console.log("%c[globalPlayer] ready", "color:#0f0");
