/*
 * 酷狗音乐概念版自动签到领会员
 *
 * 使用方法：
 * 1. 用 Loon 抓包：打开酷狗概念版 App，手动点一次签到，
 *    在 Loon 的请求记录里找到签到接口（一般是 POST 请求，
 *    URL 里带 sign / checkin / task 等关键字）。
 * 2. 把抓到的 URL、请求头（主要是 Cookie 或 Token）、请求体，
 *    填到下方 TODO 处。
 * 3. 把本插件添加到 Loon，每天 9 点自动执行。
 *
 * BoxJs 订阅（如需面板配置）后续可扩展。
 */

const SIGNIN_URL = ''; // TODO: 填抓包得到的签到接口完整 URL
const SIGNIN_METHOD = 'POST'; // TODO: 按抓包结果改 GET 或 POST
const SIGNIN_HEADERS = {
  // TODO: 填抓包得到的请求头，至少包含 Cookie / Authorization
  // 'Cookie': '...',
  // 'User-Agent': '...',
};
const SIGNIN_BODY = ''; // TODO: POST 时填抓包得到的请求体，GET 时留空

const NOTIFY_KEY = 'kugou_concept_signin_notify';

function notify(title, subtitle, body) {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, subtitle, body);
  } else {
    console.log(`[${title}] ${subtitle} ${body}`);
  }
}

function done() {
  if (typeof $done === 'function') $done({});
}

function doSignin() {
  if (!SIGNIN_URL) {
    notify('酷狗概念版签到', '未配置', '请先抓包填写 SIGNIN_URL 等参数');
    return done();
  }

  const options = {
    url: SIGNIN_URL,
    headers: SIGNIN_HEADERS,
    body: SIGNIN_BODY,
  };

  const request =
    SIGNIN_METHOD.toUpperCase() === 'POST' ? $httpClient.post : $httpClient.get;

  request(options, (error, response, data) => {
    if (error) {
      notify('酷狗概念版签到', '请求失败', String(error).slice(0, 200));
      return done();
    }
    let msg = '';
    try {
      const json = JSON.parse(data);
      // TODO: 按实际返回格式解析，这里做通用处理
      msg = json.msg || json.message || JSON.stringify(json).slice(0, 200);
    } catch (e) {
      msg = String(data).slice(0, 200);
    }
    const ok = response.status === 200;
    notify(
      '酷狗概念版签到',
      ok ? '已执行' : `状态码 ${response.status}`,
      msg
    );
    done();
  });
}

doSignin();
