import uuid
import shutil
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime
import threading
from config import Config


class SessionManager:
    """Manage concurrent student processing sessions"""

    def __init__(self):
        self._sessions: Dict[str, dict] = {}
        self._lock = threading.Lock()

    def create_session(self) -> str:
        """Create a new processing session"""
        session_id = str(uuid.uuid4())[:8]  # Short ID

        session_dir = Config.TEMP_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        with self._lock:
            self._sessions[session_id] = {
                "session_id": session_id,
                "session_dir": session_dir,
                "created_at": datetime.now(),
                "status": "active"
            }

        print(f"✅ Session created: {session_id}")
        return session_id

    def get_session_dir(self, session_id: str) -> Path:
        """Get session directory"""
        with self._lock:
            if session_id not in self._sessions:
                raise ValueError(f"Session {session_id} not found")
            return self._sessions[session_id]["session_dir"]

    def cleanup_session(self, session_id: str):
        """Delete all temporary files for a session"""
        with self._lock:
            if session_id not in self._sessions:
                return

            session_dir = self._sessions[session_id]["session_dir"]

            try:
                if session_dir.exists():
                    shutil.rmtree(session_dir)
                    print(f"🗑️  Cleaned up session: {session_id}")

                del self._sessions[session_id]
            except Exception as e:
                print(f"⚠️ Cleanup error for {session_id}: {e}")

    def get_active_sessions(self) -> int:
        """Get count of active sessions"""
        with self._lock:
            return len(self._sessions)


# Global session manager
session_manager = SessionManager()
