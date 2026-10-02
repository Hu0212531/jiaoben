/*
 * 波点音乐去开屏弹窗 v3（base64兼容版）
 *
 * 酷我/腾讯音乐系接口返回的是 base64 编码的 JSON，
 * 之前版本直接 JSON.parse($response.body) 会抛异常走 catch，
 * 导致静默失败（无通知、无改写）。本版先解码再处理。
 */

function b64decode(s) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var out = '';
  var i = 0;
  s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < s.length) {
    var e1 = chars.indexOf(s.charAt(i++));
    var e2 = chars.indexOf(s.charAt(i++));
    var e3 = chars.indexOf(s.charAt(i++));
    var e4 = chars.indexOf(s.charAt(i++));
    var c1 = (e1 << 2) | (e2 >> 4);
    var c2 = ((e2 & 15) << 4) | (e3 >> 2);
    var c3 = ((e3 & 3) << 6) | e4;
    out += String.fromCharCode(c1);
    if (e3 !== 64) out += String.fromCharCode(c2);
    if (e4 !== 64) out += String.fromCharCode(c3);
  }
  return decodeURIComponent(escape(out));
}

function b64encode(s) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  s = unescape(encodeURIComponent(s));
  var out = '';
  var i = 0;
  while (i < s.length) {
    var c1 = s.charCodeAt(i++);
    var c2 = s.charCodeAt(i++);
    var c3 = s.charCodeAt(i++);
    var e1 = c1 >> 2;
    var e2 = ((c1 & 3) << 4) | (c2 >> 4);
    var e3 = ((c2 & 15) << 2) | (c3 >> 6);
    var e4 = c3 & 63;
    if (isNaN(c2)) { e3 = e4 = 64; }
    else if (isNaN(c3)) { e4 = 64; }
    out += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return out;
}

function notify(title, sub, body) {
  if (typeof $notification !== 'undefined' && typeof $notification.post === 'function') {
    $notification.post(title, sub || '', body || '');
  } else {
    console.log('[' + title + '] ' + (sub || '') + ' ' + (body || ''));
  }
}

function done(r) {
  if (typeof $done === 'function') $done(r || {});
}

try {
  var raw = $response.body || '';
  var text = raw;
  var wasB64 = false;
  // 先尝试直接解析；失败则按 base64 解码后再解析
  try {
    JSON.parse(text);
  } catch (e1) {
    text = b64decode(raw);
    JSON.parse(text); // 仍失败则抛到外层 catch
    wasB64 = true;
  }

  var obj = JSON.parse(text);
  var origShow = obj && obj.data && obj.data.content ? String(obj.data.content.show) : 'unknown';
  if (obj && obj.data) {
    if (obj.data.content) obj.data.content.show = false;
    obj.data.status = 0;
  }

  var outBody = JSON.stringify(obj);
  if (wasB64) outBody = b64encode(outBody);

  notify('波点去开屏', '弹窗接口已改写' + (wasB64 ? '(base64)' : ''), '原 show=' + origShow + ' → false');
  done({ body: outBody });
} catch (e) {
  notify('波点去开屏', '改写失败', String(e && e.message || e).slice(0, 100));
  done({});
}
