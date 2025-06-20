#!/bin/bash

# Simple cleanup script for LLM Chrome Extension
# Removes temporary files and builds

echo "🧹 Cleaning up LLM Chrome Extension..."

# Remove backup files
find . -name "*-old.*" -type f -delete
find . -name "*.backup" -type f -delete
find . -name "*.bak" -type f -delete

# Remove logs
find . -name "*.log" -type f -delete

# Remove node_modules if exists
if [ -d "node_modules" ]; then
    echo "Removing node_modules..."
    rm -rf node_modules
fi

# Remove build outputs
if [ -d "dist" ]; then
    echo "Removing dist..."
    rm -rf dist
fi

if [ -d "docs" ]; then
    echo "Removing docs..."
    rm -rf docs
fi

# Remove OS specific files
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete

echo "✅ Cleanup completed!"
echo ""
echo "Current project structure:"
find . -maxdepth 2 -type f \( -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.css" \) | grep -v node_modules | sort
