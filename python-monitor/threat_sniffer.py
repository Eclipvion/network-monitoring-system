"""
NetPulse Cyber Threat, Browser Search & Incognito Sniffer (Layer-2 Agent)
Captures exact user search queries (Google, YouTube, Bing, DuckDuckGo, AI tools),
visited URLs, page titles across Chrome/Edge/Brave/Firefox, Incognito window titles,
and system DNS events, streaming them to the NetPulse Security Hub API.
"""

import sys
from search_activity_agent import (
    DEFAULT_SERVER,
    harvest_all,
    run_continuous_agent,
)

if __name__ == "__main__":
    target_server = DEFAULT_SERVER
    for idx, arg in enumerate(sys.argv):
        if arg == "--server" and idx + 1 < len(sys.argv):
            target_server = sys.argv[idx + 1]
        elif arg.startswith("--server="):
            target_server = arg.split("=", 1)[1]

    run_continuous_agent(target_server, interval=8)
