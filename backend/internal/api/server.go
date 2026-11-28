package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"backend/internal/capture"
	"backend/internal/hardware"
)

const defaultAddress = "127.0.0.1:18743"

func serverAddress() string {
	if address := strings.TrimSpace(os.Getenv("QWQ_API_ADDR")); address != "" {
		return address
	}
	return defaultAddress
}

type OCRResult struct {
	OK        bool      `json:"ok"`
	Bytes     int       `json:"bytes"`
	Text      string    `json:"text"`
	Lines     []string  `json:"lines"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CaptureState struct {
	Active      bool   `json:"active"`
	BoundsReady bool   `json:"bounds_ready"`
	Processing  bool   `json:"processing"`
	LastError   string `json:"last_error"`
}

type Server struct {
	capture    *capture.ScreenCapture
	mux        *http.ServeMux
	http       *http.Server
	resultMu   sync.RWMutex
	latest     OCRResult
	hasResult  bool
	processing bool
}

func NewServer(sc *capture.ScreenCapture) *Server {
	s := &Server{
		capture: sc,
		mux:     http.NewServeMux(),
	}
	s.setupRoutes()
	s.http = &http.Server{
		Addr:              serverAddress(),
		Handler:           s.mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	return s
}

func (s *Server) setupRoutes() {
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/update-bounds", s.handleUpdateBounds)
	s.mux.HandleFunc("/capture", s.handleCapture)
	s.mux.HandleFunc("/capture/settings", s.handleCaptureSettings)
	s.mux.HandleFunc("/system-info", s.handleSystemInfo)
	s.mux.HandleFunc("/ocr-result", s.handleOCRResult)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleUpdateBounds(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodPost) {
		return
	}
	var bounds capture.Bounds
	if err := decodeJSON(w, r, &bounds); err != nil {
		http.Error(w, "bad bounds: "+err.Error(), http.StatusBadRequest)
		return
	}
	if err := s.capture.UpdateBounds(bounds); err != nil {
		s.capture.SetError(err)
		http.Error(w, "invalid bounds: "+err.Error(), http.StatusBadRequest)
		return
	}

	fmt.Printf("Получены bounds от PyQt: x=%d y=%d w=%d h=%d\n", bounds.X, bounds.Y, bounds.Width, bounds.Height)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleCapture(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, CaptureState{
			Active:      s.capture.IsEnabled(),
			BoundsReady: s.capture.HasBounds(),
			Processing:  s.isProcessing() || s.capture.IsFramePending(),
			LastError:   s.capture.LastError(),
		})
	case http.MethodPost:
		var request struct {
			Active *bool `json:"active"`
		}
		if err := decodeJSON(w, r, &request); err != nil {
			http.Error(w, "bad capture request: "+err.Error(), http.StatusBadRequest)
			return
		}
		if request.Active == nil {
			http.Error(w, "bad capture request: active is required", http.StatusBadRequest)
			return
		}
		if *request.Active && (s.isProcessing() || s.capture.IsFramePending()) {
			http.Error(w, "capture cannot restart while the current frame is processing", http.StatusConflict)
			return
		}
		s.capture.SetEnabled(*request.Active)
		if *request.Active {
			s.ClearOCRResult()
		}
		writeJSON(w, http.StatusOK, CaptureState{
			Active:      *request.Active,
			BoundsReady: s.capture.HasBounds(),
			Processing:  s.isProcessing() || s.capture.IsFramePending(),
			LastError:   s.capture.LastError(),
		})
	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (s *Server) handleCaptureSettings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, map[string]int{"interval_seconds": s.capture.IntervalSeconds()})
	case http.MethodPost:
		var request struct {
			IntervalSeconds *int `json:"interval_seconds"`
		}
		if err := decodeJSON(w, r, &request); err != nil {
			http.Error(w, "bad capture settings: "+err.Error(), http.StatusBadRequest)
			return
		}
		if request.IntervalSeconds == nil {
			http.Error(w, "bad capture settings: interval_seconds is required", http.StatusBadRequest)
			return
		}
		if err := s.capture.SetIntervalSeconds(*request.IntervalSeconds); err != nil {
			http.Error(w, "bad capture settings: "+err.Error(), http.StatusBadRequest)
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"interval_seconds": s.capture.IntervalSeconds()})
	default:
		methodNotAllowed(w, http.MethodGet, http.MethodPost)
	}
}

func (s *Server) handleSystemInfo(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	info, err := hardware.Inspect(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) handleOCRResult(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	s.resultMu.RLock()
	result, available := s.latest, s.hasResult
	s.resultMu.RUnlock()
	if !available {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) PublishOCRResult(body []byte) error {
	var result OCRResult
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("decode OCR response: %w", err)
	}
	if !result.OK {
		return errors.New("OCR service returned ok=false")
	}
	if result.Lines == nil {
		result.Lines = []string{}
	}
	result.UpdatedAt = time.Now().UTC()

	s.resultMu.Lock()
	s.latest = result
	s.hasResult = true
	s.resultMu.Unlock()
	s.capture.SetError(nil)
	return nil
}

func (s *Server) ClearOCRResult() {
	s.resultMu.Lock()
	s.latest = OCRResult{}
	s.hasResult = false
	s.resultMu.Unlock()
}

func (s *Server) SetProcessing(processing bool) {
	s.resultMu.Lock()
	s.processing = processing
	s.resultMu.Unlock()
}

func (s *Server) isProcessing() bool {
	s.resultMu.RLock()
	defer s.resultMu.RUnlock()
	return s.processing
}

func (s *Server) Start() error {
	listener, err := net.Listen("tcp", s.http.Addr)
	if err != nil {
		return err
	}
	fmt.Printf("HTTP API listening on %s\n", s.http.Addr)
	err = s.http.Serve(listener)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.http.Shutdown(ctx)
}

func requireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}
	methodNotAllowed(w, method)
	return false
}

func methodNotAllowed(w http.ResponseWriter, methods ...string) {
	w.Header().Set("Allow", joinMethods(methods))
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func joinMethods(methods []string) string {
	result := ""
	for i, method := range methods {
		if i > 0 {
			result += ", "
		}
		result += method
	}
	return result
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 4*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("body must contain one JSON value")
		}
		return err
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
