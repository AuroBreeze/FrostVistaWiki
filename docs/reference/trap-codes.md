---
icon: lucide/table-properties
---

# RISC-V Trap Codes

调试 trap、page fault、syscall 或 timer interrupt 时，经常会看到一个 cause code。

这个 code 一般来自 RISC-V 的 `mcause` / `scause` 寄存器。它告诉我们：CPU 这次为什么离开原来的执行流，跳进 trap handler。

!!! tip "先看最高位"
    在 `mcause` / `scause` 中，最高位表示这次 trap 是 interrupt 还是 exception。最高位为 1 表示 interrupt；最高位为 0 表示 exception。剩下的低位才是 code。

可以先粗略理解成：

| 类型 | 直觉理解 | 例子 |
|------|----------|------|
| Interrupt | 外部或异步事件打断了 CPU | timer interrupt、external interrupt |
| Exception | 当前指令执行时出了问题，或主动陷入内核 | illegal instruction、page fault、ecall |

## Interrupt Codes

| Interrupt | Exception Code | Description |
|-----------|----------------|-------------|
| 1 | 0 | Reserved |
| 1 | 1 | Supervisor software interrupt |
| 1 | 2 | Reserved |
| 1 | 3 | Machine software interrupt |
| 1 | 4 | Reserved |
| 1 | 5 | Supervisor timer interrupt |
| 1 | 6 | Reserved |
| 1 | 7 | Machine timer interrupt |
| 1 | 8 | Reserved |
| 1 | 9 | Supervisor external interrupt |
| 1 | 10 | Reserved |
| 1 | 11 | Machine external interrupt |
| 1 | 12 | Reserved |
| 1 | 13 | Counter-overflow interrupt |
| 1 | 14-15 | Reserved |
| 1 | >=16 | Designated for platform use |

FrostVistaOS 启动阶段的 `mstart()` 会设置 interrupt delegation：

```c
w_mideleg((1 << 5) | (1 << 9));
```

这里的 `5` 和 `9` 分别对应：

| Code | 含义 |
|------|------|
| 5 | Supervisor timer interrupt |
| 9 | Supervisor external interrupt |

也就是说，后面这些中断会交给 S mode 的内核 trap 逻辑处理。

## Exception Codes

| Interrupt | Exception Code | Description |
|-----------|----------------|-------------|
| 0 | 0 | Instruction address misaligned |
| 0 | 1 | Instruction access fault |
| 0 | 2 | Illegal instruction |
| 0 | 3 | Breakpoint |
| 0 | 4 | Load address misaligned |
| 0 | 5 | Load access fault |
| 0 | 6 | Store/AMO address misaligned |
| 0 | 7 | Store/AMO access fault |
| 0 | 8 | Environment call from U-mode |
| 0 | 9 | Environment call from S-mode |
| 0 | 10 | Reserved |
| 0 | 11 | Environment call from M-mode |
| 0 | 12 | Instruction page fault |
| 0 | 13 | Load page fault |
| 0 | 14 | Reserved |
| 0 | 15 | Store/AMO page fault |
| 0 | 16 | Double trap |
| 0 | 17 | Reserved |
| 0 | 18 | Software check |
| 0 | 19 | Hardware error |
| 0 | 20-23 | Reserved |
| 0 | 24-31 | Designated for custom use |
| 0 | 32-47 | Reserved |
| 0 | 48-63 | Designated for custom use |
| 0 | >=64 | Reserved |

FrostVistaOS 启动阶段的 `mstart()` 也会设置 exception delegation：

```c
w_medeleg((1 << 1) | (1 << 2) | (1 << 3) | (1 << 8) |
          (1 << 12) | (1 << 13) | (1 << 15));
```

这些 code 对应：

| Code | 含义 |
|------|------|
| 1 | Instruction access fault |
| 2 | Illegal instruction |
| 3 | Breakpoint |
| 8 | Environment call from U-mode |
| 12 | Instruction page fault |
| 13 | Load page fault |
| 15 | Store/AMO page fault |

这里最常见的几个是：

| Code | 常见场景 |
|------|----------|
| 8 | 用户程序执行 `ecall`，进入 syscall |
| 12 | 取指令时发生 page fault |
| 13 | load 访问内存时发生 page fault |
| 15 | store / AMO 访问内存时发生 page fault |

## 怎么查

遇到一个 trap cause 时，可以按这个顺序查：

1. 先看最高位，判断它是 interrupt 还是 exception。
2. 再看低位 code。
3. 如果是 interrupt，到 Interrupt Codes 表里查。
4. 如果是 exception，到 Exception Codes 表里查。
5. 再回到 FrostVistaOS 的 trap handler，看这个 code 在项目里怎么处理。

!!! note "不要急着背表"
    这张表不是用来背的。它是调试时用来查的。真正需要记住的是几个高频 code：`8` 是 U-mode ecall，`12/13/15` 是 page fault，`5/9` 常用于 S mode timer / external interrupt。

## 相关资料

- [RISC-V Privileged Architecture](online-resources.md#risc-v)
- [Trap](../chapters/03-trap.md)
