import os
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in root directory
root_dir = Path(__file__).resolve().parent.parent
dotenv_path = root_dir / '.env'
if dotenv_path.exists():
    load_dotenv(dotenv_path)

PORT = os.getenv('PORT', '5000')
API_BASE_URL = os.getenv('API_BASE_URL', f'http://localhost:{PORT}/api')
PYTHON_WORKER_POLL_INTERVAL = float(os.getenv('PYTHON_WORKER_POLL_INTERVAL', '3'))
PING_PROBES_COUNT = int(os.getenv('PING_PROBES_COUNT', '1'))
PING_TIMEOUT_SECONDS = float(os.getenv('PING_TIMEOUT_SECONDS', '1.0'))
