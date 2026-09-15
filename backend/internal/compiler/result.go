package compiler

type Result struct {
	Success      bool   `json:"success"`
	Log          string `json:"log"`
	PDFAvailable bool   `json:"pdfAvailable"`
	PDFPath      string `json:"-"`
}
