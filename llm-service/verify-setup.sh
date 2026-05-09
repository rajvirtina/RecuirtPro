#!/bin/bash

# LLM Service Setup Verification Script (Linux/Mac)

echo "======================================"
echo "RecruitPro LLM Service Setup Check"
echo "======================================"
echo ""

all_good=true

# Check Python
echo -n "Checking Python..."
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version 2>&1)
    if [[ $python_version =~ Python\ 3\.([1-9][0-9]|[1-9]) ]]; then
        echo " ✓"
        echo "  $python_version"
    else
        echo " ✗"
        echo "  Python 3.10+ required. Found: $python_version"
        all_good=false
    fi
else
    echo " ✗"
    echo "  Python not found. Please install Python 3.10+"
    all_good=false
fi

# Check .env file
echo -n "Checking .env file..."
if [ -f .env ]; then
    echo " ✓"
    
    # Check OPENAI_API_KEY
    if grep -q "OPENAI_API_KEY=sk-" .env; then
        echo "  OPENAI_API_KEY configured ✓"
    else
        echo "  Warning: OPENAI_API_KEY not set"
        all_good=false
    fi
else
    echo " ✗"
    echo "  .env file not found. Copy .env.example to .env"
    all_good=false
fi

# Check requirements.txt
echo -n "Checking requirements.txt..."
if [ -f requirements.txt ]; then
    echo " ✓"
else
    echo " ✗"
    all_good=false
fi

# Check if virtual environment exists
echo -n "Checking virtual environment..."
if [ -d venv ]; then
    echo " ✓"
else
    echo " ✗"
    echo "  Run: python3 -m venv venv"
fi

# Check app.py
echo -n "Checking app.py..."
if [ -f app.py ]; then
    echo " ✓"
else
    echo " ✗"
    all_good=false
fi

echo ""
echo "======================================"

if [ "$all_good" = true ]; then
    echo "✓ All checks passed!"
    echo ""
    echo "Next steps:"
    echo "  1. Activate virtual environment:"
    echo "     source venv/bin/activate"
    echo "  2. Install dependencies:"
    echo "     pip install -r requirements.txt"
    echo "  3. Start service:"
    echo "     ./start.sh"
    echo ""
else
    echo "✗ Setup incomplete"
    echo ""
    echo "Please fix the issues above and run this script again."
    echo "See QUICKSTART.md for detailed instructions."
    echo ""
fi

echo "Documentation:"
echo "  - Quick Start: QUICKSTART.md"
echo "  - Integration: INTEGRATION.md"
echo "  - API Docs: http://localhost:8001/api/docs (after starting)"
echo ""
