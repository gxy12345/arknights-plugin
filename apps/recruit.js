import fs from "fs";
import YAML from 'yaml'
import { rulePrefix } from '../utils/common.js'
import SKLandUser from '../model/sklandUser.js'


const _path = process.cwd();
const valid_tags = ['特种干员', '近战位', '输出', '生存', '近卫干员', '支援', '支援机械', '狙击干员', '远程位', '位移', '减速', '术师干员', '新手', '先锋干员',
    '费用回复', '群攻', '医疗干员', '治疗', '控场', '快速复活', '重装干员', '防护', '爆发', '辅助干员', '削弱', '召唤', '高级资深干员', '资深干员']

const replace_tag_keywords = {
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
}

export class CharProfile extends plugin {
    constructor() {
        super({
            name: '[arknights-plugin]公招计算',
            dsc: '计算公招tag结果',
            event: 'message',
            priority: 500,
            rule: [
                {
                    reg: `^${rulePrefix}公招(计算|查询)(.)+$`,
                    fnc: 'recruit_calc'
                },
            ]
        })
        this.bindUser = {}
    }

    async recruit_calc() {
        let tags = this.get_tags(this.e.msg)
        logger.mark(`[方舟插件][公招查询]公招tag: ${tags}}`)
        let result = this.operatorsFilter(tags)
        let result_msg
        let sklUser = new SKLandUser(this.e.user_id)
        if (!await sklUser.getUser()) {
            result_msg = this.resultToStr(result)
        } else {
            let res = await sklUser.sklReq.getData('game_player_info')
            //未绑定森空岛
            if (res?.code !== 0 || res?.message !== 'OK') {
                result_msg = this.resultToStr(result)

            } else {
                let meta_info_list = Object.values(res.data.charInfoMap)
                let char_info_list = res.data.chars
                result_msg = this.resultToStrWithCred(result, char_info_list, meta_info_list)
            }
        }

        if (result_msg !== '') {
            await this.reply(result_msg)
            // 🆕
        } else {
            await this.reply(`当前tag组合为三星tag`)
        }

    }

    operatorsFilter(tags) {
        let topOperatorsList;
        let operatorsList;
        try {
            const topOperatorsFile = fs.readFileSync(`${_path}/plugins/arknights-plugin/resources/recruit/top_char.json`, 'utf8');
            topOperatorsList = JSON.parse(topOperatorsFile);
            const operatorsFile = fs.readFileSync(`${_path}/plugins/arknights-plugin/resources/recruit/normal_char.json`, 'utf8');
            operatorsList = JSON.parse(operatorsFile);

        } catch (error) {
            logger.error(`[方舟插件][公招查询]读取干员数据失败，msg:${error}`)
            return null;
        }

        const sixStarLimited = {};
        const fiveStarLimited = {};
        const fourStarLimited = {};
        const oneStarLimited = {};
        const normal = {};

        if (tags.includes('高级资深干员')) {
            tags = tags.filter(tag => tag !== '高级资深干员');

            for (let tagNum = 2; tagNum >= 0; tagNum--) {
                for (let selectedTag of this.combinations(tags, tagNum)) {
                    const operators = [];

                    for (let operator in topOperatorsList) {
                        if (this.isSubset(selectedTag, topOperatorsList[operator]['tags'])) {
                            operators.push(operator);
                        }
                    }

                    if (operators.length > 0) {
                        sixStarLimited[this.selectedTagToStr(['高级资深干员', ...selectedTag])] = operators;
                    }
                }
            }
        }

        for (let tagNum = 3; tagNum > 0; tagNum--) {
            for (let selectedTag of this.combinations(tags, tagNum)) {
                const operators = [];

                for (let operator in operatorsList) {
                    if (this.isSubset(selectedTag, operatorsList[operator]['tags'])) {
                        operators.push(operator);
                    }
                }

                if (operators.length > 0) {
                    operators.sort((a, b) => operatorsList[b]['level'] - operatorsList[a]['level']);

                    const levels = operators.map(operator => operatorsList[operator]['level']);

                    if (levels.includes(2) || levels.includes(3)) {
                        normal[this.selectedTagToStr(selectedTag)] = operators;
                    } else {
                        const minLevel = operatorsList[operators[operators.length - 1]]['level'];

                        if (minLevel === 1) {
                            oneStarLimited[this.selectedTagToStr(selectedTag)] = operators;
                        } else if (minLevel === 4) {
                            fourStarLimited[this.selectedTagToStr(selectedTag)] = operators;
                        } else {
                            fiveStarLimited[this.selectedTagToStr(selectedTag)] = operators;
                        }
                    }
                }
            }
        }

        const result = {};
        result['6'] = sixStarLimited;
        result['5'] = fiveStarLimited;
        result['4'] = fourStarLimited;
        result['1'] = oneStarLimited;
        // result['normal'] = normal;

        logger.mark(`[方舟插件][公招查询]${JSON.stringify(result)}`)
        logger.mark(`[方舟插件][公招查询]${JSON.stringify(normal)}`)

        return result;
    }

    * combinations(arr, n) {
        if (n === 0) {
            yield [];
        } else {
            for (let i = 0; i < arr.length; i++) {
                const rest = arr.slice(i + 1);
                for (let combination of this.combinations(rest, n - 1)) {
                    yield [arr[i], ...combination];
                }
            }
        }
    }

    selectedTagToStr(arr) {
        return arr.join('+');
    }

    resultToStr(result_obj) {
        let msg = ""
        for (let star_key in result_obj) {
            if (Object.keys(result_obj[star_key]).length !== 0) {
                msg += `\n${star_key}⭐️`
                let temp_msg
                for (let tag_key in result_obj[star_key]) {
                    if (result_obj[star_key].hasOwnProperty(tag_key)) {
                        temp_msg = '\n' + tag_key + ': ' + result_obj[star_key][tag_key].join(', ');
                        msg += temp_msg
                    }
                }
            }
        }
        if (msg !== "") {
            msg = msg.slice(1)
        }
        return msg
    }

    resultToStrWithCred(result_obj, char_info_list, meta_info_list) {
        let msg = ""
        for (let star_key in result_obj) {
            if (Object.keys(result_obj[star_key]).length !== 0) {
                msg += `\n${star_key}⭐️`
                let temp_msg
                for (let tag_key in result_obj[star_key]) {
                    if (result_obj[star_key].hasOwnProperty(tag_key)) {
                        let char_list = result_obj[star_key][tag_key]
                        let tagged_char_list = []
                        for (let char_name of char_list) {
                            let meta_info = meta_info_list[meta_info_list.findIndex(item => item.name == char_name)]
                            let char_info
                            try {
                                char_info = char_info_list[char_info_list.findIndex(item => item.charId == meta_info.id)]
                                if (char_info.potentialRank == 5) {
                                    tagged_char_list.push(`${char_name}[满]`)
                                } else {
                                    tagged_char_list.push(`${char_name}`)
                                }
                            } catch (e) {
                                tagged_char_list.push(`${char_name}[New]`)
                            }
                        }

                        temp_msg = '\n' + tag_key + ': ' + tagged_char_list.join(', ');
                        msg += temp_msg
                    }
                }
            }
        }
        if (msg !== "") {
            msg = msg.slice(1)
            msg += `\n[New]:当前未持有的干员  [满]:已经满潜的干员`
        }
        return msg
    }


    get_tags(inputString) {
        const keywords = inputString.split(/[ ,，]+/);
        const replaced_keyword = keywords.map(str => {
            if (replace_tag_keywords.hasOwnProperty(str)) {
              return replace_tag_keywords[str];
            }
            return str;
          });
        const tags = replaced_keyword.filter(keyword => valid_tags.includes(keyword));
        return tags;
    }

    isSubset(subset, superset) {
        return subset.every((element) => superset.includes(element));
    }

}