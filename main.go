package main

import (
	"bytes"
	"fmt"
	"image/png"
	"time"

	"github.com/kbinani/screenshot"
)

func Screen(monitor int) {

	var slidingWindow [][]byte
	maxFrame := 5

	fastEncoder := png.Encoder{
		CompressionLevel: png.BestSpeed, // Или png.NoCompression
	}

	for {

		bounds := screenshot.GetDisplayBounds(monitor - 1)

		img, err := screenshot.CaptureRect(bounds)
		if err != nil {
			println("cant capture", err)
			return
		}

		var buf bytes.Buffer
		fastEncoder.Encode(&buf, img)

		slidingWindow = append(slidingWindow, buf.Bytes())

		if len(slidingWindow) > maxFrame {
			slidingWindow[0] = nil
			slidingWindow = slidingWindow[1:]
		}

		fmt.Printf("frames in window: %d | latest frame size: %d KB\n", len(slidingWindow), len(slidingWindow[len(slidingWindow)-1])/1024)

		time.Sleep(1 * time.Second)
	}
}

func main() {
	fmt.Println("QwQ: Quick Window Query started!")

	var monitor int

	fmt.Printf("What monitor? (numbering as in the settings) u have %v: ", screenshot.NumActiveDisplays())
	fmt.Scanln(&monitor)

	if monitor < 1 || monitor > screenshot.NumActiveDisplays() {
		monitor = 1
	}

	Screen(monitor)
}
