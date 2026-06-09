---
icon: lucide/bug
---

# 调试故事：-O2 能跑，-O0 反而崩了

## 现象

事情是这样的。当时我正在用 GDB 追踪 OS 的运行流程，为了单步调试方便，我把编译优化从 `-O2` 改成了 `-O0`（无优化）。

重新编译，启动。

系统卡住了。

同一套代码，一个字没改。`-O2` 下一切正常，`-O0` 下直接挂。

> ⚠️ 如果你的直觉是"优化级别越高越容易出 bug"，这个 bug 正好反过来了。**`-O2` 能跑，`-O0` 崩了**——这才是真正让人困惑的地方。

## 第一个猜测

我最初怀疑是某个未初始化的变量在 `-O0` 下暴露了。毕竟 `-O2` 会做常量折叠、死代码消除，可能碰巧抹掉了某个 UB。

我检查了所有的全局变量初始化、栈变量的初始值，没发现问题。

## 定位卡住的位置

用 GDB 连接上去，`Ctrl+C` 停下，看当前 PC：

```text
(gdb) info reg pc
pc             0x80008290       0x80008290
```

查这个地址对应的代码，发现它在 `m_trap` 的 M mode trap handler 里。具体来说，是 `m_trap` 函数的函数序言（function prologue）——编译器在函数开头自动插入的栈帧建立代码。

那一行正好是：

```asm
sd ra, 104(sp)
```

把 `ra` 保存到栈上。`sp` 的值是多少？

```text
(gdb) info reg sp
sp             0xffffffc08003fe30       0xffffffc08003fe30
```

`sp` 指向 `0xffffffc08003fe30`——这是一个虚拟高地址。

> ⚠️ **M mode 下 MMU 是默认禁用的。** CPU 在 M mode 下执行访存指令时，不经过页表翻译，直接把地址当物理地址用。`0xffffffc08003fe30` 这个物理地址根本不存在——所以 `sd ra, 104(sp)` 试图往一个不存在的物理地址写数据，触发了一个 store access fault。

## 那为什么 `-O2` 没问题？

反汇编两个版本的 `m_trap` 函数。

**`-O0` 版本：**

```asm
m_trap:
    addi    sp, sp, -112        # 调整栈帧
    sd      ra, 104(sp)          # 保存 ra 到栈上 ← 崩在这里
    sd      s0, 96(sp)           # 保存 s0 到栈上
    addi    s0, sp, 112
    sd      a0, -88(s0)          # 保存参数到栈上
    sd      a1, -96(s0)
    sd      a2, -104(s0)
    ...
```

`-O0` 下，编译器忠实地把 C 代码逐行翻译。函数一进来先建栈帧，把寄存器压栈——`sd ra, 104(sp)` 就是第一步。**但 `sp` 此时是虚拟高地址，而 M mode 下 MMU 不工作。**

**`-O2` 版本：**

```asm
m_trap:
    li      a4, -1
    srli    a5, a4, 1
    and     a5, a5, a0           # code = mcause & ((1ULL<<63)-1)
    srli    a3, a0, 63           # is_interrupt = mcause >> 63
    bltz    a0, .L_is_interrupt
    ...
```

`-O2` 下，编译器做了激进的寄存器分配优化。所有局部变量都留在寄存器里，**根本不需要碰栈**。`sp` 是错的不重要——因为没人用它。

```text
-O0：编译器把参数和局部变量推到栈上 → 访存 → SP 是非法物理地址 → 崩
-O2：编译器把一切放在寄存器里 → 不访存 → SP 是错的也无所谓 → 没事
```

## 为什么 SP 是虚拟高地址

顺着调用链往回追。`m_trap` 被触发时，CPU 正在 S mode 下运行 `timerinit()`，已经执行过 `switch_to_high_address`——`sp` 早已被抬到了高地址（`0xffffffc0xxxxxxxx`）。

此时 timer interrupt 来了，CPU 从 S mode trap 到 M mode。`sp` 的值原封不动地被带进了 M mode 的 trap handler。

关键就在这里：**S mode 下的 MMU 开启了页表翻译，所以高地址 `sp` 是合法的。但 M mode 下 MMU 是禁用的，高地址 `sp` 就变成了一个不存在的物理地址。**

> ⚠️ 更深一层的根因：FrostVistaOS 在 M mode 下没有一个独立的、指向物理低地址的栈。M mode 的 trap handler 用的是 S mode 的栈——这在 `-O2` 下碰巧能工作，在 `-O0` 下立刻暴露。

## 为什么第一次 timer 设置没问题

最早一次 `timerinit()` 调用 `sbi_set_timer()` 时，代码还在 `s_mode_start()` 里，**还没执行 `switch_to_high_address`**。此时 `sp` 还在物理低地址，VA=PA，即使在 M mode 下也是合法的。

等到 `switch_to_high_address` 把 `sp` 抬到高地址之后，下一次 timer interrupt 再进入 M mode，`sp` 就是高地址了——崩。

所以这个 bug 的触发条件是：**`switch_to_high_address` 之后发生的第一次 M mode trap。**

## 如果把 timer 设得足够远呢

如果把 `sbi_set_timer` 的时间设得足够远，让整个内核初始化在下次 timer 之前跑完——系统仍然会在第一次 timer interrupt 到来时崩溃。

这不是时间问题，是只要 M mode trap 发生、`sp` 是高地址、编译器用了栈——就必然崩。

## 修复

给 M mode 一个独立的、指向物理低地址的栈。

在 `start.S` 里划分一段专门给 M mode trap handler 用的栈空间：

```asm
    .section .bss.m_trap_stack
    .align 12
    .global m_trap_stack
m_trap_stack:
    .space 0x4000      # 16KB per hart

    .global m_trap_stack_top
m_trap_stack_top:
```

在进入 `m_trap` 之前切换 `sp`：

```asm
    csrr t0, mhartid
    slli t0, t0, 12           # 每个 hart 用 4KB
    la   sp, m_trap_stack_top
    sub  sp, sp, t0           # 调整到当前 hart 的栈顶
```

这样无论编译器用什么优化级别、`sp` 进 M mode 之前是什么值，`m_trap` 入口第一件事就是把 `sp` 切到一个已知安全的物理低地址。

## 学到了什么

1. **M mode 下 MMU 是禁用的。** 进入 M mode trap 的瞬间，`sp` 必须指向一个物理地址上真实存在的内存。如果你的内核已经把栈搬到了虚拟高地址，M mode 的 trap handler 必须有自己的独立栈。

2. **编译器优化级别可以掩盖 bug，也可以暴露 bug。** `-O2` 能跑 ≠ 代码没问题。`-O2` 把变量全放寄存器里，碰巧绕开了你的栈地址问题——换一个编译器版本、换一个函数、加一行代码都可能让它崩。

3. **"同一套代码 -O0 崩 -O2 不崩"是一个特定类型的信号。** 它通常意味着你的代码在特定特权级/硬件状态下访问了不该访问的资源（栈、全局变量），而优化恰好让你没走到那条路径。

4. **Timer interrupt 是这类 bug 的最佳探测器。** 因为它随时随地可能来——在 `switch_to_high_address` 之后、在你的任何一段内核代码中间。如果 M mode 的 trap handler 没有准备好自己的栈，timer 就是定时炸弹。

---

- [返回调试首页](../index.md)
- [上一个调试故事：加 fork 导致 syscall 数组坏了](story-2-syscall-linker.md)
- [RISC-V Trap Codes](../reference/trap-codes.md)
