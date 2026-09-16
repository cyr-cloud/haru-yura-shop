/* ===========================================================
   유라문구 — 동의 배너
   이 파일은 태그 관리자 코드보다 먼저 읽혀야 합니다.
   (화면 파일 <head> 안, 태그 관리자 조각 바로 위에 있습니다)
   =========================================================== */

(function () {
  // 고른 값을 기억해 두는 서랍 이름
  const KEY = "haru_consent";
  // 우리가 다루는 네 가지 신호
  const SIGNALS = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"];

  // 네 신호를 한꺼번에 같은 값으로 만들어 주는 도구
  function allSignals(value) {
    const box = {};
    SIGNALS.forEach(s => { box[s] = value; });
    return box;
  }

  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 동의 신호는 이 모양 그대로 통로에 넣어야 태그 관리자가 알아듣는다
  function gtag() { dataLayer.push(arguments); }

  /* --- 1. 기본값 - 묻기 전에는 네 신호 모두 거부 --- */
  // 태그 관리자가 읽히기 전에 넣어야 하므로 이 줄이 파일 맨 앞쪽에 있다
  gtag("consent", "default", allSignals("denied"));

  /* --- 2. 전에 고른 값이 있으면 그대로 따른다 --- */
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }

  // 이 화면에서 수락으로 바꿔 두었는지 적어 둔다
  let grantedHere = false;

  if (saved === "granted") {
    // 전에 수락하셨으니 이 화면에서도 바로 허용으로 바꾼다
    gtag("consent", "update", allSignals("granted"));
    grantedHere = true;
  }
  // saved 가 "denied" 면 아무것도 하지 않는다 - 기본값 거부 그대로

  /* --- 3. 배너와 링크 모양 --- */
  const css = `
  .consent-bar{position:fixed;left:0;right:0;bottom:0;z-index:50;
    background:#15202b;color:#fff;border-top:3px solid #1f5f56;
    padding:16px 24px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;
    font-size:13.5px;line-height:1.7;word-break:keep-all}
  .consent-bar p{margin:0;flex:1 1 320px;color:#dde3e9}
  .consent-bar .acts{display:flex;gap:10px;margin-left:auto}
  .consent-bar button{font:inherit;cursor:pointer;padding:9px 20px;
    border-radius:0;letter-spacing:.02em}
  .consent-bar .no{background:transparent;color:#dde3e9;border:1px solid #5f6f7e}
  .consent-bar .no:hover{border-color:#dde3e9;color:#fff}
  .consent-bar .yes{background:#1f5f56;color:#fff;border:1px solid #1f5f56}
  .consent-bar .yes:hover{background:#27786c;border-color:#27786c}
  .consent-relink{text-align:center;padding:0 24px 28px;font-size:12px;
    letter-spacing:.04em;background:#eef1f4}
  .consent-relink button{font:inherit;background:none;border:0;padding:0;
    color:#5f6f7e;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
  .consent-relink button:hover{color:#1f5f56}
  @media (max-width:520px){
    .consent-bar{padding:14px 18px}
    .consent-bar .acts{margin-left:0;width:100%}
    .consent-bar button{flex:1}
  }`;

  /* --- 4. 화면이 다 그려지면 배너와 링크를 붙인다 --- */
  document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    // 배너 - 아직 만들지 않았다가 필요할 때 만든다
    let bar = null;

    function hideBar() {
      if (bar) { bar.remove(); bar = null; }
    }

    function showBar() {
      if (bar) return;
      bar = document.createElement("div");
      bar.className = "consent-bar";
      bar.setAttribute("role", "dialog");
      bar.setAttribute("aria-label", "쿠키 동의");
      bar.innerHTML = `
        <p>이 가게는 어떤 문구를 많이 보시는지 살펴보려고 쿠키를 씁니다.
           수락하셔야 방문 기록과 광고 쿠키를 함께 씁니다.</p>
        <div class="acts">
          <button type="button" class="no">거부</button>
          <button type="button" class="yes">수락</button>
        </div>`;

      bar.querySelector(".yes").addEventListener("click", () => {
        // 이 화면에서 네 신호를 허용으로 바꾼다
        gtag("consent", "update", allSignals("granted"));
        grantedHere = true;
        remember("granted");
        hideBar();
      });

      bar.querySelector(".no").addEventListener("click", () => {
        // 거부는 기본값 그대로 두면 된다.
        // 다만 이 화면에서 이미 수락으로 바꿔 둔 뒤에 다시 고르신 경우에는
        // 되돌려 두어야 고르신 대로 맞는다.
        if (grantedHere) {
          gtag("consent", "update", allSignals("denied"));
          grantedHere = false;
        }
        remember("denied");
        hideBar();
      });

      document.body.appendChild(bar);
    }

    function remember(value) {
      try { localStorage.setItem(KEY, value); } catch (e) { /* 저장을 막아 둔 브라우저면 그냥 넘어간다 */ }
    }

    // 전에 고른 적이 없을 때만 배너를 띄운다
    if (saved !== "granted" && saved !== "denied") showBar();

    // 화면 맨 아래에 다시 고르는 링크를 둔다.
    // 꼬리글 안이 아니라 그 아래에 따로 붙인다 (꼬리글 글자는 app.js 가 다시 씁니다)
    const relink = document.createElement("div");
    relink.className = "consent-relink";
    relink.innerHTML = '<button type="button">동의 다시 고르기</button>';
    relink.querySelector("button").addEventListener("click", showBar);
    document.body.appendChild(relink);
  });
})();
