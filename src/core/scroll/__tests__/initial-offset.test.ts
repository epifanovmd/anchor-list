import { ListMetrics } from "../../../model";
import type { AnchorListInitialScroll } from "../../../types";
import { InitialOffsetResolver } from "../initial-offset";

const ITEM_SIZE = 100;
const SCROLL_LENGTH = 500;

const createResolver = (count = 20) => {
  const metrics = new ListMetrics({ estimatedItemSize: ITEM_SIZE });
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const state = {
    target: undefined as AnchorListInitialScroll | undefined,
    scrollLength: SCROLL_LENGTH,
    /** Шапка, подвал и распорки — в сумму элементов они не входят. */
    padding: 0,
    /** Смещение начала элементов в координатах контента: высота шапки. */
    origin: 0,
    /** Замер контента от ScrollView уже приходил. */
    contentMeasured: true,
    /** Счётчик изменений раскладки: растёт от каждого применённого замера. */
    revision: 0,
    /** Запас, который обязан быть измерен до первого движения. */
    drawDistance: 0,
  };

  metrics.setItems(
    keys,
    keys.map(() => ""),
  );

  const resolver = new InitialOffsetResolver({
    metrics,
    getTarget: () => state.target,
    getScrollLength: () => state.scrollLength,
    getContentSize: () => metrics.getTotalSize() + state.padding,
    getContentOrigin: () => state.origin,
    isContentMeasured: () => state.contentMeasured,
    getLayoutRevision: () => state.revision,
    getDrawDistance: () => state.drawDistance,
  });

  return { metrics, resolver, state };
};

/** Измерить строки, попадающие на экран от `from`: вьюпорт — пять строк. */
const measureViewport = (metrics: ListMetrics, from: number) => {
  for (let index = from; index < from + 5; index += 1) {
    metrics.setMeasuredSize(`k${index}`, ITEM_SIZE);
  }
};

describe("InitialOffsetResolver", () => {
  it("просит целое смещение: дробное нативный слой снимает на свою сетку", () => {
    // Позиции строк дробные — замеры приходят в долях точки. Дробную цель
    // нативный слой кладёт на ближайший пиксель устройства, и список встаёт
    // рядом с просимым, а не в нём. Промах маленький, но всегда в одну сторону:
    // снимок позиции запоминает его, следующее открытие берёт снимок за цель —
    // и стартовая позиция уползает от открытия к открытию.
    const { metrics, resolver, state } = createResolver();

    metrics.setMeasuredSize("k0", 100.9);
    for (let index = 1; index < 20; index += 1) {
      metrics.setMeasuredSize(`k${index}`, 100);
    }

    state.target = { type: "index", index: 10, viewOffset: -20 };

    const offset = resolver.resolve();

    expect(offset).toBe(Math.round(offset ?? 0));
  });

  it("не просит больше, чем нативный слой отдаст у конца", () => {
    // Округление вверх у самой границы недостижимо: список упрётся в конец
    // контента и до просимого не доедет никогда.
    const { resolver, state } = createResolver();

    state.padding = 0.7;
    state.target = { type: "end" };

    // Конец контента 2000.7 при вьюпорте 500: доехать можно до 1500.7.
    expect(resolver.resolve()).toBe(1500);
  });

  it("не знает цели без стартовой позиции", () => {
    const { resolver } = createResolver();

    expect(resolver.resolve()).toBeUndefined();
  });

  it("не знает цели, пока вьюпорт не измерен", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "end" };
    state.scrollLength = 0;

    expect(resolver.resolve()).toBeUndefined();
  });

  it("отдаёт заданное смещение как есть", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "offset", offset: 320 };

    expect(resolver.resolve()).toBe(320);
  });

  it("не уходит выше начала контента при отрицательном смещении", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "offset", offset: -100 };

    expect(resolver.resolve()).toBe(0);
  });

  it("ставит конец контента у нижней кромки", () => {
    const { resolver, state } = createResolver(20);

    state.target = { type: "end" };

    // 20 элементов по 100 при вьюпорте 500.
    expect(resolver.resolve()).toBe(1500);
  });

  it("ставит конец контента над нижней распоркой", () => {
    const { resolver, state } = createResolver(20);

    state.target = { type: "end" };
    // Подвал-распорка под панель ввода: контент выше суммы элементов.
    state.padding = 80;

    // Иначе список открывается с последней строкой под самой панелью.
    expect(resolver.resolve()).toBe(1580);
  });

  it("не скроллит к концу, когда контент короче вьюпорта", () => {
    const { resolver, state } = createResolver(2);

    state.target = { type: "end" };

    expect(resolver.resolve()).toBe(0);
  });

  it("ограничивает прямой offset границей контента", () => {
    const { resolver, state } = createResolver(20);

    state.target = { type: "offset", offset: 5000 };

    expect(resolver.resolve()).toBe(1500);
  });

  it("ставит элемент по индексу", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "index", index: 10 };

    expect(resolver.resolve()).toBe(1000);
  });

  it("учитывает положение элемента во вьюпорте", () => {
    const { resolver, state } = createResolver();

    state.target = {
      type: "index",
      index: 10,
      viewPosition: 1,
      viewOffset: 20,
    };

    // Низ элемента у нижней кромки, минус отступ: 1000 + 100 - 500 - 20.
    expect(resolver.resolve()).toBe(580);
  });

  it("ставит элемент под шапкой", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "index", index: 10 };
    state.origin = 60;

    expect(resolver.resolve()).toBe(1060);
  });

  it("не знает цели для несуществующего индекса", () => {
    const { resolver, state } = createResolver(5);

    state.target = { type: "index", index: 50 };
    expect(resolver.resolve()).toBeUndefined();

    state.target = { type: "index", index: -1 };
    expect(resolver.resolve()).toBeUndefined();
  });

  it("считает цель устаканившейся, когда она перестала уезжать", () => {
    const { metrics, resolver, state } = createResolver();

    state.target = { type: "index", index: 10 };
    // То, что окажется на экране, измерено: иначе доводке ещё есть чего ждать.
    measureViewport(metrics, 10);

    // Первая проверка сравнивать не с чем.
    expect(resolver.isSettled()).toBe(false);
    expect(resolver.isSettled()).toBe(true);

    // Измерение сдвинуло цель — доводить позицию придётся снова.
    metrics.setMeasuredSize("k0", 300);
    state.revision += 1;
    expect(resolver.isSettled()).toBe(false);
    expect(resolver.isSettled()).toBe(true);
  });

  it("не считает устаканившейся невычислимую цель", () => {
    const { resolver } = createResolver();

    expect(resolver.isSettled()).toBe(false);
    expect(resolver.isSettled()).toBe(false);
  });
});

describe("InitialOffsetResolver — готовность цели", () => {
  it("не считает конец списка устаканившимся до замера контента", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "end" };
    state.contentMeasured = false;

    resolver.isSettled();

    // Оба ответа посчитаны без подвала: совпали они не потому, что цель
    // перестала уезжать, а потому, что распорки для списка ещё не существует.
    expect(resolver.isSettled()).toBe(false);
  });

  it("считает цель устаканившейся, когда замер пришёл", () => {
    const { metrics, resolver, state } = createResolver();

    state.target = { type: "end" };
    measureViewport(metrics, 15);

    resolver.isSettled();

    expect(resolver.isSettled()).toBe(true);
  });

  it("не отдаёт цель, пока замер контента не пришёл", () => {
    // Нативный слой обрезает запрос скролла по контенту, который у него уже
    // разложен. Пока замера нет, разложено начало списка, и любой запрос вглубь
    // сходится к нулю: список остаётся у начала, а попытки доводки при этом
    // тратятся впустую и цель «устаканивается» на скролле, которого не было.
    const { resolver, state } = createResolver();

    state.contentMeasured = false;

    state.target = { type: "index", index: 15 };
    expect(resolver.resolve()).toBeUndefined();

    state.target = { type: "offset", offset: 300 };
    expect(resolver.resolve()).toBeUndefined();

    state.target = { type: "end" };
    expect(resolver.resolve()).toBeUndefined();
  });

  it("не считает цель устаканившейся, пока не измерено то, что окажется на экране", () => {
    // Строки меряются только после того, как отрисованы, а отрисованы они будут
    // там, куда доводка уже отвела скролл. Сдаться раньше — значит показать
    // список по оценкам: приехавшие следом замеры переложат ровно те строки, на
    // которые пользователь в этот момент смотрит.
    const { resolver, state, metrics } = createResolver();

    state.target = { type: "index", index: 10 };

    resolver.isSettled();

    expect(resolver.isSettled()).toBe(false);

    // Вьюпорт 500 при строке 100 — на экран попадут пять строк от цели.
    measureViewport(metrics, 10);
    state.revision += 1;

    resolver.isSettled();

    expect(resolver.isSettled()).toBe(true);
  });

  it("проверяет строки перед индексом, прижатым к нижней кромке", () => {
    const { resolver, state, metrics } = createResolver();

    state.target = {
      type: "index",
      index: 10,
      viewPosition: 1,
    };

    // Прежняя проверка шла от цели вперёд и принимала за экран k10…k14.
    // На самом деле при нижнем выравнивании видимы k6…k10.
    measureViewport(metrics, 10);
    resolver.isSettled();

    expect(resolver.isSettled()).toBe(false);
  });

  it("не раскрывает прямой offset поверх неизмеренных строк", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "offset", offset: 1000 };
    resolver.isSettled();

    // Число offset постоянно, но содержимое в этой координате ещё оценочное.
    expect(resolver.isSettled()).toBe(false);
  });

  it("перед стартом с конца измеряет верхний буфер отрисовки", () => {
    const { resolver, state, metrics } = createResolver();

    state.target = { type: "end" };
    state.drawDistance = 400;
    measureViewport(metrics, 15);
    resolver.isSettled();

    // Сам экран k15…k19 готов, но при первом движении вверх в него войдут
    // оценочные k11…k14 и сдвинут все строки под собой.
    expect(resolver.isSettled()).toBe(false);
  });

  it("не ждёт строк, когда стартовый viewport целиком лежит в подвале", () => {
    const { resolver, state } = createResolver();

    state.target = { type: "end" };
    state.padding = 2000;
    resolver.isSettled();

    // Конец элементов на 2000, а viewport занимает 3500…4000: измерять в нём
    // строки нечего.
    expect(resolver.isSettled()).toBe(true);
  });

  it("не гоняется за движением цели меньше точки", () => {
    // Замеры уточняют позиции долями точки, и на экране такое движение не
    // видно. Гоняться за ним значит тратить кадры до показа списка впустую —
    // просимое смещение целое, и дробь до сравнения не доходит.
    const { resolver, state, metrics } = createResolver();

    for (let index = 12; index < 18; index++) {
      metrics.setMeasuredSize(`k${index}`, ITEM_SIZE);
    }

    state.target = { type: "offset", offset: 1239.3 };
    resolver.isSettled();

    state.target = { type: "offset", offset: 1239.4 };
    expect(resolver.isSettled()).toBe(true);

    state.target = { type: "offset", offset: 1241 };
    expect(resolver.isSettled()).toBe(false);
  });

  it("не считает цель устаканившейся, пока приходят замеры", () => {
    // Замер применяется к метрикам сразу, а до цели доходит следующим кадром.
    // Два одинаковых ответа между двумя замерами — это не «позиция
    // устаканилась», а «спросили дважды внутри одного кадра»: список
    // открывается по оценкам, и приехавшие следом замеры сдвигают контент уже
    // на глазах у пользователя.
    const { resolver, state, metrics } = createResolver();

    state.target = { type: "index", index: 10 };
    measureViewport(metrics, 10);

    resolver.isSettled();
    state.revision += 1;

    expect(resolver.isSettled()).toBe(false);

    // Замеров больше нет — вот теперь цель действительно стоит.
    expect(resolver.isSettled()).toBe(true);
  });

  it("отдаёт цель, когда замер пришёл", () => {
    const { resolver, state, metrics } = createResolver();

    state.target = { type: "offset", offset: 300 };
    measureViewport(metrics, 3);

    expect(resolver.resolve()).toBe(300);
    resolver.isSettled();
    expect(resolver.isSettled()).toBe(true);
  });
});
