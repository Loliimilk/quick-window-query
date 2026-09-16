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