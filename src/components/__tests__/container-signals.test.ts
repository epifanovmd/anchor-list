import { getContainerSignalNames } from "../container-signals";

describe("getContainerSignalNames", () => {
  it("адресует сигналы номером контейнера", () => {
    // Именно поэтому смещение одной строки не перерисовывает остальные.
    expect(getContainerSignalNames(3)).toEqual([
      "containerPosition3",
      "containerItemKey3",
      "containerItemIndex3",
      "containerItemData3",
      "containerItemType3",
      "containerItemSize3",
      "containerSticky3",
      "containerStickyLimit3",
      "containerClipped3",
      "scrollLength",
    ]);
  });

  it("не пересекается между контейнерами", () => {
    const first = getContainerSignalNames(0).slice(0, -1);
    const second = getContainerSignalNames(1).slice(0, -1);

    expect(first.some(name => second.includes(name))).toBe(false);
  });

  it("включает размер вьюпорта", () => {
    // Прилипание к конечной кромке считается от него наравне с позицией.
    expect(getContainerSignalNames(0)).toContain("scrollLength");
  });
});
