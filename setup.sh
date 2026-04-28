#!/bin/bash

echo "🚀 Red Team Prompt Testing Platform - Setup"
echo "==========================================="

# Backend setup
echo ""
echo "📦 Setting up backend..."
cd backend
python -m venv venv
source venv/bin/activate || . venv/Scripts/activate
pip install -r requirements.txt
echo "✓ Backend dependencies installed"

# Frontend setup
echo ""
echo "📦 Setting up frontend..."
cd ../frontend
npm install
echo "✓ Frontend dependencies installed"

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the platform:"
echo "1. Terminal 1 (Backend): cd backend && source venv/bin/activate && python app.py"
echo "2. Terminal 2 (Frontend): cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:5173"
