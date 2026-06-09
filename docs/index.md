---
icon: lucide/home
---

# FrostVista Wiki

> FrostVistaOS 源码导读与实现讲解。

FrostVistaOS 是一个 RISC-V 64 Unix-like 教学内核。

这份 Wiki 不是“从 0 开始写一个 OS”的手把手教程，也不是把 OS 概念孤立拆开的知识清单。

它更像一份源码导读：沿着 FrostVistaOS 已经实现出来的代码路径，解释一个小型 Unix-like 内核的各个模块为什么存在、怎么连接、在哪里容易出错。

从启动、分页、Trap、锁，到进程、系统调用、VFS、文件系统、pipe 和 shell，这里关心的是：

- 这段代码在整个内核路径里处于什么位置；
- 它解决了什么具体问题；
- 它依赖前面哪些初始化和约定；
- 它把系统推进到了下一步的哪里；
- 如果边界没处理好，会出现什么 bug。

所以这里不会只贴最终代码，也不会把每个模块讲成互不相干的概念。

更重要的是把代码背后的路径讲清楚：从第一条指令，到第一个用户进程，再到 shell 里一次普通命令背后经过的 trap、syscall、文件系统和调度逻辑。

如果你已经能把 FrostVistaOS 跑起来，或者正在读它的源码，这里应该能帮你少走一些“知道函数名但不知道为什么这样连起来”的弯路。

---

## 这里怎么读

```mermaid
graph LR
    A[运行代码] --> B[源码主线]
    B --> C[模块实现]
    C --> D[调试记录]
    C --> E[参考资料]
```

### 运行代码

先解决“代码怎么跑起来”的问题。

这部分只负责让你能构建 FrostVistaOS、启动 QEMU、连接 GDB，并进入当前代码已经实现的用户态环境。

适合用来确认：

* 工具链能否正常工作；
* 内核镜像能否启动；
* `fvsh` 和基础用户程序能否运行；
* 后面读源码时能不能随时回到真实现象里验证。

### 源码主线

教程章节按 FrostVistaOS 的能力链路组织，而不是按源码目录机械展开。

主线大致是：

```text
启动 -> 分页 -> Trap -> 锁 -> 进程 -> 系统调用 -> VFS -> 文件系统 -> Pipe -> Shell -> mmap
```

每一章都尽量回答几个问题：

* 这个模块解决什么问题；
* 如果没有它，系统会缺什么；
* 它和前后模块如何连接；
* 哪些边界最容易出 bug。

### 调试

记录 GDB、QEMU、panic、page fault 和常见 bug 的排查方式。

OS 学习里最难的部分，往往不是“功能最后怎么写”，而是：

> 坏了以后，应该从哪里开始查？

这里会尽量把调试过程写出来，而不是只留下修好的结果。

### 参考

放一些读源码时经常需要查的资料：

* syscall 表；
* 错误码；
* ABI 约定；
* 文件系统结构；
* 术语表；
* [在线资源参考](reference/online-resources.md)；
* 项目路线和设计边界。

---

## 从哪里开始

如果你还没有跑过 FrostVistaOS：

* [构建与运行](getting-started/build-and-run.md)

如果你想开始读源码主线：

* [总览](chapters/00-overview.md)
* [启动](chapters/01-boot.md)
* [启动骨架](chapters/02-startup-framework.md)
* [分页](chapters/03-paging.md)
* [Trap](chapters/04-trap.md)
* [锁](chapters/05-lock.md)
* [进程](chapters/06-process.md)
* [系统调用](chapters/07-syscall.md)
* [VFS](chapters/08-vfs.md)
* [Easy-FS](chapters/09-easyfs.md)
* [Pipe](chapters/10-pipe.md)
* [Shell](chapters/11-shell.md)

如果你想知道这个 Wiki 的写作背景：

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
