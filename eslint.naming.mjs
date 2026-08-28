import checkFile from "eslint-plugin-check-file";

/**
 * Конвенции именования файлов и папок, проверяемые автоматически.
 *
 * Правило одно на весь `src`: компоненты — PascalCase, хуки и фабрики —
 * camelCase по имени экспорта, остальное — kebab-case.
 */

// `use[A-Z]*`/`create[A-Z]*`/`build[A-Z]*`, а не `use*` и т.п. — иначе задевает
// случайные совпадающие префиксы в обычных kebab-словах.
const VERB_PREFIX = "@(use[A-Z]*|create[A-Z]*|build[A-Z]*)";
const NOT_VERB_PREFIX = `!(${VERB_PREFIX.slice(2, -1)})`;

/** Исходники библиотеки и стендов подчиняются одним и тем же правилам. */
const ROOTS = ["src", "example/src"];

// .tsx: компонент — PascalCase; фабрика/хук с JSX — camelCase по имени экспорта.
const tsxRules = root => ({
  [`${root}/**/${NOT_VERB_PREFIX}.tsx`]: "PASCAL_CASE",
  [`${root}/**/${VERB_PREFIX}.tsx`]: "CAMEL_CASE",
});

// .ts: хук/фабрика — camelCase по имени экспорта; всё остальное — kebab-case.
const tsRules = root => ({
  [`${root}/**/${VERB_PREFIX}.ts`]: "CAMEL_CASE",
  [`${root}/**/${NOT_VERB_PREFIX}.ts`]: "KEBAB_CASE",
});

export const namingConfig = {
  files: ["src/**/*.{ts,tsx}", "example/src/**/*.{ts,tsx}"],
  plugins: { "check-file": checkFile },
  rules: {
    "check-file/filename-naming-convention": [
      "error",
      {
        ...Object.assign({}, ...ROOTS.map(tsxRules)),
        ...Object.assign({}, ...ROOTS.map(tsRules)),
      },
      { ignoreMiddleExtensions: true },
    ],

    "check-file/folder-naming-convention": [
      "error",
      { "src/**/": "KEBAB_CASE", "example/src/**/": "KEBAB_CASE" },
      // __tests__ — конвенция jest
      { ignoreWords: ["__tests__"] },
    ],
  },
};

export default namingConfig;
