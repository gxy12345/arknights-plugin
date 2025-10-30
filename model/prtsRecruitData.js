import fs from 'fs';
import fetch from 'node-fetch';

const _path = process.cwd();
const PRTS_API_URL = 'https://prts.wiki/api.php?action=cargoquery&format=json&tables=chara%2Cchar_obtain&limit=500&fields=chara.profession%2Cchara.position%2Cchara.rarity%2Cchara.tag%2Cchara.cn%2Cchar_obtain.obtainMethod%2Cchara.charId&where=char_obtain.obtainMethod+like+%22%25%E5%85%AC%E5%BC%80%E6%8B%9B%E5%8B%9F%25%22+AND+chara.charIndex%3E0&join_on=chara._pageName%3Dchar_obtain._pageName';
const CACHE_DURATION = 10 * 60 * 1000; // 10分钟缓存

// 职业映射：PRTS中文 -> 游戏内中文
const professionMap = {
    '先锋': '先锋干员',
    '近卫': '近卫干员',
    '重装': '重装干员',
    '狙击': '狙击干员',
    '术师': '术师干员',
    '医疗': '医疗干员',
    '辅助': '辅助干员',
    '特种': '特种干员'
};

// 位置映射：PRTS中文 -> 游戏内中文
const positionMap = {
    '近战位': '近战位',
    '远程位': '远程位'
};

// 星级映射：PRTS格式(0-5) -> 游戏内格式(1-6)
const rarityMap = {
    '0': 1,
    '1': 2,
    '2': 3,
    '3': 4,
    '4': 5,
    '5': 6
};

/**
 * PRTS公招数据管理类
 */
class PRTSRecruitData {
    constructor() {
        this.cacheKey = 'arknights:recruit:data';
        this.cacheTimestampKey = 'arknights:recruit:timestamp';
        this.redis = null;
        this.initRedis();
    }

    /**
     * 初始化Redis连接
     */
    async initRedis() {
        try {
            // 尝试获取Yunzai的Redis实例
            if (global.redis) {
                this.redis = global.redis;
                logger.info('[方舟插件][公招数据]Redis连接成功');
            } else {
                logger.warn('[方舟插件][公招数据]Redis未初始化，将直接从PRTS获取数据');
            }
        } catch (error) {
            logger.warn('[方舟插件][公招数据]Redis初始化失败，将直接从PRTS获取数据');
            this.redis = null;
        }
    }

    /**
     * 从Redis获取缓存数据
     */
    async getCachedData() {
        if (!this.redis) return null;
        
        try {
            const timestamp = await this.redis.get(this.cacheTimestampKey);
            if (!timestamp) return null;

            const now = Date.now();
            if (now - parseInt(timestamp) > CACHE_DURATION) {
                // 缓存过期
                return null;
            }

            const data = await this.redis.get(this.cacheKey);
            if (data) {
                logger.info('[方舟插件][公招数据]使用Redis缓存数据');
                return JSON.parse(data);
            }
        } catch (error) {
            logger.error('[方舟插件][公招数据]读取Redis缓存失败:', error);
        }
        
        return null;
    }

    /**
     * 将数据保存到Redis缓存
     */
    async setCachedData(data) {
        if (!this.redis) return;
        
        try {
            await this.redis.set(this.cacheKey, JSON.stringify(data));
            await this.redis.set(this.cacheTimestampKey, Date.now().toString());
            // 设置过期时间为15分钟（略长于缓存时长以确保安全）
            await this.redis.expire(this.cacheKey, 15 * 60);
            await this.redis.expire(this.cacheTimestampKey, 15 * 60);
            logger.info('[方舟插件][公招数据]数据已缓存到Redis');
        } catch (error) {
            logger.error('[方舟插件][公招数据]写入Redis缓存失败:', error);
        }
    }

    /**
     * 从PRTS API获取数据
     */
    async fetchFromPRTS() {
        try {
            logger.info('[方舟插件][公招数据]正在从PRTS获取数据...');
            const response = await fetch(PRTS_API_URL, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Yunzai-Bot/1.0)'
                }
            });

            if (!response.ok) {
                throw new Error(`PRTS API请求失败: ${response.status}`);
            }

            const data = await response.json();
            logger.info('[方舟插件][公招数据]从PRTS获取数据成功');
            return data;
        } catch (error) {
            logger.error('[方舟插件][公招数据]从PRTS获取数据失败:', error);
            return null;
        }
    }

    /**
     * 加载本地内建数据
     */
    loadLocalData() {
        try {
            logger.info('[方舟插件][公招数据]使用本地内建数据');
            const normalCharFile = fs.readFileSync(`${_path}/plugins/arknights-plugin/resources/recruit/normal_char.json`, 'utf8');
            const topCharFile = fs.readFileSync(`${_path}/plugins/arknights-plugin/resources/recruit/top_char.json`, 'utf8');
            
            return {
                normal: JSON.parse(normalCharFile),
                top: JSON.parse(topCharFile)
            };
        } catch (error) {
            logger.error('[方舟插件][公招数据]读取本地数据失败:', error);
            return null;
        }
    }

    /**
     * 将PRTS数据转换为游戏内格式
     */
    convertPRTSData(prtsData) {
        if (!prtsData || !prtsData.cargoquery) {
            return null;
        }

        const normalOperators = {};
        const topOperators = {};

        for (const item of prtsData.cargoquery) {
            const char = item.title;
            const name = char.cn;
            const rarity = rarityMap[char.rarity];
            
            // 只处理包含"公开招募"的干员，排除仅活动获得的
            if (!char.obtainMethod || !char.obtainMethod.includes('公开招募')) {
                continue;
            }

            // 处理标签
            const tags = [];
            
            // 添加职业标签
            if (char.profession && professionMap[char.profession]) {
                tags.push(professionMap[char.profession]);
            }
            
            // 添加位置标签
            if (char.position && positionMap[char.position]) {
                tags.push(positionMap[char.position]);
            }
            
            // 添加技能标签（从tag字段解析）
            if (char.tag) {
                const skillTags = char.tag.split(' ').filter(t => t.trim());
                tags.push(...skillTags);
            }

            // 根据星级分类
            if (rarity === 6) {
                // 6星干员放入top_char（高级资深干员）
                topOperators[name] = {
                    level: 6,
                    tags: tags,
                    charId: char.charId || ''
                };
            } else if (rarity >= 4) {
                // 4-5星干员需要资深干员标签
                normalOperators[name] = {
                    level: rarity,
                    tags: [...tags, '资深干员'],
                    charId: char.charId || ''
                };
            } else {
                // 1-3星普通干员
                normalOperators[name] = {
                    level: rarity,
                    tags: tags,
                    charId: char.charId || ''
                };
            }
        }

        return {
            normal: normalOperators,
            top: topOperators
        };
    }

    /**
     * 获取公招数据（主入口）
     * 优先级：Redis缓存 > PRTS API > 本地数据
     */
    async getData() {
        // 1. 尝试从Redis缓存获取
        let cachedData = await this.getCachedData();
        if (cachedData) {
            return cachedData;
        }

        // 2. 尝试从PRTS获取
        const prtsData = await this.fetchFromPRTS();
        if (prtsData) {
            const convertedData = this.convertPRTSData(prtsData);
            if (convertedData) {
                // 保存到Redis缓存
                await this.setCachedData(convertedData);
                return convertedData;
            }
        }

        // 3. 使用本地内建数据
        return this.loadLocalData();
    }
}

// 创建单例
const prtsRecruitData = new PRTSRecruitData();

export default prtsRecruitData;

