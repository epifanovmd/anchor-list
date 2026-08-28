import { shouldDeferScrollPass } from "../scroll-pass";

describe("shouldDeferScrollPass", () => {
  it("первый проход кадра идёт сразу", () => {
    expect(shouldDeferScrollPass(20)).toBe(false);
  });

  it("второе событие того же кадра откладывается", () => {
    expect(shouldDeferScrollPass(8)).toBe(true);
  });

  it("после долгого прохода следующее событие не ждёт", () => {
    expect(shouldDeferScrollPass(40)).toBe(false);
  });
});
