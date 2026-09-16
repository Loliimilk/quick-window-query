import os
import subprocess
import json
import psutil
import requests
from tqdm import tqdm

MODELS_DIR = "models"

MODELS = {
    "low": {
        "name": "Qwen2.5-1.5B-Instruct-Q4.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "min_ram_gb": 4,
        "min_vram_gb": 2,
        "desc": "simple model (basic translation and rules)"
    },
    "mid": {
        "name": "Llama-3.1-8B-Instruct-Q4.gguf",
        "url": "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
        "min_ram_gb": 16,
        "min_vram_gb": 6,
        "desc": "Optimal model  (Excellent tutor)"
    },
    "high": {
        "name": "Qwen2.5-32B-Instruct-Q4.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-GGUF/resolve/main/qwen2.5-32b-instruct-q4_k_m.gguf",
        "min_ram_gb": 32,
        "min_vram_gb": 16,
        "desc": "Heavy Model (Advanced Linguistics)"
    }
}

def get_gpu_info():
    vendor = "Unknown/Integrated"
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, check=True
        )
        line = res.stdout.strip().split('\n')[0]
        gpu_name, total_mb = [x.strip() for x in line.split(',')]
        return {"vendor": f"NVIDIA ({gpu_name})", "vram_gb": round(int(total_mb) / 1024, 1)}
    except Exception:
        pass

    return {"vendor": vendor, "vram_gb": 2}

def get_system_specs():
    ram_gb = round(psutil.virtual_memory().total / 1024 / 1024 / 1024, 1) or 4
    cores = psutil.cpu_count(logical=False)
    gpu_data = get_gpu_info()
    return{
        "ram": ram_gb,
        "cores": cores,
        "gpu_vendor": gpu_data["vendor"],
        "vram": gpu_data["vram_gb"]
    }

if __name__ == "__main__":
    specs = get_system_specs()
    print(f"CPU: {specs['cores']} physical cores | RAM: {specs['ram']} GB")
    print(f"GPU: {specs['gpu_vendor']} | VRAM: {specs['vram']} GB\n")
