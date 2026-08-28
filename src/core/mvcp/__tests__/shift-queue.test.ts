import { ShiftQueue } from "../shift-queue";

describe("ShiftQueue — пустая очередь", () => {
  it("ничего не ждёт", () => {
    const queue = new ShiftQueue();

    expect(queue.isSettling()).toBe(false);
    expect(queue.isStale(1000)).toBe(false);
  });
});

describe("ShiftQueue — один сдвиг", () => {
  it("отбрасывает событие с прежним смещением", () => {
    const queue = new ShiftQueue();

    // Сдвинули с 1000 на 1300; событие с 1000 отправлено до транзакции.
    queue.push(300, 1000);

    expect(queue.isSettling()).toBe(true);
    expect(queue.isStale(1000)).toBe(true);
  });

  it("принимает событие с новым смещением и закрывает ожидание", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);

    expect(queue.isStale(1300)).toBe(false);
    expect(queue.isSettling()).toBe(false);
  });

  it("относит событие к ближайшей из возможных позиций", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);

    // 1004 ближе к прежним 1000, чем к применённым 1300.
    expect(queue.isStale(1004)).toBe(true);
  });

  it("принимает событие, перевалившее за середину сдвига", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);

    expect(queue.isStale(1200)).toBe(false);
  });

  it("работает с отрицательным сдвигом", () => {
    const queue = new ShiftQueue();

    queue.push(-200, 1000);

    expect(queue.isStale(1000)).toBe(true);
    expect(queue.isStale(800)).toBe(false);
  });
});

describe("ShiftQueue — очередь сдвигов", () => {
  it("подтверждает сдвиги по одному", () => {
    const queue = new ShiftQueue();

    // Вставка по оценочным размерам, следом уточнение измерением: нативный
    // слой применяет такие сдвиги по очереди.
    queue.push(300, 1000);
    queue.push(-60, 1300);

    expect(queue.isStale(1300)).toBe(true);
    expect(queue.isSettling()).toBe(true);

    expect(queue.isStale(1240)).toBe(false);
    expect(queue.isSettling()).toBe(false);
  });

  it("подтверждает несколько сдвигов разом", () => {
    const queue = new ShiftQueue();

    queue.push(100, 1000);
    queue.push(100, 1100);
    queue.push(100, 1200);

    // Событие пришло уже с полностью применённым смещением.
    expect(queue.isStale(1300)).toBe(false);
    expect(queue.isSettling()).toBe(false);
  });

  it("держит ожидание, пока доехала лишь часть", () => {
    const queue = new ShiftQueue();

    queue.push(100, 1000);
    queue.push(100, 1100);
    queue.push(100, 1200);

    expect(queue.isStale(1200)).toBe(true);
    expect(queue.isStale(1300)).toBe(false);
  });
});

describe("ShiftQueue — живой жест", () => {
  it("не считает устаревшим смещение, ушедшее дальше всех кандидатов", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);

    // Держать это за эхо сдвига — значит заморозить диапазон под пальцем.
    expect(queue.isStale(5000)).toBe(false);
    expect(queue.isSettling()).toBe(false);
  });

  it("не считает устаревшим движение в обратную сторону", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);

    expect(queue.isStale(200)).toBe(false);
  });

  it("после ухода вперёд принимает следующие события", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);
    queue.isStale(5000);

    expect(queue.isStale(5100)).toBe(false);
  });
});

describe("ShiftQueue — страховки", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("сбрасывает очередь, если событий так и не пришло", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);

    // Сдвиг меньше шага пересчёта не порождает ни одного события: без
    // страховки ожидание висело бы до следующего скролла.
    jest.advanceTimersByTime(250);

    expect(queue.isSettling()).toBe(false);
    expect(queue.isStale(1000)).toBe(false);
  });

  it("продлевает страховку каждым новым сдвигом", () => {
    const queue = new ShiftQueue();

    queue.push(100, 1000);
    jest.advanceTimersByTime(200);

    queue.push(100, 1100);
    jest.advanceTimersByTime(200);

    expect(queue.isSettling()).toBe(true);

    jest.advanceTimersByTime(50);
    expect(queue.isSettling()).toBe(false);
  });

  it("снимает ожидание и таймер по требованию", () => {
    const queue = new ShiftQueue();

    queue.push(300, 1000);
    queue.clear();

    expect(queue.isSettling()).toBe(false);

    jest.advanceTimersByTime(250);
    expect(queue.isSettling()).toBe(false);
  });
});
