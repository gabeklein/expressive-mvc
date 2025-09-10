# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.69.1](https://github.com/gabeklein/expressive-mvc/compare/v0.69.0...v0.69.1) (2025-09-10)


### Bug Fixes

* add coverage for Observable method ([b7a7d9e](https://github.com/gabeklein/expressive-mvc/commit/b7a7d9e06731df3a628303266f42cf33f78e192d))
* correct signature of createEffect ([1174916](https://github.com/gabeklein/expressive-mvc/commit/11749166f9eb573fef07308b3f542d05ef9317bf))
* enhance setter handling in assign function to prevent errors ([86fa3b8](https://github.com/gabeklein/expressive-mvc/commit/86fa3b8677659ae0c95ee25ad46c9f8886ff5a6c))
* update Observable interface to allow void, returning `this` ([41fbca8](https://github.com/gabeklein/expressive-mvc/commit/41fbca881e323b249925a07fb7e51108e4ab29d3))





# [0.69.0](https://github.com/gabeklein/expressive-mvc/compare/v0.68.0...v0.69.0) (2025-09-05)


### Bug Fixes

* support assigning function components as render method ([fade81e](https://github.com/gabeklein/expressive-mvc/commit/fade81eba5a049cc1aa30366823516142bc449dc))
* update foo method assignment to use current property ([2b6b960](https://github.com/gabeklein/expressive-mvc/commit/2b6b9606709181b374f8ad79db39a00a624de356))


* feat!: removed ref-function from object ([6b2db41](https://github.com/gabeklein/expressive-mvc/commit/6b2db41b7047304821ff39dcd186017da1207b13))
* fix(ref)!: update ref type to not implicitly allow null ([77cdb48](https://github.com/gabeklein/expressive-mvc/commit/77cdb48746eea281162df8d740fcb4633bb6cc12))


### Features

* **ref:** add 'is' and 'key' properties to reference objects ([1aa7cd8](https://github.com/gabeklein/expressive-mvc/commit/1aa7cd8cf4f62bc6507ef1afa3e47e99832e3cd1))


### BREAKING CHANGES

* ref properties no longer callable
* ref properties no longer implicitly expect null in typescript





# [0.68.0](https://github.com/gabeklein/expressive-mvc/compare/v0.67.0...v0.68.0) (2025-08-21)


### Bug Fixes

* add conventional commits flag to lerna publish script ([6d25716](https://github.com/gabeklein/expressive-mvc/commit/6d257165050b28c6b00be5a3ddd1f8734722b21a))
* improve error messages for destroyed model updates ([0393f3c](https://github.com/gabeklein/expressive-mvc/commit/0393f3ca8ee73a41c35a9789a2eee12bef376eca))


### Features

* fetch original methods using model.get ([013c082](https://github.com/gabeklein/expressive-mvc/commit/013c08293a4d0d9e3845950b16e4024ddcfbb7a1))
* **react:** add suspense fallback to Provider ([c334366](https://github.com/gabeklein/expressive-mvc/commit/c33436628c0bcdcec1c4b161feca225c8c248dd0))





# [0.67.0](https://github.com/gabeklein/expressive-mvc/compare/v0.66.2...v0.67.0) (2025-07-28)


### Features

* **ref:** trigger set instructions on assignment ([3be9fdf](https://github.com/gabeklein/expressive-mvc/commit/3be9fdf870f36e69717f2034141ac1ad5c09e772))
