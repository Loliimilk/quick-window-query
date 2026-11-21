package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"backend/internal/api"
	"backend/internal/capture"
	"backend/internal/ocr"
)

const defaultOCRPort = "18744"

func ocrServerURL() string {
	port := strings.TrimSpace(os.Getenv("QWQ_OCR_PORT"))
	if port == "" {
		port = defaultOCRPort
	}
	return fmt.Sprintf("http://127.0.0.1:%s/binary", port)
}

func main() {
	fmt.Println("QwQ: Quick Window Query started!")
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	screenCap := capture.NewScreenCapture()
	ocrClient := ocr.NewOCRClient(ocrServerURL())
	server := api.NewServer(screenCap)

	frames := make(chan []byte)
	acknowledgements := make(chan bool)
	go screenCap.StartCapture(ctx, frames, acknowledgements)

	serverErrors := make(chan error, 1)
	go func() {
		serverErrors <- server.Start()
	}()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := server.Shutdown(shutdownCtx); err != nil {
				log.Printf("HTTP server shutdown: %v", err)
			}
			cancel()
			fmt.Println("bye bye >_<")
			return
		case err := <-serverErrors:
			if err != nil {
				log.Printf("HTTP server error: %v", err)
			}
			stop()
		case frame := <-frames:
			t0 := time.Now()
			server.SetProcessing(true)
			screenCap.ClearFramePending()
			response, err := ocrClient.SendFrame(ctx, frame)
			if err == nil {
				err = server.PublishOCRResult(response)
			}
			succeeded := err == nil
			if err != nil {
				screenCap.SetError(err)
			}
			server.SetProcessing(false)
			select {
			case acknowledgements <- succeeded:
			case <-ctx.Done():
				return
			}

			if err != nil {
				fmt.Printf("OCR request failed after %v: %v\n", time.Since(t0), err)
				continue
			}
			fmt.Printf("OCR completed in %v: %s\n", time.Since(t0), response)
		}
	}
}
