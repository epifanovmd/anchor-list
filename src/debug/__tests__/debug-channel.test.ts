import { createDebugChannel } from "../debug-channel";
import { anchorListDebug, setAnchorListDebug } from "../debug-control";

/**
 * Канал заводится один раз на модуль — как это делают настоящие каналы, — а
 * тесты меняют только то, что включено.
 */
const channel = createDebugChannel("scroll", "канал для теста");

const logPlain = channel.event("plain", {
  about: "событие без ключа",
  fields: { a: "первая величина", b: "вторая величина" },
});

const logKeyed = channel.event("keyed", {
  about: "событие с ключом",
  key: "index",
  fields: { index: "за чем наблюдаем", state: "состояние" },
});

const logChanges = channel.event("changes", {
  about: "печатается только на изменениях",
  repeat: "changes",
  key: "index",
  fields: { index: "за чем наблюдаем", state: "состояние" },
});

const logContext = channel.event("context", {
  about: "состояние рядом с живой величиной",
  repeat: "changes",
  compare: ["state"],
  fields: { state: "состояние", scroll: "живое смещение" },
});

const logThrottled = channel.event("throttled", {
  about: "печатается не чаще раза в интервал",
  repeat: { everyMs: 100 },
  fields: { value: "величина" },
});

const logProblem = channel.event("problem", {
  about: "механика не сделала своего дела",
  problem: true,
  fields: { value: "величина" },
});

describe("канал диагностики", () => {
  let lines: string[] = [];

  beforeEach(() => {
    lines = [];
    anchorListDebug.configure({
      sink: line => lines.push(line),
      maxLinesPerSecond: 1000,
    });
  });

  afterEach(() => {
    setAnchorListDebug(false);
  });

  it("молчит, пока канал не включён", () => {
    logPlain({ a: 1, b: 2 });

    expect(lines).toHaveLength(0);
    expect(channel.enabled).toBe(false);
  });

  it("печатает величины в порядке объявления, а не вызова", () => {
    setAnchorListDebug("scroll");

    logPlain({ b: 2, a: 1 });

    expect(lines[0]).toContain("a=1 b=2");
  });

  it("выносит ключевое поле в свою колонку и не повторяет его среди величин", () => {
    setAnchorListDebug("scroll");

    logKeyed({ index: 42, state: "едет" });

    expect(lines[0]).toContain("42");
    expect(lines[0]).toContain("state=едет");
    expect(lines[0]).not.toContain("index=42");
  });

  it("помечает проблемные события отдельным префиксом", () => {
    setAnchorListDebug("scroll");

    logProblem({ value: 1 });
    logPlain({ a: 1, b: 2 });

    expect(lines[0]!.startsWith("[scroll·problem]!")).toBe(true);
    expect(lines[1]!.startsWith("[scroll·plain] ")).toBe(true);
  });

  it("на «changes» повторяет строку только когда она изменилась", () => {
    setAnchorListDebug("scroll");

    logChanges({ index: 1, state: "едет" });
    logChanges({ index: 1, state: "едет" });
    logChanges({ index: 1, state: "стоит" });

    expect(lines).toHaveLength(2);
  });

  it("на «changes» ведёт повторы по каждому ключу отдельно", () => {
    setAnchorListDebug("scroll");

    // Два якоря в одном и том же состоянии: гасить второй по первому нельзя —
    // наблюдения разные.
    logChanges({ index: 1, state: "стоит" });
    logChanges({ index: 2, state: "стоит" });

    expect(lines).toHaveLength(2);
  });

  it("после повторного включения печатает состояние заново", () => {
    setAnchorListDebug("scroll");
    logChanges({ index: 7, state: "стоит" });

    setAnchorListDebug(false);
    setAnchorListDebug("scroll");
    logChanges({ index: 7, state: "стоит" });

    // Первая строка после включения — начало разбора: гасить её по тому, что
    // печаталось в прошлый раз, значит показать пустой лог на живом списке.
    expect(lines).toHaveLength(2);
  });

  it("сравнивает только названные величины, а печатает все", () => {
    setAnchorListDebug("scroll");

    logContext({ state: "стоит", scroll: 100 });
    logContext({ state: "стоит", scroll: 220 });
    logContext({ state: "едет", scroll: 340 });

    // Живое смещение печатается как контекст, но менять строку не должно:
    // иначе состояние тонет в потоке собственного контекста.
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("scroll=100");
    expect(lines[1]).toContain("state=едет scroll=340");
  });

  it("на интервале пропускает события, пришедшие раньше срока", () => {
    jest.useFakeTimers();
    setAnchorListDebug("scroll");

    logThrottled({ value: 1 });
    logThrottled({ value: 2 });
    jest.advanceTimersByTime(150);
    logThrottled({ value: 3 });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("value=1");
    expect(lines[1]).toContain("value=3");
    jest.useRealTimers();
  });

  it("включает только названные события канала", () => {
    setAnchorListDebug({ scroll: ["plain"] });

    logPlain({ a: 1, b: 2 });
    logKeyed({ index: 1, state: "едет" });

    expect(lines).toHaveLength(1);
    expect(channel.on("plain")).toBe(true);
    expect(channel.on("keyed")).toBe(false);
    // Канал включён частично — дорогие подготовки под этой проверкой нужны.
    expect(channel.enabled).toBe(true);
  });

  it("печатает отсутствующую величину прочерком, а не пропускает колонку", () => {
    setAnchorListDebug("scroll");

    logPlain({ a: undefined, b: 2 });

    expect(lines[0]).toContain("a=— b=2");
  });
});
