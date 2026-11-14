import { describe, expect, it, vi } from "vitest";
vi.mock("./pdfBackend", () => ({ pdfBackend: {} }));
import { correctedPage } from "./Reader";
describe("page in the address", () => {
  it("is corrected to the page the reader shows", () => {
    expect(correctedPage("?page=99", 2)).toBe(2);
    expect(correctedPage("?page=0", 2)).toBe(1);
    expect(correctedPage("?page=abc", 2)).toBe(1);
    expect(correctedPage("?page=-3", 2)).toBe(1);
    expect(correctedPage("?page=2.5", 2)).toBe(1);
  });
  it("is left alone when it is valid or absent", () => {
    expect(correctedPage("?page=2", 2)).toBeNull();
    expect(correctedPage("?collection=x", 2)).toBeNull();
  });
});
