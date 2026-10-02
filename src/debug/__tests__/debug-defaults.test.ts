import type * as ChannelModule from "../debug-channel";
import type * as ControlModule from "../debug-control";
import type * as RegistryModule from "../debug-registry";

/**
 * Диагностика молчит, пока её явно не включили: библиотека встраивается в
 * чужие приложения, и любая строка в их консоли без запроса — шум.
 */
describe("диагностика по умолчанию", () => {
  const load = () => {
    let modules!: {
      control: typeof ControlModule;
      channel: typeof ChannelModule;
      registry: typeof RegistryModule;
    };

    // Свежий реестр: соседние тесты включают и выключают каналы.
    jest.isolateModules(() => {
      modules = {
        control: require("../debug-control"),
        channel: require("../debug-channel"),
        registry: require("../debug-registry"),
      };
    });

    return modules;
  };

  it("не включает ни одного канала", () => {
    const { control, registry } = load();

    for (const name of registry.ANCHOR_LIST_DEBUG_CHANNELS) {
      expect(control.anchorListDebug.isEnabled(name)).toBe(false);
    }
  });

  it("ничего не печатает без явного включения", () => {
    const { control, channel } = load();
    const lines: string[] = [];

    control.anchorListDebug.configure({ sink: line => lines.push(line) });

    const log = channel
      .createDebugChannel("view", "канал для теста")
      .event("tick", { about: "событие", fields: { value: "величина" } });

    log({ value: 1 });

    expect(lines).toEqual([]);
  });

  it("признак канала для UI-потока выключен", () => {
    const { registry } = load();
    const flag = { value: true };

    registry.debugRegistry.setFlag("sticky", flag);

    expect(flag.value).toBe(false);
  });
});
