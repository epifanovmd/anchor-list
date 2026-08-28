/** Сохранённая позиция списка. */
export interface ISavedPosition {
  /** Ключ строки, стоявшей у верхней кромки. */
  key: string;
  /** Смещение этой строки относительно кромки; отрицательное — уходит за неё. */
  offset: number;
}

/**
 * Позиция списка между открытиями экрана.
 *
 * В приложении сюда встал бы MMKV: чтение обязано быть синхронным, потому что
 * стартовая позиция нужна к первому рендеру — после асинхронного чтения список
 * успеет открыться сверху и дёрнется. В примере хватает объекта в памяти: он
 * переживает уход с экрана, а больше от него ничего и не требуется.
 */
const positions = new Map<string, ISavedPosition>();

let restoreEnabled = true;

export const positionStore = {
  isRestoreEnabled: (): boolean => restoreEnabled,

  setRestoreEnabled: (enabled: boolean): void => {
    restoreEnabled = enabled;
  },

  read: (screen: string): ISavedPosition | undefined => positions.get(screen),

  write: (screen: string, position: ISavedPosition): void => {
    positions.set(screen, position);
  },

  clear: (screen: string): void => {
    positions.delete(screen);
  },
};
