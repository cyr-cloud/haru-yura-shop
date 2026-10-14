/* ===========================================================
   유라문구 — 마이페이지의 「내 주문」 목록을 실시간으로 듣는 코드
   Firestore 의 orders 에서 내 주문만 골라 듣고, 바뀔 때마다 다시 그립니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// Firebase 연결은 auth.js 가 이미 넣어 둔 값으로 해 둡니다. 여기서는 그것을 받아 씁니다.
import { onUser } from "./auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const db = getFirestore(getApp());

const box = document.querySelector("#order-list");
const stoppedLine = document.querySelector("#orders-stopped");

// 이 값이면 주문이 끝난 것입니다 - 더 바뀔 일이 없습니다
const DONE = ["delivered", "canceled"];

// 지금 걸려 있는 리스너를 끄는 함수 (안 걸려 있으면 null)
let stopListening = null;
// 지금 누구의 주문을 듣고 있는지 - 같은 사람에게 두 번 걸지 않으려고 적어 둡니다
let listeningUid = null;

// 주문한 날을 밀리초로 바꿉니다 (정렬용). 날짜가 없거나 모르는 꼴이면 0
function orderMillis(o) {
  const t = o.createdAt;
  return t && typeof t.toMillis === "function" ? t.toMillis() : 0;
}

// 주문한 날을 화면에 적을 글자로 바꿉니다
function dayLine(o) {
  const t = o.createdAt;
  if (t && typeof t.toDate === "function") return t.toDate().toLocaleString("ko-KR");
  return t == null ? "" : String(t);
}

// 상품 이름들을 한 줄로 잇습니다 (두 개 이상 산 것만 수량을 붙입니다)
function namesLine(o) {
  if (!Array.isArray(o.items)) return "";
  return o.items
    .map(i => String(i.name ?? "") + (Number(i.quantity) > 1 ? " × " + i.quantity : ""))
    .join(", ");
}

function totalLine(o) {
  return typeof o.totalPrice === "number" ? won(o.totalPrice) : String(o.totalPrice ?? "");
}

function sayLine(text) {
  const line = document.createElement("p");
  line.className = "empty";
  line.textContent = text;
  box.replaceChildren(line);
}

function paintOrders(snap) {
  if (snap.empty) {
    sayLine("아직 주문하신 것이 없습니다.");
    return;
  }

  // 쿼리에는 정렬을 넣지 않았습니다. 받은 뒤에 여기서 최신순으로 늘어놓습니다.
  // 서버 시각이 아직 안 찍힌 방금 주문은 어림한 시각으로 받아 맨 위에 오게 합니다.
  const orders = snap.docs
    .map(d => d.data({ serverTimestamps: "estimate" }))
    .sort((a, b) => orderMillis(b) - orderMillis(a));

  const table = document.createElement("table");
  table.className = "cart";

  const head = table.insertRow();
  ["주문한 날", "상품", "합계", "상태"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    head.append(th);
  });

  orders.forEach(o => {
    const row = table.insertRow();
    // Firestore 에서 온 값은 글자로만 넣습니다. status 는 저장된 값 그대로입니다.
    [dayLine(o), namesLine(o), totalLine(o), String(o.status ?? "")].forEach(text => {
      row.insertCell().textContent = text;
    });
  });

  box.replaceChildren(table);
}

function listen(uid) {
  // 내 주문만 Firestore 쿼리에서 골라 듣습니다 - 컬렉션 전체를 듣지 않습니다
  const mine = query(collection(db, "orders"), where("userId", "==", uid));

  stopListening = onSnapshot(mine, snap => {
    const changed = snap.docChanges().map(c => c.type + " " + c.doc.id).join(", ");
    console.log("[주문 알림] 내 주문 " + snap.size + "건 · 이번에 바뀐 것: " + (changed || "없음"));
    paintOrders(snap);

    // 내 주문이 전부 끝났으면 더 바뀔 일이 없으므로 그만 듣습니다.
    // 하나라도 paid · preparing · shipped 처럼 끝나지 않은 값이면 계속 듣습니다.
    // 주문이 한 건도 없을 때는 새 주문이 들어올 수 있으므로 계속 듣습니다.
    const allDone = !snap.empty && snap.docs.every(d => DONE.includes(d.data().status));
    if (allDone && stopListening) {
      // onSnapshot 이 돌려준 함수를 부르면 리스너가 해제됩니다.
      // listeningUid 는 그대로 두므로, 새로 고치기 전에는 다시 걸리지 않습니다.
      stopListening();
      stopListening = null;
      console.log("[그만 듣기] 내 주문 " + snap.size + "건이 모두 delivered 또는 canceled 라서 리스너를 해제했습니다");
      if (stoppedLine) stoppedLine.hidden = false;
    }
  }, error => {
    // 오류 글은 줄이지 않고 콘솔에 그대로, 화면에는 한 줄만
    console.error(error);
    sayLine("주문을 불러오지 못했습니다");
  });
}

// 로그인한 사람이 누구인지 확인된 뒤에만 듣기 시작합니다.
// onUser 는 상태가 바뀔 때마다 다시 불리므로, 같은 사람이면 다시 걸지 않습니다.
if (box) {
  onUser(user => {
    const uid = user ? user.uid : null;
    if (uid === listeningUid) return;

    // 사람이 바뀌었거나 나갔으면 걸어 둔 것을 끕니다
    if (stopListening) { stopListening(); stopListening = null; }
    listeningUid = uid;
    if (stoppedLine) stoppedLine.hidden = true;
    if (uid) listen(uid);
  });
}
