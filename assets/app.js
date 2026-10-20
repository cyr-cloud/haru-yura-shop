/* ===========================================================
   유라문구 — 화면을 그리고 장바구니를 다루는 코드
   이 파일은 고치지 않아도 됩니다. (상품은 shop.js 에 있습니다)
   =========================================================== */

const won = n => n.toLocaleString("ko-KR") + "원";
const findProduct = id => PRODUCTS.find(p => p.id === id);
const qs = key => new URLSearchParams(location.search).get(key);

/* --- 장바구니는 브라우저에 저장합니다 --- */
const Cart = {
  read() {
    try { return JSON.parse(localStorage.getItem("haru_cart") || "[]"); }
    catch (e) { return []; }
  },
  write(items) {
    localStorage.setItem("haru_cart", JSON.stringify(items));
  },
  add(id) {
    const items = Cart.read();
    const hit = items.find(i => i.id === id);
    if (hit) hit.qty += 1;
    else items.push({ id, qty: 1 });
    Cart.write(items);

    // 담은 상품의 이름과 가격을 상품 목록에서 찾아 온다
const p = findProduct(id);
// 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
window.dataLayer = window.dataLayer || [];
// 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
dataLayer.push({ ecommerce: null });
// 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
dataLayer.push({
  // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
  event: "add_to_cart",
  // 같이 보내는 상품 값 묶음
  ecommerce: {
    // 어느 나라 돈인가
    currency: "KRW",
    // 금액 - 한 번 누르면 한 개라 그 상품 가격 하나
    value: p.price,
    // 담은 상품 상자 하나를 목록에 넣는다
    items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
  }
});

  },
  remove(id) {
    Cart.write(Cart.read().filter(i => i.id !== id));
  },
  clear() {
    localStorage.removeItem("haru_cart");
  },
  count() {
    return Cart.read().reduce((sum, i) => sum + i.qty, 0);
  },
  total() {
    return Cart.read().reduce((sum, i) => {
      const p = findProduct(i.id);
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
  }
};

/* --- 머리글과 꼬리글 --- */
function paintChrome() {
  // 화면마다 제목이 달라야 검색에서 구분됩니다.
  // 그래서 제목을 통째로 바꾸지 않고 가게 이름만 갈아 끼웁니다.
  document.title = document.title.replaceAll("유라문구", SHOP.name);

  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = SHOP.name;

  const badge = document.querySelector(".cart-count");
  if (badge) badge.textContent = Cart.count();

  const foot = document.querySelector("footer.site .wrap");
  if (foot) foot.textContent = SHOP.name + " · " + SHOP.tagline;
}

/* --- 상품 목록 --- */
function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;

  document.querySelector("#hero-title").textContent = SHOP.name;
  document.querySelector("#hero-tagline").textContent = SHOP.tagline;

  // 카드는 Firestore 의 products 를 읽어 assets/products.js 가 그립니다
  box.innerHTML = '<p class="empty">문구를 불러오는 중입니다.</p>';
}

/* --- 상품 상세 --- */
function paintDetail() {
  const box = document.querySelector("#product-detail");
  if (!box) return;

  const p = findProduct(qs("id"));
  if (!p) { box.innerHTML = '<p class="empty">찾으시는 문구가 없습니다.</p>'; return; }

  document.title = p.name + " — " + SHOP.name;
  // 이름 · 가격 · 한 줄 소개 · 재고는 Firestore 에서 읽어 assets/products.js 가 채웁니다.
  // 그림(emoji)과 긴 설명(detail)은 지금처럼 shop.js 에서 읽습니다.
  box.innerHTML = `
    <div class="thumb">${p.emoji}</div>
    <div>
      <h1 id="detail-name">불러오는 중입니다</h1>
      <p class="sum" id="detail-summary"></p>
      <div class="price" id="detail-price"></div>
      <p class="stock" id="detail-stock"></p>
      <div class="body prose">${p.detail.map(t => `<p>${t}</p>`).join("")}</div>
      <button class="btn" id="add-to-cart">장바구니에 담아 두기</button>
    </div>`;

  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
  dataLayer.push({ ecommerce: null });
  // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
  dataLayer.push({
    // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
    event: "view_item",
    // 같이 보내는 상품 값 묶음
    ecommerce: {
      // 어느 나라 돈인가
      currency: "KRW",
      // 금액 - 지금 보고 있는 상품 하나의 가격
      value: p.price,
      // 보고 있는 상품 상자 하나를 목록에 넣는다
      items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
    }
  });

  document.querySelector("#add-to-cart").addEventListener("click", () => {
    Cart.add(p.id);
    location.href = "cart.html";
  });
}

/* --- 장바구니 --- */
function paintCart() {
  const box = document.querySelector("#cart-box");
  if (!box) return;

  const items = Cart.read();
  if (items.length === 0) {
    box.innerHTML = '<p class="empty">아직 담아 두신 문구가 없습니다.</p>';
    return;
  }

  box.innerHTML = `
    <table class="cart">
      <tr><th>문구</th><th>수량</th><th>금액</th><th></th></tr>
      ${items.map(i => {
        const p = findProduct(i.id);
        if (!p) return "";
        return `<tr>
          <td>${p.emoji} ${p.name}</td>
          <td>${i.qty}</td>
          <td>${won(p.price * i.qty)}</td>
          <td><button class="btn ghost drop" data-id="${p.id}">빼기</button></td>
        </tr>`;
      }).join("")}
    </table>
    <div class="total">합계 ${won(Cart.total())}</div>
    <a class="btn" href="checkout.html">결제하기</a>`;

  box.querySelectorAll(".drop").forEach(b => {
    b.addEventListener("click", () => { Cart.remove(b.dataset.id); location.reload(); });
  });
}

/* --- 결제 --- */
function paintCheckout() {
  const form = document.querySelector("#pay-form");
  if (!form) return;

  // ▼ 여기에 「결제를 시작했다」를 알리는 코드가 들어갑니다 (뒤 수업에서)
  // 장바구니에 담긴 상품마다 상품 목록에서 이름과 가격을 찾아 상자로 만든다
  const checkoutItems = Cart.read().map(i => {
    const p = findProduct(i.id);
    return p ? { item_id: p.id, item_name: p.name, price: p.price, quantity: i.qty } : null;
  }).filter(Boolean);
  // 결제 화면이 열린 순간의 장바구니 합계 - 가격 × 수량의 합, 배송비 없음
  const checkoutTotal = Cart.total();

  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
  dataLayer.push({ ecommerce: null });
  // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
  dataLayer.push({
    // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
    event: "begin_checkout",
    // 합계가 50000원 이상이면 무료 배송 - ecommerce 밖에 둔다
    free_shipping: checkoutTotal >= 50000 ? "yes" : "no",
    // 같이 보내는 상품 값 묶음
    ecommerce: {
      // 어느 나라 돈인가
      currency: "KRW",
      // 금액 - 장바구니 상품 합계
      value: checkoutTotal,
      // 장바구니에 담긴 상품 상자 전체
      items: checkoutItems
    }
  });

  const sum = document.querySelector("#pay-total");
  if (sum) sum.textContent = won(Cart.total());

  form.addEventListener("submit", async e => {
    e.preventDefault();

    // ▼ 여기에 「결제를 마쳤다」를 알리는 코드가 들어갑니다 (뒤 수업에서)
    // 주문 번호 - 누른 순간의 시각(밀리초) + 무작위 글자 8자
    const transactionId = "ORD-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    // 장바구니를 비우기 전에, 주문한 상품마다 상품 목록에서 이름과 가격을 찾아 상자로 만든다
    const purchaseItems = Cart.read().map(i => {
      const p = findProduct(i.id);
      return p ? { item_id: p.id, item_name: p.name, price: p.price, quantity: i.qty } : null;
    }).filter(Boolean);
    // 주문한 상품 합계 - 가격 × 수량의 합, 배송비 없음
    const purchaseTotal = Cart.total();

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
        // 주문 번호
        transaction_id: transactionId,
        // 어느 나라 돈인가
        currency: "KRW",
        // 금액 - 주문한 상품 합계
        value: purchaseTotal,
        // 주문한 상품 상자 전체
        items: purchaseItems
      }
    });

    // 포트원 결제창(테스트)을 연다 - 주문 문서·장바구니 비우기·완료 화면은 아직 하지 않는다
    const result = document.querySelector("#pay-result");
    if (!purchaseItems.length) {
      result.textContent = "장바구니가 비어 있습니다";
      return;
    }
    // 결제 번호 - 주문 번호와 같은 방식: 누른 순간의 시각(밀리초) + 무작위 글자 8자
    const paymentId = "HARU-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    // 주문 이름 - 첫 상품 이름, 종류가 더 있으면 「외 N건」
    const rest = purchaseItems.length - 1;
    const orderName = purchaseItems[0].item_name + (rest > 0 ? " 외 " + rest + "건" : "");

    let received;
    try {
      const response = await PortOne.requestPayment({
        storeId: "store-411f2e1f-34d8-4cd5-9085-69cc747bc4d3",
        channelKey: "channel-key-c04dbec2-dfa0-4a78-a057-15ebfd6faabd",
        paymentId: paymentId,
        orderName: orderName,
        totalAmount: purchaseTotal,
        currency: "KRW",
        payMethod: "CARD"
      });
      // 결제창이 돌려준 결과를 받은 그대로 글자로 바꾼다
      received = JSON.stringify(response);
    } catch (err) {
      // 결제창을 열다 오류가 나면 그 오류 글자를 그대로 쓴다
      received = String(err);
    }
    result.textContent = "paymentId: " + paymentId + "\n" + received;
  });
}

/* --- 가게 소개·배송 안내 글 --- */
function paintProse() {
  const about = document.querySelector("#about-body");
  if (about) about.innerHTML = SHOP.about.map(t => `<p>${t}</p>`).join("");

  const ship = document.querySelector("#shipping-body");
  if (ship) ship.innerHTML = SHOP.shipping.map(t => `<p>${t}</p>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  paintChrome();
  paintList();
  paintDetail();
  paintCart();
  paintCheckout();
  paintProse();
});
