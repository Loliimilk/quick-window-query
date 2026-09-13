package main

import (
	"bytes"
	"context"
	"fmt"
	"image/png"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kbinani/screenshot"
)

const serverURL = "http://127.0.0.1:8001/binary"

func Screen(ctx context.Context, monitor int, ch chan<- []byte) {

	enc := png.Encoder{CompressionLevel: png.BestSpeed}

	for {
		select {

		case <-ctx.Done():
			fmt.Println("[Screen]: Received stop signal.")
			return
		default:
		}

		bounds := screenshot.GetDisplayBounds(monitor - 1)

		img, err := screenshot.CaptureRect(bounds)
		if err != nil {
			println("capture error:", err)
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

func main() {
	fmt.Println("QwQ: Quick Window Query started!")

	var monitor int
	fmt.Printf("What monitor? (1..%d): ", screenshot.NumActiveDisplays())
	fmt.Scanln(&monitor)
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
				continue
			}
			fmt.Printf("frame %d bytes -> %d bytes resp in %v: %s\n",
				len(frame), len(resp), dt, string(resp))
		}
	}
}
