/* ===========================================================
   유라문구 — 상품 사진을 Cloud Storage 에 올리는 화면의 코드
   사진은 products/상품 문서 ID/main.jpg 에 올리고,
   그 경로 글자만 상품 문서의 imagePath 에 적습니다 (다운로드 URL 은 적지 않습니다).
   빌드 도구 없이 <script type="module"> 로 그대로 돌아갑니다.
   =========================================================== */

// Firebase 연결은 auth.js 가 이미 넣어 둔 값으로 해 둡니다. 여기서는 그것을 받아 씁니다.
// Storage 버킷도 그 설정의 storageBucket 값을 그대로 씁니다.
import { onUser } from "./auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocsFromServer,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const app = getApp();
const db = getFirestore(app);
const storage = getStorage(app);

const checking = document.querySelector("#photo-checking");
const form = document.querySelector("#photo-form");
const select = document.querySelector("#photo-product");
const fileInput = document.querySelector("#photo-file");
const btn = document.querySelector("#btn-photo");
const msg = document.querySelector("#photo-msg");

// 오류 글을 줄이지 않고 그대로 씁니다
const errorLine = error =>
  (error && error.code ? error.code + " — " : "") +
  (error && error.message ? error.message : String(error)) +
  (error && error.customData && error.customData.serverResponse ? "\n" + error.customData.serverResponse : "");

// 올릴 자리 - 맨 앞에 / 를 붙이지 않습니다. 예: products/p1/main.jpg
const photoPath = id => "products/" + id + "/main.jpg";

/* --- 상품 고르는 목록 - products 문서를 전부 읽습니다 (숨긴 상품도 넣습니다) --- */
let filled = false;
async function fillProducts() {
  if (filled) return;
  filled = true;
  select.disabled = true;
  try {
    const snap = await getDocsFromServer(collection(db, "products"));
    const docs = snap.docs.slice().sort((a, b) => a.id.localeCompare(b.id));
    select.replaceChildren();
    if (docs.length === 0) {
      msg.textContent = "products 에 문서가 없습니다.";
      return;
    }
    docs.forEach(d => {
      const p = d.data();
      const option = document.createElement("option");
      option.value = d.id;
      // 문서 ID 가 보이게 적습니다. 글자로만 넣습니다.
      option.textContent = d.id + " — " + String(p.name ?? "") +
        (p.isVisible === false ? " (숨김)" : "") +
        (p.imagePath ? " · 사진 있음" : "");
      select.append(option);
    });
    select.disabled = false;
    btn.disabled = false;
  } catch (error) {
    console.error(error);
    filled = false;
    msg.textContent = errorLine(error);
  }
}

/* --- 사진 올리기 --- */
function upload(id, file) {
  const task = uploadBytesResumable(ref(storage, photoPath(id)), file);
  return new Promise((resolve, reject) => {
    task.on("state_changed", s => {
      const pct = s.totalBytes ? Math.floor((s.bytesTransferred / s.totalBytes) * 100) : 0;
      msg.textContent = "올리는 중 " + pct + "%";
    }, reject, () => resolve(task.snapshot));
  });
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const id = select.value;
  const file = fileInput.files[0];
  if (!id) { msg.textContent = "상품을 골라 주세요."; return; }
  if (!file) { msg.textContent = "사진 파일을 골라 주세요."; return; }

  btn.disabled = true;
  msg.textContent = "올리는 중 0%";
  try {
    // 고른 파일을 줄이거나 바꾸지 않고 그대로 올립니다
    await upload(id, file);
    // 다 올라간 뒤에 경로 글자만 적습니다. updateDoc 은 imagePath 만 더하고 다른 필드는 그대로 둡니다.
    const path = photoPath(id);
    await updateDoc(doc(db, "products", id), { imagePath: path });
    msg.textContent = "다 올렸습니다. " + id + " 문서의 imagePath 에 " + path + " 를 적었습니다.";
    // 목록의 「사진 있음」 표시를 맞춰 둡니다
    const option = select.querySelector('option[value="' + CSS.escape(id) + '"]');
    if (option && !option.textContent.endsWith(" · 사진 있음")) option.textContent += " · 사진 있음";
  } catch (error) {
    // 오류 글은 줄이지 않고 화면과 콘솔에 그대로
    console.error(error);
    msg.textContent = errorLine(error);
  }
  btn.disabled = false;
});

/* --- 로그인한 사람만 씁니다. 안 했으면 한 줄만 보입니다 --- */
onUser(user => {
  if (!user) {
    checking.textContent = "사진을 올리려면 먼저 로그인해 주세요.";
    checking.hidden = false;
    form.hidden = true;
    return;
  }
  checking.hidden = true;
  form.hidden = false;
  fillProducts();
});
