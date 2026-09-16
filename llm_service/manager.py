import os
import subprocess
import json
import psutil
import requests
from tqdm import tqdm

MODELS_DIR = "llm_service/models"

MODELS = {
    "low": {
        "folder": "Qwen2.5-1.5B-Instruct",
        "name": "Qwen2.5-1.5B-Instruct-Q4.gguf",
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "min_ram_gb": 4,
        "min_vram_gb": 2,
        "desc": "simple model (basic translation and rules)"
    },
    "mid": {
        "folder": "Llama-3.1-8B-Instruct",
        "name": "Llama-3.1-8B-Instruct-Q4.gguf",
        "url": "https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
        "min_ram_gb": 16,
        "min_vram_gb": 6,
        "desc": "Optimal model  (Excellent tutor)"
    },
    "high": {
        "folder": "Qwen2.5-32B-Instruct",
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
    try:
        ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1)
    except Exception:
        ram_gb = 4.0
    cores = psutil.cpu_count(logical=False) or 2
    gpu_data = get_gpu_info()
    return{
        "ram": max(ram_gb, 4.0),
        "cores": cores,
        "gpu_vendor": gpu_data["vendor"],
        "vram": max(gpu_data["vram_gb"], 2.0)
    }

def get_model_path(tier_key):
    model_data = MODELS.get(tier_key)
    if not model_data:
        return None, None

    dir_path = os.path.join(MODELS_DIR, model_data["folder"])
    file_path = os.path.join(dir_path, model_data["name"])
    return dir_path, file_path

def is_model_downloaded(tier_key):
    _, file_path = get_model_path(tier_key)
    return os.path.exists(file_path) if file_path else False

def download_model(tier_key):
    model_data = MODELS.get(tier_key)
    if not model_data:
        print("error: I have no module")
        return

    dir_path, file_path = get_model_path(tier_key)

    if os.path.exists(file_path):
        print(f"model {model_data['name']} is exist")
        return

    os.makedirs(dir_path, exist_ok=True)
    print(f"\nDownloading {model_data['name']} in floder '{dir_path}'...")

    response = requests.get(model_data["url"], stream=True)
    response.raise_for_status()

    total_size = int(response.headers.get('content-length', 0))
    block_size = 1024 * 1024

    with tqdm(total=total_size, unit='iB', unit_scale=True, desc=model_data["folder"]) as progress_bar:
        with open(file_path, 'wb') as file:
            for data in response.iter_content(block_size):
                progress_bar.update(len(data))
                file.write(data)

    print(f"Done! The model is saved in: {file_path}")

def delete_model(tier_key):
    dir_path, file_path = get_model_path(tier_key)
    
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        print(f"File {file_path} has been deleted.")
        
        if os.path.exists(dir_path) and not os.listdir(dir_path):
            os.rmdir(dir_path)
            print(f"The {dir_path} folder has been cleared.")
    else:
        print("Model file not found.")

if __name__ == "__main__":

    while True:
        specs = get_system_specs()
        print(f"CPU: {specs['cores']} physical cores | RAM: {specs['ram']} GB")
        print(f"GPU: {specs['gpu_vendor']} | VRAM: {specs['vram']} GB\n")

        for tier, data in MODELS.items():
            status = "[DOWNLOADED]" if is_model_downloaded(tier) else "[NOT DOWNLOADED]"
            print(f"{status} {tier.upper()}: {data['folder']} — {data['desc']}")

        print("\ncommand:")
        print(" 1-3 : Download (1=low, 2=mid, 3=high)")
        print(" 4-6 : Delete (4=low, 5=mid, 6=high)")
        print(" 0   : Exit")
        
        choice = input("\nSelect action: ").strip()
        
        if choice == '1': download_model("low")
        elif choice == '2': download_model("mid")
        elif choice == '3': download_model("high")
        elif choice == '4': delete_model("low")
        elif choice == '5': delete_model("mid")
        elif choice == '6': delete_model("high")
        elif choice == '0': break
        else: print("Invalid input.")
