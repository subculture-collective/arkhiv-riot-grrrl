import { describe, expect, it, vi } from "vitest";
const { getDocument } = vi.hoisted(() => ({
  getDocument: vi.fn(() => ({ promise: new Promise(() => {}), destroy: () => {} })),
}));
vi.mock("pdfjs-dist", () => ({ getDocument, GlobalWorkerOptions: {} }));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/worker.mjs" }));
import { pdfBackend } from "./pdfBackend";
describe("PDF loading", () => {
  it("requests only the ranges a page needs instead of streaming the whole file", () => {
    pdfBackend.open("/api/assets/example");
    expect(getDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/assets/example",
        disableStream: true,
        disableAutoFetch: true,
      }),
    );
  });
});
