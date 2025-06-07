#!/bin/bash
# Docker Host Setup Script
# This script must be run on the Docker HOST machine, not inside containers

set -e

echo "🐳 Docker Host System Setup for Redis Optimization"
echo "=================================================="
echo ""
echo "⚠️  IMPORTANT: This script must be run on the Docker HOST machine"
echo "   (not inside Docker containers)"
echo ""

# Check if we're running inside Docker
if [ -f /.dockerenv ] || grep -q 'docker\|lxc' /proc/1/cgroup 2>/dev/null; then
    echo "❌ ERROR: This script is running inside a Docker container!"
    echo ""
    echo "📋 Please run this script on your host machine:"
    echo "   chmod +x scripts/docker-host-setup.sh"
    echo "   sudo ./scripts/docker-host-setup.sh"
    echo ""
    exit 1
fi

# Check current vm.overcommit_memory setting
current_setting=$(cat /proc/sys/vm/overcommit_memory)
echo "📊 Current vm.overcommit_memory setting: $current_setting"

if [ "$current_setting" = "1" ]; then
    echo "✅ vm.overcommit_memory is already set to 1"
else
    echo "🔧 Setting vm.overcommit_memory to 1..."
    
    # Check if running with sufficient privileges
    if [ "$EUID" -ne 0 ]; then
        echo "❌ This script must be run with sudo privileges"
        echo "   Please run: sudo ./scripts/docker-host-setup.sh"
        exit 1
    fi
    
    # Apply the setting
    sysctl vm.overcommit_memory=1
    echo "✅ Applied vm.overcommit_memory=1 (temporary)"
    
    # Make it persistent
    if ! grep -q "vm.overcommit_memory = 1" /etc/sysctl.conf; then
        echo 'vm.overcommit_memory = 1' >> /etc/sysctl.conf
        echo "✅ Added to /etc/sysctl.conf (persistent)"
    else
        echo "✅ Already in /etc/sysctl.conf"
    fi
fi

# Apply other Redis optimizations
echo "🔧 Applying additional optimizations..."

# Set net.core.somaxconn
current_somaxconn=$(cat /proc/sys/net/core/somaxconn)
echo "📊 Current net.core.somaxconn: $current_somaxconn"

if [ "$current_somaxconn" -lt "1024" ]; then
    sysctl net.core.somaxconn=1024
    if ! grep -q "net.core.somaxconn = 1024" /etc/sysctl.conf; then
        echo 'net.core.somaxconn = 1024' >> /etc/sysctl.conf
    fi
    echo "✅ Set net.core.somaxconn=1024"
fi

echo ""
echo "🎉 Docker host optimization complete!"
echo ""
echo "📋 Current settings:"
echo "   vm.overcommit_memory: $(cat /proc/sys/vm/overcommit_memory)"
echo "   net.core.somaxconn: $(cat /proc/sys/net/core/somaxconn)"
echo ""
echo "🚀 You can now start your Docker containers without Redis warnings!"
echo "   docker compose up -d"