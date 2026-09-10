import { AnchorList } from "@epifanovmd/anchor-list";
import type { FC } from "react";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { RailRowData } from "../data";
import {
  createCards,
  ESTIMATED_CARD_WIDTH,
  RAIL_HEIGHT,
  railRowKey,
  railRowType,
  railRowWidth,
} from "../data";
import { RailCard } from "../rows";
import {
  ControlPanel,
  DebugToggles,
  Screen,
  StatusLine,
  ToggleRow,
} from "../ui";

const INITIAL_FROM = 500;
const INITIAL_TO = 540;
const PAGE_SIZE = 20;
const LOAD_DELAY_MS = 700;

interface IHorizontalRailDemoProps {
  onBack: () => void;
}

/**
 * Стенд горизонтальной оси.
 *
 * Тот же случай, что и в «Подгрузке с обеих сторон», повёрнутый на девяносто
 * градусов: лента вырастает слева от вьюпорта, и без компенсации карточка, на
 * которую смотрит пользователь, уезжает вправо на ширину добавленного.
 * Переключатель показывает разницу вживую.
 *
 * Зачем отдельным стендом: расчёт списка оси не знает — диапазон, позиции и
 * компенсация считаются вдоль одной оси, безразлично какой. Проверить это
 * можно только на устройстве, и проверять надо ровно то, что на вертикали уже
 * работает: сходится ли компенсация, попадают ли пороги, не путает ли список
 * ширину с высотой при замере.
 */
export const HorizontalRailDemo: FC<IHorizontalRailDemoProps> = ({
  onBack,
}) => {
  const [range, setRange] = useState({ from: INITIAL_FROM, to: INITIAL_TO });
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);
  const [keepPosition, setKeepPosition] = useState(true);
  const [measured, setMeasured] = useState(false);
  const [status, setStatus] = useState("готово");

  const data = useMemo<RailRowData[]>(() => {
    const rows: RailRowData[] = createCards(range.from, range.to);

    if (loadingStart) {
      rows.unshift({ type: "spinner", key: "spinner-start", edge: "start" });
    }

    if (loadingEnd) {
      rows.push({ type: "spinner", key: "spinner-end", edge: "end" });
    }

    return rows;
  }, [range, loadingStart, loadingEnd]);

  const handleStartReached = useCallback(() => {
    if (loadingStart || range.from <= 0) return;

    setLoadingStart(true);
    setStatus("подгрузка слева…");

    setTimeout(() => {
      setRange(current => ({
        ...current,
        from: Math.max(0, current.from - PAGE_SIZE),
      }));
      setLoadingStart(false);
      setStatus(`добавлено ${PAGE_SIZE} слева`);
    }, LOAD_DELAY_MS);
  }, [loadingStart, range.from]);

  const handleEndReached = useCallback(() => {
    if (loadingEnd) return;

    setLoadingEnd(true);
    setStatus("подгрузка справа…");

    setTimeout(() => {
      setRange(current => ({ ...current, to: current.to + PAGE_SIZE }));
      setLoadingEnd(false);
      setStatus(`добавлено ${PAGE_SIZE} справа`);
    }, LOAD_DELAY_MS);
  }, [loadingEnd]);

  const maintainVisibleContentPosition = useMemo(
    () => (keepPosition ? { data: true, size: true } : undefined),
    [keepPosition],
  );

  const renderItem = useCallback(
    ({ item }: { item: RailRowData }) => <RailCard row={item} />,
    [],
  );

  return (
    <Screen title={"Горизонтальная ось"} onBack={onBack}>
      <ControlPanel>
        <ToggleRow
          title={"Удерживать позицию при вставке слева"}
          value={keepPosition}
          onChange={setKeepPosition}
        />
        <ToggleRow
          title={"Мерить карточки, а не брать ширину из данных"}
          value={measured}
          onChange={setMeasured}
        />
        <StatusLine text={`диапазон ${range.from}…${range.to} · ${status}`} />
        <StatusLine
          text={
            "Долистайте влево: с выключенным удержанием лента прыгнет вправо"
          }
        />
        <DebugToggles channels={["edges", "mvcp", "layout"]} />
      </ControlPanel>

      {/* Высоту ленте задаёт стенд, а не элементы: поперёк оси слот растянут
          на весь вьюпорт списка, и карточки берут высоту от него. Обёртка
          ставит ленту по центру остатка экрана — иначе под ней остаётся пустое
          поле, и стенд выглядит недорисованным.

          Тумблер замера здесь не для красоты: `getFixedItemSize` закрывает
          самый простой путь, где ширина известна заранее, а без него список
          обязан взять её из `measure` — то есть из ширины узла, а не высоты.

          `key` на тумблере обязателен: объявленный размер необратим, и снять
          `getFixedItemSize` у живого списка нельзя — уже объявленные ширины
          останутся объявленными. Пересоздание списка — единственный способ
          перевести его на измерение, и стенд показывает именно этот способ. */}
      <View style={ss.stage}>
        <AnchorList
          key={measured ? "measured" : "fixed"}
          horizontal
          data={data}
          renderItem={renderItem}
          keyExtractor={railRowKey}
          getItemType={railRowType}
          getFixedItemSize={measured ? undefined : railRowWidth}
          estimatedItemSize={ESTIMATED_CARD_WIDTH}
          maintainVisibleContentPosition={maintainVisibleContentPosition}
          onStartReached={handleStartReached}
          onStartReachedThreshold={0.4}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          recycleItems
          style={ss.list}
        />
      </View>
    </Screen>
  );
};

HorizontalRailDemo.displayName = "HorizontalRailDemo";

const ss = StyleSheet.create({
  list: { height: RAIL_HEIGHT },
  stage: { flex: 1, justifyContent: "center" },
});
