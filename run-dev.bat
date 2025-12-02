chcp 65001 >nul
@echo off

REM 배치 파일이 위치한 폴더(JSPproject)를 기준으로 작업 디렉토리 설정
cd /d "%~dp0"

REM 실행할 메인 Node.js 스크립트
SET "SERVER_SCRIPT=server.js"

REM 환경 변수 설정
SET "NODE_ENV=development"

REM 콘솔 제목
title JSPproject Node Server (DEV Mode)

cls
echo "JSPproject" 폴더에서 Node.js 개발자 서버를 시작합니다...
echo.
echo 환경 모드: %NODE_ENV%
echo 실행 경로: node (시스템 설치 버전)
echo 스크립트: "%SERVER_SCRIPT%"
echo.

REM Node.js 서버 실행 (설치 버전)
node "%SERVER_SCRIPT%"

echo.
echo --- 서버 실행 종료 ---
echo 서버를 종료하려면 [Ctrl + C]를 누르세요.
echo 엔터 키를 누르면 창이 닫힙니다.
pause
