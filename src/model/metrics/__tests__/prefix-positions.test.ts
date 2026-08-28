import { PrefixPositions } from "../prefix-positions";

/** Стенд: размеры задаются массивом, длина списка берётся из него же. */
const createPositions = (sizes: number[]) => {
  const state = { sizes, reads: 0 };
  const positions = new PrefixPositions({
    getCount: () => state.sizes.length,
    getSize: index => {
      state.reads++;

      return state.sizes[index] ?? 0;
    },
  });

  return { positions, state };
};

describe("PrefixPositions", () => {
  it("раскладывает элементы подряд", () => {
    const { positions } = createPositions([100, 50, 200]);

    positions.markDirty(0);

    expect(positions.getPosition(0)).toBe(0);
    expect(positions.getPosition(1)).toBe(100);
    expect(positions.getPosition(2)).toBe(150);
    expect(positions.getTotal()).toBe(350);
  });

  it("пересчитывает только с грязного индекса", () => {
    const { positions, state } = createPositions([100, 100, 100]);

    positions.markDirty(0);
    positions.getTotal();

    state.sizes[1] = 300;
    positions.markDirty(1);

    expect(positions.getPosition(0)).toBe(0);
    expect(positions.getPosition(2)).toBe(400);
    expect(positions.getTotal()).toBe(500);
  });

  it("не опускает грязную границу выше уже отмеченной", () => {
    const { positions, state } = createPositions([100, 100, 100]);

    positions.markDirty(0);
    positions.getTotal();

    state.sizes[0] = 10;
    positions.markDirty(0);
    positions.markDirty(2);

    expect(positions.getTotal()).toBe(210);
  });

  it("пересчитывает суммарный размер при укорачивании хвоста", () => {
    const { positions, state } = createPositions([100, 100, 100, 100, 100]);

    positions.markDirty(0);
    expect(positions.getTotal()).toBe(500);

    // Хвост удалён, но позиции оставшихся не изменились: грязным становится
    // конец списка, и суммарный размер обязан посчитаться заново.
    state.sizes = [100, 100, 100];
    positions.markDirty(3);

    expect(positions.getTotal()).toBe(300);
  });

  it("не падает на пустом списке", () => {
    const { positions } = createPositions([]);

    positions.markDirty(0);

    expect(positions.getTotal()).toBe(0);
    expect(positions.getPosition(0)).toBe(0);
    expect(positions.findIndexAtOffset(100)).toBe(0);
  });

  it("находит элемент по смещению бинарным поиском", () => {
    const { positions } = createPositions([100, 100, 100, 100, 100]);

    positions.markDirty(0);

    expect(positions.findIndexAtOffset(0)).toBe(0);
    expect(positions.findIndexAtOffset(99)).toBe(0);
    expect(positions.findIndexAtOffset(100)).toBe(1);
    expect(positions.findIndexAtOffset(250)).toBe(2);
    expect(positions.findIndexAtOffset(10000)).toBe(4);
  });
});

describe("PrefixPositions — ленивый пересчёт", () => {
  const sizes = (count: number) => Array.from({ length: count }, () => 100);

  it("не трогает хвост, пока его не спросили", () => {
    const { positions, state } = createPositions(sizes(1000));

    positions.markDirty(0);
    state.reads = 0;

    positions.getPosition(5);

    // Досчитано до пятой строки, а не до тысячной.
    expect(state.reads).toBeLessThan(10);
  });

  it("после измерения досчитывает только до запрошенного индекса", () => {
    const { positions, state } = createPositions(sizes(1000));

    positions.markDirty(0);
    positions.getPosition(100);

    state.sizes[100] = 300;
    state.reads = 0;
    positions.resize(100, 200);

    expect(positions.getPosition(105)).toBe(10000 + 300 + 4 * 100);
    expect(state.reads).toBeLessThan(10);
  });

  it("правит суммарную высоту на месте, без прохода по хвосту", () => {
    const { positions, state } = createPositions(sizes(1000));

    positions.markDirty(0);
    expect(positions.getTotal()).toBe(100000);

    state.sizes[10] = 300;
    state.reads = 0;
    positions.resize(10, 200);

    expect(positions.getTotal()).toBe(100200);
    expect(state.reads).toBe(0);
  });

  it("после смены данных считает суммарную высоту заново", () => {
    const { positions, state } = createPositions(sizes(10));

    positions.markDirty(0);
    expect(positions.getTotal()).toBe(1000);

    state.sizes = sizes(12);
    positions.markDirty(10);

    expect(positions.getTotal()).toBe(1200);
  });

  it("догоняет позиции при поиске по смещению за пределами досчитанного", () => {
    const { positions } = createPositions(sizes(1000));

    positions.markDirty(0);
    positions.getPosition(0);

    expect(positions.findIndexAtOffset(50000)).toBe(500);
    expect(positions.getPosition(500)).toBe(50000);
  });

  it("не держит позиции удалённых элементов", () => {
    const { positions, state } = createPositions(sizes(10));

    positions.markDirty(0);
    positions.getTotal();

    state.sizes = sizes(3);
    positions.markDirty(3);

    expect(positions.getTotal()).toBe(300);
    expect(positions.findIndexAtOffset(10000)).toBe(2);
  });
});
