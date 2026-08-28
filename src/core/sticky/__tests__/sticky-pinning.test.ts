import type { IStickyState } from "../sticky-anchors";
import { getPinnedStickyIndices } from "../sticky-pinning";

const state = (edge: "start" | "end", activeIndex: number): IStickyState => ({
  edge,
  activeIndex,
  limit: undefined,
});

describe("getPinnedStickyIndices", () => {
  it("держит активный якорь и его соседей по набору", () => {
    const configs = [{ edge: "start" as const, indices: [0, 4, 8, 12] }];

    // Следующий якорь подъезжает снизу и выталкивает текущий: делать это ему
    // нужно уже смонтированным.
    expect(getPinnedStickyIndices(configs, [state("start", 4)]).sort()).toEqual(
      [0, 4, 8],
    );
  });

  it("не выходит за границы набора", () => {
    const configs = [{ edge: "start" as const, indices: [0, 4] }];

    expect(getPinnedStickyIndices(configs, [state("start", 0)])).toEqual([
      0, 4,
    ]);
  });

  it("ничего не держит, когда якорь не активен", () => {
    const configs = [{ edge: "start" as const, indices: [0, 4] }];

    expect(getPinnedStickyIndices(configs, [state("start", -1)])).toEqual([]);
  });

  it("обслуживает обе кромки одновременно", () => {
    const configs = [
      { edge: "start" as const, indices: [0, 4] },
      { edge: "end" as const, indices: [6, 9] },
    ];

    const pinned = getPinnedStickyIndices(configs, [
      state("start", 0),
      state("end", 6),
    ]);

    expect(pinned.sort((a, b) => a - b)).toEqual([0, 4, 6, 9]);
  });

  it("не повторяет индексы", () => {
    const configs = [
      { edge: "start" as const, indices: [0, 4] },
      { edge: "end" as const, indices: [0, 4] },
    ];

    const pinned = getPinnedStickyIndices(configs, [
      state("start", 0),
      state("end", 0),
    ]);

    expect(pinned).toEqual([0, 4]);
  });

  it("пропускает состояние без своего набора", () => {
    expect(getPinnedStickyIndices([], [state("start", 0)])).toEqual([]);
  });
});
