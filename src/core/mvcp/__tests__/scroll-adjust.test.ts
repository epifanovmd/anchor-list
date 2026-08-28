import { ListStore } from "../../../model";
import { ScrollAdjust } from "../scroll-adjust";

describe("ScrollAdjust", () => {
  it("начинает с нуля", () => {
    const adjust = new ScrollAdjust(new ListStore());

    expect(adjust.get()).toBe(0);
  });

  it("накапливает сдвиги, а не заменяет их", () => {
    const store = new ListStore();
    const adjust = new ScrollAdjust(store);

    // Нативный слой смотрит на смещение кадра распорки между транзакциями:
    // сбросить её в ноль значит сделать обратный сдвиг на всю сумму.
    adjust.add(300);
    adjust.add(-60);

    expect(adjust.get()).toBe(240);
    expect(store.peek("scrollAdjust")).toBe(240);
  });

  it("возвращает накопленное значение", () => {
    const adjust = new ScrollAdjust(new ListStore());

    expect(adjust.add(100)).toBe(100);
    expect(adjust.add(100)).toBe(200);
  });

  it("уходит в минус при удалении сверху", () => {
    const store = new ListStore();
    const adjust = new ScrollAdjust(store);

    adjust.add(-200);

    expect(store.peek("scrollAdjust")).toBe(-200);
  });
});
