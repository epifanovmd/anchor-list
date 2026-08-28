import { ListMetrics, ListStore } from "../../../model";
import { MaintainVisibleContentPosition } from "../mvcp";

/**
 * Сценарии удержания позиции на реальном списке.
 *
 * Стенд повторяет переписку: сообщения разной высоты, шапка над ними, вьюпорт
 * в пол-экрана. Проверяется одно — экранное положение строки, на которую
 * смотрит пользователь, до и после изменения. Именно оно и «прыгает», когда
 * компенсация ошибается.
 */
interface IMessage {
  key: string;
  size: number;
}

const VIEWPORT = 500;
/** Шапка списка: в сумму элементов не входит, но в высоту контента — да. */
const HEADER = 60;

const messages = (count: number, prefix: string, size = 100): IMessage[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `${prefix}${index}`,
    size,
  }));

const createChat = (initial: IMessage[], scroll: number, padding = HEADER) => {
  const store = new ListStore();
  const metrics = new ListMetrics({ estimatedItemSize: 100 });
  const state = { scroll, messages: initial };

  const layout = () => {
    metrics.setItems(
      state.messages.map(message => message.key),
      state.messages.map(() => ""),
    );
    for (const message of state.messages) {
      metrics.setMeasuredSize(message.key, message.size);
    }
  };

  layout();

  const mvcp = new MaintainVisibleContentPosition({
    store,
    metrics,
    adapter: () => undefined,
    getScroll: () => state.scroll,
    getScrollLength: () => VIEWPORT,
    getContentSize: () => metrics.getTotalSize() + padding,
  });

  /** Где верх строки относительно верхней кромки экрана. */
  const screenTop = (key: string): number | undefined => {
    const position = metrics.getPositionByKey(key);

    return position === undefined ? undefined : position - state.scroll;
  };

  /** Одно обновление списка целиком: снятие якоря, смена данных, восстановление. */
  const update = (next: IMessage[], reason = "данные"): void => {
    mvcp.capture(reason);
    state.messages = next;
    layout();
    state.scroll = mvcp.restore(reason);
  };

  /** Изменение высоты уже отрисованной строки. */
  const resize = (key: string, size: number): void => {
    update(
      state.messages.map(message =>
        message.key === key ? { ...message, size } : message,
      ),
      "размер",
    );
  };

  return { store, metrics, state, mvcp, screenTop, update, resize };
};

describe("Сценарий: подгрузка истории сверху", () => {
  it("держит читаемое сообщение на месте", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    chat.update([...messages(20, "h"), ...chat.state.messages]);

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.state.scroll).toBe(4000);
  });

  it("держит позицию, когда пользователь стоит у самого начала", () => {
    const chat = createChat(messages(40, "m"), 0);

    chat.update([...messages(20, "h"), ...chat.state.messages]);

    // Иначе первое сообщение прошлой порции уезжает вниз на весь её экран.
    expect(chat.screenTop("m0")).toBe(0);
    expect(chat.state.scroll).toBe(2000);
  });

  it("держит позицию, когда строка загрузки исчезает вместе с порцией", () => {
    const chat = createChat(
      [{ key: "loader", size: 60 }, ...messages(40, "m")],
      0,
    );
    // Первая видимая строка — та самая заглушка, и она не переживёт обновление.
    const before = chat.screenTop("m0");

    chat.update([...messages(20, "h"), ...messages(40, "m")]);

    // Опорой стало первое сообщение под заглушкой — оно и держит экран.
    expect(chat.screenTop("m0")).toBe(before);
  });

  it("держит позицию при подгрузке разнородных сообщений", () => {
    const history = [
      { key: "h0", size: 240 },
      { key: "h1", size: 44 },
      { key: "h2", size: 380 },
    ];
    const chat = createChat(messages(40, "m", 92), 1500);
    const anchor = chat.metrics.getKey(
      chat.metrics.findIndexAtOffset(1500) + 1,
    )!;
    const before = chat.screenTop(anchor);

    chat.update([...history, ...chat.state.messages]);

    expect(chat.screenTop(anchor)).toBe(before);
  });

  it("выдерживает три подгрузки подряд", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");
    let head: IMessage[] = [];

    for (let page = 0; page < 3; page++) {
      head = [...messages(20, `p${page}-`), ...head];
      chat.update([...head, ...messages(40, "m")]);
    }

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.state.scroll).toBe(8000);
  });
});

describe("Сценарий: правка и рост сообщений", () => {
  it("держит позицию, когда сообщение выше экрана стало длиннее", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    // Отредактированный текст занял на две строки больше.
    chat.resize("m5", 148);

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.state.scroll).toBe(2048);
  });

  it("держит позицию, когда картинка выше экрана догрузилась", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    // До загрузки у вложения была высота заглушки.
    chat.resize("m3", 420);

    expect(chat.screenTop("m20")).toBe(before);
  });

  it("держит позицию, когда сообщение выше экрана свернули", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    chat.resize("m7", 40);

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.state.scroll).toBe(1940);
  });

  it("не двигает экран, когда меняется сообщение под ним", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const scroll = chat.state.scroll;

    chat.resize("m30", 400);

    expect(chat.state.scroll).toBe(scroll);
    expect(chat.store.peek("scrollAdjust")).toBe(0);
  });

  it("держит нижние строки, когда растёт первая видимая", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m21");

    // Строка внутри экрана растёт вниз: якорем становится она сама, и всё, что
    // под ней, законно уезжает.
    chat.resize("m20", 300);

    expect(chat.screenTop("m20")).toBe(0);
    expect(chat.screenTop("m21")).toBe(before! + 200);
  });

  it("не опирается на строку, торчащую над кромкой экрана", () => {
    const chat = createChat(messages(40, "m"), 2050);
    const before = chat.screenTop("m21");

    // Держать верх наполовину видимой строки — значит увести весь экран.
    chat.resize("m20", 40);

    expect(chat.screenTop("m21")).toBe(before);
  });
});

describe("Сценарий: удаление сообщений", () => {
  it("держит позицию при удалении сообщения выше экрана", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    chat.update(chat.state.messages.filter(message => message.key !== "m4"));

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.state.scroll).toBe(1900);
  });

  it("держит позицию при удалении целой пачки сверху", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    chat.update(chat.state.messages.slice(10));

    expect(chat.screenTop("m20")).toBe(before);
  });

  it("переходит на соседа, когда удалено само читаемое сообщение", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m21");

    chat.update(chat.state.messages.filter(message => message.key !== "m20"));

    // Экран держится по следующему снятому кандидату.
    expect(chat.screenTop("m21")).toBe(before);
  });

  it("не двигает экран при удалении под ним", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const scroll = chat.state.scroll;

    chat.update(chat.state.messages.slice(0, 35));

    expect(chat.state.scroll).toBe(scroll);
  });

  it("не повторяет сдвиг, который ScrollView сделает сам у конца переписки", () => {
    // 40 сообщений по 100 плюс шапка 60: конец на 3560.
    const chat = createChat(messages(40, "m"), 3560);

    chat.update(chat.state.messages.slice(5));

    // Контент стал короче на 500, и ровно на столько ScrollView подтянет сам.
    expect(chat.store.peek("scrollAdjust")).toBe(0);
    expect(chat.state.scroll).toBe(3060);
  });

  it("прижимает экран к началу, когда контента под якорь не осталось", () => {
    const chat = createChat(messages(40, "m"), 2000);

    chat.update(chat.state.messages.slice(0, 22));

    // 2200 контента плюс шапка при вьюпорте 500 — дальше 1760 не уйти.
    expect(chat.state.scroll).toBe(1760);
  });
});

describe("Сценарий: новые сообщения снизу", () => {
  it("не двигает экран при новом сообщении в конце", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    chat.update([...chat.state.messages, { key: "fresh", size: 92 }]);

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.store.peek("scrollAdjust")).toBe(0);
  });

  it("не двигает экран при подгрузке страницы вниз", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const scroll = chat.state.scroll;

    chat.update([...chat.state.messages, ...messages(20, "next")]);

    expect(chat.state.scroll).toBe(scroll);
  });
});

describe("Сценарий: пользователь скроллит во время изменений", () => {
  it("не удваивает движение пальца", () => {
    const chat = createChat(messages(40, "m"), 2000);

    chat.mvcp.capture("данные");
    // За кадр между снятием якоря и пересчётом палец увёл список на 180px.
    chat.state.scroll = 1820;
    chat.state.messages = [...messages(20, "h"), ...chat.state.messages];
    chat.metrics.setItems(
      chat.state.messages.map(message => message.key),
      chat.state.messages.map(() => ""),
    );
    for (const message of chat.state.messages) {
      chat.metrics.setMeasuredSize(message.key, message.size);
    }
    chat.state.scroll = chat.mvcp.restore("данные");

    // Компенсация ровно на высоту порции, движение пальца в неё не входит.
    expect(chat.state.scroll).toBe(3820);
    expect(chat.store.peek("scrollAdjust")).toBe(2000);
  });

  it("отбрасывает события скролла, отправленные до применения сдвига", () => {
    const chat = createChat(messages(40, "m"), 2000);

    chat.update([...messages(20, "h"), ...chat.state.messages]);

    // Нативный слой ещё не применил сдвиг: событие несёт прежнее смещение.
    expect(chat.mvcp.isStaleScroll(2004)).toBe(true);
    expect(chat.mvcp.isStaleScroll(4000)).toBe(false);
  });

  it("не замораживает диапазон, когда палец увёл список дальше сдвига", () => {
    const chat = createChat(messages(40, "m"), 2000);

    chat.update([...messages(20, "h"), ...chat.state.messages]);

    expect(chat.mvcp.isStaleScroll(9000)).toBe(false);
    expect(chat.mvcp.isSettling()).toBe(false);
  });
});

describe("Сценарий: несколько изменений в одном кадре", () => {
  it("считает базой раскладку до первого из них", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    // Пришла порция истории, и в том же кадре уточнилась высота одного из её
    // сообщений: базой обязана остаться раскладка до обоих изменений.
    chat.mvcp.capture("данные");
    chat.state.messages = [...messages(20, "h"), ...chat.state.messages];
    chat.mvcp.capture("размер");
    chat.state.messages = chat.state.messages.map(message =>
      message.key === "h0" ? { key: "h0", size: 260 } : message,
    );
    chat.metrics.setItems(
      chat.state.messages.map(message => message.key),
      chat.state.messages.map(() => ""),
    );
    for (const message of chat.state.messages) {
      chat.metrics.setMeasuredSize(message.key, message.size);
    }
    chat.state.scroll = chat.mvcp.restore("данные");

    expect(chat.screenTop("m20")).toBe(before);
    expect(chat.state.scroll).toBe(4160);
  });

  it("подтверждает два сдвига подряд по очереди", () => {
    const chat = createChat(messages(40, "m"), 2000);

    // Вставка по оценочным размерам…
    chat.update([...messages(20, "h"), ...chat.state.messages]);
    // …и уточнение измерением следующим кадром.
    chat.resize("h0", 60);

    expect(chat.state.scroll).toBe(3960);
    expect(chat.mvcp.isStaleScroll(4000)).toBe(true);
    expect(chat.mvcp.isStaleScroll(3960)).toBe(false);
  });
});

describe("Сценарий: доли пикселя", () => {
  it("не теряет дробный рост строк за десяток обновлений", () => {
    const chat = createChat(messages(40, "m"), 2000);

    // Плотность экрана даёт высоты вроде 100.3 — целыми точками они не ложатся.
    for (let pass = 1; pass <= 10; pass++) {
      chat.resize("m5", 100 + pass * 0.3);
    }

    expect(chat.store.peek("scrollAdjust")).toBe(3);
    expect(chat.screenTop("m20")).toBe(0);
  });

  it("держит экран точно при дробных высотах всех сообщений", () => {
    const chat = createChat(messages(40, "m", 92.5), 1850);
    const before = chat.screenTop("m20");

    chat.update([...messages(4, "h", 92.5), ...chat.state.messages]);

    expect(chat.screenTop("m20")).toBe(before);
  });
});

describe("Сценарий: смена содержимого целиком", () => {
  it("ничего не компенсирует при переходе в другой чат", () => {
    const chat = createChat(messages(40, "m"), 2000);

    chat.update(messages(40, "other"));

    // Не выжил ни один якорь: восстанавливать не по чему.
    expect(chat.store.peek("scrollAdjust")).toBe(0);
    expect(chat.state.scroll).toBe(2000);
  });

  it("ничего не компенсирует на опустевшем списке", () => {
    const chat = createChat(messages(40, "m"), 2000);

    chat.update([]);

    expect(chat.store.peek("scrollAdjust")).toBe(0);
  });

  it("ничего не компенсирует, пока список пуст", () => {
    const chat = createChat([], 0);

    chat.update(messages(40, "m"));

    expect(chat.store.peek("scrollAdjust")).toBe(0);
    expect(chat.state.scroll).toBe(0);
  });

  it("компенсирует переезд сообщения вниз при пересортировке", () => {
    const chat = createChat(messages(40, "m"), 2000);
    const before = chat.screenTop("m20");

    // Отложенная отправка: сообщение уехало в конец списка.
    chat.update([
      ...chat.state.messages.filter(message => message.key !== "m2"),
      { key: "m2", size: 100 },
    ]);

    expect(chat.screenTop("m20")).toBe(before);
  });
});

describe("Сценарий: короткая переписка", () => {
  it("не двигает экран, когда скроллить некуда", () => {
    const chat = createChat(messages(3, "m"), 0, 0);

    chat.update([...messages(1, "h"), ...chat.state.messages]);

    // 400 контента при вьюпорте 500: границей остаётся ноль, и удерживать
    // позицию нечем — контент просто не сдвинется.
    expect(chat.state.scroll).toBe(0);
    expect(chat.store.peek("scrollAdjust")).toBe(0);
  });

  it("сдвигает экран настолько, насколько позволяет граница", () => {
    const chat = createChat(messages(3, "m"), 0);

    chat.update([...messages(2, "h"), ...chat.state.messages]);

    // Держать первое сообщение на месте нужно 200px, а контента хватает на 60:
    // экран уезжает до упора и там останавливается.
    expect(chat.state.scroll).toBe(60);
    expect(chat.store.peek("scrollAdjust")).toBe(60);
  });

  it("держит позицию, когда контента ровно на экран", () => {
    const chat = createChat(messages(5, "m"), 60, 0);

    chat.update([...messages(1, "h"), ...chat.state.messages]);

    expect(chat.state.scroll).toBe(100);
  });
});
