package capture

import (
	"bytes"
	"context"
	"crypto/md5"
	"fmt"
	"image"
	"image/png"
	"sync"
	"time"

	"github.com/kbinani/screenshot"
)

type Bounds struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type ScreenCapture struct {
	mu            sync.Mutex
	customBounds  image.Rectangle
	hasCustomRect bool
}

func NewScreenCapture() *ScreenCapture {
	return &ScreenCapture{}
}

func (s *ScreenCapture) UpdateBounds(b Bounds) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.customBounds = image.Rect(b.X, b.Y, b.X+b.Width, b.Y+b.Height)
	s.hasCustomRect = true
}

func (s *ScreenCapture) StartCapture(ctx context.Context, ch chan<- []byte) {
	enc := png.Encoder{CompressionLevel: png.BestSpeed}
	var lastHash [16]byte

	for {
		select {
		case <-ctx.Done():
			fmt.Println("[Screen]: Received stop signal.")
			return
		default:
		}

		s.mu.Lock()
		active := s.hasCustomRect
		rect := s.customBounds
		s.mu.Unlock()

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
