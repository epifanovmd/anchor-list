/**
 * Диагностика списка.
 *
 * Каналов восемь — по одному на механику, и все они устроены одинаково: канал
 * объявляет события, событие объявляет свои величины, каждая величина
 * подписана. Из этих объявлений собирается и строка лога, и справка, поэтому
 * разойтись они не могут. Единый принцип — в {@link createDebugChannel}.
 *
 * Всё выключено по умолчанию и стоит одной проверки признака на точку печати.
 *
 * Печать с UI-потока живёт отдельно — `./debug-worklet`: она тянет Reanimated,
 * а расчётные модули ядра импортируют этот вход, и поднимать там Reanimated
 * незачем.
 *
 * ```ts
 * import { setAnchorListDebug, anchorListDebug } from "@epifanovmd/anchor-list";
 *
 * anchorListDebug.help();          // что вообще бывает
 * setAnchorListDebug("mvcp");      // включить одну механику
 * anchorListDebug.help("mvcp");    // подписи всех её величин
 * ```
 */
export * from "./channels";
export type {
  DebugEventLogger,
  DebugFields,
  DebugRepeat,
  IDebugChannel,
  IDebugEventSpec,
} from "./debug-channel";
export { createDebugChannel } from "./debug-channel";
export { anchorListDebug, setAnchorListDebug } from "./debug-control";
export { formatDebugValue, formatDebugValues, signed } from "./debug-format";
export type {
  AnchorListDebugChannel,
  AnchorListDebugSpec,
  DebugChannelSelection,
  IDebugChannelDescriptor,
  IDebugEventDescriptor,
  IDebugOptions,
} from "./debug-registry";
export { ANCHOR_LIST_DEBUG_CHANNELS } from "./debug-registry";
