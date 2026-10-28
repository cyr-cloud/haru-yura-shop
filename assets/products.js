/* ===========================================================
   유라문구 — 상품을 Firestore 의 products 컬렉션에서 읽는 코드
   이름 · 가격 · 한 줄 소개 · 재고는 Firestore 에서 읽고,
   그림(emoji)과 긴 설명(detail)은 지금처럼 shop.js 에서 읽습니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// Firebase 연결은 auth.js 가 이미 넣어 둔 값으로 해 둡니다. 여기서는 그것을 받아 씁니다.
import { auth } from "./auth.js";
import { showPushAsk } from "./push-ask.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocsFromServer,
  getDocFromServer,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const db = getFirestore(getApp());
// 상품 사진은 설정의 storageBucket 에 있습니다
const storage = getStorage(getApp());

// Firestore 에서 온 글자는 HTML 로 넣기 전에 글자로 바꿔 둡니다
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const stockLine = n => (n > 0 ? "재고 " + n + "개" : "품절");

// 오류 글을 줄이지 않고 그대로 씁니다
const errorLine = error => (error && error.code ? error.code + " — " : "") + (error && error.message ? error.message : String(error));

function sayReads(n) {
  const line = document.querySelector("#read-count");
  if (line) line.textContent = "이번 화면에서 읽은 문서 " + n + "장";
}

// app.js 가 화면 틀을 먼저 그린 뒤에 채웁니다
const domReady = new Promise(resolve => {
  if (document.readyState === "complete") resolve();
  else document.addEventListener("DOMContentLoaded", resolve, { once: true });
});

/* --- 상품 목록 --- */

// 한 번에 가져오는 장수
const PAGE = 3;
// 지금 화면에 보이는 마지막 상품 - "더 보기" 는 이 다음부터 가져옵니다
let lastDoc = null;
// 이 목록을 그리려고 지금까지 받아 온 장수 (첫 셋 + 더 보기로 받은 것)
let listReads = 0;

// 숨기지 않은 상품만 · 가격이 싼 것부터 · 셋만, Firestore 쿼리에서 고르고 정렬해 받아 옵니다.
// after 를 주면 그 상품 바로 다음부터 셋을 받습니다.
// 이 쿼리는 isVisible + price 복합 색인이 있어야 돌아갑니다 (색인은 콘솔에서 만듭니다)
function pageQuery(after) {
  const parts = [
    collection(db, "products"),
    where("isVisible", "==", true),
    orderBy("price", "asc")
  ];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE));
  return query(...parts);
}

function cardHtml(d) {
  const p = d.data();
  const local = findProduct(d.id);
  return `
    <a class="card" href="product.html?id=${encodeURIComponent(d.id)}">
      <div class="thumb"${p.imagePath ? ` data-image-path="${esc(p.imagePath)}"` : ""}>${local ? local.emoji : ""}</div>
      <h3>${esc(p.name)}</h3>
      <p class="sum">${esc(p.summary)}</p>
      <div class="price">${won(Number(p.price))}</div>
      <p class="stock">${stockLine(Number(p.stock))}</p>
    </a>`;
}

// imagePath 가 있는 카드는 그 경로로 다운로드 URL 을 받아 그림 글자 자리에 사진을 넣습니다.
// 사진 주소를 받는 것은 Storage 에 묻는 일이라 「읽은 문서」 수에 더하지 않습니다.
// 받지 못하면 그림 글자를 그대로 두고 오류만 콘솔에 남깁니다.
function fillPhotos(box) {
  box.querySelectorAll(".thumb[data-image-path]:not([data-photo])").forEach(async thumb => {
    thumb.dataset.photo = "loading";
    try {
      const url = await getDownloadURL(ref(storage, thumb.dataset.imagePath));
      const img = document.createElement("img");
      img.src = url;
      img.alt = thumb.parentElement.querySelector("h3")?.textContent || "";
      thumb.replaceChildren(img);
      thumb.dataset.photo = "done";
    } catch (error) {
      console.error(error);
      thumb.dataset.photo = "failed";
    }
  });
}

// 셋보다 적게 왔으면 더 가져올 것이 없으므로 버튼을 숨깁니다
function setMoreButton(gotCount) {
  const btn = document.querySelector("#btn-more");
  if (btn) btn.hidden = gotCount < PAGE;
}

async function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;

  // 처음부터 다시 그립니다 (화면을 열 때, 상품을 올린 뒤)
  lastDoc = null;
  listReads = 0;
  setMoreButton(0);

  try {
    const snap = await getDocsFromServer(pageQuery(null));
    // 이번에 서버에서 실제로 받아 온 장수입니다
    listReads = snap.size;
    sayReads(listReads);

    const docs = snap.docs;

    if (docs.length === 0) {
      box.innerHTML = '<p class="empty">아직 올려 둔 문구가 없습니다.</p>';
      return;
    }

    box.innerHTML = docs.map(cardHtml).join("");
    fillPhotos(box);
    lastDoc = docs[docs.length - 1];
    setMoreButton(docs.length);
  } catch (error) {
    // 오류 글은 줄이지 않고 콘솔에 그대로, 화면에는 한 줄만
    console.error(error);
    box.innerHTML = '<p class="empty">목록을 불러오지 못했습니다</p>';
  }
}

/* --- 더 보기 --- */
function setupMore() {
  const btn = document.querySelector("#btn-more");
  const box = document.querySelector("#product-list");
  const msg = document.querySelector("#more-msg");
  if (!btn || !box) return;

  btn.addEventListener("click", async () => {
    if (!lastDoc) return;
    btn.disabled = true;
    msg.textContent = "";
    try {
      // 지금 보이는 마지막 상품 다음부터 셋을 더 받아 옵니다
      const snap = await getDocsFromServer(pageQuery(lastDoc));
      // 읽은 장수는 지금까지 받은 것에 더합니다
      listReads += snap.size;
      sayReads(listReads);

      // 아래에 이어 붙입니다
      box.insertAdjacentHTML("beforeend", snap.docs.map(cardHtml).join(""));
      fillPhotos(box);
      if (snap.size) lastDoc = snap.docs[snap.size - 1];
      setMoreButton(snap.size);
    } catch (error) {
      // 오류 글은 줄이지 않고 콘솔에 그대로, 화면에는 한 줄만 (이미 보이는 상품은 그대로 둡니다)
      console.error(error);
      msg.textContent = "목록을 불러오지 못했습니다";
    }
    btn.disabled = false;
  });
}

/* --- 상품 상세 --- */
async function paintDetail() {
  const box = document.querySelector("#product-detail");
  if (!box) return;

  // shop.js 에 없는 id 면 app.js 가 이미 「없습니다」를 그렸습니다 - 읽지 않습니다
  const nameBox = document.querySelector("#detail-name");
  if (!nameBox) { sayReads(0); return; }

  const id = new URLSearchParams(location.search).get("id");
  try {
    const snap = await getDocFromServer(doc(db, "products", id));
    sayReads(snap.exists() ? 1 : 0);

    const p = snap.data();
    if (!p || p.isVisible !== true) {
      box.innerHTML = '<p class="empty">찾으시는 문구가 없습니다.</p>';
      return;
    }

    document.title = p.name + " — " + SHOP.name;
    nameBox.textContent = p.name;
    document.querySelector("#detail-summary").textContent = p.summary;
    document.querySelector("#detail-price").textContent = won(Number(p.price));
    document.querySelector("#detail-stock").textContent = stockLine(Number(p.stock));

    // imagePath 가 있으면 그림 자리에 사진을 넣습니다 (목록 카드와 같은 방식)
    const thumb = box.querySelector(".thumb");
    if (thumb && p.imagePath) {
      thumb.dataset.imagePath = p.imagePath;
      fillPhotos(box);
    }

    // 측정 이벤트 view_item - 상품이 제대로 보일 때, Firestore 에서 읽은 값으로 보냅니다
    const price = Number(p.price);
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
        value: price,
        // 보고 있는 상품 상자 하나를 목록에 넣는다
        items: [{ item_id: snap.id, item_name: p.name, price: price, quantity: 1 }]
      }
    });

    // 상품이 제대로 보일 때만 「바로 주문」 단추를 꺼냅니다
    const orderBtn = document.querySelector("#btn-order");
    if (orderBtn) orderBtn.hidden = false;
  } catch (error) {
    nameBox.textContent = errorLine(error);
  }
}

/* --- 바로 주문 --- */

// 재고가 모자랄 때 트랜잭션을 멈추려고 던지는 표시
class OutOfStock extends Error {}

function setupOrder() {
  const btn = document.querySelector("#btn-order");
  const msg = document.querySelector("#order-msg");
  if (!btn) return;

  const id = new URLSearchParams(location.search).get("id");

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "주문하는 중입니다";
    try {
      // 로그인 확인이 끝날 때까지 기다린 뒤에 봅니다 (확인 전의 빈 값을 "로그인 안 함" 으로 보지 않도록)
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) {
        msg.textContent = "로그인이 필요합니다";
        btn.disabled = false;
        return;
      }

      const productRef = doc(db, "products", id);
      // 주문 문서는 자동 ID 로 만듭니다
      const orderRef = doc(collection(db, "orders"));

      // 재고 확인 · 주문 문서 쓰기 · 재고 차감을 한 트랜잭션으로 묶습니다 - 셋 다 되거나 하나도 안 됩니다
      const result = await runTransaction(db, async tx => {
        const snap = await tx.get(productRef);
        if (!snap.exists()) throw new Error("products/" + id + " 문서가 없습니다");

        const p = snap.data();
        const stock = Number(p.stock);
        if (!(stock >= 1)) throw new OutOfStock();

        const quantity = 1;
        tx.set(orderRef, {
          userId: user.uid,
          items: [{ productId: id, name: p.name, price: p.price, quantity }],
          totalPrice: p.price * quantity,
          status: "paid",
          createdAt: serverTimestamp()
        });
        tx.update(productRef, { stock: stock - 1 });
        return { name: p.name, price: p.price, stockLeft: stock - 1 };
      });

      msg.textContent = "주문했습니다: " + result.name + " 1개 · " + won(Number(result.price)) + " (주문 번호 " + orderRef.id + ")";
      document.querySelector("#detail-stock").textContent = stockLine(result.stockLeft);
      // 「주문했습니다」 바로 아래에 알림을 받을지 묻는 카드를 붙입니다
      showPushAsk(msg, orderRef.id);
    } catch (error) {
      // 재고가 모자라면 아무것도 쓰지 않고 멈췄습니다
      msg.textContent = error instanceof OutOfStock ? "재고가 없습니다" : errorLine(error);
    }
    btn.disabled = false;
  });
}

domReady.then(() => {
  paintList();
  setupMore();
  paintDetail();
  setupOrder();
});
