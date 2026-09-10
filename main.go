package main

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"

	"github.com/kbinani/screenshot"
)

func main() {
	fmt.Println("QwQ: Quick Window Query started!")

	a := screenshot.NumActiveDisplays()

	myPalette := color.Palette{color.White, color.Black}

	for i := 0; i < a; i++ {
		bounds := screenshot.GetDisplayBounds(i)

		img, _ := screenshot.CaptureRect(bounds)

		dstImage := image.NewPaletted(bounds, myPalette)

		draw.Draw(dstImage, bounds, img, bounds.Min, draw.Src)

		fileName := fmt.Sprintf("%d_%dx%d.png", i, bounds.Dx(), bounds.Dy())

		file, _ := os.Create(fileName)

		defer file.Close()
		png.Encode(file, dstImage)

		fmt.Printf("#%d : %v \"%s\"\n", i, bounds, fileName)
	}
}
