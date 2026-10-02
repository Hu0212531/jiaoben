/*
 * 番茄小说福利页自动领金币 v1（抓取版）
 *
 * 已知：App 接口域名为 *.fqnovel.com（字节系）
 * 未知：福利/签到/领金币的具体接口路径 —— 由本脚本抓取用户手动点一次"领取"时的真实请求
 *
 * 使用：Loon 添加插件后，打开番茄小说福利页，手动点一次"领取金币/签到"，
 *      收到"福利接口已保存"通知即抓取成功，之后每天 9 点 cron 自动重放。
 *
 * 注意（实话）：
 *  1. 字节系接口签名（_signature 等）强绑定时间与设备，隔天重放很可能失效；
 *     cron 会通知结果，失败就手动进 App 点一次，脚本自动刷新保存的接口。
 *  2. 本脚本只做"领取"类接口（签到、领金币按钮），不做看视频/刷时长类任务。
 *  3. 抖音系 App 可能有证书固定，若福利页在 Loon MITM 下打不开/抓不到，就是这个原因。
 */

const KEY_URL = 'fanqie_fuli_url';
const KEY_HEADERS = 'fanqie_fuli_headers';
const KEY_BODY = 'fanqie_fuli_body';
const KEY_METHOD = 'fanqie_fuli_method';
const KEY_TIME = 'fanqie_fuli_save_time';

// 福利/领取相关关键词。注意：不用裸 "sign"，字节 URL 里到处是 _signature，会误杀
const WELFARE_RE = /task|reward|coin|checkin|fuli|welfare|treasure|bonus|gold|receive|claim/i;
const STATIC_RE = /\.(png|jpg|jpeg|gif|webp|css|js|mp4)(\?|$)/i;

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

function pathOf(url) {
  const m = String(url).match(/^https?:\/\/[^/]+(\/[^?#]*)/);
  return m ? m[1] : String(url).slice(0, 80);
}

// ============ rewrite 模式：抓取福利领取接口 ============
function captureMode() {
  const url = $request.url || '';
  const method = ($request.method || 'GET').toUpperCase();

  if (!WELFARE_RE.test(url)) return done({});
  if (STATIC_RE.test(url)) return done({});

  $persistentStore.write(url, KEY_URL);
  $persistentStore.write(JSON.stringify($request.headers || {}), KEY_HEADERS);
  $persistentStore.write($request.body || '', KEY_BODY);
  $persistentStore.write(method, KEY_METHOD);
  $persistentStore.write(String(Date.now()), KEY_TIME);

  console.log(`[fanqie-fuli] 已保存福利接口: ${method} ${pathOf(url)}`);

  // 10 分钟通知节流，避免刷屏
  const lastNotify = parseInt($persistentStore.read('fanqie_fuli_last_notify') || '0', 10);
  if (Date.now() - lastNotify > 10 * 60 * 1000) {
    $persistentStore.write(String(Date.now()), 'fanqie_fuli_last_notify');
    notify('番茄福利', '福利接口已保存', `${method} ${pathOf(url)}`);
  }
  done({});
}

// ============ cron 模式：执行领取 ============
function cronMode() {
  const url = $persistentStore.read(KEY_URL);

  if (!url) {
    notify('番茄福利', '未保存福利接口', '请先去番茄小说福利页手动点一次领取');
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
      notify('番茄福利', '请求失败', String(error).slice(0, 200));
      return done();
    }

    const raw = String(data || '');
    let msg = raw.slice(0, 200);
    try {
      const json = JSON.parse(raw);
      msg = json.msg || json.message || json.error_msg || raw.slice(0, 200);
    } catch (e) { /* 保持原文截断 */ }

    const expired = /登录|login|过期|expire|签名|sign|失效|鉴权/i.test(msg) && !/成功|success/i.test(msg);
    notify(
      '番茄福利',
      response.status === 200 && !expired ? '领取成功' : '可能需要重新获取',
      expired ? '签名疑似过期，请去App福利页手动点一次领取刷新' : msg
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
