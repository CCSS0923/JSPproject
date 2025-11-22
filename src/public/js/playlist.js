// src/public/js/playlist.js

window.initPlaylistPage = async function () {
    const params = new URLSearchParams(location.search);
    const playlistId = params.get("id");
    if (!playlistId) {
        console.warn("playlistId 없음");
        return;
    }

    try {
        const res = await fetch(`http://localhost:3000/api/playlist/${playlistId}`);
        const data = await res.json();

        // 제목 세팅
        document.getElementById("playlist-title").textContent = data.title || "Untitled Playlist";
        document.getElementById("playlist-meta").textContent = `Created by ${data.owner || "Unknown"}`;

        // 트랙 컨테이너
        const container = document.getElementById("playlist-tracks");
        container.innerHTML = "";

        if (!data.tracks || data.tracks.length === 0) {
            container.innerHTML = `<div style="padding:20px;color:#999">트랙 없음</div>`;
            return;
        }

        const tracks = data.tracks;

        tracks.forEach((track, idx) => {
            const item = document.createElement("div");
            item.className = "track-item";
            item.innerHTML = `
                <img src="${track.albumCover}" onerror="this.src='../assets/albumart.jpg'"/>
                <div style="flex:1">
                    <div>${idx + 1}. ${track.title}</div>
                    <div style="font-size:12px;color:#aaa">${track.artist}</div>
                </div>
            `;
            item.onclick = () => {
                const globalListIndex = window.GlobalTracks.findIndex(t => t.id === track.id);
                if (globalListIndex !== -1) {
                    GP.setTrack(globalListIndex);
                }
            };
            container.appendChild(item);
        });
    } catch (err) {
        console.error("Playlist load error:", err);
        document.getElementById("playlist-tracks").innerHTML =
            `<div style="padding:20px;color:#e66">플레이리스트 로드 실패</div>`;
    }
};
