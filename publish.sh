#!/bin/bash

# 確保在執行腳本時沒有未提交的變更
if ! git diff-index --quiet HEAD --; then
    echo "You have uncommitted changes. Please commit or stash them before publishing."
    exit 1
fi

echo "Compiling and testing the extension..."

# 編譯、格式化並執行測試
npm run vscode:prepublish
if [ $? -ne 0 ]; then
    echo "Build or lint failed. Please fix the issues before publishing."
    exit 1
fi

echo "Bumping patch version..."

# 自動增加 patch 版本號
npm version patch
if [ $? -ne 0 ]; then
    echo "Failed to bump version. Make sure you are in a git repository."
    exit 1
fi

# 取得新版本號
NEW_VERSION=$(node -p "require('./package.json').version")

echo "Publishing version $NEW_VERSION to Visual Studio Marketplace..."

# 發布到市集
vsce publish

if [ $? -eq 0 ]; then
    echo "Successfully published version $NEW_VERSION!"
    echo "Pushing git tags..."
    git push --follow-tags
else
    echo "Failed to publish. Please check the output from vsce."
    exit 1
fi
