import { resolveInsetEnd } from "../inset-end";

/** Высота списка на экране. */
const SCROLL_LENGTH = 560;
/** Перекрытие с закрытой клавиатурой: панель ввода и безопасная зона. */
const CLOSED = 90;
/** То же с открытой. */
const OPEN = 392;

const resolve = (params: {
  scroll?: number;
  previousInset?: number;
  insetEnd?: number;
  rows: number;
  alignItemsAtEnd?: boolean;
}) =>
  resolveInsetEnd({
    scroll: params.scroll ?? 0,
    previousInset: params.previousInset ?? CLOSED,
    insetEnd: params.insetEnd ?? OPEN,
    baseHeight: params.rows,
    scrollLength: SCROLL_LENGTH,
    alignItemsAtEnd: params.alignItemsAtEnd ?? true,
  });

describe("resolveInsetEnd", () => {
  it("прижимает короткий контент к верхней кромке панели", () => {
    // 380 контента при списке 560: под панель отдано 90, значит сдвиг — 90.
    const { alignOffset } = resolve({ rows: 380, insetEnd: CLOSED });

    expect(alignOffset).toBe(90);
    // Низ контента ровно на кромке панели.
    expect(alignOffset + 380).toBe(SCROLL_LENGTH - CLOSED);
  });

  it("в коротком списке поднимает сдвигом, а не скроллом", () => {
    // Прокручивать нечего: место под клавиатуру берётся из сдвига.
    const { alignOffset, scroll } = resolve({ rows: 100, insetEnd: 200 });

    expect(alignOffset).toBe(260);
    expect(scroll).toBe(0);
  });

  it("в длинном списке поднимает смещением", () => {
    const { alignOffset, scroll } = resolve({ rows: 5000, scroll: 1000 });

    expect(alignOffset).toBe(0);
    expect(scroll).toBe(1000 + (OPEN - CLOSED));
  });

  it("на границе делит подъём между сдвигом и скроллом", () => {
    // Контента 380: сдвига хватает на 90 из 302, остальные 212 берёт скролл.
    const { alignOffset, scroll } = resolve({ rows: 380 });

    expect(alignOffset).toBe(0);
    expect(scroll).toBe(212);
    // Ровно столько, сколько нужно, чтобы низ контента встал на кромку панели.
    expect(380 - scroll).toBe(SCROLL_LENGTH - OPEN);
  });

  it("возвращает контент на место при закрытии", () => {
    const { alignOffset, scroll } = resolve({
      rows: 380,
      scroll: 212,
      previousInset: OPEN,
      insetEnd: CLOSED,
    });

    expect(alignOffset).toBe(90);
    expect(scroll).toBe(0);
  });

  it("не двигает скролл, когда отступ не менялся", () => {
    // Новое сообщение уменьшает сдвиг выравнивания, но подъём тут не наш: этим
    // занимаются удержание позиции и прилипание к концу.
    const { alignOffset, scroll } = resolve({
      rows: 500,
      scroll: 30,
      previousInset: CLOSED,
      insetEnd: CLOSED,
    });

    expect(alignOffset).toBe(0);
    expect(scroll).toBe(30);
  });

  it("без выравнивания поднимает только смещением", () => {
    const { alignOffset, scroll } = resolve({
      rows: 380,
      alignItemsAtEnd: false,
    });

    expect(alignOffset).toBe(0);
    // Диапазона хватает ровно на то, чтобы низ контента встал на кромку.
    expect(scroll).toBe(212);
  });

  it("держит распорку впереди отступа, пока тот растёт", () => {
    // Иначе у самого низа списка запрос обрезается по прежней границе: контент
    // отстаёт от клавиатуры ровно на кадр, и это видно.
    const { spacer } = resolve({
      rows: 5000,
      previousInset: 300,
      insetEnd: 320,
    });

    expect(spacer).toBeGreaterThan(320);

    // На закрытии запас не нужен: там граница только сжимается, и обрезать
    // нативному слою нечего.
    expect(
      resolve({ rows: 5000, previousInset: 320, insetEnd: 300 }).spacer,
    ).toBe(300);

    // И в коротком списке не нужен: подъём делает сдвиг, а прокручивать нечего.
    expect(
      resolve({ rows: 100, previousInset: 90, insetEnd: 200 }).spacer,
    ).toBe(200);
  });

  it("возвращает низ на кромку, если он там и стоял", () => {
    // Нативное смещение приходит с округлением до трети точки. Сложи дельту с
    // ним — и низ отползает от кромки на долю за ход, а за несколько открытий
    // клавиатуры это уже зазор.
    const rows = 5000;
    const closedMax = rows + CLOSED - SCROLL_LENGTH;
    const { scroll } = resolve({
      rows,
      scroll: closedMax - 0.7,
      previousInset: CLOSED,
      insetEnd: OPEN,
    });

    expect(scroll).toBe(rows + OPEN - SCROLL_LENGTH);
  });

  it("копит подъём по кадрам, не теряя долей точки", () => {
    // Хвост анимации клавиатуры идёт дельтами меньше точки. Считать каждую от
    // фактического смещения нельзя: нативный слой отвечает с округлением и на
    // кадр позже, и остаток каждого такого кадра пропадал бы — контент
    // оставался бы ниже, чем должен.
    const rows = 380;
    const steps = [200, 300, 380, 390, 390.4, 390.7, 391, 392];
    let scroll = 0;

    for (let index = 0; index < steps.length; index++) {
      scroll = resolve({
        rows,
        scroll,
        previousInset: index === 0 ? CLOSED : steps[index - 1]!,
        insetEnd: steps[index]!,
      }).scroll;
    }

    // Низ контента ровно на кромке панели, до последней доли.
    expect(rows - scroll).toBeCloseTo(SCROLL_LENGTH - 392);
  });

  it("опускает контент на ту же величину при закрытии не у конца", () => {
    const { scroll } = resolve({
      rows: 5000,
      scroll: 1000,
      previousInset: OPEN,
      insetEnd: CLOSED,
    });

    expect(scroll).toBe(1000 - (OPEN - CLOSED));
  });

  it("не уводит смещение выше начала контента", () => {
    // Опускать некуда: выше первой строки контента нет.
    const { scroll } = resolve({
      rows: 5000,
      scroll: 50,
      previousInset: OPEN,
      insetEnd: CLOSED,
    });

    expect(scroll).toBe(0);
  });

  it("в покое распорка равна отступу", () => {
    // Запас нужен только на ходу: он даёт нативной раскладке кадр форы.
    const { spacer } = resolve({
      rows: 5000,
      previousInset: OPEN,
      insetEnd: OPEN,
    });

    expect(spacer).toBe(OPEN);
  });

  it("не уходит в минус, когда отступ выше экрана", () => {
    // Клавиатура вместе с панелью заняла больше, чем сам список.
    const { alignOffset } = resolve({
      rows: 100,
      insetEnd: SCROLL_LENGTH + 100,
    });

    expect(alignOffset).toBe(0);
  });

  it("не уводит смещение за пределы контента", () => {
    // Контента меньше экрана даже с отступом: двигать некуда.
    const { scroll } = resolve({
      rows: 100,
      alignItemsAtEnd: false,
      insetEnd: 200,
    });

    expect(scroll).toBe(0);
  });
});
