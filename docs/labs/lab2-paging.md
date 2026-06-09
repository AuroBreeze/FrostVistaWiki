---
icon: lucide/memory-stick
---

# Lab 2 分页

Lab 2 让你真正动手操作页表。你会写一个页表遍历器，打印内核页表的三张快照，最后刻意破坏一个恒等映射，看系统怎么崩。

```text
写一个页表遍历器
  -> 打印页表快照，对比分析
  -> 删掉一个恒等映射
  -> 观察崩溃位置
  -> 解释为什么会崩在那个地方
```

!!! warning "先自己做，再看答案"
    本页只放题目和提交要求。步骤、参考代码和解释放在 [Lab 2 参考答案](lab2-paging-answer.md)。建议完成实验记录后再看答案页。

## 目标

完成本实验后，你应该能够：

- 理解 Sv39 三级页表结构，能遍历根页表找到所有映射；
- 识别内核页表中的恒等映射和高地址映射；
- 理解 `kvminit` / `kvminithart` / `switch_to_high_address` / `clear_low_memory_mappings` 之间的关系；
- 刻意破坏一个映射后，预测并验证崩溃位置；
- 查 RISC-V privileged architecture manual，解释 `satp` 的 MODE 字段和页表翻译流程。

## 前置准备

本实验默认你已经完成：

- [Lab 0 环境配置](lab0-env.md)
- [Lab 1 Hello Boot Log](lab1-hello-kernel.md)
- [启动](../chapters/01-boot.md)
- [分页](../chapters/03-paging.md)

建议同时准备：

- RISC-V privileged architecture manual（搜索 `Sv39`、`satp`、`PTE`、`sfence.vma`）；
- [Linker Script 与 ELF](../tools/linker-elf.md)（理解 VMA/LMA）；
- [RISC-V Trap Codes](../reference/trap-codes.md)（崩溃时查到 page fault 的 cause code）；
- [在线资源参考](../reference/online-resources.md#risc-v)。

## 基础任务：写一个页表遍历器

在 `arch/riscv/mm/vm.c`（或新建文件）中实现一个函数：

```c
void print_kernel_pagetable(pagetable_t pagetable);
```

### 要求

遍历整个内核页表，对每个**叶 PTE**（即最终映射了物理页的 PTE）打印一行信息。

每行至少包含：

| 字段 | 含义 | 示例 |
|------|------|------|
| VA 范围 | 映射的虚拟地址区间 | `[0xffffffc080000000 - 0xffffffc080001000]` |
| PA 范围 | 对应的物理地址区间 | `[0x80000000 - 0x80001000]` |
| Size | 映射大小（连续映射合并显示） | `4KB` / `48KB` / `2MB` |
| Perm | 权限（R/W/X/U） | `R+X` / `R+W` / `R+W+X+U` |
| PTE | PTE 的 64 位原始值（16 进制） | `0x00000000200010cf` |

### 实现建议

用现有的 `walk()` 函数或自己理解其逻辑后实现。

[分页](../chapters/03-paging.md) 中已经讲过 `walk()` 和 `mappages()` 的结构，可以参考。

- Sv39 根页表有 512 项，每项覆盖 1GB；
- 非叶 PTE（flags 中 R/W/X 全为 0）指向下一级页表；
- 叶 PTE（R/W/X 至少一个为 1）包含了最终映射信息；
- 连续的、权限相同的映射可以合并成一行打印。

### 输出示例

```text
=== Kernel Page Table ===
[0x0000000010000000 - 0x0000000010001000] -> [0x10000000 - 0x10001000]   4KB  R+W    PTE=0x00000000400010cf
[0x0000000080000000 - 0x000000008000c000] -> [0x80000000 - 0x8000c000]  48KB  R+X    PTE=0x00000000200010cb
[0x000000008000c000 - 0x0000000088000000] -> [0x8000c000 - 0x88000000]  ~124MB R+W   PTE=0x00000000200030cf
[0xffffffc010000000 - 0xffffffc010001000] -> [0x10000000 - 0x10001000]   4KB  R+W    PTE=0x00000000400010cf
[0xffffffc080000000 - 0xffffffc08000c000] -> [0x80000000 - 0x8000c000]  48KB  R+X    PTE=0x00000000200010cb
...
```

!!! tip "提示"
    用 `PA2VA` / `VA2PA` / `PTE2PA` / `PTE_FLAGS` 这些现有宏来转换地址，不要自己手算偏移。这些宏的定义在 `arch/riscv/include/asm/mm.h`。

    打印大小可以用 `%dKB` 格式，除以 1024。大区间用 MB。
    打印地址用 `%p` 格式，C 会自动转成 `0x...`。

## 观察任务：三张页表快照

在以下三个位置各调用一次你的 `print_kernel_pagetable()`：

| 快照 | 插入位置 | 所在的文件 |
|------|----------|-----------|
| 快照 ① | `kvminithart()` 之后 | `arch/riscv/mm/vm.c` |
| 快照 ② | `switch_to_high_address()` 之后、`clear_low_memory_mappings()` 之前 | `arch/riscv/boot/smode.c` |
| 快照 ③ | `clear_low_memory_mappings()` 之后 | `arch/riscv/boot/smode.c` |

### 实验记录

对比三张快照的输出，回答以下问题：

```text
1. 快照①和快照②的映射内容为什么一模一样？
   我发现了：______
   我的解释：______

2. 快照③少了哪些映射？
   缺少的映射：______
   它们从快照③中消失是因为：______
   为什么只清 kernel_table[0..2] 就覆盖了所有低地址？
   我的解释：______
```

## 破坏任务：删掉一个恒等映射

### 操作说明

在 `kvminithart()` **之后**、`switch_to_high_address()` **之前**，手工清掉一个恒等映射。

你需要做的是：

1. 在 `arch/riscv/boot/smode.c` 的 `s_mode_start()` 中，找到 `kvminithart()` 和 `switch_to_high_address()` 之间的位置
2. 用 `walk()` 找到一个恒等映射的叶 PTE
3. 把它的 V 位清零（`*pte &= ~PTE_V`）
4. 然后执行 `sfence_vma()`
5. 继续 `switch_to_high_address()`

### 你可以选择的破坏目标

| 目标 | 地址 | 预测崩溃位置 |
|------|------|-------------|
| UART 恒等映射 | VA `0x10000000` | `display_banner()` 或松
接着 `switch_to_high_address` 之后的第一个 `LOG_INFO` |
| 内核代码段恒等映射 | VA `0x80000000` 起始 | 下一条指令取指 |
| 内核数据段恒等映射 | VA 接近 `_divide` | 下一次栈操作或数据读写 |

### 实验前：先预测

在动手之前，先回答：

```text
我选择破坏的映射：______
它的 VA 范围：______
我认为系统会崩在：______
我的理由是：______
```

### 实验中：观察实际行为

修改后运行 `make qemu`。

!!! warning "提示"
    如果系统直接静默崩溃（没有日志输出），用 `make debug` 启动 GDB，在崩溃时查看 `sepc` 和 `scause` 寄存器。

    查 [RISC-V Trap Codes](../reference/trap-codes.md)：`scause` 的值是否对应 page fault 的 code？和你的预测吻合吗？

实验后记录：

```text
实际崩溃位置或行为：______
scause 的值：______
scause 的含义：______
sepc 的值：______

我的预测是否准确？如果不准确，差异在哪？
______
```

### 对照实验

清掉同一个映射，但把代码放到 `kvminithart()` **之前**执行（分页还没开），系统会崩吗？

```text
放在 kvminithart 之前的结果：______
和放在之后的差异：______
我的解释：______
```

## 思考题

1. 为什么 `kvminit()` 要同时做恒等映射和高地址映射？如果只做一种，哪一种不行？为什么？
2. 破坏实验中，在 `kvminithart()` 之后清映射和在之前清，结果完全不同。这说明 `satp` 打开/关闭时，地址翻译发生了什么变化？
3. `clear_low_memory_mappings()` 清的是前 3 个 root PTE。为什么 3 个就覆盖了所有低地址？每个 root PTE 对应多大的虚拟地址空间？
4. 页表本身也占物理内存。你的页表遍历器可以帮你数出来：内核页表一共用了多少页？（包括根页表和所有二级、三级页表）

## 提交内容

```text
1. print_kernel_pagetable() 的代码
2. 三张页表快照的输出对比，以及你的分析
3. 破坏实验的代码修改、预测、实际行为和解释
4. 对照实验的结果和解释
5. 思考题的回答
```

## 成功标准

- 页表遍历器能正确打印所有已映射的条目
- 三张快照对比清晰，能正确解释差异
- 破坏实验中选择了至少一个映射，预测了崩溃位置，实际运行后能解释结果
- 对照实验解释了 `satp` 打开/关闭对地址翻译的影响
- 思考题用自己的话回答，不复制教程原文

---

- [Lab 2 参考答案](lab2-paging-answer.md)
- [返回分页教程](../chapters/03-paging.md)
