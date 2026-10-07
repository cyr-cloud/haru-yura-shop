/* ===========================================================
   유라문구 — 로그인 상태를 다루는 코드
   로그인했는지 묻는 자리(onAuthStateChanged)는 이 파일 한 곳에만 둡니다.
   모든 화면이 이 파일을 불러 쓰고, 머리글의 로그인 자리도 이 파일이 그립니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

/* --- 1. Firebase 연결 - 이미 넣어 둔 값을 그대로 씁니다 --- */
const firebaseConfig = {
  apiKey: "AIzaSyB2-PKanGft-tIZ8EKY-F0k4_J5d0TGxTQ",
  authDomain: "haru-shop-602ec.firebaseapp.com",
  projectId: "haru-shop-602ec",
  storageBucket: "haru-shop-602ec.firebasestorage.app",
  messagingSenderId: "611286084304",
  appId: "1:611286084304:web:25619a81bdf5811c4b4cd5"
};

// 다른 화면 코드가 이미 연결해 두었으면 그것을 그대로 쓰고, 없을 때만 새로 연결합니다
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Firebase 가 보내는 메일을 한국어로 보냅니다.
// 이 값을 정해 두면 Firebase 가 한국어 본문으로 보냅니다.
auth.languageCode = "ko";

/* --- 2. 로그인했는지 묻는 자리 - 가게 전체에서 여기 한 곳뿐입니다 --- */

// 지금 들어와 있는 사람 (아직 모를 때는 null)
let currentUser = null;
// 처음 확인이 끝났는지 - 끝나기 전의 null 과 "로그인 안 함" 을 구분하기 위한 표시
let checked = false;
// 확인 결과를 받아 갈 화면들의 할 일 목록
const listeners = [];
// 로그아웃 때문에 첫 화면으로 떠나는 중인지
let leaving = false;

onAuthStateChanged(auth, user => {
  currentUser = user;
  checked = true;
  // 머리글을 먼저 맞춰 둡니다
  paintAuthNav(user);
  listeners.forEach(fn => fn(user));
});

/**
 * 로그인 상태를 알려 달라고 신청합니다.
 * 확인이 끝나는 순간 한 번, 그 뒤로 상태가 바뀔 때마다 다시 불립니다.
 */
export function onUser(fn) {
  listeners.push(fn);
  // 이미 확인이 끝난 뒤에 신청했으면 기다리지 않고 바로 한 번 알려 줍니다
  if (checked) fn(currentUser);
}

/** 확인이 끝났는지 */
export function isChecked() {
  return checked;
}

/* --- 3. 로그아웃 - 끝나면 첫 화면으로 갑니다 --- */
export async function logout() {
  // 이 표시를 먼저 켜 두어야, 지키는 화면이 로그인 화면으로 가로채지 않습니다
  leaving = true;
  try {
    await signOut(auth);
  } catch (error) {
    // 나가지 못했으면 가로채기 막음을 되돌려 둡니다
    leaving = false;
    throw error;
  }
  location.href = "index.html";
}

/* --- 4. 인증 메일 --- */

/**
 * 인증 메일을 한 통 보냅니다.
 * 기다렸다가 쓰면 보내기가 끝난 뒤에 다음 줄이 돌아갑니다.
 */
export function sendVerifyMail(user) {
  return sendEmailVerification(user);
}

/**
 * 메일 보내기가 안 됐을 때 보여 줄 한 줄로 바꿉니다.
 * 너무 자주 눌러 막힌 경우만 우리 말로 바꾸고, 나머지는 오류 코드 글자 그대로 둡니다.
 */
export function mailErrorLine(error) {
  const code = error && error.code ? error.code : String(error);
  if (code === "auth/too-many-requests") return "잠시 뒤에 다시 눌러 주세요.";
  return code;
}

/* --- 5. 로그인한 사람만 볼 화면을 지킵니다 --- */

// ?next= 에 붙은 값은 이 가게 안의 화면 이름일 때만 씁니다.
// 바깥 주소를 적어 보내는 장난을 막기 위한 확인입니다.
function safeName(value) {
  return /^[A-Za-z0-9_-]+\.html$/.test(value || "") ? value : null;
}

/** 지금 주소의 ?next= 가 쓸 만한 화면 이름이면 그 이름을, 아니면 null 을 줍니다 */
export function nextTarget() {
  return safeName(new URLSearchParams(location.search).get("next"));
}

/** 지금 보고 있는 화면의 파일 이름 (Vercel 이 주소에서 .html 을 떼고 열어 주는 경우도 맞춰 줍니다) */
function hereName() {
  const last = location.pathname.split("/").pop();
  if (!last) return "index.html";
  return last.endsWith(".html") ? last : last + ".html";
}

/**
 * 로그인한 사람만 볼 화면에서 부릅니다.
 * 로그인하지 않았으면 가려던 화면 이름을 달고 로그인 화면으로 보냅니다.
 * 확인이 끝나기 전에는 show 를 부르지 않으므로, 내용이 미리 보이지 않습니다.
 * 메일 인증 여부는 보지 않습니다 - 인증 안 된 계정도 들어올 수 있습니다.
 */
export function requireUser(show) {
  onUser(user => {
    // 로그아웃해서 첫 화면으로 떠나는 중이면 아무것도 하지 않습니다
    if (leaving) return;
    if (!user) {
      location.replace("login.html?next=" + encodeURIComponent(hereName()));
      return;
    }
    show(user);
  });
}

/* --- 6. 머리글의 로그인 자리 --- */
function paintAuthNav(user) {
  const slot = document.querySelector("#auth-nav");
  if (!slot) return;

  if (user) {
    slot.innerHTML =
      '<span class="auth-who"></span>' +
      '<a href="mypage.html">마이페이지</a>' +
      '<button type="button" class="btn ghost" id="auth-logout">로그아웃</button>';
    // 이메일은 글자로만 넣습니다 - HTML 로 넣지 않습니다
    slot.querySelector(".auth-who").textContent = user.email || "";
    slot.querySelector("#auth-logout").addEventListener("click", () => {
      logout().catch(() => { /* 못 나갔으면 머리글을 그대로 둡니다 */ });
    });
  } else {
    slot.innerHTML = '<a href="login.html">로그인</a>';
  }

  // 확인이 끝났으니 이제 보여 줍니다 (그 전에는 숨어 있습니다)
  slot.hidden = false;
}

/* --- 7. 화면을 옮겨 가며 한 줄 전하기 --- */
// 가입을 마치고 다른 화면으로 넘어간 뒤에도 한 줄을 보여 주어야 해서,
// 넘어가기 전에 적어 두고 넘어간 화면에서 꺼내 씁니다. 한 번 보여 주면 지웁니다.
const FLASH_KEY = "haru_auth_flash";

/** 다음 화면에서 한 번 보여 줄 한 줄을 적어 둡니다 */
export function setFlash(text) {
  try {
    sessionStorage.setItem(FLASH_KEY, text);
  } catch (error) {
    /* 저장을 막아 둔 브라우저면 그냥 넘어갑니다 */
  }
}

/** 적어 둔 한 줄을 꺼내고 지웁니다 (없으면 null) */
function takeFlash() {
  try {
    const text = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return text;
  } catch (error) {
    return null;
  }
}

// 적어 둔 한 줄이 있으면 본문 맨 위에 한 번 보여 줍니다
(function paintFlash() {
  const text = takeFlash();
  if (!text) return;
  const box = document.querySelector("main .wrap");
  if (!box) return;
  const line = document.createElement("p");
  line.className = "auth-flash";
  line.setAttribute("role", "status");
  // 글자로만 넣습니다 - HTML 로 넣지 않습니다
  line.textContent = text;
  box.prepend(line);
})();
