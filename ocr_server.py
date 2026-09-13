from fastapi import FastAPI, Request, HTTPException
import uvicorn

app = FastAPI() 

@app.post("/binary")
async def recive(request: Request):
    packet: bytes = await request.body()

    if not packet:
        raise HTTPException(status_code=400, detail="empty body")

    # print(f"Получено байт: {len(packet)}")
    if packet[:8] != b"\x89PNG\r\n\x1a\n":
        print("warning: not a PNG signature")

    text = "dummy result"

    return {"ok": True, "text": text, "bytes": len(packet)}

if __name__ == "__main__":
    uvicorn.run("ocr_server:app", host="0.0.0.0", port=8001)