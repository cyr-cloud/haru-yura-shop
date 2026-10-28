/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall, HttpsError} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();

// 값은 functions 폴더의 .secret.local 에 있다 - 코드에 적지 않는다
const PORTONE_API_SECRET = defineSecret("PORTONE_API_SECRET");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.portoneWebhook = onRequest({secrets: [PORTONE_API_SECRET]}, async (request, response) => {
  const type = request.body?.type;
  const paymentId = request.body?.data?.paymentId;
  logger.info(`portoneWebhook type=${type} paymentId=${paymentId}`);
  try {
    await verifyPayment(paymentId);
  } catch (err) {
    logger.error(`금액 확인 중 오류: ${paymentId} ${String(err)}`);
  }
  response.status(200).send("OK");
});

// 웹훅으로 받은 결제 ID 로 포트원 V2 API 에 그 결제를 다시 조회하고,
// customData 의 상품 ID · 수량과 Firestore products 의 가격으로 기준 금액을 계산해 맞춰 본다
async function verifyPayment(paymentId) {
  if (!paymentId) {
    logger.warn("결제 ID 가 없어 조회하지 않음");
    return;
  }

  const res = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: {Authorization: `PortOne ${PORTONE_API_SECRET.value()}`},
  });
  if (!res.ok) {
    logger.error(`포트원 조회 실패: ${res.status} ${await res.text()}`);
    return;
  }
  const payment = await res.json();
  const paidAmount = payment.amount?.total;

  logger.info(`상태: ${payment.status}`);
  logger.info(`결제 금액: ${paidAmount}`);
  logger.info(`customData: ${typeof payment.customData === "string" ? payment.customData : JSON.stringify(payment.customData)}`);

  // 에뮬레이터 Firestore 가 안 떠 있으면 실제 Firestore 를 읽게 되므로 멈춘다
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    logger.error("Firestore 에뮬레이터가 연결되지 않아 기준 금액을 계산하지 않음");
    return;
  }

  // customData 가 글자 한 줄로 오면 풀어서 읽는다
  const customData = typeof payment.customData === "string" ?
    JSON.parse(payment.customData) : (payment.customData || {});
  const items = Array.isArray(customData.items) ? customData.items : [];

  const db = getFirestore();
  let expected = 0;
  for (const item of items) {
    const snap = await db.collection("products").doc(String(item.id)).get();
    if (!snap.exists) {
      logger.warn(`상품을 찾을 수 없음: ${item.id}`);
      continue;
    }
    expected += Number(snap.get("price")) * Number(item.qty);
  }

  if (payment.status === "PAID" && paidAmount === expected) {
    logger.info(`검증 통과: ${paymentId} 기준 금액 ${expected} 결제 금액 ${paidAmount}`);
    await createOrder(db, paymentId, {
      paymentId: paymentId,
      userId: String(customData.userId || payment.customer?.id || ""),
      items: items.map(i => ({id: String(i.id), qty: Number(i.qty)})),
      totalPrice: expected,
      paidAmount: paidAmount,
      status: "paid",
      createdAt: FieldValue.serverTimestamp(),
    });
  } else {
    logger.warn(`금액 불일치: ${paymentId} 기준 금액 ${expected} 결제 금액 ${paidAmount}`);
  }
}

// 결제 ID 를 문서 이름으로 주문을 한 장 만든다 - 이미 있으면 만들지도 덮어쓰지도 않는다
async function createOrder(db, paymentId, order) {
  try {
    // create() 는 같은 이름의 문서가 있으면 실패한다
    await db.collection("orders").doc(paymentId).create(order);
    logger.info(`주문 생성: ${paymentId}`);
  } catch (err) {
    // 6 = ALREADY_EXISTS
    if (err.code === 6) {
      logger.info(`이미 있는 주문 - 건너뜀: ${paymentId}`);
      return;
    }
    throw err;
  }
}

// 실습 188 - shopPing : 바깥에서 주소로 불러 함수가 깨어 있는지 보는 HTTP 함수
exports.shopPing = onRequest({ region: "us-central1" }, (req, res) => {
  const now = new Date().toISOString();
  res.send("하루상점 함수가 깨어 있습니다 · " + now);
});

// 실습 189 - calcOrderTotal : 상품 ID 와 수량만 받아 Firestore 가격으로 금액을 센다
exports.calcOrderTotal = onCall({region: "us-central1"}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인한 뒤에 금액을 확인할 수 있습니다");
  }
  const productId = request.data && request.data.productId;
  const quantity = request.data && request.data.quantity;
  if (typeof productId !== "string" || productId === "") {
    throw new HttpsError("invalid-argument", "productId 는 빈 글자가 아니어야 합니다");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new HttpsError("invalid-argument", "수량은 1 이상의 정수여야 합니다");
  }
  // 화면이 price 를 보내도 쓰지 않는다 - 가격은 Firestore 에서 읽는다
  const snap = await getFirestore().collection("products").doc(productId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "상품이 없습니다: " + productId);
  }
  return {totalPrice: Number(snap.get("price")) * quantity};
});

Object.assign(exports, require("./automation"));
Object.assign(exports, require("./admin"));