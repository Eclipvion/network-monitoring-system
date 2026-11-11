param(
    [string]$ServerUrl = "http://172.18.1.11:5000",
    [switch]$Continuous = $false,
    [int]$IntervalSec = 30
)

$ErrorActionPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# 1. Load Built-in Windows SQLite Engine (C:\Windows\System32\winsqlite3.dll - Present on ALL Windows 10/11 PCs)
$SqliteCs = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinSqlite {
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int sqlite3_open_v2(string filename, out IntPtr db, int flags, IntPtr zVfs);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Ansi)]
    public static extern int sqlite3_prepare_v2(IntPtr db, string sql, int numBytes, out IntPtr stmt, IntPtr pzTail);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_step(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern IntPtr sqlite3_column_text(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_column_count(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_finalize(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_close(IntPtr db);

    public static List<string[]> Query(string dbPath, string sql) {
        var results = new List<string[]>();
        IntPtr db = IntPtr.Zero;
        IntPtr stmt = IntPtr.Zero;
        try {
            if (sqlite3_open_v2(dbPath, out db, 1, IntPtr.Zero) != 0) return results;
            if (sqlite3_prepare_v2(db, sql, -1, out stmt, IntPtr.Zero) != 0) {
                sqlite3_close(db);
                return results;
            }
            int colCount = sqlite3_column_count(stmt);
            while (sqlite3_step(stmt) == 100) {
                string[] row = new string[colCount];
                for (int i = 0; i < colCount; i++) {
                    IntPtr ptr = sqlite3_column_text(stmt, i);
                    row[i] = ptr == IntPtr.Zero ? "" : Marshal.PtrToStringUTF8(ptr);
                }
                results.Add(row);
            }
        } catch {
        } finally {
            if (stmt != IntPtr.Zero) sqlite3_finalize(stmt);
            if (db != IntPtr.Zero) sqlite3_close(db);
        }
        return results;
    }
}
"@

try {
    Add-Type -TypeDefinition $SqliteCs -ErrorAction SilentlyContinue
} catch {}

# Fallback if PtrToStringUTF8 is not in older .NET 4.x (use PtrToStringAnsi / UTF8 bytes)
if (-not ("WinSqlite" -as [type])) {
    $SqliteCsNet4 = @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinSqlite {
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, IntPtr zVfs);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int numBytes, out IntPtr stmt, IntPtr pzTail);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_step(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern IntPtr sqlite3_column_text(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_column_bytes(IntPtr stmt, int index);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_column_count(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_finalize(IntPtr stmt);

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)]
    public static extern int sqlite3_close(IntPtr db);

    public static List<string[]> Query(string dbPath, string sql) {
        var results = new List<string[]>();
        IntPtr db = IntPtr.Zero;
        IntPtr stmt = IntPtr.Zero;
        try {
            byte[] pathBytes = Encoding.UTF8.GetBytes(dbPath + "\0");
            byte[] sqlBytes = Encoding.UTF8.GetBytes(sql + "\0");
            if (sqlite3_open_v2(pathBytes, out db, 1, IntPtr.Zero) != 0) return results;
            if (sqlite3_prepare_v2(db, sqlBytes, -1, out stmt, IntPtr.Zero) != 0) {
                sqlite3_close(db);
                return results;
            }
            int colCount = sqlite3_column_count(stmt);
            while (sqlite3_step(stmt) == 100) {
                string[] row = new string[colCount];
                for (int i = 0; i < colCount; i++) {
                    IntPtr ptr = sqlite3_column_text(stmt, i);
                    int len = sqlite3_column_bytes(stmt, i);
                    if (ptr == IntPtr.Zero || len <= 0) {
                        row[i] = "";
                    } else {
                        byte[] buf = new byte[len];
                        Marshal.Copy(ptr, buf, 0, len);
                        row[i] = Encoding.UTF8.GetString(buf);
                    }
                }
                results.Add(row);
            }
        } catch {
        } finally {
            if (stmt != IntPtr.Zero) sqlite3_finalize(stmt);
            if (db != IntPtr.Zero) sqlite3_close(db);
        }
        return results;
    }
}
"@
    try { Add-Type -TypeDefinition $SqliteCsNet4 -ErrorAction SilentlyContinue } catch {}
}

# Detect Hostname & Primary LAN IPv4
$Hostname = $env:COMPUTERNAME
$ClientIp = "127.0.0.1"
try {
    $NetIp = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notmatch "^(127\.|169\.254\.)" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback|VMware|VirtualBox"
    } | Select-Object -First 1 -ExpandProperty IPAddress
    if ($NetIp) { $ClientIp = $NetIp }
} catch {}

if ($ClientIp -eq "127.0.0.1") {
    try {
        $ClientIp = ([System.Net.Dns]::GetHostAddresses($Hostname) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -notmatch '^127\.' } | Select-Object -First 1).IPAddressToString
    } catch {}
}

do {
    # 1. Detect Active Logged-In Windows Local / Domain Account & Session State
$ActiveUser = $env:USERNAME
$UserDomain = $env:USERDOMAIN
try {
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($cs.UserName) {
        $uParts = $cs.UserName.Split('\')
        if ($uParts.Length -eq 2) {
            $UserDomain = $uParts[0]
            $ActiveUser = $uParts[1]
        } else {
            $ActiveUser = $cs.UserName
        }
    }
} catch {}

$SessionState = "Active"
try {
    $quser = query user 2>$null
    if ($quser) {
        foreach ($line in ($quser -split "`n")) {
            if ($line -match "^\s*>\s*([^\s]+)\s+([^\s]+)\s+(\d+)\s+([^\s]+)") {
                $SessionState = $Matches[4]
                break
            }
        }
    }
} catch {}

# 2. Continuous Internet Latency Probing (8.8.8.8 & 1.1.1.1) + Rolling Local History File
$AgentDir = "$env:LOCALAPPDATA\NetPulseAgent"
if (-not (Test-Path $AgentDir)) { New-Item -ItemType Directory -Path $AgentDir -Force | Out-Null }
$PingLogPath = Join-Path $AgentDir "endpoint_ping_telemetry.log"
$PingJsonPath = Join-Path $AgentDir "endpoint_ping_latest.json"
$PingHistoryPath = Join-Path $AgentDir "endpoint_ping_history.json"

# Probing with multiple packets (4 packets each for accurate min, max, avg, jitter, loss)
$PingSummary = @{
    google        = @{ target = "8.8.8.8"; status = "DOWN"; latency = $null; min = $null; max = $null; avg = $null; loss = 100; jitter = 0 }
    cloudflare    = @{ target = "1.1.1.1"; status = "DOWN"; latency = $null; min = $null; max = $null; avg = $null; loss = 100; jitter = 0 }
    jitter        = 0
    packetLoss    = 0
    qualityScore  = "Calculating"
    testedAt      = (Get-Date).ToUniversalTime().ToString("o")
    logFile       = $PingLogPath
    recentSamples = @()
}

try {
    $tG = Test-Connection -ComputerName 8.8.8.8 -Count 4 -ErrorAction SilentlyContinue
    if ($tG -and $tG.Count -gt 0) {
        $gMeas = $tG | Measure-Object -Property ResponseTime -Average -Minimum -Maximum
        $lossPct = [Math]::Round(((4 - $tG.Count) / 4) * 100)
        $PingSummary.google.status = if ($lossPct -eq 0) { "UP" } elseif ($lossPct -lt 50) { "DEGRADED" } else { "DOWN" }
        $PingSummary.google.latency = [Math]::Round([double]$gMeas.Average, 1)
        $PingSummary.google.avg = [Math]::Round([double]$gMeas.Average, 1)
        $PingSummary.google.min = [Math]::Round([double]$gMeas.Minimum, 1)
        $PingSummary.google.max = [Math]::Round([double]$gMeas.Maximum, 1)
        $PingSummary.google.loss = $lossPct
        $PingSummary.google.jitter = [Math]::Max(0, [Math]::Round([double]($gMeas.Maximum - $gMeas.Minimum), 1))
    }
} catch {}

try {
    $tCf = Test-Connection -ComputerName 1.1.1.1 -Count 4 -ErrorAction SilentlyContinue
    if ($tCf -and $tCf.Count -gt 0) {
        $cfMeas = $tCf | Measure-Object -Property ResponseTime -Average -Minimum -Maximum
        $cfLossPct = [Math]::Round(((4 - $tCf.Count) / 4) * 100)
        $PingSummary.cloudflare.status = if ($cfLossPct -eq 0) { "UP" } elseif ($cfLossPct -lt 50) { "DEGRADED" } else { "DOWN" }
        $PingSummary.cloudflare.latency = [Math]::Round([double]$cfMeas.Average, 1)
        $PingSummary.cloudflare.avg = [Math]::Round([double]$cfMeas.Average, 1)
        $PingSummary.cloudflare.min = [Math]::Round([double]$cfMeas.Minimum, 1)
        $PingSummary.cloudflare.max = [Math]::Round([double]$cfMeas.Maximum, 1)
        $PingSummary.cloudflare.loss = $cfLossPct
        $PingSummary.cloudflare.jitter = [Math]::Max(0, [Math]::Round([double]($cfMeas.Maximum - $cfMeas.Minimum), 1))
    }
} catch {}

$gJit = if ($PingSummary.google.jitter -ne $null) { [double]$PingSummary.google.jitter } else { 0.0 }
$cfJit = if ($PingSummary.cloudflare.jitter -ne $null) { [double]$PingSummary.cloudflare.jitter } else { 0.0 }
$overallJitter = [Math]::Max($gJit, $cfJit)
$PingSummary.jitter = $overallJitter

$gLoss = if ($PingSummary.google.loss -ne $null) { [int]$PingSummary.google.loss } else { 0 }
$cfLoss = if ($PingSummary.cloudflare.loss -ne $null) { [int]$PingSummary.cloudflare.loss } else { 0 }
$overallLoss = [Math]::Max($gLoss, $cfLoss)
$PingSummary.packetLoss = $overallLoss

# Quality Score assessment
$gLat = $PingSummary.google.latency
if ($overallLoss -eq 0 -and $gLat -ne $null -and $gLat -lt 30) {
    $PingSummary.qualityScore = "Optimal (Grade A+)"
} elseif ($overallLoss -eq 0 -and $gLat -ne $null -and $gLat -lt 80) {
    $PingSummary.qualityScore = "Good (Grade A)"
} elseif ($overallLoss -lt 25) {
    $PingSummary.qualityScore = "Fair (Grade B)"
} else {
    $PingSummary.qualityScore = "Degraded (Grade C)"
}

# Maintain Rolling Ping History in Local JSON File (Stores last 50 continuous tests on endpoint)
$HistoryList = @()
try {
    if (Test-Path $PingHistoryPath) {
        $rawHist = Get-Content -Path $PingHistoryPath -Raw -ErrorAction SilentlyContinue
        if ($rawHist) {
            $cleanHist = $rawHist.Trim().Trim([char]0xFEFF)
            $parsedHist = ConvertFrom-Json $cleanHist -ErrorAction SilentlyContinue
            if ($parsedHist -is [System.Collections.IEnumerable]) {
                foreach ($h in $parsedHist) { $HistoryList += $h }
            } elseif ($parsedHist -ne $null) {
                $HistoryList += $parsedHist
            }
        }
    }
} catch {}

$newSample = @{
    time       = (Get-Date).ToString("HH:mm:ss")
    timestamp  = (Get-Date).ToUniversalTime().ToString("o")
    google     = $PingSummary.google.latency
    cloudflare = $PingSummary.cloudflare.latency
    jitter     = $overallJitter
    loss       = $overallLoss
}
$HistoryList += $newSample
# Keep last 50 samples
if ($HistoryList.Count -gt 50) {
    $HistoryList = $HistoryList[($HistoryList.Count - 50)..($HistoryList.Count - 1)]
}

# Attach last 15 samples as a guaranteed array for UI sparklines/timeline
$recentArr = @()
$startIdx = [Math]::Max(0, $HistoryList.Count - 15)
for ($idx = $startIdx; $idx -lt $HistoryList.Count; $idx++) {
    $recentArr += $HistoryList[$idx]
}
$PingSummary.recentSamples = $recentArr

# Save updated local history file (guaranteed JSON array format for PS 5.1)
try {
    $jsonHist = if ($HistoryList.Count -eq 1) {
        "[" + (ConvertTo-Json $HistoryList[0] -Compress) + "]"
    } else {
        ConvertTo-Json @($HistoryList) -Depth 4
    }
    Set-Content -Path $PingHistoryPath -Value $jsonHist -Encoding UTF8 -ErrorAction SilentlyContinue
} catch {}

# Append to continuous human-readable telemetry log file on endpoint
$logLine = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] User: $UserDomain\$ActiveUser ($SessionState) | 8.8.8.8: $($PingSummary.google.latency)ms (Min:$($PingSummary.google.min)/Max:$($PingSummary.google.max)/Loss:$($PingSummary.google.loss)%) | 1.1.1.1: $($PingSummary.cloudflare.latency)ms (Min:$($PingSummary.cloudflare.min)/Max:$($PingSummary.cloudflare.max)) | Jitter: ${overallJitter}ms | Quality: $($PingSummary.qualityScore)"
Add-Content -Path $PingLogPath -Value $logLine -Encoding UTF8 -ErrorAction SilentlyContinue

# Save latest JSON file for local diagnostic inspection
try {
    $jsonContent = ConvertTo-Json $PingSummary -Compress -Depth 5
    Set-Content -Path $PingJsonPath -Value $jsonContent -Encoding UTF8 -ErrorAction SilentlyContinue
} catch {}

function Parse-SearchFromUrl([string]$Url, [string]$Title) {
    $res = @{ Domain = ""; SearchQuery = ""; SearchEngine = ""; QueryType = "WEB_VISIT" }
    try {
        $u = [System.Uri]$Url
        $hostName = $u.Host.ToLower() -replace "^www\.", ""
        $res.Domain = $hostName
        $path = $u.AbsolutePath.ToLower()
        $query = $u.Query

        # Extract ?q= or ?search_query= or ?p=
        $qVal = ""
        if ($query -match "(?:^\?|&)(?:q|query|search_query|p|k|wd|text)=([^&]+)") {
            $decoded = [System.Uri]::UnescapeDataString(($Matches[1] -replace "\+", " ")).Trim()
            if ($decoded -notmatch "^https?://") {
                $qVal = $decoded
            }
        }

        if ($hostName -match "google\." -and $path -notmatch "/url" -and $qVal) {
            $res.SearchQuery = $qVal; $res.SearchEngine = "Google Search"; $res.QueryType = "SEARCH"; return $res
        }
        if ($hostName -match "bing\.com" -and $qVal) {
            $res.SearchQuery = $qVal; $res.SearchEngine = "Bing Search"; $res.QueryType = "SEARCH"; return $res
        }
        if ($hostName -match "duckduckgo\.com" -and $qVal) {
            $res.SearchQuery = $qVal; $res.SearchEngine = "DuckDuckGo"; $res.QueryType = "SEARCH"; return $res
        }
        if ($hostName -match "youtube\.com") {
            if ($qVal) {
                $res.SearchQuery = $qVal; $res.SearchEngine = "YouTube Search"; $res.QueryType = "SEARCH"; return $res
            }
            if ($path -match "/watch" -and $Title -and $Title -ne "YouTube") {
                $cleanT = ($Title -replace "\s*-\s*YouTube.*$", "") -replace "^\(\d+\)\s*", ""
                if ($cleanT) {
                    $res.SearchQuery = "[Video] $cleanT"; $res.SearchEngine = "YouTube Video"; $res.QueryType = "SEARCH"; return $res
                }
            }
        }
        if ($hostName -match "chatgpt\.com|openai\.com|claude\.ai|gemini\.google\.com|perplexity\.ai|deepseek\.com|copilot\.microsoft\.com") {
            $cleanAi = ($Title -replace "\s*[-|]\s*(ChatGPT|Claude|Gemini|Perplexity|DeepSeek).*$", "").Trim()
            if ($cleanAi -and $cleanAi.ToLower() -notin @("chatgpt", "claude", "gemini", "new chat")) {
                $res.SearchQuery = "[AI Prompt] $cleanAi"; $res.SearchEngine = "AI Assistant"; $res.QueryType = "SEARCH"; return $res
            }
        }
        if ($Title -match "^(.+?)\s*-\s*(Google Search|Bing|DuckDuckGo|Yahoo Search)") {
            $tQuery = $Matches[1].Trim()
            if ($tQuery -and $tQuery -notmatch "^https?://") {
                $res.SearchQuery = $tQuery; $res.SearchEngine = $Matches[2]; $res.QueryType = "SEARCH"; return $res
            }
        }
    } catch {}
    return $res
}

$Records = New-Object System.Collections.Generic.List[object]
$SeenSigs = @{ }

function Add-ActivityRecord($Obj) {
    if (-not $Obj.domain -or $Obj.domain -match "^(localhost|127\.0\.0\.1|172\.18\.1\.11)") { return }
    $sig = "$($Obj.username)|$($Obj.browser)|$($Obj.domain)|$($Obj.searchQuery)|$($Obj.pageTitle)"
    if (-not $SeenSigs.ContainsKey($sig)) {
        $SeenSigs[$sig] = $true
        $Records.Add($Obj)
    }
}

# Scan all Windows User accounts (C:\Users\*)
$SkipUsers = @("All Users", "Default", "Default User", "Public", "desktop.ini")
$UserDirs = Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin $SkipUsers }

foreach ($uDir in $UserDirs) {
    $winUser = $uDir.Name
    $localApp = Join-Path $uDir.FullName "AppData\Local"
    if (-not (Test-Path $localApp)) { continue }

    $BrowserRoots = @(
        @{ Name = "Chrome"; Path = Join-Path $localApp "Google\Chrome\User Data" },
        @{ Name = "Edge";   Path = Join-Path $localApp "Microsoft\Edge\User Data" },
        @{ Name = "Brave";  Path = Join-Path $localApp "BraveSoftware\Brave-Browser\User Data" }
    )

    foreach ($bRoot in $BrowserRoots) {
        $bName = $bRoot.Name
        $uDataPath = $bRoot.Path
        if (-not (Test-Path $uDataPath)) { continue }

        # Parse Local State for real Logged-In Profile Names & Emails
        $ProfileMeta = @{}
        $localStatePath = Join-Path $uDataPath "Local State"
        if (Test-Path $localStatePath) {
            try {
                $lsJson = Get-Content $localStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
                $infoCache = $lsJson.profile.info_cache
                if ($infoCache) {
                    foreach ($prop in $infoCache.PSObject.Properties) {
                        $pFolder = $prop.Name
                        $pVal = $prop.Value
                        $gaiaName = [string]$pVal.gaia_name
                        $pName = [string]$pVal.name
                        $email = [string]$pVal.user_name
                        $shortcut = [string]$pVal.shortcut_name
                        $dispName = if ($gaiaName) { $gaiaName } elseif ($pName -and $pName -notmatch "^Person ") { $pName } elseif ($shortcut) { $shortcut } elseif ($email) { $email.Split('@')[0] } else { $winUser }
                        $ProfileMeta[$pFolder] = @{ Name = $dispName; Email = $email }
                    }
                }
            } catch {}
        }

        # Find all Profile folders (Default, Profile 1, Profile 2, ...)
        $profDirs = Get-ChildItem $uDataPath -Directory -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -eq "Default" -or $_.Name -match "^Profile \d+$"
        }

        foreach ($pDir in $profDirs) {
            $pFolder = $pDir.Name
            $meta = if ($ProfileMeta.ContainsKey($pFolder)) { $ProfileMeta[$pFolder] } else { @{ Name = $winUser; Email = "" } }
            $profName = $meta.Name
            $profEmail = $meta.Email
            $userLabel = if ($profEmail -and $profEmail -ne $profName) { "$profName ($profEmail)" } else { $profName }
            $browserLabel = if ($pFolder -eq "Default") { $bName } else { "$bName ($profName)" }

            # 1. Read SQLite History & keyword_search_terms via built-in winsqlite3.dll
            $histPath = Join-Path $pDir.FullName "History"
            if ((Test-Path $histPath) -and ("WinSqlite" -as [type])) {
                $tmpDb = Join-Path $env:TEMP "np_hist_$($winUser)_$($bName)_$($pFolder -replace ' ','').db"
                try {
                    Copy-Item -Path $histPath -Destination $tmpDb -Force -ErrorAction Stop

                    # A. Exact search queries from keyword_search_terms
                    $kwRows = [WinSqlite]::Query($tmpDb, "SELECT u.url, u.title, k.term FROM keyword_search_terms k JOIN urls u ON k.url_id = u.id ORDER BY u.last_visit_time DESC LIMIT 50")
                    foreach ($row in $kwRows) {
                        $url = $row[0]; $title = $row[1]; $term = ($row[2] + "").Trim()
                        if (-not $term -or $term -match "^https?://") { continue }
                        $parsed = Parse-SearchFromUrl $url $title
                        if (-not $parsed.Domain) { continue }
                        Add-ActivityRecord @{
                            timestamp    = (Get-Date).ToUniversalTime().ToString("o")
                            clientIp     = $ClientIp
                            hostname     = $Hostname
                            username     = $userLabel
                            winUser      = $winUser
                            profileName  = $profName
                            profileEmail = $profEmail
                            isIncognito  = $false
                            browser      = $browserLabel
                            domain       = $parsed.Domain
                            url          = $url
                            pageTitle    = if ($title) { $title } else { $term }
                            searchQuery  = $term
                            searchEngine = if ($parsed.SearchEngine) { $parsed.SearchEngine } else { "Browser Search" }
                            queryType    = "SEARCH"
                        }
                    }

                    # B. Recent visited URLs & searches
                    $urlRows = [WinSqlite]::Query($tmpDb, "SELECT url, title FROM urls ORDER BY last_visit_time DESC LIMIT 75")
                    foreach ($row in $urlRows) {
                        $url = $row[0]; $title = $row[1]
                        $parsed = Parse-SearchFromUrl $url $title
                        if (-not $parsed.Domain) { continue }
                        Add-ActivityRecord @{
                            timestamp    = (Get-Date).ToUniversalTime().ToString("o")
                            clientIp     = $ClientIp
                            hostname     = $Hostname
                            username     = $userLabel
                            winUser      = $winUser
                            profileName  = $profName
                            profileEmail = $profEmail
                            isIncognito  = $false
                            browser      = $browserLabel
                            domain       = $parsed.Domain
                            url          = $url
                            pageTitle    = if ($title) { $title } else { $parsed.Domain }
                            searchQuery  = $parsed.SearchQuery
                            searchEngine = $parsed.SearchEngine
                            queryType    = $parsed.QueryType
                        }
                    }
                } catch {} finally {
                    Remove-Item $tmpDb -Force -ErrorAction SilentlyContinue
                }
            }

            # 2. Read Network Persistent State for Incognito / Cleared History recovery
            $netStatePath = Join-Path $pDir.FullName "Network\Network Persistent State"
            if (Test-Path $netStatePath) {
                try {
                    $nsRaw = Get-Content $netStatePath -Raw -Encoding UTF8
                    $b64Matches = [regex]::Matches($nsRaw, '"anonymization"\s*:\s*\[\s*"([A-Za-z0-9+/=]+)"')
                    $countNs = 0
                    foreach ($m in $b64Matches) {
                        if ($countNs -ge 25) { break }
                        $b64 = $m.Groups[1].Value
                        $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
                        if ($decoded -match "https?://([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})") {
                            $dom = $Matches[1].ToLower() -replace "^www\.", ""
                            if ($dom -notmatch "google\.com|gstatic\.com|googleapis\.com|doubleclick\.net|microsoft\.com|bing\.com|msn\.com|live\.com|office\.net") {
                                $countNs++
                                Add-ActivityRecord @{
                                    timestamp    = (Get-Date).ToUniversalTime().ToString("o")
                                    clientIp     = $ClientIp
                                    hostname     = $Hostname
                                    username     = "$profName (Incognito / DNS)"
                                    winUser      = $winUser
                                    profileName  = $profName
                                    profileEmail = $profEmail
                                    isIncognito  = $true
                                    browser      = "$bName (Incognito / Network Cache)"
                                    domain       = $dom
                                    url          = "https://$dom"
                                    pageTitle    = "[Hidden / Cleared Session] $dom"
                                    searchQuery  = ""
                                    searchEngine = ""
                                    queryType    = "DNS"
                                }
                            }
                        }
                    }
                } catch {}
            }
        }
    }
}

# 3. Capture Active Browser Window Titles (Including Active Incognito / InPrivate Tabs!)
try {
    $procs = Get-Process chrome, msedge, brave, firefox -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle }
    foreach ($p in $procs) {
        $wTitle = $p.MainWindowTitle.Trim()
        $isIncog = $wTitle -match "Incognito|InPrivate|Private Browsing"
        $cleanT = $wTitle -replace "\s*-\s*(Google Chrome|Microsoft.*Edge|Brave|Mozilla Firefox).*$", ""
        $cleanT = $cleanT -replace "\s*\[InPrivate\]|\s*\(Incognito\)", ""
        if ($cleanT) {
            Add-ActivityRecord @{
                timestamp    = (Get-Date).ToUniversalTime().ToString("o")
                clientIp     = $ClientIp
                hostname     = $Hostname
                username     = if ($isIncog) { "$env:USERNAME (Incognito Mode)" } else { $env:USERNAME }
                winUser      = $env:USERNAME
                profileName  = $env:USERNAME
                profileEmail = ""
                isIncognito  = [bool]$isIncog
                browser      = if ($isIncog) { "$($p.ProcessName) (Incognito Active)" } else { "$($p.ProcessName) (Active Window)" }
                domain       = "active-browser.session"
                url          = ""
                pageTitle    = $cleanT
                searchQuery  = if ($isIncog) { "[Incognito Tab] $cleanT" } else { "[Active Tab] $cleanT" }
                searchEngine = if ($isIncog) { "Incognito Window" } else { "Active Window" }
                queryType    = "SEARCH"
            }
        }
    }
} catch {}

# 4. Send Batch + Endpoint Telemetry to NetPulse Server
$CleanServer = $ServerUrl.TrimEnd('/')
$Endpoint = "$CleanServer/api/security/log-dns-batch"

$ClientInfo = @{
    ip           = $ClientIp
    hostname     = $Hostname
    activeUser   = $ActiveUser
    userDomain   = $UserDomain
    sessionState = $SessionState
    pingHealth   = $PingSummary
}

Write-Host "[NetPulse Agent] Host: $Hostname ($ClientIp) | Active User: $UserDomain\$ActiveUser ($SessionState)" -ForegroundColor Cyan
Write-Host "                 Ping 8.8.8.8: $($PingSummary.google.latency)ms | 1.1.1.1: $($PingSummary.cloudflare.latency)ms" -ForegroundColor Cyan
Write-Host "                 Collected $($Records.Count) user search & web records." -ForegroundColor Cyan

# Always send heartbeat / telemetry even if 0 new browser search records!
$nowStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$timeOnly = Get-Date -Format "HH:mm:ss"

if ($Records.Count -eq 0) {
    try {
        $bodyJson = ConvertTo-Json @{ clientInfo = $ClientInfo; records = @() } -Depth 6 -Compress
        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
        Invoke-RestMethod -Uri $Endpoint -Method POST -Body $bodyBytes -ContentType "application/json; charset=utf-8" -TimeoutSec 15 -ErrorAction Stop | Out-Null
        Write-Host "[$timeOnly] [NetPulse Agent] Heartbeat & Endpoint Telemetry synced successfully." -ForegroundColor Green
        Add-Content -Path $PingLogPath -Value "[$nowStamp] TELEMETRY_SYNC: Heartbeat & WAN Ping synced to $CleanServer" -ErrorAction SilentlyContinue
    } catch {
        Write-Host "[$timeOnly] [NetPulse Agent] Telemetry heartbeat failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    try {
        # Send in chunks of 50 to stay well under Express default 100kb payload limit
        $totalAdded = 0
        for ($i = 0; $i -lt $Records.Count; $i += 50) {
            $chunk = $Records.GetRange($i, [Math]::Min(50, $Records.Count - $i))
            $bodyJson = ConvertTo-Json @{ clientInfo = $ClientInfo; records = $chunk } -Depth 6 -Compress
            $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
            $resp = Invoke-RestMethod -Uri $Endpoint -Method POST -Body $bodyBytes -ContentType "application/json; charset=utf-8" -TimeoutSec 15 -ErrorAction Stop
            $totalAdded += [int]$resp.addedCount
        }
        Write-Host "[$timeOnly] [NetPulse Agent] Successfully synced $($Records.Count) records & Endpoint Telemetry to $CleanServer (New Added: $totalAdded)" -ForegroundColor Green
        Add-Content -Path $PingLogPath -Value "[$nowStamp] DATA_SYNC: Uploaded $($Records.Count) records & continuous ping telemetry to $CleanServer (New: $totalAdded)" -ErrorAction SilentlyContinue
    } catch {
        Write-Host "[$timeOnly] [NetPulse Agent] ERROR sending to $Endpoint : $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "                 Check that NetPulse Server ($CleanServer) is running and Windows Firewall allows port 5000." -ForegroundColor Yellow
    }
}

    if ($Continuous) {
        $nextSync = (Get-Date).AddSeconds($IntervalSec).ToString("HH:mm:ss")
        Write-Host "[$timeOnly] [NetPulse Agent] Continuous mode active. Sleeping $IntervalSec sec until next sync at $nextSync (Press Ctrl+C to stop)..." -ForegroundColor DarkGray
        Start-Sleep -Seconds $IntervalSec
    }
} while ($Continuous)
