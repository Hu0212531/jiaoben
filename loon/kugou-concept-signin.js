/*
 * 酷狗音乐概念版自动签到领会员 v2-debug（调试版，用完即删）
 *
 * 这个版本每次拦截到 *.kugou.com 请求都会弹通知 + 打日志，
 * 用来定位"为什么抓不到 Cookie"：
 *  - 一条通知都不弹      = rewrite 没触发（插件没在当前配置启用，或 App 请求的域名不是 *.kugou.com）
 *  - 弹"触发但无Cookie"   = 触发了，但 MITM 没解密到 Cookie（证书没装/没信任，或 Mitm 开关没开）
 *  - 弹"抓到Cookie"       = 成功，数据已保存
 */

const KEY_URL = 'kugou_concept_signin_url';
const KEY_HEADERS = 'kugou_concept_signin_headers';
const KEY_BODY = 'kugou_concept_signin_body';
const KEY_METHOD = 'kugou_concept_signin_method';

const STATIC_EXT = /\.(png|jpg|jpeg|gif|webp|css|js|ico|svg|mp3|mp4)(\?|$)/i;

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

// ============ rewrite 模式：调试抓取 ============
function captureMode() {
  const url = $request.url || '';
  const method = ($request.method || 'GET').toUpperCase();

  if (STATIC_EXT.test(url)) return done({});

  const headers = $request.headers || {};
  const cookie = headers['Cookie'] || headers['cookie'];
  const hasCookie = !!cookie;

  console.log(`[kugou-debug] 触发 rewrite: ${method} ${url}`);
  console.log(`[kugou-debug] Cookie: ${hasCookie ? '有(' + String(cookie).length + '字符)' : '无'}`);
  console.log(`[kugou-debug] headers keys: ${Object.keys(headers).join(',')}`);

  if (hasCookie) {
    $persistentStore.write(url, KEY_URL);
    $persistentStore.write(JSON.stringify(headers), KEY_HEADERS);
    $persistentStore.write($request.body || '', KEY_BODY);
    $persistentStore.write(method, KEY_METHOD);
    console.log('[kugou-debug] 已保存到 persistentStore');
  }

  notify(
    '酷狗调试',
    hasCookie ? '抓到Cookie✅' : '触发但无Cookie',
    `${method} ${url.slice(0, 120)}`
  );
  done({});
}

// ============ cron 模式：上报已保存的数据 ============
function cronMode() {
  const url = $persistentStore.read(KEY_URL);
  if (!url) {
    notify('酷狗调试', '暂无保存数据', 'persistentStore 里没有 kugou_concept_signin_url');
    return done();
  }
  const headers = $persistentStore.read(KEY_HEADERS) || '';
  const method = $persistentStore.read(KEY_METHOD) || '';
  notify(
    '酷狗调试',
    '已保存的数据',
    `URL: ${url.slice(0, 100)}\n方法: ${method}\nHeaders长度: ${headers.length}字符`
  );
  console.log(`[kugou-debug] 已保存 URL: ${url}`);
  done();
}

// 入口：有 $request 就是 rewrite 抓取模式，否则是 cron 定时模式
if (typeof $request !== 'undefined' && $request && $request.url) {
  captureMode();
} else {
  cronMode();
}
