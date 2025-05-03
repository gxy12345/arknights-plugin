let charData = {
    profession_list: ['近卫', '狙击', '先锋', '医疗', '术师', '特种', '重装', '辅助'],

    valid_tags: ['特种干员', '近战位', '输出', '生存', '近卫干员', '支援', '支援机械', '狙击干员', '远程位', '位移', '减速', '术师干员', '新手', '先锋干员',
        '费用回复', '群攻', '医疗干员', '治疗', '控场', '快速复活', '重装干员', '防护', '爆发', '辅助干员', '削弱', '召唤', '高级资深干员', '资深干员', '元素'],

    replace_tag_keywords: {
        '近卫': '近卫干员',
        '重装': '重装干员',
        '辅助': '辅助干员',
        '狙击': '狙击干员',
        '先锋': '先锋干员',
        '术师': '术师干员',
        '术士': '术师干员',
        '特种': '特种干员',
        '医疗': '医疗干员',
        '近战': '近战位',
        '远程': '远程位',
        '高资': '高级资深干员',
        '资深': '资深干员',
        '高级资深': '高级资深干员',
        '机械': '支援机械',
        '快活': '快速复活',
        '回费': '费用回复',
    },

    profession_map: {
        '近卫': 'WARRIOR',
        '重装': 'TANK',
        '辅助': 'SUPPORT',
        '狙击': 'SNIPER',
        '先锋': 'PIONEER',
        '术师': 'CASTER',
        '特种': 'SPECIAL',
        '医疗': 'MEDIC',
    },

    rarity_keywords: ['六星', '五星', '四星', '三星', '二星', '一星', '6星', '5星', '4星', '3星', '2星', '1星'],

    rarity_keywords_map: {
        '六星': 5,
        '五星': 4,
        '四星': 3,
        '三星': 2,
        '二星': 1,
        '一星': 0,
        '6星': 5,
        '5星': 4,
        '4星': 3,
        '3星': 2,
        '2星': 1,
        '1星': 0
    },

    amiya_ids: {
        '阿米娅': 'char_002_amiya',
        '阿米娅（近卫）': 'char_1001_amiya2',
        '阿米娅（医疗）': 'char_1037_amiya3'
    }

}

let gameData = {
    material_list: [
        "环烃聚质", "研磨石", "转质盐组", "扭转醇", "褐素纤维", "轻锰矿", "固源岩组", "凝胶", "糖组", "RMA70-12",
        "半自然溶剂", "酮凝集组", "化合切削液", "全新装置", "炽合金", "聚酸酯组", "晶体元件", "异铁组",
    ],

    daily_resource: [
        {
            code: "LS",
            name: "作战记录",
            day: [1, 2, 3, 4, 5, 6, 7]
        },
        {
            code: "CE",
            name: "龙门币",
            day: [2, 4, 6, 7]
        },
        {
            code: "AP",
            name: "采购凭证",
            day: [1, 4, 6, 7]
        },
        {
            code: "SK",
            name: "碳素",
            day: [1, 3, 5, 6]
        },
        {
            code: "CA",
            name: "技巧概要",
            day: [2, 3, 5, 7]
        },
        {
            code: "PRA",
            name: "固若金汤",
            day: [1, 4, 5, 7],
        },
        {
            code: "PRB",
            name: "摧枯拉朽",
            day: [1, 2, 5, 6],
        },
        {
            code: "PRC",
            name: "势不可当",
            day: [3, 4, 6, 7],
        },
        {
            code: "PRD",
            name: "身先士卒",
            day: [2, 3, 6, 7],
        }
    ],

    analysis_rule: [
        // 1星
        {
            level_evo0: 6,
            level_evo1: 6,
            specialize: [0, 0, 0, 0],
            equip: [0, 0, 0],
            potential: 1,
            max_score: 21,
        },
        // 2星
        {
            level_evo0: 6,
            level_evo1: 6,
            specialize: [0, 0, 0, 0],
            equip: [0, 0, 0],
            potential: 1,
            max_score: 21,
        },
        // 3星
        {
            level_evo0: 10,
            level_evo1: 10,
            specialize: [0, 0, 0, 0],
            equip: [0, 0, 0],
            potential: 1,
            max_score: 59.5,
        },
        // 4星
        {
            level_evo0: 10,
            level_evo1: 40,
            specialize: [0, 5, 10, 15],
            equip: [5, 10, 20],
            potential: 1,
            max_score: 192,
        },
        // 5星
        {
            level_evo0: 10,
            level_evo1: 45,
            specialize: [0, 10, 20, 30],
            equip: [10, 25, 40],
            potential: 2,
            max_score: 272,
        },
        // 6星
        {
            level_evo0: 10,
            level_evo1: 50,
            specialize: [0, 20, 40, 60],
            equip: [15, 40, 65],
            potential: 4,
            max_score: 477,
        },
    ],

    analysis_rank: {
        C: 750,
        B: 2000,
        A: 6000,
        S: 12000,
        SS: 18000,
        SSS: 30000,
        ACE: 46000,
        MAX: 64000
    },
}

export default {
    charData,
    gameData,
}