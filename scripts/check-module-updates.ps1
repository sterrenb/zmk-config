#Requires -Version 5.1
<#
.SYNOPSIS
    Reports whether any west module pinned in config/west.yml has fallen behind.

.DESCRIPTION
    Reads config/west.yml and, for every project, compares the pinned revision
    against whatever its `# track:` marker names:

        revision: <40-hex sha>   # track: <branch>    -> commits on <branch> since the pin
        revision: <tag>          # track: tags        -> tags on a higher version line

    Every project must carry a `# track:` marker. A project without one is a hard
    error, so a newly added pin cannot silently go unwatched.

    Runs locally on Windows PowerShell and in CI under pwsh - no dependencies
    beyond the GitHub REST API.

.PARAMETER Token
    GitHub token, used only to raise the API rate limit (unauthenticated is 60
    requests/hour per IP, which is shared on CI runners). Defaults to
    $env:GITHUB_TOKEN. No scopes needed for public repos.

.PARAMETER FailOnUpdate
    Exit 1 when any pin is behind. Use in CI if you want the job to go red;
    omit to have it report and pass.

.PARAMETER MaxCommits
    How many commit subjects to list per outdated project. Default 10.

.EXAMPLE
    .\scripts\check-module-updates.ps1

.EXAMPLE
    .\scripts\check-module-updates.ps1 -FailOnUpdate
#>
[CmdletBinding()]
param(
    [string]$Token = $env:GITHUB_TOKEN,
    [switch]$FailOnUpdate,
    [int]$MaxCommits = 10
)

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# GitHub REST helpers
# --------------------------------------------------------------------------

$script:ApiHeaders = @{
    'Accept'               = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'zmk-config-update-check'
}
if (-not [string]::IsNullOrWhiteSpace($Token)) {
    $script:ApiHeaders['Authorization'] = "Bearer $Token"
}

# TLS 1.2 is not the default on Windows PowerShell 5.1 and the API refuses less.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Invoke-GitHub {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        return Invoke-RestMethod -Uri "https://api.github.com$Path" -Headers $script:ApiHeaders
    }
    catch {
        $status = $null
        if ($null -ne $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        if ($status -eq 403) {
            throw "GitHub API returned 403 for $Path. This is usually the unauthenticated rate limit (60/hour) - pass -Token or set GITHUB_TOKEN."
        }
        throw "GitHub API request failed for $Path : $($_.Exception.Message)"
    }
}

# --------------------------------------------------------------------------
# Version helpers (for `track: tags`)
# --------------------------------------------------------------------------

function ConvertTo-ComparableVersion {
    # 'v0.3' and 'v0.3.0' both -> @(0,3,0). Returns $null for non-version tags.
    param([string]$Tag)

    if ($Tag -notmatch '^[vV]?(\d+(?:\.\d+)*)$') { return $null }
    $parts = @($Matches[1] -split '\.' | ForEach-Object { [int]$_ })
    while ($parts.Count -lt 3) { $parts += 0 }
    return , $parts
}

function Compare-VersionArray {
    param([int[]]$A, [int[]]$B)

    for ($i = 0; $i -lt [Math]::Max($A.Count, $B.Count); $i++) {
        $x = if ($i -lt $A.Count) { $A[$i] } else { 0 }
        $y = if ($i -lt $B.Count) { $B[$i] } else { 0 }
        if ($x -gt $y) { return 1 }
        if ($x -lt $y) { return -1 }
    }
    return 0
}

# --------------------------------------------------------------------------
# Parse config/west.yml
# --------------------------------------------------------------------------

$repoDir = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoDir)) {
    throw 'Not inside a git repository.'
}

$westFile = Join-Path $repoDir 'config/west.yml'
if (-not (Test-Path -LiteralPath $westFile)) { throw "Not found: $westFile" }

$lines = Get-Content -LiteralPath $westFile

# remote name -> url-base, so a project can be resolved to owner/repo.
$remotes = @{}
$currentRemote = $null
foreach ($line in $lines) {
    if ($line -match '^\s*-\s*name:\s*(\S+)') { $currentRemote = $Matches[1]; continue }
    if ($line -match '^\s*url-base:\s*(\S+)' -and $currentRemote) {
        $remotes[$currentRemote] = $Matches[1].TrimEnd('/')
        $currentRemote = $null
    }
}

$projects = @()
$pending = $null
foreach ($line in $lines) {
    if ($line -match '^\s*-\s*name:\s*(\S+)') {
        if ($pending) { $projects += , $pending }
        $pending = [pscustomobject]@{
            Name = $Matches[1]; Remote = $null; Revision = $null; Track = $null
        }
        continue
    }
    if (-not $pending) { continue }
    if ($line -match '^\s*remote:\s*(\S+)') { $pending.Remote = $Matches[1]; continue }
    if ($line -match '^\s*revision:\s*(\S+)') {
        $pending.Revision = $Matches[1]
        if ($line -match '#\s*track:\s*(\S+)') { $pending.Track = $Matches[1] }
    }
}
if ($pending) { $projects += , $pending }

# Keep only real projects (remotes were captured by the same `- name:` pattern).
$projects = @($projects | Where-Object { $_.Revision })

if ($projects.Count -eq 0) { throw "Parsed no projects from $westFile - the parser is out of step with the file." }

$untracked = @($projects | Where-Object { -not $_.Track })
if ($untracked.Count -gt 0) {
    throw ("These projects in config/west.yml have no '# track:' marker on their revision line: " +
        ($untracked.Name -join ', ') +
        '. Add one (e.g. "revision: <sha> # track: main") so the pin is watched.')
}

# --------------------------------------------------------------------------
# Compare each pin against upstream
# --------------------------------------------------------------------------

$results = @()

foreach ($p in $projects) {
    $urlBase = $remotes[$p.Remote]
    if (-not $urlBase) { throw "Project '$($p.Name)' references unknown remote '$($p.Remote)'." }
    $owner = ($urlBase -split '/')[-1]
    $slug = "$owner/$($p.Name)"

    $row = [pscustomobject]@{
        Project = $p.Name; Slug = $slug; Pinned = $p.Revision
        Track = $p.Track; Behind = 0; Latest = $null; Detail = @(); Status = 'current'
    }

    if ($p.Track -eq 'tags') {
        # Version-line check, not "any newer tag". Both v0.3-pinned projects here
        # carry a v0.3 tag AND a v0.3.0 tag, which are the same version; what we
        # actually want to know is whether a HIGHER line (v0.4...) exists.
        $tags = Invoke-GitHub "/repos/$slug/tags?per_page=100"
        $pinnedVer = ConvertTo-ComparableVersion $p.Revision
        if (-not $pinnedVer) {
            throw "Project '$($p.Name)' is marked 'track: tags' but its revision '$($p.Revision)' is not a version tag."
        }

        $newer = @()
        foreach ($t in $tags) {
            $v = ConvertTo-ComparableVersion $t.name
            if ($v -and (Compare-VersionArray $v $pinnedVer) -gt 0) { $newer += $t.name }
        }
        $newer = @($newer | Sort-Object -Unique)

        if ($newer.Count -gt 0) {
            $row.Status = 'behind'
            $row.Behind = $newer.Count
            $row.Latest = $newer[-1]
            $row.Detail = $newer
        }
    }
    else {
        # SHA pinned: compare against the tracked branch head.
        $cmp = Invoke-GitHub "/repos/$slug/compare/$($p.Revision)...$($p.Track)"
        $row.Latest = $cmp.commits[-1].sha
        if ($cmp.ahead_by -gt 0) {
            $row.Status = 'behind'
            $row.Behind = $cmp.ahead_by
            $row.Latest = $cmp.commits[-1].sha
            $row.Detail = @(
                $cmp.commits |
                Select-Object -Last $MaxCommits |
                ForEach-Object {
                    $subject = ($_.commit.message -split "`n")[0]
                    "$($_.sha.Substring(0,7))  $subject"
                }
            )
            [array]::Reverse($row.Detail)
        }
        if ($cmp.behind_by -gt 0) {
            # The pin is not an ancestor of the tracked branch - wrong branch, or
            # upstream rewrote history. This is exactly the zmk_driver_azoteq trap.
            $row.Status = 'diverged'
        }
    }

    $results += , $row
}

# --------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------

$outdated = @($results | Where-Object { $_.Status -ne 'current' })

$md = New-Object System.Text.StringBuilder
[void]$md.AppendLine('# West module update check')
[void]$md.AppendLine()

foreach ($r in $results) {
    switch ($r.Status) {
        'current' {
            Write-Host "  [ok]       $($r.Project) - up to date with $($r.Track)" -ForegroundColor Green
        }
        'behind' {
            $what = if ($r.Track -eq 'tags') { "tag(s)" } else { "commit(s) on $($r.Track)" }
            Write-Host "  [behind]   $($r.Project) - $($r.Behind) new $what" -ForegroundColor Yellow
            foreach ($d in $r.Detail) { Write-Host "               $d" }
        }
        'diverged' {
            Write-Host "  [DIVERGED] $($r.Project) - pinned revision is not on '$($r.Track)'" -ForegroundColor Red
            Write-Host "               Check the '# track:' branch is correct for this repo."
        }
    }
}

Write-Host ''
if ($outdated.Count -eq 0) {
    Write-Host "All $($results.Count) pins are current." -ForegroundColor Green
    [void]$md.AppendLine("All **$($results.Count)** pinned modules are up to date.")
}
else {
    Write-Host "$($outdated.Count) of $($results.Count) pins have updates available." -ForegroundColor Yellow
    [void]$md.AppendLine('| Project | Tracking | Pinned | Available |')
    [void]$md.AppendLine('| --- | --- | --- | --- |')
    foreach ($r in $outdated) {
        $pinnedShort = if ($r.Pinned.Length -eq 40) { $r.Pinned.Substring(0, 7) } else { $r.Pinned }
        $latestShort = if ($r.Latest -and $r.Latest.Length -eq 40) { $r.Latest.Substring(0, 7) } else { $r.Latest }
        $avail = if ($r.Status -eq 'diverged') { '**diverged - check `# track:`**' } else { "$($r.Behind) new -> ``$latestShort``" }
        [void]$md.AppendLine("| ``$($r.Project)`` | ``$($r.Track)`` | ``$pinnedShort`` | $avail |")
    }
    [void]$md.AppendLine()
    foreach ($r in $outdated) {
        if ($r.Detail.Count -eq 0) { continue }
        [void]$md.AppendLine("<details><summary><code>$($r.Project)</code></summary>")
        [void]$md.AppendLine()
        foreach ($d in $r.Detail) { [void]$md.AppendLine("- ``$d``") }
        [void]$md.AppendLine()
        [void]$md.AppendLine('</details>')
        [void]$md.AppendLine()
    }
    [void]$md.AppendLine('Bump by editing `config/west.yml`, then verify the build on a feature branch.')
    [void]$md.AppendLine('Cross-check shield overlay properties against the driver bindings before merging.')
}

if ($env:GITHUB_STEP_SUMMARY) {
    $md.ToString() | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Encoding utf8 -Append
}

if ($FailOnUpdate -and $outdated.Count -gt 0) { exit 1 }
exit 0
