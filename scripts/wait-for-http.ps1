param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [Parameter(Mandatory = $true)]
    [uri]$Uri,

    [ValidateRange(1, 600)]
    [int]$TimeoutSeconds = 60
)

$timer = [System.Diagnostics.Stopwatch]::StartNew()
$lastProgress = 0
$lastError = "No response yet"

Write-Host "Waiting up to $TimeoutSeconds seconds for $ServiceName at $Uri..."

while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 1
        if ($response.StatusCode -eq 200) {
            Write-Host "$ServiceName is ready ($([int]$timer.Elapsed.TotalSeconds)s)."
            exit 0
        }

        $lastError = "HTTP status $($response.StatusCode)"
    }
    catch {
        $lastError = $_.Exception.Message
    }

    $elapsed = [int]$timer.Elapsed.TotalSeconds
    if ($elapsed -ge $lastProgress + 5) {
        Write-Host "Still waiting for $ServiceName ($elapsed/$TimeoutSeconds s)..."
        $lastProgress = $elapsed
    }

    Start-Sleep -Seconds 1
}

Write-Error "$ServiceName did not respond within $TimeoutSeconds seconds at $Uri. Last error: $lastError"
exit 1
