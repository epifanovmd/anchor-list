import { createDebugChannel } from "../debug-channel";
import { anchorListDebug, setAnchorListDebug } from "../debug-control";
import { debugRegistry } from "../debug-registry";

const channel = createDebugChannel("view", "канал для теста бюджета");

const log = channel.event("tick", {
  about: "поток событий",
  fields: { value: "величина" },
});

describe("реестр диагностики", () => {
  let lines: string[] = [];

  beforeEach(() => {
    lines = [];
    anchorListDebug.configure({ sink: line => lines.push(line) });
  });

  afterEach(() => {
    setAnchorListDebug(false);
    anchorListDebug.configure({ maxLinesPerSecond: 120 });
  });

  it("держит потолок строк в секунду", () => {
    jest.useFakeTimers();
    anchorListDebug.configure({ maxLinesPerSecond: 3 });
    setAnchorListDebug("view");

    for (let index = 0; index < 10; index++) log({ value: index });

    expect(lines).toHaveLength(3);
    jest.useRealTimers();
  });

  it("сообщает, сколько строк подавил, — молча терять лог нельзя", () => {
    jest.useFakeTimers();
    anchorListDebug.configure({ maxLinesPerSecond: 2 });
    setAnchorListDebug("view");

    for (let index = 0; index < 5; index++) log({ value: index });

    jest.advanceTimersByTime(1000);
    log({ value: 99 });

    expect(lines.some(line => line.includes("suppressed=3"))).toBe(true);
    jest.useRealTimers();
  });

  it("отсчитывает время от включения, а не от старта приложения", () => {
    jest.useFakeTimers();
    jest.advanceTimersByTime(60_000);

    setAnchorListDebug("view");
    jest.advanceTimersByTime(250);
    log({ value: 1 });

    // Первая колонка — секунды разбора: с минутами от старта приложения строки
    // двух каналов невозможно сопоставить глазом.
    expect(lines[0]).toContain("0.250");
    jest.useRealTimers();
  });

  it("держит признак канала для UI-потока в согласии с выбором", () => {
    const flag = { value: false };

    debugRegistry.setFlag("view", flag);
    setAnchorListDebug("view");

    expect(flag.value).toBe(true);

    setAnchorListDebug(false);

    expect(flag.value).toBe(false);
  });
});
