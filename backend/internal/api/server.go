package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"backend/internal/capture"
)

type Server struct {
	capture *capture.ScreenCapture
	mux     *http.ServeMux
}

func NewServer(sc *capture.ScreenCapture) *Server {
	s := &Server{
		capture: sc,
		mux:     http.NewServeMux(),
	}
	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	s.mux.HandleFunc("/update-bounds", s.handleUpdateBounds)
}

func (s *Server) handleUpdateBounds(w http.ResponseWriter, r *http.Request) {
	var b capture.Bounds
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		http.Error(w, "bad json: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	s.capture.UpdateBounds(b)
	fmt.Printf("Получены bounds от PyQt: x=%d y=%d w=%d h=%d\n", b.X, b.Y, b.Width, b.Height)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

func (s *Server) Start(addr string) error {
	return http.ListenAndServe(addr, s.mux)
}
