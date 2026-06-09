---
icon: lucide/book-open
---

# 术语表

## 分页相关

| 术语 | 全称 | 一句话解释 |
|------|------|-----------|
| VA | Virtual Address | **虚拟地址**。CPU 发出的地址，不直接等于内存芯片上的物理位置。需要通过页表翻译成 PA。 |
| PA | Physical Address | **物理地址**。内存芯片上真实存在的位置。MMU 从 VA 翻译出来的就是 PA。 |
| VPN | Virtual Page Number | **虚拟页号**。VA 右移 12 位（去掉页内偏移），剩下的就是 VPN。Sv39 下 VPN 是 27 位，进一步切成 VPN[2]/VPN[1]/VPN[0] 三段，每段 9 位，分别索引三级页表。 |
| PPN | Physical Page Number | **物理页号**。PA 右移 12 位（去掉页内偏移），剩下的就是 PPN。存放在 PTE 的 bits 53:10 中。PPN 指向下一级页表的物理基地址，或最终物理页。 |
| PTE | Page Table Entry | **页表项**。页表数组中的一个 8 字节条目。包含 PPN（bits 53:10）和 flags（bits 9:0，如 V/R/W/X/U）。非叶 PTE（R/W/X 全为 0）的 PPN 指向下一级页表；叶 PTE（R/W/X 至少一个为 1）的 PPN 指向最终物理页。 |
| 页表 | Page Table | 一个 4KB 的数组，包含 512 个 PTE。Sv39 使用三级页表——根页表 → 二级 → 三级，共 512³ 个可能的映射。每个进程有自己的页表，内核通过写 `satp` 来切换。 |
| 分页 | Paging | CPU 将 VA 翻译成 PA 的机制。由页表定义映射关系，由 `satp` 寄存器开关，由 MMU 硬件执行翻译。 |
| Sv39 | — | RISC-V 的一种分页模式。虚拟地址 39 位，使用三级页表（每级 9 位索引），支持 4KB 页。FrostVistaOS 使用的分页模式。 |
| MMU | Memory Management Unit | **内存管理单元**。CPU 内部的硬件模块，负责根据页表和 `satp` 自动完成 VA→PA 翻译。对软件透明。 |
| satp | Supervisor Address Translation and Protection | S mode CSR。告诉 CPU 根页表的物理地址和分页模式。`MODE=8` 表示 Sv39，`MODE=0` 表示不分页。 |
| TLB | Translation Lookaside Buffer | **页表缓存**。MMU 内部对最近翻译结果的硬件缓存。改页表后必须执行 `sfence.vma` 刷新 TLB，否则 CPU 可能还在用旧翻译。 |
| 恒等映射 | Identity Mapping | VA = PA 的映射。内核启动初期需要恒等映射，因为打开分页的瞬间 PC/SP 还在低地址——没有恒等映射就会 page fault。 |
| 高地址映射 | High-half Mapping | 把物理低地址映射到虚拟高地址（VA = PA + KERNEL_VIRT_OFFSET）。内核最终运行在高地址，配合恒等映射完成从低地址到高地址的过渡。 |
| VMA | Virtual Memory Address | **虚拟内存地址**。linker script 中 `> VIRT` 指定的地址，决定了 ELF 符号表中变量/函数的地址。 |
| LMA | Load Memory Address | **加载内存地址**。linker script 中 `AT> PHYSMEM` 指定的地址，决定了 QEMU 把 ELF 段加载到物理内存的哪个位置。 |

## 启动相关

| 术语 | 全称 | 一句话解释 |
|------|------|-----------|
| M mode | Machine Mode | RISC-V 最高特权级。控制物理内存保护（PMP）、中断委托、timer 等。FrostVistaOS 在 `mstart()` 中做完交接就 `mret` 退出。 |
| S mode | Supervisor Mode | RISC-V 中间特权级。内核主要运行在此。可以配置页表、处理 trap。 |
| U mode | User Mode | RISC-V 最低特权级。用户程序运行在此。不能直接访问 CSR、不能改页表、不能访问内核内存。 |
| OpenSBI | Open Supervisor Binary Interface | RISC-V 的 SBI 标准实现。提供 M mode 固件服务（timer、IPI 等）。FrostVistaOS 的 `BOOT=opensbi` 路径依赖它。 |
| PMP | Physical Memory Protection | M mode 的物理内存保护机制。`mstart()` 中配置 PMP 允许 S/U mode 访问全部物理内存。 |

## Trap 相关

| 术语 | 全称 | 一句话解释 |
|------|------|-----------|
| Trap | — | 中断和异常的总称。两者走同一套硬件机制（stvec/sepc/scause）。 |
| 中断 | Interrupt | 硬件发给 CPU 的异步信号（timer、设备）。和当前正在执行的指令无关。 |
| 异常 | Exception | 当前指令本身触发的同步事件（ecall、page fault、illegal instruction）。 |
| ecall | Environment Call | RISC-V 指令。U mode 下执行 `ecall` 会陷入 S mode，`scause=8`。是用户程序进入内核的唯一入口。 |
| stvec | Supervisor Trap Vector | S mode CSR。trap 发生后 PC 跳到哪里。FrostVistaOS 有两个 trap 入口：`uservec`（从 U mode 来）和 `kernelvec`（S mode 内部）。 |
| sepc | Supervisor Exception PC | S mode CSR。trap 发生时 CPU 自动把当前 PC 存入 `sepc`。sret 时 PC 恢复为 `sepc`。 |
| scause | Supervisor Cause | S mode CSR。记录 trap 的原因。bit 63 = 1 为 interrupt，= 0 为 exception。低 63 位为具体 cause code。 |
| stval | Supervisor Trap Value | S mode CSR。trap 关联的地址。page fault 时是被访问的 VA，illegal instruction 时是指令本身。 |
| sscratch | Supervisor Scratch | S mode CSR。内核自由使用的临时寄存器。FrostVistaOS 用它存放内核栈顶地址，用户 trap 入口时用 `csrrw` 和用户 SP 交换。 |
| sstatus | Supervisor Status | S mode CSR。记录 S mode 的状态。关键字段：`SPP`（sret 返回的特权级）、`SPIE`（sret 后中断是否打开）、`SIE`（当前中断是否使能）。 |
| sret | Supervisor Return | RISC-V 指令。从 S mode trap 返回。硬件自动从 `sepc` 恢复 PC、从 `SPP` 恢复特权级、从 `SPIE` 恢复中断使能。 |

## 其他

| 术语 | 全称 | 一句话解释 |
|------|------|-----------|
| ELF | Executable and Linkable Format | Unix-like 系统的可执行文件格式。包含 ELF header、program header table（告诉 OS 怎么加载段到内存）、section header table（链接用）。 |
| CSR | Control and Status Register | RISC-V 的控制状态寄存器。用于配置特权级、中断、页表等。只能通过 `csrr/csrw/csrrw` 等专用指令访问。 |
| PLIC | Platform-Level Interrupt Controller | RISC-V 平台级中断控制器。管理外部设备中断（UART、VirtIO 等），负责优先级和分发。 |
| CLINT | Core-Local Interruptor | RISC-V 核本地中断控制器。管理 timer 中断和核间中断。 |
| VirtIO | Virtual I/O | 半虚拟化设备标准。FrostVistaOS 的块设备（磁盘）通过 VirtIO 与 QEMU 通信。 |
