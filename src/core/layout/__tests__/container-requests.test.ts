import { collectContainerRequests } from "../container-requests";

const source = (overrides = {}) => ({
  startBuffered: 0,
  endBuffered: 2,
  pinned: [] as number[],
  pending: [] as number[],
  getKey: (index: number) => (index < 0 || index > 9 ? undefined : `k${index}`),
  getType: () => "",
  getStickyEdge: () => null,
  ...overrides,
});

describe("collectContainerRequests", () => {
  it("запрашивает контейнеры на весь буферизованный диапазон", () => {
    const requests = collectContainerRequests(source());

    expect(requests.map(request => request.index)).toEqual([0, 1, 2]);
    expect(requests[0]).toMatchObject({
      key: "k0",
      type: "",
      stickyEdge: null,
    });
  });

  it("отдаёт пустой набор на пустом диапазоне", () => {
    expect(
      collectContainerRequests(source({ startBuffered: 0, endBuffered: -1 })),
    ).toEqual([]);
  });

  it("пропускает индексы без ключа", () => {
    const requests = collectContainerRequests(
      source({ startBuffered: 8, endBuffered: 12 }),
    );

    expect(requests.map(request => request.index)).toEqual([8, 9]);
  });

  it("добавляет прилипшие якоря за пределами буфера", () => {
    // Иначе шапка исчезает с экрана, стоит её группе уйти за буфер.
    const requests = collectContainerRequests(source({ pinned: [7, 9] }));

    expect(requests.map(request => request.index)).toEqual([0, 1, 2, 7, 9]);
  });

  it("добавляет ожидающих измерения", () => {
    // Их слот схлопнут в ноль: сами в диапазон они не попадут.
    const requests = collectContainerRequests(source({ pending: [8] }));

    expect(requests.map(request => request.index)).toEqual([0, 1, 2, 8]);
  });

  it("не повторяет индекс, пришедший из нескольких источников", () => {
    const requests = collectContainerRequests(
      source({ pinned: [1, 8], pending: [1, 8] }),
    );

    expect(requests.map(request => request.index)).toEqual([0, 1, 2, 8]);
  });

  it("отдаёт повторяющийся ключ первому индексу", () => {
    // Контейнер у ключа один, и разложить его дважды значит переставлять
    // позицию на каждом проходе.
    const requests = collectContainerRequests(
      source({ getKey: () => "same", endBuffered: 3 }),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]!.index).toBe(0);
  });

  it("проставляет тип и кромку прилипания", () => {
    const requests = collectContainerRequests(
      source({
        endBuffered: 1,
        getType: (index: number) => (index === 0 ? "photo" : "text"),
        getStickyEdge: (index: number) => (index === 1 ? "start" : null),
      }),
    );

    expect(requests[0]).toMatchObject({ type: "photo", stickyEdge: null });
    expect(requests[1]).toMatchObject({ type: "text", stickyEdge: "start" });
  });
});
