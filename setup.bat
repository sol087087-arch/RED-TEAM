@echo off
echo 🚀 Red Team Prompt Testing Platform - Setup
echo ===========================================

REM Backend setup
echo.
echo 📦 Setting up backend...
cd backend
python -m venv venv
call venv\Scripts\activate.bat
pip install -r requirements.txt
echo ✓ Backend dependencies installed

REM Frontend setup
echo.
echo 📦 Setting up frontend...
cd ..\frontend
npm install
echo ✓ Frontend dependencies installed

cd ..

echo.
echo ✅ Setup complete!
echo.
echo To run the platform:
echo 1. Terminal 1 (Backend): cd backend ^&^& venv\Scripts\activate.bat ^&^& python app.py
echo 2. Terminal 2 (Frontend): cd frontend ^&^& npm run dev
echo.
echo Then open: http://localhost:5173
