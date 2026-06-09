---
icon: lucide/bug
---

# 调试故事：加了一个 fork 条目，write 就坏了

## 现象

当时 syscall 分发表已经跑通了。`write`、`read`、`exit` 这几个 syscall 都工作正常。用户在 shell 里敲命令，字符串能正常输出。

然后我开始加 `fork`。

在 syscall 数组里加了一行：

```c
static uint64 (*syscalls[])(void) = {
    [SYS_write] = sys_write,
    [SYS_read]  = sys_read,
    [SYS_exit]  = sys_exit,
    [SYS_fork]  = sys_fork,    // ← 新加的这行
};
```

编译，启动。

shell 出来了，但敲任何命令都没有输出。`echo hello` 之后屏幕一片空白。`write` 之前是完全正常的。

就加了一个数组元素。**改了 fork，write 怎么会坏？**

## 第一个猜测

我的第一反应是 `sys_fork` 的实现有问题，可能破坏了某个全局状态。

我把 `sys_fork` 的函数体改成空函数——只返回 0。问题依旧。

我检查了 syscall 分发逻辑：

```c
void syscall() {
    int num = p->trapframe->a7;
    if (num > 0 && num < NELEM(syscalls) && syscalls[num]) {
        p->trapframe->a0 = syscalls[num]();
    }
}
```

逻辑没问题。`num` 的值也正常。

我又检查了编译是否出了问题——重新 `make clean && make`，结果一样。

> ⚠️ 到这里我还在 syscall 逻辑里查。完全没想过问题可能根本不在 syscall 层。**症状出现在 syscall，不代表根因在 syscall。**

## 一个不起眼的线索

反复测试中我发现一个规律：如果把 `[SYS_fork] = sys_fork` 这行注释掉，write 立刻恢复。不去掉数组元素，而是把 fork 改成指向 `sys_write`——也坏。

这排除了 `sys_fork` 实现的问题。**问题出在"数组多了一个元素"本身。**

我开始怀疑是内存布局的问题。用 `objdump -t kernel.elf` 看了符号表：

```text
# 加 fork 之前
00000000ffffffc080012000 g     O .data  0000000000000028 syscalls

# 加 fork 之后
0000000080012000 g     O .data  0000000000000030 syscalls
```

```text
加 fork 之前：syscalls 地址 = 0xffffffc080012000（高地址）
加 fork 之后：syscalls 地址 = 0x0000000080012000（低地址！）
```

数组变大之后，linker 把它放到了低地址。但我的内核代码全部链接在高地址（`0xffffffc0xxxxxxxx`）。

更关键的是：**这个数组放在了低地址，而内核此时已经开启了分页并切到了高地址运行。低地址的恒等映射很可能已经被清除了。**

## 根因

问题出在 linker script。

我最初的 linker script 只有简单的节定义，没有显式区分 VMA（虚拟地址）和 LMA（加载地址）。对于数据段来说，linker 会在符号表里使用**加载地址**（物理低地址）来标记变量位置。

当 `syscalls` 数组比较小时，它可能和其他变量一起被放在了同一个输出段，碰巧被解析到了高地址。但当数组变大后，linker 的布局策略变了——可能单独为这个大的数据块分配了一个低地址段。

同时，`-mcmodel=medany` 编译选项也参与了这个游戏。`medany` 的意思是"任何符号都在 ±2GB 范围内"，在 RISC-V 上用 `lui` + `addi` 两条指令访问。如果符号的地址是低地址，编译器生成的就是低地址的引用——**而低地址的映射在分页开启后被清理了**。

```text
    编译器：     "把 syscalls 放在地址 0x80012000"
    内核访问时：  VA 0x80012000 → 页表里没有恒等映射 → page fault
    trap handler：尝试打印错误 → 又访问了坏地址 → 静默崩溃
```

> ⚠️ 这就是为什么"write 坏了"——不是 write 的 syscall 逻辑有问题，而是 write 要用的 `syscalls` 数组本身变成了一个非法地址。write 只是一个恰好暴露了问题的受害者。

## 修复

在 linker script 里显式配置 VMA 和 LMA：

```ld
MEMORY
{
  VIRT (rwx) : ORIGIN = 0xffffffc080000000, LENGTH = 128M
  PHYSMEM (rwx) : ORIGIN = 0x80000000, LENGTH = 128M
}

SECTIONS
{
  . = BASE_ADDRESS;

  .text :
  {
    *(.text.entry)
    *(.text .text.*)
    *(.rodata .rodata.*)
    . = ALIGN(0x1000);
    _divide = .;
  } > VIRT AT> PHYSMEM

  .data :
  {
    . = ALIGN(16);
    _data_start = .;
    *(.sdata .sdata.* .data .data.*)
    _data_end = .;
  } > VIRT AT> PHYSMEM

  .bss :
  {
    . = ALIGN(16);
    _bss_start = .;
    *(.sbss .sbss.* .bss .bss.* COMMON)
    _bss_end = .;
  } > VIRT AT> PHYSMEM
}
```

`> VIRT AT> PHYSMEM` 告诉 linker：

- `>` VIRT：符号表的地址用 VIRT 区的地址（高地址）。代码里 `la t0, syscalls` 会加载高地址。
- `AT>` PHYSMEM：实际加载到物理内存的地址用 PHYSMEM 区（低地址）。QEMU 加载 ELF 时把数据放到 `0x80000000`。

这样无论数组多大，符号地址始终是高地址——和内核代码/分页布局保持一致。

## 学到了什么

1. **症状和根因可能在不同层。** `write` 不工作了，问题却在 linker script。这种"症状在 A，根因在 B"的 bug 在 OS 开发里非常常见，因为所有东西都耦合在同一块内存里。

2. **Linker script 的 VMA/LMA 不是装饰。** 如果你的内核链接在高地址，你必须确保所有全局变量的符号地址都在高地址。漏掉任何一个节的定义，linker 就可能把它放在你不期望的位置。

3. **`objdump -t` 是你最好的朋友。** 遇到"某个全局变量/函数突然不工作了"，第一反应应该是看符号表。符号地址是不是你期望的值？不是的话，追 linker。

4. **`-mcmodel=medany` 掩盖了问题。** `medany` 让编译器对符号地址的距离假设非常宽松——但如果符号地址本身是错的，代码生成得再对也没用。

---

- [返回调试首页](../index.md)
- [上一个调试故事：ecall 之后一直触发 cause 5](story-1-timer-not-exception.md)
- [Linker Script 与 ELF](../tools/linker-elf.md)
