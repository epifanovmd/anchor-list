import { getStickyOffset, isPinnedAtEdge } from "../sticky-offset";

const SCROLL_LENGTH = 500;

const offsetAtStart = (
  params: Partial<Parameters<typeof getStickyOffset>[0]>,
) =>
  getStickyOffset({
    edge: "start",
    position: 1000,
    size: 100,
    scrollLength: SCROLL_LENGTH,
    scroll: 0,
    edgeOffset: 0,
    limit: undefined,
    stickySize: 100,
    contentOrigin: 0,
    ...params,
  });

const offsetAtEnd = (params: Partial<Parameters<typeof getStickyOffset>[0]>) =>
  getStickyOffset({
    edge: "end",
    position: 1000,
    size: 100,
    scrollLength: SCROLL_LENGTH,
    scroll: 0,
    edgeOffset: 0,
    limit: undefined,
    stickySize: 100,
    contentOrigin: 0,
    ...params,
  });

describe("getStickyOffset — начальная кромка", () => {
  it("не двигает элемент, пока кромка его не догнала", () => {
    expect(offsetAtStart({ scroll: 500 })).toBe(0);
  });

  it("сдвигает ровно настолько, насколько кромка его обогнала", () => {
    expect(offsetAtStart({ scroll: 1300 })).toBe(300);
  });

  it("учитывает отступ кромки", () => {
    // Навбар опустил кромку на 80: элемент прилипает раньше.
    expect(offsetAtStart({ scroll: 1000, edgeOffset: 80 })).toBe(80);
  });

  it("упирается в следующий якорь", () => {
    // Следующий якорь подъезжает снизу и выталкивает текущий за кромку.
    expect(offsetAtStart({ scroll: 1400, limit: 1200 })).toBe(200);
  });

  it("не выталкивает элемент выше его обычного места", () => {
    expect(offsetAtStart({ scroll: 0, limit: 900 })).toBe(-100);
  });
});

describe("getStickyOffset — конечная кромка", () => {
  it("не двигает элемент, пока его низ виден", () => {
    expect(offsetAtEnd({ scroll: 700 })).toBe(0);
  });

  it("поднимает элемент, ушедший ниже кромки", () => {
    // Вьюпорт 0..500, низ элемента на 1100: подтягиваем к кромке.
    expect(offsetAtEnd({ scroll: 0 })).toBe(-600);
  });

  it("учитывает отступ кромки", () => {
    // Панель ввода подняла кромку на 100.
    expect(offsetAtEnd({ scroll: 0, edgeOffset: 100 })).toBe(-700);
  });

  it("не поднимает объект выше начала его группы", () => {
    // Кромка внутри группы на 820, верх группы на 800: низ строки высотой 100
    // не поднимется выше 900, иначе строка вылезет за свою группу.
    expect(offsetAtEnd({ scroll: 320, limit: 800, stickySize: 100 })).toBe(
      -200,
    );
  });

  it("прижимает к кромке, пока предел не достигнут", () => {
    expect(offsetAtEnd({ scroll: 500, limit: 800, stickySize: 100 })).toBe(
      -100,
    );
  });

  it("не всплывает раньше своей группы", () => {
    // Группа целиком ниже кромки: объект стоит у её начала (600) и вместе с ней
    // ждёт за нижним краем экрана — вьюпорт кончается на 500.
    expect(offsetAtEnd({ scroll: 0, limit: 600 })).toBe(-400);
  });

  /**
   * Та самая жалоба: аватар пропадал, не дойдя до низа экрана, и появлялся
   * обратно не из-за края, а в той же точке, где исчез.
   *
   * Причиной была отдельная ветка «группа ещё не доехала» с досрочным нулём:
   * на границе `кромка == начало группы` смещение скачком менялось на высоту
   * группы. Зажим по началу группы закрывает этот случай сам, и уже непрерывно.
   */
  it("проходит границу начала группы без скачка", () => {
    const limit = 600;
    // Кромка ровно на начале группы и на пиксель дальше.
    const before = offsetAtEnd({ scroll: 100, limit });
    const after = offsetAtEnd({ scroll: 101, limit });

    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });

  it("движется непрерывно на всём подъезде группы", () => {
    const limit = 600;
    const samples = Array.from({ length: 40 }, (_, step) =>
      offsetAtEnd({ scroll: 80 + step * 10, limit }),
    );

    // Шаг скролла 10px: смещение не должно меняться быстрее самого скролла.
    for (let index = 1; index < samples.length; index++) {
      expect(
        Math.abs(samples[index]! - samples[index - 1]!),
      ).toBeLessThanOrEqual(10);
    }
  });

  it("считает предел от высоты прилипающего объекта, а не строки", () => {
    // Аватар 36 в строке 100: он поднимается выше, чем поднялась бы строка.
    expect(offsetAtEnd({ scroll: 320, limit: 800, stickySize: 36 })).toBe(-264);
  });
});

const start = (overrides = {}) =>
  isPinnedAtEdge({
    edge: "start" as const,
    position: 1000,
    size: 44,
    scrollLength: 800,
    scroll: 1100,
    edgeOffset: 0,
    limit: 1500,
    stickySize: 44,
    contentOrigin: 0,
    ...overrides,
  });

const end = (overrides = {}) =>
  isPinnedAtEdge({
    edge: "end" as const,
    position: 1150,
    size: 120,
    scrollLength: 800,
    scroll: 400,
    edgeOffset: 0,
    limit: 900,
    stickySize: 36,
    contentOrigin: 0,
    ...overrides,
  });

describe("isPinnedAtEdge — начальная кромка", () => {
  it("стоит у кромки, пока кромка внутри хода якоря", () => {
    expect(start()).toBe(true);
  });

  it("не стоит, пока кромка не догнала якорь", () => {
    // Якорь едет вместе с контентом на своём месте.
    expect(start({ scroll: 900 })).toBe(false);
  });

  it("не стоит, когда его уже выталкивает следующий якорь", () => {
    // Ход упёрся в предел: позиция в координатах контента снова постоянна.
    expect(start({ scroll: 1600 })).toBe(false);
  });

  it("стоит без предела, пока кромка прошла якорь", () => {
    expect(start({ limit: undefined, scroll: 9000 })).toBe(true);
  });

  it("учитывает отступ кромки", () => {
    expect(start({ scroll: 990, edgeOffset: 20 })).toBe(true);
    expect(start({ scroll: 970, edgeOffset: 20 })).toBe(false);
  });
});

describe("isPinnedAtEdge — конечная кромка", () => {
  it("стоит у кромки, пока группа пересекает её", () => {
    expect(end()).toBe(true);
  });

  it("не стоит, пока низ якоря выше кромки", () => {
    expect(end({ scroll: 500 })).toBe(false);
  });

  it("не стоит, когда упёрся в начало группы", () => {
    // Объект прижат к верху группы и едет вместе с ней.
    expect(end({ scroll: 100 })).toBe(false);
  });

  it("стоит без предела, пока низ ниже кромки", () => {
    expect(end({ limit: undefined, scroll: 0 })).toBe(true);
  });

  it("учитывает отступ кромки", () => {
    expect(end({ scroll: 340, edgeOffset: 0 })).toBe(true);
    expect(end({ scroll: 340, edgeOffset: 250 })).toBe(false);
  });
});

/**
 * Шапка списка сдвигает начало элементов.
 *
 * Жалоба звучала так: с шапкой прилипшая дата встаёт не у кромки, а ниже неё,
 * и соседние даты выталкивают друг друга не там, где сходятся их края. Позиции
 * строк и пределы считаются от начала элементов, а смещение скролла приходит
 * нативное — от начала контента, вместе с шапкой. Расходятся они ровно на её
 * высоту, и без поправки вся геометрия прилипания уезжает на неё же.
 */
describe("начало координат элементов", () => {
  it("снимает шапку со смещения скролла у начальной кромки", () => {
    // Шапка 30: строка на 1000 в координатах элементов лежит в контенте на
    // 1030 и кромки достигает ровно при этом нативном смещении.
    expect(offsetAtStart({ scroll: 1030, contentOrigin: 30 })).toBe(0);
    // Дальше кромка обгоняет её на 300 — не на 330.
    expect(offsetAtStart({ scroll: 1330, contentOrigin: 30 })).toBe(300);
  });

  it("не даёт якорю прилипнуть раньше, чем он дошёл до кромки", () => {
    // Строка ещё в 10 пикселях ниже кромки: двигать её нечем.
    expect(offsetAtStart({ scroll: 1020, contentOrigin: 30 })).toBe(0);
  });

  it("снимает шапку со смещения скролла у конечной кромки", () => {
    // При шапке 30 и нативном смещении 30 элементы стоят там же, где без
    // шапки при нуле.
    expect(offsetAtEnd({ scroll: 30, contentOrigin: 30 })).toBe(
      offsetAtEnd({ scroll: 0 }),
    );
  });

  it("держит признак «стоит у кромки» в тех же координатах", () => {
    // Кромка ещё не дошла до якоря: в координатах элементов скролл 900.
    expect(start({ scroll: 1100, contentOrigin: 200 })).toBe(false);
    // Низ группы виден — аватар стоит на своём месте, а не у кромки.
    expect(end({ scroll: 400, contentOrigin: 300 })).toBe(false);
  });
});
