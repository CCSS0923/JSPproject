// src/public/js/router.js
// 페이지 새로고침 없이 이동(SPA)하여 오디오 끊김을 방지하는 라우터

document.addEventListener('DOMContentLoaded', () => {
    // 1. 링크 클릭 가로채기
    document.body.addEventListener('click', e => {
        const link = e.target.closest('a');
        // href가 있고, 같은 도메인이며, javascript:void(0)이 아닌 경우
        if (link && link.href && link.href.startsWith(location.origin) && !link.href.includes('javascript')) {
            e.preventDefault(); // 브라우저의 기본 이동(새로고침) 막기
            navigate(link.href);
        }
    });

    // 2. 뒤로가기/앞으로가기 버튼 감지
    window.addEventListener('popstate', () => {
        loadPage(location.href, false);
    });
});

// 페이지 이동 함수
function navigate(url) {
    history.pushState(null, null, url); // 주소창 URL 변경
    loadPage(url, true);
}

// 실제 페이지 내용을 가져와서 교체하는 함수
async function loadPage(url, isPush) {
    try {
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');

        // A. 메인 콘텐츠 교체 (.main-content 클래스 기준)
        const newMain = newDoc.querySelector('.main-content');
        const currentMain = document.querySelector('.main-content');
        if (newMain && currentMain) {
            currentMain.innerHTML = newMain.innerHTML;
            // 클래스명도 동기화 (track-layout 등 레이아웃 스타일 유지를 위해)
            currentMain.className = newMain.className; 
        }

        // B. 타이틀 교체
        document.title = newDoc.title;

        // C. CSS 파일 교체 (track.css <-> home.css)
        swapStylesheets(newDoc);

        // D. 페이지별 스크립트 재실행 로직
        // URL에 따라 필요한 초기화 함수를 호출합니다.
        if (url.includes('home.html')) {
            // 홈 화면이면 트랙 리스트 렌더링
            if (window.GlobalTracks && typeof renderHomeTracks === 'function') {
                renderHomeTracks(window.GlobalTracks);
            }
        } else if (url.includes('index.html')) {
            // 플레이어 화면이면 UI 초기화
            // player.js에 있는 초기화 로직을 호출하기 위해 이벤트 발송
            window.dispatchEvent(new Event('tracksLoaded'));
        }

    } catch (err) {
        console.error('페이지 로드 실패:', err);
        window.location.href = url; // 에러 나면 그냥 쌩으로 이동
    }
}

// CSS 파일 교체 로직 (다크모드/레이아웃 유지)
function swapStylesheets(newDoc) {
    const currentLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const newLinks = Array.from(newDoc.querySelectorAll('link[rel="stylesheet"]'));

    // 새 페이지에만 있는 CSS 추가
    newLinks.forEach(newLink => {
        const href = newLink.getAttribute('href');
        // 이미 있는지 확인 (파일명으로 비교)
        const exists = currentLinks.some(curr => curr.getAttribute('href').includes(href.split('/').pop()));
        
        if (!exists) {
            const linkTag = document.createElement('link');
            linkTag.rel = 'stylesheet';
            linkTag.href = href;
            document.head.appendChild(linkTag);
        }
    });

    // 현재 페이지에만 있고 새 페이지엔 없는 CSS 제거 (선택 사항: 스타일 충돌 방지)
    // 여기서는 home.css와 track.css가 서로 충돌할 수 있으므로 정리해줍니다.
    currentLinks.forEach(currLink => {
        const href = currLink.getAttribute('href');
        // 공통 CSS(index.css, library.css)는 건드리지 않음
        if (href.includes('index.css') || href.includes('library.css')) return;

        const existsInNew = newLinks.some(n => n.getAttribute('href').includes(href.split('/').pop()));
        if (!existsInNew) {
            currLink.remove();
        }
    });
}