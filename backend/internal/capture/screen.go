package capture

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
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
	mu              sync.Mutex
	customBounds    image.Rectangle
	hasCustomRect   bool
	enabled         bool
	framePending    bool
	changed         chan struct{}
	intervalChanged chan struct{}
	interval        time.Duration
	lastError       string
}

func NewScreenCapture() *ScreenCapture {
	return &ScreenCapture{
		changed:         make(chan struct{}, 1),
		intervalChanged: make(chan struct{}, 1),
		interval:        time.Second,
	}
}

const maxCaptureIntervalSeconds = 10

func (s *ScreenCapture) SetIntervalSeconds(seconds int) error {
	if seconds < 0 || seconds > maxCaptureIntervalSeconds {
		return fmt.Errorf("interval must be between 0 and %d seconds", maxCaptureIntervalSeconds)
	}

	s.mu.Lock()
	interval := time.Duration(seconds) * time.Second
	changed := s.interval != interval
	s.interval = interval
	s.mu.Unlock()

	if changed {
		select {
		case s.intervalChanged <- struct{}{}:
		default:
		}
	}
	return nil
}

func (s *ScreenCapture) IntervalSeconds() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return int(s.interval / time.Second)
}

const maxCapturePixels = 34_000_000

func (s *ScreenCapture) UpdateBounds(b Bounds) error {
	if b.Width <= 0 || b.Height <= 0 {
		return errors.New("width and height must be positive")
	}
	if b.Width > maxCapturePixels/b.Height {
		return fmt.Errorf("capture area exceeds %d pixels", maxCapturePixels)
	}
	maxInt := int(^uint(0) >> 1)
	if b.X > maxInt-b.Width || b.Y > maxInt-b.Height {
		return errors.New("bounds overflow")
	}

	rect := image.Rect(b.X, b.Y, b.X+b.Width, b.Y+b.Height)
	displayCount := screenshot.NumActiveDisplays()
	if displayCount == 0 {
		return errors.New("no active displays")
	}
	virtualBounds := image.Rectangle{}
	for i := 0; i < displayCount; i++ {
		virtualBounds = virtualBounds.Union(screenshot.GetDisplayBounds(i))
	}
	if rect.Min.X < virtualBounds.Min.X || rect.Min.Y < virtualBounds.Min.Y ||
		rect.Max.X > virtualBounds.Max.X || rect.Max.Y > virtualBounds.Max.Y {
		return errors.New("bounds must fit within the virtual desktop")
	}

	s.mu.Lock()
	s.customBounds = rect
	s.hasCustomRect = true
	s.lastError = ""
	s.mu.Unlock()
	s.notifyChanged()
	return nil
}

func (s *ScreenCapture) SetEnabled(enabled bool) {
	s.mu.Lock()
	s.enabled = enabled
	if enabled {
		s.lastError = ""
	}
	s.mu.Unlock()
	s.notifyChanged()
}

func (s *ScreenCapture) HasBounds() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hasCustomRect
}

func (s *ScreenCapture) BeginFrame(rect image.Rectangle) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.enabled || !s.hasCustomRect || s.customBounds != rect {
		return false
	}
	s.framePending = true
	return true
}

func (s *ScreenCapture) ClearFramePending() {
	s.mu.Lock()
	s.framePending = false
	s.mu.Unlock()
}

func (s *ScreenCapture) IsFramePending() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.framePending
}

func (s *ScreenCapture) SetError(err error) {
	s.mu.Lock()
	if err == nil {
		s.lastError = ""
	} else {
		s.lastError = err.Error()
	}
	s.mu.Unlock()
}

func (s *ScreenCapture) LastError() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastError
}

func (s *ScreenCapture) IsEnabled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.enabled
}

func (s *ScreenCapture) StartCapture(ctx context.Context, frames chan<- []byte, acknowledgements <-chan bool) {
	enc := png.Encoder{CompressionLevel: png.BestSpeed}
	var lastHash [sha256.Size]byte
	var lastRect image.Rectangle
	hasLastHash := false
	loggedCaptureError := false
	retryDelay := time.Duration(0)

	for {
		select {
		case <-ctx.Done():
			fmt.Println("[Screen]: Received stop signal.")
			return
		default:
		}

		s.mu.Lock()
		active := s.enabled && s.hasCustomRect
		rect := s.customBounds
		s.mu.Unlock()

		if !active {
			hasLastHash = false
			lastRect = image.Rectangle{}
			retryDelay = 0
			if !s.waitFor(ctx, 100*time.Millisecond) {
				return
			}
			continue
		}
		frameCheckStarted := time.Now()
		if rect != lastRect {
			hasLastHash = false
			lastRect = rect
			retryDelay = 0
		}

		img, err := screenshot.CaptureRect(rect)
		if err != nil {
			s.SetError(err)
			if !loggedCaptureError {
				fmt.Printf("[Screen] capture failed for %v: %v\n", rect, err)
				loggedCaptureError = true
			}
			if !s.waitFor(ctx, 200*time.Millisecond) {
				return
			}
			continue
		}
		if loggedCaptureError {
			fmt.Println("[Screen] capture recovered.")
			loggedCaptureError = false
			s.SetError(nil)
		}

		currentHash := sha256.Sum256(img.Pix)
		if hasLastHash && currentHash == lastHash {
			if !s.waitForCaptureInterval(ctx, frameCheckStarted) {
				return
			}
			continue
		}

		var buf bytes.Buffer
		if err := enc.Encode(&buf, img); err != nil {
			fmt.Printf("[Screen] PNG encode failed: %v\n", err)
			if !s.waitFor(ctx, 200*time.Millisecond) {
				return
			}
			continue
		}

		if !s.BeginFrame(rect) {
			if !s.waitFor(ctx, 50*time.Millisecond) {
				return
			}
			continue
		}
		select {
		case frames <- buf.Bytes():
		case <-ctx.Done():
			s.ClearFramePending()
			return
		}

		select {
		case succeeded := <-acknowledgements:
			if succeeded {
				lastHash = currentHash
				hasLastHash = true
				retryDelay = 0
				if !s.waitForCaptureInterval(ctx, frameCheckStarted) {
					return
				}
			} else {
				if retryDelay == 0 {
					retryDelay = 2 * time.Second
				} else if retryDelay < 30*time.Second {
					retryDelay *= 2
					if retryDelay > 30*time.Second {
						retryDelay = 30 * time.Second
					}
				}
				if !s.waitFor(ctx, retryDelay) {
					return
				}
			}
		case <-ctx.Done():
			return
		}
	}
}

func (s *ScreenCapture) waitForCaptureInterval(ctx context.Context, started time.Time) bool {
	for {
		s.mu.Lock()
		interval := s.interval
		s.mu.Unlock()

		remaining := time.Until(started.Add(interval))
		if remaining <= 0 {
			return true
		}

		timer := time.NewTimer(remaining)
		select {
		case <-timer.C:
			return true
		case <-s.intervalChanged:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
		case <-s.changed:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			return true
		case <-ctx.Done():
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			return false
		}
	}
}

func (s *ScreenCapture) notifyChanged() {
	select {
	case s.changed <- struct{}{}:
	default:
	}
}

func (s *ScreenCapture) waitFor(ctx context.Context, delay time.Duration) bool {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-s.changed:
		return true
	case <-ctx.Done():
		return false
	}
}
