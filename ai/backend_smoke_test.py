
import sys
import os

# Add local directory to path
sys.path.append(os.getcwd())

print("Attempting to import server modules...")
try:
    from server import app, macro_engine
    from macro_engine import MacroEngine
    import pyautogui
    # import engine # This should NOT be imported or used if we removed it, but server.py comments it out.
    
    print("SUCCESS: Backend modules imported successfully.")
except ImportError as e:
    print(f"FAILURE: ImportError - {e}")
    sys.exit(1)
except Exception as e:
    print(f"FAILURE: Unexpected Error - {e}")
    sys.exit(1)
