param(
    [ValidateSet('list', 'import', 'remove')][string]$Action = 'list',
    [string]$PathsJson = '[]'
)
$ErrorActionPreference = 'Stop'
trap {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$root = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'sounds\library'
[void][System.IO.Directory]::CreateDirectory($root)

function Assert-Mp3([string]$path) {
    $file = Get-Item -LiteralPath $path
    if ($file.PSIsContainer -or $file.Extension -ine '.mp3' -or $file.Length -lt 3 -or $file.Length -gt 20MB) {
        throw 'Choose an MP3 file smaller than 20 MB.'
    }
    $stream = [System.IO.File]::OpenRead($file.FullName)
    try {
        $a = $stream.ReadByte(); $b = $stream.ReadByte(); $c = $stream.ReadByte()
        if (!(($a -eq 73 -and $b -eq 68 -and $c -eq 51) -or ($a -eq 255 -and ($b -band 224) -eq 224))) {
            throw 'The file does not have an MP3 header.'
        }
    } finally { $stream.Dispose() }
}

function Read-CompatibleMp3([string]$path) {
    Assert-Mp3 $path
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 10 -and $bytes[0] -eq 73 -and $bytes[1] -eq 68 -and $bytes[2] -eq 51 -and $bytes[3] -eq 4) {
        # Windows MCI rejects ID3v2.4 metadata; the MP3 audio frames need no re-encoding.
        $offset = 10
        $size = 0
        for ($i = 6; $i -lt 10; $i++) {
            if ($bytes[$i] -ge 128) { throw 'The MP3 metadata has an invalid size.' }
            $size = ($size -shl 7) -bor $bytes[$i]
        }
        $offset += $size
        if (($bytes[5] -band 16) -ne 0) { $offset += 10 }
        if ($offset -ge $bytes.Length) { throw 'The MP3 metadata is incomplete or contains no audio.' }
        $audio = New-Object byte[] ($bytes.Length - $offset)
        [Array]::Copy($bytes, $offset, $audio, 0, $audio.Length)
        return ,$audio
    }
    return ,$bytes
}

$decoded = ConvertFrom-Json -InputObject $PathsJson
$paths = @($decoded)
if ($Action -eq 'import') {
    if ($paths.Count -eq 0) {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        try {
            $dialog.Title = 'Add sounds to Herdr'
            $dialog.Filter = 'MP3 audio (*.mp3)|*.mp3'
            $dialog.Multiselect = $true
            if ($dialog.ShowDialog() -eq 'OK') { $paths = @($dialog.FileNames) }
            else { $paths = @() }
        } finally { $dialog.Dispose() }
    }
    foreach ($path in $paths) { Assert-Mp3 $path }
    foreach ($path in $paths) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($path)
        $name = $name -replace '^[a-f0-9]{32}--', ''
        $target = Join-Path $root (([guid]::NewGuid().ToString('N')) + '--' + $name + '.mp3')
        [System.IO.File]::WriteAllBytes($target, (Read-CompatibleMp3 $path))
    }
}
if ($Action -eq 'remove') {
    foreach ($path in $paths) {
        $full = [System.IO.Path]::GetFullPath($path)
        if ([System.IO.Path]::GetDirectoryName($full) -ine $root -or [System.IO.Path]::GetExtension($full) -ine '.mp3') {
            throw 'Only files in this sound library can be removed.'
        }
        Remove-Item -LiteralPath $full
    }
}
$items = @(Get-ChildItem -LiteralPath $root -Filter '*.mp3' -File | ForEach-Object {
    @{ name = ($_.BaseName -replace '^[a-f0-9]{32}--', ''); path = $_.FullName }
} | Sort-Object { $_.name })
ConvertTo-Json -InputObject $items -Compress
