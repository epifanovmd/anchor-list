import type { AnchorListDebugChannel } from "@epifanovmd/anchor-list";
import { setAnchorListDebug } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { memo, useCallback, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ToggleRow } from "./ToggleRow";
import { Txt } from "./Txt";

/** Как канал называется в стенде: имя механики, а не имя канала в коде. */
const CHANNEL_TITLES: Record<AnchorListDebugChannel, string> = {
  scroll: "Движение смещения",
  layout: "Раскладка: диапазон, контейнеры, замеры",
  mvcp: "Удержание позиции",
  initial: "Стартовая позиция и первый показ",
  sticky: "Прилипание",
  edges: "Пороги подгрузки",
  view: "Видимость элементов",
  insets: "Нижний отступ и клавиатура",
};

/** Пустой список по умолчанию: литерал в аргументах менял бы ссылку каждый рендер. */
const EMPTY_CHANNELS: AnchorListDebugChannel[] = [];

interface IDebugTogglesProps {
  /** Каналы, которые имеют смысл на этом стенде, в порядке важности. */
  channels: AnchorListDebugChannel[];
  /**
   * Каналы, включённые сразу при открытии стенда.
   *
   * Нужно там, где смотреть надо первые кадры: стартовую позицию и первый показ
   * не застать тумблером — к моменту, когда до него дотянутся, всё уже
   * случилось. Остальное включают руками: канал, включённый без нужды, стоит
   * кадров и заливает лог.
   */
  defaultEnabled?: AnchorListDebugChannel[];
}

/**
 * Тумблеры диагностики стенда.
 *
 * Зачем на каждом стенде: диагностику включают, когда что-то видно на экране, —
 * а видно оно на устройстве, где консоли под рукой нет. Тумблер даёт включить
 * нужный канал ровно в тот момент, когда симптом воспроизводится, и выключить
 * сразу после: печать сама стоит кадров и меняет то, что смотрят.
 *
 * Каналы перечисляет стенд: включать здесь всё подряд бессмысленно — на
 * прокрутке чужой канал утопит нужный в потоке своих строк.
 *
 * При уходе со стенда диагностика гасится. Иначе она осталась бы включённой на
 * соседнем стенде, где её никто не звал, и лог стал бы необъяснимым.
 */
export const DebugToggles: FC<IDebugTogglesProps> = memo(
  ({ channels, defaultEnabled = EMPTY_CHANNELS }) => {
    const [enabled, setEnabled] =
      useState<AnchorListDebugChannel[]>(defaultEnabled);

    /**
     * Список каналов строкой: стенды передают его литералом, и по ссылке он на
     * каждом рендере новый — эффект перезапускался бы вечно.
     */
    const startWith = defaultEnabled.join(",");

    // Слой эффектов, а не обычный: список применяет пропы и стартовую позицию
    // в своём layout-эффекте, а те идут до всех обычных. Панель стоит в дереве
    // выше списка, поэтому её layout-эффект успевает включить канал раньше —
    // иначе первые строки разбора терялись бы каждое открытие стенда.
    useLayoutEffect(() => {
      if (startWith) {
        setAnchorListDebug(startWith.split(",") as AnchorListDebugChannel[]);
      }

      return () => setAnchorListDebug(false);
    }, [startWith]);

    const toggle = useCallback(
      (channel: AnchorListDebugChannel, value: boolean) => {
        setEnabled(current => {
          const next = value
            ? [...current, channel]
            : current.filter(name => name !== channel);

          setAnchorListDebug(next.length === 0 ? false : next);

          return next;
        });
      },
      [],
    );

    return (
      <View style={ss.block}>
        <Txt role={"caption"} muted>
          {"Диагностика в консоль"}
        </Txt>
        {channels.map(channel => (
          <ToggleRow
            key={channel}
            title={CHANNEL_TITLES[channel]}
            value={enabled.includes(channel)}
            onChange={value => toggle(channel, value)}
          />
        ))}
      </View>
    );
  },
);

DebugToggles.displayName = "DebugToggles";

const ss = StyleSheet.create({
  block: {
    borderTopColor: "#8883",
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 6,
  },
});
