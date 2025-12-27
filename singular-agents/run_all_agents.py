import os
import time
from pathlib import Path

# Base directory for singular agents
BASE_DIR = Path(__file__).parent.absolute()

# Configuration: (folder_name, server_script_name)
AGENTS = [
    ("academic-agents", "app.py"),
    ("admission-main", "agent_server.py"),
    ("co-borrower", "app.py"),
    ("exams", "app.py"),
    ("kyc", "app.py"),
    ("workexpericen-agent-main", "app.py"),
]

def run_agents():
    print(f"🚀 Launching {len(AGENTS)} singular agents from {BASE_DIR}...")
    
    for folder, script in AGENTS:
        agent_dir = BASE_DIR / folder
        
        # Check for .venv (Windows structure)
        venv_activate = agent_dir / ".venv" / "Scripts" / "activate.bat"
        
        if not agent_dir.exists():
            print(f"❌ Directory not found: {folder}")
            continue
            
        print(f"👉 Starting agent in: {folder}")
        
        # Construct command to run in new window
        # cmd /k keeps the window open
        # "cd /d <path>" ensures drive change if needed
        # "call <activate>" activates venv
        # "python <script>" runs the server
        
        if venv_activate.exists():
            # Note: We use 'call' for the batch file to ensure execution continues
            cmd_command = f'cd /d "{agent_dir}" && call "{venv_activate}" && python "{script}"'
        else:
            print(f"⚠️  .venv not found for {folder} at {venv_activate}, trying system python...")
            cmd_command = f'cd /d "{agent_dir}" && python "{script}"'
            
        # 'start "Title" cmd /k ...' launches a new window
        full_command = f'start "{folder}" cmd /k "{cmd_command}"'
        
        # Execute
        os.system(full_command)
        
        # Small delay to prevent overwhelming the OS opening windows
        time.sleep(1)

    print("\n✅ All launch commands issued.")

if __name__ == "__main__":
    run_agents()
