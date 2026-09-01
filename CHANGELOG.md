# Changelog

## [0.1.2](https://github.com/kirchDev/workflows/compare/v0.1.1...v0.1.2) (2026-09-01)


### Bug Fixes

* **ci:** stop two bodies in one caller from cancelling each other ([64216e0](https://github.com/kirchDev/workflows/commit/64216e005e6d3bcf2844ed051445ae2779e3e02c))

## [0.1.1](https://github.com/kirchDev/workflows/compare/v0.1.0...v0.1.1) (2026-09-01)


### Bug Fixes

* **ci:** run the analysis when a draft becomes ready ([edeffcd](https://github.com/kirchDev/workflows/commit/edeffcd93e15380e5db8880eb035a5ef2be5a1ad))
* **ci:** scan once per change instead of twice ([2008c11](https://github.com/kirchDev/workflows/commit/2008c11ae01fb0d5052d6fed8a589379cc244f56))

## 0.1.0 (2026-09-01)


### Features

* **actions:** ship the node setup as a composite action ([68bb427](https://github.com/kirchDev/workflows/commit/68bb4273539c7cb172400a61dd19c66185ea4305))
* **ci:** add the Rust body and the Lighthouse shard merge ([a720bfc](https://github.com/kirchDev/workflows/commit/a720bfcc22938708d1f1042fd8345d6588e99889))
* **ci:** add the stack family bodies ([53a23b0](https://github.com/kirchDev/workflows/commit/53a23b06c53c1dfdaa9a3c8929269a0cb6b28b40))
* **ci:** give the audit its own sticky comment ([7dc410c](https://github.com/kirchDev/workflows/commit/7dc410c0caa51f62d21973fada3fd5c746fba65b))
* **ci:** report coverage through kirchDev/coverage-report ([4000c0b](https://github.com/kirchDev/workflows/commit/4000c0bfa22027fa56d5b314fd4973d726c01054))
* **ci:** run the repo's gate from a reusable body ([804dee8](https://github.com/kirchDev/workflows/commit/804dee83701fd0c1a6ae059721fd9601cc9a09a9))
* **ci:** skip work that cannot fail ([79f7027](https://github.com/kirchDev/workflows/commit/79f70274ec8ecaffd2107c38a197ac54ac352a28))
* **codeql:** analyse from a reusable body ([1dd03e4](https://github.com/kirchDev/workflows/commit/1dd03e4efac0658587008f8db45998b0cf24f402))
* **promotion-pr:** open the promotion PR from a reusable body ([0190471](https://github.com/kirchDev/workflows/commit/0190471612f6a9069d77133e3b8e404aa825d357))
* **queue:** land the queue from reusable bodies ([44c9a8e](https://github.com/kirchDev/workflows/commit/44c9a8ee81d72e9774f50e5df96319ed6f4098cc))
* **release:** cut releases from a reusable body ([8b8b9e6](https://github.com/kirchDev/workflows/commit/8b8b9e6067377d52a105ceec661ef9cf5c98aa67))
* **release:** publish npm packages and provider artifacts from reusable bodies ([3a0b7f2](https://github.com/kirchDev/workflows/commit/3a0b7f2b1390fb73d0a2b83a1e7fa97aa4e1cfdb))


### Bug Fixes

* restore the core, git and node stacks ([eee34a8](https://github.com/kirchDev/workflows/commit/eee34a8760e6cb5195a691158702db100a530853))
* **security:** pass every command input through env, not into the script ([464b42d](https://github.com/kirchDev/workflows/commit/464b42de6cfe99497ab6cfe928a4a6401be3d06f))


### Miscellaneous Chores

* request 0.1.0 as the first release ([2336166](https://github.com/kirchDev/workflows/commit/2336166946eea7381b44f3d2305f7e7f2c745f93))
