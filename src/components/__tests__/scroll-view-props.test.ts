import { omitManagedScrollViewProps } from "../scroll-view-props";

describe("omitManagedScrollViewProps", () => {
  it("пропускает пропы ScrollView, которыми список не управляет", () => {
    expect(
      omitManagedScrollViewProps({
        scrollEnabled: false,
        nestedScrollEnabled: true,
        scrollsToTop: false,
        overScrollMode: "never",
        keyboardDismissMode: "none",
        testID: "list",
      }),
    ).toEqual({
      scrollEnabled: false,
      nestedScrollEnabled: true,
      scrollsToTop: false,
      overScrollMode: "never",
      keyboardDismissMode: "none",
      testID: "list",
    });
  });

  it("не отдаёт ScrollView собственные пропы списка", () => {
    expect(
      omitManagedScrollViewProps({
        scrollEnabled: false,
        data: [],
        keyExtractor: () => "",
        estimatedItemSize: 50,
        onEndReached: () => undefined,
      } as never),
    ).toEqual({ scrollEnabled: false });
  });

  /**
   * Без TypeScript запрещённое типом всё равно доходит до компонента. Проп,
   * который список выставляет сам, перебился бы его значением, а тот, что он
   * не выставляет, — сдвинул бы координаты или включил вторую механику поверх
   * своей: инсеты, свои прилипающие заголовки, отсечение строк.
   */
  it("отбрасывает пропы, которыми управляет список", () => {
    expect(
      omitManagedScrollViewProps({
        scrollEnabled: false,
        onScroll: () => undefined,
        contentInset: { top: 10 },
        contentOffset: { x: 0, y: 100 },
        stickyHeaderIndices: [0],
        removeClippedSubviews: true,
        snapToInterval: 100,
        pagingEnabled: true,
        refreshControl: null,
      } as never),
    ).toEqual({ scrollEnabled: false });
  });
});
