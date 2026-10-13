/* ===========================================================
   유라문구 — 상품을 Firestore 의 products 컬렉션에서 읽는 코드
   이름 · 가격 · 한 줄 소개 · 재고는 Firestore 에서 읽고,
   그림(emoji)과 긴 설명(detail)은 지금처럼 shop.js 에서 읽습니다.
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// Firebase 연결은 auth.js 가 이미 넣어 둔 값으로 해 둡니다. 여기서는 그것을 받아 씁니다.
import { onUser } from "./auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocsFromServer,
  getDocFromServer,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const db = getFirestore(getApp());

// shop.js 에서 올릴 상품과, 재고 · 보이기 값
const SEED = [
  { id: "p2", stock: 30, isVisible: true },
  { id: "p3", stock: 8, isVisible: true },
  { id: "p4", stock: 0, isVisible: true },
  { id: "p5", stock: 5, isVisible: false },
  { id: "p6", stock: 40, isVisible: true }
];

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
async function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;

  try {
    // 숨기지 않은 상품만 · 가격이 싼 것부터 · 셋만, Firestore 쿼리에서 고르고 정렬해 받아 옵니다.
    // 이 쿼리는 isVisible + price 복합 색인이 있어야 돌아갑니다 (색인은 콘솔에서 만듭니다)
    const snap = await getDocsFromServer(query(
      collection(db, "products"),
      where("isVisible", "==", true),
      orderBy("price", "asc"),
      limit(3)
    ));
    // 이번에 서버에서 실제로 받아 온 장수입니다
    sayReads(snap.size);

    const docs = snap.docs;

    if (docs.length === 0) {
      box.innerHTML = '<p class="empty">아직 올려 둔 문구가 없습니다.</p>';
      return;
    }

    box.innerHTML = docs.map(d => {
      const p = d.data();
      const local = findProduct(d.id);
      return `
    <a class="card" href="product.html?id=${encodeURIComponent(d.id)}">
      <div class="thumb">${local ? local.emoji : ""}</div>
      <h3>${esc(p.name)}</h3>
      <p class="sum">${esc(p.summary)}</p>
      <div class="price">${won(Number(p.price))}</div>
      <p class="stock">${stockLine(Number(p.stock))}</p>
    </a>`;
    }).join("");
  } catch (error) {
    // 오류 글은 줄이지 않고 콘솔에 그대로, 화면에는 한 줄만
    console.error(error);
    box.innerHTML = '<p class="empty">목록을 불러오지 못했습니다</p>';
  }
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
  } catch (error) {
    nameBox.textContent = errorLine(error);
  }
}

/* --- 상품 올리기 (로그인한 사람만) --- */
function setupSeed() {
  const btn = document.querySelector("#btn-seed");
  const msg = document.querySelector("#seed-msg");
  if (!btn) return;

  // 로그인했을 때만 단추를 보여 줍니다
  onUser(user => { btn.hidden = !user; });

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    msg.textContent = "올리는 중입니다";
    try {
      // 다섯 장을 한 번에 올립니다 - 다 올라가거나 하나도 안 올라갑니다.
      // 이미 있는 문서를 덮어쓰지 않도록, 하나라도 있으면 아무것도 쓰지 않고 멈춥니다.
      const made = await runTransaction(db, async tx => {
        const refs = SEED.map(s => doc(db, "products", s.id));
        const snaps = await Promise.all(refs.map(r => tx.get(r)));
        const already = snaps.filter(s => s.exists()).map(s => s.id);
        if (already.length) throw new Error("이미 있는 문서가 있어 하나도 올리지 않았습니다: " + already.join(", "));

        SEED.forEach((s, i) => {
          const p = findProduct(s.id);
          tx.set(refs[i], {
            name: p.name,
            price: p.price,
            summary: p.summary,
            stock: s.stock,
            isVisible: s.isVisible,
            createdAt: serverTimestamp()
          });
        });
        return SEED.map(s => s.id);
      });
      msg.textContent = made.join(", ") + " 다섯 장을 products 에 올렸습니다.";
      await paintList();
    } catch (error) {
      msg.textContent = errorLine(error);
    }
    btn.disabled = false;
  });
}

domReady.then(() => {
  paintList();
  paintDetail();
  setupSeed();
});
