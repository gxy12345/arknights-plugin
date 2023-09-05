export const getSkinAvatarUrl = (skinId) => {
    skinId = skinId.replace(/@/g, '%40');
    skinId = skinId.replace(/#/g, '%23');
    return `https://web.hycdn.cn/arknights/game/assets/char_skin/avatar/${skinId}.png`;
};

export const getSkinPortraitUrl = (skinId) => {
    skinId = skinId.replace(/@/g, '%40');
    skinId = skinId.replace(/#/g, '%23');
    return `https://web.hycdn.cn/arknights/game/assets/char_skin/portrait/${skinId}.png`;
};

export const getAvatarUrl = (skinId) => {
    return `https://web.hycdn.cn/arknights/game/assets/avatar/${skinId}.png`;
};

export const getSkillIconUrl = (skillId) => {
    return `https://web.hycdn.cn/arknights/game/assets/char_skill/${skillId}.png`;
};

export const getTowerIconUrl = (towerId) => {
    return `https://web.hycdn.cn/arknights/game/assets/climb_tower/icon/${towerId}.png`;
};

export const getEquipIconUrl = (equipId) => {
    return `https://web.hycdn.cn/arknights/game/assets/uniequip/${equipId}.png`;
};

export const getEquipTypeIconUrl = (equipId) => {
    return `https://web.hycdn.cn/arknights/game/assets/uniequip/type/icon/${equipId}.png`;
};

export const getEquipTypeShiningUrl = (color) => {
    return `https://web.hycdn.cn/arknights/game/assets/uniequip/type/shining/${color}.png`;
};

export const getSkinBrandLogoUrl = (brand) => {
    return `https://web.hycdn.cn/arknights/game/assets/brand/${brand}.png`;
};

export const getZoneLogoUrl = (zoneId) => {
    return `https://web.hycdn.cn/arknights/game/assets/game_mode/campaign/zone_icon/${zoneId}.png`;
};

export const getMedalUrl = (medalId) => {
    return `https://web.hycdn.cn/arknights/game/assets/medal/${medalId}.png`;
};

export const getActivityLogoUrl = (activityId) => {
    return `https://bbs.hycdn.cn/skland-fe-static/skland-rn/images/game-arknight/${activityId}.png`;
};

export const getRougeBannerUrl = (rougeId) => {
    return `https://bbs.hycdn.cn/skland-fe-static/skland-rn/images/game-arknight/${rougeId}.png`;
};
