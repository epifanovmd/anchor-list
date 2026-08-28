import { ListStore } from "../../../model";
import type { IEdgeGeometry } from "../edge-geometry";
import { publishEndSignals, publishStartSignals } from "../edge-signals";

const THRESHOLDS = {
  startThreshold: 250,
  endThreshold: 250,
  maintainScrollAtEndThreshold: 50,
};

const geometry = (overrides: Partial<IEdgeGeometry> = {}): IEdgeGeometry => ({
  distanceFromStart: 1000,
  distanceFromEnd: 1000,
  isContentShorter: false,
  ...overrides,
});

describe("publishStartSignals", () => {
  it("отмечает упор в начало контента", () => {
    const store = new ListStore();

    publishStartSignals(store, geometry({ distanceFromStart: 0 }), THRESHOLDS);

    expect(store.peek("isAtStart")).toBe(true);
    expect(store.peek("isNearStart")).toBe(true);
  });

  it("считает кромку достигнутой в пределах пикселя", () => {
    const store = new ListStore();

    publishStartSignals(store, geometry({ distanceFromStart: 1 }), THRESHOLDS);
    expect(store.peek("isAtStart")).toBe(true);

    publishStartSignals(store, geometry({ distanceFromStart: 2 }), THRESHOLDS);
    expect(store.peek("isAtStart")).toBe(false);
  });

  it("отдаёт расстояние до начала числом", () => {
    const store = new ListStore();

    // Флаг отвечает «да/нет», а плавным эффектам нужна величина.
    publishStartSignals(
      store,
      geometry({ distanceFromStart: 740 }),
      THRESHOLDS,
    );

    expect(store.peek("distanceFromStart")).toBe(740);
  });

  it("отмечает попадание в пороговую зону начала", () => {
    const store = new ListStore();

    publishStartSignals(
      store,
      geometry({ distanceFromStart: 250 }),
      THRESHOLDS,
    );
    expect(store.peek("isNearStart")).toBe(true);

    publishStartSignals(
      store,
      geometry({ distanceFromStart: 251 }),
      THRESHOLDS,
    );
    expect(store.peek("isNearStart")).toBe(false);
  });
});

describe("publishEndSignals", () => {
  it("отмечает упор в конец контента", () => {
    const store = new ListStore();

    publishEndSignals(store, geometry({ distanceFromEnd: 0 }), THRESHOLDS);

    expect(store.peek("isAtEnd")).toBe(true);
    expect(store.peek("isNearEnd")).toBe(true);
    expect(store.peek("isWithinMaintainScrollAtEndThreshold")).toBe(true);
  });

  it("отдаёт расстояние до конца числом", () => {
    const store = new ListStore();

    publishEndSignals(store, geometry({ distanceFromEnd: 320 }), THRESHOLDS);

    expect(store.peek("distanceFromEnd")).toBe(320);
  });

  it("отдаёт отрицательное расстояние при перелёте за конец", () => {
    const store = new ListStore();

    publishEndSignals(store, geometry({ distanceFromEnd: -25 }), THRESHOLDS);

    expect(store.peek("distanceFromEnd")).toBe(-25);
  });

  it("держит отдельные пороги для подгрузки и автоприлипания", () => {
    const store = new ListStore();

    publishEndSignals(store, geometry({ distanceFromEnd: 100 }), THRESHOLDS);

    expect(store.peek("isNearEnd")).toBe(true);
    expect(store.peek("isWithinMaintainScrollAtEndThreshold")).toBe(false);
  });

  it("считает список прижатым к концу, когда контент короче вьюпорта", () => {
    const store = new ListStore();

    publishEndSignals(
      store,
      geometry({ distanceFromEnd: 3000, isContentShorter: true }),
      THRESHOLDS,
    );

    expect(store.peek("isAtEnd")).toBe(true);
    expect(store.peek("isNearEnd")).toBe(true);
    expect(store.peek("isWithinMaintainScrollAtEndThreshold")).toBe(true);
  });

  it("считает конец достигнутым при перелёте за него", () => {
    const store = new ListStore();

    publishEndSignals(store, geometry({ distanceFromEnd: -50 }), THRESHOLDS);

    expect(store.peek("isAtEnd")).toBe(true);
  });

  it("снимает признаки, когда конец далеко", () => {
    const store = new ListStore();

    publishEndSignals(store, geometry({ distanceFromEnd: 0 }), THRESHOLDS);
    publishEndSignals(store, geometry({ distanceFromEnd: 2000 }), THRESHOLDS);

    expect(store.peek("isAtEnd")).toBe(false);
    expect(store.peek("isNearEnd")).toBe(false);
  });
});
