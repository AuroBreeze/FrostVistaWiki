---
icon: lucide/home
hide:
  - navigation
---

# FrostVista Wiki

!!! abstract "从启动到内核结构"
    FrostVista Wiki 记录 FrostVistaOS 从启动、分页、Trap，到进程、系统调用、文件系统和用户程序的实现过程。

    这里不仅整理最终代码，也保留理解内核边界、定位问题和逐步调试的路径。

## 从这里开始

| 入口 | 适合阅读的问题 |
|---|---|
| [设计哲学](overview/Philosophy.md) | FrostVistaOS 为什么保持紧凑，以及哪些抽象值得保留 |
| [架构总览](overview/Architecture.md) | 内核目录如何组织，模块之间如何分层和协作 |
| [RISC-V 启动流程](Boot%20%26%20Architecture/RISC-V%20Boot%20Flow.md) | 内核如何从低地址启动，开启 Sv39 并进入高半区 |
| [Trap 处理](Boot%20%26%20Architecture/Trap%20Handling.md) | 异常、中断和系统调用如何进入内核处理路径 |

## 按主题阅读

=== "启动与架构"

    - [RISC-V Boot Flow](Boot%20%26%20Architecture/RISC-V%20Boot%20Flow.md)
    - [Trap Handling](Boot%20%26%20Architecture/Trap%20Handling.md)
    - [SBI Interface](Boot%20%26%20Architecture/SBI%20Interface.md)

=== "构建与运行"

    - [Make](tools/make.md)
    - [交叉编译器](tools/cross-compiler.md)
    - [Linker 与 ELF](tools/linker-elf.md)
    - [QEMU](tools/qemu.md)

=== "内存与参考"

    - [Physical Page Allocator](Memory%20Management/Physical%20Page%20Allocator.md)
    - [RISC-V Trap Codes](reference/trap-codes.md)
    - [Syscall 表](reference/syscall-table.md)
    - [术语表](reference/glossary.md)

=== "调试故事"

    - [ecall 之后一直触发 cause 5](debugging/story-1-timer-not-exception.md)
    - [加了一个 fork 条目，write 就坏了](debugging/story-2-syscall-linker.md)
    - [-O2 能跑，-O0 反而崩了](debugging/story-3-o0-vs-o2.md)

!!! tip "推荐阅读顺序"
    先阅读架构总览，再进入启动流程和 Trap；需要构建或运行内核时，配合 Make、交叉编译器和 QEMU 章节使用。
