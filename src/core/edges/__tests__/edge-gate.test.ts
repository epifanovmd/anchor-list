import { EdgeGate } from "../edge-gate";

describe("EdgeGate", () => {
  it("открыт в покое", () => {
    const gate = new EdgeGate();

    expect(gate.isOpen()).toBe(true);
  });

  it("закрывается сработавшей кромкой", () => {
    const gate = new EdgeGate();

    gate.close();

    expect(gate.isOpen()).toBe(false);
  });

  it("не разблокирует кромку без завершённого жеста", () => {
    const gate = new EdgeGate();

    gate.close();

    expect(gate.beginGesture(-1)).toBeUndefined();
  });

  it("разблокирует начальную кромку при движении к началу", () => {
    const gate = new EdgeGate();

    gate.close();
    gate.prepareForNextGesture();

    expect(gate.beginGesture(-1)).toBe("start");
    expect(gate.isOpen()).toBe(false);
  });

  it("разблокирует конечную кромку при движении к концу", () => {
    const gate = new EdgeGate();

    gate.close();
    gate.prepareForNextGesture();

    expect(gate.beginGesture(1)).toBe("end");
  });

  it("считает нулевую скорость движением к концу", () => {
    const gate = new EdgeGate();

    gate.close();
    gate.prepareForNextGesture();

    expect(gate.beginGesture(0)).toBe("end");
  });

  it("не готовит к жесту уже открытый гейт", () => {
    const gate = new EdgeGate();

    gate.prepareForNextGesture();

    expect(gate.isOpen()).toBe(true);
    expect(gate.beginGesture(-1)).toBeUndefined();
  });

  it("разблокирует ровно один жест", () => {
    const gate = new EdgeGate();

    gate.close();
    gate.prepareForNextGesture();
    gate.beginGesture(-1);

    expect(gate.beginGesture(-1)).toBeUndefined();
  });

  it("открывается, когда обе кромки далеко", () => {
    const gate = new EdgeGate();

    gate.close();
    gate.open();

    expect(gate.isOpen()).toBe(true);
  });
});

describe("EdgeGate — право на колбэк", () => {
  it("пропускает всё, пока гейт открыт", () => {
    const gate = new EdgeGate();

    expect(gate.canDispatch("start", undefined, true)).toBe(true);
    expect(gate.canDispatch("end", undefined, true)).toBe(true);
  });

  it("пропускает только разблокированную кромку", () => {
    const gate = new EdgeGate();

    gate.close();

    expect(gate.canDispatch("start", "start", false)).toBe(true);
    expect(gate.canDispatch("end", "start", false)).toBe(false);
  });

  it("пропускает вторую кромку, если гейт был открыт на входе в проверку", () => {
    const gate = new EdgeGate();

    // Проверка успевает закрыть гейт сама — сработавшей ранее кромкой.
    gate.close();

    expect(gate.canDispatch("start", undefined, true)).toBe(true);
  });

  it("держит вторую кромку, когда гейт был закрыт до проверки", () => {
    const gate = new EdgeGate();

    gate.close();

    expect(gate.canDispatch("start", undefined, false)).toBe(false);
  });
});
