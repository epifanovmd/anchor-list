import { fixupConfigRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { namingConfig } from "./eslint.naming.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

/**
 * Стиль, под который написан код списка: сортировка импортов, пустая строка
 * перед `return`, один компонент на файл. Без этих правил правки разъезжаются
 * с существующими файлами.
 *
 * База берётся через `fixupConfigRules`, а не флэт-конфигом React Native
 * напрямую (`@react-native/eslint-config/flat`): тот тянет
 * `eslint-plugin-ft-flow@2`, чьи правила на eslint 9 падают в
 * `context.getAllComments`. Правила flow навешиваются на `.js`, а под линтер
 * здесь идут и конфиги в корне, так что обойти это сужением области нельзя.
 * Фиксап правит ровно такие legacy-правила.
 */
export default defineConfig([
  {
    ignores: ["node_modules/", "lib/", "example/dist/"],
  },

  {
    extends: fixupConfigRules(compat.extends("@react-native", "prettier")),
    plugins: { prettier, "simple-import-sort": simpleImportSort },
    rules: {
      "prettier/prettier": "error",

      // simple-import-sort
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // react
      "react/react-in-jsx-scope": "off",
      "react/no-multi-comp": ["error", { ignoreStateless: false }],
      "react/display-name": "off",
      "react/prop-types": "off",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",

      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      "no-undef": "off",
      "no-unused-vars": "off",

      // typescript eslint
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
      // Ключ по индексу проверен выше по коду — `!` здесь дешевле лишней ветки.
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",

      // Stylistic
      "no-redeclare": "off",
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
        {
          blankLine: "any",
          prev: ["const", "let", "var"],
          next: ["const", "let", "var"],
        },
      ],
    },
  },

  namingConfig,
]);
