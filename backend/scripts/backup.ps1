param(
  [Parameter(Mandatory=$true)][string]$MongoConfig,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Database,
  [Parameter(Mandatory=$true)][string]$UploadsDirectory,
  [Parameter(Mandatory=$true)][string]$BackupDirectory
)
$ErrorActionPreference = 'Stop'
$uploads = (Resolve-Path -LiteralPath $UploadsDirectory).Path
New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$backupRoot = (Resolve-Path -LiteralPath $BackupDirectory).Path
if ($backupRoot -eq $uploads -or $backupRoot.StartsWith($uploads + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'El respaldo debe guardarse fuera de uploads.'
}
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N')
$destination = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Path $destination | Out-Null
$archive = Join-Path $destination 'mongodb.archive.gz'
# MongoConfig is an external restricted-access Database Tools YAML file; credentials never enter arguments or logs.
& mongodump --config $MongoConfig --db $Database --archive=$archive --gzip
if ($LASTEXITCODE -ne 0) { throw 'Fallo mongodump. Respaldo incompleto.' }
$files = Join-Path $destination 'uploads.tar'
& tar -cf $files -C $uploads .
if ($LASTEXITCODE -ne 0) { throw 'Fallo respaldo de archivos. Respaldo incompleto.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $archive,$files | Select-Object Hash,Path | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $destination 'manifest.json')
Write-Output ('Respaldo terminado: ' + $destination)
