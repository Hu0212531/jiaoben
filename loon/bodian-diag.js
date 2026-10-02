/*
 * 波点诊断脚本
 * 用法1（cron）：每分钟发一条通知 → 测试 iOS 通知通道是否通
 * 用法2（http-response）：命中弹窗接口时通知 → 测试重写规则是否触发
 */

function notify(t, s, b) {
  if (typeof $notification !== 'undefined' && typeof $notification.post === 'function') {
    $notification.post(t, s || '', b || '');
  }
}

function done(r) {
  if (typeof $done === 'function') $done(r || {});
}

if (typeof $request !== 'undefined' && $request && $request.url) {
  var url = String($request.url || '');
  notify('诊断-规则触发', url.split('?')[0].slice(-90), '');
  done({});
} else {
  var d = new Date();
  var hh = d.getHours(); var mm = d.getMinutes();
  notify('诊断-通知通道', '看到这条=通知是通的', hh + ':' + (mm < 10 ? '0' : '') + mm);
  done();
}
