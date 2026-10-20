/* ===========================================================
   유라문구 — 주문 완료 화면에서 결제 결과를 받는 코드
   결제 결과(paymentId · code · message)는 이 화면 한 곳에서만 받습니다.
   PC 는 결제 화면이, 휴대폰은 포트원이 이 화면 주소 뒤에 결과를 붙여 보냅니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// Firebase 연결은 auth.js 가 이미 넣어 둔 값으로 해 둡니다. 여기서는 그것을 받아 씁니다.
import { auth } from "./auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const db = getFirestore(getApp());

// 결과 칸에 한 줄씩 그대로 씁니다 - 받은 글자를 꾸미지 않도록 textContent 로만 넣습니다
function show(...lines) {
  const box = document.querySelector("#done-result");
  box.replaceChildren(...lines.map(line => {
    const p = document.createElement("p");
    p.textContent = line;
    return p;
  }));
}

async function receivePayment() {
  const q = new URLSearchParams(location.search);
  const paymentId = q.get("paymentId");
  const code = q.get("code");

  // 주소에 code 가 있으면 실패나 닫기 - 주문은 만들지 않고 장바구니도 그대로 둡니다
  if (code !== null) {
    show(q.get("message") ?? "", "장바구니는 그대로입니다");
    return;
  }

  // paymentId 도 code 도 없으면 아무것도 하지 않습니다
  if (!paymentId) return;

  // 로그인 확인이 끝날 때까지 기다린 뒤에 봅니다 (확인 전의 빈 값을 "로그인 안 함" 으로 보지 않도록)
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    show("로그인한 뒤에 주문할 수 있습니다. 로그인해 주세요");
    return;
  }

  // 장바구니를 비우기 전에, 담긴 상품마다 상품 목록에서 이름과 가격을 찾습니다
  const found = Cart.read().map(i => ({ p: findProduct(i.id), qty: i.qty })).filter(x => x.p);
  // 주문 문서의 items 는 「바로 주문」이 만드는 주문과 같은 모양입니다
  const items = found.map(({ p, qty }) => ({ productId: p.id, name: p.name, price: p.price, quantity: qty }));
  // 장바구니 합계 - 가격 × 수량의 합, 배송비 없음
  const totalPrice = Cart.total();

  try {
    // 결제 ID 를 문서 ID 로 orders 에 주문 문서 한 장을 만듭니다
    await setDoc(doc(db, "orders", paymentId), {
      userId: user.uid,
      items,
      totalPrice,
      status: "paid",
      createdAt: serverTimestamp(),
      paymentId
    });
  } catch (error) {
    // 주문을 쓰다 실패하면 오류 글을 줄이지 않고 그대로 보여 줍니다 (장바구니도 그대로)
    show(String(error));
    return;
  }

  // 결제를 마쳤다 - 주문 문서를 쓴 뒤에 한 번 보냅니다
  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
  dataLayer.push({ ecommerce: null });
  // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
  dataLayer.push({
    // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
    event: "purchase",
    // 같이 보내는 상품 값 묶음
    ecommerce: {
      // 주문 번호 - 결제 ID
      transaction_id: paymentId,
      // 어느 나라 돈인가
      currency: "KRW",
      // 금액 - 주문한 상품 합계
      value: totalPrice,
      // 주문한 상품 상자 전체
      items: found.map(({ p, qty }) => ({ item_id: p.id, item_name: p.name, price: p.price, quantity: qty }))
    }
  });

  // 주문 문서를 다 썼으니 장바구니를 비웁니다
  Cart.clear();
  const badge = document.querySelector(".cart-count");
  if (badge) badge.textContent = Cart.count();

  show("결제 ID: " + paymentId, "주문이 접수되었습니다");
}

receivePayment();
