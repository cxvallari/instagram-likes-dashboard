@echo off
cd /d "%~dp0"
echo Installazione dipendenze...
pip install -r requirements.txt -q
python -c "from playwright.sync_api import sync_playwright" 2>nul || playwright install chromium
echo Avvio Like Lens...
where pythonw >nul 2>&1 && (
    start "" pythonw "%~dp0launcher.pyw"
) || (
    start "" /B python "%~dp0launcher.pyw"
)
