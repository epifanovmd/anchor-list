import "../channels";

import { anchorListDebug, setAnchorListDebug } from "../debug-control";
import { ANCHOR_LIST_DEBUG_CHANNELS, debugRegistry } from "../debug-registry";

/**
 * Проверяется сам договор системы: канал объявляет события, событие — свои
 * величины, каждая величина подписана. На этом договоре держится справка, и
 * молча разойтись с ним нельзя — иначе в логе появляется число, смысл которого
 * приходится искать по коду.
 */
describe("каталог каналов", () => {
  const channels = debugRegistry.getChannels();

  it("объявлены все каналы из списка", () => {
    expect(channels.map(channel => channel.name)).toEqual(
      ANCHOR_LIST_DEBUG_CHANNELS,
    );
  });

  it("у каждого канала есть события", () => {
    for (const channel of channels) {
      expect(channel.events.length).toBeGreaterThan(0);
    }
  });

  it("имена событий внутри канала не повторяются", () => {
    for (const channel of channels) {
      const names = channel.events.map(event => event.name);

      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("каждое событие описано, и каждая его величина подписана", () => {
    for (const channel of channels) {
      expect(channel.about.length).toBeGreaterThan(10);

      for (const event of channel.events) {
        expect(event.about.length).toBeGreaterThan(10);
        expect(Object.keys(event.fields).length).toBeGreaterThan(0);

        for (const field of Object.keys(event.fields)) {
          // Подпись «что показывает и о чём говорит», а не повтор имени.
          expect(event.fields[field]!.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("имена величин латиницей: в коде они идентификаторы", () => {
    for (const channel of channels) {
      for (const event of channel.events) {
        for (const field of Object.keys(event.fields)) {
          expect(field).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
        }
      }
    }
  });

  it("справка собирается из тех же объявлений и включает подписи величин", () => {
    const lines: string[] = [];

    anchorListDebug.configure({ sink: line => lines.push(line) });

    const text = anchorListDebug.help("mvcp");

    expect(text).toContain("mvcp·shift");
    expect(text).toContain("moved");
    expect(text).toContain("applied");
  });

  it("оглавление перечисляет все каналы и способ включения", () => {
    const text = anchorListDebug.help();

    for (const name of ANCHOR_LIST_DEBUG_CHANNELS) {
      expect(text).toContain(name);
    }

    expect(text).toContain("setAnchorListDebug");
  });

  it("состояние показывает, что именно включено", () => {
    setAnchorListDebug({ mvcp: true, scroll: ["event"] });

    expect(anchorListDebug.status()).toBe("включено: mvcp scroll:event");

    setAnchorListDebug(false);

    expect(anchorListDebug.status()).toBe("диагностика выключена");
  });
});
