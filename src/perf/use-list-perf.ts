import { useEffect } from "react";

import { listPerf } from "./list-perf";

/**
 * Сессия замера на время жизни экрана.
 *
 * @param label имя списка в логах — по нему стенды различаются между собой.
 */
export const useListPerf = (label: string): void => {
  useEffect(() => {
    listPerf.start(label);

    return () => listPerf.stop();
  }, [label]);
};
