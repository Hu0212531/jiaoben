/*
 * 波点音乐去开屏弹窗 v1
 *
 * 原理：App 启动时会请求 /api/popup/start/info 获取开屏弹窗配置，
 * 返回中的 data.content.show=true 即表示"本次要展示开屏弹窗"。
 * 本脚本把 show 改为 false、status 改为 0，
 * 告诉 App 本次无弹窗可显示，App 走正常"无广告"分支直接进主界面。
 * 相比直接 reject 请求，这种方式不会触发 App 的重试/卡住逻辑，更稳。
 */

try {
  var obj = JSON.parse($response.body);
  if (obj && obj.data) {
    if (obj.data.content) obj.data.content.show = false;
    obj.data.status = 0;
  }
  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done({});
}
