---
icon: lucide/home
---

# FrostVista Wiki

> 从一行输出开始，慢慢看见一个 Unix-like 小系统如何长出来。

FrostVistaOS 是一个面向学习、实验和系统理解的 RISC-V 64 教学内核。

它不是为了追求完整的 Linux 兼容，也不是为了把所有功能都堆进内核。  
它更关心一件事：

> **一个操作系统的边界，是怎样一步步被建立起来的？**

从启动、分页、Trap，到进程、系统调用、文件系统、pipe、shell，再到 mmap 和用户地址空间，FrostVista 试图把这些看似分散的内核概念放回一条可以跟着走的路径里。

这里不会只给你最终代码。

我更希望它能保留那些真正有价值的过程：

- 一个功能是怎么从“不知道怎么写”被拆开的；
- 一个 bug 是怎么从“完全没头绪”被追到根因的；
- 一个模块在设计时有哪些边界、妥协和技术债；
- 一个 toy kernel 是怎样一点点长出 Unix-like 系统的形状的。

如果你正在学习 OS，或者也想从 0 开始写一个小内核，那么这里也许可以成为一条不那么孤独的路。

---

## 你可以在这里看到什么

```mermaid
graph LR
    A[入门] --> B[教程]
    B --> C[实验]
    B --> D[调试]
    C --> E[参考]
    D --> E
```

### 入门

解决“怎么跑起来”的问题。

你会看到如何构建 FrostVistaOS，如何启动 QEMU，如何连接 GDB，以及如何运行第一个用户程序。

适合：

* 第一次接触这个项目；
* 想快速把系统跑起来；
* 想确认环境是否正确。

### 教程

按 FrostVistaOS 的能力演进，一章一章理解内核。

主线大致是：

```text
启动 -> 分页 -> Trap -> 进程 -> 系统调用 -> VFS -> 文件系统 -> Pipe -> Shell -> mmap
```

它不是单纯讲代码，而是尽量解释：

* 这个模块解决什么问题；
* 如果没有它，系统会缺什么；
* 它和前后模块如何连接；
* 哪些边界最容易出 bug。

### 实验

把读到的东西变成自己动手改的东西。

每个实验都尽量围绕一个小闭环展开：

```text
看懂一个概念
修改一段代码
运行一个测试
观察一个现象
解释为什么
```

### 调试

记录 GDB、QEMU、panic、page fault 和常见 bug 的排查方式。

OS 学习里最难的部分，往往不是“功能最后怎么写”，而是：

> 坏了以后，应该从哪里开始查？

这里会尽量把调试过程写出来，而不是只留下修好的结果。

### 参考

放一些查表型资料：

* syscall 表；
* 错误码；
* ABI 约定；
* 文件系统结构；
* 术语表；
* 项目路线和设计边界。

---

## 从哪里开始

如果你只是想先把系统跑起来：

* [构建与运行](getting-started/build-and-run.md)

如果你想按内核能力一点点读：

* [总览](chapters/00-overview.md)
* [启动](chapters/01-boot.md)
* [分页](chapters/02-paging.md)
* [Trap](chapters/03-trap.md)
* [进程](chapters/04-process.md)
* [系统调用](chapters/05-syscall.md)
* [VFS](chapters/06-vfs.md)
* [Easy-FS](chapters/07-easyfs.md)
* [Pipe](chapters/08-pipe.md)
* [Shell](chapters/09-shell.md)

如果你想知道这个 Wiki 为什么会被写下来：

* [前言](preface.md)

---

## FrostVistaOS 现在是什么状态

FrostVistaOS 目前已经具备一个小型 Unix-like 教学内核的基本形状：

* RISC-V 64 / Sv39 分页；
* 用户态与 Trap；
* fork / exec / wait / exit；
* syscall 分发；
* 文件描述符；
* VFS；
* Easy-FS 可写路径；
* EXT4 只读路径；
* devtmpfs；
* pipe；
* 一个小型交互式 shell。

它仍然有很多不成熟的地方。

有些模块只是刚刚跑通，有些路径还很粗糙，有些功能之后一定会重构。
但也正因为它还在生长，这个 Wiki 才能记录下那些成熟系统不再展示的东西：

> 一个系统从混乱里长出秩序的过程。

---

## 参考与致谢

FrostVistaOS 的设计和实现并不是凭空出现的。它受到许多经典系统、规范文档和教学项目的影响，其中最重要的参考包括：

### xv6

在早期开发阶段，FrostVistaOS 从 MIT 开发的 xv6 操作系统中获得了许多启发。

xv6 提供了一个清晰且具有教学意义的 Unix-like 内核实现。它为理解文件系统、进程管理、系统调用和设备驱动等内核概念提供了非常重要的基础。

[https://pdos.csail.mit.edu/6.828/2023/xv6.html](https://pdos.csail.mit.edu/6.828/2023/xv6.html)

### Linux Kernel

Linux 是真实 Unix-like 系统的重要参照。

FrostVistaOS 并不试图复刻 Linux，但 Linux 在系统调用、VFS、进程模型、文件描述符和设备抽象等方面提供了大量成熟经验。

[https://www.kernel.org/](https://www.kernel.org/)

### System V ABI

System V ABI 是理解 ELF、程序装载、调用约定和用户程序运行时布局的重要基础。

FrostVistaOS 在实现 exec、用户程序装载和运行时布局时，都绕不开这些底层规范。

[https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html](https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html)

