#!/usr/bin/env pwsh
<#!
.SYNOPSIS
    Remove generated datasets, caches, and other large artifacts.
.DESCRIPTION
    Deletes common cache folders (temp, jobs cache/logs/raw, output) and,
    unless -KeepDatasets is provided, wipes dataset directories as well.
    Use -DryRun to preview what would be removed.
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$KeepDatasets
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$commonDirs = @(
    'backend/temp',
    'temp',
    'jobs/cache',
    'jobs/logs',
    'jobs/raw',
    'output'
)

$datasetDirs = @('backend/dataset', 'dataset')
if (-not $KeepDatasets) {
    $dirsToRemove = $commonDirs + $datasetDirs
} else {
    $dirsToRemove = $commonDirs
}

$filesToRemove = @(
    'backend/temp/jobs.json',
    'temp/jobs.json'
)

function Remove-Target {
    param(
        [string]$RelativePath,
        [switch]$IsDirectory
    )

    $fullPath = Join-Path $root $RelativePath
    if (-not (Test-Path $fullPath)) {
        Write-Host "[skip] $RelativePath (missing)" -ForegroundColor DarkGray
        return
    }

    if ($DryRun) {
        $kind = $IsDirectory ? 'dir' : 'file'
        Write-Host "[dry-run] would remove $($kind): $RelativePath" -ForegroundColor Yellow
        return
    }

    try {
        if ($IsDirectory) {
            Remove-Item -LiteralPath $fullPath -Recurse -Force
        } else {
            Remove-Item -LiteralPath $fullPath -Force
        }
        Write-Host "[removed] $RelativePath" -ForegroundColor Green
    }
    catch {
        Write-Host ([string]::Format("[error] Failed to remove {0}: {1}", $RelativePath, $_.Exception.Message)) -ForegroundColor Red
    }
}

Write-Host "🧹 StreamCraft clean-up" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "Running in dry-run mode; no files will be deleted." -ForegroundColor Yellow
}
if ($KeepDatasets) {
    Write-Host "Datasets will be preserved (use without -KeepDatasets to remove them)." -ForegroundColor Yellow
}

foreach ($dir in $dirsToRemove | Sort-Object -Unique) {
    Remove-Target -RelativePath $dir -IsDirectory
}

foreach ($file in $filesToRemove | Sort-Object -Unique) {
    Remove-Target -RelativePath $file
}

Write-Host "Done." -ForegroundColor Cyan
