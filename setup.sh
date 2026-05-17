#!/bin/bash
echo "============================================"
echo " AQUAGROW DASHBOARD — SETUP (Mac/Linux)"
echo "============================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found. Install Python 3.9+ first."
    echo "  Mac:   brew install python3"
    echo "  Linux: sudo apt install python3 python3-pip"
    exit 1
fi

echo "Python found: $(python3 --version)"
echo "Installing dependencies..."
echo ""

pip3 install --upgrade pip
pip3 install customtkinter matplotlib numpy scipy Pillow

echo ""
echo "============================================"
echo " Setup complete! Run: ./run.sh"
echo "============================================"
