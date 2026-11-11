"""
NetPulse Layer-2 Endpoint Search, Incognito & Web Activity Agent
Extracts:
1. Exact user search queries (Google, YouTube, Bing, DuckDuckGo, Yahoo, GitHub, AI Tools)
   and visited URLs from local browsers (Chrome, Edge, Brave, Opera, Firefox) across ALL
   Windows user accounts (C:\\Users\\*).
2. Real Windows Login Profile Name + Browser Logged-In Profile Name & Email.
3. Live Open Browser Tab Titles & Incognito / InPrivate Window Activity + System DNS Cache
   (capturing domains and active searches even in Incognito / InPrivate mode).
"""

import os
import re
import sys
import glob
import json
import time
import base64
import shutil
import socket
import sqlite3
import tempfile
import getpass
import subprocess
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

DEFAULT_SERVER = os.environ.get("NETPULSE_SERVER", "http://localhost:5000")
IGNORED_USER_DIRS = {"public", "default", "default user", "all users", "desktop.ini"}


def get_local_ip():
    """Detects the primary LAN IP address of this machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def webkit_to_iso(webkit_timestamp):
    """Converts Chromium WebKit timestamp (microseconds since 1601-01-01) to ISO 8601."""
    try:
        if not webkit_timestamp or webkit_timestamp <= 0:
            return datetime.now(timezone.utc).isoformat()
        epoch_start = datetime(1601, 1, 1, tzinfo=timezone.utc)
        delta = timedelta(microseconds=int(webkit_timestamp))
        dt = epoch_start + delta
        if dt.year < 2020 or dt.year > 2035:
            return datetime.now(timezone.utc).isoformat()
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def firefox_to_iso(ff_timestamp):
    """Converts Firefox PRTime (microseconds since 1970-01-01) to ISO 8601."""
    try:
        if not ff_timestamp or ff_timestamp <= 0:
            return datetime.now(timezone.utc).isoformat()
        dt = datetime.fromtimestamp(int(ff_timestamp) / 1_000_000, tz=timezone.utc)
        return dt.isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def clean_notification_prefix(text):
    """Removes leading '(123) ' notification counters from browser tab titles."""
    t = (text or "").strip()
    if t.startswith("(") and ")" in t[:8]:
        prefix, rest = t.split(")", 1)
        if prefix[1:].isdigit():
            return rest.strip()
    return t


def extract_search_info(url, title="", explicit_term=""):
    """
    Analyzes a URL, Page Title, and Chromium keyword_search_terms to extract exact
    user search queries and search engine/platform name.
    Returns (search_query, search_engine, clean_domain)
    """
    if not url:
        return "", "", ""

    try:
        parsed = urllib.parse.urlparse(url)
        domain = (parsed.netloc or "").lower()
        if domain.startswith("www."):
            domain = domain[4:]
        path = (parsed.path or "").lower()
        qs = urllib.parse.parse_qs(parsed.query)
    except Exception:
        return "", "", ""

    search_query = (explicit_term or "").strip()
    search_engine = ""

    # 1. Google Search (exclude /url redirect links)
    if (
        "google." in domain
        and "/url" not in path
        and ("/search" in path or "q" in qs or search_query)
    ):
        if not search_query and "q" in qs and qs["q"][0].strip():
            val = qs["q"][0].strip()
            if not val.startswith("http://") and not val.startswith("https://"):
                search_query = val
        if search_query:
            search_engine = "Google Search"

    # 2. YouTube Search or Video Watch
    elif "youtube.com" in domain or "youtu.be" in domain:
        if "search_query" in qs and qs["search_query"][0].strip():
            search_query = qs["search_query"][0].strip()
            search_engine = "YouTube Search"
        elif search_query:
            search_engine = "YouTube Search"
        elif "/watch" in path and title:
            clean_t = clean_notification_prefix(title.replace("- YouTube", "").strip())
            if clean_t and clean_t.lower() != "youtube":
                search_query = clean_t
                search_engine = "YouTube Video"

    # 3. Bing Search
    elif "bing.com" in domain and ("q" in qs or search_query):
        if not search_query and "q" in qs and qs["q"][0].strip():
            search_query = qs["q"][0].strip()
        if search_query:
            search_engine = "Bing Search"

    # 4. DuckDuckGo
    elif "duckduckgo.com" in domain and ("q" in qs or search_query):
        if not search_query and "q" in qs and qs["q"][0].strip():
            search_query = qs["q"][0].strip()
        if search_query:
            search_engine = "DuckDuckGo"

    # 5. Yahoo Search
    elif "yahoo.com" in domain and ("p" in qs or "q" in qs or search_query):
        if not search_query:
            search_query = (qs.get("p") or qs.get("q") or [""])[0].strip()
        if search_query:
            search_engine = "Yahoo Search"

    # 6. AI Assistants (ChatGPT, Claude, Gemini, Perplexity, DeepSeek)
    elif any(
        ai in domain
        for ai in (
            "chatgpt.com",
            "chat.openai.com",
            "claude.ai",
            "gemini.google.com",
            "perplexity.ai",
            "chat.deepseek.com",
        )
    ):
        clean_t = clean_notification_prefix(title)
        if clean_t and clean_t.lower() not in (
            "chatgpt",
            "claude",
            "gemini",
            "perplexity",
            "deepseek",
        ):
            search_query = clean_t
            search_engine = "AI Assistant"

    # 7. GitHub / StackOverflow / Reddit / Shopping Searches
    elif "github.com" in domain and "q" in qs:
        search_query = qs["q"][0].strip()
        search_engine = "GitHub Search"
    elif "stackoverflow.com" in domain and "q" in qs:
        search_query = qs["q"][0].strip()
        search_engine = "StackOverflow"
    elif "reddit.com" in domain and "q" in qs:
        search_query = qs["q"][0].strip()
        search_engine = "Reddit Search"
    elif (
        "amazon." in domain or "daraz." in domain or "aliexpress." in domain
    ) and ("k" in qs or "q" in qs or "SearchText" in qs):
        val = (qs.get("k") or qs.get("q") or qs.get("SearchText") or [""])[0].strip()
        if val:
            search_query = val
            search_engine = "Shopping Search"

    # 8. Title-based fallback for search engines if query param was stripped
    if not search_query and title:
        t_clean = clean_notification_prefix(title)
        for suffix, eng in [
            (" - Google Search", "Google Search"),
            (" - تلاش Google", "Google Search"),
            (" - Search", "Bing Search"),
            (" - Bing", "Bing Search"),
            (" at DuckDuckGo", "DuckDuckGo"),
            (" - YouTube", "YouTube"),
        ]:
            if t_clean.endswith(suffix):
                extracted = t_clean[: -len(suffix)].strip()
                if (
                    extracted
                    and len(extracted) < 180
                    and extracted.lower() not in ("google", "youtube", "bing")
                ):
                    search_query = extracted
                    search_engine = eng
                    break

    if search_query and not search_engine:
        search_engine = "Web Search"

    return search_query, search_engine, domain


def get_all_windows_user_dirs():
    """
    Returns list of (win_username, local_appdata_dir, roaming_appdata_dir) across all
    Windows user accounts on the PC (e.g. C:\\Users\\*) so multi-user logins are all captured.
    """
    user_roots = []
    seen_users = set()

    users_base = os.path.join(os.environ.get("SystemDrive", "C:"), os.sep, "Users")
    if os.path.isdir(users_base):
        try:
            for entry in os.listdir(users_base):
                if entry.lower() in IGNORED_USER_DIRS:
                    continue
                full_user_dir = os.path.join(users_base, entry)
                if not os.path.isdir(full_user_dir):
                    continue
                local_app = os.path.join(full_user_dir, "AppData", "Local")
                roaming_app = os.path.join(full_user_dir, "AppData", "Roaming")
                if os.path.isdir(local_app) or os.path.isdir(roaming_app):
                    seen_users.add(entry.lower())
                    user_roots.append((entry, local_app, roaming_app))
        except Exception:
            pass

    try:
        cur_user = getpass.getuser()
    except Exception:
        cur_user = "User"
    if cur_user.lower() not in seen_users:
        local_app = os.environ.get("LOCALAPPDATA", "")
        roaming_app = os.environ.get("APPDATA", "")
        if local_app or roaming_app:
            user_roots.append((cur_user, local_app, roaming_app))

    return user_roots


def resolve_chromium_profile_identity(base_dir, prof_name, win_username):
    """
    Reads Chromium 'Local State' and profile 'Preferences' to find the real logged-in
    Profile Name (e.g. 'Sheikh Abdul Rafay', 'Office Test') and Email ('user@gmail.com').
    Returns (display_label, profile_name, profile_email)
    """
    gaia_name = ""
    custom_name = ""
    email = ""

    local_state_path = os.path.join(base_dir, "Local State")
    if os.path.isfile(local_state_path):
        try:
            with open(local_state_path, "r", encoding="utf-8", errors="ignore") as f:
                ls_data = json.load(f)
            info_cache = ls_data.get("profile", {}).get("info_cache", {})
            prof_info = info_cache.get(prof_name, {})
            if isinstance(prof_info, dict):
                gaia_name = (prof_info.get("gaia_name") or "").strip()
                custom_name = (prof_info.get("name") or "").strip()
                email = (prof_info.get("user_name") or "").strip()
        except Exception:
            pass

    if not (gaia_name or email):
        prefs_path = os.path.join(base_dir, prof_name, "Preferences")
        if os.path.isfile(prefs_path):
            try:
                with open(prefs_path, "r", encoding="utf-8", errors="ignore") as f:
                    prefs = json.load(f)
                if not custom_name:
                    custom_name = (prefs.get("profile", {}).get("name") or "").strip()
                acc_list = prefs.get("account_info", [])
                if isinstance(acc_list, list) and len(acc_list) > 0:
                    first_acc = acc_list[0]
                    if isinstance(first_acc, dict):
                        gaia_name = gaia_name or (first_acc.get("full_name") or "").strip()
                        email = email or (first_acc.get("email") or "").strip()
            except Exception:
                pass

    generic_names = {"your chrome", "person 1", "person 2", "person 3", "default", "profile"}
    best_name = ""
    if gaia_name:
        best_name = gaia_name
    elif custom_name and custom_name.lower() not in generic_names:
        best_name = custom_name
    elif email:
        best_name = email.split("@")[0]
    elif custom_name:
        best_name = f"{win_username} ({custom_name})"
    else:
        best_name = win_username if prof_name == "Default" else f"{win_username} ({prof_name})"

    if email and email.lower() != best_name.lower():
        display_label = f"{best_name} ({email})"
    else:
        display_label = best_name

    return display_label, best_name, email


def discover_chromium_history_files():
    """
    Finds History SQLite files for Chrome, Edge, Brave, Opera across ALL Windows users
    and all browser profiles on the machine, resolving real profile names & emails.
    """
    found = []
    seen_paths = set()

    for win_username, local_app_data, roaming_app_data in get_all_windows_user_dirs():
        browsers = []
        if local_app_data:
            browsers.extend(
                [
                    ("Chrome", os.path.join(local_app_data, "Google", "Chrome", "User Data")),
                    ("Edge", os.path.join(local_app_data, "Microsoft", "Edge", "User Data")),
                    (
                        "Brave",
                        os.path.join(
                            local_app_data, "BraveSoftware", "Brave-Browser", "User Data"
                        ),
                    ),
                ]
            )
        if roaming_app_data:
            browsers.append(
                ("Opera", os.path.join(roaming_app_data, "Opera Software", "Opera Stable"))
            )

        for browser_name, base_dir in browsers:
            if not os.path.exists(base_dir):
                continue

            direct_hist = os.path.join(base_dir, "History")
            if os.path.isfile(direct_hist) and direct_hist not in seen_paths:
                seen_paths.add(direct_hist)
                label, p_name, email = resolve_chromium_profile_identity(
                    base_dir, "Default", win_username
                )
                found.append((win_username, label, p_name, email, browser_name, "Default", direct_hist))

            for profile_pattern in ["Default", "Profile *"]:
                for prof_dir in glob.glob(os.path.join(base_dir, profile_pattern)):
                    hist_file = os.path.join(prof_dir, "History")
                    if os.path.isfile(hist_file) and hist_file not in seen_paths:
                        seen_paths.add(hist_file)
                        prof_name = os.path.basename(prof_dir)
                        label, p_name, email = resolve_chromium_profile_identity(
                            base_dir, prof_name, win_username
                        )
                        found.append(
                            (win_username, label, p_name, email, browser_name, prof_name, hist_file)
                        )

    return found


def discover_firefox_history_files():
    """Finds places.sqlite files for Mozilla Firefox across ALL Windows users."""
    found = []
    seen_paths = set()

    for win_username, _, roaming_app_data in get_all_windows_user_dirs():
        if not roaming_app_data:
            continue
        ff_profiles = os.path.join(roaming_app_data, "Mozilla", "Firefox", "Profiles")
        if not os.path.exists(ff_profiles):
            continue

        for db_path in glob.glob(os.path.join(ff_profiles, "*", "places.sqlite")):
            if os.path.isfile(db_path) and db_path not in seen_paths:
                seen_paths.add(db_path)
                prof_name = os.path.basename(os.path.dirname(db_path))
                found.append((win_username, "Firefox", prof_name, db_path))

    return found


def is_ignored_local_domain(domain):
    """Ignores internal localhost dev server URLs so dashboard refreshes don't clutter user activity."""
    if not domain:
        return True
    d = domain.split(":")[0].lower()
    return d in ("localhost", "127.0.0.1", "0.0.0.0", "::1")


def harvest_browser_history(limit_per_profile=45):
    """
    Safely copies locked browser SQLite History databases across all Windows users on the PC
    to a temp file and reads recent searches and visited pages.
    """
    client_ip = get_local_ip()
    hostname = socket.gethostname()
    records = []

    # 1. Chromium Browsers (Chrome, Edge, Brave, Opera) across all Windows users
    for (
        win_username,
        profile_label,
        profile_name,
        profile_email,
        browser_name,
        prof_name,
        db_path,
    ) in discover_chromium_history_files():
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".sqlite", prefix="netpulse_hist_")
        os.close(tmp_fd)
        try:
            shutil.copy2(db_path, tmp_path)
            conn = sqlite3.connect(tmp_path, timeout=3.0)
            cursor = conn.cursor()

            keyword_map = {}
            try:
                cursor.execute(
                    "SELECT url_id, term FROM keyword_search_terms ORDER BY url_id DESC LIMIT 100"
                )
                for u_id, term in cursor.fetchall():
                    if term and str(term).strip():
                        keyword_map[u_id] = str(term).strip()
            except Exception:
                pass

            cursor.execute(
                """
                SELECT id, url, title, last_visit_time
                FROM urls
                WHERE url NOT LIKE 'chrome://%'
                  AND url NOT LIKE 'edge://%'
                  AND url NOT LIKE 'brave://%'
                  AND url NOT LIKE 'chrome-extension://%'
                  AND url NOT LIKE 'about:%'
                  AND url NOT LIKE 'file://%'
                  AND last_visit_time > 0
                ORDER BY last_visit_time DESC
                LIMIT ?
                """,
                (limit_per_profile,),
            )
            rows = cursor.fetchall()
            conn.close()

            profile_history_domains = set()

            for url_id, url, title, last_visit_time in rows:
                explicit_term = keyword_map.get(url_id, "")
                search_query, search_engine, domain = extract_search_info(
                    url, title or "", explicit_term
                )
                if is_ignored_local_domain(domain):
                    continue

                profile_history_domains.add(domain)
                iso_ts = webkit_to_iso(last_visit_time)
                q_type = "SEARCH" if search_query else "WEB_VISIT"
                clean_title = clean_notification_prefix(title or domain)

                records.append(
                    {
                        "timestamp": iso_ts,
                        "clientIp": client_ip,
                        "hostname": hostname,
                        "username": profile_label,
                        "winUser": win_username,
                        "profileName": profile_name,
                        "profileEmail": profile_email,
                        "isIncognito": False,
                        "browser": browser_name,
                        "domain": domain,
                        "url": url[:600],
                        "pageTitle": clean_title[:250],
                        "searchQuery": search_query[:250],
                        "searchEngine": search_engine,
                        "queryType": q_type,
                    }
                )

            # Inspect Chromium 'Network Persistent State' (recovers sites cleared from History / untracked sessions)
            prof_dir = os.path.dirname(db_path)
            net_state_path = os.path.join(prof_dir, "Network", "Network Persistent State")
            if os.path.isfile(net_state_path):
                try:
                    with open(net_state_path, "r", encoding="utf-8", errors="ignore") as nf:
                        net_data = json.load(nf)
                    servers = (
                        net_data.get("net", {})
                        .get("http_server_properties", {})
                        .get("servers", [])
                    )
                    recovered_sites = []
                    ignored_cdns = (
                        "googleapis.com",
                        "gstatic.com",
                        "googleusercontent.com",
                        "gvt1.com",
                        "gvt2.com",
                        "googlesyndication.com",
                        "doubleclick.net",
                        "google.com",
                        "google.com.pk",
                        "microsoft.com",
                        "live.com",
                        "office.com",
                        "microsoftonline.com",
                        "cloud.microsoft",
                    )
                    for srv in servers:
                        if not isinstance(srv, dict):
                            continue
                        anon = srv.get("anonymization", [])
                        if anon and isinstance(anon[0], str):
                            try:
                                raw_bytes = base64.b64decode(anon[0]).decode(
                                    "latin1", errors="ignore"
                                )
                                m = re.search(r"https?://([a-zA-Z0-9._-]+)", raw_bytes)
                                if m:
                                    site_dom = m.group(1).lower()
                                    if site_dom.startswith("www."):
                                        site_dom = site_dom[4:]
                                    if (
                                        site_dom
                                        and not is_ignored_local_domain(site_dom)
                                        and not any(
                                            site_dom == c or site_dom.endswith("." + c)
                                            for c in ignored_cdns
                                        )
                                        and site_dom not in recovered_sites
                                    ):
                                        recovered_sites.append(site_dom)
                            except Exception:
                                pass

                    now_iso = datetime.now(timezone.utc).isoformat()
                    for site_dom in recovered_sites[:18]:
                        in_hist = any(
                            site_dom == hd
                            or site_dom.endswith("." + hd)
                            or hd.endswith("." + site_dom)
                            for hd in profile_history_domains
                        )
                        if not in_hist:
                            records.append(
                                {
                                    "timestamp": now_iso,
                                    "clientIp": client_ip,
                                    "hostname": hostname,
                                    "username": profile_label,
                                    "winUser": win_username,
                                    "profileName": profile_name,
                                    "profileEmail": profile_email,
                                    "isIncognito": True,
                                    "browser": f"{browser_name} (Incognito / Cleared)",
                                    "domain": site_dom,
                                    "url": f"https://{site_dom}",
                                    "pageTitle": f"{site_dom} — Hidden / Cleared Session Activity",
                                    "searchQuery": "",
                                    "searchEngine": "Incognito / Network State",
                                    "queryType": "DNS",
                                }
                            )
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass

    # 2. Mozilla Firefox across all Windows users
    for win_username, browser_name, prof_name, db_path in discover_firefox_history_files():
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".sqlite", prefix="netpulse_ff_")
        os.close(tmp_fd)
        try:
            shutil.copy2(db_path, tmp_path)
            conn = sqlite3.connect(tmp_path, timeout=3.0)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT url, title, last_visit_date
                FROM moz_places
                WHERE last_visit_date IS NOT NULL
                  AND url NOT LIKE 'place:%'
                  AND url NOT LIKE 'about:%'
                ORDER BY last_visit_date DESC
                LIMIT ?
                """,
                (limit_per_profile,),
            )
            rows = cursor.fetchall()
            conn.close()

            for url, title, last_visit_date in rows:
                search_query, search_engine, domain = extract_search_info(url, title or "")
                if is_ignored_local_domain(domain):
                    continue

                iso_ts = firefox_to_iso(last_visit_date)
                q_type = "SEARCH" if search_query else "WEB_VISIT"
                clean_title = clean_notification_prefix(title or domain)

                records.append(
                    {
                        "timestamp": iso_ts,
                        "clientIp": client_ip,
                        "hostname": hostname,
                        "username": win_username,
                        "winUser": win_username,
                        "profileName": win_username,
                        "profileEmail": "",
                        "isIncognito": False,
                        "browser": "Firefox",
                        "domain": domain,
                        "url": url[:600],
                        "pageTitle": clean_title[:250],
                        "searchQuery": search_query[:250],
                        "searchEngine": search_engine,
                        "queryType": q_type,
                    }
                )
        except Exception:
            pass
        finally:
            try:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass

    records.sort(key=lambda r: r.get("timestamp", ""), reverse=True)

    seen = set()
    unique_records = []
    for r in records:
        key = f"{r['username']}|{r['browser']}|{r['domain']}|{r['searchQuery']}|{r['pageTitle']}"
        if key not in seen:
            seen.add(key)
            unique_records.append(r)

    return unique_records[:250]


def harvest_incognito_and_live_windows(known_history_domains=None):
    """
    Captures:
    1. Open Browser Window Titles (especially Incognito / InPrivate / Private Browsing tabs,
       which are NOT written to SQLite History!).
    2. Windows DNS Resolver Cache entries that do NOT appear in standard browser history
       (indicating Incognito browsing or background web apps).
    """
    if known_history_domains is None:
        known_history_domains = set()

    client_ip = get_local_ip()
    hostname = socket.gethostname()
    try:
        win_user = getpass.getuser()
    except Exception:
        win_user = "User"

    records = []
    now_iso = datetime.now(timezone.utc).isoformat()

    # Part A: Inspect active Browser Window Titles (catches active Incognito / InPrivate tabs!)
    try:
        ps_win_cmd = (
            "Get-Process chrome, msedge, brave, firefox, opera -ErrorAction SilentlyContinue "
            "| Where-Object { $_.MainWindowTitle -ne '' } "
            "| Select-Object ProcessName, MainWindowTitle | ConvertTo-Json"
        )
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_win_cmd],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
            items = data if isinstance(data, list) else [data]
            for item in items:
                p_name = (item.get("ProcessName") or "").lower()
                raw_title = (item.get("MainWindowTitle") or "").strip()
                if not raw_title:
                    continue

                is_incog = any(
                    tag in raw_title.lower()
                    for tag in ("incognito", "inprivate", "private browsing")
                )

                browser_label = (
                    "Chrome"
                    if "chrome" in p_name
                    else "Edge"
                    if "msedge" in p_name
                    else "Brave"
                    if "brave" in p_name
                    else "Firefox"
                    if "firefox" in p_name
                    else "Browser"
                )
                if is_incog:
                    browser_label = f"{browser_label} (Incognito)"

                # Clean browser suffix from window title
                clean_t = raw_title
                for suf in [
                    " - Google Chrome (Incognito)",
                    " - Google Chrome",
                    " - Brave (Private)",
                    " - Brave",
                    " - Microsoft​ Edge",
                    " - Microsoft Edge",
                    " - [InPrivate]",
                    " — Mozilla Firefox (Private Browsing)",
                    " — Mozilla Firefox",
                ]:
                    clean_t = clean_t.replace(suf, "").strip()

                clean_t = clean_notification_prefix(clean_t)
                if not clean_t or clean_t.lower() in ("new tab", "incognito", "inprivate"):
                    continue

                # Only emit from live window if it's Incognito OR a live search/video tab
                search_q = ""
                search_eng = ""
                inferred_domain = "live-browser-tab.local"
                if " - Google Search" in clean_t:
                    search_q = clean_t.replace(" - Google Search", "").strip()
                    search_eng = "Google Search (Incognito)" if is_incog else "Google Search"
                    inferred_domain = "google.com"
                elif " - YouTube" in clean_t:
                    search_q = clean_t.replace(" - YouTube", "").strip()
                    search_eng = "YouTube (Incognito)" if is_incog else "YouTube Video"
                    inferred_domain = "youtube.com"
                elif " - Bing" in clean_t or " - Search" in clean_t:
                    search_q = clean_t.replace(" - Bing", "").replace(" - Search", "").strip()
                    search_eng = "Bing (Incognito)" if is_incog else "Bing Search"
                    inferred_domain = "bing.com"
                elif is_incog:
                    search_q = clean_t
                    search_eng = "Incognito Active Tab"
                    inferred_domain = "incognito.session"

                if is_incog:
                    records.append(
                        {
                            "timestamp": now_iso,
                            "clientIp": client_ip,
                            "hostname": hostname,
                            "username": f"{win_user} (Incognito Mode)",
                            "winUser": win_user,
                            "profileName": "Incognito / Private User",
                            "profileEmail": "",
                            "isIncognito": True,
                            "browser": browser_label,
                            "domain": inferred_domain,
                            "url": f"https://{inferred_domain}",
                            "pageTitle": clean_t[:250],
                            "searchQuery": search_q[:250],
                            "searchEngine": search_eng,
                            "queryType": "SEARCH" if search_q else "WEB_VISIT",
                        }
                    )
    except Exception:
        pass

    # Part B: System DNS Cache (Flags domains not in normal browser history as Incognito / DNS)
    try:
        ps_cmd = (
            'Get-DnsClientCache | Where-Object { $_.Entry -ne "" -and $_.Entry -notmatch "^_|^localhost|^wpad|^in-addr|microsoft\\.com$|windows\\.com$|digicert|letsencrypt|akamaiedge|cloudfront| trafficmanager|msftncsi|googleapis\\.com$|gstatic\\.com$" } '
            "| Select-Object -First 30 Entry, Type | ConvertTo-Json"
        )
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            data = json.loads(proc.stdout)
            items = data if isinstance(data, list) else [data]
            for item in items:
                entry = (item.get("Entry") or "").strip().lower()
                if entry.startswith("www."):
                    entry = entry[4:]
                if not entry or len(entry) < 4:
                    continue

                # Check if this domain was already seen in normal browser history
                in_normal_history = any(
                    entry == hd or entry.endswith("." + hd) or hd.endswith("." + entry)
                    for hd in known_history_domains
                )
                is_untracked_dns = not in_normal_history

                records.append(
                    {
                        "timestamp": now_iso,
                        "clientIp": client_ip,
                        "hostname": hostname,
                        "username": f"{win_user} (Incognito / DNS)" if is_untracked_dns else win_user,
                        "winUser": win_user,
                        "profileName": "Incognito / System DNS" if is_untracked_dns else win_user,
                        "profileEmail": "",
                        "isIncognito": is_untracked_dns,
                        "browser": "Incognito / DNS" if is_untracked_dns else "DNS Cache",
                        "domain": entry,
                        "url": f"https://{entry}",
                        "pageTitle": f"{entry} (Captured via DNS Resolver)" if is_untracked_dns else entry,
                        "searchQuery": "",
                        "searchEngine": "Incognito DNS" if is_untracked_dns else "",
                        "queryType": "DNS",
                    }
                )
    except Exception:
        pass

    return records


def post_batch_to_server(server_url, records):
    """Posts harvested search & web activity records to NetPulse Server in safe chunks."""
    if not records:
        return False
    api_endpoint = f"{server_url.rstrip('/')}/api/security/log-dns-batch"
    any_ok = False
    chunk_size = 45
    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        payload = json.dumps({"records": chunk}).encode("utf-8")
        req = urllib.request.Request(
            api_endpoint,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status in (200, 201):
                    any_ok = True
        except Exception:
            pass
    return any_ok


def harvest_all():
    """Runs full browser history + Incognito window & DNS harvest."""
    browser_recs = harvest_browser_history(limit_per_profile=45)
    known_domains = {r["domain"] for r in browser_recs if r.get("domain")}
    incog_and_dns = harvest_incognito_and_live_windows(known_domains)
    return incog_and_dns + browser_recs


def run_single_sync(server_url):
    """Executes a single multi-user harvest and sends data to NetPulse Server."""
    all_records = harvest_all()
    ok = post_batch_to_server(server_url, all_records[:140])
    searches = [x for x in all_records if x.get("searchQuery")]
    incogs = [x for x in all_records if x.get("isIncognito")]
    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] "
        f"Sync Status: {'SUCCESS' if ok else 'FAILED'} | "
        f"Total Events: {len(all_records)} | Exact Searches: {len(searches)} | Incognito/DNS: {len(incogs)}"
    )
    return ok


def run_continuous_agent(server_url, interval=8):
    """Runs continuously on an Office PC, streaming new searches and website visits to NetPulse."""
    client_ip = get_local_ip()
    hostname = socket.gethostname()
    user_dirs = [u[0] for u in get_all_windows_user_dirs()]

    print("=" * 74)
    print("🔍 NetPulse Layer-2 Multi-User & Incognito Search Activity Agent")
    print(f"💻 Monitored Endpoint : {hostname} ({client_ip})")
    print(f"👥 Windows Profiles   : {', '.join(user_dirs) if user_dirs else 'Current User'}")
    print(f"📡 NetPulse NOC Server: {server_url}")
    print(f"🕵️  Incognito Detector : Active (Window Titles + Untracked DNS Resolver)")
    print(f"⏱️  Live Sync Interval : Every {interval} seconds")
    print("=" * 74)

    sent_signatures = set()

    while True:
        try:
            all_records = harvest_all()

            fresh_records = []
            for r in all_records:
                sig = f"{r['username']}|{r['browser']}|{r['domain']}|{r['searchQuery']}|{r['pageTitle']}"
                if sig not in sent_signatures:
                    sent_signatures.add(sig)
                    fresh_records.append(r)

            if len(sent_signatures) > 5000:
                sent_signatures.clear()

            if fresh_records:
                ok = post_batch_to_server(server_url, fresh_records[:100])
                searches = [x for x in fresh_records if x.get("searchQuery")]
                status_tag = "SYNCED ✓" if ok else "OFFLINE/RETRY"
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}] [{status_tag}] "
                    f"Sent {len(fresh_records)} events ({len(searches)} searches)"
                )
        except KeyboardInterrupt:
            print("\n[Agent Stopped]")
            break
        except Exception:
            pass

        time.sleep(interval)


if __name__ == "__main__":
    if "--json" in sys.argv:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
        combined = harvest_all()
        print(json.dumps(combined, ensure_ascii=False))
        sys.exit(0)

    target_server = DEFAULT_SERVER
    for idx, arg in enumerate(sys.argv):
        if arg == "--server" and idx + 1 < len(sys.argv):
            target_server = sys.argv[idx + 1]
        elif arg.startswith("--server="):
            target_server = arg.split("=", 1)[1]

    if "--once" in sys.argv:
        run_single_sync(target_server)
        sys.exit(0)

    run_continuous_agent(target_server, interval=8)
