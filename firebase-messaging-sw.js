/* ===========================================================
   유라문구 — 웹 푸시 알림을 받는 서비스 워커
   이 파일은 index.html 과 같은 맨 위 폴더에 있어야 합니다.
   assets/auth.js 가 이 파일을 브라우저에 등록합니다.
   Firebase 버전은 가게 화면과 같은 12.19.0 을 씁니다.
   =========================================================== */

// 서비스 워커용 Firebase 묶음 - 앱 묶음 · 알림 묶음
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

// 가게 화면(assets/auth.js)과 같은 Firebase 설정 값입니다
firebase.initializeApp({
  apiKey: "AIzaSyB2-PKanGft-tIZ8EKY-F0k4_J5d0TGxTQ",
  authDomain: "haru-shop-602ec.firebaseapp.com",
  projectId: "haru-shop-602ec",
  storageBucket: "haru-shop-602ec.firebasestorage.app",
  messagingSenderId: "611286084304",
  appId: "1:611286084304:web:25619a81bdf5811c4b4cd5"
});

// 알림을 받을 준비만 해 둡니다 - 받은 알림을 어떻게 보여 줄지는 아직 정하지 않았습니다
const messaging = firebase.messaging();
