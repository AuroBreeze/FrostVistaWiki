---
icon: lucide/bug
---

# 调试故事：ecall 之后一直触发 cause 5

## 现象

当时我正在实现最小 U mode。流程很简单：从内核创建一个用户进程，让它执行 `ecall`，然后在 trap handler 里捕获这个 syscall，打印一行日志。

代码大概是这样：

```c
// 用户程序：就两条指令
asm volatile("ecall");
asm volatile("j .");     // 死循环，永远不会回到这里
```

预期行为：CPU 执行 `ecall` → 陷入 S mode → trap handler 打印一行日志 → 返回用户态 → 停在 `j .` 死循环。

实际行为：**系统一启动就不停触发 trap，`scause` 一直是 5，`ecall` 之后的 `j .` 从来没到过。**

## 第一个猜测

我当时以为 cause 5 是一个 exception——毕竟 RISC-V spec 里 exception code 5 对应的是 "Supervisor ecall"。所以我就顺着"为什么 ecall 被反复触发"这个方向查。

我检查了 `sepc` 是不是没正确 +4、检查了 `sstatus.SPP` 是不是没清、检查了 `sret` 之后是不是又跳回了 `ecall`。每条都排除了，现象没有任何变化。

> ⚠️ 这里犯了一个方向性错误：**我先入为主地认为所有 trap 都是 exception，根本没有考虑 interrupt 的可能。** 从这一刻起，我就在错误的方向上排查了。

## 转向

折腾了几个小时后（真就是几个小时），我重新翻开 RISC-V privileged architecture manual，看到 `scause` 的描述里有一句：

> "The Interrupt bit in the `scause` register, bit 63, is set to 1 for interrupts."

我突然意识到一件事：我从来没看过 `scause` 的最高位。

```text
scause = 0x8000000000000005
          ↑
          最高位是 1 → 这是中断，不是异常！
```

再查手册里的 interrupt code 表：

```text
Interrupt 5 = Supervisor Timer Interrupt
```

## 根因

真相大白。

我在 M mode 下已经把 timer interrupt delegate 给了 S mode（通过 `mideleg`）。这意味着从 U mode 的角度看，timer interrupt 是**始终全局使能**的。它不会等你的 trap handler 处理完 syscall——它随时会插进来。

而我写的 trap handler 是这样的：

```c
void usertrap() {
    // 我以为所有 trap 都是 exception
    uint64 cause = r_scause();
    if (cause == 8) {
        // 处理 ecall
        ...
    }
    // 没有检查最高位，没有处理 interrupt！
}
```

所以实际发生的事情是：

```text
U mode: ecall
  → 陷入 S mode，scause = 8 (environment call from U-mode)
  → trap handler 还没处理完
  → timer interrupt 触发！
  → CPU 又查 stvec，又跳回 trap handler 入口
  → 这次 scause = 0x8000000000000005 (Supervisor Timer Interrupt)
  → 我的 trap handler 不认识这个 cause
  → 又触发新一轮异常
  → 死循环
```

timer interrupt 就像一个不请自来的客人，在你处理 syscall 的时候直接推门进来——而我的 trap handler 根本没准备接待它。

> ⚠️ 更深层的问题：不光要区分 interrupt/exception，一旦进入 usertrap，你还必须立刻把 `stvec` 从 `uservec` 改成 `kernelvec`。否则如果 trap handler 内部发生了 timer interrupt 或 page fault，CPU 会跳回 `uservec` 的入口——但此时 SP 是内核栈，上下文完全不对。

## 修复

两处修改：

**1. 第一行就检查 scause 的最高位：**

```c
void usertrap() {
    uint64 scause = r_scause();
    
    // 最高位为 1 → interrupt
    if (scause >> 63) {
        // 处理中断：timer / external / software
        if ((scause & 0xff) == 5) {
            // Supervisor Timer Interrupt
            timer_tick();
        }
        return;
    }
    
    // 最高位为 0 → exception
    if ((scause & 0xff) == 8) {
        // ecall from U-mode
        ...
    }
}
```

**2. 进入 usertrap 后立刻把 stvec 切到 kernelvec：**

```c
void usertrap() {
    w_stvec((uint64)kernelvec);  // 防止 trap handler 内部再次 trap 时跳回 uservec
    
    // ... 处理 interrupt/exception ...
}
```

返回用户态之前在 `usertrapret` 中切回来，而且要关中断切：

```c
void usertrapret() {
    intr_off();
    w_stvec((uint64)uservec);    // 切回 uservec
    // ...
    sret();                       // 返回 U mode，硬件自动恢复中断使能
}
```

## 学到了什么

1. **`scause` 最高位区分 interrupt 和 exception。** 这是 trap handler 必须做的第一件事。不检查这一位，你会把所有 interrupt 当成 exception 处理——然后死都不知道怎么死的。

2. **Timer interrupt 不排队。** 一旦 M mode 把 timer interrupt delegate 给了 S mode，它就是全局使能的。你的 syscall handler 跑到一半，timer 照样来。这是硬件的设计——不是 bug，是你没处理。

3. **`stvec` 要在进入 trap handler 后立刻切换。** 否则 trap handler 内部如果再次触发 trap（比如 page fault），CPU 会跳回 uservec 入口，而此时的 SP/上下文完全不匹配。

4. **先查手册再猜。** 如果我一上来就看了 `scause` 的 bit 63 定义，就不会在"为什么 ecall 被反复触发"这个错误方向浪费几个小时。

---

- [返回调试首页](../index.md)
- [下一个调试故事：加 fork 导致 syscall 数组坏了](story-2-syscall-linker.md)
- [RISC-V Trap Codes](../reference/trap-codes.md)
