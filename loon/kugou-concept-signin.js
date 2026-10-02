/*
 * 酷狗音乐概念版自动签到 v3
 *
 * 2026-10-03 真机抓包实测结论：
 *  - 签到相关接口：gateway.kugou.com/yutc/youth/v1/task/sign*（sign_state 查状态）
 *  - 该 App 请求不带 Cookie，靠 URL 里的 clienttoken/mid/uuid + kg- 开头请求头鉴权
 *  - 因此不再以 Cookie 为抓取条件，改为匹配 sign 相关接口并保存完整 URL+请求头
 *
 * 使用：进 App 点一次签到（当天还没签时点的那次才是真正的签到动作），脚本自动保存接口；
 *      之后每天 9 点自动重放。
 * 注意：请求带时间签名，重放可能过期；cron 会通知结果，失败就进 App 手动点一次刷新。
 */

const KEY_URL = 'kugou_concept_signin_url';
const KEY_HEADERS = 'kugou_concept_signin_headers';
const KEY_BODY = 'kugou_concept_signin_body';
const KEY_METHOD = 'kugou_concept_signin_method';
const KEY_IS_ACTION = 'kugou_concept_signin_is_action';

function notify(title, subtitle, body) {
  if (typeof $notification !== 'undefined' && typeof $notification.post === 'function') {
    $notification.post(title, subtitle || '', body || '');
  } else {
    console.log(`[${title}] ${subtitle || ''} ${body || ''}`);
  }
}

function done(result) {
  if (typeof $done === 'function') $done(result || {});
}

// ============ rewrite 模式：保存签到接口 ============
function captureMode() {
  const url = $request.url || '';
  const method = ($request.method || 'GET').toUpperCase();

  // 只关心签到相关接口
  if (!/sign/i.test(url)) return done({});

  // 真正的签到动作（排除 sign_state 这类状态查询）
  const isAction = /\/task\/sign(\?|$)/i.test(url);

  const prevUrl = $persistentStore.read(KEY_URL);
  // 策略：签到动作接口永远覆盖保存；状态查询接口只在没保存过时才保存（兜底）
  if (!isAction && prevUrl) return done({});

  $persistentStore.write(url, KEY_URL);
  $persistentStore.write(JSON.stringify($request.headers || {}), KEY_HEADERS);
  $persistentStore.write($request.body || '', KEY_BODY);
  $persistentStore.write(method, KEY_METHOD);
  $persistentStore.write(isAction ? '1' : '0', KEY_IS_ACTION);

  console.log(`[kugou-signin] 已保存${isAction ? '签到动作' : '状态查询'}接口: ${method} ${url.slice(0, 150)}`);
  notify(
    '酷狗概念版签到',
    '签到接口已保存',
    isAction ? '已保存签到动作接口，明天9点自动签到' : '已保存状态查询接口，点一次真正的签到可更新为动作接口'
  );
  done({});
}

// ============ cron 模式：执行签到 ============
function cronMode() {
  const url = $persistentStore.read(KEY_URL);

  if (!url) {
    notify('酷狗概念版签到', '未保存签到接口', '请先去App"天天签到领VIP"页点一次签到');
    return done();
  }

  let headers = {};
  try {
    headers = JSON.parse($persistentStore.read(KEY_HEADERS) || '{}');
  } catch (e) {
    headers = {};
  }
  const body = $persistentStore.read(KEY_BODY) || '';
  const method = ($persistentStore.read(KEY_METHOD) || 'GET').toUpperCase();

  const options = { url, headers, body };
  const request = method === 'POST' ? $httpClient.post : $httpClient.get;

  request(options, (error, response, data) => {
    if (error) {
      notify('酷狗概念版签到', '请求失败', String(error).slice(0, 200));
      return done();
    }

    let raw = String(data || '');
    // 酷狗接口返回的是 base64 编码的 JSON，尝试解码
    let msg = raw.slice(0, 200);
    let signedToday = false;
    try {
      let text = raw;
      if (/^[A-Za-z0-9+/=]+$/.test(raw.trim()) && raw.length > 100) {
        text = decodeBase64(raw);
      }
      const json = JSON.parse(text);
      const s = JSON.stringify(json);
      signedToday = /"today":1/.test(s);
      msg = json.msg || json.message || json.error_msg || s.slice(0, 200);
    } catch (e) {
      try {
        const json = JSON.parse(raw);
        msg = json.msg || json.message || json.error_msg || raw.slice(0, 200);
      } catch (e2) { /* 保持原文截断 */ }
    }

    const expired = /登录|login|过期|expire|token失效|身份|签名/i.test(msg) && !/成功|success/i.test(msg) && !signedToday;
    notify(
      '酷狗概念版签到',
      signedToday ? '今日已签到' : (response.status === 200 && !expired ? '签到成功' : '可能需要重新获取'),
      expired ? '鉴权疑似过期，请去App手动点一次签到刷新' : msg
    );
    done();
  });
}

function decodeBase64(s) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  let i = 0;
  s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < s.length) {
    const e1 = chars.indexOf(s.charAt(i++));
    const e2 = chars.indexOf(s.charAt(i++));
    const e3 = chars.indexOf(s.charAt(i++));
    const e4 = chars.indexOf(s.charAt(i++));
    const c1 = (e1 << 2) | (e2 >> 4);
    const c2 = ((e2 & 15) << 4) | (e3 >> 2);
    const c3 = ((e3 & 3) << 6) | e4;
    out += String.fromCharCode(c1);
    if (e3 !== 64) out += String.fromCharCode(c2);
    if (e4 !== 64) out += String.fromCharCode(c3);
  }
  return decodeURIComponent(escape(out));
}

// 入口：有 $request 就是 rewrite 抓取模式，否则是 cron 定时模式
if (typeof $request !== 'undefined' && $request && $request.url) {
  captureMode();
} else {
  cronMode();
}
