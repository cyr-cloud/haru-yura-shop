/* ===========================================================
   유라문구 — 알림 받는 주소(FCM 토큰)를 받아 Firestore 에 적는 코드
   알림 권한이 granted 이고 손님이 로그인한 상태일 때만 받습니다.
   받는 때는 둘입니다.
     ① 주문을 마친 화면의 [받을게요!] 로 granted 가 된 바로 그 자리 (push-ask.js)
     ② 가게의 어느 화면이든 열 때마다 (auth.js 가 이 파일을 불러옵니다)
   토큰 값은 화면에도 Console 에도 찍지 않습니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// Firebase 연결은 auth.js 가 이미 넣어 둔 값으로 해 둡니다. 여기서는 그것을 받아 씁니다.
import { auth } from "./auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const db = getFirestore(getApp());

// 토큰을 받을 때 쓰는 VAPID 공개 키
const VAPID_KEY = "BOxy-VVG1OrkhHm0patrFrTMqng5hew7IfS6st0WAZdEd4eC4emcFwhP3I-1sGMWHlNF7ThDkfGHkbAc7wjPIK8";
// 같은 토큰을 다시 쓰지 않는 기간 - 30일
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

// 실패하면 오류 이름만 한 줄 남깁니다 - 오류 글에는 손대지 않고, 토큰 값도 찍지 않습니다
function logFail(step, error) {
  const name = error && (error.code || error.name) ? (error.code || error.name) : "Error";
  console.log("알림 주소 " + step + " 실패: " + name);
}

/**
 * 알림 받는 주소를 받아 pushTokens/{UID} 에 적습니다.
 * always 가 true 면(①) 늘 적고, false 면(②) 적어 둔 것과 같고 30일 안일 때 다시 쓰지 않습니다.
 */
export async function savePushToken(always) {
  // 알림 권한이 granted 일 때만
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator)) return;

  // 로그인 확인이 끝날 때까지 기다린 뒤에 봅니다 - 로그인한 손님일 때만
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return;

  let token;
  try {
    if (!(await isSupported())) return;
    // 앞에서 등록한 서비스 워커를 함께 넘깁니다 (이미 등록돼 있으면 그 등록을 그대로 돌려받습니다)
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    token = await getToken(getMessaging(getApp()), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
  } catch (error) {
    logFail("받기", error);
    return;
  }
  if (!token) return;

  const ref = doc(db, "pushTokens", user.uid);
  try {
    if (!always) {
      const snap = await getDoc(ref);
      const saved = snap.exists() ? snap.data() : null;
      const at = saved && saved.updatedAt ? saved.updatedAt.toMillis() : 0;
      // 적어 둔 토큰이 지금 받은 것과 같고 30일 안이면 다시 쓰지 않습니다
      if (saved && saved.token === token && Date.now() - at < KEEP_MS) return;
    }
    // 문서가 있으면 이 두 필드만 고치고, 없으면 새로 만듭니다. 시각은 서버 시각입니다
    await setDoc(ref, { token, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    logFail("쓰기", error);
  }
}

// ② 화면을 열 때마다 한 번
savePushToken(false);
