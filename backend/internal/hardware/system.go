package hardware

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"math"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// SystemInfo contains only the machine information needed for a local model
// memory estimate. GPU memory is reported only when nvidia-smi can measure it.
type SystemInfo struct {
	CPU         string      `json:"cpu"`
	CPUCores    int         `json:"cpu_cores"`
	CPUThreads  int         `json:"cpu_threads"`
	TotalRAMGiB float64     `json:"total_ram_gib"`
	GPUs        []string    `json:"gpus"`
	NvidiaGPUs  []NvidiaGPU `json:"nvidia_gpus,omitempty"`
}

type NvidiaGPU struct {
	Name         string  `json:"name"`
	TotalVRAMGiB float64 `json:"total_vram_gib"`
}

type windowsInfo struct {
	TotalRAMBytes float64  `json:"total_ram_bytes"`
	CPU           string   `json:"cpu"`
	CPUCores      int      `json:"cpu_cores"`
	CPUThreads    int      `json:"cpu_threads"`
	GPUs          []string `json:"gpus"`
}

const bytesPerGiB = 1024 * 1024 * 1024

// Inspect reads hardware details on demand. It does not run in the background.
func Inspect(ctx context.Context) (SystemInfo, error) {
	if runtime.GOOS != "windows" {
		return SystemInfo{}, errors.New("system inspection is currently supported on Windows")
	}

	scanCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	const script = `$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $computer = Get-CimInstance -ClassName Win32_ComputerSystem; $processors = @(Get-CimInstance -ClassName Win32_Processor); $processor = $processors | Select-Object -First 1; $cpuCores = ($processors | Measure-Object -Property NumberOfCores -Sum).Sum; $cpuThreads = ($processors | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum; $graphics = @((Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name } | ForEach-Object { [string]$_.Name } | Select-Object -Unique)); [PSCustomObject]@{ total_ram_bytes = [double]$computer.TotalPhysicalMemory; cpu = [string]$processor.Name; cpu_cores = [int]$cpuCores; cpu_threads = [int]$cpuThreads; gpus = [string[]]$graphics } | ConvertTo-Json -Compress`
	cmd := exec.CommandContext(scanCtx, "powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script)
	output, err := cmd.Output()
	if err != nil {
		return SystemInfo{}, errors.New("could not read system information")
	}

	var raw windowsInfo
	if err := json.Unmarshal(output, &raw); err != nil {
		return SystemInfo{}, errors.New("system information was returned in an unsupported format")
	}
	if raw.TotalRAMBytes <= 0 {
		return SystemInfo{}, errors.New("system memory could not be detected")
	}
	if raw.GPUs == nil {
		raw.GPUs = []string{}
	}

	info := SystemInfo{
		CPU:         strings.TrimSpace(raw.CPU),
		CPUCores:    raw.CPUCores,
		CPUThreads:  raw.CPUThreads,
		TotalRAMGiB: roundGiB(raw.TotalRAMBytes / bytesPerGiB),
		GPUs:        raw.GPUs,
		NvidiaGPUs:  inspectNvidiaGPUs(scanCtx),
	}
	return info, nil
}

func inspectNvidiaGPUs(ctx context.Context) []NvidiaGPU {
	cmd := exec.CommandContext(ctx, "nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits")
	output, err := cmd.Output()
	if err != nil {
		return nil
	}

	reader := csv.NewReader(strings.NewReader(string(output)))
	var gpus []NvidiaGPU
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil || len(record) != 2 {
			return nil
		}
		totalMB, totalErr := strconv.ParseFloat(strings.TrimSpace(record[1]), 64)
		if totalErr != nil {
			return nil
		}
		gpus = append(gpus, NvidiaGPU{
			Name:         strings.TrimSpace(record[0]),
			TotalVRAMGiB: roundGiB(totalMB / 1024),
		})
	}
	return gpus
}

func roundGiB(value float64) float64 {
	return math.Round(value*10) / 10
}
