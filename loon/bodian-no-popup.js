/*
 * 波点音乐去开屏弹窗 v2（诊断版）
 *
 * 在改写返回的同时发一条通知，用于确认规则是否真的触发。
 * 如果收到通知但开屏还在 → 广告不是这个弹窗接口，得换目标；
 * 如果没收到通知 → 规则没生效（插件版本/MITM问题）。
 */

try {
  var obj = JSON.parse($response.body);
  var origShow = obj && obj.data && obj.data.content ? String(obj.data.content.show) : 'unknown';
  if (obj && obj.data) {
    if (obj.data.content) obj.data.content.show = false;
    obj.data.status = 0;
  }
  if (typeof $notification !== 'undefined' && typeof $notification.post === 'function') {
    $notification.post('波点去开屏', '弹窗接口已改写', '原 show=' + origShow + ' → false');
  } else {
    console.log('[bodian-no-popup] 已改写，原 show=' + origShow);
  }
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done({});
}
