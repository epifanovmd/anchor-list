import type { FC } from "react";

import { ComposerInsetDemo } from "./ComposerInsetDemo";
import { EndlessFeedDemo } from "./EndlessFeedDemo";
import { HoldPositionDemo } from "./HoldPositionDemo";
import { JumpToMessageDemo } from "./JumpToMessageDemo";
import { LiveStateDemo } from "./LiveStateDemo";
import { PinnedAnchorsDemo } from "./PinnedAnchorsDemo";
import { RestorePositionDemo } from "./RestorePositionDemo";
import { ThroughputDemo } from "./ThroughputDemo";

/** Идентификатор стенда; он же ключ маршрута. */
export type DemoId =
  | "restore-position"
  | "endless-feed"
  | "hold-position"
  | "composer-inset"
  | "pinned-anchors"
  | "live-state"
  | "jump-to-message"
  | "throughput";

/** Что нужно витрине о каждом стенде. */
export interface IDemoEntry {
  id: DemoId;
  title: string;
  description: string;
  /** Пропы списка, ради которых стенд и написан. */
  covers: string[];
  screen: FC<{ onBack: () => void }>;
}

export const DEMOS: IDemoEntry[] = [
  {
    id: "restore-position",
    title: "Стартовая позиция",
    description:
      "Позиция запоминается при уходе с экрана и восстанавливается к первому кадру",
    covers: ["initialScroll", "getVisibleRange", "getPositionAtIndex"],
    screen: RestorePositionDemo,
  },
  {
    id: "endless-feed",
    title: "Подгрузка с обеих сторон",
    description:
      "Спиннеры на обеих кромках; удержание позиции выключается тумблером",
    covers: [
      "onStartReached",
      "onEndReached",
      "maintainVisibleContentPosition",
    ],
    screen: EndlessFeedDemo,
  },
  {
    id: "hold-position",
    title: "Компенсация позиции",
    description: "Вставка, удаление и рост строк выше вьюпорта по кнопке",
    covers: ["maintainVisibleContentPosition", "getFixedItemSize"],
    screen: HoldPositionDemo,
  },
  {
    id: "composer-inset",
    title: "Нижний отступ",
    description: "Панель ввода и клавиатура: контент не должен уходить под них",
    covers: [
      "ListFooterComponent",
      "insetEnd",
      "maintainScrollAtEnd",
      "alignItemsAtEnd",
    ],
    screen: ComposerInsetDemo,
  },
  {
    id: "pinned-anchors",
    title: "Прилипание",
    description: "Даты у верхней кромки, аватарки групп у нижней",
    covers: ["sticky", "renderOverlay", "stickyOffset", "stickyPinned"],
    screen: PinnedAnchorsDemo,
  },
  {
    id: "live-state",
    title: "Состояние списка",
    description: "UI-поток без рендеров рядом с подпиской из React",
    covers: ["sharedValues", "state", "viewabilityPairs"],
    screen: LiveStateDemo,
  },
  {
    id: "jump-to-message",
    title: "Переход к сообщению",
    description: "Скролл по ключу, индексу и к концу контента; опрос геометрии",
    covers: ["scrollToKey", "scrollToIndex", "scrollToEnd", "getContentSize"],
    screen: JumpToMessageDemo,
  },
  {
    id: "throughput",
    title: "Нагрузка",
    description: "Тысяча сообщений и подгрузка в обе стороны, без настроек",
    covers: ["recycleItems", "drawDistance", "anchorListPerf"],
    screen: ThroughputDemo,
  },
];
