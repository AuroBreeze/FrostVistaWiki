---
icon: lucide/book-open-check
---

# Lab 2 参考答案

本页是 Lab 2 的参考答案和操作说明。

!!! warning "先完成实验记录"
    如果你还没自己做一遍，请先回到 [Lab 2 分页](lab2-paging.md)。直接看答案会让这个实验失去大半价值。

## 基础任务：页表遍历器

### 推荐实现位置

在 `arch/riscv/mm/vm.c` 末尾新增 `print_kernel_pagetable()`，并在 `arch/riscv/include/asm/defs.h` 中声明。

### 实现思路

页表遍历的本质是递归：对于根页表的 512 个 PTE，逐个检查：
- 如果是有效 PTE 且是**非叶**（R/W/X 全为 0），说明它指向下一级页表，递归进去；
- 如果是有效 PTE 且是**叶**（R/W/X 至少一个为 1），打印这条映射。

Sv39 三级页表的遍历逻辑：

```text
对 root[i] (i = 0..511):
  如果 PTE 无效 → 跳过
  如果 PTE 是非叶 → 进入 level=1，VA_base = i * 1GB
  如果 PTE 是叶 → 这是一条 1GB 的大页映射，打印（FrostVistaOS 不会用到，但做个防御）

进入下一级同理，直到 level=2（叶 PTE 的粒度是 4KB）
```

每个非叶 PTE 的 PPN 指向下一级页表的物理地址。由于遍历时系统已经处于高地址模式，需要用 `PA2VA()` 转换后才能访问下一级页表。

### 参考代码

```c
void print_kernel_pagetable(pagetable_t pagetable)
{
    LOG_SEP();
    LOG_INFO("=== Kernel Page Table ===");

    for (int i = 0; i < 512; i++) {
        pte_t pte = pagetable[i];
        if (!(pte & PTE_V))
            continue;

        uint64 child_pa = PTE2PA(pte);
        uint64 va_base = (uint64)i << 30;  // 每项 1GB

        if ((pte & (PTE_R | PTE_W | PTE_X)) == 0) {
            // 非叶 → 递归进入第二级
            pagetable_t l1 = (pagetable_t)PA2VA(child_pa);
            for (int j = 0; j < 512; j++) {
                pte_t pte1 = l1[j];
                if (!(pte1 & PTE_V))
                    continue;

                uint64 child1_pa = PTE2PA(pte1);
                uint64 va_base1 = va_base | ((uint64)j << 21);  // 每项 2MB

                if ((pte1 & (PTE_R | PTE_W | PTE_X)) == 0) {
                    // 非叶 → 递归进入第三级
                    pagetable_t l2 = (pagetable_t)PA2VA(child1_pa);
                    print_level2(l2, va_base1);
                } else {
                    // 2MB 大页（FrostVistaOS 当前不使用，保留以作防御）
                    print_mapping(va_base1, child1_pa, 2 * 1024 * 1024, pte1);
                }
            }
        } else {
            // 1GB 大页（不用但保留）
            print_mapping(va_base, child_pa, 1024 * 1024 * 1024, pte);
        }
    }
    LOG_SEP();
}

void print_level2(pagetable_t pagetable, uint64 va_base)
{
    for (int i = 0; i < 512; i++) {
        pte_t pte = pagetable[i];
        if (!(pte & PTE_V))
            continue;

        uint64 child_pa = PTE2PA(pte);
        uint64 va = va_base | ((uint64)i << 12);  // 每项 4KB

        print_mapping(va, child_pa, PGSIZE, pte);
    }
}

void print_mapping(uint64 va, uint64 pa, uint64 size, pte_t pte)
{
    char perm[8];
    int idx = 0;
    if (pte & PTE_R) perm[idx++] = 'R';
    if (pte & PTE_W) perm[idx++] = 'W';
    if (pte & PTE_X) perm[idx++] = 'X';
    if (pte & PTE_U) perm[idx++] = 'U';
    perm[idx] = '\0';

    const char *unit = "KB";
    uint64 sz = size / 1024;
    if (sz >= 1024) { sz /= 1024; unit = "MB"; }

    LOG_INFO("[%p - %p] -> [%p - %p]  %d%s  %-4s  PTE=%p",
             (void *)va,  (void *)(va + size - 1),
             (void *)pa,  (void *)(pa + size - 1),
             (int)sz, unit, perm, (void *)pte);
}
```

!!! note "合并连续映射"
    上面是最简实现，每条 4KB 映射单独打印一行，输出会比较长（几十行到上百行）。如果你想合并连续的、权限相同的映射，可以比较相邻 PTE 的 PPN 和 flags 是否连续，不连续的才输出——这属于展示优化的范畴，不影响对页表的理解。

### 声明

在 `arch/riscv/include/asm/defs.h` 中加上：

```c
void print_kernel_pagetable(pagetable_t pagetable);
```

## 观察任务：三张快照

### 快照 ①：kvminithart 之后

在 `arch/riscv/mm/vm.c` 的 `kvminithart()` 末尾加一行：

```c
void kvminithart()
{
    sfence_vma();
    if (kernel_table == 0)
        panic("kernel_table is null");
    w_satp(MAKE_SATP(kernel_table));
    sfence_vma();

    LOG_INFO("Paging enable successfully");

    print_kernel_pagetable(kernel_table);  // ← 加这一行
}
```

### 快照 ② 和 ③：smode.c

在 `arch/riscv/boot/smode.c` 的 `s_mode_start()` 中：

```c
    kvminit();
    kvminithart();

    plic_init_uart();
    display_banner();

    timerinit();

    early_mode = 0;
    uart_base_ptr = (volatile unsigned char *) PA2VA(UART0_BASE);
    kernel_table = (pagetable_t) PA2VA((uint64) kernel_table);

    // 快照 ②：恒等映射还在
    print_kernel_pagetable(kernel_table);

    uint64 target = (uint64) high_mode_start + KERNEL_VIRT_OFFSET;
    switch_to_high_address(target, KERNEL_VIRT_OFFSET);
```

然后在 `arch/riscv/boot/smode.c` 的 `high_mode_start()` 最开头：

```c
void __attribute__((noreturn)) high_mode_start()
{
    // 快照 ③：恒等映射已被清除
    print_kernel_pagetable(kernel_table);

    LOG_TRACE("Successfully jumped to high address!");
    ...
```

### 输出分析

快照 ① 和 ② 的映射内容完全一样，原因是：`switch_to_high_address` 只是把 PC 和 SP 抬到高地址，**并没有修改页表**。它改的是 CPU 的视角，不是页表的内容。

快照 ③ 少了所有低地址的恒等映射（`0x0` ~ `0x3FFFFFFF`），因为 `clear_low_memory_mappings()` 把 `kernel_table[0..2]` 清零了。每个 root PTE 覆盖 1GB 虚拟地址空间，3 个刚好覆盖前 3GB，也就是低地址恒等映射的全部区间。

## 破坏任务：删掉一个恒等映射

### 推荐破坏目标：UART 恒等映射

UART 恒等映射是最安全的破坏目标，因为崩溃时会有日志输出指导你定位。

#### 代码修改

在 `arch/riscv/boot/smode.c` 的 `s_mode_start()` 中，`kvminithart()` 之后：

```c
    kvminit();
    kvminithart();

    // === 破坏实验：删除 UART 恒等映射 ===
    // UART 物理基地址 0x10000000，恒等映射的 VA 也是 0x10000000
    pte_t *uart_pte = walk(kernel_table, UART0_BASE, 0);
    if (uart_pte && (*uart_pte & PTE_V)) {
        LOG_WARN("Destroying UART identity mapping at VA %p", (void *)UART0_BASE);
        *uart_pte &= ~PTE_V;   // 清 V 位
        sfence_vma();
    }
    // =====================================

    plic_init_uart();
    display_banner();    // ← 崩在这里！因为 display_banner() 用 LOG_INFO
```

#### 预测

`display_banner()` 会调用 `LOG_BANNER()`，`LOG_BANNER` 最终通过 UART 输出。UART 寄存器在 VA `0x10000000`。恒等映射被删除后，访问 `0x10000000` 会触发 page fault。此时系统还在 S mode，trap handler 也会尝试输出日志（同样访问 UART），导致递归 page fault 或直接停机。

#### 实际行为

系统可能静默崩溃。用 `make debug` 观察：

```bash
make debug
# 在 GDB 中:
(gdb) info registers sepc scause stval
```

预期 `scause` 的值为 `12`（Instruction page fault）或 `13`（Load page fault）或 `15`（Store/AMO page fault）。`stval` 的值应该在 `0x10000000` 附近。`sepc` 指向 `display_banner` 或 `uart_putc` 中的某条指令。

!!! note "查 Trap Codes"
    `scause = 12` 是 instruction page fault，`13` 是 load page fault，`15` 是 store/AMO page fault。对照 [RISC-V Trap Codes](../reference/trap-codes.md)。

### 破坏内核代码段恒等映射（进阶）

清掉 `0x80000000` 的恒等映射更危险——下一条指令取指就崩，连 GDB 都不一定有日志。

```c
// 破坏内核代码段恒等映射
// kernel_table[256] 对应 VA 范围 0x80000000 - 0xBFFFFFFF (bare 模式)
// kernel_table[256] 是一个非叶 PTE，指向二级页表
// 二级页表的第 0 项指向三级页表
// 三级页表的 PTE 才是叶 PTE
// 更直接的做法：清掉 kernel_table[256]（非叶 PTE 的 V 位）
kernel_table[256] = 0;
sfence_vma();
```

预期结果：在 `switch_to_high_address` 之前，CPU 执行 `jr target` 这条指令时会崩——因为取指本身就需要通过恒等映射访问 `target` 低地址对应的指令。

### 对照实验

把同样的破坏代码放在 `kvminithart()` **之前**：

```c
// 破坏代码放在 kvminithart 之前
pte_t *uart_pte = walk(kernel_table, UART0_BASE, 0);
if (uart_pte) {
    *uart_pte &= ~PTE_V;
}
sfence_vma();

kvminithart();  // 打开分页
```

结果：**系统不会崩**。

因为 `kvminithart` 之前 satp 还是 0（MODE=0，分页未开启），CPU 用 VA=PA 模式。虽然你已经把页表里的 PTE 清了，但 CPU 根本没用页表翻译——它直接拿 VA 当 PA 用。`0x10000000` 作为 PA 仍然是合法的 UART 地址。

等到 `kvminithart()` 打开分页，CPU 开始查页表翻译 `0x10000000`，发现对应的 PTE V=0，才会 page fault。

**这说明：页表的内容只有在 satp 打开分页后才对 CPU 可见。** 分页是"opt-in"的——在你不写 satp 之前，你改页表改多少次都没人理你。

## 思考题参考答案

### 1. 为什么需要同时做恒等映射和高地址映射？

只能做一种的话，哪一种都卡不住。

**只做恒等映射**：内核链接在高地址，但高地址没有映射。打开分页后 PC 在低地址还能跑（恒等映射在），但所有 `la` / `call` 指令的目标地址都是高地址——这些访问没有映射，立即 page fault。

**只做高地址映射**：打开分页的瞬间 PC 还在低地址（`0x80000xxx`）。低地址没有映射，取指下一句就 page fault。

所以两种映射缺一不可：恒等映射撑过从"打开分页"到"切到高地址"这段过渡期，高地址映射让切过去之后的内核能正常运行。

### 2. 为什么 kvminithart 之前/之后清映射结果不同？

`kvminithart()` 做的事情是 `w_satp(MAKE_SATP(kernel_table))`——把页表的物理基地址写入 satp 并设置 MODE=Sv39。

写 satp 之前：MODE=0，CPU 不做地址翻译，VA 就是 PA。页表里怎么改都没关系。
写 satp 之后：MODE=8，CPU 的每一次访存都先查页表翻译。页表里少了一条映射，访问对应 VA 就 page fault。

### 3. 为什么 clear_low_memory_mappings 只清 3 个 root PTE？

Sv39 根页表有 512 项，每项覆盖 1GB（2^30 字节）。

前 3 项覆盖的 VA 范围：
- `kernel_table[0]`: `0x00000000 - 0x3FFFFFFF`
- `kernel_table[1]`: `0x40000000 - 0x7FFFFFFF`
- `kernel_table[2]`: `0x80000000 - 0xBFFFFFFF`

3GB，正好覆盖了从 0 到 `PHYSTOP_LOW`（128MB）以及所有可能使用的低地址外设区间。所以清 3 项就够了。

### 4. 页表本身占了多少物理页？

三个来源：根页表（1 页）、二级和三级页表。

数法：页表遍历器在遍历时，每进入一级新页表就计一次数。或者看 `kvmmake()` 里映射了多少个区域——每个区域的 `mappages` 在第一次遇到无效 PTE 时就分配新页表。

参考结果：FrostVistaOS (bare) 的 kernel page table 通常使用 5~8 页，包含：
- 1 页根页表
- 第一级非叶 PTE 指向的二级页表数量取决于映射的 VA 范围。裸机模式下 `0x0-0xBFFFFFFF` 和 `0xffffffc0xxxxxxxx` 各需要若干项。
- 三级页表同理。

具体页数和代码段/data段/extern设备地址分布相关。用你的遍历器也能统计出来。

## 常见错误分析

### 用 PA 访问下级页表（忘了 PA2VA）

页表遍历时，从 PTE 取出的 PPN 是物理地址。在 `kvminithart` 之后系统处于高地址模式，必须用 `PA2VA(ppn)` 转换后才能通过指针访问。

错误代码：
```c
pagetable_t next = (pagetable_t)PPN;  // ← 这是 PA，直接解引用会崩
```

正确代码：
```c
pagetable_t next = (pagetable_t)PA2VA(PPN);
```

### 把 LOG_INFO 放在破坏代码之后

破坏 UART 映射后再调用 `LOG_INFO` 显然会崩。如果你想在破坏后继续输出日志，要么：
- 把日志放在破坏代码之前；
- 只破坏非 UART 的映射（比如内核数据段）；
- 用 GDB 而不是日志来观察行为。

### 清非叶 PTE 后忘了 sfence_vma

如果你清了 `kernel_table[i]`（非叶 PTE），清的是页表结构本身的内存。CPU 的 TLB 缓存的是虚拟地址到物理地址的翻译结果，不是页表结构。但 `sfence_vma` 刷新 TLB 后，下次访问对应 VA 时 CPU 会重新走三级翻译，此时才会触发 page fault。

### 在快照 ③ 之前没看清是在 high_mode_start 里打印

快照 ③ 要在 `high_mode_start()` 的第一行打印。如果放在 `clear_low_memory_mappings()` 之前，你会误以为清理还没生效（因为页表在 `s_mode_start` 末尾还没执行清理——清理是在 `high_mode_start` 里做的）。

---

- [返回 Lab 2 题目](lab2-paging.md)
- [返回分页教程](../chapters/03-paging.md)
