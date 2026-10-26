/* ===========================================================
   유라문구 — 주문을 마친 손님에게만 알림을 받을지 묻는 카드
   이 카드를 띄우는 자리는 둘뿐입니다.
     ① 결제를 마치고 뜨는 주문 완료 화면 (done.js)
     ② 상품 상세에서 「바로 주문」 뒤 「주문했습니다」 바로 아래 (products.js)
   브라우저의 알림 허락 창은 손님이 [받을게요!] 를 누른 그 순간에만 띄웁니다.
   알림 받을 주소(토큰)는 아직 받지 않습니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// 「나중에」를 누른 주문 번호를 적어 두는 이름 - 이번 주문에서만 카드를 숨깁니다
const LATER_KEY = "haru_push_later_";

function saidLater(orderId) {
  try {
    return sessionStorage.getItem(LATER_KEY + orderId) === "1";
  } catch (error) {
    return false;
  }
}

function rememberLater(orderId) {
  try {
    sessionStorage.setItem(LATER_KEY + orderId, "1");
  } catch (error) {
    /* 저장을 막아 둔 브라우저면 그냥 넘어갑니다 - 지금 화면에서는 카드가 숨겨집니다 */
  }
}

// 허락 상태에 맞는 한 줄 - 카드 대신 보여 줍니다
function noteLine(text) {
  const p = document.createElement("p");
  p.className = "push-note";
  p.setAttribute("role", "status");
  p.textContent = text;
  return p;
}

function stateNote(permission) {
  if (permission === "granted") return noteLine("알림을 받고 있어요");
  if (permission === "denied") return noteLine("브라우저 주소창 왼쪽 아이콘 → 알림에서 켤 수 있어요");
  return null;
}

/**
 * 주문을 마친 뒤에 부릅니다. anchor 바로 아래에 카드(또는 한 줄)를 붙입니다.
 * 페이지를 열 때 부르지 않습니다 - 주문이 끝난 순간에만 부릅니다.
 */
export function showPushAsk(anchor, orderId) {
  // 알림을 쓸 수 없는 브라우저면 아무것도 보여 주지 않습니다
  if (!anchor || !("Notification" in window)) return;

  // 같은 화면에서 다시 주문했으면 앞의 카드나 한 줄을 먼저 치웁니다
  const old = anchor.parentNode.querySelector(".push-ask, .push-note");
  if (old) old.remove();

  const note = stateNote(Notification.permission);
  if (note) {
    anchor.after(note);
    return;
  }

  // 이번 주문에서 「나중에」를 눌렀으면 카드를 띄우지 않습니다
  if (saidLater(orderId)) return;

  const card = document.createElement("section");
  card.className = "push-ask";
  card.innerHTML =
    '<h3>배송이 출발하면 알림 받기</h3>' +
    '<button type="button" class="btn" data-push="yes">받을게요!</button>' +
    '<button type="button" class="btn ghost" data-push="later">나중에 할게요</button>';

  card.querySelector('[data-push="yes"]').addEventListener("click", async () => {
    // 단추를 누른 이 처리 안에서만 브라우저의 알림 허락 창을 띄웁니다
    const result = await Notification.requestPermission();
    console.log("알림 허락 결과: " + result);

    // 결과에 맞는 한 줄로 바꿉니다 - 창을 그냥 닫았으면(default) 카드를 그대로 둡니다
    const line = stateNote(result);
    if (line) card.replaceWith(line);
  });

  card.querySelector('[data-push="later"]').addEventListener("click", () => {
    rememberLater(orderId);
    card.remove();
  });

  anchor.after(card);
}
