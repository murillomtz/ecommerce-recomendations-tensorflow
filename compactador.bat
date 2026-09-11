@echo off
setlocal EnableExtensions DisableDelayedExpansion

chcp 65001 >nul 2>&1
title Project Context Generator

set "EXPORT_PROJECT_SCRIPT=%~f0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$p=$env:EXPORT_PROJECT_SCRIPT;" ^
  "$raw=[System.IO.File]::ReadAllText($p);" ^
  "$m=':__POWERSHELL__';" ^
  "$i=$raw.LastIndexOf($m,[System.StringComparison]::Ordinal);" ^
  "if($i -lt 0){throw 'Embedded PowerShell section not found.'};" ^
  "$code=$raw.Substring($i+$m.Length);" ^
  "& ([ScriptBlock]::Create($code))"

set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
    echo Export failed with exit code %EXITCODE%.
)

echo.
pause
exit /b %EXITCODE%


:__POWERSHELL__

# =====================================================================
# PROJECT CONTEXT GENERATOR
# =====================================================================
#
# This PowerShell code is embedded inside export-project.bat.
#
# The directory containing export-project.bat is ALWAYS considered the
# project root.
#
# Reparse points / symbolic links / junctions are NOT traversed.
# This prevents the exporter from following links outside the project.
#
# =====================================================================


$ErrorActionPreference = 'Stop'

try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
}
catch {
    # Ignore console encoding errors.
}


# =====================================================================
# CONFIGURATION
# =====================================================================

# Maximum size of a TEXT file that may be included in PROJECT_CONTEXT.md.
#
# Examples:
#
#   512KB
#   1MB
#   2MB
#   5MB
#
$MAX_FILE_SIZE_BYTES = 1MB


# Directories listed here are displayed in the directory tree,
# but their contents are NOT traversed or exported.
#
$EXCLUDED_DIRECTORIES = @(
    '.git',
    '.idea',
    '.vscode',
    'node_modules',
    'target',
    'build',
    'dist',
    'out',
    'coverage',
    '.gradle',
    '.next',
    '.angular'
)


# Exact file names considered sensitive.
#
$SENSITIVE_EXACT_NAMES = @(
    '.env',
    'id_rsa',
    'id_ed25519',
    'credentials.json'
)


# Sensitive file-name patterns.
#
# PowerShell wildcard syntax is used.
#
$SENSITIVE_NAME_PATTERNS = @(
    '.env.*'
)


# Sensitive extensions.
#
$SENSITIVE_EXTENSIONS = @(
    '.pem',
    '.key',
    '.p12',
    '.pfx'
)


# Extensions known to normally contain binary data.
#
$BINARY_EXTENSIONS = @(
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.bmp',
    '.tif',
    '.tiff',
    '.ico',
    '.svgz',

    '.pdf',

    '.zip',
    '.rar',
    '.7z',
    '.tar',
    '.gz',
    '.gzip',
    '.bz2',
    '.xz',

    '.jar',
    '.war',
    '.ear',

    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.bin',
    '.dat',

    '.class',
    '.pyc',
    '.pyo',

    '.p12',
    '.pfx',
    '.jks',

    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.eot',

    '.mp3',
    '.wav',
    '.ogg',
    '.flac',
    '.aac',
    '.m4a',

    '.mp4',
    '.avi',
    '.mov',
    '.mkv',
    '.webm',
    '.wmv',

    '.db',
    '.sqlite',
    '.sqlite3',

    '.wasm',

    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx'
)


# Number of bytes used when checking an unknown file
# to determine whether it is probably text or binary.
#
$BINARY_DETECTION_SAMPLE_SIZE = 8192


# =====================================================================
# INTERNAL PATHS
# =====================================================================

$scriptPath = [System.IO.Path]::GetFullPath(
    $env:EXPORT_PROJECT_SCRIPT
)

$rootFull = [System.IO.Path]::GetDirectoryName(
    $scriptPath
)

$rootFull = [System.IO.Path]::GetFullPath(
    $rootFull
)

$separator = [System.IO.Path]::DirectorySeparatorChar

if ($rootFull.EndsWith($separator.ToString())) {
    $rootPrefix = $rootFull
}
else {
    $rootPrefix = $rootFull + $separator
}

$outputPath = Join-Path $rootFull 'PROJECT_CONTEXT.md'


$projectName = Split-Path -Leaf $rootFull

if ([string]::IsNullOrWhiteSpace($projectName)) {
    $projectName = $rootFull
}


# =====================================================================
# HELPERS
# =====================================================================

function New-CaseInsensitiveSet {
    param(
        [string[]]$Values
    )

    $set = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )

    foreach ($value in $Values) {
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $null = $set.Add($value)
        }
    }

    return $set
}


$ExcludedDirectorySet = New-CaseInsensitiveSet $EXCLUDED_DIRECTORIES
$SensitiveExactNameSet = New-CaseInsensitiveSet $SENSITIVE_EXACT_NAMES
$SensitiveExtensionSet = New-CaseInsensitiveSet $SENSITIVE_EXTENSIONS
$BinaryExtensionSet = New-CaseInsensitiveSet $BINARY_EXTENSIONS


function Test-SamePath {
    param(
        [string]$PathA,
        [string]$PathB
    )

    try {
        $a = [System.IO.Path]::GetFullPath($PathA)
        $b = [System.IO.Path]::GetFullPath($PathB)

        return [string]::Equals(
            $a,
            $b,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    }
    catch {
        return $false
    }
}


function Test-IsInsideProject {
    param(
        [string]$Path
    )

    try {
        $fullPath = [System.IO.Path]::GetFullPath($Path)

        if (
            [string]::Equals(
                $fullPath,
                $rootFull,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        ) {
            return $true
        }

        return $fullPath.StartsWith(
            $rootPrefix,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    }
    catch {
        return $false
    }
}


function Test-IsExporterArtifact {
    param(
        [string]$Path
    )

    if (Test-SamePath $Path $scriptPath) {
        return $true
    }

    if (Test-SamePath $Path $outputPath) {
        return $true
    }

    return $false
}


function Get-RelativeDisplayPath {
    param(
        [string]$FullPath
    )

    $normalized = [System.IO.Path]::GetFullPath($FullPath)

    if (-not (Test-IsInsideProject $normalized)) {
        throw 'Attempt to access a path outside the project root was blocked.'
    }

    if (
        [string]::Equals(
            $normalized,
            $rootFull,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    ) {
        return '.'
    }

    $relative = $normalized.Substring($rootPrefix.Length)

    return $relative.Replace('\', '/')
}


function Test-IsReparsePoint {
    param(
        [System.IO.FileSystemInfo]$Item
    )

    try {
        return (
            (
                $Item.Attributes -band
                [System.IO.FileAttributes]::ReparsePoint
            ) -ne 0
        )
    }
    catch {
        return $false
    }
}


function Test-IsSensitiveFile {
    param(
        [System.IO.FileInfo]$File
    )

    $name = $File.Name

    if ($SensitiveExactNameSet.Contains($name)) {
        return $true
    }

    foreach ($pattern in $SENSITIVE_NAME_PATTERNS) {
        if ($name -like $pattern) {
            return $true
        }
    }

    $extension = $File.Extension

    if (
        -not [string]::IsNullOrWhiteSpace($extension) -and
        $SensitiveExtensionSet.Contains($extension)
    ) {
        return $true
    }

    return $false
}


function Test-HasTextBom {
    param(
        [byte[]]$Bytes,
        [int]$Count
    )

    if ($Count -ge 4) {

        # UTF-32 LE
        if (
            $Bytes[0] -eq 0xFF -and
            $Bytes[1] -eq 0xFE -and
            $Bytes[2] -eq 0x00 -and
            $Bytes[3] -eq 0x00
        ) {
            return $true
        }

        # UTF-32 BE
        if (
            $Bytes[0] -eq 0x00 -and
            $Bytes[1] -eq 0x00 -and
            $Bytes[2] -eq 0xFE -and
            $Bytes[3] -eq 0xFF
        ) {
            return $true
        }
    }

    if ($Count -ge 3) {

        # UTF-8 BOM
        if (
            $Bytes[0] -eq 0xEF -and
            $Bytes[1] -eq 0xBB -and
            $Bytes[2] -eq 0xBF
        ) {
            return $true
        }
    }

    if ($Count -ge 2) {

        # UTF-16 LE
        if (
            $Bytes[0] -eq 0xFF -and
            $Bytes[1] -eq 0xFE
        ) {
            return $true
        }

        # UTF-16 BE
        if (
            $Bytes[0] -eq 0xFE -and
            $Bytes[1] -eq 0xFF
        ) {
            return $true
        }
    }

    return $false
}


function Test-IsProbablyBinary {
    param(
        [System.IO.FileInfo]$File
    )

    $extension = $File.Extension

    if (
        -not [string]::IsNullOrWhiteSpace($extension) -and
        $BinaryExtensionSet.Contains($extension)
    ) {
        return $true
    }


    $buffer = New-Object byte[] $BINARY_DETECTION_SAMPLE_SIZE

    $stream = $null

    try {
        $sharing =
            [System.IO.FileShare]::ReadWrite -bor
            [System.IO.FileShare]::Delete

        $stream = [System.IO.File]::Open(
            $File.FullName,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            $sharing
        )

        $count = $stream.Read(
            $buffer,
            0,
            $buffer.Length
        )
    }
    finally {
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }


    if ($count -eq 0) {
        return $false
    }


    # BOMs indicate textual encodings.
    if (Test-HasTextBom $buffer $count) {
        return $false
    }


    # NUL bytes are a strong binary indicator when no textual BOM exists.
    for ($i = 0; $i -lt $count; $i++) {
        if ($buffer[$i] -eq 0) {
            return $true
        }
    }


    # Count suspicious control characters.
    $controlCharacters = 0

    for ($i = 0; $i -lt $count; $i++) {

        $b = $buffer[$i]

        $isAllowedControl =
            ($b -eq 9)  -or
            ($b -eq 10) -or
            ($b -eq 13)

        if (
            $b -lt 32 -and
            -not $isAllowedControl
        ) {
            $controlCharacters++
        }
    }


    $controlRatio = $controlCharacters / [double]$count

    if ($controlRatio -gt 0.10) {
        return $true
    }


    # Try strict UTF-8 validation.
    #
    # A failure does NOT immediately mean binary because older source files
    # may use Windows-1252 or another local code page.
    try {
        $strictUtf8 = [System.Text.UTF8Encoding]::new(
            $false,
            $true
        )

        $null = $strictUtf8.GetString(
            $buffer,
            0,
            $count
        )

        return $false
    }
    catch {
        # Continue with a heuristic suitable for ANSI text.
    }


    $printable = 0

    for ($i = 0; $i -lt $count; $i++) {

        $b = $buffer[$i]

        if (
            $b -eq 9  -or
            $b -eq 10 -or
            $b -eq 13 -or
            $b -ge 32
        ) {
            $printable++
        }
    }


    $printableRatio = $printable / [double]$count

    if ($printableRatio -ge 0.85) {
        return $false
    }

    return $true
}


function Convert-BytesToText {
    param(
        [byte[]]$Bytes
    )

    if ($Bytes.Length -eq 0) {
        return ''
    }


    # UTF-32 LE
    if (
        $Bytes.Length -ge 4 -and
        $Bytes[0] -eq 0xFF -and
        $Bytes[1] -eq 0xFE -and
        $Bytes[2] -eq 0x00 -and
        $Bytes[3] -eq 0x00
    ) {
        $encoding = [System.Text.UTF32Encoding]::new(
            $false,
            $true,
            $true
        )

        return $encoding.GetString(
            $Bytes,
            4,
            $Bytes.Length - 4
        )
    }


    # UTF-32 BE
    if (
        $Bytes.Length -ge 4 -and
        $Bytes[0] -eq 0x00 -and
        $Bytes[1] -eq 0x00 -and
        $Bytes[2] -eq 0xFE -and
        $Bytes[3] -eq 0xFF
    ) {
        $encoding = [System.Text.UTF32Encoding]::new(
            $true,
            $true,
            $true
        )

        return $encoding.GetString(
            $Bytes,
            4,
            $Bytes.Length - 4
        )
    }


    # UTF-8 BOM
    if (
        $Bytes.Length -ge 3 -and
        $Bytes[0] -eq 0xEF -and
        $Bytes[1] -eq 0xBB -and
        $Bytes[2] -eq 0xBF
    ) {
        $encoding = [System.Text.UTF8Encoding]::new(
            $false,
            $true
        )

        return $encoding.GetString(
            $Bytes,
            3,
            $Bytes.Length - 3
        )
    }


    # UTF-16 LE
    if (
        $Bytes.Length -ge 2 -and
        $Bytes[0] -eq 0xFF -and
        $Bytes[1] -eq 0xFE
    ) {
        return [System.Text.Encoding]::Unicode.GetString(
            $Bytes,
            2,
            $Bytes.Length - 2
        )
    }


    # UTF-16 BE
    if (
        $Bytes.Length -ge 2 -and
        $Bytes[0] -eq 0xFE -and
        $Bytes[1] -eq 0xFF
    ) {
        return [System.Text.Encoding]::BigEndianUnicode.GetString(
            $Bytes,
            2,
            $Bytes.Length - 2
        )
    }


    # Prefer strict UTF-8.
    try {
        $strictUtf8 = [System.Text.UTF8Encoding]::new(
            $false,
            $true
        )

        return $strictUtf8.GetString($Bytes)
    }
    catch {
        # Fall back to the Windows ANSI code page.
        return [System.Text.Encoding]::Default.GetString($Bytes)
    }
}


function Read-TextFile {
    param(
        [System.IO.FileInfo]$File
    )

    $bytes = [System.IO.File]::ReadAllBytes(
        $File.FullName
    )

    return Convert-BytesToText $bytes
}


function Get-LanguageTag {
    param(
        [System.IO.FileInfo]$File
    )

    $name = $File.Name.ToLowerInvariant()


    switch -Regex ($name) {

        '^dockerfile(\..+)?$' {
            return 'dockerfile'
        }

        '^jenkinsfile$' {
            return 'groovy'
        }

        '^makefile$' {
            return 'makefile'
        }

        '^procfile$' {
            return 'text'
        }

        '^license(\..*)?$' {
            return 'text'
        }

        '^gradlew$' {
            return 'bash'
        }

        '^gradlew\.bat$' {
            return 'bat'
        }

        '^mvnw$' {
            return 'bash'
        }

        '^mvnw\.cmd$' {
            return 'bat'
        }
    }


    $extension = $File.Extension.ToLowerInvariant()


    switch ($extension) {

        '.java' {
            return 'java'
        }

        '.kt' {
            return 'kotlin'
        }

        '.kts' {
            return 'kotlin'
        }

        '.groovy' {
            return 'groovy'
        }

        '.gradle' {
            return 'groovy'
        }


        '.py' {
            return 'python'
        }


        '.js' {
            return 'javascript'
        }

        '.mjs' {
            return 'javascript'
        }

        '.cjs' {
            return 'javascript'
        }

        '.jsx' {
            return 'jsx'
        }


        '.ts' {
            return 'typescript'
        }

        '.mts' {
            return 'typescript'
        }

        '.cts' {
            return 'typescript'
        }

        '.tsx' {
            return 'tsx'
        }


        '.html' {
            return 'html'
        }

        '.htm' {
            return 'html'
        }

        '.css' {
            return 'css'
        }

        '.scss' {
            return 'scss'
        }

        '.sass' {
            return 'sass'
        }

        '.less' {
            return 'less'
        }


        '.vue' {
            return 'vue'
        }

        '.svelte' {
            return 'svelte'
        }


        '.json' {
            return 'json'
        }

        '.jsonc' {
            return 'jsonc'
        }


        '.xml' {
            return 'xml'
        }

        '.xsd' {
            return 'xml'
        }

        '.xsl' {
            return 'xml'
        }

        '.xslt' {
            return 'xml'
        }


        '.yml' {
            return 'yaml'
        }

        '.yaml' {
            return 'yaml'
        }


        '.toml' {
            return 'toml'
        }


        '.ini' {
            return 'ini'
        }

        '.cfg' {
            return 'ini'
        }

        '.conf' {
            return 'text'
        }


        '.properties' {
            return 'properties'
        }


        '.sql' {
            return 'sql'
        }


        '.md' {
            return 'markdown'
        }

        '.markdown' {
            return 'markdown'
        }

        '.mdx' {
            return 'mdx'
        }


        '.txt' {
            return 'text'
        }

        '.log' {
            return 'text'
        }


        '.sh' {
            return 'bash'
        }

        '.bash' {
            return 'bash'
        }

        '.zsh' {
            return 'bash'
        }


        '.ps1' {
            return 'powershell'
        }

        '.psm1' {
            return 'powershell'
        }

        '.psd1' {
            return 'powershell'
        }


        '.bat' {
            return 'bat'
        }

        '.cmd' {
            return 'bat'
        }


        '.c' {
            return 'c'
        }

        '.h' {
            return 'c'
        }

        '.cpp' {
            return 'cpp'
        }

        '.cc' {
            return 'cpp'
        }

        '.cxx' {
            return 'cpp'
        }

        '.hpp' {
            return 'cpp'
        }


        '.cs' {
            return 'csharp'
        }


        '.go' {
            return 'go'
        }


        '.rs' {
            return 'rust'
        }


        '.php' {
            return 'php'
        }


        '.rb' {
            return 'ruby'
        }


        '.swift' {
            return 'swift'
        }


        '.scala' {
            return 'scala'
        }


        '.r' {
            return 'r'
        }


        '.lua' {
            return 'lua'
        }


        '.pl' {
            return 'perl'
        }


        '.graphql' {
            return 'graphql'
        }

        '.gql' {
            return 'graphql'
        }


        '.proto' {
            return 'protobuf'
        }


        '.tf' {
            return 'hcl'
        }

        '.tfvars' {
            return 'hcl'
        }

        '.hcl' {
            return 'hcl'
        }


        '.dockerignore' {
            return 'text'
        }


        '.editorconfig' {
            return 'ini'
        }


        '.csv' {
            return 'csv'
        }


        '.http' {
            return 'http'
        }


        '.feature' {
            return 'gherkin'
        }


        default {
            return 'text'
        }
    }
}


function Get-CodeFence {
    param(
        [string]$Text
    )

    $backtick = ([char]96).ToString()

    $pattern = [System.Text.RegularExpressions.Regex]::Escape(
        $backtick
    ) + '+'

    $maxRun = 0

    foreach (
        $match in
        [System.Text.RegularExpressions.Regex]::Matches(
            $Text,
            $pattern
        )
    ) {
        if ($match.Length -gt $maxRun) {
            $maxRun = $match.Length
        }
    }

    $length = [Math]::Max(
        3,
        $maxRun + 1
    )

    return ($backtick * $length)
}


function Format-InlineCode {
    param(
        [string]$Text
    )

    $backtick = ([char]96).ToString()

    $pattern = [System.Text.RegularExpressions.Regex]::Escape(
        $backtick
    ) + '+'

    $maxRun = 0

    foreach (
        $match in
        [System.Text.RegularExpressions.Regex]::Matches(
            $Text,
            $pattern
        )
    ) {
        if ($match.Length -gt $maxRun) {
            $maxRun = $match.Length
        }
    }

    $delimiter = $backtick * [Math]::Max(
        1,
        $maxRun + 1
    )

    return $delimiter + $Text + $delimiter
}


function Format-FileSize {
    param(
        [long]$Bytes
    )

    $culture = [System.Globalization.CultureInfo]::InvariantCulture

    if ($Bytes -ge 1GB) {
        return [string]::Format(
            $culture,
            '{0:0.##} GB',
            $Bytes / [double]1GB
        )
    }

    if ($Bytes -ge 1MB) {
        return [string]::Format(
            $culture,
            '{0:0.##} MB',
            $Bytes / [double]1MB
        )
    }

    if ($Bytes -ge 1KB) {
        return [string]::Format(
            $culture,
            '{0:0.##} KB',
            $Bytes / [double]1KB
        )
    }

    return "$Bytes bytes"
}


# =====================================================================
# DATA COLLECTION
# =====================================================================

$Files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()

$TreeLines = [System.Collections.Generic.List[string]]::new()


$Stats = [ordered]@{

    FilesDiscovered      = 0

    TextIncluded         = 0

    BinaryOmitted        = 0

    SensitiveOmitted     = 0

    SizeOmitted          = 0

    ReparseFilesOmitted  = 0

    UnableToRead         = 0

    DirectoriesIgnored   = 0

    DirectoryReadErrors  = 0
}


function Scan-Directory {
    param(
        [System.IO.DirectoryInfo]$Directory,
        [string]$Prefix
    )


    if (-not (Test-IsInsideProject $Directory.FullName)) {
        return
    }


    try {
        $items = @(
            $Directory.GetFileSystemInfos()
        )
    }
    catch {

        $Stats.DirectoryReadErrors++

        $TreeLines.Add(
            $Prefix + '└── [unable to enumerate directory]'
        )

        return
    }


    $visibleItems =
        [System.Collections.Generic.List[System.IO.FileSystemInfo]]::new()


    foreach ($item in $items) {

        # The generator itself and its output are not part of the exported
        # project context.
        if (Test-IsExporterArtifact $item.FullName) {
            continue
        }


        # Defensive boundary check.
        if (-not (Test-IsInsideProject $item.FullName)) {
            continue
        }


        $visibleItems.Add($item)
    }


    $sortedItems = @(
        $visibleItems |
        Sort-Object `
            @{
                Expression = {
                    if ($_ -is [System.IO.DirectoryInfo]) {
                        0
                    }
                    else {
                        1
                    }
                }
            },
            @{
                Expression = {
                    $_.Name.ToLowerInvariant()
                }
            }
    )


    for ($index = 0; $index -lt $sortedItems.Count; $index++) {

        $item = $sortedItems[$index]

        $isLast = (
            $index -eq ($sortedItems.Count - 1)
        )


        if ($isLast) {
            $branch = '└── '
            $childPrefix = $Prefix + '    '
        }
        else {
            $branch = '├── '
            $childPrefix = $Prefix + '│   '
        }


        if ($item -is [System.IO.DirectoryInfo]) {

            $directory = [System.IO.DirectoryInfo]$item

            $isExcluded =
                $ExcludedDirectorySet.Contains(
                    $directory.Name
                )

            $isReparse =
                Test-IsReparsePoint $directory


            if ($isExcluded) {

                $TreeLines.Add(
                    $Prefix +
                    $branch +
                    $directory.Name +
                    '/ [excluded]'
                )

                $Stats.DirectoriesIgnored++

                continue
            }


            if ($isReparse) {

                $TreeLines.Add(
                    $Prefix +
                    $branch +
                    $directory.Name +
                    '/ [reparse point - not traversed]'
                )

                $Stats.DirectoriesIgnored++

                continue
            }


            $TreeLines.Add(
                $Prefix +
                $branch +
                $directory.Name +
                '/'
            )


            Scan-Directory `
                -Directory $directory `
                -Prefix $childPrefix
        }
        else {

            $file = [System.IO.FileInfo]$item


            if (Test-IsReparsePoint $file) {
                $TreeLines.Add(
                    $Prefix +
                    $branch +
                    $file.Name +
                    ' [reparse point]'
                )
            }
            else {
                $TreeLines.Add(
                    $Prefix +
                    $branch +
                    $file.Name
                )
            }


            $Files.Add($file)

            $Stats.FilesDiscovered++
        }
    }
}


# =====================================================================
# TERMINAL HEADER
# =====================================================================

Write-Host ''
Write-Host '========================================'
Write-Host ' Project Context Generator'
Write-Host '========================================'
Write-Host ''
Write-Host 'Project:'
Write-Host $rootFull
Write-Host ''
Write-Host 'Scanning project...'
Write-Host ''


# =====================================================================
# SCAN PROJECT
# =====================================================================

$rootDirectory = [System.IO.DirectoryInfo]::new(
    $rootFull
)

Scan-Directory `
    -Directory $rootDirectory `
    -Prefix ''


# =====================================================================
# PREPARE OUTPUT
# =====================================================================

Write-Host 'Generating PROJECT_CONTEXT.md...'
Write-Host ''


# If PROJECT_CONTEXT.md happens to be a symbolic link/reparse point,
# remove the link before creating the output.
#
# This prevents writing through a link that could point outside
# the project root.
#
if ([System.IO.File]::Exists($outputPath)) {

    try {
        $attributes = [System.IO.File]::GetAttributes(
            $outputPath
        )

        if (
            (
                $attributes -band
                [System.IO.FileAttributes]::ReparsePoint
            ) -ne 0
        ) {
            Remove-Item `
                -LiteralPath $outputPath `
                -Force
        }
    }
    catch {
        throw 'Unable to safely prepare PROJECT_CONTEXT.md.'
    }
}


$Utf8WithoutBom = [System.Text.UTF8Encoding]::new(
    $false
)

$writer = $null


try {

    $writer = [System.IO.StreamWriter]::new(
        $outputPath,
        $false,
        $Utf8WithoutBom
    )


    # ================================================================
    # HEADER
    # ================================================================

    $writer.WriteLine('# PROJECT CONTEXT')
    $writer.WriteLine()

    $writer.WriteLine(
        'Generated automatically.'
    )

    $writer.WriteLine()


    # ================================================================
    # PROJECT ROOT
    # ================================================================

    $writer.WriteLine('## Project Root')
    $writer.WriteLine()

	$writer.WriteLine(
		(Format-InlineCode $projectName)
	)

    $writer.WriteLine()


    # ================================================================
    # GENERATION INFORMATION
    # ================================================================

    $writer.WriteLine('## Generation Information')
    $writer.WriteLine()

    $writer.WriteLine(
        '- Generated: ' +
        (Get-Date).ToString(
            'yyyy-MM-dd HH:mm:ss zzz'
        )
    )

    $writer.WriteLine(
        '- Maximum text file size: ' +
        (Format-FileSize $MAX_FILE_SIZE_BYTES)
    )

    $writer.WriteLine(
        '- Reparse points / symbolic links / junctions are not followed.'
    )

    $writer.WriteLine(
        '- Generator file and PROJECT_CONTEXT.md are excluded.'
    )

    $writer.WriteLine()


    # ================================================================
    # DIRECTORY STRUCTURE
    # ================================================================

    $writer.WriteLine('## Directory Structure')
    $writer.WriteLine()

    $writer.WriteLine('```text')

    $writer.WriteLine(
        $projectName + '/'
    )


    foreach ($treeLine in $TreeLines) {
        $writer.WriteLine($treeLine)
    }


    $writer.WriteLine('```')
    $writer.WriteLine()


    # ================================================================
    # FILE CONTENTS
    # ================================================================

    $writer.WriteLine('# FILE CONTENTS')
    $writer.WriteLine()


    foreach ($scannedFile in $Files) {

        $relativePath = $null


        try {

            # Recreate FileInfo to reduce the chance of using stale metadata.
            $file = [System.IO.FileInfo]::new(
                $scannedFile.FullName
            )


            if (-not (Test-IsInsideProject $file.FullName)) {
                continue
            }


            $relativePath =
                Get-RelativeDisplayPath $file.FullName


            $inlinePath =
                Format-InlineCode $relativePath


            $writer.WriteLine('---')
            $writer.WriteLine()

            $writer.WriteLine(
                '## File: ' + $inlinePath
            )

            $writer.WriteLine()

            $writer.WriteLine(
                '**Path:** ' + $inlinePath
            )

            $writer.WriteLine()


            # --------------------------------------------------------
            # File disappeared
            # --------------------------------------------------------

            if (-not [System.IO.File]::Exists($file.FullName)) {

                $Stats.UnableToRead++

                $writer.WriteLine(
                    'Unable to read file.'
                )

                $writer.WriteLine()

                continue
            }


            $file.Refresh()


            # --------------------------------------------------------
            # Reparse point / symlink
            # --------------------------------------------------------

            if (Test-IsReparsePoint $file) {

                $Stats.ReparseFilesOmitted++

                $writer.WriteLine(
                    'Reparse point - content omitted for safety.'
                )

                $writer.WriteLine()

                continue
            }


            # --------------------------------------------------------
            # Sensitive
            # --------------------------------------------------------

            if (Test-IsSensitiveFile $file) {

                $Stats.SensitiveOmitted++

                $writer.WriteLine(
                    'Sensitive file - content omitted.'
                )

                $writer.WriteLine()

                continue
            }


            # --------------------------------------------------------
            # Binary detection
            # --------------------------------------------------------

            $isBinary = $false

            try {
                $isBinary =
                    Test-IsProbablyBinary $file
            }
            catch {

                $Stats.UnableToRead++

                $writer.WriteLine(
                    'Unable to read file.'
                )

                $writer.WriteLine()

                continue
            }


            if ($isBinary) {

                $Stats.BinaryOmitted++

                $writer.WriteLine(
                    'Binary file - content omitted.'
                )

                $writer.WriteLine()

                continue
            }


            # --------------------------------------------------------
            # Maximum size
            # --------------------------------------------------------

            try {
                $file.Refresh()
                $fileSize = $file.Length
            }
            catch {

                $Stats.UnableToRead++

                $writer.WriteLine(
                    'Unable to read file.'
                )

                $writer.WriteLine()

                continue
            }


            if ($fileSize -gt $MAX_FILE_SIZE_BYTES) {

                $Stats.SizeOmitted++

                $writer.WriteLine(
                    'File omitted because it exceeds the configured maximum size.'
                )

                $writer.WriteLine()

                $writer.WriteLine(
                    'Size: ' +
                    (Format-FileSize $fileSize)
                )

                $writer.WriteLine()

                continue
            }


            # --------------------------------------------------------
            # Read text
            # --------------------------------------------------------

            try {
                $content = Read-TextFile $file
            }
            catch {

                $Stats.UnableToRead++

                $writer.WriteLine(
                    'Unable to read file.'
                )

                $writer.WriteLine()

                continue
            }


            $language =
                Get-LanguageTag $file


            $fence =
                Get-CodeFence $content


            $Stats.TextIncluded++


            $writer.WriteLine(
                $fence + $language
            )


            if ($content.Length -gt 0) {

                $writer.Write($content)


                if (
                    -not $content.EndsWith("`n") -and
                    -not $content.EndsWith("`r")
                ) {
                    $writer.WriteLine()
                }
            }


            $writer.WriteLine($fence)
            $writer.WriteLine()
        }
        catch {

            # If the heading was not yet written, try to create a generic
            # entry without exposing an absolute path.
            try {

                if ($null -eq $relativePath) {
                    $relativePath =
                        Get-RelativeDisplayPath $scannedFile.FullName

                    $inlinePath =
                        Format-InlineCode $relativePath

                    $writer.WriteLine('---')
                    $writer.WriteLine()

                    $writer.WriteLine(
                        '## File: ' + $inlinePath
                    )

                    $writer.WriteLine()

                    $writer.WriteLine(
                        '**Path:** ' + $inlinePath
                    )

                    $writer.WriteLine()
                }


                $Stats.UnableToRead++

                $writer.WriteLine(
                    'Unable to read file.'
                )

                $writer.WriteLine()
            }
            catch {
                # Continue with remaining files.
            }
        }
    }


    # ================================================================
    # SUMMARY
    # ================================================================

    $writer.WriteLine('---')
    $writer.WriteLine()

    $writer.WriteLine('## Export Summary')
    $writer.WriteLine()

    $writer.WriteLine(
        'Files discovered: ' +
        $Stats.FilesDiscovered
    )

    $writer.WriteLine(
        'Text files included: ' +
        $Stats.TextIncluded
    )

    $writer.WriteLine(
        'Binary files omitted: ' +
        $Stats.BinaryOmitted
    )

    $writer.WriteLine(
        'Sensitive files omitted: ' +
        $Stats.SensitiveOmitted
    )

    $writer.WriteLine(
        'Files ignored because of size: ' +
        $Stats.SizeOmitted
    )

    $writer.WriteLine(
        'Reparse-point files omitted: ' +
        $Stats.ReparseFilesOmitted
    )

    $writer.WriteLine(
        'Unable to read files: ' +
        $Stats.UnableToRead
    )

    $writer.WriteLine(
        'Directories ignored: ' +
        $Stats.DirectoriesIgnored
    )

    $writer.WriteLine(
        'Directory read errors: ' +
        $Stats.DirectoryReadErrors
    )

    $writer.WriteLine()
}
finally {

    if ($null -ne $writer) {
        $writer.Flush()
        $writer.Dispose()
    }
}


# =====================================================================
# TERMINAL SUMMARY
# =====================================================================

Write-Host (
    $Stats.FilesDiscovered.ToString() +
    ' files discovered.'
)

Write-Host (
    $Stats.TextIncluded.ToString() +
    ' text files exported.'
)


if ($Stats.BinaryOmitted -gt 0) {

    Write-Host (
        $Stats.BinaryOmitted.ToString() +
        ' binary files omitted.'
    )
}


if ($Stats.SensitiveOmitted -gt 0) {

    Write-Host (
        $Stats.SensitiveOmitted.ToString() +
        ' sensitive files omitted.'
    )
}


if ($Stats.SizeOmitted -gt 0) {

    Write-Host (
        $Stats.SizeOmitted.ToString() +
        ' oversized files omitted.'
    )
}


if ($Stats.ReparseFilesOmitted -gt 0) {

    Write-Host (
        $Stats.ReparseFilesOmitted.ToString() +
        ' reparse-point files omitted.'
    )
}


if ($Stats.UnableToRead -gt 0) {

    Write-Host (
        $Stats.UnableToRead.ToString() +
        ' files could not be read.'
    )
}


if ($Stats.DirectoriesIgnored -gt 0) {

    Write-Host (
        $Stats.DirectoriesIgnored.ToString() +
        ' directories ignored.'
    )
}


if ($Stats.DirectoryReadErrors -gt 0) {

    Write-Host (
        $Stats.DirectoryReadErrors.ToString() +
        ' directories could not be enumerated.'
    )
}


Write-Host ''
Write-Host 'PROJECT_CONTEXT.md created successfully.'
Write-Host ''

exit 0