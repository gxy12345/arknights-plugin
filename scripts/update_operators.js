#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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

async function runGitCommands(hasChanges, targetBranch) {
    if (!hasChanges) {
        console.log('No changes detected, skipping git operations');
        return false;
    }

    try {
        console.log('Running git commands...');

        // 检查当前工作目录
        const cwd = process.cwd();
        console.log(`Current working directory: ${cwd}`);

        // 检查当前分支
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        console.log(`Current branch: ${currentBranch}`);

        // 创建新的临时分支
        const tempBranch = createBranchName();
        try {
            execSync(`git checkout -b ${tempBranch}`, { stdio: 'inherit' });
            console.log(`Created and switched to temporary branch: ${tempBranch}`);
        } catch (error) {
            // 分支可能已存在，尝试切换并重置
            execSync(`git checkout ${tempBranch}`, { stdio: 'inherit' });
            execSync('git reset --hard HEAD', { stdio: 'inherit' });
            console.log(`Switched to existing temporary branch: ${tempBranch}`);
        }

        // 添加文件
        console.log('Adding file to git...');
        execSync('git add resources/gameData/character/character_info.json', { stdio: 'inherit' });

        // 检查是否有更改
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        console.log('Git status after add:', status);

        // 检查文件差异
        try {
            const diff = execSync('git diff --cached --stat', { encoding: 'utf8' });
            console.log('Git diff --cached --stat:', diff);
        } catch (e) {
            console.log('Git diff error:', e.message);
        }

        if (!status.trim()) {
            console.log('No changes to commit');
            return false;
        }

        console.log('Proceeding with commit...');

        // 提交更改
        const timestamp = new Date().toISOString();
        console.log('Committing changes...');
        execSync(`git commit -m "Update character info from remote source - ${timestamp}"`, { stdio: 'inherit' });
        console.log('Commit completed');

        // 检查当前提交
        const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        console.log('Current commit after commit:', currentCommit);

        // 检查分支差异
        try {
            const diffStat = execSync(`git diff ${targetBranch}..${tempBranch} --stat`, { encoding: 'utf8' });
            console.log('Branch diff stat:', diffStat);
        } catch (e) {
            console.log('Branch diff error:', e.message);
        }

        // 推送分支
        execSync(`git push origin ${tempBranch}`, { stdio: 'inherit' });

        console.log(`Successfully pushed changes to temporary branch: ${tempBranch}`);

        // 输出分支名供workflow使用 (使用新的GITHUB_OUTPUT文件)
        const fs = await import('fs');
        const outputPath = process.env.GITHUB_OUTPUT;
        if (outputPath) {
            fs.appendFileSync(outputPath, `temp_branch=${tempBranch}\n`);
            fs.appendFileSync(outputPath, `has_changes=true\n`);
        }
        // 为了兼容性，同时输出旧格式
        console.log(`::set-output name=temp_branch::${tempBranch}`);
        console.log(`::set-output name=has_changes::true`);

        // 再次检查远程分支差异
        try {
            const remoteDiff = execSync(`git diff ${targetBranch}..origin/${tempBranch} --stat`, { encoding: 'utf8' });
            console.log('Remote branch diff stat:', remoteDiff);
        } catch (e) {
            console.log('Remote branch diff error:', e.message);
        }

        return { success: true, tempBranch };
    } catch (error) {
        console.error('Git operations failed:', error);
        throw error;
    }
}

function createBranchName() {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD格式
    return `update-operators-${timestamp}`;
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
            // 保存文件
            await saveCharacterInfo(localData);

            // 运行git命令
            const gitResult = await runGitCommands(hasChanges, 'dev');

            if (gitResult.success) {
                console.log(`Changes committed and pushed to branch: ${gitResult.tempBranch}`);
                // 输出环境变量供GitHub Actions使用 (使用新的GITHUB_OUTPUT文件)
                const fs = await import('fs');
                const outputPath = process.env.GITHUB_OUTPUT;
                if (outputPath) {
                    fs.appendFileSync(outputPath, `has_changes=true\n`);
                    fs.appendFileSync(outputPath, `temp_branch=${gitResult.tempBranch}\n`);
                }
                // 为了兼容性，同时输出旧格式
                console.log('::set-output name=has_changes::true');
                console.log(`::set-output name=temp_branch::${gitResult.tempBranch}`);
            } else {
                console.log('Git operations failed');
                const fs = await import('fs');
                const outputPath = process.env.GITHUB_OUTPUT;
                if (outputPath) {
                    fs.appendFileSync(outputPath, `has_changes=false\n`);
                }
                console.log('::set-output name=has_changes::false');
            }
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

export { main, transformOperator, createBranchName };
