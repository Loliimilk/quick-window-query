package main

import (
	"bytes"
	"context"
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

func Screen(ctx context.Context, monitor int, ch chan<- []byte) {
	enc := png.Encoder{CompressionLevel: png.BestSpeed}
	defaultBounds := screenshot.GetDisplayBounds(monitor - 1)

	for {
		select {
		case <-ctx.Done():
			fmt.Println("[Screen]: Received stop signal.")
			return
		default:
		}

		mu.Lock()
		var captureRect image.Rectangle
		if hasCustomRect {
			captureRect = customBounds
		} else {
			captureRect = defaultBounds
		}
		mu.Unlock()

		if captureRect.Dx() <= 0 || captureRect.Dy() <= 0 {
			captureRect = defaultBounds
		}

		img, err := screenshot.CaptureRect(captureRect)
		if err != nil {
			time.Sleep(200 * time.Millisecond)
			continue
		}

		var buf bytes.Buffer
		if err := enc.Encode(&buf, img); err != nil {
			fmt.Println("encode error:", err)
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
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

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

	var monitor int
	fmt.Printf("What monitor? (1..%d): ", screenshot.NumActiveDisplays())
	_, _ = fmt.Scanln(&monitor)
	if monitor < 1 || monitor > screenshot.NumActiveDisplays() {
		monitor = 1
	}

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
	go Screen(ctx, monitor, frames)

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/update-bounds", updateBounds)

	server := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	}

	go func() {
		log.Println("Go server запущен на http://localhost:8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
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
				continue
			}
			fmt.Printf("frame %d bytes -> %d bytes resp in %v: %s\n",
				len(frame), len(resp), dt, string(resp))
		}
	}
}
