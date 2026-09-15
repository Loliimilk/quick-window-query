package main

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/kbinani/screenshot"
)

const serverURL = "http://127.0.0.1:8001/binary"

type Bounds struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

var (
	mu            sync.Mutex
	customBounds  image.Rectangle
	hasCustomRect bool
)

func Screen(ctx context.Context, ch chan<- []byte) {
	enc := png.Encoder{CompressionLevel: png.BestSpeed}
	var lastHash [16]byte

	for {
		select {
		case <-ctx.Done():
			fmt.Println("[Screen]: Received stop signal.")
			return
		default:
		}

		mu.Lock()
		active := hasCustomRect
		rect := customBounds
		mu.Unlock()

		if !active {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		img, err := screenshot.CaptureRect(rect)
		if err != nil {
			time.Sleep(200 * time.Millisecond)
			continue
		}

		currentHash := md5.Sum(img.Pix)
		if currentHash == lastHash {
			time.Sleep(50 * time.Millisecond)
			continue
		}

		lastHash = currentHash

		var buf bytes.Buffer
		if err := enc.Encode(&buf, img); err != nil {
			continue
		}

		select {
		case ch <- buf.Bytes():
		case <-ctx.Done():
			return
		}

		time.Sleep(50 * time.Millisecond)
	}
}

func sendFrame(ctx context.Context, client *http.Client, frame []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, serverURL, bytes.NewReader(frame))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-type", "image/png")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	Body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return Body, fmt.Errorf("server returned %d: %s", resp.StatusCode, Body)
	}
	return Body, nil

}
func updateBounds(w http.ResponseWriter, r *http.Request) {

	var b Bounds
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	mu.Lock()
	customBounds = image.Rect(b.X, b.Y, b.X+b.Width, b.Y+b.Height)
	hasCustomRect = true
	mu.Unlock()

	fmt.Printf("Получены bounds от PyQt: x=%d y=%d w=%d h=%d\n", b.X, b.Y, b.Width, b.Height)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func main() {
	fmt.Println("QwQ: Quick Window Query started!")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Println("shutting down...")
		cancel()
	}()

	frames := make(chan []byte)
	go Screen(ctx, frames)

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/update-bounds", updateBounds)

	go func() {
		log.Println("Сервер запущен на :8080")
		_ = http.ListenAndServe(":8080", mux)
	}()

	for {
		select {
		case <-ctx.Done():
			fmt.Println("bye bye >_<")
			return
		case frame := <-frames:
			t0 := time.Now()
			resp, err := sendFrame(ctx, client, frame)
			dt := time.Since(t0)
			if err != nil {
				fmt.Printf("send error %v:%v", dt, err)
				time.Sleep(2 * time.Second)
				continue
			}
			fmt.Printf("frame %d bytes -> %d bytes resp in %v: %s\n",
				len(frame), len(resp), dt, string(resp))
		}
	}
}
