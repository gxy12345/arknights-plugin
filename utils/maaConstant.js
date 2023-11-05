export const task_type_map = {
    "一键长草": "LinkStart",
    "自动公招": "LinkStart-Recruiting",
    "刷理智": "LinkStart-Combat",
    "获取信用": "LinkStart-Mall",
    "基建换班": "LinkStart-Base",
    "领取奖励": "LinkStart-Mission",
    "自动肉鸽": "LinkStart-AutoRoguelike",
    "停止任务": "StopTask"
}

export function get_task_name(value) {
    for (let key in task_type_map) {
      if (task_type_map[key] === value) {
        return key;
      }
    }
  }