"""
Like Lens — sistema tray launcher.
Avvia Flask in background e mostra una tray icon.
Doppio click sulla tray icon → apre il browser.
"""
import os
import subprocess
import sys
import threading
import time
import webbrowser

BASE = os.path.dirname(os.path.abspath(__file__))
flask_proc = None


def start_flask():
    global flask_proc
    flask_proc = subprocess.Popen(
        [sys.executable, os.path.join(BASE, "app.py")],
        cwd=BASE,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )


def open_browser(icon=None, item=None):
    webbrowser.open("http://localhost:5000")


def stop_all(icon, item):
    global flask_proc
    if flask_proc:
        try:
            flask_proc.terminate()
        except Exception:
            pass
    icon.stop()


def _build_icon_image():
    from PIL import Image, ImageDraw
    size = 64
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Purple circle background
    draw.ellipse([2, 2, size - 2, size - 2], fill=(131, 58, 180, 255))
    # Simple heart: two circles + triangle
    hw = 11
    cx = size // 2
    cy = size // 2 - 3
    draw.ellipse([cx - hw - 2, cy - hw, cx, cy + 2], fill=(255, 255, 255, 255))
    draw.ellipse([cx - 2, cy - hw, cx + hw + 2, cy + 2], fill=(255, 255, 255, 255))
    draw.polygon(
        [(cx - hw - 2, cy), (cx + hw + 2, cy), (cx, cy + hw + 6)],
        fill=(255, 255, 255, 255),
    )
    return img


def main():
    # Start Flask server (windowless)
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    # Wait briefly for Flask to bind, then open browser
    time.sleep(2)
    open_browser()

    try:
        import pystray

        img  = _build_icon_image()
        menu = pystray.Menu(
            pystray.MenuItem("Apri Like Lens", open_browser, default=True),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Spegni server", stop_all),
        )
        icon = pystray.Icon("LikeLens", img, "Like Lens", menu)
        icon.run()

    except ImportError:
        # pystray not available — just keep flask alive
        if flask_proc:
            flask_proc.wait()
    except Exception:
        if flask_proc:
            flask_proc.wait()


if __name__ == "__main__":
    main()
