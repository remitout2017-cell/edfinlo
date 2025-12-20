import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional
import uuid

class SessionManager:
    """Manage temporary processing sessions"""
    
    def __init__(self, base_dir: str = "temp_test_scores"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(exist_ok=True)
        self.sessions: Dict[str, Path] = {}
        print(f"✅ Session Manager initialized: {self.base_dir}")
    
    def create_session(self) -> str:
        """Create a new session directory"""
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        session_dir = self.base_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        self.sessions[session_id] = session_dir
        return session_id
    
    def get_session_dir(self, session_id: str) -> Path:
        """Get session directory path"""
        if session_id not in self.sessions:
            session_dir = self.base_dir / session_id
            if not session_dir.exists():
                raise ValueError(f"Session {session_id} does not exist")
            self.sessions[session_id] = session_dir
        return self.sessions[session_id]
    
    def cleanup_session(self, session_id: str) -> bool:
        """Delete session directory and all contents"""
        try:
            if session_id in self.sessions:
                session_dir = self.sessions[session_id]
                if session_dir.exists():
                    shutil.rmtree(session_dir)
                del self.sessions[session_id]
                return True
            return False
        except Exception as e:
            print(f"⚠️ Session cleanup failed: {e}")
            return False
    
    def get_active_sessions(self) -> int:
        """Get count of active sessions"""
        return len(self.sessions)
    
    def cleanup_all_sessions(self):
        """Clean up all sessions"""
        for session_id in list(self.sessions.keys()):
            self.cleanup_session(session_id)
