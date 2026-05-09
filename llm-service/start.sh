#!/bin/bash

# RecruitPro LLM Service Startup Script

echo "Starting RecruitPro LLM Service..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please copy .env.example to .env and configure your settings"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Check if OpenAI API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Warning: OPENAI_API_KEY not set in .env"
    echo "LLM service will not function without it"
fi

# Start service
uvicorn app:app --host 0.0.0.0 --port ${SERVICE_PORT:-8001} --reload
