#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

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
        modules: [""] // 默认空模块，根据实际情况可能需要调整
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
}

function runGitCommands(hasChanges) {
    if (!hasChanges) {
        console.log('No changes detected, skipping git operations');
        return false;
    }

    try {
        console.log('Running git commands...');

        // 检查当前分支
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        console.log(`Current branch: ${currentBranch}`);

        // 创建或切换到update分支
        try {
            execSync('git checkout -b update', { stdio: 'inherit' });
            console.log('Created and switched to update branch');
        } catch (error) {
            // 分支可能已存在，尝试切换
            execSync('git checkout update', { stdio: 'inherit' });
            console.log('Switched to existing update branch');
        }

        // 添加文件
        execSync('git add resources/gameData/character/character_info.json', { stdio: 'inherit' });

        // 检查是否有更改
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        if (!status.trim()) {
            console.log('No changes to commit');
            return false;
        }

        // 提交更改
        const timestamp = new Date().toISOString();
        execSync(`git commit -m "Update character info from remote source - ${timestamp}"`, { stdio: 'inherit' });

        // 推送分支
        execSync('git push origin update', { stdio: 'inherit' });

        console.log('Successfully pushed changes to update branch');
        return true;
    } catch (error) {
        console.error('Git operations failed:', error);
        throw error;
    }
}

function createPullRequest() {
    try {
        console.log('Creating pull request...');

        // 检查是否有gh CLI
        try {
            execSync('gh --version', { stdio: 'pipe' });
        } catch (error) {
            console.log('GitHub CLI not available, skipping PR creation');
            console.log('Please create PR manually from update branch to main');
            return;
        }

        // 创建PR
        const prCommand = `gh pr create --title "Update Character Info" --body "Automated update of character information from remote source" --base main --head update`;
        execSync(prCommand, { stdio: 'inherit' });

        console.log('Pull request created successfully');
    } catch (error) {
        console.error('Failed to create pull request:', error);
        console.log('Please create PR manually from update branch to main');
    }
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
            const gitSuccess = runGitCommands(hasChanges);

            if (gitSuccess) {
                // 创建PR
                createPullRequest();
            }
        } else {
            console.log('No updates needed');
        }

        console.log('Update process completed successfully');
    } catch (error) {
        console.error('Update process failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, transformOperator };
