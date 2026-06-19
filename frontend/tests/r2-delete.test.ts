import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn().mockResolvedValue({});
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () { return { send }; }),
  PutObjectCommand: vi.fn(function (i) { return i; }),
  GetObjectCommand: vi.fn(function (i) { return i; }),
  DeleteObjectCommand: vi.fn(function (i) { return i; }),
  DeleteObjectsCommand: vi.fn(function (i) { return i; }),
}));

beforeEach(() => send.mockClear());

describe("r2 delete helpers", () => {
  it("deleteHeatmap sends one delete", async () => {
    const { deleteHeatmap } = await import("../app/lib/r2");
    await deleteHeatmap("abc");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("deleteHeatmaps no-ops on empty input", async () => {
    const { deleteHeatmaps } = await import("../app/lib/r2");
    await deleteHeatmaps([]);
    expect(send).not.toHaveBeenCalled();
  });
  it("deleteHeatmaps batches keys", async () => {
    const { deleteHeatmaps } = await import("../app/lib/r2");
    await deleteHeatmaps(["a", "b", "c"]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
