package ocr

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

const maxOCRResponseBytes = 4 * 1024 * 1024

type OCRClient struct {
	client    *http.Client
	serverURL string
}

func NewOCRClient(serverURL string) *OCRClient {
	return &OCRClient{
		serverURL: serverURL,
		client: &http.Client{
			Timeout: 60 * time.Second,
			Transport: &http.Transport{
				DisableKeepAlives: true,
			},
		},
	}
}

func (c *OCRClient) SendFrame(ctx context.Context, frame []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.serverURL, bytes.NewReader(frame))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-type", "image/png")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxOCRResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxOCRResponseBytes {
		return nil, fmt.Errorf("OCR response exceeds %d bytes", maxOCRResponseBytes)
	}
	if resp.StatusCode != http.StatusOK {
		return body, fmt.Errorf("server returned %d: %s", resp.StatusCode, body)
	}
	return body, nil
}
