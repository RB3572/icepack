"use client";

export function downloadText(filename: string, text: string, type = "text/plain") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Serialises a rendered SVG element, inlining the font so it travels well. */
export function downloadSvg(element: SVGSVGElement | null, filename: string) {
  if (!element) return;
  const clone = element.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("font-family", "Arial, Helvetica, sans-serif");
  const markup = new XMLSerializer().serializeToString(clone);
  downloadText(filename, `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`, "image/svg+xml");
}

export function downloadJson(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}
