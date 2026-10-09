# Run Save Plate locally
Write-Host "=========================================" -ForegroundColor Green
Write-Host "           Starting Save Plate           " -ForegroundColor Green
Write-Host " Stack: Expo + React Native + Supabase   " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# 1. API Server environment
$env:PORT = "5000"
$env:NODE_ENV = "development"
$env:DATABASE_URL = "postgresql://postgres:root@localhost:5433/surplus_saver"
$env:SESSION_SECRET = "local-development-secret-key-32chars"
$env:CLERK_PUBLISHABLE_KEY = "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk"
$env:CLERK_SECRET_KEY = "sk_test_mocksecretmocksecretmocksecretmocksecret"

# 2. Supabase environment for Expo
$env:EXPO_PUBLIC_SUPABASE_URL = "http://localhost:54321"
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'artifacts/api-server'; node --enable-source-maps ./dist/index.mjs"

# 3. Start Frontend App (Expo Web & Metro)
cd 'artifacts/food-rescue-marketplace'
pnpm exec expo start --web --port 8081
