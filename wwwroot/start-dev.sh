#!/bin/bash

# FMO Mobile Controller - Quick Start Script

echo "🎯 FMO Mobile Controller - 开发服务器"
echo ""

# 检查Python是否可用
if command -v python3 &> /dev/null; then
    echo "✓ Python3 已安装"
    echo "正在启动开发服务器..."
    echo ""
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "✓ Python 已安装"
    echo "正在启动开发服务器..."
    echo ""
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python 未安装"
    echo ""
    echo "请选择以下方式之一启动服务器："
    echo "1. 安装Python 3"
    echo "2. 使用其他HTTP服务器，如："
    echo "   - npx serve ."
    echo "   - php -S localhost:8000"
    echo "   - 使用Node.js的http-server"
fi
