import {
  getAxisAnchorStyle,
  getAxisContentStyle,
  getAxisLengthStyle,
  getAxisPinStyle,
  getAxisSize,
  getAxisSlotStyle,
  getAxisTranslate,
} from "../axis";

describe("getAxisSize", () => {
  it("вертикальный список меряет строку по высоте", () => {
    expect(getAxisSize(320, 84, false)).toBe(84);
  });

  it("горизонтальный — по ширине", () => {
    expect(getAxisSize(320, 84, true)).toBe(320);
  });
});

describe("getAxisSlotStyle", () => {
  it("вертикальный слот несёт позицию сверху и растянут по ширине", () => {
    expect(getAxisSlotStyle({ position: 240, horizontal: false })).toEqual({
      flexDirection: "column",
      left: 0,
      position: "absolute",
      right: 0,
      top: 240,
    });
  });

  it("горизонтальный слот несёт позицию слева и растянут по высоте", () => {
    expect(getAxisSlotStyle({ position: 240, horizontal: true })).toEqual({
      bottom: 0,
      flexDirection: "row",
      left: 240,
      position: "absolute",
      top: 0,
    });
  });

  it("поперёк оси слот не получает размера", () => {
    // Размер поперечной кромки слоту неизвестен: её задают обе стороны сразу.
    // Проставленный размер увёл бы строку с кромки вьюпорта, а на устройстве
    // это выглядит как обрезанный текст, а не как ошибка раскладки.
    const vertical = getAxisSlotStyle({ position: 0, horizontal: false });
    const horizontal = getAxisSlotStyle({ position: 0, horizontal: true });

    expect(vertical.width).toBeUndefined();
    expect(horizontal.height).toBeUndefined();
  });

  it("подрезка задаёт размер вдоль оси, а не поперёк", () => {
    const vertical = getAxisSlotStyle({
      position: 10,
      clipSize: 36,
      horizontal: false,
    });
    const horizontal = getAxisSlotStyle({
      position: 10,
      clipSize: 36,
      horizontal: true,
    });

    expect(vertical.height).toBe(36);
    expect(vertical.width).toBeUndefined();
    expect(horizontal.width).toBe(36);
    expect(horizontal.height).toBeUndefined();
    expect(vertical.overflow).toBe("hidden");
    expect(horizontal.overflow).toBe("hidden");
  });

  it("ось скролла — главная ось раскладки слота", () => {
    // Содержимое строки обязано растягиваться поперёк оси: там слот доходит до
    // обеих кромок вьюпорта, и его размер известен. Разложи слот вдоль другой
    // оси — и содержимое растянется по размеру, который сам зависит от
    // содержимого, а поперёк возьмёт свой: карточка не дойдёт до краёв ленты,
    // хотя слот на всю её высоту.
    expect(
      getAxisSlotStyle({ position: 0, horizontal: true }).flexDirection,
    ).toBe("row");
    expect(
      getAxisSlotStyle({ position: 0, horizontal: false }).flexDirection,
    ).toBe("column");
  });

  it("без подрезки содержимое не обрезается", () => {
    expect(
      getAxisSlotStyle({ position: 0, horizontal: false }).overflow,
    ).toBeUndefined();
  });
});

describe("getAxisContentStyle", () => {
  it("ячейка раскладывается вдоль оси скролла", () => {
    // Та же причина, что и у слота: содержимое ячейки — это то, что вернул
    // `renderItem`, и поперёк оси оно обязано получить размер вьюпорта, а не
    // свой собственный.
    expect(getAxisContentStyle(true).flexDirection).toBe("row");
    expect(getAxisContentStyle(false).flexDirection).toBe("column");
  });

  it("отдаёт одну и ту же ссылку: стиль ячейки не меняется за жизнь списка", () => {
    // Иначе каждый рендер ячейки давал бы новый объект стиля — а ячейки
    // перерисовываются на каждом шаге скролла.
    expect(getAxisContentStyle(true)).toBe(getAxisContentStyle(true));
    expect(getAxisContentStyle(false)).toBe(getAxisContentStyle(false));
  });
});

describe("getAxisLengthStyle", () => {
  it("длина контента идёт в высоту вертикального списка", () => {
    expect(getAxisLengthStyle(1200, false)).toEqual({ height: 1200 });
  });

  it("и в ширину горизонтального", () => {
    expect(getAxisLengthStyle(1200, true)).toEqual({ width: 1200 });
  });
});

describe("getAxisTranslate", () => {
  it("вертикальный сдвиг идёт по Y", () => {
    expect(getAxisTranslate(-18, false)).toEqual([{ translateY: -18 }]);
  });

  it("горизонтальный — по X", () => {
    expect(getAxisTranslate(-18, true)).toEqual([{ translateX: -18 }]);
  });
});

describe("getAxisPinStyle", () => {
  it("вертикальные копии стоят у верхней и нижней кромок", () => {
    expect(getAxisPinStyle("start", false)).toEqual({
      flexDirection: "column",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    });
    expect(getAxisPinStyle("end", false)).toEqual({
      bottom: 0,
      flexDirection: "column",
      left: 0,
      position: "absolute",
      right: 0,
    });
  });

  it("горизонтальные — у левой и правой", () => {
    expect(getAxisPinStyle("start", true)).toEqual({
      bottom: 0,
      flexDirection: "row",
      left: 0,
      position: "absolute",
      top: 0,
    });
    expect(getAxisPinStyle("end", true)).toEqual({
      bottom: 0,
      flexDirection: "row",
      position: "absolute",
      right: 0,
      top: 0,
    });
  });

  it("ось скролла — главная ось раскладки копии", () => {
    // Копия рисуется тем же `renderItem`, что и строка внутри контента, и
    // размер поперёк оси обязана получить такой же. Разложи слой вдоль другой
    // оси — и копия сожмётся по своему содержимому: заголовок встанет у
    // верхнего края ленты вместо того места, откуда исчез оригинал.
    expect(getAxisPinStyle("start", true).flexDirection).toBe("row");
    expect(getAxisPinStyle("end", true).flexDirection).toBe("row");
    expect(getAxisPinStyle("start", false).flexDirection).toBe("column");
  });

  it("копия прижата к одной кромке оси, а не к обеим", () => {
    // Обе кромки сразу растянули бы копию на весь вьюпорт: якорь конечной
    // кромки уехал бы к началу, и прилипания не стало бы вовсе.
    const verticalStart = getAxisPinStyle("start", false);
    const horizontalEnd = getAxisPinStyle("end", true);

    expect(verticalStart.bottom).toBeUndefined();
    expect(horizontalEnd.left).toBeUndefined();
  });
});

describe("getAxisAnchorStyle", () => {
  it("якорь компенсации вынесен вдоль оси скролла", () => {
    expect(getAxisAnchorStyle(10000000, false)).toEqual({
      left: 0,
      top: 10000000,
    });
    expect(getAxisAnchorStyle(10000000, true)).toEqual({
      left: 10000000,
      top: 0,
    });
  });
});
