// // src/public/js/router.js

// document.addEventListener('DOMContentLoaded', () => {
//     document.body.addEventListener('click', e => {
//         const link = e.target.closest('a');
//         if (link && link.href && link.href.startsWith(location.origin) && !link.href.includes('javascript')) {
//             e.preventDefault();
//             navigate(link.href);
//         }
//     });

//     window.addEventListener('popstate', () => {
//         loadPage(location.href, false);
//     });
// });

// function navigate(url) {
//     history.pushState(null, null, url);
//     loadPage(url, true);
// }

// async function loadPage(url, isPush) {
//     try {
//         const response = await fetch(url);
//         const html = await response.text();
//         const parser = new DOMParser();
//         const newDoc = parser.parseFromString(html, 'text/html');

//         const newMain = newDoc.querySelector('.main-content');
//         const currentMain = document.querySelector('.main-content');
//         if (newMain && currentMain) {
//             currentMain.innerHTML = newMain.innerHTML;
//             currentMain.className = newMain.className; 
//         }

//         document.title = newDoc.title;
//         swapStylesheets(newDoc);

//         // [수정] 페이지별 초기화 로직 호출
//         if (url.includes('home.html')) {
//             if (window.GlobalTracks && typeof window.renderHomeTracks === 'function') {
//                 window.renderHomeTracks(window.GlobalTracks);
//             }
//         } else if (url.includes('index.html')) {
//             window.dispatchEvent(new Event('tracksLoaded'));
//         } else if (url.includes('playlist.html')) { // [추가] playlist.html 대응
//             if (typeof window.initPlaylistPage === 'function') {
//                 window.initPlaylistPage();
//             }
//         }

//         // 공통: 헤더(인증 상태) 업데이트
//         if (typeof window.renderAuth === 'function') {
//             window.renderAuth();
//         }

//     } catch (err) {
//         console.error('페이지 로드 실패:', err);
//         window.location.href = url;
//     }
// }

// function swapStylesheets(newDoc) {
//     const currentLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
//     const newLinks = Array.from(newDoc.querySelectorAll('link[rel="stylesheet"]'));

//     newLinks.forEach(newLink => {
//         const href = newLink.getAttribute('href');
//         const exists = currentLinks.some(curr => curr.getAttribute('href').includes(href.split('/').pop()));
        
//         if (!exists) {
//             const linkTag = document.createElement('link');
//             linkTag.rel = 'stylesheet';
//             linkTag.href = href;
//             document.head.appendChild(linkTag);
//         }
//     });

//     currentLinks.forEach(currLink => {
//         const href = currLink.getAttribute('href');
//         if (href.includes('index.css') || href.includes('library.css')) return;

//         const existsInNew = newLinks.some(n => n.getAttribute('href').includes(href.split('/').pop()));
//         if (!existsInNew) {
//             currLink.remove();
//         }
//     });
// }