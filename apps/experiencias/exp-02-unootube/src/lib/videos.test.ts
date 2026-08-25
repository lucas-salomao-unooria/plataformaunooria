import { describe, expect, test } from "vitest";
import { urlDoVideo } from "./videos";

describe("urlDoVideo", () => {
  test("sem base cai em ./videos (dev: public/videos servido pelo Vite)", () => {
    expect(urlDoVideo("v01.mp4", undefined)).toBe("./videos/v01.mp4");
    expect(urlDoVideo("v01.mp4", "")).toBe("./videos/v01.mp4");
    expect(urlDoVideo("v01.mp4", "   ")).toBe("./videos/v01.mp4");
  });

  test("com base absoluta, com ou sem barra final", () => {
    expect(urlDoVideo("v07.mp4", "https://cdn.exemplo/exp-02-unootube/videos")).toBe(
      "https://cdn.exemplo/exp-02-unootube/videos/v07.mp4",
    );
    expect(urlDoVideo("v07.mp4", "https://cdn.exemplo/exp-02-unootube/videos///")).toBe(
      "https://cdn.exemplo/exp-02-unootube/videos/v07.mp4",
    );
  });
});
