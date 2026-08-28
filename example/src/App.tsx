import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DemoSwitch } from "./DemoSwitch";

/**
 * Корень примера.
 *
 * `SafeAreaProvider` нужен экранам стендов, `KeyboardProvider` — стенду нижнего
 * отступа: он отдаёт положение клавиатуры покадрово и прямо на UI-поток.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <DemoSwitch />
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
