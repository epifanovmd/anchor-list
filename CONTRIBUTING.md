# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

This project is a monorepo managed using [Yarn workspaces](https://yarnpkg.com/features/workspaces). It contains the following packages:

- The library package in the root directory.
- An example app in the `example/` directory.

To get started with the project, make sure you have the correct version of [Node.js](https://nodejs.org/) installed. See the [`.nvmrc`](./.nvmrc) file for the version used in this project.

Run `yarn` in the root directory to install the required dependencies for each package:

```sh
yarn
```

> Since the project relies on Yarn workspaces, you cannot use [`npm`](https://github.com/npm/cli) for development without manually migrating.

The [example app](/example/) demonstrates usage of the library. You need to run it to test any changes you make.

It is configured to use the local version of the library through the `epifanovmd-anchor-list-source` export condition, so any change you make under `src/` is picked up without rebuilding the package.

The library ships no native code — it is JavaScript and types only. A rebuild of the example app is only needed when you change its own native project or add a native dependency.

You can use various commands from the root directory to work with the project.

To start the packager:

```sh
yarn example start
```

To run the example app on Android:

```sh
yarn example android
```

To run the example app on iOS:

```sh
yarn example ios
```

To confirm that the app is running with the new architecture, you can check the Metro logs for a message like this:

```sh
Running "AnchorListExample" with {"fabric":true,"initialProps":{"concurrentRoot":true},"rootTag":1}
```

Note the `"fabric":true` and `"concurrentRoot":true` properties.

There is also a Web target, but **it is not working yet** — see
[limitations](./docs/limitations.md#web-требует-доработок). The bundle builds, so
the command is still useful for catching build breakage, but nothing checks it
automatically, and the list itself does not work in a browser: position keeping
relies on the native `maintainVisibleContentPosition`, which `react-native-web`
does not implement. Verify behaviour changes on a device or simulator, never on
Web.

```sh
yarn example web
```

Make sure your code passes TypeScript:

```sh
yarn typecheck
```

To check for linting errors, run the following:

```sh
yarn lint
```

To fix formatting errors, run the following:

```sh
yarn lint --fix
```

Remember to add tests for your change if possible. Run the unit tests by:

```sh
yarn test
```

Or run linting, types and tests in one go — the same set CI runs:

```sh
yarn check
```

### Where things live

The layout is described in [`docs/architecture.md`](./docs/architecture.md). In short:

- `src/core/` — layout, scrolling, sticky anchors, edges and position keeping. This is where behaviour lives, and it is computed outside React, so it is testable without a renderer. Unit tests sit in `__tests__` next to each module.
- `src/components/` — the thin React layer over `ScrollView`.
- `src/model/` — signals store, metrics and the container pool.
- `docs/` — user-facing documentation. **Changes to the public API must be reflected here**, in the relevant section and in [`docs/props.md`](./docs/props.md).
- `example/` — one demo screen per mechanic. A behaviour change should be verifiable on one of them; if it is not, add a screen.


### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module.
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

Our pre-commit hooks verify that your commit message matches this format when committing.


### Publishing to npm

Releasing is split in two halves on purpose: **the version is decided locally,
publishing happens in CI.** Nothing is published from a local machine, so what
lands on npm is always built from the exact tagged commit in a clean
environment.

**Locally**, on `main` with a clean working tree:

```sh
yarn release
```

[release-it](https://github.com/release-it/release-it) runs `yarn check` first,
derives the next version from the conventional commits since the last tag,
updates `CHANGELOG.md`, commits it as `chore: release x.y.z`, tags `vX.Y.Z` and
pushes. It does **not** publish.

**CI** takes over from the tag ([`release.yml`](.github/workflows/release.yml)).
It re-runs lint, types and tests, builds the package, packs a tarball, verifies
that tarball (entry points present, tests and docs absent), publishes it to npm
with [provenance](https://docs.npmjs.com/generating-provenance-statements), and
creates the GitHub release.

Authentication uses npm **trusted publishing**: the workflow receives a
short-lived OIDC token from GitHub, so no long-lived `NPM_TOKEN` is stored in
repository secrets. This needs a one-time setup on npmjs.com, where the package
lists this repository and `release.yml` as its trusted publisher. Since that
setup requires the package to already exist, the very first version is published
manually; every version after it goes through the workflow.

That first manual publish needs two-factor authentication on the npm account —
a security key or passkey, added at `npmjs.com/settings/<user>/tfa`. Time-based
codes are no longer accepted for new setups, so `npm publish` completes the
second factor in a browser. Trusted publishing does not use the second factor at
all, so this is a one-time step.

A prerelease goes out under a separate dist-tag:

```sh
yarn release --preRelease=next
```

If the tag and the version in `package.json` ever disagree, the workflow fails
before publishing anything. A version that is already on the registry is treated
as done rather than as an error — the decision is made from what `npm publish`
answers, not from a separate query, because registry replicas lag behind a fresh
publish. So the workflow can be re-run safely, and the tag for the manually
published first version does not break it.


### Scripts

The `package.json` file contains various scripts for common tasks:

- `yarn`: setup project by installing dependencies.
- `yarn typecheck`: type-check files with TypeScript.
- `yarn lint`: lint files with [ESLint](https://eslint.org/).
- `yarn lint --fix`: fix formatting and import order automatically.
- `yarn test`: run unit tests with [Jest](https://jestjs.io/).
- `yarn check`: run all three above — the same set CI runs.
- `yarn prepare`: build the package with [builder-bob](https://github.com/callstack/react-native-builder-bob).
- `yarn clean`: remove build outputs.
- `yarn example start`: start the Metro server for the example app.
- `yarn example android`: run the example app on Android.
- `yarn example ios`: run the example app on iOS.
- `yarn example web`: run the example app on Web (not working yet — build check only).
- `yarn example build:web`: build the example app for Web (not checked by CI).

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
