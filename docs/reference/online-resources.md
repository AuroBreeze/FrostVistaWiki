---
icon: lucide/external-link
---

# 在线资源参考

学习 OS 的时候，很容易遇到一种尴尬：代码里出现了一个概念，比如 `satp`、ELF、VirtIO queue、System V ABI，搜索一下能搜到很多文章，但不知道哪一个才是源头。

这页不追求把所有资料都列全，而是放一些后面会反复查的入口。第一次读不需要全部打开，知道“遇到什么问题该查哪里”就够了。

!!! tip "怎么用这页"
    先读 Wiki 和 FrostVistaOS 源码，遇到某个边界不确定时再查规范。规范不是小说，不需要从第一页顺着读。

## RISC-V

- [RISC-V Technical Specifications](https://riscv.org/technical/specifications/)

  RISC-V 官方规范入口。查 ISA、privileged architecture、debug specification 等资料时，可以先从这里找。

- [RISC-V ISA Manual](https://github.com/riscv/riscv-isa-manual)

  查 RISC-V 指令语义时用。比如一条汇编到底改了哪些寄存器、是否会触发异常、有哪些扩展要求。

- [RISC-V Privileged Architecture](https://github.com/riscv/riscv-isa-manual/releases)

  查 S mode、trap、CSR、`satp`、page table、timer interrupt 时用。FrostVistaOS 的启动、分页和 trap 章节会经常碰到它。

- [RISC-V ELF psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)

  查 RISC-V 的 calling convention、寄存器约定、ELF relocation、ABI 名称时用。比如 `a0` 到 `a7` 为什么常被拿来传参数，函数调用时哪些寄存器需要保存。

- [RISC-V GNU Toolchain](https://github.com/riscv-collab/riscv-gnu-toolchain)

  查 `riscv64-elf-gcc`、`riscv64-unknown-elf-gcc` 等工具链来源时用。一般不需要自己从源码编译工具链，但理解工具链组成时很有帮助。

## System V / ELF / ABI

- [System V ABI: Generic ABI](https://refspecs.linuxfoundation.org/elf/gabi4+/contents.html)

  查 ELF 文件格式、program header、section header、symbol table 等概念时用。读 `kernel.elf`、linker script 和 loader 相关内容时，这是最常用的源头。

- [Linux Standard Base: ELF](https://refspecs.linuxfoundation.org/LSB_4.1.0/LSB-Core-generic/LSB-Core-generic/elf.html)

  可作为 ELF 结构的补充索引。它比 GABI 更偏 Linux 生态，但很多字段解释比较容易定位。

- [GNU Binutils Documentation](https://sourceware.org/binutils/docs/)

  查 `ld`、`objdump`、`readelf`、`nm` 等工具行为时用。遇到 linker script 语法或 `objdump` 输出看不懂时，可以从这里找。

## rCore / 教学 OS

- [rCore Tutorial Book v3](https://rcore-os.cn/rCore-Tutorial-Book-v3/)

  中文 RISC-V 教学 OS 资料。它和 FrostVistaOS 不完全一样，但在启动、地址空间、trap、进程、文件系统这些主题上有很好的对照价值。

- [rCore-Tutorial-v3 源码](https://github.com/rcore-os/rCore-Tutorial-v3)

  和 rCore Tutorial Book 配套的源码。适合在读完某个概念后，对照另一个 OS 是怎么组织代码的。

- [xv6-riscv Book](https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf)

  经典教学 OS 文档。查 process、trap、scheduler、file system 的设计思路时很有用。它不是 FrostVistaOS 的直接说明书，但适合作为“为什么 Unix-like 内核通常这么组织”的参考。

- [xv6-riscv 源码](https://github.com/mit-pdos/xv6-riscv)

  和 xv6 book 配套。适合对照 FrostVistaOS 的进程、系统调用、文件系统和 shell 实现。

## VirtIO / QEMU

- [VirtIO 1.2 Specification](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html)

  查 VirtIO device、virtqueue、descriptor table、available ring、used ring 时用。读块设备、文件系统镜像、QEMU virt 设备时会用到。

- [QEMU RISC-V virt machine](https://www.qemu.org/docs/master/system/riscv/virt.html)

  查 QEMU 的 `virt` 机器会提供哪些设备、内存布局和启动约定时用。FrostVistaOS 在 QEMU 上运行，很多“为什么地址是这个”都和它有关。

- [QEMU Documentation](https://www.qemu.org/docs/master/)

  查 QEMU 命令行参数、machine、device、monitor、GDB stub 时用。遇到启动参数或调试参数不确定，可以从这里找。

- [OpenSBI Documentation](https://github.com/riscv-software-src/opensbi/tree/master/docs)

  查 OpenSBI、SBI call、M mode 到 S mode 的启动交接时用。如果使用 `BOOT=opensbi` 路径，这里会比直接猜启动流程可靠。

## 调试与工具

- [GDB Documentation](https://sourceware.org/gdb/documentation/)

  查 breakpoint、watchpoint、remote debugging、RISC-V register、脚本命令时用。OS 调试里经常需要连接 QEMU 的 GDB stub。

- [GNU Make Manual](https://www.gnu.org/software/make/manual/make.html)

  查 Makefile 变量、规则、依赖、模式规则时用。读 FrostVistaOS 构建系统时会遇到。

- [GCC Online Documentation](https://gcc.gnu.org/onlinedocs/)

  查 `-ffreestanding`、`-nostdlib`、`-march`、`-mabi` 等编译参数时用。写内核时，编译器默认行为经常需要显式关掉。

## 建议阅读顺序

如果你刚开始读 FrostVistaOS，不建议一口气读完所有规范。可以按问题来查：

1. 看不懂启动和特权级：先查 RISC-V Privileged Architecture 和 OpenSBI 文档。
2. 看不懂 ELF 和 linker script：先查 System V ABI: Generic ABI 和 GNU Binutils Documentation。
3. 看不懂函数调用和 syscall 参数：先查 RISC-V ELF psABI。
4. 看不懂块设备和文件系统镜像：先查 VirtIO 1.2 Specification 和 QEMU RISC-V virt machine。
5. 想找另一个教学 OS 对照：先看 rCore Tutorial Book v3 或 xv6-riscv Book。

最后需要注意的是：规范负责告诉你“边界是什么”，源码负责告诉你“这个项目实际怎么做”。两边最好对照着看，不要只看其中一边。
