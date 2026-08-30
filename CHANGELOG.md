# Changelog

# [2.0.0](https://github.com/epifanovmd/anchor-list/compare/v1.0.1...v2.0.0) (2026-08-30)


### Bug Fixes

* **layout:** диагностика раскладки перестала топить сама себя ([ad83432](https://github.com/epifanovmd/anchor-list/commit/ad83432fe4c41ac6e2fad1cfb24f27bbe3c5a6db))
* **list:** snapToOffsets пересчитываются после уточнения размеров ([6932c6d](https://github.com/epifanovmd/anchor-list/commit/6932c6d15afeaadd58a5679adaf84b8dfa8dda41))
* **metrics:** новая строка берёт среднее типа сразу после первых замеров ([84a22f9](https://github.com/epifanovmd/anchor-list/commit/84a22f9140e18f26fbe5a6cf0088a6f0c094fc02))
* **model:** атомарная публикация связанных сигналов ([075c8e4](https://github.com/epifanovmd/anchor-list/commit/075c8e46feb5a1c2da23be2d33b3a179b21e91bc))
* **mvcp:** жест против компенсации перестал считаться эхом сдвига ([a28a7b8](https://github.com/epifanovmd/anchor-list/commit/a28a7b874b80031197d68c80c6c38d78f21f40a8))
* **scroll:** доводка стартовой позиции ждёт, пока список действительно доедет ([2092c34](https://github.com/epifanovmd/anchor-list/commit/2092c34760e3c0a720150d55849a066941909039))
* **scroll:** запас распорки не остаётся в контенте, пока отступ стоит ([c1513ff](https://github.com/epifanovmd/anchor-list/commit/c1513ff11583ffda0312883803ee7156615c6308))
* **scroll:** нативная компенсация не вмешивается в доводку стартовой позиции ([d26b656](https://github.com/epifanovmd/anchor-list/commit/d26b656f9b7096b32f8736ae158350a247b8abbd))
* **scroll:** нижний отступ перестал уводить первую строку за кромку при открытии ([4137869](https://github.com/epifanovmd/anchor-list/commit/41378696c3d1af5fb1b2e647a20e5b8bcfa948d8))
* **scroll:** нижний отступ считал дельту от нуля и уводил первую строку за кромку ([6c84d07](https://github.com/epifanovmd/anchor-list/commit/6c84d0781525a360899981e2da191a37756bed5b))
* **scroll:** программный переезд держится до своего события и доводит конец ([ebad00b](https://github.com/epifanovmd/anchor-list/commit/ebad00b914e63688ccb78f27ac5e2d273f542999))
* **scroll:** рывком перестало считаться обычное событие после мелкого ([12357ab](https://github.com/epifanovmd/anchor-list/commit/12357abd8967ee3ea24ce9d7db099dd7b8124815))
* **scroll:** список открывается на нужной позиции и не дрожит от замеров на ходу ([955912e](https://github.com/epifanovmd/anchor-list/commit/955912eecc643e7611e648684720ac7391b43bdb))
* **scroll:** стартовая позиция просится целыми точками ([db6585f](https://github.com/epifanovmd/anchor-list/commit/db6585fc9cfdfd28a2f9e61230da15a4b2a6d4e5))


### Features

* **debug:** восемь каналов диагностики вместо трёх разрозненных ([53fc5d5](https://github.com/epifanovmd/anchor-list/commit/53fc5d56f064c567baee75a1cf26c2faf9512a8c))
* **debug:** диагностика стартовой позиции и дрожания при прокрутке ([cbfa0f8](https://github.com/epifanovmd/anchor-list/commit/cbfa0f8a83a56af565794b34fcd1267a80f1b700))
* **mvcp:** в диагностике видно, почему опорой стала не та строка ([20e8227](https://github.com/epifanovmd/anchor-list/commit/20e822715ba8bde7d97aaf6c9ebe5814c8467836))
* **perf:** в отчёте видно медиану и p95 кадров, а метрики подписаны ([52d52dd](https://github.com/epifanovmd/anchor-list/commit/52d52dd9ce9d961dea91eda52643e71154a3956a))


### BREAKING CHANGES

* **debug:** `setStickyDebug`, `setInitialScrollDebug`, `setScrollDebug` и
объектные формы `anchorListStickyDebug` / `anchorListInitialScrollDebug` /
`anchorListScrollDebug` заменены на `setAnchorListDebug` и `anchorListDebug`.
Соответствие прежних разделов новым каналам — в docs/debugging.md.

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
