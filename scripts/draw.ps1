#Requires -Version 5.1
<#
.SYNOPSIS
    Parses a ZMK keymap and renders it to SVG using keymap-drawer.

.DESCRIPTION
    Windows equivalent of scripts/draw.zsh.

    Writes <name>.local.yml and <name>.local.svg into keymap-drawer/, which
    .gitignore excludes, so local renders never end up in a commit.

    Uses an installed `keymap` command if one is on PATH, otherwise falls back
    to running keymap-drawer through `uvx` / `uv tool run`.

.PARAMETER KeymapName
    Name of the keymap to draw, matching config/<KeymapName>.keymap.
    Defaults to 'corne'.

.EXAMPLE
    .\scripts\draw.ps1

.EXAMPLE
    .\scripts\draw.ps1 corne
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$KeymapName = 'corne'
)

$ErrorActionPreference = 'Stop'

# keymap-drawer emits glyphs outside the legacy Windows codepage (the trans
# legend in keymap-drawer.config.yml is U+25BD). Without UTF-8 mode, Python
# writes through cp1252 and dies with UnicodeEncodeError.
$env:PYTHONUTF8 = '1'

function Resolve-KeymapRunner {
    <#
        Returns a hashtable with:
          Exe    - executable to invoke
          Prefix - leading arguments that must precede keymap's own arguments
          Label  - how it was resolved, for the status line
    #>
    $direct = Get-Command 'keymap' -CommandType Application -ErrorAction SilentlyContinue
    if ($null -ne $direct) {
        return @{ Exe = $direct.Source; Prefix = @(); Label = 'keymap (on PATH)' }
    }

    $uvx = Get-Command 'uvx' -CommandType Application -ErrorAction SilentlyContinue
    if ($null -ne $uvx) {
        return @{ Exe = $uvx.Source; Prefix = @('--from', 'keymap-drawer', 'keymap'); Label = 'uvx --from keymap-drawer' }
    }

    $uv = Get-Command 'uv' -CommandType Application -ErrorAction SilentlyContinue
    if ($null -ne $uv) {
        return @{ Exe = $uv.Source; Prefix = @('tool', 'run', '--from', 'keymap-drawer', 'keymap'); Label = 'uv tool run --from keymap-drawer' }
    }

    throw @'
keymap-drawer is not available, and neither is uv to run it on demand.

Install one of:
  winget install astral-sh.uv        then re-run this script
  uv tool install keymap-drawer      installs the `keymap` command
  pipx install keymap-drawer         if you already use pipx

See https://github.com/caksoylar/keymap-drawer
'@
}

function Invoke-Keymap {
    param(
        [Parameter(Mandatory = $true)] [hashtable]$Runner,
        [Parameter(Mandatory = $true)] [string[]]$Arguments,
        [Parameter(Mandatory = $true)] [string]$FailureMessage
    )

    $all = $Runner.Prefix + $Arguments
    & $Runner.Exe @all
    if ($LASTEXITCODE -ne 0) {
        throw "$FailureMessage (exit code $LASTEXITCODE)"
    }
}

$repoDir = git rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoDir)) {
    throw 'Not inside a git repository — run this from within the zmk-config checkout.'
}

$configDir = Join-Path $repoDir 'config'
$outputDir = Join-Path $repoDir 'keymap-drawer'

$keymapInputFile = Join-Path $configDir "$KeymapName.keymap"
$drawConfigFile  = Join-Path $configDir 'keymap-drawer.config.yml'
$parsedYmlFile   = Join-Path $outputDir "$KeymapName.local.yml"
$outputSvgFile   = Join-Path $outputDir "$KeymapName.local.svg"

if (-not (Test-Path -LiteralPath $keymapInputFile)) {
    $available = Get-ChildItem -LiteralPath $configDir -Filter '*.keymap' -ErrorAction SilentlyContinue |
        ForEach-Object { $_.BaseName }
    $hint = if ($available) { "Available: $($available -join ', ')" } else { 'No .keymap files found in config/.' }
    throw "Keymap not found: $keymapInputFile`n$hint"
}

if (-not (Test-Path -LiteralPath $drawConfigFile)) {
    throw "keymap-drawer config not found: $drawConfigFile"
}

if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$runner = Resolve-KeymapRunner
Write-Host "Using $($runner.Label)"

# -o is used rather than shell redirection: PowerShell's `>` can emit a UTF-8
# BOM, which breaks the YAML read on the draw step.
Write-Host "Parsing ZMK keymap: '$keymapInputFile'"
Invoke-Keymap -Runner $runner -FailureMessage 'keymap parse failed' -Arguments @(
    '-c', $drawConfigFile,
    'parse',
    '-z', $keymapInputFile,
    '-o', $parsedYmlFile
)

Write-Host "Drawing SVG to: '$outputSvgFile'"
Invoke-Keymap -Runner $runner -FailureMessage 'keymap draw failed' -Arguments @(
    '-c', $drawConfigFile,
    'draw', $parsedYmlFile,
    '-o', $outputSvgFile
)

Write-Host 'Done.'
