// src/public/js/router.js

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', e => {
        const link = e.target.closest('a');
        if (!link) return;

        let href = link.getAttribute('href');
        if (!href || href.startsWith('javascript')) return;

        // html 파일인데 /html/ 경로가 빠진 경우 보정
        if (!href.startsWith('http') && href.endsWith('.html') && !href.includes('/html/')) {
            href = '/html/' + href.replace(/^\/+/, '');
        }

        // ★ 항상 절대 URL로 변환해서 경로 중첩 방지
        const absoluteUrl = new URL(href, location.origin).href;
        if (!absoluteUrl.startsWith(location.origin)) return; // 외부 링크는 패스

        e.preventDefault();
        navigate(absoluteUrl);
    });

    window.addEventListener('popstate', () => {
        loadPage(location.href, false);
    });
});

function navigate(url) {
    history.pushState(null, null, url);
    loadPage(url, true);
}

async function loadPage(url, isPush) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');

        const newMain = newDoc.querySelector('.main-content');
        const currentMain = document.querySelector('.main-content');
        if (newMain && currentMain) {
            currentMain.innerHTML = newMain.innerHTML;
            currentMain.className = newMain.className;
        }

        // ★ library-nav 교체 (없으면 새로 생성해서 main 앞에 꽂기)
        const newLibNav = newDoc.querySelector('.library-nav');
        let currentLibNav = document.querySelector('.library-nav');

        if (newLibNav) {
            if (!currentLibNav && currentMain && currentMain.parentNode) {
                // 현재 페이지에는 nav가 없으므로 새로 만들어서 main 앞에 삽입
                currentLibNav = newLibNav.cloneNode(true);
                currentMain.parentNode.insertBefore(currentLibNav, currentMain);
            } else if (currentLibNav) {
                // 이미 있으면 내용만 교체
                currentLibNav.innerHTML = newLibNav.innerHTML;
            }
        }
        // ★ library-nav 제거 로직 추가
        if (!newDoc.querySelector('.library-nav')) {
            const currentLibNav = document.querySelector('.library-nav');
            if (currentLibNav) currentLibNav.remove();
        }

        // ★ 고정 플레이어 바는 절대 덮어쓰지 않음
        const newFooter = newDoc.querySelector('.player-bar');
        const currentFooter = document.querySelector('.player-bar');

        // 새 페이지에 footer가 있어도 무시하고 현재 footer 유지
        if (newFooter && !currentFooter) {
            // 만약 어떤 이유로 footer가 제거된 경우만 복구
            document.body.appendChild(currentFooter);
        }


        document.title = newDoc.title;
        swapStylesheets(newDoc);
        await ensureLibraryScriptIfNeeded(url);

        // 페이지별 초기화
        if (url.includes('home.html')) {
            if (window.GlobalTracks && typeof window.renderHomeTracks === 'function') {
                window.renderHomeTracks(window.GlobalTracks);
            }
        } else if (url.includes('index.html')) {
            window.dispatchEvent(new Event('tracksLoaded'));
        } else if (url.includes('playlist.html')) {
            if (typeof window.initPlaylistPage === 'function') {
                window.initPlaylistPage();
            }
        } else if (url.includes('library')) {
            if (typeof window.initLibraryPage === 'function') {
                window.initLibraryPage();
            }
        }

        // 공통: 헤더(인증 상태) 업데이트
        if (typeof window.renderAuth === 'function') {
            window.renderAuth();
        }

    } catch (err) {
        console.error('페이지 로드 실패:', err);
        window.location.href = url;
    }
}

async function ensureLibraryScriptIfNeeded(url) {
    if (!url.includes('/library')) return;
    if (window.initLibraryPage) return;
    if (document.querySelector('script[src*="/js/library.js"]')) return;

    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = '/js/library.js';
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
    });
}

function swapStylesheets(newDoc) {
    const currentLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const newLinks = Array.from(newDoc.querySelectorAll('link[rel="stylesheet"]'));

    newLinks.forEach(newLink => {
        const href = newLink.getAttribute('href');
        const exists = currentLinks.some(curr => curr.getAttribute('href').includes(href.split('/').pop()));
        
        if (!exists) {
            const linkTag = document.createElement('link');
            linkTag.rel = 'stylesheet';
            linkTag.href = href;
            document.head.appendChild(linkTag);
        }
    });

    currentLinks.forEach(currLink => {
        const href = currLink.getAttribute('href');
        if (href.includes('index.css') || href.includes('library.css')) return;

        const existsInNew = newLinks.some(n => n.getAttribute('href').includes(href.split('/').pop()));
        if (!existsInNew) {
            currLink.remove();
        }
    });
}
