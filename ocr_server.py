from fastapi import FastAPI, Request, HTTPException
import easyocr
import uvicorn

app = FastAPI() 

print("Loading EasyOCR model...")
reader = easyocr.Reader(['ru', 'en'], gpu=True)
print("Model loaded!")

@app.post("/binary")
async def recive(request: Request):
    packet: bytes = await request.body()

    if not packet:
        raise HTTPException(status_code=400, detail="empty body")

    if packet[:8] != b"\x89PNG\r\n\x1a\n":
        print("warning: not a PNG signature")

    results = reader.readtext(packet, detail=0)

    text = " ".join(results)

    return {
        "ok": True,
        "bytes": len(packet),
        "text": text,
        "lines": results,
    }

if __name__ == "__main__":
    uvicorn.run("ocr_server:app", host="0.0.0.0", port=8001)