package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal/api"
	"backend/internal/capture"
	"backend/internal/ocr"
)

const ocrServerURL = "http://127.0.0.1:8001/binary"

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

	// Инициализируем модули
	screenCap := capture.NewScreenCapture()
	ocrClient := ocr.NewOCRClient(ocrServerURL)
	server := api.NewServer(screenCap)

	frames := make(chan []byte)
	go screenCap.StartCapture(ctx, frames)

	go func() {
		log.Println("Сервер запущен на :8080")
		if err := server.Start(":8080"); err != nil {
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
			resp, err := ocrClient.SendFrame(ctx, frame)
			dt := time.Since(t0)
			if err != nil {
				fmt.Printf("send error %v:%v\n", dt, err)
				time.Sleep(2 * time.Second)
				continue
			}
			fmt.Printf("frame %d bytes -> %d bytes resp in %v: %s\n",
				len(frame), len(resp), dt, string(resp))
		}
	}
}
