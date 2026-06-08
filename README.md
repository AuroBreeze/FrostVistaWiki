# FrostVista Wiki

FrostVista Wiki is the documentation and learning-path site for
[FrostVistaOS](https://github.com/AuroBreeze/FrostVistaOS), a small RISC-V
Unix-like toy kernel built as a long-term OS learning project.

This site is not meant to present FrostVistaOS as a mature operating system.
It is closer to a record of how the system grows: from booting and printing,
to paging, traps, user mode, processes, syscalls, VFS, file systems, pipes,
and shell support.

The goal of this Wiki is to document not only what the final code looks like,
but also how each part becomes understandable:

- what problem a module is trying to solve;
- what assumptions and boundaries it depends on;
- where bugs usually appear;
- how to debug from symptoms back to the broken layer;
- how a toy kernel slowly grows into a Unix-like system shape.

In short, FrostVista Wiki is a map for approaching the kernel step by step.

## Reading Path

If this is your first time here, start with the getting-started pages:

- [Build and Run](docs/getting-started/build-and-run.md)
- [QEMU and GDB](docs/getting-started/qemu-gdb.md)
- [First User Program](docs/getting-started/first-user-program.md)

Then follow the main chapters:

- [Overview](docs/chapters/00-overview.md)
- [Boot](docs/chapters/01-boot.md)
- [Paging](docs/chapters/02-paging.md)
- [Trap](docs/chapters/03-trap.md)
- [Process](docs/chapters/04-process.md)
- [Syscall](docs/chapters/05-syscall.md)
- [VFS](docs/chapters/06-vfs.md)
- [Easy-FS](docs/chapters/07-easyfs.md)
- [Pipe](docs/chapters/08-pipe.md)
- [Shell](docs/chapters/09-shell.md)

## Local Preview

This project uses the existing `uv` environment in the repository. Serve locally:

```bash
uv run zensical serve
```

Build the static site:

```bash
uv run zensical build --clean
```

The generated output is written to `site/` and is ignored by git.

## Versioned Publishing

FrostVista Wiki versions follow the Wiki itself, not FrostVistaOS. The current documentation version is `dev`; keep `latest` as the default alias while the Wiki is still in development.

Publish a new Wiki version:

```bash
uv run --with git+https://github.com/squidfunk/mike.git mike deploy --push --update-aliases dev latest
```

Set the root of the GitHub Pages site to redirect to `latest`:

```bash
uv run --with git+https://github.com/squidfunk/mike.git mike set-default --push latest
```

## Structure

```text
zensical.toml              Site configuration and navigation
docs/                      Markdown source pages
docs/getting-started/      Getting started pages
docs/chapters/             Tutorial chapters
docs/labs/                 Lab guides
docs/debugging/            Debugging notes
docs/reference/            Reference pages
site/                      Generated static site output
```

## What This Wiki Tries to Preserve

Writing an operating system is often a cycle of failure, disappointment,
debugging, and sudden clarity.

A `panic`, a `page fault`, a wrong address, a missing flag, or a broken lock
contract can stop the whole system. But these failures are also where the
structure of the kernel becomes visible.

FrostVista Wiki tries to preserve that process.

It is written for people who do not just want the answer, but want to see how
a complex system can be taken apart, understood, and rebuilt one layer at a
time.

## References

FrostVistaOS is influenced by classic systems, specifications, and teaching
projects, including:

* [xv6](https://pdos.csail.mit.edu/6.828/2023/xv6.html)
* [Linux Kernel](https://www.kernel.org/)
* [System V ABI](https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html)
