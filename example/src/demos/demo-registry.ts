import type { FC } from "react";

import { ComposerInsetDemo } from "./ComposerInsetDemo";
import { EndlessFeedDemo } from "./EndlessFeedDemo";
import { HoldPositionDemo } from "./HoldPositionDemo";
import { HorizontalRailDemo } from "./HorizontalRailDemo";
import { HorizontalStickyDemo } from "./HorizontalStickyDemo";
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
  | "horizontal-rail"
  | "horizontal-sticky"
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
      "Первое открытие — на заданной строке; дальше позиция запоминается при уходе и восстанавливается к первому кадру",
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
    description: "Вставка, удаление и рост строк выше вьюпорта и на экране",
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
    id: "horizontal-rail",
    title: "Горизонтальная ось",
    description:
      "Лента карточек: подгрузка слева и справа, компенсация позиции и замер по ширине",
    covers: ["horizontal", "maintainVisibleContentPosition", "onStartReached"],
    screen: HorizontalRailDemo,
  },
  {
    id: "horizontal-sticky",
    title: "Прилипание по горизонтали",
    description:
      "Месяцы у левой кромки, метки групп у правой — те же два режима, другая ось",
    covers: ["horizontal", "sticky", "renderOverlay", "stickyOffset"],
    screen: HorizontalStickyDemo,
  },
  {
    id: "throughput",
    title: "Нагрузка",
    description: "Тысяча сообщений и подгрузка в обе стороны, без настроек",
    covers: ["recycleItems", "drawDistance", "anchorListPerf"],
    screen: ThroughputDemo,
  },
];
