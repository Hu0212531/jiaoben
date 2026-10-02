/*
 * 酷狗音乐概念版自动签到领会员
 *
 * 使用方法：
 * 1. 在 Loon 中添加本插件并确保开关是打开的，Loon 处于运行中（VPN 已连接）
 * 2. 确认 MITM 证书已安装并信任（否则脚本看不到 HTTPS 请求）
 * 3. 打开酷狗概念版 App，进入"天天签到领VIP"页，手动点一次签到
 * 4. 脚本自动抓取该请求的 Cookie 等信息并保存，通知提示"Cookie获取成功"
 * 5. 之后每天 9 点自动执行签到
 *
 * 注意：Cookie 会过期，如果哪天签到失败，去 App 里再手动签到一次即可刷新。
 */

const KEY_URL = 'kugou_concept_signin_url';
const KEY_HEADERS = 'kugou_concept_signin_headers';
const KEY_BODY = 'kugou_concept_signin_body';
const KEY_METHOD = 'kugou_concept_signin_method';

// 疑似签到/任务接口的 URL 关键字（命中则直接保存）
const SIGN_KEYWORDS = /sign|checkin|task|signin|daily/i;
// 排除的静态资源后缀，避免保存图片/CSS/JS 请求
const STATIC_EXT = /\.(png|jpg|jpeg|gif|webp|css|js|ico|svg|mp3|mp4)(\?|$)/i;

function notify(title, subtitle, body) {
  if (typeof $notification !== 'function' && typeof $notification === 'undefined') {
    console.log(`[${title}] ${subtitle || ''} ${body || ''}`);
    return;
  }
  $notification.post(title, subtitle || '', body || '');
}

function done(result) {
  if (typeof $done === 'function') $done(result || {});
}

// ============ rewrite 模式：抓取 Cookie ============
function captureMode() {
  const url = $request.url || '';
  const method = ($request.method || 'GET').toUpperCase();

  // 排除静态资源
  if (STATIC_EXT.test(url)) return done({});

  const isSignApi = SIGN_KEYWORDS.test(url);
  // 签到动作通常是 POST；关键字命中则无论 GET/POST 都保存
  const shouldCapture = isSignApi || method === 'POST';

  if (!shouldCapture) return done({});

  $persistentStore.write(url, KEY_URL);
  $persistentStore.write(JSON.stringify($request.headers || {}), KEY_HEADERS);
  $persistentStore.write($request.body || '', KEY_BODY);
  $persistentStore.write(method, KEY_METHOD);

  notify(
    '酷狗概念版签到',
    'Cookie获取成功',
    `已保存接口：${url.slice(0, 120)}`
  );
  done({});
}

// ============ cron 模式：执行签到 ============
function cronMode() {
  const url = $persistentStore.read(KEY_URL);

  if (!url) {
    notify(
      '酷狗概念版签到',
      '未获取到Cookie',
      '请先去App"天天签到领VIP"页手动签到一次'
    );
    return done();
  }

  let headers = {};
  try {
    headers = JSON.parse($persistentStore.read(KEY_HEADERS) || '{}');
  } catch (e) {
    headers = {};
  }
  const body = $persistentStore.read(KEY_BODY) || '';
  const method = ($persistentStore.read(KEY_METHOD) || 'POST').toUpperCase();

  const options = { url, headers, body };
  const request = method === 'POST' ? $httpClient.post : $httpClient.get;

  request(options, (error, response, data) => {
    if (error) {
      notify('酷狗概念版签到', '请求失败', String(error).slice(0, 200));
      return done();
    }

    let msg = '';
    try {
      const json = JSON.parse(data);
      msg =
        json.msg ||
        json.message ||
        json.error_msg ||
        JSON.stringify(json).slice(0, 200);
    } catch (e) {
      msg = String(data).slice(0, 200);
    }

    const expired =
      /登录|login|过期|expire|token失效|身份/i.test(msg) &&
      !/成功|success/i.test(msg);

    notify(
      '酷狗概念版签到',
      response.status === 200 && !expired ? '签到成功' : '可能需要重新获取',
      expired ? 'Cookie疑似过期，请去App手动签到一次刷新' : msg
    );
    done();
  });
}

// 入口：有 $request 就是 rewrite 抓取模式，否则是 cron 定时模式
if (typeof $request !== 'undefined' && $request && $request.url) {
  captureMode();
} else {
  cronMode();
}
