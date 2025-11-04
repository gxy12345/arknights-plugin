#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REMOTE_JSON_URL = 'https://raw.githubusercontent.com/ZOOT-Plus/zoot-plus-frontend/f9ba88b019cf5a671578736038cf522c53d6763b/src/models/generated/operators.json';
const CHARACTER_INFO_PATH = path.join(__dirname, '..', 'resources', 'gameData', 'character', 'character_info.json');

async function downloadRemoteJson() {
    console.log('Downloading remote operators JSON...');
    try {
        const response = await fetch(REMOTE_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`Downloaded ${data.OPERATORS.length} operators from remote`);
        return data;
    } catch (error) {
        console.error('Failed to download remote JSON:', error);
        throw error;
    }
}

async function readLocalCharacterInfo() {
    console.log('Reading local character_info.json...');
    try {
        const content = await fs.readFile(CHARACTER_INFO_PATH, 'utf8');
        const data = JSON.parse(content);
        const existingIds = new Set(Object.keys(data.character_info));
        console.log(`Found ${existingIds.size} existing characters`);
        return { data, existingIds };
    } catch (error) {
        console.error('Failed to read local character_info.json:', error);
        throw error;
    }
}

function transformOperator(operator) {
    // 过滤掉TOKEN类型的角色
    if (operator.prof === 'TOKEN') {
        return null;
    }

    // 转换格式以匹配本地character_info.json的结构
    return {
        id: operator.id,
        prof: operator.prof,
        subProf: operator.subProf,
        name: operator.name,
        rarity: operator.rarity,
        modules: operator.modules || [""] // 使用源数据中的modules字段，如果没有则默认为空数组
    };
}

async function updateCharacterInfo(remoteData, localData, existingIds) {
    console.log('Updating character info...');
    let addedCount = 0;

    for (const operator of remoteData.OPERATORS) {
        const transformed = transformOperator(operator);
        if (!transformed) continue;

        if (!existingIds.has(transformed.id)) {
            localData.character_info[transformed.id] = transformed;
            addedCount++;
            console.log(`Added: ${transformed.name} (${transformed.id})`);
        }
    }

    console.log(`Added ${addedCount} new characters`);
    return addedCount > 0;
}

async function saveCharacterInfo(data) {
    console.log('Saving updated character_info.json...');
    const content = JSON.stringify(data, null, 4);
    await fs.writeFile(CHARACTER_INFO_PATH, content, 'utf8');
    console.log('File saved successfully');

    // 检查文件大小
    const stats = await fs.stat(CHARACTER_INFO_PATH);
    console.log(`File size: ${stats.size} bytes`);

    // 检查角色数量
    const characterCount = Object.keys(data.character_info).length;
    console.log(`Total characters in file: ${characterCount}`);
}

// 简化的数据更新函数，只处理数据逻辑
async function updateDataOnly(hasChanges) {
    if (!hasChanges) {
        console.log('No changes detected');
        return false;
    }

    console.log('Data updated successfully, files modified in working directory');
    return true;
}

async function main() {
    try {
        console.log('Starting operator update process...');

        // 下载远程数据
        const remoteData = await downloadRemoteJson();

        // 读取本地数据
        const { data: localData, existingIds } = await readLocalCharacterInfo();

        // 更新数据
        const hasChanges = await updateCharacterInfo(remoteData, localData, existingIds);

        if (hasChanges) {
            // 保存文件到工作目录，peter-evans会处理git操作
            await saveCharacterInfo(localData);

            // 标记有变化，peter-evans会处理后续操作
            await updateDataOnly(hasChanges);

            // 输出环境变量供GitHub Actions使用
            const fs = await import('fs');
            const outputPath = process.env.GITHUB_OUTPUT;
            if (outputPath) {
                fs.appendFileSync(outputPath, `has_changes=true\n`);
            }
            console.log('::set-output name=has_changes::true');
        } else {
            console.log('No updates needed');
            const fs = await import('fs');
            const outputPath = process.env.GITHUB_OUTPUT;
            if (outputPath) {
                fs.appendFileSync(outputPath, `has_changes=false\n`);
            }
            console.log('::set-output name=has_changes::false');
        }

        console.log('Update process completed successfully');
    } catch (error) {
        console.error('Update process failed:', error);
        const fs = await import('fs');
        const outputPath = process.env.GITHUB_OUTPUT;
        if (outputPath) {
            fs.appendFileSync(outputPath, `has_changes=false\n`);
        }
        console.log('::set-output name=has_changes::false');
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { main, transformOperator };
