package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

type OCRClient struct {
	client    *http.Client
	serverURL string
}

func NewOCRClient(serverURL string) *OCRClient {
	return &OCRClient{
		serverURL: serverURL,
		client: &http.Client{
			Timeout: 30 * time.Second,
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

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return body, fmt.Errorf("server returned %d: %s", resp.StatusCode, body)
	}
	return body, nil
}
