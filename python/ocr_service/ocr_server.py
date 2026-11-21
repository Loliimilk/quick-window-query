import asyncio
import logging
import os
from contextlib import asynccontextmanager
from io import BytesIO
from threading import Lock

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
reader_lock = Lock()
MAX_IMAGE_BYTES = 64 * 1024 * 1024
MAX_IMAGE_PIXELS = 34_000_000


def create_reader():
    import easyocr
    import torch

    return easyocr.Reader(["ru", "en"], gpu=torch.cuda.is_available())


async def load_reader(app: FastAPI):
    print("[OCR] Loading EasyOCR model...", flush=True)
    logger.info("Loading EasyOCR model...")
    try:
        app.state.reader = await run_in_threadpool(create_reader)
        app.state.reader_error = None
        print("[OCR] Model ready; waiting for PNG frames.", flush=True)
        logger.info("EasyOCR model is ready.")
    except Exception as error:
        app.state.reader_error = str(error)
        print(f"[OCR] Model failed to load: {error}", flush=True)
        logger.exception("Could not load EasyOCR model")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.reader = None
    app.state.reader_error = None
    reader_task = asyncio.create_task(load_reader(app))
    try:
        yield
    finally:
        if not reader_task.done():
            reader_task.cancel()


app = FastAPI(lifespan=lifespan)


@app.get("/health/live")
async def live():
    return {"status": "alive"}


@app.get("/health")
async def health():
    if app.state.reader is None:
        return JSONResponse(
            status_code=503,
            content={"status": "loading", "error": app.state.reader_error},
        )
    return {"status": "ok"}


def recognize(reader, packet: bytes) -> list[str]:
    with reader_lock:
        return reader.readtext(packet, detail=0)


async def read_limited_body(request: Request) -> bytes:
    chunks = []
    total_bytes = 0
    async for chunk in request.stream():
        total_bytes += len(chunk)
        if total_bytes > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="image is too large")
        chunks.append(chunk)
    return b"".join(chunks)


@app.post("/binary")
async def receive(request: Request):
    reader = getattr(app.state, "reader", None)
    if reader is None:
        raise HTTPException(status_code=503, detail="OCR model is not ready")

    packet = await read_limited_body(request)
    if not packet:
        raise HTTPException(status_code=400, detail="empty body")
    if packet[:8] != b"\x89PNG\r\n\x1a\n":
        raise HTTPException(status_code=400, detail="expected a PNG image")

    try:
        with Image.open(BytesIO(packet)) as image:
            if image.format != "PNG":
                raise HTTPException(status_code=400, detail="expected a PNG image")
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="image dimensions are too large")
            image.verify()
    except HTTPException:
        raise
    except (
        UnidentifiedImageError,
        Image.DecompressionBombError,
        OSError,
        SyntaxError,
        ValueError,
    ) as error:
        raise HTTPException(status_code=400, detail="invalid PNG image") from error

    results = await run_in_threadpool(recognize, reader, packet)
    text = " ".join(results)
    summary = text if len(text) <= 1000 else text[:1000] + "…"
    print(
        f"[OCR] Processed PNG ({len(packet)} bytes); "
        f"{len(results)} line(s): {summary or '(no text detected)'}",
        flush=True,
    )

    return {
        "ok": True,
        "bytes": len(packet),
        "text": text,
        "lines": results,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("QWQ_OCR_PORT", "18744")))
