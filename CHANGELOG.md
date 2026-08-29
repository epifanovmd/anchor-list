# Changelog

## [1.0.1](https://github.com/epifanovmd/anchor-list/compare/v1.0.0...v1.0.1) (2026-08-29)


### Bug Fixes

* **scroll:** мгновенная смена нижнего отступа оставляла пустоту в конце контента ([1c276ba](https://github.com/epifanovmd/anchor-list/commit/1c276ba4d6c857431b2e8daccf91fa7a16efcfd1))

# [1.0.0](https://github.com/epifanovmd/anchor-list/compare/v0.3.0...v1.0.0) (2026-08-29)


### Bug Fixes

* **layout:** alignItemsAtEnd не прижимал короткий контент к низу ([ac79e97](https://github.com/epifanovmd/anchor-list/commit/ac79e970df0b2d3b96e0439ee9a0a02282d0a0cb))


### Features

* **scroll:** нижний отступ списка задаётся одним значением ([7654473](https://github.com/epifanovmd/anchor-list/commit/76544731585e92a67c77d5a359881292f84a1918))


### BREAKING CHANGES

* **scroll:** `insetEnd` теперь отдаёт списку и само место — распорку в конце
контента ставит он сам. Свою распорку из `ListFooterComponent` нужно убрать,
иначе отступ снизу будет двойным. Ручной подъём смещения под клавиатуру больше
не нужен: `refScrollView`, `onLayout`, `onContentSizeChange` и оба
`onScroll*Drag` для этого подключать не надо.
* **scroll:** `alignItemsAtEndPadding` убран из состояния списка — и из
сигналов, и из `sharedValues`. Выравнивание короткого контента стало трансформом
слоя контейнеров: в высоту контента оно не входит, и короткий список больше не
прокручивается на её величину.

# [0.3.0](https://github.com/epifanovmd/anchor-list/compare/v0.2.0...v0.3.0) (2026-08-28)


### Features

* **perf:** в замере видно проходы без запаса и второй проход компенсации ([ea248fb](https://github.com/epifanovmd/anchor-list/commit/ea248fb3317303ce189b101273fc28a56b651b1f))
* ключ элемента приходит в renderItem полем itemKey ([a9556a7](https://github.com/epifanovmd/anchor-list/commit/a9556a7fa07194b7105e7dca3354687fd57ea7af))
* состояние ячейки, не достающееся соседней строке при переработке ([95e7699](https://github.com/epifanovmd/anchor-list/commit/95e769932d7eeeea27fe43981a1d8bd4d8cde2e9))


### Performance Improvements

* **mvcp:** удержание позиции по размеру больше не работает на броске ([cb09668](https://github.com/epifanovmd/anchor-list/commit/cb0966808258b2f618d7534893fa3881ef509eaf))

# [0.2.0](https://github.com/epifanovmd/anchor-list/compare/v0.1.0...v0.2.0) (2026-08-28)


### Features

* покадровые расстояния до кромок и настраиваемый порог пересчёта ([377e948](https://github.com/epifanovmd/anchor-list/commit/377e94898ae1ee514d9944b236a628e2a713a31a))
