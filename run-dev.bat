chcp 65001 >nul
@echo off
REM 배치 파일이 위치한 폴더(JSPproject)를 기준으로 경로 설정
SET "NODE_DIR=%~dp0\node-v25.1.0-win-x64"
SET "NODE_EXE=%NODE_DIR%\node.exe"

REM 실행할 메인 Node.js 스크립트 파일
SET "SERVER_SCRIPT=server.js"

REM 환경 변수 NODE_ENV를 'development'로 설정 ⭐️
SET "NODE_ENV=development"

REM 콘솔 창 제목 설정
title JSPproject Node Server (DEV Mode)

cls
echo "JSPproject" 폴더에서 Node.js 개발자 서버를 시작합니다...
echo.
echo 환경 모드: %NODE_ENV%
echo 실행 경로: "%NODE_EXE%"
echo 스크립트: "%SERVER_SCRIPT%"
echo.

REM Node.js 서버 실행
REM 'start' 명령을 제거하여 이 콘솔 창에서 서버를 실행하고 에러 메시지를 바로 볼 수 있게 합니다.
"%NODE_EXE%" "%SERVER_SCRIPT%"

echo.
echo --- 서버 실행 종료 ---
echo 서버를 종료하려면, 이 창에서 [Ctrl + C]를 누르세요.
echo 엔터 키를 누르면 창이 닫힙니다.
pause