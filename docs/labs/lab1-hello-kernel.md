---
icon: lucide/sparkles
---

# Lab 1 Hello Boot Log

Lab 1 是你第一次真正修改 FrostVistaOS 内核代码。

```text
改一行启动日志
  -> 重新构建并运行
  -> 观察输出
  -> 定位它在启动链路中的位置
  -> 查 RISC-V 手册解释相关寄存器
```

!!! warning "先自己做，再看答案"
    本页只放题目和提交要求。步骤、参考代码和解释放在 [Lab 1 参考答案](lab1-hello-kernel-answer.md)。建议完成实验记录后再看答案页。

## 目标

完成本实验后，你应该能够：

- 在 FrostVistaOS 启动阶段加入一行自己的日志；
- 使用 `make qemu` 重新构建并启动系统；
- 判断这行日志位于 `_start -> mstart / s_mode_start -> high_mode_start` 的哪一段；
- 查 RISC-V privileged architecture manual，解释 `mstatus.MPP`、`mepc`、`mret` 和 PMP；
- 进阶：查 RISC-V ELF psABI，解释 `tp` / `x4` 的 ABI 含义，以及 FrostVistaOS 两条启动路径中 `tp` 的来源。

## 前置准备

本实验默认你已经完成：

- [Lab 0 环境配置](lab0-env.md)
- [启动](../chapters/01-boot.md)

建议同时准备：

- RISC-V privileged architecture manual；
- RISC-V ELF psABI；
- [RISC-V Trap Codes](../reference/trap-codes.md)；
- [在线资源参考](../reference/online-resources.md#risc-v)。

## 基础任务

### Task 1 启动原始系统

使用 OpenSBI + Easy-FS 路径启动 FrostVistaOS。

### Task 2 加入自己的启动日志

在启动过程中加入一行属于你自己的日志。

要求：

- 日志必须在内核启动阶段输出；
- 日志内容必须能看出是你自己加的；
- 不要修改用户程序来完成这个任务；
- 不要一上来把日志加在 `_start` 或 `mstart()` 里。

实验记录：

```text
我修改的文件：______
我修改的函数：______
我加入的日志内容：______
```

### Task 3 重新运行并截图或摘录输出

重新构建并启动系统，确认你的日志出现。


### Task 4 定位日志所处的启动阶段

根据 [启动](../chapters/01-boot.md) 章节中的启动链路，判断你的日志位于哪一段。

参考链路：

```text
_start
  -> mstart / s_mode_start
  -> kvminit / kvminithart
  -> switch_to_high_address
  -> high_mode_start
  -> user_init / scheduler
```

实验记录：

```text
我的日志位于 ______ 之后。
我的日志位于 ______ 之前。
我判断的依据是 ______。
```

### Task 5 查 RISC-V 特权架构手册

打开 RISC-V privileged architecture manual，搜索下面这些关键词。

| 关键词 | 你要回答的问题 |
|--------|----------------|
| `mstatus` / `MPP` | `MPP` 字段影响 `mret` 后进入哪个 privilege mode 吗？ |
| `mepc` | `mepc` 保存的是什么地址？ |
| `mret` | `mret` 和普通 C 函数 `return` 有什么不同？ |
| `PMP` | PMP 解决什么权限问题？ |
| `pmpaddr0` / `pmpcfg0` | 它们分别和 PMP 的什么部分有关？ |
| `mideleg` | interrupt delegation 是什么？ |
| `medeleg` | exception delegation 是什么？ |

实验记录要求：

```text
手册版本或链接：______
mstatus.MPP 的解释：______
mepc 的解释：______
mret 的解释：______
PMP 的解释：______
mideleg / medeleg 的解释：______
```

### Task 6 回答思考题

请用自己的话回答：

1. 为什么 FrostVistaOS 不一直运行在 M mode，而要进入 S mode？
2. 为什么第一次实验不建议把日志加在 `_start` 或 `mstart()`？
3. 你的日志能出现，说明启动流程至少已经走过了哪些阶段？
4. 如果你的日志没有出现，你会优先检查哪些可能原因？

## 进阶任务

### Challenge 1 分析 `tp`

`tp` 在 RISC-V psABI 中是 `thread pointer`，但 FrostVistaOS 内核中也用它保存当前 hart / CPU id。

请查 RISC-V ELF psABI，并结合 FrostVistaOS 源码回答：


1. RISC-V psABI 中 `tp` / `x4` 的含义是什么？
2. 普通 ABI 语境下，为什么不应该随便破坏 `tp`？
3. `BOOT=opensbi` 路径下，`tp` 的值从哪里来？
4. `BOOT=bare` 路径下，`tp` 的值从哪里来？
5. 为什么两条路径设置 `tp` 的方式不同？
6. `cpuid()` 最后为什么能读到当前 CPU id？

## 提交内容

提交你的实验记录，至少包含：

- 修改的文件和函数；
- 你加入的日志内容；
- QEMU 输出摘录；
- 启动阶段定位说明；
- privileged architecture manual 查表结果；
- 思考题回答；
- 如果完成进阶任务，补充 `tp` / `cpuid()` 分析。

## 成功标准

基础要求：

- 原始系统能启动到 `fvsh`；
- 你加入的 boot log 能出现在 QEMU 输出中；
- 你能指出日志位于启动链路的哪一段；
- 你能从 RISC-V privileged architecture manual 中找到 `mstatus.MPP`、`mepc`、`mret` 和 PMP；
- 你能解释 M mode、S mode、U mode 的基本分工。

进阶要求：

- 你能查 RISC-V ELF psABI，说明 `tp` / `x4` 的 ABI 含义；
- 你能比较 `BOOT=opensbi` 与 `BOOT=bare` 两条路径下 `tp` 的来源；
- 你能说明 `cpuid()` 和 `tp` 的关系。

## 参考答案

完成实验后再阅读：

- [Lab 1 参考答案](lab1-hello-kernel-answer.md)
